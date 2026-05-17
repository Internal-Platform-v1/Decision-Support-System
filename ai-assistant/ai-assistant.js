(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v5";

  /*
    IMPORTANT:
    Replace this URL if your Render service URL is different.
    Do NOT add /health or /api/ai-decision here.
  */
  const FX_AI_BACKEND_URL = "https://fx-ai-groq-server.onrender.com";

  const state = {
    lastConcern: "",
    lastMatchedGuideId: "",
    isOpen: false
  };

  const nodeCache = new Map();
  let preloadStarted = false;
  let activeSession = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      state.lastConcern = parsed.lastConcern || "";
      state.lastMatchedGuideId = parsed.lastMatchedGuideId || "";
      state.isOpen = !!parsed.isOpen;
    } catch (err) {
      console.error("Failed to load AI assistant state:", err);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lastConcern: state.lastConcern,
        lastMatchedGuideId: state.lastMatchedGuideId,
        isOpen: state.isOpen
      }));
    } catch (err) {
      console.error("Failed to save AI assistant state:", err);
    }
  }

  function getEls() {
    return {
      root: document.getElementById("fx-ai-root"),
      launcher: document.getElementById("fx-ai-launcher"),
      panel: document.getElementById("fx-ai-panel"),
      close: document.getElementById("fx-ai-close"),
      minimize: document.getElementById("fx-ai-minimize"),
      messages: document.getElementById("fx-ai-messages"),
      suggestions: document.getElementById("fx-ai-suggestions"),
      input: document.getElementById("fx-ai-input"),
      send: document.getElementById("fx-ai-send"),
      toolbarButtons: document.querySelectorAll("[data-ai-action]")
    };
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[_/|()[\]{}.,:;'"`~!@#$%^&*+=?<>\\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(text, maxLength = 180) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength) return clean;
    return clean.slice(0, maxLength - 1).trim() + "…";
  }

  function getRegistry() {
    return Array.isArray(window.GUIDE_REGISTRY) ? window.GUIDE_REGISTRY : [];
  }

  function getBasePath() {
    return window.SITE_BASE || "";
  }

  function resolveGuideUrl(url) {
    const base = getBasePath();
    if (!url) return "";

    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return url;

    return `${base}${url}`;
  }

  function scoreText(input, value, points) {
    const normalizedInput = normalizeText(input);
    const normalizedValue = normalizeText(value);

    if (!normalizedInput || !normalizedValue) return 0;

    let score = 0;

    if (normalizedInput.includes(normalizedValue)) score += points;

    if (normalizedValue.includes(normalizedInput) && normalizedInput.length >= 5) {
      score += Math.floor(points / 2);
    }

    const inputWords = new Set(normalizedInput.split(" ").filter(word => word.length >= 3));
    const valueWords = normalizedValue.split(" ").filter(word => word.length >= 3);

    valueWords.forEach((word) => {
      if (inputWords.has(word)) score += 1;
    });

    return score;
  }

  function scrollToBottom() {
    const els = getEls();

    requestAnimationFrame(() => {
      if (els.messages) {
        els.messages.scrollTop = els.messages.scrollHeight;
      }
    });
  }

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
      bubble.innerHTML = content;
    } else {
      bubble.textContent = content;
    }

    row.appendChild(bubble);
    els.messages.appendChild(row);
    scrollToBottom();

    return row;
  }

  function addThinkingMessage() {
    const thinkingHtml = `
      <div class="fx-ai-thinking">
        <div>
          <div class="fx-ai-thinking-text">Reading guide nodes and choosing the next step...</div>
          <div class="fx-ai-thinking-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;

    return addMessage("assistant", thinkingHtml, true);
  }

  function removeThinkingMessage(thinkingRow) {
    if (thinkingRow && thinkingRow.parentNode) {
      thinkingRow.parentNode.removeChild(thinkingRow);
    }
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function clearSuggestions() {
    const els = getEls();
    if (els.suggestions) els.suggestions.innerHTML = "";
  }

  function setSuggestions(items) {
    const els = getEls();
    if (!els.suggestions) return;

    els.suggestions.innerHTML = "";

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = item.className || "fx-ai-suggestion-btn";
      btn.textContent = item.label;
      btn.addEventListener("click", item.onClick);
      els.suggestions.appendChild(btn);
    });
  }

  /* ==========================================================
     NODE EXTRACTION
  ========================================================== */

  function findNodesObjectStart(html) {
    const patterns = [
      /const\s+NODES\s*=/g,
      /let\s+NODES\s*=/g,
      /var\s+NODES\s*=/g,
      /window\.NODES\s*=/g
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (!match) continue;

      const afterEquals = match.index + match[0].length;
      const braceIndex = html.indexOf("{", afterEquals);

      if (braceIndex !== -1) return braceIndex;
    }

    return -1;
  }

  function extractBalancedObject(html, startIndex) {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;
    let escaped = false;

    for (let i = startIndex; i < html.length; i++) {
      const char = html[i];
      const next = html[i + 1];

      if (inLineComment) {
        if (char === "\n") inLineComment = false;
        continue;
      }

      if (inBlockComment) {
        if (char === "*" && next === "/") {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        if (inSingle || inDouble || inTemplate) escaped = true;
        continue;
      }

      if (!inSingle && !inDouble && !inTemplate && char === "/" && next === "/") {
        inLineComment = true;
        i++;
        continue;
      }

      if (!inSingle && !inDouble && !inTemplate && char === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }

      if (!inDouble && !inTemplate && char === "'") {
        inSingle = !inSingle;
        continue;
      }

      if (!inSingle && !inTemplate && char === '"') {
        inDouble = !inDouble;
        continue;
      }

      if (!inSingle && !inDouble && char === "`") {
        inTemplate = !inTemplate;
        continue;
      }

      if (inSingle || inDouble || inTemplate) continue;

      if (char === "{") depth++;

      if (char === "}") {
        depth--;

        if (depth === 0) {
          return html.slice(startIndex, i + 1);
        }
      }
    }

    return "";
  }

  function extractNodesFromHtml(html) {
    const startIndex = findNodesObjectStart(html);
    if (startIndex === -1) return null;

    const objectText = extractBalancedObject(html, startIndex);
    if (!objectText) return null;

    try {
      return new Function(`return (${objectText});`)();
    } catch (error) {
      console.error("Failed to parse NODES object:", error);
      return null;
    }
  }

  function normalizeGuideNodes(guide, nodes) {
    const rawEntries = Object.entries(nodes || {});

    const normalizedNodes = rawEntries.map(([nodeId, node]) => {
      const choicesDetailed = Array.isArray(node.choices)
        ? node.choices.map(choice => ({
            label: choice.label || "",
            next: choice.next || "",
            desc: choice.desc || ""
          })).filter(choice => choice.label)
        : [];

      const choices = choicesDetailed.map(choice => choice.label);
      const choiceDescriptions = choicesDetailed.map(choice => choice.desc).filter(Boolean);
      const isFinal = !Array.isArray(node.choices) || node.choices.length === 0;

      return {
        nodeId,
        type: isFinal ? "final" : "question",
        text: node.text || "",
        help: node.help || "",
        note: node.note || "",
        choices,
        choicesDetailed,
        choiceDescriptions,
        finalRecommendation: isFinal ? node.text || "" : "",
        searchText: [
          guide.title || "",
          guide.category || "",
          guide.badge || "",
          guide.description || "",
          ...(guide.keywords || []),
          nodeId,
          node.text || "",
          node.help || "",
          node.note || "",
          ...choices,
          ...choiceDescriptions,
          ...choicesDetailed.map(choice => choice.next)
        ].join(" ")
      };
    });

    return {
      guide,
      nodes: normalizedNodes
    };
  }

  async function loadGuideNodes(guide) {
    if (!guide || !guide.id || !guide.url) return null;

    if (nodeCache.has(guide.id)) return nodeCache.get(guide.id);

    try {
      const response = await fetch(resolveGuideUrl(guide.url), { cache: "force-cache" });

      if (!response.ok) {
        throw new Error(`Failed to fetch guide page: ${guide.url}`);
      }

      const html = await response.text();
      const nodes = extractNodesFromHtml(html);

      if (!nodes) {
        console.warn(`No NODES object found for guide: ${guide.title}`);
        nodeCache.set(guide.id, null);
        return null;
      }

      const normalized = normalizeGuideNodes(guide, nodes);
      nodeCache.set(guide.id, normalized);
      return normalized;
    } catch (error) {
      console.error("Failed to load guide nodes:", guide.title, error);
      nodeCache.set(guide.id, null);
      return null;
    }
  }

  async function loadAllGuideNodes() {
    const registry = getRegistry();
    const loaded = await Promise.all(registry.map(guide => loadGuideNodes(guide)));
    return loaded.filter(Boolean);
  }

  function startNodePreload() {
    if (preloadStarted) return;
    preloadStarted = true;
    loadAllGuideNodes();
  }

  function scoreGuideNodeMap(input, guideData) {
    const guide = guideData.guide || {};
    const guideScore =
      scoreText(input, guide.title, 14) +
      scoreText(input, guide.category, 3) +
      scoreText(input, guide.badge, 2) +
      scoreText(input, guide.description, 5) +
      (guide.keywords || []).reduce((sum, keyword) => sum + scoreText(input, keyword, 8), 0);

    const nodeScore = (guideData.nodes || []).reduce((sum, node) => {
      return sum + scoreText(input, node.searchText, node.type === "final" ? 7 : 5);
    }, 0);

    return guideScore + nodeScore;
  }

  async function findRelevantGuideNodeMaps(input, limit = 3) {
    const allGuideData = await loadAllGuideNodes();

    return allGuideData
      .map(guideData => ({
        ...guideData,
        score: scoreGuideNodeMap(input, guideData)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /* ==========================================================
     BACKEND CALL - SEND FULL NODE MAPS
  ========================================================== */

  function buildGuidePayload(guideData) {
    return {
      score: guideData.score || 0,
      guide: {
        id: guideData.guide.id || "",
        title: guideData.guide.title || "",
        url: guideData.guide.url || "",
        category: guideData.guide.category || "",
        description: guideData.guide.description || ""
      },
      nodes: (guideData.nodes || []).slice(0, 120).map(node => ({
        nodeId: node.nodeId,
        type: node.type,
        text: node.text,
        help: node.help,
        note: node.note,
        choicesDetailed: node.choicesDetailed,
        choices: node.choices,
        finalRecommendation: node.finalRecommendation
      }))
    };
  }

  async function askDecisionAssistant(concern, guideMaps, conversation = []) {
    try {
      if (!FX_AI_BACKEND_URL) return null;

      const guides = Array.isArray(guideMaps)
        ? guideMaps.map(buildGuidePayload).slice(0, 3)
        : [];

      const response = await fetch(`${FX_AI_BACKEND_URL}/api/ai-decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          concern,
          guides,
          conversation
        })
      });

      if (!response.ok) throw new Error("AI backend request failed.");

      const data = await response.json();
      if (!data.ok || !data.result) throw new Error(data.error || "No AI result returned.");

      return data.result;
    } catch (error) {
      console.error("AI decision assistant failed:", error);
      return null;
    }
  }

  /* ==========================================================
     RENDERERS
  ========================================================== */

  function findGuideDataByTitle(guideMaps, title) {
    const target = normalizeText(title);
    if (!target) return guideMaps?.[0] || null;

    return (guideMaps || []).find(item => {
      return normalizeText(item.guide?.title).includes(target) || target.includes(normalizeText(item.guide?.title));
    }) || guideMaps?.[0] || null;
  }

  function findNodeInGuide(guideData, nodeId) {
    const target = normalizeText(nodeId);
    if (!target || !guideData) return null;

    return (guideData.nodes || []).find(node => normalizeText(node.nodeId) === target) || null;
  }

  function renderMatchedGuideDetails(guideData, result) {
    if (!guideData) return "";

    const guide = guideData.guide || {};
    const node = findNodeInGuide(guideData, result?.nodeId);
    const safeUrl = escapeHtml(resolveGuideUrl(guide.url || ""));
    const directUrl = node ? `${safeUrl}?node=${encodeURIComponent(node.nodeId || "")}` : safeUrl;
    const displayText = compactText(node?.finalRecommendation || node?.text || guide.description || "Open the matched guide to review.", 220);

    return `
      <details class="fx-ai-source-details">
        <summary>View matched guide</summary>

        <div class="fx-ai-source-card">
          <div class="fx-ai-source-head">
            <span>${node?.type === "final" ? "Official Final Match" : "Matched Guide"}</span>
            <strong>${escapeHtml(guide.title || "Recommended Guide")}</strong>
          </div>

          <p>${escapeHtml(displayText)}</p>

          <div class="fx-ai-guide-meta">
            <span class="fx-ai-tag">${escapeHtml(guide.category || "Guide")}</span>
            ${node?.nodeId ? `<span class="fx-ai-tag">${escapeHtml(node.nodeId)}</span>` : ""}
          </div>

          <div class="fx-ai-guide-actions">
            <a class="fx-ai-link primary" href="${safeUrl}">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>Open Guide</span>
            </a>

            ${node?.nodeId ? `
              <a class="fx-ai-link secondary" href="${directUrl}">
                <i class="fa-solid fa-location-dot"></i>
                <span>Open Step</span>
              </a>
            ` : ""}
          </div>
        </div>
      </details>
    `;
  }

  function renderDecisionResult(result, guideMaps) {
    const guideData = findGuideDataByTitle(guideMaps, result?.guideTitle);

    if (!result) {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">Need more detail</div>
          <h4>I reviewed the guide nodes, but I need one clearer detail before deciding.</h4>
          <p>Type the missing detail in your own words, or use the backup options below.</p>
        </div>
        ${renderMatchedGuideDetails(guideData, result)}
      `;
    }

    if (result.type === "question") {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Need one detail")}</div>
          <h4>${escapeHtml(result.message || "I need one more detail before deciding.")}</h4>
        </div>
        ${renderMatchedGuideDetails(guideData, result)}
      `;
    }

    if (result.type === "backup") {
      return `
        <div class="fx-ai-decision-card fx-ai-backup-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Backup Plan")}</div>
          <h4>${escapeHtml(result.message || "The listed options do not clearly fit this concern.")}</h4>
          ${result.nextStep ? `<p>${escapeHtml(result.nextStep)}</p>` : ""}
        </div>
        ${renderMatchedGuideDetails(guideData, result)}
      `;
    }

    return `
      <div class="fx-ai-decision-card">
        <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Recommended Action")}</div>
        <h4>${escapeHtml(result.action || "Review the matched guide.")}</h4>

        ${result.reason ? `
          <div class="fx-ai-answer-row">
            <span>Why</span>
            <p>${escapeHtml(result.reason)}</p>
          </div>
        ` : ""}

        ${result.nextStep ? `
          <div class="fx-ai-answer-row">
            <span>Next Step</span>
            <p>${escapeHtml(result.nextStep)}</p>
          </div>
        ` : ""}
      </div>

      ${renderMatchedGuideDetails(guideData, result)}
    `;
  }

  function renderGuideCard(guide) {
    const safeTitle = escapeHtml(guide.title);
    const safeDesc = escapeHtml(compactText(guide.description || "No guide description available.", 120));
    const safeCategory = escapeHtml(guide.category || "Guide");
    const safeUrl = escapeHtml(resolveGuideUrl(guide.url));

    return `
      <div class="fx-ai-source-card">
        <div class="fx-ai-source-head">
          <span>Matched Guide</span>
          <strong>${safeTitle}</strong>
        </div>
        <p>${safeDesc}</p>
        <div class="fx-ai-guide-meta">
          <span class="fx-ai-tag">${safeCategory}</span>
        </div>
        <div class="fx-ai-guide-actions">
          <a class="fx-ai-link primary" href="${safeUrl}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Open Guide</span>
          </a>
        </div>
      </div>
    `;
  }

  function renderGuideList(guides, title = "Available Guides") {
    if (!guides.length) {
      return `
        <div class="fx-ai-card">
          <div class="fx-ai-card-title">${escapeHtml(title)}</div>
          <div class="fx-ai-empty-list">
            <div class="fx-ai-guide-desc">No guides found.</div>
          </div>
        </div>
      `;
    }

    const items = guides.map((guide) => {
      return `
        <div class="fx-ai-list-item" data-guide-open="${escapeHtml(resolveGuideUrl(guide.url))}">
          <strong>${escapeHtml(guide.title)}</strong>
          <span>${escapeHtml(compactText(guide.description || "", 95))}</span>
        </div>
      `;
    }).join("");

    return `
      <div class="fx-ai-card">
        <div class="fx-ai-card-title">${escapeHtml(title)}</div>
        <div class="fx-ai-empty-list">
          ${items}
        </div>
      </div>
    `;
  }

  function showWelcome() {
    addMessage(
      "assistant",
      `Hi, I’m your AI Decision Assistant.

Type the customer’s concern. I’ll review the guide nodes, ask relevant questions, and give the recommended action.`
    );

    setSuggestions([
      {
        label: "Weight update per BOL",
        onClick: () => startNewConcern("Customer wants to apply the weight shown on the BOL.")
      },
      {
        label: "RVSL refusal",
        onClick: () => startNewConcern("Customer is refusing charges and wants reversal.")
      },
      {
        label: "Service level mismatch",
        onClick: () => startNewConcern("Customer says the service level should be Economy but FBC shows Priority.")
      }
    ]);
  }

  function showNoMatch() {
    addMessage(
      "assistant",
      `I couldn’t confidently match that yet.

Please add a few more details, like the dispute type, BOL note, LOA status, service level, or queue name.`
    );
  }

  async function runDecisionTurn() {
    if (!activeSession) return;

    clearSuggestions();
    const thinkingRow = addThinkingMessage();

    const allText = [
      activeSession.originalConcern,
      ...activeSession.conversation.map(item => item.content)
    ].join(" ");

    const guideMaps = await findRelevantGuideNodeMaps(allText, 3);
    activeSession.guideMaps = guideMaps;

    const result = await askDecisionAssistant(
      activeSession.originalConcern,
      guideMaps,
      activeSession.conversation
    );

    activeSession.lastResult = result;

    await wait(200);
    removeThinkingMessage(thinkingRow);

    if (!guideMaps.length && !result) {
      showNoMatch();
      setBackupSuggestions();
      return;
    }

    if (guideMaps?.[0]?.guide?.id) {
      state.lastMatchedGuideId = guideMaps[0].guide.id;
      saveState();
    }

    addMessage("assistant", renderDecisionResult(result, guideMaps), true);

    if (result?.type === "question") {
      setQuestionSuggestions(result);
      return;
    }

    if (result?.type === "backup") {
      setBackupSuggestions();
      return;
    }

    activeSession = null;

    setSuggestions([
      {
        label: "Open recent match",
        onClick: openRecentGuide
      },
      {
        label: "Browse guides",
        onClick: browseAllGuides
      },
      {
        label: "Start over",
        onClick: clearChat
      }
    ]);

    bindDynamicActions();
  }

  function setQuestionSuggestions(result) {
    const choices = Array.isArray(result.choices) ? result.choices.filter(Boolean).slice(0, 5) : [];

    const items = choices.map(choice => ({
      label: choice,
      onClick: () => continueWithAnswer(choice)
    }));

    items.push({
      label: "None of these fit",
      className: "fx-ai-suggestion-btn fx-ai-backup-option",
      onClick: () => continueWithAnswer("None of these fit")
    });

    items.push({
      label: "Add details",
      className: "fx-ai-suggestion-btn fx-ai-backup-option",
      onClick: askForMoreDetails
    });

    setSuggestions(items);
    bindDynamicActions();
  }

  function setBackupSuggestions() {
    setSuggestions([
      {
        label: "Add details",
        className: "fx-ai-suggestion-btn fx-ai-backup-option",
        onClick: askForMoreDetails
      },
      {
        label: "Browse guides",
        onClick: browseAllGuides
      },
      {
        label: "Start over",
        onClick: clearChat
      }
    ]);

    bindDynamicActions();
  }

  function askForMoreDetails() {
    addMessage(
      "assistant",
      `Please type the missing detail in your own words. Include what the customer is asking, what the BOL/LOA/system shows, or what you already checked.`
    );

    clearSuggestions();

    const els = getEls();
    setTimeout(() => els.input?.focus(), 50);
  }

  async function continueWithAnswer(answer) {
    if (!activeSession) {
      await startNewConcern(answer);
      return;
    }

    addMessage("user", answer);

    activeSession.conversation.push({
      role: "user",
      content: `Answer to "${activeSession.lastResult?.message || "previous question"}": ${answer}`
    });

    await runDecisionTurn();
  }

  async function startNewConcern(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    activeSession = {
      originalConcern: trimmed,
      conversation: [],
      lastResult: null,
      guideMaps: []
    };

    state.lastConcern = trimmed;
    saveState();

    addMessage("user", trimmed);
    clearSuggestions();

    await runDecisionTurn();
  }

  async function handleConcern(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    if (activeSession) {
      addMessage("user", trimmed);

      activeSession.conversation.push({
        role: "user",
        content: trimmed
      });

      await runDecisionTurn();
      return;
    }

    await startNewConcern(trimmed);
  }

  function browseAllGuides() {
    activeSession = null;
    const registry = getRegistry();
    addMessage("assistant", renderGuideList(registry, "All Registered Guides"), true);
    bindDynamicActions();
    clearSuggestions();
  }

  function openRecentGuide() {
    const recent = getRecentGuide();

    if (!recent) {
      addMessage("assistant", "There is no recent matched guide yet.");
      return;
    }

    addMessage(
      "assistant",
      `Here is your most recent matched guide.${renderGuideCard(recent)}`,
      true
    );

    bindDynamicActions();
  }

  function clearChat() {
    const els = getEls();
    if (els.messages) els.messages.innerHTML = "";

    activeSession = null;
    state.lastConcern = "";
    saveState();

    clearSuggestions();
    showWelcome();
  }

  function bindDynamicActions() {
    document.querySelectorAll("[data-guide-open]").forEach((item) => {
      if (item.dataset.bound === "true") return;
      item.dataset.bound = "true";

      item.addEventListener("click", () => {
        const url = item.getAttribute("data-guide-open");
        if (url) window.location.href = url;
      });
    });
  }

  function openPanel() {
    const els = getEls();
    if (!els.panel) return;

    els.panel.classList.remove("hidden");
    els.panel.setAttribute("aria-hidden", "false");
    state.isOpen = true;
    saveState();

    startNodePreload();

    setTimeout(() => {
      els.input?.focus();
    }, 60);
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

  async function sendInput() {
    const els = getEls();
    if (!els.input) return;

    const text = els.input.value.trim();
    if (!text) return;

    els.input.value = "";
    autoresizeInput();

    await handleConcern(text);
  }

  function bindEvents() {
    const els = getEls();
    if (!els.launcher || !els.panel) return;

    els.launcher.addEventListener("click", openPanel);
    els.close?.addEventListener("click", closePanel);
    els.minimize?.addEventListener("click", closePanel);

    els.send?.addEventListener("click", sendInput);

    els.input?.addEventListener("input", autoresizeInput);
    els.input?.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await sendInput();
      }
    });

    els.toolbarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-ai-action");

        if (action === "find-guide") {
          activeSession = null;
          addMessage("assistant", "Type the concern and I’ll review the guide nodes for the best next question.");
          clearSuggestions();
        }

        if (action === "recent-guide") {
          openRecentGuide();
        }

        if (action === "show-guides") {
          activeSession = null;
          browseAllGuides();
        }

        if (action === "clear-chat") {
          clearChat();
        }
      });
    });
  }

  function boot() {
    loadState();
    bindEvents();
    showWelcome();

    setTimeout(startNodePreload, 800);

    if (state.isOpen) openPanel();
  }

  function waitForMarkup() {
    const maxTries = 80;
    let count = 0;

    const timer = setInterval(() => {
      const launcher = document.getElementById("fx-ai-launcher");
      const panel = document.getElementById("fx-ai-panel");

      if (launcher && panel) {
        clearInterval(timer);
        boot();
      }

      count += 1;

      if (count > maxTries) {
        clearInterval(timer);
        console.error("AI assistant markup was not found.");
      }
    }, 80);
  }

  waitForMarkup();
})();
