(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v10";
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

  function loadState() { /* unchanged */ }
  function saveState() { /* unchanged */ }
  function getRegistry() { return Array.isArray(window.GUIDE_REGISTRY) ? window.GUIDE_REGISTRY : []; }
  function getNodeGuideRegistry() { return getRegistry().filter(guide => !guide.type || guide.type === "node-guide"); }
  function getBasePath() { return window.SITE_BASE || ""; }
  function resolveGuideUrl(url) { /* unchanged */ }
  function escapeHtml(value) { /* unchanged */ }
  function normalizeText(value) { /* unchanged */ }
  function compactText(value, max) { /* unchanged */ }
  function asksForCorrCode(text) { /* unchanged */ }
  function addMessage(role, content, allowHTML) { /* unchanged */ }
  function addThinkingMessage() { /* unchanged */ }
  function removeThinkingMessage(row) { /* unchanged */ }
  function clearSuggestions() { /* unchanged */ }
  function setSuggestions(items) { /* unchanged */ }

  /* ==========================================================
     IMPROVED: Extract const NODES from every guide page (unchanged)
  ========================================================== */
  function findNodesObjectStart(html) { /* unchanged */ }
  function extractBalancedObject(html, startIndex) { /* unchanged */ }
  function extractNodesFromHtml(html) { /* unchanged */ }
  function normalizeGuideNodes(guide, rawNodes) { /* unchanged */ }
  async function loadGuideNodes(guide) { /* unchanged */ }
  async function loadAllGuideNodes() { /* unchanged */ }
  function startNodePreload() { /* unchanged */ }

  /* ==========================================================
     IMPROVED: SCORING – uses phrase weighting and synonym groups
  ========================================================== */
  const SYNONYMS = {
    weight: ["weight", "reweigh", "scale", "pallet", "kg", "lb"],
    bol: ["bol", "bill of lading", "pro", "tracking", "shipment id"],
    correction: ["correction", "corr", "correct", "fix", "update", "change"],
    code: ["code", "accr", "cusi", "ecd", "etms", "sysm", "syss", "epdc", "eref", "eacc", "nacc", "eadl", "opso", "opsd", "cae", "rqe", "loa", "cblc"],
    debtor: ["debtor", "bill to", "shipper", "consignee", "3pl", "fpay", "collector"],
    service: ["service", "service level", "priority", "economy", "express", "freight class"],
    reference: ["reference", "ref number", "po number", "invoice number"]
  };

  function expandSynonyms(text) {
    let expanded = text.toLowerCase();
    for (const [key, words] of Object.entries(SYNONYMS)) {
      for (const word of words) {
        if (expanded.includes(word)) {
          // add all synonyms of that group to boost match
          for (const syn of words) {
            if (!expanded.includes(syn)) expanded += " " + syn;
          }
          break;
        }
      }
    }
    return expanded;
  }

  function scoreText(input, value, points) {
    const normalizedInput = expandSynonyms(normalizeText(input));
    const normalizedValue = expandSynonyms(normalizeText(value));
    if (!normalizedInput || !normalizedValue) return 0;
    let score = 0;
    // exact phrase match
    if (normalizedValue.includes(normalizedInput)) score += points * 2;
    // partial phrase
    if (normalizedInput.includes(normalizedValue)) score += points;
    // word matches
    const inputWords = new Set(normalizedInput.split(/\s+/).filter(w => w.length >= 3));
    normalizedValue.split(/\s+/).filter(w => w.length >= 3).forEach(word => {
      if (inputWords.has(word)) score += 1;
      // check synonym groups
      for (const [_, syns] of Object.entries(SYNONYMS)) {
        if (syns.includes(word)) {
          for (const syn of syns) {
            if (inputWords.has(syn)) score += 2; // synonym match
          }
        }
      }
    });
    return score;
  }

  function scoreGuideData(input, guideData) {
    const guide = guideData.guide || {};
    const guideBlob = `${guide.id} ${guide.title} ${guide.category} ${guide.description} ${(guide.keywords || []).join(" ")}`;
    let score = scoreText(input, guideBlob, 12);
    if (asksForCorrCode(input)) {
      const normalizedBlob = normalizeText(guideBlob);
      if (normalizedBlob.includes("correction") || normalizedBlob.includes("corr")) score += 220;
      if (normalizedBlob.includes("code")) score += 80;
    }
    (guideData.nodes || []).forEach(node => {
      let nodeScore = scoreText(input, node.searchText, node.type === "final" ? 8 : 5);
      // extra weight for final recommendations
      if (node.finalRecommendation && normalizeText(input).includes(normalizeText(node.text))) nodeScore += 15;
      score += nodeScore;
    });
    return score;
  }

  async function findRelevantGuideMaps(input, limit = 8) {
    const all = await loadAllGuideNodes();
    const scored = all.map(gd => ({ ...gd, score: scoreGuideData(input, gd) })).sort((a, b) => b.score - a.score);
    let selected = scored.filter(item => item.score > 0).slice(0, limit);
    if (asksForCorrCode(input)) {
      const correctionRelated = scored.filter(item => {
        const guideBlob = normalizeText(`${item.guide.id} ${item.guide.title} ${item.guide.url} ${item.guide.description}`);
        const nodeBlob = normalizeText((item.nodes || []).map(node => node.searchText).join(" "));
        return guideBlob.includes("correction") || guideBlob.includes("corr") || nodeBlob.includes("correction code") || nodeBlob.includes("corr");
      }).slice(0, 4);
      correctionRelated.reverse().forEach(item => {
        selected = selected.filter(existing => existing.guide.id !== item.guide.id);
        selected.unshift(item);
      });
      selected = selected.slice(0, limit);
    }
    return selected;
  }

  // Debug: log loaded nodes (remove after testing)
async function debugNodes() {
  const loaded = await loadAllGuideNodes();
  console.log("DEBUG: Loaded guides with nodes:", loaded.map(g => ({
    title: g.guide.title,
    nodeCount: g.nodes.length,
    firstNode: g.nodes[0]?.text,
    sampleChoices: g.nodes[0]?.choicesDetailed?.slice(0,2)
  })));
}
debugNodes();

  /* ==========================================================
     IMPROVED: Local correction code detection – comprehensive list
  ========================================================== */
  const CORRECTION_CODE_MAP = {
    "weight": "ACCR",
    "reweigh": "ACCR",
    "pallet count": "CUSI",
    "service level": "ECDL",
    "service type": "ECDL",
    "priority plus": "ECDL",
    "economy to priority": "ECDL",
    "reference number": "EREF",
    "po number": "EREF",
    "debtor": "ACCR",
    "bill to": "ACCR",
    "3pl": "ACCR",
    "collector": "ACCR",
    "fpay": "FPAY",
    "loa": "LOA",
    "rebill": "LOA",
    "rvsl": "LOA",
    "void": "VOID",
    "write off": "WO",
    "shipper code": "TPKN",
    "tphi": "TPHI",
    "tplo": "TPLO",
    "crau": "CRAU",
    "eprt": "ePRT",
    "fuel surcharge": "FUEL",
    "sort and segregate": "SORT",
    "notify fee": "NOTIFY",
    "shave a day": "SHAD",
    "employee discount": "EDSC"
  };

  function findLocalCorrAnswer(input, guideMaps) {
    if (!asksForCorrCode(input)) return null;
    const inputNorm = normalizeText(input);
    // first try to match a known keyword to a correction code
    for (const [keyword, code] of Object.entries(CORRECTION_CODE_MAP)) {
      if (inputNorm.includes(keyword)) {
        return {
          type: "recommendation",
          title: "Recommended Correction Code",
          action: code,
          reason: `Based on keyword "${keyword}" in your request.`,
          nextStep: `Use correction code ${code}. Open the matched guide to confirm.`,
          guideTitle: guideMaps?.[0]?.guide?.title || "",
          nodeId: ""
        };
      }
    }
    // fallback: search inside nodes for any explicit code
    const candidates = [];
    (guideMaps || []).forEach(guideData => {
      (guideData.nodes || []).forEach(node => {
        const nodeText = normalizeText(`${node.text} ${node.help} ${node.note}`);
        (node.choicesDetailed || []).forEach(choice => {
          if (choice.action && /[A-Z]{2,6}/.test(choice.action)) {
            let score = 0;
            if (nodeText.includes(inputNorm)) score += 20;
            if (choice.label && normalizeText(choice.label).includes(inputNorm)) score += 15;
            if (score > 0) candidates.push({ action: choice.action, score, guideData, node });
          }
        });
        if (node.finalRecommendation && /[A-Z]{2,6}/.test(node.finalRecommendation)) {
          let score = nodeText.includes(inputNorm) ? 20 : 0;
          if (score > 0) candidates.push({ action: node.finalRecommendation, score, guideData, node });
        }
      });
    });
    candidates.sort((a,b) => b.score - a.score);
    const best = candidates[0];
    if (best && best.score >= 15) {
      return {
        type: "recommendation",
        title: "Recommended Action",
        action: best.action,
        reason: `Found in ${best.guideData.guide.title}: ${best.node.text}`,
        nextStep: "Open the matched guide to confirm before proceeding.",
        guideTitle: best.guideData.guide.title,
        nodeId: best.node.nodeId
      };
    }
    return null;
  }

  /* ==========================================================
     Backend / Groq (unchanged)
  ========================================================== */
  function buildGuidePayload(guideData) { /* unchanged – keep original */ }
  function buildGuideSummaryPayload() { /* unchanged – keep original */ }
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
          localAnswerHint: localAnswer?.type === "recommendation" ? localAnswer : null
        })
      });
      if (!response.ok) throw new Error("Backend request failed.");
      const data = await response.json();
      if (!data.ok || !data.result) throw new Error(data.error || "No result.");
      return data.result;
    } catch (err) {
      console.error("AI backend failed:", err);
      return localAnswer || {
        type: "backup",
        title: "Backup Plan",
        message: "I reviewed the guide nodes but could not find a confident answer. Please choose a guide from the suggestions.",
        nextStep: "Select one of the guide suggestions below.",
        guideTitle: guideMaps?.[0]?.guide?.title || "",
        nodeId: ""
      };
    }
  }

  /* ==========================================================
     NEW: Disambiguation – ask user to pick a guide if score is low
  ========================================================== */
  async function disambiguateGuides(guideMaps, originalConcern) {
    if (!guideMaps || guideMaps.length === 0) return null;
    // if top score is high enough, just continue
    if (guideMaps[0].score > 30) return null;
    // present top 3 guides as choices
    const choices = guideMaps.slice(0, 3).map(g => ({
      label: g.guide.title,
      onClick: () => continueConversation(`I want to use the guide: ${g.guide.title}. Concern: ${originalConcern}`)
    }));
    choices.push({ label: "None of these – add more details", onClick: askForDetails });
    setSuggestions(choices);
    addMessage("assistant", "I'm not 100% sure which guide matches your case. Please select the most relevant one below, or add more details.", false);
    return "disambiguation";
  }

  /* ==========================================================
     Rendering (unchanged)
  ========================================================== */
  function renderMatchedGuide(guideMaps, result) { /* unchanged – keep original */ }
  function renderResult(result, guideMaps) { /* unchanged – keep original */ }
  function renderGuideList(guides, title) { /* unchanged – keep original */ }
  function bindDynamicActions() { /* unchanged – keep original */ }
  function setFollowupSuggestions(result) { /* unchanged – keep original */ }
  function setDoneSuggestions() { /* unchanged – keep original */ }
  function askForDetails() { /* unchanged – keep original */ }

  /* ==========================================================
     Main conversation loop – with disambiguation
  ========================================================== */
  async function runDecisionTurn() {
    if (!activeSession) return;
    clearSuggestions();
    const thinking = addThinkingMessage();

    const combinedText = [
      activeSession.originalConcern,
      ...activeSession.conversation.map(item => item.content)
    ].join(" ");

    let guideMaps = await findRelevantGuideMaps(combinedText, 8);
    activeSession.guideMaps = guideMaps;

    // If top score is low, ask user to disambiguate
    const disambig = await disambiguateGuides(guideMaps, activeSession.originalConcern);
    if (disambig === "disambiguation") {
      removeThinkingMessage(thinking);
      return;
    }

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
