let headerSelectedTimeZone = localStorage.getItem("bdToolsTimeZone");

if (!headerSelectedTimeZone) {
  headerSelectedTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila";
  localStorage.setItem("bdToolsTimeZone", headerSelectedTimeZone);
}

let headerCurrentDate = null;
let headerClockInterval = null;
let headerEventsBound = false;

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
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  });

  return {
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day)
  };
}

function getTimeZoneMonthAnchor(date, timeZone) {
  const parts = getTimeZoneDateParts(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, 1));
}

function resetHeaderCurrentDateToSelectedZone() {
  headerCurrentDate = getTimeZoneMonthAnchor(new Date(), headerSelectedTimeZone);
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "flex";
  modalEl.classList.remove("is-closing");
  requestAnimationFrame(() => {
    modalEl.classList.add("is-open");
  });
}

function closeModal(modalEl) {
  if (!modalEl) return;

  modalEl.classList.remove("is-open");
  modalEl.classList.add("is-closing");

  setTimeout(() => {
    modalEl.style.display = "none";
    modalEl.classList.remove("is-closing");
  }, 220);
}

function toggleCalendarPopup(popupEl) {
  if (!popupEl) return;

  const isVisible = popupEl.classList.contains("is-open");

  if (isVisible) {
    popupEl.classList.remove("is-open");
    popupEl.style.display = "none";
  } else {
    popupEl.style.display = "block";
    requestAnimationFrame(() => {
      popupEl.classList.add("is-open");
    });
  }
}

function hideCalendarPopup(popupEl) {
  if (!popupEl) return;
  popupEl.classList.remove("is-open");
  popupEl.style.display = "none";
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

  if (!calendarGrid || !monthYear || !headerCurrentDate) return;

  calendarGrid.innerHTML = "";

  const displayYear = headerCurrentDate.getUTCFullYear();
  const displayMonthIndex = headerCurrentDate.getUTCMonth();

  const firstDayUTC = new Date(Date.UTC(displayYear, displayMonthIndex, 1));
  const lastDayUTC = new Date(Date.UTC(displayYear, displayMonthIndex + 1, 0));

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
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
  const todayParts = getTimeZoneDateParts(new Date(), headerSelectedTimeZone);

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
      displayYear === todayParts.year &&
      displayMonthIndex === todayParts.month - 1 &&
      day === todayParts.day;

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
   HEADER INIT
========================= */

function initHeaderUI() {
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

  resetHeaderCurrentDateToSelectedZone();
  updateHeaderClock();
  renderHeaderCalendar();

  if (headerClockInterval) clearInterval(headerClockInterval);
  headerClockInterval = setInterval(updateHeaderClock, 1000);

  if (!headerEventsBound) {
    document.addEventListener("click", (e) => {
      const liveCalendarPopup = document.getElementById("timeCalendarPopup");
      const liveClockBtn = document.getElementById("clockBtn");
      const liveTimeSettingsModal = document.getElementById("timeSettingsModal");

      if (
        liveCalendarPopup &&
        liveCalendarPopup.classList.contains("is-open") &&
        !liveCalendarPopup.contains(e.target) &&
        !liveClockBtn?.contains(e.target)
      ) {
        hideCalendarPopup(liveCalendarPopup);
      }

      if (liveTimeSettingsModal && e.target === liveTimeSettingsModal) {
        closeModal(liveTimeSettingsModal);
      }
    });

    headerEventsBound = true;
  }

  if (clockBtn && calendarPopup) {
    clockBtn.onclick = (e) => {
      e.stopPropagation();
      toggleCalendarPopup(calendarPopup);
    };
  }

  if (openTimeSettings && timeSettingsModal && timezoneSelectSettings && calendarPopup) {
    openTimeSettings.onclick = () => {
      hideCalendarPopup(calendarPopup);

      if (
        [...timezoneSelectSettings.options].some(
          (opt) => opt.value === headerSelectedTimeZone
        )
      ) {
        timezoneSelectSettings.value = headerSelectedTimeZone;
      }

      openModal(timeSettingsModal);
    };
  }

  if (closeTimeSettings && timeSettingsModal) {
    closeTimeSettings.onclick = () => {
      closeModal(timeSettingsModal);
    };
  }

  if (saveTimeSettings && timezoneSelectSettings && timeSettingsModal) {
    saveTimeSettings.onclick = () => {
      headerSelectedTimeZone = timezoneSelectSettings.value;
      localStorage.setItem("bdToolsTimeZone", headerSelectedTimeZone);

      resetHeaderCurrentDateToSelectedZone();

      if (headerClockInterval) clearInterval(headerClockInterval);
      headerClockInterval = setInterval(updateHeaderClock, 1000);

      updateHeaderClock();
      renderHeaderCalendar();
      closeModal(timeSettingsModal);
    };
  }

  if (prevMonth) {
    prevMonth.onclick = () => {
      headerCurrentDate = new Date(
        Date.UTC(
          headerCurrentDate.getUTCFullYear(),
          headerCurrentDate.getUTCMonth() - 1,
          1
        )
      );
      renderHeaderCalendar();
    };
  }

  if (nextMonth) {
    nextMonth.onclick = () => {
      headerCurrentDate = new Date(
        Date.UTC(
          headerCurrentDate.getUTCFullYear(),
          headerCurrentDate.getUTCMonth() + 1,
          1
        )
      );
      renderHeaderCalendar();
    };
  }
}

document.addEventListener("headerLoaded", initHeaderUI);

// login logout script
function getInitials(name, email) {
  const source = (name || "").trim();

  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "US";
}

function formatDisplayName(user) {
  if (user?.displayName && user.displayName.trim()) return user.displayName.trim();

  if (user?.email) {
    const local = user.email.split("@")[0];
    return local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  return "User";
}

async function loadHeaderUserProfile(user) {
  const avatar = document.getElementById("userAvatar");
  const avatarLarge = document.getElementById("userAvatarLarge");
  const nameEl = document.getElementById("userDisplayName");
  const roleEl = document.getElementById("userDisplayRole");
  const userMenu = document.getElementById("userMenu");

  if (!avatar || !avatarLarge || !nameEl || !roleEl || !userMenu) return;

  if (!user) {
    userMenu.style.display = "none";
    return;
  }

  userMenu.style.display = "flex";

  let displayName = formatDisplayName(user);
  let role = "Authenticated User";

  try {
    if (window.firebase && firebase.firestore) {
      const db = firebase.firestore();
      const email = (user.email || "").toLowerCase();

      const snap = await db.collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!snap.empty) {
        const data = snap.docs[0].data();
        if (data.name) displayName = data.name;
        if (data.role) role = data.role;
      }
    }
  } catch (error) {
    console.error("Unable to load user profile from Firestore:", error);
  }

  const initials = getInitials(displayName, user.email);

  avatar.textContent = initials;
  avatarLarge.textContent = initials;
  nameEl.textContent = displayName;
  roleEl.textContent = role;
}

function setupUserMenuDropdown() {
  const userMenu = document.getElementById("userMenu");
  const userBtn = document.getElementById("userMenuBtn");

  if (!userMenu || !userBtn) return;

  userBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = userMenu.classList.toggle("open");
    userBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target)) {
      userMenu.classList.remove("open");
      userBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      userMenu.classList.remove("open");
      userBtn.setAttribute("aria-expanded", "false");
    }
  });
}

function logoutUser() {
  if (!window.firebase || !firebase.auth) {
    console.error("Firebase auth is not available.");
    return;
  }

  firebase.auth().signOut()
    .then(() => {
      window.location.href = (window.SITE_BASE || "") + "index.html";
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
}

document.addEventListener("headerLoaded", () => {
  setupUserMenuDropdown();

  const userMenu = document.getElementById("userMenu");
  if (userMenu) userMenu.style.display = "none";

  if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (user) => {
      await loadHeaderUserProfile(user);
    });
  }
});
