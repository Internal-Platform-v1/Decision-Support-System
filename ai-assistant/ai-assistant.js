console.log("[Assistant] Full assistant starting");
(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
  const state = { isOpen: false, lastMatchedGuideId: "" };
  let activeSession = null;
  let nodesData = null;

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
      if (raw) {
        const saved = JSON.parse(raw);
        state.isOpen = !!saved.isOpen;
        state.lastMatchedGuideId = saved.lastMatchedGuideId || "";
      }
    } catch (err) {}
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(err) {}
  }

  function getBasePath() { return window.SITE_BASE || ""; }
  function resolveGuideUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return url;
    return `${getBasePath()}${url}`;
  }

  function escapeHtml(s) {
    return String(s||"").replace(/[&<>]/g, function(m) {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      return m;
    });
  }

  function normalizeText(v) {
    return String(v||"").toLowerCase().replace(/[_/|()[\]{}.,:;'"`~!@#$%^&*+=?<>\\-]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function asksForCorrCode(text) {
    return /\b(corr|correction)\s*code\b/i.test(text) || /\bcorr\b/i.test(text);
  }

  // UI functions (from original working assistant)
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
      bubble.classList.add("fx-ai-html-bubble");
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
    return addMessage("assistant", `
      <div class="fx-ai-thinking">
        <div>
          <div class="fx-ai-thinking-text">Searching guides...</div>
          <div class="fx-ai-thinking-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    `, true);
  }

  function removeThinkingMessage(row) {
    if (row && row.parentNode) row.parentNode.removeChild(row);
  }

  function clearSuggestions() {
    const els = getEls();
    if (els.suggestions) els.suggestions.innerHTML = "";
  }

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

  // Load nodes.json
  async function loadNodes() {
    if (nodesData) return nodesData;
    try {
      const url = `${getBasePath()}ai-assistant/nodes.json`;
      console.log("Fetching nodes.json from", url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      nodesData = await res.json();
      console.log("nodes.json loaded", nodesData.guides?.length || 0);
      return nodesData;
    } catch (err) {
      console.error("Failed to load nodes.json", err);
      nodesData = { guides: [] };
      return nodesData;
    }
  }

  // Flatten nodes for searching
  async function getAllNodes() {
    const data = await loadNodes();
    const flat = [];
    for (const guide of (data.guides || [])) {
      for (const [nodeId, node] of Object.entries(guide.nodes || {})) {
        let searchText = `${guide.title} ${node.text} ${node.help||''} ${node.note||''} ${node.action||''}`;
        if (node.choices) {
          node.choices.forEach(c => {
            searchText += ` ${c.label} ${c.action||''} ${c.desc||''}`;
          });
        }
        flat.push({
          guide: { id: guide.id, title: guide.title, url: guide.url },
          nodeId,
          node,
          searchText: searchText.toLowerCase()
        });
      }
    }
    return flat;
  }

  async function findBestMatch(question) {
    const nodes = await getAllNodes();
    if (!nodes.length) return null;
    const norm = normalizeText(question);
    let best = null, bestScore = 0;
    for (const n of nodes) {
      let score = n.searchText.includes(norm) ? 20 : 0;
      const words = norm.split(/\s+/).filter(w => w.length > 2);
      words.forEach(w => { if (n.searchText.includes(w)) score += 3; });
      if (score > bestScore) { bestScore = score; best = n; }
    }
    return bestScore > 5 ? best : null;
  }

  // Local fallback codes
  const localCodes = {
    "weight": "ACCR", "reweigh": "ACCR", "service level": "ECDL",
    "reference number": "EREF", "debtor": "ACCR", "loa": "LOA",
    "change terms": "CUSI or ETMS", "prepaid": "CUSI or ETMS"
  };
  function getLocalCode(question) {
    const q = normalizeText(question);
    for (const [kw, code] of Object.entries(localCodes)) {
      if (q.includes(kw)) return code;
    }
    return null;
  }

  async function getAnswer(question) {
    const local = getLocalCode(question);
    if (local) {
      return {
        type: "recommendation",
        title: "Correction Code",
        action: local,
        reason: "Matched keyword in your question.",
        nextStep: "Confirm with the Correction Code Guide.",
        guideTitle: "Correction Code Guide",
        guideUrl: resolveGuideUrl("Correction Code Guide.html")
      };
    }
    const match = await findBestMatch(question);
    if (match && match.node.action) {
      return {
        type: "recommendation",
        title: "Correction Code",
        action: match.node.action,
        reason: match.node.text,
        nextStep: "Open the Correction Code Guide to verify.",
        guideTitle: match.guide.title,
        guideUrl: resolveGuideUrl(match.guide.url || `${match.guide.id}.html`),
        nodeId: match.nodeId
      };
    }
    return {
      type: "backup",
      title: "Not Found",
      message: "I couldn't find a matching correction code. Please open the Correction Code Guide and follow the decision tree.",
      guideTitle: "Correction Code Guide",
      guideUrl: resolveGuideUrl("Correction Code Guide.html")
    };
  }

  function renderMatchedGuide(title, url, nodeId) {
    if (!title || !url) return "";
    const nodeUrl = nodeId ? `${url}?node=${encodeURIComponent(nodeId)}` : url;
    return `
      <details class="fx-ai-source-details" style="margin-top:12px;">
        <summary>View matched guide</summary>
        <div class="fx-ai-source-card">
          <strong>${escapeHtml(title)}</strong>
          <div class="fx-ai-guide-actions">
            <a class="fx-ai-link primary" href="${url}">Open Guide</a>
            ${nodeId ? `<a class="fx-ai-link secondary" href="${nodeUrl}">Open Step</a>` : ""}
          </div>
        </div>
      </details>
    `;
  }

  function renderResult(result) {
    if (!result) return "<div>No result.</div>";
    if (result.type === "recommendation") {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title)}</div>
          <h4>${escapeHtml(result.action)}</h4>
          ${result.reason ? `<div class="fx-ai-answer-row"><span>Why</span><p>${escapeHtml(result.reason)}</p></div>` : ""}
          ${result.nextStep ? `<div class="fx-ai-answer-row"><span>Next Step</span><p>${escapeHtml(result.nextStep)}</p></div>` : ""}
          ${renderMatchedGuide(result.guideTitle, result.guideUrl, result.nodeId)}
        </div>
      `;
    }
    return `
      <div class="fx-ai-decision-card fx-ai-backup-card">
        <div class="fx-ai-decision-kicker">${escapeHtml(result.title)}</div>
        <h4>${escapeHtml(result.message)}</h4>
        ${renderMatchedGuide(result.guideTitle, result.guideUrl)}
      </div>
    `;
  }

  // Conversation flow
  async function runTurn() {
    if (!activeSession) return;
    clearSuggestions();
    const thinking = addThinkingMessage();
    const answer = await getAnswer(activeSession.question);
    await new Promise(r => setTimeout(r, 180));
    removeThinkingMessage(thinking);
    addMessage("assistant", renderResult(answer), true);
    bindDynamicActions();
    activeSession = null;
    setDoneSuggestions();
  }

  async function startNewConcern(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    activeSession = { question: trimmed };
    addMessage("user", trimmed);
    await runTurn();
  }

  async function sendInput() {
    const els = getEls();
    const text = els.input?.value.trim();
    if (!text) return;
    els.input.value = "";
    autoresizeInput();
    await startNewConcern(text);
  }

  function setDoneSuggestions() {
    setSuggestions([
      { label: "Browse guides", onClick: browseGuides },
      { label: "Start over", onClick: clearChat }
    ]);
  }

  function browseGuides() {
    activeSession = null;
    addMessage("assistant", "Browse guides from the library above.", false);
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
    addMessage("assistant", "Hi, I'm your AI Decision Assistant. Ask for a correction code.\n\nExample: 'What is the correction code for weight update?'");
    setSuggestions([
      { label: "Weight update code", onClick: () => startNewConcern("What is the correction code for weight update?") },
      { label: "Change terms to prepaid", onClick: () => startNewConcern("What is the corr code for change terms to prepaid?") },
      { label: "Reference number edit", onClick: () => startNewConcern("What correction code for reference number edit?") }
    ]);
  }

  // UI controls
  function openPanel() {
    const els = getEls();
    if (!els.panel) return;
    els.panel.classList.remove("hidden");
    state.isOpen = true;
    saveState();
    // Preload nodes
    loadNodes();
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
      if (el.dataset.bound) return;
      el.dataset.bound = "true";
      el.addEventListener("click", () => {
        const url = el.getAttribute("data-guide-open");
        if (url) window.location.href = url;
      });
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
      tries++;
      if (tries > 80) {
        clearInterval(timer);
        console.error("AI assistant markup not found.");
      }
    }, 80);
  }

  waitForMarkup();
})();
