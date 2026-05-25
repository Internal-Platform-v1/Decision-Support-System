// ============================================================
// AI Assistant – Interactive Decision Tree Navigator
// ============================================================

(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
  const state = { isOpen: false, lastMatchedGuideId: "" };
  let nodesData = null;
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

  function loadState() { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const s = JSON.parse(raw); state.isOpen = !!s.isOpen; state.lastMatchedGuideId = s.lastMatchedGuideId || ""; } } catch(e){} }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }
  function getBasePath() { return window.SITE_BASE || ""; }
  function resolveGuideUrl(url) { if (!url) return ""; if (/^https?:\/\//i.test(url)) return url; if (url.startsWith("/")) return url; return `${getBasePath()}${url}`; }
  function escapeHtml(str) { return String(str || "").replace(/[&<>]/g, function(m){if(m==="&") return "&amp;"; if(m==="<") return "&lt;"; if(m===">") return "&gt;"; return m;}); }
  function normalizeText(str) { return String(str || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim(); }

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
  function addThinkingMessage() { return addMessage("assistant", `<div class="fx-ai-thinking"><div><div class="fx-ai-thinking-text">Loading guide...</div><div class="fx-ai-thinking-dots"><span></span><span></span><span></span></div></div></div>`, true); }
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

  // Load JSON
  async function loadNodes() {
    if (nodesData) return nodesData;
    try {
      const url = `${getBasePath()}ai-assistant/nodes.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      nodesData = await res.json();
      console.log("Loaded full nodes.json");
      return nodesData;
    } catch (err) {
      console.error("Failed to load nodes.json", err);
      nodesData = { guides: [] };
      return nodesData;
    }
  }

  async function startDecisionTree(initialNodeId) {
    const data = await loadNodes();
    const guide = data.guides.find(g => g.id === "correction_code_guide");
    if (!guide) return null;
    const node = guide.nodes[initialNodeId];
    if (!node) return null;
    activeSession = {
      currentNodeId: initialNodeId,
      guide: guide,
      history: []
    };
    return node;
  }

  async function processAnswer(choiceLabel) {
    if (!activeSession) return null;
    const currentNode = activeSession.guide.nodes[activeSession.currentNodeId];
    if (!currentNode) return null;
    const choice = currentNode.choices.find(c => normalizeText(c.label) === normalizeText(choiceLabel));
    if (!choice) return null;
    activeSession.history.push({ nodeId: activeSession.currentNodeId, choice: choiceLabel });
    if (choice.action) {
      return { final: true, action: choice.action, nodeText: currentNode.text };
    }
    if (choice.next) {
      const nextNode = activeSession.guide.nodes[choice.next];
      if (!nextNode) return { final: false, error: "Next node not found" };
      activeSession.currentNodeId = choice.next;
      return { final: false, nextNode: nextNode };
    }
    return { final: false, error: "Invalid choice" };
  }

  function renderQuestion(node) {
    let html = `<div class="fx-ai-decision-card"><div class="fx-ai-decision-kicker">Question</div><h4>${escapeHtml(node.text)}</h4>`;
    if (node.help) html += `<p style="font-size:0.7rem; color:var(--fx-ai-text-soft);">${escapeHtml(node.help)}</p>`;
    html += `</div>`;
    return html;
  }

  function renderFinalAction(action, nodeText) {
    return `
      <div class="fx-ai-decision-card">
        <div class="fx-ai-decision-kicker">Correction Code</div>
        <h4>${escapeHtml(action)}</h4>
        <div class="fx-ai-answer-row"><span>Based on</span><p>${escapeHtml(nodeText)}</p></div>
        <div class="fx-ai-answer-row"><span>Next Step</span><p>Apply this code and confirm with the guide.</p></div>
      </div>
    `;
  }

  async function onUserChoice(choiceLabel) {
    const result = await processAnswer(choiceLabel);
    if (result.final) {
      addMessage("assistant", renderFinalAction(result.action, result.nodeText), true);
      activeSession = null;
      setDoneSuggestions();
    } else if (result.nextNode) {
      addMessage("assistant", renderQuestion(result.nextNode), true);
      const choices = result.nextNode.choices.map(c => ({
        label: c.label,
        onClick: () => onUserChoice(c.label)
      }));
      setSuggestions(choices);
    } else if (result.error) {
      addMessage("assistant", `Error: ${result.error}. Please start over.`, false);
      activeSession = null;
      setDoneSuggestions();
    }
  }

  async function handleCorrectionQuery() {
    const firstNode = await startDecisionTree("correction_type");
    if (!firstNode) {
      addMessage("assistant", "Sorry, I couldn't load the correction code guide.", false);
      return;
    }
    addMessage("assistant", renderQuestion(firstNode), true);
    const choices = firstNode.choices.map(c => ({
      label: c.label,
      onClick: () => onUserChoice(c.label)
    }));
    setSuggestions(choices);
  }

  async function processUserMessage(text) {
    const isCorr = /\b(corr|correction)\s*code\b/i.test(text) || text.includes("correction code");
    if (isCorr) {
      await handleCorrectionQuery();
    } else {
      addMessage("assistant", "I can help you find the correct correction code. Just ask for a correction code, e.g., 'What is the correction code for changing terms?'", false);
      setDoneSuggestions();
    }
  }

  async function sendInput() {
    const els = getEls();
    const text = els.input?.value.trim();
    if (!text) return;
    els.input.value = "";
    autoresizeInput();
    addMessage("user", text);
    const thinking = addThinkingMessage();
    await processUserMessage(text);
    removeThinkingMessage(thinking);
  }

  function setDoneSuggestions() {
    setSuggestions([
      { label: "Ask for another code", onClick: () => { clearChat(); handleCorrectionQuery(); } },
      { label: "Browse guides", onClick: browseGuides }
    ]);
  }

  function browseGuides() {
    activeSession = null;
    addMessage("assistant", "You can open the Correction Code Guide from the library above.", false);
    clearSuggestions();
    setDoneSuggestions();
  }

  function clearChat() {
    const els = getEls();
    if (els.messages) els.messages.innerHTML = "";
    activeSession = null;
    clearSuggestions();
  }

  function showWelcome() {
    addMessage("assistant", "Hi, I'm your AI Decision Assistant. I will walk you through the Correction Code Guide to find the right code.\n\nJust ask: 'What is the correction code for changing terms?' or 'I need a correction code.'", false);
    setSuggestions([
      { label: "Start correction code guide", onClick: () => { clearChat(); handleCorrectionQuery(); } }
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
        if (action === "find-guide") { clearChat(); handleCorrectionQuery(); }
        if (action === "show-guides") browseGuides();
        if (action === "clear-chat") { clearChat(); showWelcome(); }
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
      if (tries > 80) { clearInterval(timer); console.error("Assistant markup not found."); }
    }, 80);
  }
  waitForMarkup();
})();
