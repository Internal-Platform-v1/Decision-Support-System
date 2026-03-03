// Wait until page is ready
document.addEventListener("DOMContentLoaded", function () {

  // Load header
  fetch("header.html")
    .then(res => res.text())
    .then(data => {
      document.getElementById("header-container").innerHTML = data;
      highlightActiveTab();
      updateTime();
    });

  // Load modals
  fetch("modal.html")
    .then(res => res.text())
    .then(data => {
      document.body.insertAdjacentHTML("beforeend", data);
    });

  // Clock
  function updateTime() {
    const now = new Date();
    const el = document.getElementById("clockText");
    if (el) {
      el.innerText = now.toLocaleTimeString();
    }
  }

  setInterval(updateTime, 1000);

  // Active tab
  function highlightActiveTab() {
    const currentPage = window.location.pathname.split("/").pop();

    document.querySelectorAll(".nav-tabs .tab").forEach(link => {
      if (link.getAttribute("href") === currentPage) {
        link.classList.add("active");
      }
    });
  }

  // Click handlers
  document.addEventListener("click", function(e) {
    if (e.target.closest("#helpIcon")) {
      openHelp();
    }

    if (e.target.closest("#commentIcon")) {
      openFeedback();
    }
  });

});

// Modal functions
function openHelp() {
  const modal = document.getElementById("helpModal");
  if (modal) modal.style.display = "flex";
}

function openFeedback() {
  const modal = document.getElementById("feedbackModal");
  if (modal) modal.style.display = "flex";
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}
