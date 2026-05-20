(function () {
  const THEME_STORAGE_KEY = "dssGuideTheme";
  const DEFAULT_THEME = "theme-fedex";
  const ALLOWED_THEMES = ["theme-fedex", "theme-atlas", "theme-basic", "theme-simple"];

  function getSavedTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return ALLOWED_THEMES.includes(savedTheme) ? savedTheme : DEFAULT_THEME;
  }

  function applyTheme(themeName) {
    const safeTheme = ALLOWED_THEMES.includes(themeName) ? themeName : DEFAULT_THEME;

    if (!document.body) return;

    document.body.classList.remove(...ALLOWED_THEMES);
    document.body.classList.add(safeTheme);

    const selector = document.getElementById("themeSelector");
    if (selector) {
      selector.value = safeTheme;
    }
  }

  function closeUserDropdown() {
    const userMenu = document.getElementById("userMenu");
    const userDropdown = document.getElementById("userDropdown");
    const userMenuBtn = document.getElementById("userMenuBtn");

    if (userMenu) userMenu.classList.remove("open", "active", "show");
    if (userDropdown) userDropdown.classList.remove("open", "active", "show");

    if (userDropdown) {
      userDropdown.style.display = "";
    }

    if (userMenuBtn) {
      userMenuBtn.setAttribute("aria-expanded", "false");
    }

    document.body.classList.remove("user-menu-open");
  }

  function showThemeSavedStatus() {
    const status = document.getElementById("themeSaveStatus");

    if (!status) return;

    status.textContent = "Theme saved!";
    status.classList.add("show");

    setTimeout(function () {
      status.textContent = "";
      status.classList.remove("show");
    }, 1300);
  }

  function saveTheme(themeName) {
    const safeTheme = ALLOWED_THEMES.includes(themeName) ? themeName : DEFAULT_THEME;

    localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
    applyTheme(safeTheme);
    showThemeSavedStatus();

    setTimeout(function () {
      closeUserDropdown();
    }, 550);
  }

  function setupThemeSelector() {
    const selector = document.getElementById("themeSelector");
    const saveBtn = document.getElementById("saveThemeBtn");

    if (!selector || !saveBtn) return false;

    const savedTheme = getSavedTheme();

    selector.value = savedTheme;
    applyTheme(savedTheme);

    if (selector.dataset.themeBound === "true") return true;

    selector.dataset.themeBound = "true";

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
    const maxAttempts = 80;

    const timer = setInterval(function () {
      attempts++;

      const ready = setupThemeSelector();

      if (ready || attempts >= maxAttempts) {
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
    applyTheme: applyTheme,
    saveTheme: saveTheme,
    getSavedTheme: getSavedTheme
  };
})();
