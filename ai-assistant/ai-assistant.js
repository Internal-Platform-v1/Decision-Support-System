// ============================================================
// AI Assistant – Node‑first, steps only for explicit "how to"
// ============================================================

(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
  const state = { isOpen: false, lastMatchedGuideId: "" };
  let guideNodesData = null;
  let guideStepsData = null;
  let activeSession = null;
  let preloadStarted = false;

  function $(id) { return document.getElementById(id); }
  function getEls() { return { launcher: $("fx-ai-launcher"), panel: $("fx-ai-panel"), close: $("fx-ai-close"), minimize: $("fx-ai-minimize"), messages: $("fx-ai-messages"), suggestions: $("fx-ai-suggestions"), input: $("fx-ai-input"), send: $("fx-ai-send"), toolbarButtons: document.querySelectorAll("[data-ai-action]") }; }
  function loadState() { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const s = JSON.parse(raw); state.isOpen = !!s.isOpen; state.lastMatchedGuideId = s.lastMatchedGuideId || ""; } } catch(e){} }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }
  function getBasePath() { return window.SITE_BASE || ""; }
  function resolveGuideUrl(url) { if (!url) return ""; if (/^https?:\/\//i.test(url)) return url; if (url.startsWith("/")) return url; return `${getBasePath()}${url}`; }
  function escapeHtml(v) { return String(v||"").replace(/[&<>]/g, function(m){if(m==="&") return "&amp;"; if(m==="<") return "&lt;"; if(m===">") return "&gt;"; return m;}); }
  function normalizeText(v) { return String(v||"").toLowerCase().replace(/[_/|()[\]{}.,:;'"`~!@#$%^&*+=?<>\\-]+/g, " ").replace(/\s+/g, " ").trim(); }

  // ----- Message UI (shortened for brevity, keep your existing working functions) -----
  function addMessage(role, content, allowHTML) { /* use your existing working version */ }
  function addThinkingMessage() { return addMessage("assistant", `<div class="fx-ai-thinking"><div><div class="fx-ai-thinking-text">Searching...</div><div class="fx-ai-thinking-dots"><span></span><span></span><span></span></div></div></div>`, true); }
  function removeThinkingMessage(row) { if (row && row.parentNode) row.parentNode.removeChild(row); }
  function clearSuggestions() { const els = getEls(); if (els.suggestions) els.suggestions.innerHTML = ""; }
  function setSuggestions(items) { const els = getEls(); if (!els.suggestions) return; els.suggestions.innerHTML = ""; items.forEach(item => { const btn = document.createElement("button"); btn.className = item.className || "fx-ai-suggestion-btn"; btn.textContent = item.label; btn.addEventListener("click", item.onClick); els.suggestions.appendChild(btn); }); }

  // ----- Load JSON -----
  async function loadNodesJSON() { if (guideNodesData) return guideNodesData; try { const res = await fetch(`${getBasePath()}ai-assistant/nodes.json`); if (!res.ok) throw new Error(); guideNodesData = await res.json(); } catch(e) { console.warn("nodes.json not loaded"); guideNodesData = { guides: [] }; } return guideNodesData; }
  async function loadStepsJSON() { if (guideStepsData) return guideStepsData; try { const res = await fetch(`${getBasePath()}ai-assistant/steps.json`); if (!res.ok) throw new Error(); guideStepsData = await res.json(); } catch(e) { console.warn("steps.json not loaded"); guideStepsData = { guides: [] }; } return guideStepsData; }

  // ----- Node matching (decision tree) -----
  async function findBestNodeFromTree(concern) {
    const data = await loadNodesJSON();
    if (!data.guides.length) return null;
    const normInput = normalizeText(concern);
    let bestMatch = null, bestScore = 0;
    for (const guide of data.guides) {
      for (const [nodeId, node] of Object.entries(guide.nodes)) {
        // Build searchable text from node + its choices
        let searchText = `${guide.title} ${node.text} ${node.help||''} ${node.note||''}`;
        if (node.choices) {
          node.choices.forEach(c => { searchText += ` ${c.label} ${c.action||''} ${c.desc||''}`; });
        }
        searchText = searchText.toLowerCase();
        let score = 0;
        if (searchText.includes(normInput)) score += 20;
        const words = normInput.split(/\s+/).filter(w => w.length > 2);
        words.forEach(w => { if (searchText.includes(w)) score += 3; });
        // Extra weight if the node directly contains the action we want
        if (node.action && normInput.includes(normalizeText(node.action))) score += 50;
        if (score > bestScore) { bestScore = score; bestMatch = { guide, nodeId, node }; }
      }
    }
    return bestScore > 5 ? bestMatch : null;
  }

  // ----- Local fallback correction codes (only if no node found) -----
  const CORR_MAP = { "weight":"ACCR", "reweigh":"ACCR", "service level":"ECDL", "reference number":"EREF", "debtor":"ACCR", "loa":"LOA", "change terms":"CUSI or ETMS", "prepaid":"CUSI or ETMS" };
  function localCorrAnswer(concern) {
    const inp = normalizeText(concern);
    for (const [kw, code] of Object.entries(CORR_MAP)) if (inp.includes(kw)) return { type:"recommendation", title:"Correction Code", action:code, reason:`Matched keyword "${kw}"`, nextStep:"Confirm with the Correction Code Guide.", guideTitle:"Correction Code Guide", guideUrl:resolveGuideUrl("Correction Code Guide.html") };
    return null;
  }

  // ----- Step matching (only for explicit procedural queries) -----
  async function tryStepGuide(concern) {
    const norm = normalizeText(concern);
    const isProcedural = norm.startsWith("how to") || norm.includes("steps to") || norm.includes("submit eprt");
    if (!isProcedural) return null;
    const data = await loadStepsJSON();
    if (!data.guides.length) return null;
    // simple match: if guide title or keywords appear
    for (const guide of data.guides) {
      const keywords = `${guide.title} ${guide.category} ${(guide.keywords||[]).join(" ")}`.toLowerCase();
      if (keywords.includes(norm) || norm.includes(guide.title.toLowerCase())) {
        const stepsHtml = guide.steps.map((s,i)=>`<div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:14px;"><strong style="color:var(--fx-ai-orange);">${i+1}. ${escapeHtml(s.title)}</strong><div style="font-size:0.75rem;margin-top:4px;">${escapeHtml(s.content).replace(/\n/g,'<br>')}</div></div>`).join("");
        return { type:"steps", title:guide.title, message:`Steps for ${guide.title}:`, stepsHtml, guideTitle:guide.title, guideUrl:resolveGuideUrl(guide.url||`${guide.id}.html`) };
      }
    }
    return null;
  }

  // ----- Main decision -----
  async function getDecision(concern) {
    const isCorrQuery = /\b(corr|correction)\s*code\b/i.test(concern);
    // 1. For correction queries, use node tree first, then local map (NO steps)
    if (isCorrQuery) {
      const nodeMatch = await findBestNodeFromTree(concern);
      if (nodeMatch && nodeMatch.node.action) {
        return { type:"recommendation", title:"Correction Code", action:nodeMatch.node.action, reason:nodeMatch.node.text, nextStep:"Open the Correction Code Guide to confirm.", guideTitle:nodeMatch.guide.title, guideUrl:resolveGuideUrl(nodeMatch.guide.url||`${nodeMatch.guide.id}.html`) };
      }
      const local = localCorrAnswer(concern);
      if (local) return local;
      return { type:"backup", title:"Not found", message:"I could not find a matching correction code. Please open the Correction Code Guide and follow the tree.", guideTitle:"Correction Code Guide", guideUrl:resolveGuideUrl("Correction Code Guide.html") };
    }
    // 2. Non‑correction: maybe steps or general node
    const step = await tryStepGuide(concern);
    if (step) return step;
    const nodeMatch = await findBestNodeFromTree(concern);
    if (nodeMatch && nodeMatch.node.action) {
      return { type:"recommendation", title:"Recommended Action", action:nodeMatch.node.action, reason:nodeMatch.node.text, nextStep:"Open the guide for details.", guideTitle:nodeMatch.guide.title, guideUrl:resolveGuideUrl(nodeMatch.guide.url||`${nodeMatch.guide.id}.html`) };
    }
    return { type:"backup", title:"No match", message:"Please rephrase or browse the guides.", nextStep:"Use the Browse Guides button." };
  }

  // ----- Rendering (shortened, but keep your working version) -----
  function renderMatchedGuide(title, url) { if (!title||!url) return ""; return `<details class="fx-ai-source-details" style="margin-top:12px;"><summary>Matched guide</summary><div class="fx-ai-source-card"><strong>${escapeHtml(title)}</strong><div class="fx-ai-guide-actions"><a class="fx-ai-link primary" href="${url}">Open Guide</a></div></div></details>`; }
  function renderResult(res) { if (!res) return "<div>No result.</div>"; if (res.type==="steps") return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">${escapeHtml(res.title)}</div><h4>${escapeHtml(res.message)}</h4>${res.stepsHtml}${renderMatchedGuide(res.guideTitle, res.guideUrl)}</div>`; if (res.type==="recommendation") return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">${escapeHtml(res.title)}</div><h4>${escapeHtml(res.action)}</h4>${res.reason?`<div class="fx-ai-answer-row"><span>Why</span><p>${escapeHtml(res.reason)}</p></div>`:""}${res.nextStep?`<div class="fx-ai-answer-row"><span>Next</span><p>${escapeHtml(res.nextStep)}</p></div>`:""}${renderMatchedGuide(res.guideTitle, res.guideUrl)}</div>`; return `<div class="fx-ai-decision-card fx-ai-backup-card"><div class="fx-ai-decision-kicker">${escapeHtml(res.title||"Backup")}</div><h4>${escapeHtml(res.message)}</h4>${renderMatchedGuide(res.guideTitle, res.guideUrl)}</div>`; }

  // ----- Conversation flow (keep your existing working version) -----
  async function runDecisionTurn() { if (!activeSession) return; clearSuggestions(); const thinking = addThinkingMessage(); const result = await getDecision(activeSession.originalConcern); await new Promise(r => setTimeout(r, 180)); removeThinkingMessage(thinking); addMessage("assistant", renderResult(result), true); bindDynamicActions(); if (result.type === "question") setFollowupSuggestions(result); else if (result.type === "backup") setSuggestions([{ label:"Add details", onClick:askForDetails }, { label:"Browse guides", onClick:browseGuides }, { label:"Start over", onClick:clearChat }]); else { activeSession = null; setDoneSuggestions(); } }
  async function startNewConcern(text) { if (!text.trim()) return; activeSession = { originalConcern: text.trim(), conversation: [] }; addMessage("user", text.trim()); await runDecisionTurn(); }
  async function continueConversation(text) { if (!text.trim()) return; if (!activeSession) { await startNewConcern(text); return; } addMessage("user", text.trim()); activeSession.conversation.push({ role:"user", content:text.trim() }); activeSession.originalConcern = text.trim(); await runDecisionTurn(); }
  async function sendInput() { const els = getEls(); const text = els.input?.value.trim(); if (!text) return; els.input.value = ""; autoresizeInput(); if (activeSession) await continueConversation(text); else await startNewConcern(text); }
  function askForDetails() { addMessage("assistant", "Type the missing detail."); clearSuggestions(); setTimeout(() => getEls().input?.focus(), 60); }
  function setFollowupSuggestions(result) { const items = (result.choices||[]).map(label => ({ label, onClick: () => continueConversation(label) })); items.push({ label:"None of these", onClick:() => continueConversation("None of these") }, { label:"Add details", onClick:askForDetails }); setSuggestions(items); }
  function setDoneSuggestions() { setSuggestions([{ label:"Browse guides", onClick:browseGuides }, { label:"Start over", onClick:clearChat }]); }
  function browseGuides() { activeSession = null; addMessage("assistant", "Browse guides using the toolbar above.", false); clearSuggestions(); }
  function clearChat() { const els = getEls(); if (els.messages) els.messages.innerHTML = ""; activeSession = null; clearSuggestions(); showWelcome(); }
  function showWelcome() { addMessage("assistant", "Hi, I'm your AI Decision Assistant. Ask for a correction code or procedure."); setSuggestions([{ label:"Correction code for weight", onClick:() => startNewConcern("What is the correction code for weight update?") }, { label:"How to submit ePRT", onClick:() => startNewConcern("How to submit ePRT ticket?") }, { label:"Change terms code", onClick:() => startNewConcern("What is the corr code for change terms to prepaid?") }]); }

  // ----- UI controls (keep your existing working versions) -----
  function openPanel() { const els = getEls(); if (!els.panel) return; els.panel.classList.remove("hidden"); state.isOpen = true; saveState(); if (!preloadStarted) { preloadStarted = true; loadNodesJSON(); loadStepsJSON(); } setTimeout(() => els.input?.focus(), 60); }
  function closePanel() { const els = getEls(); if (!els.panel) return; els.panel.classList.add("hidden"); state.isOpen = false; saveState(); }
  function autoresizeInput() { const els = getEls(); if (!els.input) return; els.input.style.height = "auto"; els.input.style.height = Math.min(els.input.scrollHeight, 96) + "px"; }
  function bindDynamicActions() { document.querySelectorAll("[data-guide-open]").forEach(el => { if (!el.dataset.bound) { el.dataset.bound = "true"; el.addEventListener("click", () => { if (el.getAttribute("data-guide-open")) window.location.href = el.getAttribute("data-guide-open"); }); } }); }
  function bindEvents() { const els = getEls(); if (!els.launcher) return; els.launcher.addEventListener("click", openPanel); els.close?.addEventListener("click", closePanel); els.minimize?.addEventListener("click", closePanel); els.send?.addEventListener("click", sendInput); els.input?.addEventListener("input", autoresizeInput); els.input?.addEventListener("keydown", async e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); await sendInput(); } }); els.toolbarButtons.forEach(btn => { btn.addEventListener("click", () => { const a = btn.getAttribute("data-ai-action"); if (a === "find-guide") { activeSession = null; addMessage("assistant", "Type your concern."); clearSuggestions(); } if (a === "show-guides") browseGuides(); if (a === "clear-chat") clearChat(); }); }); }
  function boot() { loadState(); bindEvents(); showWelcome(); if (state.isOpen) openPanel(); }
  function waitForMarkup() { let tries = 0; const timer = setInterval(() => { if ($("fx-ai-launcher") && $("fx-ai-panel")) { clearInterval(timer); boot(); } if (++tries > 80) { clearInterval(timer); console.error("Assistant markup not found"); } }, 80); }
  waitForMarkup();
})();
