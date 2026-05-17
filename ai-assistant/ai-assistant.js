(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v4";

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

  function scoreGuide(input, guide) {
    let score = 0;

    score += scoreText(input, guide.title, 12);
    score += scoreText(input, guide.category, 3);
    score += scoreText(input, guide.badge, 2);
    score += scoreText(input, guide.description, 4);

    (guide.keywords || []).forEach((keyword) => {
      score += scoreText(input, keyword, 8);
    });

    return score;
  }

  function findBestGuide(input) {
    const registry = getRegistry();
    let best = null;
    let bestScore = 0;

    registry.forEach((guide) => {
      const score = scoreGuide(input, guide);
      if (score > bestScore) {
        bestScore = score;
        best = guide;
      }
    });

    return bestScore > 0 ? best : null;
  }

  function getRecentGuide() {
    const registry = getRegistry();
    return registry.find((g) => g.id === state.lastMatchedGuideId) || null;
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
          <div class="fx-ai-thinking-text">Thinking through the best next question...</div>
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
     GROQ DECISION ASSISTANT
  ========================================================== */

  function buildSafeMatchForAI(match) {
    if (!match) return null;

    const guide = match.guide || {};
    const node = match.node || {};

    return {
      score: match.score || 0,
      guide: {
        id: guide.id || node.guideId || "",
        title: guide.title || node.guideTitle || "",
        url: guide.url || node.guideUrl || "",
        category: guide.category || node.category || "",
        description: guide.description || ""
      },
      node: {
        nodeId: node.nodeId || "",
        type: node.type || "",
        text: node.text || "",
        help: node.help || "",
        note: node.note || "",
        choices: Array.isArray(node.choices) ? node.choices.slice(0, 8) : [],
        finalRecommendation: node.finalRecommendation || ""
      }
    };
  }

  async function askDecisionAssistant(concern, matches, conversation = []) {
    try {
      if (!FX_AI_BACKEND_URL) return null;

      const safeMatches = Array.isArray(matches)
        ? matches.map(buildSafeMatchForAI).filter(Boolean).slice(0, 5)
        : [];

      const response = await fetch(`${FX_AI_BACKEND_URL}/api/ai-decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          concern,
          matches: safeMatches,
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
     NODE INTELLIGENCE
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
    const nodesById = {};

    const parentMap = {};
    rawEntries.forEach(([nodeId, node]) => {
      if (!Array.isArray(node.choices)) return;

      node.choices.forEach((choice) => {
        if (choice && choice.next && !parentMap[choice.next]) {
          parentMap[choice.next] = nodeId;
        }
      });
    });

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
      const nextNodes = choicesDetailed.map(choice => choice.next).filter(Boolean);
      const isFinal = !Array.isArray(node.choices) || node.choices.length === 0;

      const normalized = {
        guideId: guide.id,
        guideTitle: guide.title,
        guideUrl: guide.url,
        category: guide.category || "guide",
        badge: guide.badge || "Guide",
        nodeId,
        type: isFinal ? "final" : "question",
        text: node.text || "",
        help: node.help || "",
        note: node.note || "",
        image: node.image || "",
        choices,
        choicesDetailed,
        choiceDescriptions,
        nextNodes,
        finalRecommendation: isFinal ? node.text || "" : "",
        parentMap,
        keywords: [
          guide.title || "",
          guide.category || "",
          guide.badge || "",
          guide.description || "",
          ...(guide.keywords || []),
          nodeId,
          node.text || "",
          node.help || "",
          node.note || "",
          node.image || "",
          ...choices,
          ...choiceDescriptions,
          ...nextNodes
        ]
      };

      nodesById[nodeId] = normalized;
      return normalized;
    });

    return {
      guide,
      nodes: normalizedNodes,
      nodesById,
      parentMap
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

  function startNodePreload() {
    if (preloadStarted) return;
    preloadStarted = true;

    getRegistry().forEach((guide) => {
      loadGuideNodes(guide);
    });
  }

  function scoreNodeMatch(input, node) {
    let score = 0;

    score += scoreText(input, node.guideTitle, 10);
    score += scoreText(input, node.category, 2);
    score += scoreText(input, node.badge, 2);
    score += scoreText(input, node.nodeId, 3);
    score += scoreText(input, node.text, node.type === "final" ? 12 : 8);
    score += scoreText(input, node.help, 4);
    score += scoreText(input, node.note, 4);
    score += scoreText(input, node.finalRecommendation, 14);

    (node.choices || []).forEach(choice => {
      score += scoreText(input, choice, 7);
    });

    (node.choiceDescriptions || []).forEach(desc => {
      score += scoreText(input, desc, 5);
    });

    (node.keywords || []).forEach(keyword => {
      score += scoreText(input, keyword, 3);
    });

    if (node.type === "final") score += 3;

    return score;
  }

  async function findTopNodeMatches(input, limit = 5) {
    const registry = getRegistry();
    const results = [];

    const allGuideNodeData = await Promise.all(
      registry.map(guide => loadGuideNodes(guide))
    );

    allGuideNodeData.forEach((guideNodeData) => {
      if (!guideNodeData || !Array.isArray(guideNodeData.nodes)) return;

      guideNodeData.nodes.forEach(node => {
        const score = scoreNodeMatch(input, node);

        if (score > 0) {
          results.push({
            guide: guideNodeData.guide,
            node,
            score,
            parentMap: guideNodeData.parentMap || {},
            guideNodeData
          });
        }
      });
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function getNodePath(match) {
    if (!match || !match.node || !match.parentMap) return [];

    const path = [];
    const seen = new Set();
    let current = match.node.nodeId;

    while (current && !seen.has(current)) {
      seen.add(current);
      path.unshift(current);
      current = match.parentMap[current];
    }

    return path;
  }

  function renderCompactPath(match) {
    const path = getNodePath(match);
    if (!path.length) return "";

    const lastItems = path.slice(-4);

    return `
      <div class="fx-ai-compact-path">
        ${lastItems.map(item => `<span>${escapeHtml(item)}</span>`).join("<i class='fa-solid fa-angle-right'></i>")}
      </div>
    `;
  }

  /* ==========================================================
     RENDERERS
  ========================================================== */

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

  function renderSourceDetails(match) {
    if (!match) return "";

    const guide = match.guide || {};
    const node = match.node || {};
    const safeUrl = escapeHtml(resolveGuideUrl(guide.url || node.guideUrl || ""));
    const directUrl = `${safeUrl}?node=${encodeURIComponent(node.nodeId || "")}`;
    const recommendation = compactText(node.finalRecommendation || node.text || "Review this guide step.", 220);

    return `
      <details class="fx-ai-source-details">
        <summary>View matched guide</summary>

        <div class="fx-ai-source-card">
          <div class="fx-ai-source-head">
            <span>${node.type === "final" ? "Official Final Match" : "Official Decision Step"}</span>
            <strong>${escapeHtml(guide.title || node.guideTitle || "Recommended Guide")}</strong>
          </div>

          <p>${escapeHtml(recommendation)}</p>

          ${renderCompactPath(match)}

          <div class="fx-ai-guide-meta">
            <span class="fx-ai-tag">${escapeHtml(guide.category || node.category || "Guide")}</span>
            <span class="fx-ai-tag">${escapeHtml(node.nodeId || "step")}</span>
          </div>

          <div class="fx-ai-guide-actions">
            <a class="fx-ai-link primary" href="${safeUrl}">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>Open Guide</span>
            </a>

            <a class="fx-ai-link secondary" href="${directUrl}">
              <i class="fa-solid fa-location-dot"></i>
              <span>Open Step</span>
            </a>
          </div>
        </div>
      </details>
    `;
  }

  function renderDecisionResult(result, match) {
    if (!result) {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">Need more detail</div>
          <h4>I found possible matches, but I need one clearer detail before deciding.</h4>
          <p>Type the missing detail in your own words, or use the backup options below.</p>
        </div>
        ${renderSourceDetails(match)}
      `;
    }

    if (result.type === "question") {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Need one detail")}</div>
          <h4>${escapeHtml(result.message || "I need one more detail before deciding.")}</h4>
        </div>
        ${renderSourceDetails(match)}
      `;
    }

    if (result.type === "backup") {
      return `
        <div class="fx-ai-decision-card fx-ai-backup-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Backup Plan")}</div>
          <h4>${escapeHtml(result.message || "The listed options do not clearly fit this concern.")}</h4>
          ${result.nextStep ? `<p>${escapeHtml(result.nextStep)}</p>` : ""}
        </div>
        ${renderSourceDetails(match)}
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

      ${renderSourceDetails(match)}
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

Type the customer’s concern. I’ll ask only the relevant question needed to reach the right action.`
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

  function buildCombinedConcern(session) {
    if (!session) return "";

    const answerText = session.conversation.map(item => {
      if (item.question || item.answer) {
        return `${item.question || ""} ${item.answer || ""}`;
      }

      return item.detail || "";
    }).join(" ");

    return `${session.originalConcern} ${answerText}`.trim();
  }

  async function runDecisionTurn(userTextForDisplay = null) {
    if (!activeSession) return;

    clearSuggestions();

    const thinkingRow = addThinkingMessage();

    const combinedConcern = buildCombinedConcern(activeSession);
    const topMatches = await findTopNodeMatches(combinedConcern, 5);
    const bestMatch = topMatches.length ? topMatches[0] : activeSession.lastMatch;

    activeSession.lastMatches = topMatches;
    activeSession.lastMatch = bestMatch || null;

    let result = null;

    if (topMatches.length) {
      result = await askDecisionAssistant(
        activeSession.originalConcern,
        topMatches,
        activeSession.conversation
      );
    }

    await wait(200);
    removeThinkingMessage(thinkingRow);

    if (!bestMatch && !result) {
      showNoMatch();
      setBackupSuggestions(null);
      return;
    }

    activeSession.lastResult = result;

    if (bestMatch?.guide?.id) {
      state.lastMatchedGuideId = bestMatch.guide.id;
      saveState();
    }

    addMessage("assistant", renderDecisionResult(result, bestMatch), true);

    if (result?.type === "question") {
      activeSession.lastQuestion = result.message || "Please confirm the correct detail.";
      setQuestionSuggestions(result, bestMatch);
      return;
    }

    if (result?.type === "backup") {
      setBackupSuggestions(bestMatch);
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

  function setQuestionSuggestions(result, match) {
    const choices = Array.isArray(result.choices) ? result.choices.filter(Boolean).slice(0, 5) : [];

    const items = choices.map(choice => ({
      label: choice,
      onClick: () => continueWithAnswer(choice)
    }));

    items.push({
      label: "None of these fit",
      className: "fx-ai-suggestion-btn fx-ai-backup-option",
      onClick: () => useBackupPlan("None of these fit")
    });

    items.push({
      label: "Add details",
      className: "fx-ai-suggestion-btn fx-ai-backup-option",
      onClick: () => askForMoreDetails()
    });

    setSuggestions(items);
    bindDynamicActions();
  }

  function setBackupSuggestions(match) {
    const items = [
      {
        label: "Add details",
        className: "fx-ai-suggestion-btn fx-ai-backup-option",
        onClick: () => askForMoreDetails()
      },
      {
        label: "Browse guides",
        onClick: browseAllGuides
      },
      {
        label: "Start over",
        onClick: clearChat
      }
    ];

    if (match?.guide?.url) {
      items.unshift({
        label: "Open matched guide",
        onClick: () => {
          window.location.href = resolveGuideUrl(match.guide.url);
        }
      });
    }

    setSuggestions(items);
    bindDynamicActions();
  }

  function askForMoreDetails() {
    addMessage(
      "assistant",
      `Please type the missing detail in your own words. For example, include what the customer is asking, what the BOL shows, or what system detail you already checked.`
    );

    clearSuggestions();

    const els = getEls();
    setTimeout(() => els.input?.focus(), 50);
  }

  async function useBackupPlan(answer) {
    if (!activeSession) return;

    addMessage("user", answer);

    activeSession.conversation.push({
      question: activeSession.lastQuestion || "Available choices did not fit.",
      answer
    });

    addMessage(
      "assistant",
      `
        <div class="fx-ai-decision-card fx-ai-backup-card">
          <div class="fx-ai-decision-kicker">Backup Plan</div>
          <h4>The listed options do not clearly fit this concern.</h4>
          <p>Add the missing detail in your own words, or open the matched guide to review manually.</p>
        </div>
        ${renderSourceDetails(activeSession.lastMatch)}
      `,
      true
    );

    setBackupSuggestions(activeSession.lastMatch);
  }

  async function continueWithAnswer(answer) {
    if (!activeSession) {
      await startNewConcern(answer);
      return;
    }

    addMessage("user", answer);

    activeSession.conversation.push({
      question: activeSession.lastQuestion || "Previous question",
      answer
    });

    await runDecisionTurn(answer);
  }

  async function startNewConcern(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    activeSession = {
      originalConcern: trimmed,
      conversation: [],
      lastQuestion: "",
      lastResult: null,
      lastMatch: null,
      lastMatches: []
    };

    state.lastConcern = trimmed;
    saveState();

    addMessage("user", trimmed);
    clearSuggestions();

    await runDecisionTurn();
  }

  async function handleFreeTextDuringSession(text) {
    if (!activeSession) {
      await startNewConcern(text);
      return;
    }

    addMessage("user", text);

    activeSession.conversation.push({
      detail: text
    });

    await runDecisionTurn(text);
  }

  async function handleConcern(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    if (activeSession) {
      await handleFreeTextDuringSession(trimmed);
      return;
    }

    await startNewConcern(trimmed);
  }

  function showSimilarGuides(baseGuide) {
    const registry = getRegistry();
    const similar = registry
      .filter((g) => g.id !== baseGuide.id && g.category === baseGuide.category)
      .slice(0, 5);

    addMessage(
      "assistant",
      renderGuideList(similar, `Other ${baseGuide.category || "Related"} Guides`),
      true
    );

    bindDynamicActions();
  }

  function browseAllGuides() {
    const registry = getRegistry();
    activeSession = null;
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
    document.querySelectorAll("[data-role='show-related']").forEach((btn) => {
      if (btn.dataset.bound === "true") return;
      btn.dataset.bound = "true";

      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-guide-id");
        const registry = getRegistry();
        const guide = registry.find((g) => g.id === id);
        if (guide) showSimilarGuides(guide);
      });
    });

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
          addMessage("assistant", "Type the concern and I’ll ask only the relevant question needed to decide.");
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
