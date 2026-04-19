document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("ai-assistant-container");
  if (!target) return;

  const base = window.SITE_BASE || "";
  const folder = `${base}ai-assistant/`;

  try {
    const response = await fetch(`${folder}ai-assistant.html`);
    if (!response.ok) throw new Error("Failed to load AI assistant HTML.");

    target.innerHTML = await response.text();

    if (!document.querySelector('link[data-fx-ai-style="true"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${folder}ai-assistant.css`;
      link.setAttribute("data-fx-ai-style", "true");
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-fx-ai-script="true"]')) {
      const script = document.createElement("script");
      script.src = `${folder}ai-assistant.js`;
      script.defer = true;
      script.setAttribute("data-fx-ai-script", "true");
      document.body.appendChild(script);
    }
  } catch (error) {
    console.error("AI assistant failed to load:", error);
  }
});
