document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("site-header");
  if (!target) return;

  try {
    const response = await fetch("./header.html");
    if (!response.ok) throw new Error("Failed to load header.html");

    target.innerHTML = await response.text();
    document.dispatchEvent(new CustomEvent("headerLoaded"));
  } catch (error) {
    console.error("Failed to load header.html:", error);
  }
});
