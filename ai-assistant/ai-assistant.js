// ============================================================
// AI Assistant – Complete version with node + step support
// FIXED: removed duplicate activeSession declaration
// ============================================================

(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
  const FX_AI_BACKEND_URL = "https://fx-ai-groq-server.onrender.com";

  const state = { isOpen: false, lastMatchedGuideId: "" };
  let guideNodesData = null;
  let guideStepsData = null;
  let activeSession = null;          // ✅ declared once at the top
  let preloadStarted = false;

  // ----- DOM helpers -----
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
    } catch (err) {
      console.error("AI state load failed:", err);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("AI state save failed:", err);
    }
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
      .replace(/[_/|()[\]{}.,:;'"`~!@#$%^&*+=?<>\\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(value, max = 190) {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, max - 1).trim() + "…";
  }

  function asksForCorrCode(text) {
    return /\b(corr|correction)\s*code\b/i.test(text) || /\bcorr\b/i.test(text);
  }

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
      bubble.classList.add("fx-ai-html-bubble");
      bubble.style.whiteSpace = "normal";
      bubble.style.padding = "10px";
      bubble.innerHTML = String(content || "")
        .replace(/>\s+</g, "><")
        .replace(/\n\s+/g, " ")
        .trim();
    } else {
      bubble.textContent = content;
    }
    row.appendChild(bubble);
    els.messages.appendChild(row);
    requestAnimationFrame(() => {
      els.messages.scrollTop = els.messages.scrollHeight;
    });
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

  // ----- Load JSON data with better error logging -----
  async function loadNodesJSON() {
    if (guideNodesData) return guideNodesData;
    try {
      const url = `${getBasePath()}ai-assistant/nodes.json`;
      console.log("Fetching nodes.json from:", url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      guideNodesData = await res.json();
      console.log("Loaded nodes.json with", guideNodesData.guides.length, "decision guides");
    } catch (e) {
      console.error("nodes.json not loaded:", e);
      guideNodesData = { guides: [] };
    }
    return guideNodesData;
  }

  async function loadStepsJSON() {
    if (guideStepsData) return guideStepsData;
    try {
      const url = `${getBasePath()}ai-assistant/steps.json`;
      console.log("Fetching steps.json from:", url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      guideStepsData = await res.json();
      console.log("Loaded steps.json with", guideStepsData.guides.length, "step guides");
    } catch (e) {
      console.error("steps.json not loaded:", e);
      guideStepsData = { guides: [] };
    }
    return guideStepsData;
  }

  // ----- Step‑based scoring -----
  function buildStepSearchText(guide) {
    let text = `${guide.id} ${guide.title} ${guide.category} ${(guide.keywords || []).join(" ")}`;
    guide.steps.forEach(step => {
      text += ` ${step.title} ${step.content}`;
    });
    return text.toLowerCase();
  }

  function scoreStepGuide(input, guide) {
    const normInput = normalizeText(input);
    const searchText = buildStepSearchText(guide);
    let score = searchText.includes(normInput) ? 15 : 0;
    const words = normInput.split(/\s+/).filter(w => w.length > 2);
    words.forEach(word => {
      if (searchText.includes(word)) score += 2;
    });
    return score;
  }

  async function findBestStepGuide(input) {
    const data = await loadStepsJSON();
    if (!data.guides.length) return null;
    const scored = data.guides.map(g => ({ guide: g, score: scoreStepGuide(input, g) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.score > 5 ? scored[0] : null;
  }

  // ----- Node‑based helpers (decision trees) -----
  async function getAllFlattenedNodes() {
    const data = await loadNodesJSON();
    if (!data.guides.length) return [];
    const flat = [];
    for (const guide of data.guides) {
      for (const [nodeId, node] of Object.entries(guide.nodes)) {
        const searchParts = [
          guide.id, guide.title, guide.category, guide.description,
          ...(guide.keywords || []),
          nodeId, node.text, node.help, node.note
        ].filter(Boolean);
        if (node.choices) {
          node.choices.forEach(c => {
            searchParts.push(c.label, c.action, c.desc);
          });
        }
        flat.push({
          guide: { id: guide.id, title: guide.title, url: guide.url, category: guide.category, description: guide.description },
          nodeId,
          node,
          searchText: searchParts.join(" ").toLowerCase()
        });
      }
    }
    return flat;
  }

  function scoreNode(input, nodeObj) {
    const normInput = normalizeText(input);
    const searchText = nodeObj.searchText;
    if (!searchText) return 0;
    let score = searchText.includes(normInput) ? 10 : 0;
    const words = normInput.split(/\s+/).filter(w => w.length > 2);
    words.forEach(word => {
      if (searchText.includes(word)) score += 2;
    });
    return score;
  }

  async function findBestNode(input) {
    const allNodes = await getAllFlattenedNodes();
    if (!allNodes.length) return null;
    const scored = allNodes.map(n => ({ ...n, score: scoreNode(input, n) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  async function traverseToAction(startNodeId, guide) {
    let current = startNodeId;
    const visited = new Set();
    while (current && !visited.has(current)) {
      visited.add(current);
      const node = guide.nodes[current];
      if (!node) break;
      if (node.action) return { action: node.action, nodeId: current, text: node.text };
      if (node.choices && node.choices.length) {
        const choice = node.choices[0];
        if (choice.action) return { action: choice.action, nodeId: current, text: node.text };
        if (choice.next) {
          current = choice.next;
          continue;
        }
      }
      break;
    }
    return null;
  }

  // ----- Local correction code map (fallback) -----
  const CORRECTION_CODE_MAP = {
    "weight": "ACCR", "reweigh": "ACCR", "pallet count": "CUSI",
    "service level": "ECDL", "service type": "ECDL", "priority plus": "ECDL",
    "reference number": "EREF", "po number": "EREF", "debtor": "ACCR",
    "bill to": "ACCR", "3pl": "ACCR", "collector": "ACCR", "fpay": "FPAY",
    "loa": "LOA", "rebill": "LOA", "rvsl": "LOA", "void": "VOID", "write off": "WO"
  };

  function findLocalCorrAnswer(input) {
    if (!asksForCorrCode(input)) return null;
    const inputNorm = normalizeText(input);
    for (const [keyword, code] of Object.entries(CORRECTION_CODE_MAP)) {
      if (inputNorm.includes(keyword)) {
        return {
          type: "recommendation",
          title: "Recommended Correction Code",
          action: code,
          reason: `Based on keyword "${keyword}" in your request.`,
          nextStep: `Use correction code ${code}. Open the matched guide to confirm.`,
          guideTitle: "",
          nodeId: ""
        };
      }
    }
    return null;
  }

  // ----- Main decision logic -----
  async function getDecision(concern) {
    // 1. Local correction code
    const localAnswer = findLocalCorrAnswer(concern);
    if (localAnswer) return localAnswer;

    // 2. Step‑based guide
    const stepMatch = await findBestStepGuide(concern);
    if (stepMatch) {
      const stepsHtml = stepMatch.guide.steps.map((step, idx) => `
        <div class="fx-ai-step-item" style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 14px;">
          <strong style="display: block; color: var(--fx-ai-orange); margin-bottom: 4px;">${idx+1}. ${escapeHtml(step.title)}</strong>
          <span style="font-size: 0.75rem; color: var(--fx-ai-text); white-space: pre-line;">${escapeHtml(step.content)}</span>
        </div>
      `).join("");
      return {
        type: "steps",
        title: stepMatch.guide.title,
        message: `Here are the steps to ${stepMatch.guide.title.toLowerCase()}:`,
        stepsHtml,
        guideTitle: stepMatch.guide.title,
        guideId: stepMatch.guide.id,
        guideUrl: resolveGuideUrl(stepMatch.guide.url || `${stepMatch.guide.id}.html`)
      };
    }

    // 3. Node‑based decision tree
    const bestNode = await findBestNode(concern);
    if (!bestNode) {
      return {
        type: "backup",
        title: "No Match Found",
        message: "I couldn't find a relevant guide. Please rephrase your question or browse the guides.",
        nextStep: "Use the Browse Guides button to find the correct workflow."
      };
    }

    if (bestNode.node.action) {
      return {
        type: "recommendation",
        title: "Recommended Action",
        action: bestNode.node.action,
        reason: `Based on node "${bestNode.node.text}" in guide "${bestNode.guide.title}".`,
        nextStep: "Open the guide to confirm before proceeding.",
        guideTitle: bestNode.guide.title,
        nodeId: bestNode.nodeId,
        guideUrl: resolveGuideUrl(bestNode.guide.url || `${bestNode.guide.id}.html`)
      };
    }

    const traversal = await traverseToAction(bestNode.nodeId, bestNode.guide);
    if (traversal && traversal.action) {
      return {
        type: "recommendation",
        title: "Recommended Action",
        action: traversal.action,
        reason: `Following the path in "${bestNode.guide.title}".`,
        nextStep: "Open the guide to see the full decision tree.",
        guideTitle: bestNode.guide.title,
        nodeId: traversal.nodeId,
        guideUrl: resolveGuideUrl(bestNode.guide.url || `${bestNode.guide.id}.html`)
      };
    }

    if (bestNode.node.choices && bestNode.node.choices.length) {
      return {
        type: "question",
        title: "Need more info",
        message: bestNode.node.text,
        choices: bestNode.node.choices.map(c => c.label)
      };
    }

    return {
      type: "backup",
      title: "Backup Plan",
      message: "I found a matching node but no final action. Please open the guide for details.",
      nextStep: "Open the guide and follow the decision tree.",
      guideTitle: bestNode.guide.title,
      guideUrl: resolveGuideUrl(bestNode.guide.url || `${bestNode.guide.id}.html`)
    };
  }

  // ----- Rendering -----
  function renderMatchedGuide(guideTitle, guideUrl, nodeId = null) {
    if (!guideTitle || !guideUrl) return "";
    const directUrl = nodeId ? `${guideUrl}?node=${encodeURIComponent(nodeId)}` : guideUrl;
    return `
      <details class="fx-ai-source-details" style="margin-top: 12px;">
        <summary>View matched guide</summary>
        <div class="fx-ai-source-card">
          <div class="fx-ai-source-head">
            <span>Matched Guide</span>
            <strong>${escapeHtml(guideTitle)}</strong>
          </div>
          <div class="fx-ai-guide-actions">
            <a class="fx-ai-link primary" href="${guideUrl}">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>Open Guide</span>
            </a>
            ${nodeId ? `<a class="fx-ai-link secondary" href="${directUrl}"><i class="fa-solid fa-location-dot"></i><span>Open Step</span></a>` : ""}
          </div>
        </div>
      </details>
    `;
  }

  function renderResult(result) {
    if (!result) return "<div>No result.</div>";
    if (result.type === "steps") {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title)}</div>
          <h4>${escapeHtml(result.message)}</h4>
          <div style="margin-top: 12px;">${result.stepsHtml}</div>
          ${renderMatchedGuide(result.guideTitle, result.guideUrl)}
        </div>
      `;
    }
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
    if (result.type === "question") {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Question")}</div>
          <h4>${escapeHtml(result.message)}</h4>
        </div>
      `;
    }
    return `
      <div class="fx-ai-decision-card fx-ai-backup-card">
        <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Backup")}</div>
        <h4>${escapeHtml(result.message)}</h4>
        ${result.nextStep ? `<p>${escapeHtml(result.nextStep)}</p>` : ""}
        ${result.guideTitle ? renderMatchedGuide(result.guideTitle, result.guideUrl) : ""}
      </div>
    `;
  }

  // ----- Conversation flow (activeSession used, not redeclared) -----
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
        { label: "Add details", className: "fx-ai-suggestion-btn", onClick: askForDetails },
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
    addMessage("assistant", "Type the missing detail in your own words. Include what the customer is asking, what the BOL/LOA/system shows, or what was already checked.");
    clearSuggestions();
    setTimeout(() => getEls().input?.focus(), 60);
  }

  function setFollowupSuggestions(result) {
    const choices = result.choices || [];
    const items = choices.map(label => ({
      label,
      onClick: () => continueConversation(label)
    }));
    items.push({ label: "None of these fit", onClick: () => continueConversation("None of these fit") });
    items.push({ label: "Add details", onClick: askForDetails });
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
    addMessage("assistant", "Browse the guides in the library above, or use the toolbar to search.", false);
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
    addMessage("assistant", `Hi, I’m your AI Decision Assistant.

Type the customer’s concern. I’ll search the decision trees or step‑by‑step guides and give you the recommended action or steps.`);

    setSuggestions([
      { label: "Correction code for weight update", onClick: () => startNewConcern("What is the correction code for weight update?") },
      { label: "How to submit ePRT", onClick: () => startNewConcern("How do I submit an ePRT ticket?") },
      { label: "Reference number edit", onClick: () => startNewConcern("What correction code for reference number edit?") }
    ]);
  }

  // ----- UI controls -----
  function openPanel() {
    const els = getEls();
    if (!els.panel) return;
    els.panel.classList.remove("hidden");
    els.panel.setAttribute("aria-hidden", "false");
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
    els.panel.setAttribute("aria-hidden", "true");
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
    document.querySelectorAll("[data-guide-open]").forEach(item => {
      if (item.dataset.bound === "true") return;
      item.dataset.bound = "true";
      item.addEventListener("click", () => {
        const url = item.getAttribute("data-guide-open");
        if (url) window.location.href = url;
      });
    });
  }

  function bindEvents() {
    const els = getEls();
    if (!els.launcher || !els.panel) return;
    els.launcher.addEventListener("click", openPanel);
    els.close?.addEventListener("click", closePanel);
    els.minimize?.addEventListener("click", closePanel);
    els.send?.addEventListener("click", sendInput);
    els.input?.addEventListener("input", autoresizeInput);
    els.input?.addEventListener("keydown", async event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await sendInput();
      }
    });
    els.toolbarButtons.forEach(button => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-ai-action");
        if (action === "find-guide") {
          activeSession = null;
          addMessage("assistant", "Type the concern and I’ll search the guides.");
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
      tries += 1;
      if (tries > 80) {
        clearInterval(timer);
        console.error("AI assistant markup was not found.");
      }
    }, 80);
  }

  waitForMarkup();
})();
