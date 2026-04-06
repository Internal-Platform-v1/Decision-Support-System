document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("site-header");
  if (!target) return;

  const base = window.SITE_BASE || "";

  try {
    const response = await fetch(base + "header.html");
    if (!response.ok) throw new Error(`Failed to load header.html: ${response.status}`);

    const html = await response.text();
    target.innerHTML = html;

    target.querySelectorAll("[data-link]").forEach(link => {
      const path = link.getAttribute("data-link");
      link.setAttribute("href", base + path);
    });

    document.dispatchEvent(new Event("headerLoaded"));
  } catch (error) {
    console.error("Header load error:", error);
  }
});
