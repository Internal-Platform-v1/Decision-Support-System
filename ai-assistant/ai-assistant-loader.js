document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("ai-assistant-container");
  if (!target) return;

  const base = window.SITE_BASE || "";
  const folder = `${base}ai-assistant/`;

  function loadCssOnce(href, marker) {
    if (document.querySelector(`link[data-fx-ai-style="${marker}"]`)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-fx-ai-style", marker);
    document.head.appendChild(link);
  }

  function loadScriptOnce(src, marker) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-fx-ai-script="${marker}"]`);

      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.setAttribute("data-fx-ai-script", marker);

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));

      document.body.appendChild(script);
    });
  }

  try {
    const response = await fetch(`${folder}ai-assistant.html`);
    if (!response.ok) throw new Error("Failed to load AI assistant HTML.");

    target.innerHTML = await response.text();

    loadCssOnce(`${folder}ai-assistant.css`, "main");

    /*
      Important:
      guide-registry.js must load BEFORE ai-assistant.js
      because ai-assistant.js reads window.GUIDE_REGISTRY.
    */
    await loadScriptOnce(`${folder}guide-registry.js`, "registry");
    await loadScriptOnce(`${folder}ai-assistant.js`, "main");

  } catch (error) {
    console.error("AI assistant failed to load:", error);
  }
});
