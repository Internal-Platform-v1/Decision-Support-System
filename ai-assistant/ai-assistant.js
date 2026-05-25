// ============================================================
// AI Assistant – Calls backend Groq API, displays AI answer
// ============================================================

(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
  const FX_AI_BACKEND_URL = "https://fx-ai-groq-server.onrender.com";
  const state = { isOpen: false };
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
    };
  }

  function loadState() { try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); state.isOpen = !!s.isOpen; } catch(e){} }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function getBasePath() { return window.SITE_BASE || ""; }
  function escapeHtml(s) { return String(s||"").replace(/[&<>]/g, function(m){if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }

  // UI helpers
  function addMessage(role, content, allowHTML = false) {
    const els = getEls();
    if (!els.messages) return;
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
      bubble.innerHTML = content;
    } else {
      bubble.textContent = content;
    }
    row.appendChild(bubble);
    els.messages.appendChild(row);
    requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
  }

  function addThinking() {
    const id = "thinking-" + Date.now();
    addMessage("assistant", `<div id="${id}" class="fx-ai-thinking"><div><div class="fx-ai-thinking-text">AI is thinking...</div><div class="fx-ai-thinking-dots"><span></span><span></span><span></span></div></div></div>`, true);
    return id;
  }

  function removeThinking(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function clearSuggestions() { const els = getEls(); if (els.suggestions) els.suggestions.innerHTML = ""; }
  function setSuggestions(items) {
    const els = getEls();
    if (!els.suggestions) return;
    els.suggestions.innerHTML = "";
    items.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "fx-ai-suggestion-btn";
      btn.textContent = item.label;
      btn.onclick = () => {
        addMessage("user", item.label);
        sendToBackend(item.label);
      };
      els.suggestions.appendChild(btn);
    });
  }

  // Load nodes.json (to send to backend)
  async function loadNodes() {
    if (nodesData) return nodesData;
    try {
      const res = await fetch(`${getBasePath()}ai-assistant/nodes.json`);
      if (!res.ok) throw new Error();
      nodesData = await res.json();
      return nodesData;
    } catch(e) {
      console.warn("Could not load nodes.json");
      return { guides: [] };
    }
  }

  // Call backend
  async function sendToBackend(question) {
    const thinkingId = addThinking();
    try {
      const nodes = await loadNodes();
      const response = await fetch(`${FX_AI_BACKEND_URL}/api/ai-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concern: question,
          guides: [{
            guide: { id: "correction_code_guide", title: "Correction Code Guide", url: "Correction Code Guide.html" },
            nodes: nodes.guides[0]?.nodes || {}
          }],
          conversation: []
        })
      });
      if (!response.ok) throw new Error("Backend error");
      const data = await response.json();
      if (!data.ok || !data.result) throw new Error("Invalid response");
      removeThinking(thinkingId);
      displayResult(data.result);
    } catch (err) {
      removeThinking(thinkingId);
      addMessage("assistant", "Sorry, I couldn't reach the AI service. Please try again later.", false);
      setSuggestions([{ label: "Try again", onClick: () => { clearChat(); } }]);
    }
  }

  function displayResult(result) {
    if (result.type === "recommendation") {
      const html = `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Correction Code")}</div>
          <h4>${escapeHtml(result.action)}</h4>
          ${result.reason ? `<div class="fx-ai-answer-row"><span>Why</span><p>${escapeHtml(result.reason)}</p></div>` : ""}
          ${result.nextStep ? `<div class="fx-ai-answer-row"><span>Next Step</span><p>${escapeHtml(result.nextStep)}</p></div>` : ""}
          <details class="fx-ai-source-details"><summary>Guide</summary><div class="fx-ai-source-card"><strong>Correction Code Guide</strong><div class="fx-ai-guide-actions"><a class="fx-ai-link primary" href="Correction Code Guide.html">Open Guide</a></div></div></details>
        </div>
      `;
      addMessage("assistant", html, true);
      setSuggestions([{ label: "Ask another question", onClick: () => { clearChat(); showWelcome(); } }]);
    } else if (result.type === "question") {
      addMessage("assistant", result.message, false);
      const choices = (result.choices || []).map(c => ({ label: c, onClick: () => sendToBackend(c) }));
      setSuggestions(choices);
    } else {
      addMessage("assistant", result.message || "I couldn't determine the answer. Please open the guide manually.", false);
      setSuggestions([{ label: "Open Guide", onClick: () => window.open("Correction Code Guide.html", "_blank") }]);
    }
  }

  function clearChat() {
    const els = getEls();
    if (els.messages) els.messages.innerHTML = "";
    clearSuggestions();
  }

  function showWelcome() {
    addMessage("assistant", "Hi, I'm your AI Decision Assistant. Ask me for a correction code in plain English.\n\nExample: 'What correction code should I use if the biller entered the wrong terms but the BOL was clear?'", false);
    setSuggestions([
      { label: "Weight update correction code", onClick: () => sendToBackend("What is the correction code for a weight update?") },
      { label: "Biller error, BOL clear", onClick: () => sendToBackend("The biller entered wrong terms but the BOL was clear. What correction code?") },
    ]);
  }

  // Panel controls
  function openPanel() {
    const els = getEls();
    if (!els.panel) return;
    els.panel.classList.remove("hidden");
    state.isOpen = true;
    saveState();
    setTimeout(() => els.input?.focus(), 60);
  }
  function closePanel() { const els = getEls(); if (els.panel) { els.panel.classList.add("hidden"); state.isOpen = false; saveState(); } }
  function autoresizeInput() { const els = getEls(); if (!els.input) return; els.input.style.height = "auto"; els.input.style.height = Math.min(els.input.scrollHeight, 96) + "px"; }
  async function sendInput() {
    const els = getEls();
    const text = els.input?.value.trim();
    if (!text) return;
    els.input.value = "";
    autoresizeInput();
    addMessage("user", text);
    await sendToBackend(text);
  }

  function bindEvents() {
    const els = getEls();
    if (!els.launcher) return;
    els.launcher.onclick = openPanel;
    els.close?.addEventListener("click", closePanel);
    els.minimize?.addEventListener("click", closePanel);
    els.send?.addEventListener("click", sendInput);
    els.input?.addEventListener("input", autoresizeInput);
    els.input?.addEventListener("keydown", async e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); await sendInput(); } });
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
      if (++tries > 80) clearInterval(timer);
    }, 80);
  }
  waitForMarkup();
})();
