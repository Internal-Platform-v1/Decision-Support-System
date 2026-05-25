// ============================================================
// AI Assistant – Pure backend AI (no local decision tree)
// Sends all messages to Render Groq endpoint
// ============================================================

(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
  const FX_AI_BACKEND_URL = "https://fx-ai-groq-server.onrender.com";
  const state = { isOpen: false, lastMatchedGuideId: "" };
  let nodesData = null;
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
      if (raw) { const s = JSON.parse(raw); state.isOpen = !!s.isOpen; }
    } catch(e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
  }
  function getBasePath() { return window.SITE_BASE || ""; }
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>]/g, function(m){
      if(m==="&") return "&amp;";
      if(m==="<") return "&lt;";
      if(m===">") return "&gt;";
      return m;
    });
  }

  // UI functions
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
    return addMessage("assistant", `<div class="fx-ai-thinking"><div><div class="fx-ai-thinking-text">AI is thinking...</div><div class="fx-ai-thinking-dots"><span></span><span></span><span></span></div></div></div>`, true);
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

  // Load nodes.json to send to backend
  async function loadNodes() {
    if (nodesData) return nodesData;
    try {
      const url = `${getBasePath()}ai-assistant/nodes.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      nodesData = await res.json();
      return nodesData;
    } catch (err) {
      console.error("Failed to load nodes.json", err);
      nodesData = { guides: [] };
      return nodesData;
    }
  }

  // Store conversation history (simple array)
  let conversationHistory = [];

  async function sendToAI(userMessage) {
    const data = await loadNodes();
    const guide = data.guides.find(g => g.id === "correction_code_guide");
    if (!guide) return { type: "error", message: "Guide not loaded." };

    conversationHistory.push({ role: "user", content: userMessage });

    try {
      const response = await fetch(`${FX_AI_BACKEND_URL}/api/ai-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concern: userMessage,
          guides: [{ guide: { id: guide.id, title: guide.title, url: guide.url }, nodes: guide.nodes }],
          conversation: conversationHistory
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "Invalid response");
      // Add assistant response to history
      conversationHistory.push({ role: "assistant", content: result.result.message || result.result.action });
      return result.result;
    } catch (err) {
      console.error("Backend error:", err);
      return { type: "error", message: "Could not reach AI service. Please try again later." };
    }
  }

  function renderAIResult(result) {
    if (result.type === "recommendation") {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Correction Code")}</div>
          <h4>${escapeHtml(result.action)}</h4>
          ${result.reason ? `<div class="fx-ai-answer-row"><span>Why</span><p>${escapeHtml(result.reason)}</p></div>` : ""}
          ${result.nextStep ? `<div class="fx-ai-answer-row"><span>Next Step</span><p>${escapeHtml(result.nextStep)}</p></div>` : ""}
          ${result.guideTitle ? `<details class="fx-ai-source-details"><summary>View guide</summary><div class="fx-ai-source-card"><strong>${escapeHtml(result.guideTitle)}</strong><div class="fx-ai-guide-actions"><a class="fx-ai-link primary" href="${result.guideUrl || "#"}">Open Guide</a></div></div></details>` : ""}
        </div>
      `;
    }
    if (result.type === "question") {
      let choicesHtml = "";
      if (result.choices && result.choices.length) {
        choicesHtml = `<div class="fx-ai-suggestions" style="margin-top: 8px;">${result.choices.map(c => `<button class="fx-ai-suggestion-btn" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}</div>`;
      }
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">Question</div>
          <h4>${escapeHtml(result.message)}</h4>
          ${choicesHtml}
        </div>
      `;
    }
    return `
      <div class="fx-ai-decision-card fx-ai-backup-card">
        <div class="fx-ai-decision-kicker">Info</div>
        <h4>${escapeHtml(result.message)}</h4>
      </div>
    `;
  }

  async function handleUserInput(text) {
    const thinking = addThinkingMessage();
    const aiResult = await sendToAI(text);
    removeThinkingMessage(thinking);
    const messageHtml = renderAIResult(aiResult);
    addMessage("assistant", messageHtml, true);

    // Attach event listeners to any choice buttons
    if (aiResult.type === "question" && aiResult.choices) {
      setTimeout(() => {
        document.querySelectorAll("[data-choice]").forEach(btn => {
          btn.removeEventListener("click", choiceHandler);
          btn.addEventListener("click", choiceHandler);
        });
      }, 50);
    } else {
      // After answer, offer to ask another question
      setSuggestions([
        { label: "Ask another question", onClick: () => clearChatAndShowWelcome() }
      ]);
    }
  }

  function choiceHandler(e) {
    const choice = e.currentTarget.getAttribute("data-choice");
    if (choice) handleUserInput(choice);
  }

  async function sendInput() {
    const els = getEls();
    const text = els.input?.value.trim();
    if (!text) return;
    els.input.value = "";
    autoresizeInput();
    addMessage("user", text);
    await handleUserInput(text);
  }

  function clearChatAndShowWelcome() {
    const els = getEls();
    if (els.messages) els.messages.innerHTML = "";
    conversationHistory = [];
    clearSuggestions();
    addMessage("assistant", "Hi, I'm your AI Decision Assistant. I can help you navigate billing dispute guides, find correction codes, resolve pricing issues, and more.", false);
    setSuggestions([
      { label: "Weight update code", onClick: () => handleUserInput("What is the correction code for a weight update?") },
      { label: "Biller error, BOL clear", onClick: () => handleUserInput("The biller entered the wrong terms but the BOL was clear. What code?") }
    ]);
  }

  // UI controls
  function openPanel() {
    const els = getEls();
    if (!els.panel) return;
    els.panel.classList.remove("hidden");
    state.isOpen = true;
    saveState();
    if (!preloadStarted) {
      preloadStarted = true;
      loadNodes();
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
        if (action === "find-guide") clearChatAndShowWelcome();
        if (action === "clear-chat") clearChatAndShowWelcome();
      });
    });
  }
  function boot() {
    loadState();
    bindEvents();
    clearChatAndShowWelcome();
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
      if (tries > 80) { clearInterval(timer); console.error("Assistant markup not found."); }
    }, 80);
  }
  waitForMarkup();
})();
