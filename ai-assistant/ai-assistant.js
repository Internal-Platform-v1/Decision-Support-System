(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v6";
  const FX_AI_BACKEND_URL = "https://fx-ai-groq-server.onrender.com";

  const state = { lastConcern: "", lastMatchedGuideId: "", isOpen: false };
  const nodeCache = new Map();
  let preloadStarted = false;
  let activeSession = null;

  const $ = (id) => document.getElementById(id);
  const els = () => ({
    launcher: $("fx-ai-launcher"), panel: $("fx-ai-panel"), close: $("fx-ai-close"), minimize: $("fx-ai-minimize"),
    messages: $("fx-ai-messages"), suggestions: $("fx-ai-suggestions"), input: $("fx-ai-input"), send: $("fx-ai-send"),
    toolbarButtons: document.querySelectorAll("[data-ai-action]")
  });

  function loadState() { try { Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch {} }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
  function getRegistry() { return Array.isArray(window.GUIDE_REGISTRY) ? window.GUIDE_REGISTRY : []; }
  function getBasePath() { return window.SITE_BASE || ""; }
  function resolveGuideUrl(url) { if (!url) return ""; if (/^https?:\/\//i.test(url) || url.startsWith("/")) return url; return `${getBasePath()}${url}`; }
  function escapeHtml(str) { return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function normalizeText(text) { return String(text || "").toLowerCase().replace(/[_/|()[\]{}.,:;'"`~!@#$%^&*+=?<>\\-]+/g," ").replace(/\s+/g," ").trim(); }
  function compactText(text, max = 180) { const clean = String(text || "").replace(/\s+/g," ").trim(); return clean.length <= max ? clean : clean.slice(0, max - 1).trim() + "…"; }
  function scoreText(input, value, points) {
    const a = normalizeText(input), b = normalizeText(value); if (!a || !b) return 0;
    let s = 0; if (a.includes(b)) s += points; if (b.includes(a) && a.length >= 5) s += Math.floor(points / 2);
    const words = new Set(a.split(" ").filter(w => w.length >= 3)); b.split(" ").filter(w => w.length >= 3).forEach(w => { if (words.has(w)) s += 1; });
    return s;
  }

  function addMessage(role, content, allowHTML = false) {
    const e = els(); if (!e.messages) return null;
    const row = document.createElement("div"); row.className = `fx-ai-message ${role}`;
    if (role === "assistant") { const avatar = document.createElement("div"); avatar.className = "fx-ai-avatar"; row.appendChild(avatar); }
    const bubble = document.createElement("div"); bubble.className = "fx-ai-bubble";
    if (allowHTML) bubble.innerHTML = content; else bubble.textContent = content;
    row.appendChild(bubble); e.messages.appendChild(row);
    requestAnimationFrame(() => { e.messages.scrollTop = e.messages.scrollHeight; });
    return row;
  }

  function addThinkingMessage() {
    return addMessage("assistant", `<div class="fx-ai-thinking"><div><div class="fx-ai-thinking-text">Reading full guide nodes...</div><div class="fx-ai-thinking-dots"><span></span><span></span><span></span></div></div></div>`, true);
  }
  function removeThinkingMessage(row) { if (row?.parentNode) row.parentNode.removeChild(row); }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function clearSuggestions() { const e = els(); if (e.suggestions) e.suggestions.innerHTML = ""; }
  function setSuggestions(items) {
    const e = els(); if (!e.suggestions) return; e.suggestions.innerHTML = "";
    items.forEach(item => { const btn = document.createElement("button"); btn.className = item.className || "fx-ai-suggestion-btn"; btn.textContent = item.label; btn.addEventListener("click", item.onClick); e.suggestions.appendChild(btn); });
  }

  function findNodesObjectStart(html) {
    const patterns = [/const\s+NODES\s*=/g, /let\s+NODES\s*=/g, /var\s+NODES\s*=/g, /window\.NODES\s*=/g];
    for (const pattern of patterns) { const m = pattern.exec(html); if (!m) continue; const brace = html.indexOf("{", m.index + m[0].length); if (brace !== -1) return brace; }
    return -1;
  }

  function extractBalancedObject(html, start) {
    let depth = 0, s = false, d = false, t = false, line = false, block = false, esc = false;
    for (let i = start; i < html.length; i++) {
      const c = html[i], n = html[i + 1];
      if (line) { if (c === "\n") line = false; continue; }
      if (block) { if (c === "*" && n === "/") { block = false; i++; } continue; }
      if (esc) { esc = false; continue; }
      if (c === "\\") { if (s || d || t) esc = true; continue; }
      if (!s && !d && !t && c === "/" && n === "/") { line = true; i++; continue; }
      if (!s && !d && !t && c === "/" && n === "*") { block = true; i++; continue; }
      if (!d && !t && c === "'") { s = !s; continue; }
      if (!s && !t && c === '"') { d = !d; continue; }
      if (!s && !d && c === "`") { t = !t; continue; }
      if (s || d || t) continue;
      if (c === "{") depth++;
      if (c === "}") { depth--; if (depth === 0) return html.slice(start, i + 1); }
    }
    return "";
  }

  function extractNodesFromHtml(html) {
    const start = findNodesObjectStart(html); if (start === -1) return null;
    const objectText = extractBalancedObject(html, start); if (!objectText) return null;
    try { return new Function(`return (${objectText});`)(); } catch (err) { console.error("Failed to parse NODES object:", err); return null; }
  }

  function normalizeGuideNodes(guide, nodes) {
    const normalizedNodes = Object.entries(nodes || {}).map(([nodeId, node]) => {
      const choicesDetailed = Array.isArray(node.choices) ? node.choices.map(c => ({ label: c.label || "", next: c.next || "", desc: c.desc || "" })).filter(c => c.label) : [];
      const choices = choicesDetailed.map(c => c.label);
      const choiceDescriptions = choicesDetailed.map(c => c.desc).filter(Boolean);
      const isFinal = !Array.isArray(node.choices) || node.choices.length === 0;
      return {
        nodeId, type: isFinal ? "final" : "question", text: node.text || "", help: node.help || "", note: node.note || "",
        choices, choicesDetailed, choiceDescriptions, finalRecommendation: isFinal ? node.text || "" : "",
        searchText: [guide.title, guide.category, guide.badge, guide.description, ...(guide.keywords || []), nodeId, node.text, node.help, node.note, ...choices, ...choiceDescriptions, ...choicesDetailed.map(c => c.next)].join(" ")
      };
    });
    return { guide, nodes: normalizedNodes };
  }

  async function loadGuideNodes(guide) {
    if (!guide?.id || !guide?.url) return null;
    if (nodeCache.has(guide.id)) return nodeCache.get(guide.id);
    try {
      const res = await fetch(resolveGuideUrl(guide.url), { cache: "force-cache" });
      if (!res.ok) throw new Error(`Failed to fetch guide page: ${guide.url}`);
      const html = await res.text(); const nodes = extractNodesFromHtml(html);
      if (!nodes) { console.warn(`No NODES object found for guide: ${guide.title}`); nodeCache.set(guide.id, null); return null; }
      const data = normalizeGuideNodes(guide, nodes); nodeCache.set(guide.id, data); return data;
    } catch (err) { console.error("Failed to load guide nodes:", guide.title, err); nodeCache.set(guide.id, null); return null; }
  }

  async function loadAllGuideNodes() { return (await Promise.all(getRegistry().map(g => loadGuideNodes(g)))).filter(Boolean); }
  function startNodePreload() { if (preloadStarted) return; preloadStarted = true; loadAllGuideNodes(); }

  function scoreGuideNodeMap(input, guideData) {
    const g = guideData.guide || {}; const asksCorr = /\b(corr|correction)\s*code\b/i.test(input) || /\bcorr\b/i.test(input);
    let score = scoreText(input, g.title, 14) + scoreText(input, g.category, 3) + scoreText(input, g.badge, 2) + scoreText(input, g.description, 5) + (g.keywords || []).reduce((sum, k) => sum + scoreText(input, k, 8), 0);
    if (asksCorr && /correction|corr/i.test(`${g.id || ""} ${g.title || ""} ${g.description || ""}`)) score += 120;
    score += (guideData.nodes || []).reduce((sum, node) => sum + scoreText(input, node.searchText, node.type === "final" ? 7 : 5), 0);
    return score;
  }

  async function findRelevantGuideNodeMaps(input, limit = 6) {
    const all = await loadAllGuideNodes(); const asksCorr = /\b(corr|correction)\s*code\b/i.test(input) || /\bcorr\b/i.test(input);
    const scored = all.map(data => ({ ...data, score: scoreGuideNodeMap(input, data) })).sort((a, b) => b.score - a.score);
    let selected = scored.filter(x => x.score > 0).slice(0, limit);
    if (asksCorr) {
      const correction = scored.find(x => /correction|corr/i.test(`${x.guide?.id || ""} ${x.guide?.title || ""}`));
      if (correction && !selected.some(x => x.guide.id === correction.guide.id)) selected = [correction, ...selected].slice(0, limit);
    }
    return selected;
  }

  function buildGuidePayload(data) {
    return {
      score: data.score || 0,
      guide: { id: data.guide.id || "", title: data.guide.title || "", url: data.guide.url || "", category: data.guide.category || "", description: data.guide.description || "" },
      nodes: (data.nodes || []).slice(0, 160).map(n => ({ nodeId: n.nodeId, type: n.type, text: n.text, help: n.help, note: n.note, choicesDetailed: n.choicesDetailed, choices: n.choices, finalRecommendation: n.finalRecommendation }))
    };
  }

  function buildGuideSummaryPayload() {
    return getRegistry().map(g => ({ guide: { id: g.id || "", title: g.title || "", url: g.url || "", category: g.category || "", description: g.description || "" } }));
  }

  async function askDecisionAssistant(concern, guideMaps, conversation = []) {
    try {
      const response = await fetch(`${FX_AI_BACKEND_URL}/api/ai-decision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concern, guides: (guideMaps || []).map(buildGuidePayload).slice(0, 6), allGuideSummaries: buildGuideSummaryPayload(), conversation })
      });
      if (!response.ok) throw new Error("AI backend request failed.");
      const data = await response.json(); if (!data.ok || !data.result) throw new Error(data.error || "No AI result returned.");
      return data.result;
    } catch (err) { console.error("AI decision assistant failed:", err); return null; }
  }

  function findGuideDataByTitle(maps, title) {
    const target = normalizeText(title); if (!target) return maps?.[0] || null;
    return (maps || []).find(x => normalizeText(x.guide?.title).includes(target) || target.includes(normalizeText(x.guide?.title))) || maps?.[0] || null;
  }
  function findNodeInGuide(data, nodeId) { const target = normalizeText(nodeId); return target && data ? (data.nodes || []).find(n => normalizeText(n.nodeId) === target) || null : null; }

  function renderMatchedGuideDetails(guideData, result) {
    if (!guideData) return "";
    const guide = guideData.guide || {}; const node = findNodeInGuide(guideData, result?.nodeId);
    const safeUrl = escapeHtml(resolveGuideUrl(guide.url || "")); const directUrl = node ? `${safeUrl}?node=${encodeURIComponent(node.nodeId || "")}` : safeUrl;
    const displayText = compactText(node?.finalRecommendation || node?.text || guide.description || "Open the matched guide to review.", 220);
    return `<details class="fx-ai-source-details"><summary>View matched guide</summary><div class="fx-ai-source-card"><div class="fx-ai-source-head"><span>${node?.type === "final" ? "Official Final Match" : "Matched Guide"}</span><strong>${escapeHtml(guide.title || "Recommended Guide")}</strong></div><p>${escapeHtml(displayText)}</p><div class="fx-ai-guide-meta"><span class="fx-ai-tag">${escapeHtml(guide.category || "Guide")}</span>${node?.nodeId ? `<span class="fx-ai-tag">${escapeHtml(node.nodeId)}</span>` : ""}</div><div class="fx-ai-guide-actions"><a class="fx-ai-link primary" href="${safeUrl}"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Open Guide</span></a>${node?.nodeId ? `<a class="fx-ai-link secondary" href="${directUrl}"><i class="fa-solid fa-location-dot"></i><span>Open Step</span></a>` : ""}</div></div></details>`;
  }

  function renderDecisionResult(result, maps) {
    const guideData = findGuideDataByTitle(maps, result?.guideTitle);
    if (!result) return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">Need more detail</div><h4>I reviewed the guide nodes, but I need one clearer detail before deciding.</h4><p>Type the missing detail in your own words, or use the backup options below.</p></div>${renderMatchedGuideDetails(guideData, result)}`;
    if (result.type === "question") return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Need one detail")}</div><h4>${escapeHtml(result.message || "I need one more detail before deciding.")}</h4></div>${renderMatchedGuideDetails(guideData, result)}`;
    if (result.type === "backup") return `<div class="fx-ai-decision-card fx-ai-backup-card"><div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Backup Plan")}</div><h4>${escapeHtml(result.message || "The listed options do not clearly fit this concern.")}</h4>${result.nextStep ? `<p>${escapeHtml(result.nextStep)}</p>` : ""}</div>${renderMatchedGuideDetails(guideData, result)}`;
    return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Recommended Action")}</div><h4>${escapeHtml(result.action || "Review the matched guide.")}</h4>${result.reason ? `<div class="fx-ai-answer-row"><span>Why</span><p>${escapeHtml(result.reason)}</p></div>` : ""}${result.nextStep ? `<div class="fx-ai-answer-row"><span>Next Step</span><p>${escapeHtml(result.nextStep)}</p></div>` : ""}</div>${renderMatchedGuideDetails(guideData, result)}`;
  }

  function renderGuideCard(guide) {
    const url = escapeHtml(resolveGuideUrl(guide.url));
    return `<div class="fx-ai-source-card"><div class="fx-ai-source-head"><span>Matched Guide</span><strong>${escapeHtml(guide.title)}</strong></div><p>${escapeHtml(compactText(guide.description || "No guide description available.", 120))}</p><div class="fx-ai-guide-meta"><span class="fx-ai-tag">${escapeHtml(guide.category || "Guide")}</span></div><div class="fx-ai-guide-actions"><a class="fx-ai-link primary" href="${url}"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Open Guide</span></a></div></div>`;
  }
  function renderGuideList(guides, title = "Available Guides") {
    if (!guides.length) return `<div class="fx-ai-card"><div class="fx-ai-card-title">${escapeHtml(title)}</div><div class="fx-ai-empty-list"><div class="fx-ai-guide-desc">No guides found.</div></div></div>`;
    const items = guides.map(g => `<div class="fx-ai-list-item" data-guide-open="${escapeHtml(resolveGuideUrl(g.url))}"><strong>${escapeHtml(g.title)}</strong><span>${escapeHtml(compactText(g.description || "", 95))}</span></div>`).join("");
    return `<div class="fx-ai-card"><div class="fx-ai-card-title">${escapeHtml(title)}</div><div class="fx-ai-empty-list">${items}</div></div>`;
  }

  function showWelcome() {
    addMessage("assistant", `Hi, I’m your AI Decision Assistant.\n\nType the customer’s concern. I’ll review the guide nodes, ask relevant questions, and give the recommended action.`);
    setSuggestions([{ label: "Weight update per BOL", onClick: () => startNewConcern("Customer wants to apply the weight shown on the BOL.") }, { label: "RVSL refusal", onClick: () => startNewConcern("Customer is refusing charges and wants reversal.") }, { label: "Service level mismatch", onClick: () => startNewConcern("Customer says the service level should be Economy but FBC shows Priority.") }]);
  }
  function showNoMatch() { addMessage("assistant", `I couldn’t confidently match that yet.\n\nPlease add a few more details, like the dispute type, BOL note, LOA status, service level, correction code, or queue name.`); }

  async function runDecisionTurn() {
    if (!activeSession) return; clearSuggestions(); const thinking = addThinkingMessage();
    const allText = [activeSession.originalConcern, ...activeSession.conversation.map(i => i.content)].join(" ");
    const guideMaps = await findRelevantGuideNodeMaps(allText, 6); activeSession.guideMaps = guideMaps;
    const result = await askDecisionAssistant(activeSession.originalConcern, guideMaps, activeSession.conversation); activeSession.lastResult = result;
    await wait(200); removeThinkingMessage(thinking);
    if (!guideMaps.length && !result) { showNoMatch(); setBackupSuggestions(); return; }
    if (guideMaps?.[0]?.guide?.id) { state.lastMatchedGuideId = guideMaps[0].guide.id; saveState(); }
    addMessage("assistant", renderDecisionResult(result, guideMaps), true);
    if (result?.type === "question") { setQuestionSuggestions(result); return; }
    if (result?.type === "backup") { setBackupSuggestions(); return; }
    activeSession = null; setSuggestions([{ label: "Open recent match", onClick: openRecentGuide }, { label: "Browse guides", onClick: browseAllGuides }, { label: "Start over", onClick: clearChat }]); bindDynamicActions();
  }

  function setQuestionSuggestions(result) {
    const choices = Array.isArray(result.choices) ? result.choices.filter(Boolean).slice(0, 5) : [];
    const items = choices.map(choice => ({ label: choice, onClick: () => continueWithAnswer(choice) }));
    items.push({ label: "None of these fit", className: "fx-ai-suggestion-btn fx-ai-backup-option", onClick: () => continueWithAnswer("None of these fit") });
    items.push({ label: "Add details", className: "fx-ai-suggestion-btn fx-ai-backup-option", onClick: askForMoreDetails });
    setSuggestions(items); bindDynamicActions();
  }
  function setBackupSuggestions() { setSuggestions([{ label: "Add details", className: "fx-ai-suggestion-btn fx-ai-backup-option", onClick: askForMoreDetails }, { label: "Browse guides", onClick: browseAllGuides }, { label: "Start over", onClick: clearChat }]); bindDynamicActions(); }
  function askForMoreDetails() { addMessage("assistant", "Please type the missing detail in your own words. Include what the customer is asking, what the BOL/LOA/system shows, what correction code you are looking for, or what you already checked."); clearSuggestions(); setTimeout(() => els().input?.focus(), 50); }
  async function continueWithAnswer(answer) { if (!activeSession) return startNewConcern(answer); addMessage("user", answer); activeSession.conversation.push({ role: "user", content: `Answer to "${activeSession.lastResult?.message || "previous question"}": ${answer}` }); await runDecisionTurn(); }
  async function startNewConcern(text) { const trimmed = String(text || "").trim(); if (!trimmed) return; activeSession = { originalConcern: trimmed, conversation: [], lastResult: null, guideMaps: [] }; state.lastConcern = trimmed; saveState(); addMessage("user", trimmed); clearSuggestions(); await runDecisionTurn(); }
  async function handleConcern(text) { const trimmed = String(text || "").trim(); if (!trimmed) return; if (activeSession) { addMessage("user", trimmed); activeSession.conversation.push({ role: "user", content: trimmed }); await runDecisionTurn(); return; } await startNewConcern(trimmed); }

  function browseAllGuides() { activeSession = null; addMessage("assistant", renderGuideList(getRegistry(), "All Registered Guides"), true); bindDynamicActions(); clearSuggestions(); }
  function openRecentGuide() { const recent = getRegistry().find(g => g.id === state.lastMatchedGuideId) || null; if (!recent) return addMessage("assistant", "There is no recent matched guide yet."); addMessage("assistant", `Here is your most recent matched guide.${renderGuideCard(recent)}`, true); bindDynamicActions(); }
  function clearChat() { if (els().messages) els().messages.innerHTML = ""; activeSession = null; state.lastConcern = ""; saveState(); clearSuggestions(); showWelcome(); }
  function bindDynamicActions() { document.querySelectorAll("[data-guide-open]").forEach(item => { if (item.dataset.bound === "true") return; item.dataset.bound = "true"; item.addEventListener("click", () => { const url = item.getAttribute("data-guide-open"); if (url) window.location.href = url; }); }); }
  function openPanel() { const e = els(); if (!e.panel) return; e.panel.classList.remove("hidden"); e.panel.setAttribute("aria-hidden", "false"); state.isOpen = true; saveState(); startNodePreload(); setTimeout(() => e.input?.focus(), 60); }
  function closePanel() { const e = els(); if (!e.panel) return; e.panel.classList.add("hidden"); e.panel.setAttribute("aria-hidden", "true"); state.isOpen = false; saveState(); }
  function autoresizeInput() { const input = els().input; if (!input) return; input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 96) + "px"; }
  async function sendInput() { const input = els().input; if (!input) return; const text = input.value.trim(); if (!text) return; input.value = ""; autoresizeInput(); await handleConcern(text); }
  function bindEvents() { const e = els(); if (!e.launcher || !e.panel) return; e.launcher.addEventListener("click", openPanel); e.close?.addEventListener("click", closePanel); e.minimize?.addEventListener("click", closePanel); e.send?.addEventListener("click", sendInput); e.input?.addEventListener("input", autoresizeInput); e.input?.addEventListener("keydown", async ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); await sendInput(); } }); e.toolbarButtons.forEach(btn => btn.addEventListener("click", () => { const action = btn.getAttribute("data-ai-action"); if (action === "find-guide") { activeSession = null; addMessage("assistant", "Type the concern and I’ll review the guide nodes for the best next question."); clearSuggestions(); } if (action === "recent-guide") openRecentGuide(); if (action === "show-guides") { activeSession = null; browseAllGuides(); } if (action === "clear-chat") clearChat(); })); }
  function boot() { loadState(); bindEvents(); showWelcome(); setTimeout(startNodePreload, 800); if (state.isOpen) openPanel(); }
  function waitForMarkup() { let count = 0; const timer = setInterval(() => { if ($("fx-ai-launcher") && $("fx-ai-panel")) { clearInterval(timer); boot(); } count++; if (count > 80) { clearInterval(timer); console.error("AI assistant markup was not found."); } }, 80); }
  waitForMarkup();
})();
