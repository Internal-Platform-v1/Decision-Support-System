(function () {
  const THEME_STORAGE_KEY = "dssGuideTheme";
  const DEFAULT_THEME = "theme-fedex";
  const ALLOWED_THEMES = ["theme-fedex", "theme-atlas"];

  function getSavedTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return ALLOWED_THEMES.includes(savedTheme) ? savedTheme : DEFAULT_THEME;
  }

  function applyTheme(themeName) {
    const safeTheme = ALLOWED_THEMES.includes(themeName) ? themeName : DEFAULT_THEME;

    document.body.classList.remove(...ALLOWED_THEMES);
    document.body.classList.add(safeTheme);

    localStorage.setItem(THEME_STORAGE_KEY, safeTheme);

    const selector = document.getElementById("themeSelector");
    if (selector) {
      selector.value = safeTheme;
    }
  }

  function initThemeSelector() {
    const themeSelector = document.getElementById("themeSelector");
    const savedTheme = getSavedTheme();

    applyTheme(savedTheme);

    if (!themeSelector) return;

    themeSelector.value = savedTheme;

    themeSelector.addEventListener("change", function () {
      applyTheme(this.value);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeSelector);
  } else {
    initThemeSelector();
  }

  window.DSSTheme = {
    applyTheme,
    getSavedTheme
  };
})();
