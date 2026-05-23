// ============================================================
// AI Assistant – Full working version with priority for correction guides
// ============================================================

(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
  const FX_AI_BACKEND_URL = "https://fx-ai-groq-server.onrender.com";

  const state = { isOpen: false, lastMatchedGuideId: "" };
  let guideNodesData = null;
  let guideStepsData = null;
  let activeSession = null;
  let preloadStarted = false;

  function $(id) { return document.getElementById(id); }

  function getEls() {
    return {
      launcher: $("fx-ai-launcher"),
      panel: $("fx-ai-panel"),
      close: $("fx-ai-close"),
      minimize: $("fx-ai-minimize"),
      messages: $("fx-ai-messages"),
      suggestions: $("fx-ai-suggestions"),
      input: $("fx-ai-input"),
      send: $("fx-ai-send"),
      toolbarButtons: document.querySelectorAll("[data-ai-action]")
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state.isOpen = !!saved.isOpen;
      state.lastMatchedGuideId = saved.lastMatchedGuideId || "";
    } catch (err) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {}
  }

  function getBasePath() {
    return window.SITE_BASE || "";
  }

  function resolveGuideUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return url;
    return `${getBasePath()}${url}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactText(value, max) { return value; }
  function asksForCorrCode(text) { return /\b(corr|correction)\s*code\b/i.test(text) || /\bcorr\b/i.test(text); }

  // ----- Message UI -----
  function addMessage(role, content, allowHTML = false) {
    const els = getEls();
    if (!els.messages) return null;
    const row = document.createElement("div");
    row.className = `fx-ai-message ${role}`;
    if (role === "assistant") {
      const avatar = document.createElement("div");
      avatar.className = "fx-ai-avatar";
      row.appendChild(avatar);
    }
    const bubble = document.createElement("div");
    bubble.className = "fx-ai-bubble";
    if (allowHTML) {
      bubble.style.whiteSpace = "normal";
      bubble.style.padding = "10px";
      bubble.innerHTML = String(content || "").replace(/>\s+</g, "><").trim();
    } else {
      bubble.textContent = content;
    }
    row.appendChild(bubble);
    els.messages.appendChild(row);
    requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
    return row;
  }

  function addThinkingMessage() {
    return addMessage("assistant", `<div class="fx-ai-thinking"><div><div class="fx-ai-thinking-text">Searching guides...</div><div class="fx-ai-thinking-dots"><span></span><span></span><span></span></div></div></div>`, true);
  }

  function removeThinkingMessage(row) { if (row && row.parentNode) row.parentNode.removeChild(row); }
  function clearSuggestions() { const els = getEls(); if (els.suggestions) els.suggestions.innerHTML = ""; }
  function setSuggestions(items) {
    const els = getEls();
    if (!els.suggestions) return;
    els.suggestions.innerHTML = "";
    items.forEach(item => {
      const btn = document.createElement("button");
      btn.className = item.className || "fx-ai-suggestion-btn";
      btn.textContent = item.label;
      btn.addEventListener("click", item.onClick);
      els.suggestions.appendChild(btn);
    });
  }

  // ----- Load JSON -----
  async function loadNodesJSON() {
    if (guideNodesData) return guideNodesData;
    try {
      const res = await fetch(`${getBasePath()}ai-assistant/nodes.json`);
      if (!res.ok) throw new Error();
      guideNodesData = await res.json();
      console.log("Loaded nodes.json");
    } catch (e) {
      console.warn("nodes.json not loaded");
      guideNodesData = { guides: [] };
    }
    return guideNodesData;
  }

  async function loadStepsJSON() {
    if (guideStepsData) return guideStepsData;
    try {
      const res = await fetch(`${getBasePath()}ai-assistant/steps.json`);
      if (!res.ok) throw new Error();
      guideStepsData = await res.json();
      console.log("Loaded steps.json");
    } catch (e) {
      console.warn("steps.json not loaded");
      guideStepsData = { guides: [] };
    }
    return guideStepsData;
  }

  // ----- Flatten nodes and steps -----
  async function getAllFlattenedNodes() {
    const data = await loadNodesJSON();
    const flat = [];
    for (const guide of data.guides) {
      for (const [nodeId, node] of Object.entries(guide.nodes)) {
        const searchText = `${guide.title} ${node.text} ${node.help||''} ${node.note||''} ${node.choices?.map(c=>c.label).join(' ')}`.toLowerCase();
        flat.push({ guide, nodeId, node, searchText });
      }
    }
    return flat;
  }

  async function getAllFlattenedSteps() {
    const data = await loadStepsJSON();
    const flat = [];
    for (const guide of data.guides) {
      let searchText = `${guide.title} ${guide.category} ${(guide.keywords||[]).join(' ')}`;
      guide.steps.forEach(s => searchText += ` ${s.title} ${s.content}`);
      flat.push({ guide, searchText: searchText.toLowerCase() });
    }
    return flat;
  }

  // ----- Scoring with priority for correction queries -----
  async function findBestMatch(input) {
    const normInput = normalizeText(input);
    const isCorrectionQuery = asksForCorrCode(input) || /change terms|per bol|account code|weight|class|reference|accessorial/i.test(normInput);
    
    const nodes = await getAllFlattenedNodes();
    let bestNode = null, bestNodeScore = 0;
    for (const n of nodes) {
      let score = 0;
      if (n.searchText.includes(normInput)) score += 20;
      const words = normInput.split(/\s+/);
      for (const w of words) if (w.length > 2 && n.searchText.includes(w)) score += 3;
      if (isCorrectionQuery) score += 15;
      if (score > bestNodeScore) { bestNodeScore = score; bestNode = n; }
    }
    
    const steps = await getAllFlattenedSteps();
    let bestStep = null, bestStepScore = 0;
    for (const s of steps) {
      let score = 0;
      if (s.searchText.includes(normInput)) score += 15;
      const words = normInput.split(/\s+/);
      for (const w of words) if (w.length > 2 && s.searchText.includes(w)) score += 2;
      if (isCorrectionQuery) score -= 20;
      if (score > bestStepScore) { bestStepScore = score; bestStep = s; }
    }
    
    console.log(`Best node: ${bestNode?.guide.title} score ${bestNodeScore}`);
    console.log(`Best step: ${bestStep?.guide.title} score ${bestStepScore}`);
    
    if (bestNodeScore > 10 && bestNodeScore >= bestStepScore) {
      return { type: "node", data: bestNode };
    }
    if (bestStepScore > 15 && bestStepScore > bestNodeScore) {
      return { type: "step", data: bestStep };
    }
    if (bestNode) return { type: "node", data: bestNode };
    return null;
  }

  // ----- Local correction map -----
  const CORRECTION_CODE_MAP = {
    "weight": "ACCR", "reweigh": "ACCR", "service level": "ECDL",
    "reference number": "EREF", "debtor": "ACCR", "loa": "LOA",
    "change terms": "CUSI or ETMS", "account code": "CUSI or ECD"
  };
  function findLocalCorrAnswer(input) {
    if (!asksForCorrCode(input)) return null;
    const inp = normalizeText(input);
    for (const [kw, code] of Object.entries(CORRECTION_CODE_MAP)) {
      if (inp.includes(kw)) {
        return {
          type: "recommendation",
          title: "Recommended Correction Code",
          action: code,
          reason: `Based on keyword "${kw}".`,
          nextStep: `Use ${code}. Confirm with guide.`,
          guideTitle: "",
          nodeId: ""
        };
      }
    }
    return null;
  }

  // ----- Main decision -----
  async function getDecision(concern) {
    const local = findLocalCorrAnswer(concern);
    if (local) return local;
    const match = await findBestMatch(concern);
    if (!match) {
      return {
        type: "backup",
        title: "No match",
        message: "Please rephrase or browse guides.",
        nextStep: "Use Browse Guides button."
      };
    }
    if (match.type === "step") {
      const guide = match.data.guide;
      const stepsHtml = guide.steps.map((step, i) => `
        <div style="margin-bottom:12px; padding:10px; background:rgba(255,255,255,0.05); border-radius:14px;">
          <strong style="color:var(--fx-ai-orange);">${i+1}. ${escapeHtml(step.title)}</strong>
          <div style="font-size:0.75rem; margin-top:4px;">${escapeHtml(step.content).replace(/\n/g,'<br>')}</div>
        </div>
      `).join("");
      return {
        type: "steps",
        title: guide.title,
        message: `Steps for ${guide.title}:`,
        stepsHtml,
        guideTitle: guide.title,
        guideUrl: resolveGuideUrl(guide.url || `${guide.id}.html`)
      };
    }
    if (match.type === "node") {
      const node = match.data.node;
      if (node.action) {
        return {
          type: "recommendation",
          title: "Recommended Action",
          action: node.action,
          reason: node.text,
          nextStep: "Open guide to confirm.",
          guideTitle: match.data.guide.title,
          guideUrl: resolveGuideUrl(match.data.guide.url || `${match.data.guide.id}.html`)
        };
      }
      if (node.choices && node.choices.length) {
        return {
          type: "question",
          title: "Need more info",
          message: node.text,
          choices: node.choices.map(c => c.label)
        };
      }
    }
    return {
      type: "backup",
      title: "No action",
      message: "Please open the guide manually.",
      guideTitle: match.data.guide.title,
      guideUrl: resolveGuideUrl(match.data.guide.url || `${match.data.guide.id}.html`)
    };
  }

  // ----- Rendering -----
  function renderMatchedGuide(title, url, nodeId) {
    if (!title || !url) return "";
    return `<details class="fx-ai-source-details" style="margin-top:12px;"><summary>Matched guide</summary><div class="fx-ai-source-card"><strong>${escapeHtml(title)}</strong><div class="fx-ai-guide-actions"><a class="fx-ai-link primary" href="${url}">Open Guide</a></div></div></details>`;
  }

  function renderResult(res) {
    if (!res) return "<div>No result.</div>";
    if (res.type === "steps") {
      return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">${escapeHtml(res.title)}</div><h4>${escapeHtml(res.message)}</h4>${res.stepsHtml}${renderMatchedGuide(res.guideTitle, res.guideUrl)}</div>`;
    }
    if (res.type === "recommendation") {
      return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">${escapeHtml(res.title)}</div><h4>${escapeHtml(res.action)}</h4>${res.reason ? `<div class="fx-ai-answer-row"><span>Why</span><p>${escapeHtml(res.reason)}</p></div>` : ""}${res.nextStep ? `<div class="fx-ai-answer-row"><span>Next</span><p>${escapeHtml(res.nextStep)}</p></div>` : ""}${renderMatchedGuide(res.guideTitle, res.guideUrl)}</div>`;
    }
    if (res.type === "question") {
      return `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">${escapeHtml(res.title)}</div><h4>${escapeHtml(res.message)}</h4></div>`;
    }
    return `<div class="fx-ai-decision-card fx-ai-backup-card"><div class="fx-ai-decision-kicker">${escapeHtml(res.title||"Backup")}</div><h4>${escapeHtml(res.message)}</h4>${res.nextStep ? `<p>${escapeHtml(res.nextStep)}</p>` : ""}${renderMatchedGuide(res.guideTitle, res.guideUrl)}</div>`;
  }

  // ----- Conversation flow -----
  async function runDecisionTurn() {
    if (!activeSession) return;
    clearSuggestions();
    const thinking = addThinkingMessage();
    const result = await getDecision(activeSession.originalConcern);
    await new Promise(r => setTimeout(r, 180));
    removeThinkingMessage(thinking);
    addMessage("assistant", renderResult(result), true);
    bindDynamicActions();
    if (result.type === "question") {
      setFollowupSuggestions(result);
    } else if (result.type === "backup") {
      setSuggestions([
        { label: "Add details", onClick: askForDetails },
        { label: "Browse guides", onClick: browseGuides },
        { label: "Start over", onClick: clearChat }
      ]);
    } else {
      activeSession = null;
      setDoneSuggestions();
    }
  }

  async function startNewConcern(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    activeSession = { originalConcern: trimmed, conversation: [] };
    addMessage("user", trimmed);
    await runDecisionTurn();
  }

  async function continueConversation(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    if (!activeSession) {
      await startNewConcern(trimmed);
      return;
    }
    addMessage("user", trimmed);
    activeSession.conversation.push({ role: "user", content: trimmed });
    activeSession.originalConcern = trimmed;
    await runDecisionTurn();
  }

  async function sendInput() {
    const els = getEls();
    const text = els.input?.value.trim();
    if (!text) return;
    els.input.value = "";
    autoresizeInput();
    if (activeSession) await continueConversation(text);
    else await startNewConcern(text);
  }

  function askForDetails() {
    addMessage("assistant", "Type the missing detail in your own words.");
    clearSuggestions();
    setTimeout(() => getEls().input?.focus(), 60);
  }

  function setFollowupSuggestions(result) {
    const items = (result.choices || []).map(label => ({
      label,
      onClick: () => continueConversation(label)
    }));
    items.push(
      { label: "None of these", onClick: () => continueConversation("None of these") },
      { label: "Add details", onClick: askForDetails }
    );
    setSuggestions(items);
  }

  function setDoneSuggestions() {
    setSuggestions([
      { label: "Browse guides", onClick: browseGuides },
      { label: "Start over", onClick: clearChat }
    ]);
  }

  function browseGuides() {
    activeSession = null;
    addMessage("assistant", "Browse guides using the toolbar or library above.", false);
    clearSuggestions();
  }

  function clearChat() {
    const els = getEls();
    if (els.messages) els.messages.innerHTML = "";
    activeSession = null;
    clearSuggestions();
    showWelcome();
  }

  function showWelcome() {
    addMessage("assistant", "Hi, I'm your AI Decision Assistant. Type your question – I'll search guides or step‑by‑step instructions.");
    setSuggestions([
      { label: "Correction code for weight update", onClick: () => startNewConcern("What is the correction code for weight update?") },
      { label: "Change terms per BOL", onClick: () => startNewConcern("What is the correction code for changing terms per BOL?") },
      { label: "How to submit ePRT", onClick: () => startNewConcern("How to submit ePRT ticket?") }
    ]);
  }

  // ----- UI controls -----
  function openPanel() {
    const els = getEls();
    if (!els.panel) return;
    els.panel.classList.remove("hidden");
    state.isOpen = true;
    saveState();
    if (!preloadStarted) {
      preloadStarted = true;
      loadNodesJSON();
      loadStepsJSON();
    }
    setTimeout(() => els.input?.focus(), 60);
  }

  function closePanel() {
    const els = getEls();
    if (!els.panel) return;
    els.panel.classList.add("hidden");
    state.isOpen = false;
    saveState();
  }

  function autoresizeInput() {
    const els = getEls();
    if (!els.input) return;
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 96) + "px";
  }

  function bindDynamicActions() {
    document.querySelectorAll("[data-guide-open]").forEach(el => {
      if (!el.dataset.bound) {
        el.dataset.bound = "true";
        el.addEventListener("click", () => {
          const url = el.getAttribute("data-guide-open");
          if (url) window.location.href = url;
        });
      }
    });
  }

  function bindEvents() {
    const els = getEls();
    if (!els.launcher) return;
    els.launcher.addEventListener("click", openPanel);
    els.close?.addEventListener("click", closePanel);
    els.minimize?.addEventListener("click", closePanel);
    els.send?.addEventListener("click", sendInput);
    els.input?.addEventListener("input", autoresizeInput);
    els.input?.addEventListener("keydown", async e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        await sendInput();
      }
    });
    els.toolbarButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-ai-action");
        if (action === "find-guide") {
          activeSession = null;
          addMessage("assistant", "Type your concern.");
          clearSuggestions();
        }
        if (action === "show-guides") browseGuides();
        if (action === "clear-chat") clearChat();
      });
    });
  }

  function boot() {
    loadState();
    bindEvents();
    showWelcome();
    if (state.isOpen) openPanel();
  }

  function waitForMarkup() {
    let tries = 0;
    const timer = setInterval(() => {
      if ($("fx-ai-launcher") && $("fx-ai-panel")) {
        clearInterval(timer);
        boot();
      }
      if (++tries > 80) {
        clearInterval(timer);
        console.error("Assistant markup not found");
      }
    }, 80);
  }

  waitForMarkup();
})();
