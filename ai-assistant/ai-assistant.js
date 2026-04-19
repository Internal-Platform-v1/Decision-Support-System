(function () {
  const STORAGE_KEY = "fx_ai_assistant_state_v1";

  const state = {
    lastConcern: "",
    lastMatchedGuideId: "",
    isOpen: false
  };

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    return String(text || "").toLowerCase().trim();
  }

  function getRegistry() {
    return Array.isArray(window.GUIDE_REGISTRY) ? window.GUIDE_REGISTRY : [];
  }

  function scoreGuide(input, guide) {
    const normalized = normalizeText(input);
    if (!normalized) return 0;

    let score = 0;

    if (normalizeText(guide.title) && normalized.includes(normalizeText(guide.title))) {
      score += 8;
    }

    if (normalizeText(guide.category) && normalized.includes(normalizeText(guide.category))) {
      score += 2;
    }

    (guide.keywords || []).forEach((keyword) => {
      const key = normalizeText(keyword);
      if (!key) return;

      if (normalized.includes(key)) score += 6;

      key.split(/\s+/).forEach((part) => {
        if (part && normalized.includes(part)) score += 1;
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
    bubble.innerHTML = content;
  } else {
    bubble.textContent = content;
  }

  row.appendChild(bubble);
  els.messages.appendChild(row);
  scrollToBottom();
}

  function scrollToBottom() {
    const els = getEls();
    requestAnimationFrame(() => {
      if (els.messages) {
        els.messages.scrollTop = els.messages.scrollHeight;
      }
    });
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

  function renderGuideCard(guide) {
    const safeTitle = escapeHtml(guide.title);
    const safeDesc = escapeHtml(guide.description || "No guide description available.");
    const safeCategory = escapeHtml(guide.category || "Guide");
    const safeUrl = escapeHtml(guide.url);

    return `
      <div class="fx-ai-card">
        <div class="fx-ai-card-title">Best Match</div>
        <div class="fx-ai-guide-title">${safeTitle}</div>
        <div class="fx-ai-guide-desc">${safeDesc}</div>
        <div class="fx-ai-guide-meta">
          <span class="fx-ai-tag">${safeCategory}</span>
        </div>
        <div class="fx-ai-guide-actions">
          <a class="fx-ai-link primary" href="${safeUrl}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            Open Guide
          </a>
          <button class="fx-ai-btn secondary" type="button" data-guide-id="${escapeHtml(guide.id)}" data-role="show-related">
            <i class="fa-solid fa-list"></i>
            Similar Guides
          </button>
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
        <div class="fx-ai-list-item" data-guide-open="${escapeHtml(guide.url)}">
          <strong>${escapeHtml(guide.title)}</strong><br>
          <span style="font-size:0.82rem; color:#a1a1aa;">${escapeHtml(guide.description || "")}</span>
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

Describe the concern, issue, or case type and I’ll help find the most relevant guide.`
    );

    setSuggestions([
      {
        label: "Billing dispute concern",
        onClick: () => handleConcern("Customer has a billing dispute or invoice issue.")
      },
      {
        label: "SCAC/BU update request",
        onClick: () => handleConcern("Need help updating SCAC or BU.")
      },
      {
        label: "PAUD queue concern",
        onClick: () => handleConcern("Need help with a PAUD queue case.")
      }
    ]);
  }

  function showNoMatch() {
    addMessage(
      "assistant",
      `I couldn’t confidently match that concern yet.

Try using terms like:
• billing dispute
• PAUD queue
• SCAC/BU
• void and write off
• service level
• surcharge
• reference number`
    );
  }

  function handleConcern(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    state.lastConcern = trimmed;
    saveState();

    addMessage("user", trimmed);
    clearSuggestions();

    const bestGuide = findBestGuide(trimmed);

    if (!bestGuide) {
      showNoMatch();
      setSuggestions([
        {
          label: "Browse all guides",
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
        label: "Show similar guides",
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
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-guide-id");
        const registry = getRegistry();
        const guide = registry.find((g) => g.id === id);
        if (guide) showSimilarGuides(guide);
      });
    });

    document.querySelectorAll("[data-guide-open]").forEach((item) => {
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
    els.input.style.height = Math.min(els.input.scrollHeight, 120) + "px";
  }

  function sendInput() {
    const els = getEls();
    if (!els.input) return;

    const text = els.input.value.trim();
    if (!text) return;

    els.input.value = "";
    autoresizeInput();
    handleConcern(text);
  }

  function bindEvents() {
    const els = getEls();
    if (!els.launcher || !els.panel) return;

    els.launcher.addEventListener("click", openPanel);
    els.close?.addEventListener("click", closePanel);
    els.minimize?.addEventListener("click", closePanel);

    els.send?.addEventListener("click", sendInput);

    els.input?.addEventListener("input", autoresizeInput);
    els.input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendInput();
      }
    });

    els.toolbarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-ai-action");

        if (action === "find-guide") {
          addMessage("assistant", "Describe the concern and I’ll find the best matching guide.");
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
