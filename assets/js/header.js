let headerSelectedTimeZone =
  localStorage.getItem("bdToolsTimeZone") ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "Asia/Manila";

let headerCurrentDate = new Date();

function getZoneLabel(zone) {
  const zoneMap = {
    "Asia/Manila": "Manila Time",
    "Asia/Kolkata": "India Time",
    "America/New_York": "US Eastern",
    "America/Chicago": "US Central",
    "America/Denver": "US Mountain",
    "America/Los_Angeles": "US Pacific",
    "Europe/London": "London Time",
    "Europe/Paris": "Paris Time",
    "Asia/Dubai": "Dubai Time",
    "Asia/Singapore": "Singapore Time",
    "Asia/Tokyo": "Tokyo Time",
    "Australia/Sydney": "Sydney Time"
  };

  return zoneMap[zone] || zone;
}

function getTimeZoneDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);

  const result = {};
  parts.forEach((part) => {
    if (part.type !== "literal") result[part.type] = part.value;
  });

  return {
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day)
  };
}

function updateHeaderClock() {
  const now = new Date();

  const headerTime = new Intl.DateTimeFormat("en-US", {
    timeZone: headerSelectedTimeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(now);

  const popupTime = new Intl.DateTimeFormat("en-US", {
    timeZone: headerSelectedTimeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(now);

  const popupDate = new Intl.DateTimeFormat("en-US", {
    timeZone: headerSelectedTimeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);

  const clockText = document.getElementById("clockText");
  const popupTimeEl = document.getElementById("popupTime");
  const popupDateEl = document.getElementById("popupDate");
  const clockZoneLabel = document.getElementById("clockZoneLabel");

  if (clockText) clockText.textContent = headerTime;
  if (popupTimeEl) popupTimeEl.textContent = popupTime;
  if (popupDateEl) popupDateEl.textContent = popupDate;
  if (clockZoneLabel) clockZoneLabel.textContent = getZoneLabel(headerSelectedTimeZone);
}

function renderHeaderCalendar() {
  const calendarGrid = document.getElementById("calendarGrid");
  const monthYear = document.getElementById("monthYear");

  if (!calendarGrid || !monthYear) return;

  calendarGrid.innerHTML = "";

  const tzParts = getTimeZoneDateParts(headerCurrentDate, headerSelectedTimeZone);
  const firstDayUTC = new Date(Date.UTC(tzParts.year, tzParts.month - 1, 1));
  const lastDayUTC = new Date(Date.UTC(tzParts.year, tzParts.month, 0));

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: headerSelectedTimeZone,
    month: "long",
    year: "numeric"
  }).format(firstDayUTC);

  monthYear.textContent = monthLabel;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach((day) => {
    const cell = document.createElement("div");
    cell.textContent = day;
    cell.style.fontWeight = "700";
    cell.style.fontSize = "12px";
    cell.style.color = "#64748b";
    cell.style.textAlign = "center";
    calendarGrid.appendChild(cell);
  });

  const startDay = firstDayUTC.getUTCDay();
  const totalDays = lastDayUTC.getUTCDate();
  const nowParts = getTimeZoneDateParts(new Date(), headerSelectedTimeZone);

  for (let i = 0; i < startDay; i++) {
    const blank = document.createElement("div");
    calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.textContent = day;
    cell.style.padding = "10px";
    cell.style.textAlign = "center";
    cell.style.borderRadius = "12px";
    cell.style.background = "#f8fafc";
    cell.style.color = "#0f172a";
    cell.style.boxShadow = "inset 0 0 0 1px rgba(148,163,184,.12)";

    const isToday =
      tzParts.year === nowParts.year &&
      tzParts.month === nowParts.month &&
      day === nowParts.day;

    if (isToday) {
      cell.style.background = "#4d148c";
      cell.style.color = "#fff";
      cell.style.fontWeight = "800";
      cell.style.boxShadow = "none";
    }

    calendarGrid.appendChild(cell);
  }
}

function setHeaderActiveTab() {
  const currentPage = document.body.dataset.page || "";
  document.querySelectorAll(".nav-tabs .tab").forEach((tab) => {
    tab.classList.remove("active");
    if (tab.dataset.page === currentPage) {
      tab.classList.add("active");
    }
  });
}

/* =========================
   PREMIUM PAGE REVEAL SYSTEM
========================= */

function markRevealTargets() {
  const selectors = [
    ".hero",
    ".page-hero",
    ".guide-hero",
    ".search-wrap",
    ".search-section",
    ".search-shell",
    ".main-content",
    ".content-grid",
    ".cards-grid",
    ".guides-grid",
    ".flow-shell",
    ".flow-panel",
    ".recommendation-panel",
    ".template-panel",
    ".card",
    ".guide-card",
    ".step-card",
    ".premium-step-card",
    ".template-card",
    ".panel",
    ".glass-card"
  ];

  const elements = document.querySelectorAll(selectors.join(","));

  elements.forEach((el, index) => {
    if (
      !el.classList.contains("reveal") &&
      !el.classList.contains("reveal-up") &&
      !el.classList.contains("reveal-left") &&
      !el.classList.contains("reveal-right") &&
      !el.classList.contains("reveal-scale")
    ) {
      el.classList.add("reveal-scale");
    }

    el.classList.add(`stagger-${(index % 6) + 1}`);
  });
}

function initPremiumReveal() {
  const items = document.querySelectorAll(
    ".reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale"
  );

  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("show");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  items.forEach((item) => observer.observe(item));
}

window.animateStepSwitch = function (selector) {
  const el = document.querySelector(selector);
  if (!el) return;

  el.classList.remove("step-switch");
  void el.offsetWidth;
  el.classList.add("step-switch");
};

window.showRevealNow = function (root = document) {
  const items = root.querySelectorAll(
    ".reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale"
  );

  items.forEach((item) => item.classList.add("show"));
};

document.addEventListener("DOMContentLoaded", () => {
  markRevealTargets();

  requestAnimationFrame(() => {
    document.documentElement.classList.remove("preload");
    initPremiumReveal();
  });
});

/* =========================
   HEADER EVENTS
========================= */

document.addEventListener("headerLoaded", () => {
  const clockBtn = document.getElementById("clockBtn");
  const calendarPopup = document.getElementById("timeCalendarPopup");
  const openTimeSettings = document.getElementById("openTimeSettings");
  const closeTimeSettings = document.getElementById("closeTimeSettings");
  const saveTimeSettings = document.getElementById("saveTimeSettings");
  const timezoneSelectSettings = document.getElementById("timezoneSelectSettings");
  const prevMonth = document.getElementById("prevMonth");
  const nextMonth = document.getElementById("nextMonth");
  const timeSettingsModal = document.getElementById("timeSettingsModal");

  setHeaderActiveTab();
  updateHeaderClock();
  renderHeaderCalendar();
  setInterval(updateHeaderClock, 1000);

  if (clockBtn && calendarPopup) {
    clockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      calendarPopup.style.display =
        calendarPopup.style.display === "block" ? "none" : "block";
    });
  }

  document.addEventListener("click", (e) => {
    if (
      calendarPopup &&
      !calendarPopup.contains(e.target) &&
      !clockBtn?.contains(e.target)
    ) {
      calendarPopup.style.display = "none";
    }
  });

  if (openTimeSettings && timeSettingsModal && timezoneSelectSettings) {
    openTimeSettings.addEventListener("click", () => {
      timeSettingsModal.style.display = "flex";
      timezoneSelectSettings.value = headerSelectedTimeZone;
    });
  }

  if (closeTimeSettings && timeSettingsModal) {
    closeTimeSettings.addEventListener("click", () => {
      timeSettingsModal.style.display = "none";
    });
  }

  if (saveTimeSettings && timezoneSelectSettings && timeSettingsModal) {
    saveTimeSettings.addEventListener("click", () => {
      headerSelectedTimeZone = timezoneSelectSettings.value;
      localStorage.setItem("bdToolsTimeZone", headerSelectedTimeZone);
      updateHeaderClock();
      renderHeaderCalendar();
      timeSettingsModal.style.display = "none";
    });
  }

  if (prevMonth) {
    prevMonth.addEventListener("click", () => {
      headerCurrentDate.setMonth(headerCurrentDate.getMonth() - 1);
      renderHeaderCalendar();
    });
  }

  if (nextMonth) {
    nextMonth.addEventListener("click", () => {
      headerCurrentDate.setMonth(headerCurrentDate.getMonth() + 1);
      renderHeaderCalendar();
    });
  }

  if (timeSettingsModal) {
    timeSettingsModal.addEventListener("click", (e) => {
      if (e.target === timeSettingsModal) {
        timeSettingsModal.style.display = "none";
      }
    });
  }
});
