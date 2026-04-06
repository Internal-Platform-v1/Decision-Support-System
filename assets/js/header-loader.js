document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("site-header");
  if (!target) return;

  const base = window.SITE_BASE || "";

  try {
    const response = await fetch(`${base}header.html`);
    if (!response.ok) throw new Error(`Failed to load header.html`);

    target.innerHTML = await response.text();

    document.dispatchEvent(new Event("headerLoaded"));
  } catch (error) {
    console.error("Header load error:", error);
  }
});
