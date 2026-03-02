document.addEventListener("DOMContentLoaded", () => {
  loadHeader();
  loadModals();
});

/* =============================
   LOAD HEADER
============================= */
function loadHeader() {
  fetch("header.html")
    .then(res => res.text())
    .then(data => {
      document.getElementById("headerContainer").innerHTML = data;
      highlightActiveTab();
      startClock();
      initHeaderButtons();
    });
}

/* =============================
   LOAD MODALS
============================= */
function loadModals() {
  fetch("modals.html")
    .then(res => res.text())
    .then(data => {
      document.body.insertAdjacentHTML("beforeend", data);
      initModalEvents();
    });
}

/* =============================
   ACTIVE TAB
============================= */
function highlightActiveTab() {
  const currentPage = window.location.pathname.split("/").pop();

  document.querySelectorAll(".nav-tabs .tab").forEach(link => {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }
  });
}

/* =============================
   CLOCK
============================= */
function startClock() {
  const clockText = document.getElementById("clockText");
  if (!clockText) return;

  function updateClock() {
    const now = new Date();
    clockText.textContent = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  updateClock();
  setInterval(updateClock, 1000);
}

/* =============================
   HEADER BUTTONS
============================= */
function initHeaderButtons() {
  document.getElementById("helpIcon")?.addEventListener("click", () => {
    document.getElementById("helpModal").style.display = "flex";
  });

  document.getElementById("commentIcon")?.addEventListener("click", () => {
    document.getElementById("commentModal").style.display = "flex";
  });
}

/* =============================
   MODAL EVENTS
============================= */
function initModalEvents() {
  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close");
      document.getElementById(modalId).style.display = "none";
    });
  });

  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }
  });
}
