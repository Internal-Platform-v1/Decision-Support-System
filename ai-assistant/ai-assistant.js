(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v8";
  const FX_AI_BACKEND_URL = "https://fx-ai-groq-server.onrender.com";

  const state = { isOpen: false, lastMatchedGuideId: "" };
  const nodeCache = new Map();
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

  function getRegistry() {
    return Array.isArray(window.GUIDE_REGISTRY) ? window.GUIDE_REGISTRY : [];
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
    if (allowHTML) bubble.innerHTML = content;
    else bubble.textContent = content;

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
          <div class="fx-ai-thinking-text">Reading guide nodes...</div>
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

  /* ==========================================================
     Extract const NODES from every guide page
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
      const braceIndex = html.indexOf("{", match.index + match[0].length);
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
        if (depth === 0) return html.slice(startIndex, i + 1);
      }
    }

    return "";
  }

  function extractNodesFromHtml(html) {
    const start = findNodesObjectStart(html);
    if (start === -1) return null;

    const objectText = extractBalancedObject(html, start);
    if (!objectText) return null;

    try {
      return new Function(`return (${objectText});`)();
    } catch (err) {
      console.error("Failed to parse NODES:", err);
      return null;
    }
  }

  function normalizeGuideNodes(guide, rawNodes) {
    const entries = Object.entries(rawNodes || {});
    const nodesById = {};

    const nodes = entries.map(([nodeId, node]) => {
      const choicesDetailed = Array.isArray(node.choices)
        ? node.choices.map(choice => ({
            label: choice.label || "",
            next: choice.next || "",
            action: choice.action || "",
            desc: choice.desc || "",
            note: choice.note || ""
          })).filter(choice => choice.label)
        : [];

      const choices = choicesDetailed.map(choice => choice.label);
      const choiceActions = choicesDetailed.map(choice => choice.action).filter(Boolean);
      const isFinal = (!Array.isArray(node.choices) || node.choices.length === 0);

      const normalized = {
        guideId: guide.id,
        guideTitle: guide.title,
        guideUrl: guide.url,
        guideCategory: guide.category || "",
        nodeId,
        type: isFinal ? "final" : "question",
        text: node.text || "",
        help: node.help || "",
        note: node.note || "",
        choices,
        choicesDetailed,
        choiceActions,
        finalRecommendation: isFinal ? (node.text || "") : choiceActions.join("\n\n"),
        searchText: [
          guide.id, guide.title, guide.category, guide.description, ...(guide.keywords || []),
          nodeId, node.text, node.help, node.note,
          ...choicesDetailed.flatMap(choice => [choice.label, choice.next, choice.action, choice.desc, choice.note])
        ].filter(Boolean).join(" ")
      };

      nodesById[nodeId] = normalized;
      return normalized;
    });

    return { guide, nodes, nodesById };
  }

  async function loadGuideNodes(guide) {
    if (!guide || !guide.id || !guide.url) return null;
    if (nodeCache.has(guide.id)) return nodeCache.get(guide.id);

    try {
      const response = await fetch(resolveGuideUrl(guide.url), { cache: "no-store" });
      if (!response.ok) throw new Error(`Fetch failed: ${guide.url}`);

      const html = await response.text();
      const rawNodes = extractNodesFromHtml(html);

      if (!rawNodes) {
        console.warn("No const NODES found:", guide.title, guide.url);
        nodeCache.set(guide.id, null);
        return null;
      }

      const normalized = normalizeGuideNodes(guide, rawNodes);
      nodeCache.set(guide.id, normalized);
      return normalized;
    } catch (err) {
      console.error("Guide node load failed:", guide.title, err);
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

  /* ==========================================================
     Local search + ranking
  ========================================================== */

  function scoreText(input, value, points) {
    const normalizedInput = normalizeText(input);
    const normalizedValue = normalizeText(value);

    if (!normalizedInput || !normalizedValue) return 0;

    let score = 0;
    if (normalizedValue.includes(normalizedInput)) score += points * 2;
    if (normalizedInput.includes(normalizedValue)) score += points;

    const inputWords = new Set(normalizedInput.split(" ").filter(word => word.length >= 3));
    normalizedValue.split(" ").filter(word => word.length >= 3).forEach(word => {
      if (inputWords.has(word)) score += 1;
    });

    return score;
  }

  function scoreGuideData(input, guideData) {
    const guide = guideData.guide || {};
    const guideBlob = `${guide.id} ${guide.title} ${guide.category} ${guide.description} ${(guide.keywords || []).join(" ")}`;

    let score = scoreText(input, guideBlob, 12);

    if (asksForCorrCode(input)) {
      const normalizedGuideBlob = normalizeText(guideBlob);
      if (normalizedGuideBlob.includes("correction") || normalizedGuideBlob.includes("corr")) score += 220;
      if (normalizedGuideBlob.includes("code")) score += 80;
    }

    (guideData.nodes || []).forEach(node => {
      score += scoreText(input, node.searchText, node.type === "final" ? 6 : 4);
    });

    return score;
  }

  async function findRelevantGuideMaps(input, limit = 8) {
    const all = await loadAllGuideNodes();
    const scored = all
      .map(guideData => ({ ...guideData, score: scoreGuideData(input, guideData) }))
      .sort((a, b) => b.score - a.score);

    let selected = scored.filter(item => item.score > 0).slice(0, limit);

    if (asksForCorrCode(input)) {
      const correctionRelated = scored.filter(item => {
        const guideBlob = normalizeText(`${item.guide.id} ${item.guide.title} ${item.guide.url} ${item.guide.description}`);
        const nodeBlob = normalizeText((item.nodes || []).map(node => node.searchText).join(" "));
        return guideBlob.includes("correction") ||
          guideBlob.includes("corr") ||
          nodeBlob.includes("correction code") ||
          nodeBlob.includes("corr");
      }).slice(0, 4);

      correctionRelated.reverse().forEach(item => {
        selected = selected.filter(existing => existing.guide.id !== item.guide.id);
        selected.unshift(item);
      });

      selected = selected.slice(0, limit);
    }

    return selected;
  }

  function findLocalCorrAnswer(input, guideMaps) {
    if (!asksForCorrCode(input)) return null;

    const inputNorm = normalizeText(input);
    const stopWords = new Set(["what", "the", "code", "corr", "correction", "for", "per", "is", "are", "do", "use", "customer", "wants", "want", "need", "needs", "update", "change"]);
    const topicWords = inputNorm.split(" ").filter(word => word.length >= 3 && !stopWords.has(word));

    const candidates = [];

    (guideMaps || []).forEach(guideData => {
      const guideBonus = normalizeText(guideData.guide.title).includes("correction code") ? 75 : 0;

      (guideData.nodes || []).forEach(node => {
        const baseBlob = normalizeText(`${guideData.guide.title} ${node.nodeId} ${node.text} ${node.help} ${node.note}`);

        (node.choicesDetailed || []).forEach(choice => {
          if (!choice.action) return;

          const blob = normalizeText(`${baseBlob} ${choice.label} ${choice.desc} ${choice.note} ${choice.action}`);
          const hasCodeLikeAnswer = blob.includes("corr") ||
            blob.includes("correction") ||
            /\b(accr|cusi|ecd|etms|sysm|syss|epdc|eref|eacc|nacc|eadl|opso|opsd|cae|rqe|loa|acc|cblc)\b/i.test(choice.action);

          if (!hasCodeLikeAnswer) return;

          let score = guideBonus;
          topicWords.forEach(word => { if (blob.includes(word)) score += 7; });

          if (inputNorm.includes("weight") && blob.includes("weight")) score += 50;
          if (inputNorm.includes("bol") && blob.includes("bol")) score += 35;
          if (inputNorm.includes("rebill") && blob.includes("rebill")) score += 30;
          if (inputNorm.includes("terms") && blob.includes("terms")) score += 28;
          if (inputNorm.includes("account") && blob.includes("account")) score += 28;
          if (inputNorm.includes("service") && blob.includes("service")) score += 28;
          if (inputNorm.includes("accessorial") && blob.includes("accessorial")) score += 28;
          if (inputNorm.includes("reference") && blob.includes("reference")) score += 28;

          candidates.push({ guideData, node, choice, action: choice.action, score });
        });

        if (node.finalRecommendation) {
          const blob = normalizeText(`${baseBlob} ${node.finalRecommendation}`);
          const hasCodeLikeAnswer = blob.includes("corr") ||
            blob.includes("correction") ||
            /\b(accr|cusi|ecd|etms|sysm|syss|epdc|eref|eacc|nacc|eadl|opso|opsd|cae|rqe|loa|acc|cblc)\b/i.test(node.finalRecommendation);

          if (hasCodeLikeAnswer) {
            let score = guideBonus;
            topicWords.forEach(word => { if (blob.includes(word)) score += 7; });
            if (inputNorm.includes("weight") && blob.includes("weight")) score += 50;
            if (inputNorm.includes("bol") && blob.includes("bol")) score += 35;
            candidates.push({ guideData, node, choice: null, action: node.finalRecommendation, score });
          }
        }
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // If it only knows the branch but needs an answer, ask a relevant question instead of guessing.
    if (!best || best.score < 40) return null;

    return {
      type: "recommendation",
      title: "Recommended Action",
      action: best.action,
      reason: `Found in ${best.guideData.guide.title}: ${best.node.text}${best.choice ? " → " + best.choice.label : ""}`,
      nextStep: "Open the matched guide to confirm before completing the case.",
      guideTitle: best.guideData.guide.title,
      nodeId: best.node.nodeId
    };
  }

  /* ==========================================================
     Backend / Groq
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
      nodes: (guideData.nodes || []).slice(0, 180).map(node => ({
        nodeId: node.nodeId,
        type: node.type,
        text: node.text,
        help: node.help,
        note: node.note,
        choices: node.choices,
        choicesDetailed: node.choicesDetailed,
        choiceActions: node.choiceActions,
        finalRecommendation: node.finalRecommendation
      }))
    };
  }

  function buildGuideSummaryPayload() {
    return getRegistry().map(guide => ({
      guide: {
        id: guide.id || "",
        title: guide.title || "",
        url: guide.url || "",
        category: guide.category || "",
        description: guide.description || ""
      }
    }));
  }

  async function askDecisionAssistant(concern, guideMaps, conversation) {
    const localAnswer = findLocalCorrAnswer(concern, guideMaps);

    try {
      const response = await fetch(`${FX_AI_BACKEND_URL}/api/ai-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concern,
          guides: guideMaps.map(buildGuidePayload),
          allGuideSummaries: buildGuideSummaryPayload(),
          conversation,
          localAnswer: localAnswer?.type === "recommendation" ? localAnswer : null
        })
      });

      if (!response.ok) throw new Error("Backend request failed.");

      const data = await response.json();
      if (!data.ok || !data.result) throw new Error(data.error || "No result.");

      // Corr-code questions should never return a vague question when a local node answer exists.
      if (asksForCorrCode(concern) && data.result.type === "question" && localAnswer) {
        return localAnswer;
      }

      return data.result;
    } catch (err) {
      console.error("AI backend failed:", err);
      return localAnswer || {
        type: "backup",
        title: "Backup Plan",
        message: "I reviewed the guide nodes, but the AI backend did not return a reliable answer.",
        nextStep: "Open the matched guide or add more details.",
        guideTitle: guideMaps?.[0]?.guide?.title || "",
        nodeId: ""
      };
    }
  }

  /* ==========================================================
     Rendering
  ========================================================== */

  function findGuideByTitle(guideMaps, title) {
    const target = normalizeText(title);
    if (!target) return guideMaps?.[0] || null;

    return (guideMaps || []).find(item => {
      const guideTitle = normalizeText(item.guide.title);
      return guideTitle.includes(target) || target.includes(guideTitle);
    }) || guideMaps?.[0] || null;
  }

  function findNode(guideData, nodeId) {
    const target = normalizeText(nodeId);
    if (!target || !guideData) return null;
    return (guideData.nodes || []).find(node => normalizeText(node.nodeId) === target) || null;
  }

  function renderMatchedGuide(guideMaps, result) {
    const guideData = findGuideByTitle(guideMaps, result?.guideTitle);
    if (!guideData) return "";

    const guide = guideData.guide;
    const node = findNode(guideData, result?.nodeId);
    const guideUrl = escapeHtml(resolveGuideUrl(guide.url));
    const directUrl = node ? `${guideUrl}?node=${encodeURIComponent(node.nodeId)}` : guideUrl;
    const displayText = compactText(node?.finalRecommendation || node?.text || guide.description || "Open guide to review.", 220);

    return `
      <details class="fx-ai-source-details">
        <summary>View matched guide</summary>
        <div class="fx-ai-source-card">
          <div class="fx-ai-source-head">
            <span>${node?.type === "final" ? "Official Final Match" : "Matched Guide"}</span>
            <strong>${escapeHtml(guide.title)}</strong>
          </div>
          <p>${escapeHtml(displayText)}</p>
          <div class="fx-ai-guide-meta">
            <span class="fx-ai-tag">${escapeHtml(guide.category || "Guide")}</span>
            ${node?.nodeId ? `<span class="fx-ai-tag">${escapeHtml(node.nodeId)}</span>` : ""}
          </div>
          <div class="fx-ai-guide-actions">
            <a class="fx-ai-link primary" href="${guideUrl}">
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

  function renderResult(result, guideMaps) {
    if (!result) {
      return `
        <div class="fx-ai-decision-card fx-ai-backup-card">
          <div class="fx-ai-decision-kicker">Backup Plan</div>
          <h4>I reviewed the loaded guide nodes but need one clearer detail.</h4>
          <p>Add the missing detail or open the matched guide.</p>
        </div>
        ${renderMatchedGuide(guideMaps, result)}
      `;
    }

    if (result.type === "question") {
      return `
        <div class="fx-ai-decision-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Need one detail")}</div>
          <h4>${escapeHtml(result.message || "I need one more detail before deciding.")}</h4>
        </div>
        ${renderMatchedGuide(guideMaps, result)}
      `;
    }

    if (result.type === "backup") {
      return `
        <div class="fx-ai-decision-card fx-ai-backup-card">
          <div class="fx-ai-decision-kicker">${escapeHtml(result.title || "Backup Plan")}</div>
          <h4>${escapeHtml(result.message || "The guide nodes do not clearly answer this.")}</h4>
          ${result.nextStep ? `<p>${escapeHtml(result.nextStep)}</p>` : ""}
        </div>
        ${renderMatchedGuide(guideMaps, result)}
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
      ${renderMatchedGuide(guideMaps, result)}
    `;
  }

  function renderGuideList(guides, title = "All Registered Guides") {
    const items = guides.map(guide => `
      <div class="fx-ai-list-item" data-guide-open="${escapeHtml(resolveGuideUrl(guide.url))}">
        <strong>${escapeHtml(guide.title)}</strong>
        <span>${escapeHtml(compactText(guide.description || "", 90))}</span>
      </div>
    `).join("");

    return `
      <div class="fx-ai-card">
        <div class="fx-ai-card-title">${escapeHtml(title)}</div>
        <div class="fx-ai-empty-list">${items || "<div class='fx-ai-guide-desc'>No guides found.</div>"}</div>
      </div>
    `;
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

  function setFollowupSuggestions(result) {
    const choices = Array.isArray(result.choices) ? result.choices.filter(Boolean).slice(0, 5) : [];

    const items = choices.map(choice => ({
      label: choice,
      onClick: () => continueConversation(choice)
    }));

    items.push({
      label: "None of these fit",
      className: "fx-ai-suggestion-btn fx-ai-backup-option",
      onClick: () => continueConversation("None of these fit")
    });

    items.push({
      label: "Add details",
      className: "fx-ai-suggestion-btn fx-ai-backup-option",
      onClick: askForDetails
    });

    setSuggestions(items);
  }

  function setDoneSuggestions() {
    setSuggestions([
      { label: "Open recent match", onClick: openRecentGuide },
      { label: "Browse guides", onClick: browseGuides },
      { label: "Start over", onClick: clearChat }
    ]);
  }

  function askForDetails() {
    addMessage("assistant", "Type the missing detail in your own words. Include what the customer is asking, what the BOL/LOA/system shows, or what was already checked.");
    clearSuggestions();
    setTimeout(() => getEls().input?.focus(), 60);
  }

  async function runDecisionTurn() {
    if (!activeSession) return;

    clearSuggestions();
    const thinking = addThinkingMessage();

    const combinedText = [
      activeSession.originalConcern,
      ...activeSession.conversation.map(item => item.content)
    ].join(" ");

    const guideMaps = await findRelevantGuideMaps(combinedText, 8);
    activeSession.guideMaps = guideMaps;

    const result = await askDecisionAssistant(
      activeSession.originalConcern,
      guideMaps,
      activeSession.conversation
    );

    activeSession.lastResult = result;

    await new Promise(resolve => setTimeout(resolve, 180));
    removeThinkingMessage(thinking);

    if (guideMaps?.[0]?.guide?.id) {
      state.lastMatchedGuideId = guideMaps[0].guide.id;
      saveState();
    }

    addMessage("assistant", renderResult(result, guideMaps), true);
    bindDynamicActions();

    if (result?.type === "question") {
      setFollowupSuggestions(result);
      return;
    }

    if (result?.type === "backup") {
      setSuggestions([
        { label: "Add details", className: "fx-ai-suggestion-btn fx-ai-backup-option", onClick: askForDetails },
        { label: "Browse guides", onClick: browseGuides },
        { label: "Start over", onClick: clearChat }
      ]);
      return;
    }

    activeSession = null;
    setDoneSuggestions();
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
    activeSession.conversation.push({
      role: "user",
      content: `Answer/detail: ${trimmed}`
    });

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

  function browseGuides() {
    activeSession = null;
    addMessage("assistant", renderGuideList(getRegistry(), "All Registered Guides"), true);
    bindDynamicActions();
    clearSuggestions();
  }

  function openRecentGuide() {
    const guide = getRegistry().find(g => g.id === state.lastMatchedGuideId);
    if (!guide) {
      addMessage("assistant", "There is no recent matched guide yet.");
      return;
    }

    addMessage("assistant", `
      <div class="fx-ai-source-card">
        <div class="fx-ai-source-head">
          <span>Recent Match</span>
          <strong>${escapeHtml(guide.title)}</strong>
        </div>
        <p>${escapeHtml(compactText(guide.description || "", 160))}</p>
        <div class="fx-ai-guide-actions">
          <a class="fx-ai-link primary" href="${escapeHtml(resolveGuideUrl(guide.url))}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Open Guide</span>
          </a>
        </div>
      </div>
    `, true);
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

Type the customer’s concern. I’ll read the guide nodes, ask relevant questions, and give the recommended action.`);

    setSuggestions([
      { label: "Weight update per BOL", onClick: () => startNewConcern("weight update per bol. what is the corr code?") },
      { label: "Service level mismatch", onClick: () => startNewConcern("Customer says service level should be Economy but FBC shows Priority.") },
      { label: "Reference number edit", onClick: () => startNewConcern("what correction code for reference number edit?") }
    ]);
  }

  function openPanel() {
    const els = getEls();
    if (!els.panel) return;

    els.panel.classList.remove("hidden");
    els.panel.setAttribute("aria-hidden", "false");
    state.isOpen = true;
    saveState();
    startNodePreload();

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
          addMessage("assistant", "Type the concern and I’ll read the guide nodes for the best answer.");
          clearSuggestions();
        }

        if (action === "recent-guide") openRecentGuide();
        if (action === "show-guides") browseGuides();
        if (action === "clear-chat") clearChat();
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
