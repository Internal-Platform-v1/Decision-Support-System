(function () {
  const THEME_STORAGE_KEY = "dssGuideTheme";
  const DEFAULT_THEME = "theme-fedex";
  const ALLOWED_THEMES = ["theme-fedex", "theme-atlas"];

  function getSavedTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return ALLOWED_THEMES.includes(saved) ? saved : DEFAULT_THEME;
  }

  function applyTheme(themeName) {
    const safeTheme = ALLOWED_THEMES.includes(themeName) ? themeName : DEFAULT_THEME;

    document.body.classList.remove(...ALLOWED_THEMES);
    document.body.classList.add(safeTheme);

    const selector = document.getElementById("themeSelector");
    if (selector) {
      selector.value = safeTheme;
    }
  }

  function saveTheme(themeName) {
    const safeTheme = ALLOWED_THEMES.includes(themeName) ? themeName : DEFAULT_THEME;

    localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
    applyTheme(safeTheme);

    const status = document.getElementById("themeSaveStatus");
    if (status) {
      status.textContent = "Theme saved";
      setTimeout(() => {
        status.textContent = "";
      }, 1800);
    }
  }

  function setupThemeSelector() {
    const selector = document.getElementById("themeSelector");
    const saveBtn = document.getElementById("saveThemeBtn");

    if (!selector || !saveBtn) return false;

    const savedTheme = getSavedTheme();

    selector.value = savedTheme;
    applyTheme(savedTheme);

    selector.addEventListener("change", function () {
      applyTheme(this.value);
    });

    saveBtn.addEventListener("click", function () {
      saveTheme(selector.value);
    });

    return true;
  }

  function waitForThemeSelector() {
    applyTheme(getSavedTheme());

    let attempts = 0;
    const maxAttempts = 40;

    const timer = setInterval(() => {
      attempts++;

      if (setupThemeSelector() || attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForThemeSelector);
  } else {
    waitForThemeSelector();
  }

  window.DSSTheme = {
    applyTheme,
    saveTheme,
    getSavedTheme
  };
})();
