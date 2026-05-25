console.log("[Loader] Script started");
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Loader] DOMContentLoaded");
  const target = document.getElementById("ai-assistant-container");
  if (!target) {
    console.error("[Loader] Container #ai-assistant-container not found");
    return;
  }
  console.log("[Loader] Container found");
  const base = window.SITE_BASE || "";
  const folder = `${base}ai-assistant/`;
  console.log("[Loader] Folder:", folder);
  try {
    const response = await fetch(`${folder}ai-assistant.html`);
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    target.innerHTML = await response.text();
    console.log("[Loader] HTML loaded");
    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${folder}ai-assistant.css`;
    document.head.appendChild(link);
    console.log("[Loader] CSS loading started");
    // Load guide-registry.js (if needed – but we might not need it)
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${folder}guide-registry.js`;
      script.onload = () => { console.log("[Loader] guide-registry.js loaded"); resolve(); };
      script.onerror = (e) => { console.error("[Loader] guide-registry.js failed", e); reject(e); };
      document.body.appendChild(script);
    });
    // Load main ai-assistant.js
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${folder}ai-assistant.js`;
      script.onload = () => { console.log("[Loader] ai-assistant.js loaded"); resolve(); };
      script.onerror = (e) => { console.error("[Loader] ai-assistant.js failed", e); reject(e); };
      document.body.appendChild(script);
    });
    console.log("[Loader] All scripts loaded");
  } catch (error) {
    console.error("[Loader] Failed:", error);
  }
});
