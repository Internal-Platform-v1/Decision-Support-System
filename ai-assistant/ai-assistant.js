(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v1";

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

    if (normalizedInput.includes(normalizedValue)) {
      score += points;
    }

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
    const normalized = normalizeText(input);
    if (!normalized) return 0;

    let score = 0;

    score += scoreText(input, guide.title, 12);
    score += scoreText(input, guide.category, 3);
    score += scoreText(input, guide.badge, 2);
    score += scoreText(input, guide.description, 4);

    (guide.keywords || []).forEach((keyword) => {
      const key = normalizeText(keyword);
      if (!key) return;

      if (normalized.includes(key)) score += 8;

      key.split(/\s+/).forEach((part) => {
        if (part && part.length >= 3 && normalized.includes(part)) score += 1;
      });
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
          <div class="fx-ai-thinking-text">Checking the best guide match...</div>
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
      btn.className = "fx-ai-suggestion-btn";
      btn.textContent = item.label;
      btn.addEventListener("click", item.onClick);
      els.suggestions.appendChild(btn);
    });
  }

  /* ==========================================================
     GROQ BACKEND CONNECTION
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
        choices: Array.isArray(node.choices) ? node.choices.slice(0, 6) : [],
        finalRecommendation: node.finalRecommendation || ""
      }
    };
  }

  async function askGroqAssistant(concern, matches) {
    try {
      if (!FX_AI_BACKEND_URL) return "";

      const safeMatches = Array.isArray(matches)
        ? matches.map(buildSafeMatchForAI).filter(Boolean).slice(0, 3)
        : [];

      const response = await fetch(`${FX_AI_BACKEND_URL}/api/ai-decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          concern,
          matches: safeMatches
        })
      });

      if (!response.ok) {
        throw new Error("AI backend request failed.");
      }

      const data = await response.json();

      if (!data.ok || !data.answer) {
        throw new Error(data.error || "No AI answer returned.");
      }

      return data.answer;
    } catch (error) {
      console.error("Groq assistant failed:", error);
      return "";
    }
  }

  /* ==========================================================
     NODE INTELLIGENCE
     The assistant reads const NODES directly from each guide page.
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
      const choices = Array.isArray(node.choices)
        ? node.choices.map(choice => choice.label || "").filter(Boolean)
        : [];

      const choiceDescriptions = Array.isArray(node.choices)
        ? node.choices.map(choice => choice.desc || "").filter(Boolean)
        : [];

      const nextNodes = Array.isArray(node.choices)
        ? node.choices.map(choice => choice.next || "").filter(Boolean)
        : [];

      const isFinal = !Array.isArray(node.choices) || node.choices.length === 0;

      return {
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
    });

    return {
      guide,
      nodes: normalizedNodes,
      parentMap
    };
  }

  async function loadGuideNodes(guide) {
    if (!guide || !guide.id || !guide.url) return null;

    if (nodeCache.has(guide.id)) {
      return nodeCache.get(guide.id);
    }

    try {
      const url = resolveGuideUrl(guide.url);
      const response = await fetch(url, { cache: "force-cache" });

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

  async function findTopNodeMatches(input, limit = 3) {
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
            parentMap: guideNodeData.parentMap || {}
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
    const safeDesc = escapeHtml(compactText(guide.description || "No guide description available.", 140));
    const safeCategory = escapeHtml(guide.category || "Guide");
    const safeUrl = escapeHtml(resolveGuideUrl(guide.url));

    return `
      <div class="fx-ai-card fx-ai-result-card">
        <div class="fx-ai-card-title">Best Guide Match</div>
        <div class="fx-ai-guide-title">${safeTitle}</div>
        <div class="fx-ai-guide-desc">${safeDesc}</div>
        <div class="fx-ai-guide-meta">
          <span class="fx-ai-tag">${safeCategory}</span>
        </div>
        <div class="fx-ai-guide-actions">
          <a class="fx-ai-link primary" href="${safeUrl}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Open Guide</span>
          </a>
          <button class="fx-ai-btn secondary" type="button" data-guide-id="${escapeHtml(guide.id)}" data-role="show-related">
            <i class="fa-solid fa-list-ul"></i>
            <span>Similar</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderNodeMatchCard(match) {
    const guide = match.guide || {};
    const node = match.node || {};

    const safeGuideTitle = escapeHtml(guide.title || node.guideTitle || "Recommended Guide");
    const safeCategory = escapeHtml(guide.category || node.category || "Guide");
    const safeUrl = escapeHtml(resolveGuideUrl(guide.url || node.guideUrl || ""));
    const safeNodeId = escapeHtml(node.nodeId || "recommended step");
    const recommendation = node.finalRecommendation || node.text || "Review this guide step.";
    const directUrl = `${safeUrl}?node=${encodeURIComponent(node.nodeId || "")}`;

    return `
      <div class="fx-ai-card fx-ai-node-card fx-ai-result-card">
        <div class="fx-ai-card-title">Official Guide Match</div>

        <div class="fx-ai-guide-title">${safeGuideTitle}</div>

        <div class="fx-ai-guide-meta">
          <span class="fx-ai-tag">${safeCategory}</span>
          <span class="fx-ai-tag">${node.type === "final" ? "Final" : "Step"}</span>
        </div>

        <div class="fx-ai-mini-block">
          <div class="fx-ai-mini-label">${node.type === "final" ? "Official Action" : "Suggested Step"}</div>
          <div class="fx-ai-mini-text">${escapeHtml(compactText(recommendation, 220))}</div>
        </div>

        ${renderCompactPath(match)}

        <details class="fx-ai-details">
          <summary>View guide details</summary>
          <div class="fx-ai-detail-grid">
            <div>
              <strong>Node</strong>
              <span>${safeNodeId}</span>
            </div>
            ${node.help ? `
              <div>
                <strong>Help</strong>
                <span>${escapeHtml(compactText(node.help, 220))}</span>
              </div>
            ` : ""}
            ${node.note ? `
              <div>
                <strong>Note</strong>
                <span>${escapeHtml(compactText(node.note, 220))}</span>
              </div>
            ` : ""}
            ${Array.isArray(node.choices) && node.choices.length ? `
              <div>
                <strong>Next Answers</strong>
                <span>${node.choices.slice(0, 6).map(choice => escapeHtml(choice)).join(", ")}</span>
              </div>
            ` : ""}
          </div>
        </details>

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
    `;
  }

  function renderGroqAnswer(answer) {
    if (!answer) return "";

    return `
      <div class="fx-ai-groq-answer">
        <div class="fx-ai-groq-label">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          AI Recommendation
        </div>
        <div class="fx-ai-groq-text">${escapeHtml(answer)}</div>
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

Type the case concern and I’ll suggest the best guide action.`
    );

    setSuggestions([
      {
        label: "Weight update per BOL",
        onClick: () => handleConcern("Customer wants to apply the weight shown on the BOL.")
      },
      {
        label: "RVSL refusal",
        onClick: () => handleConcern("Customer is refusing charges and wants reversal.")
      },
      {
        label: "Service level mismatch",
        onClick: () => handleConcern("Customer says the service level should be Economy but FBC shows Priority.")
      }
    ]);
  }

  function showNoMatch() {
    addMessage(
      "assistant",
      `I couldn’t confidently match that concern yet.

Try a few more details like the dispute type, BOL note, LOA status, service level, or queue name.`
    );
  }

  async function handleConcern(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    state.lastConcern = trimmed;
    saveState();

    addMessage("user", trimmed);
    clearSuggestions();

    const thinkingRow = addThinkingMessage();

    const topNodeMatches = await findTopNodeMatches(trimmed, 3);
    const bestNodeMatch = topNodeMatches.length ? topNodeMatches[0] : null;
    const bestGuide = findBestGuide(trimmed);

    let aiAnswer = "";

    if (bestNodeMatch) {
      aiAnswer = await askGroqAssistant(trimmed, topNodeMatches);
    }

    await wait(200);
    removeThinkingMessage(thinkingRow);

    if (bestNodeMatch) {
      state.lastMatchedGuideId = bestNodeMatch.guide.id;
      saveState();

      addMessage(
        "assistant",
        `
${aiAnswer ? renderGroqAnswer(aiAnswer) : `<div class="fx-ai-simple-note">I found the strongest guide match.</div>`}
${renderNodeMatchCard(bestNodeMatch)}
        `,
        true
      );

      bindDynamicActions();

      setSuggestions([
        {
          label: "Open recent match",
          onClick: openRecentGuide
        },
        {
          label: "Browse guides",
          onClick: browseAllGuides
        }
      ]);

      return;
    }

    if (!bestGuide) {
      showNoMatch();
      setSuggestions([
        {
          label: "Browse guides",
          onClick: browseAllGuides
        }
      ]);
      return;
    }

    state.lastMatchedGuideId = bestGuide.id;
    saveState();

    addMessage(
      "assistant",
      `I found the most relevant guide for this concern.${renderGuideCard(bestGuide)}`,
      true
    );

    bindDynamicActions();

    setSuggestions([
      {
        label: "Open recent match",
        onClick: openRecentGuide
      },
      {
        label: "Similar guides",
        onClick: () => showSimilarGuides(bestGuide)
      }
    ]);
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
          addMessage("assistant", "Type the concern and I’ll find the best guide action.");
        }

        if (action === "recent-guide") {
          openRecentGuide();
        }

        if (action === "show-guides") {
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

    if (state.isOpen) {
      openPanel();
    }
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
