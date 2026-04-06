document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("site-header");
  if (!target) return;

  try {
    const response = await fetch("header.html"); // 🔥 IMPORTANT: no ./
    if (!response.ok) throw new Error("Failed to load header");

    target.innerHTML = await response.text();

    // 🔥 TRIGGER HEADER READY
    document.dispatchEvent(new Event("headerLoaded"));

  } catch (err) {
    console.error("Header failed:", err);
  }
});
