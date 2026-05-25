console.log("[Assistant] ai-assistant.js executed");
(function() {
  console.log("[Assistant] IIFE started");
  const target = document.getElementById("fx-ai-root");
  if (target) {
    console.log("[Assistant] fx-ai-root found, adding test content");
    target.style.border = "3px solid red";
    target.style.backgroundColor = "#ffcccc";
    target.innerHTML = '<div style="color:black; padding:20px; text-align:center;">AI Assistant test: script is working!</div>';
  } else {
    console.error("[Assistant] fx-ai-root not found – HTML probably not injected");
  }
})();
