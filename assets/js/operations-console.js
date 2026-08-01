"use strict";

const OPS = { user: null, stats: {}, collections: {}, activity: [], guides: [], initialized: !1 };
const $ = e => document.querySelector(e);
const $$ = e => document.querySelectorAll(e);

const EL = {
  loader: $("#opsLoader"),
  overlay: $("#commandOverlay"),
  search: $("#commandSearch"),
  close: $("#closeCommand"),
  commandBtn: $(".primary-btn"),
  activeUsers: $("#activeUsers"),
  guideCount: $("#guideCount"),
  templateCount: $("#templateCount"),
  aiRequests: $("#aiRequests"),
  feedbackCount: $("#feedbackCount"),
  todayUsers: $("#todayUsers"),
  todayActions: $("#todayActions"),
  metricSearches: $("#metricSearches"),
  metricViews: $("#metricViews"),
  metricTemplates: $("#metricTemplates"),
  themeToggle: $("#themeToggle")
};

document.addEventListener("DOMContentLoaded", initializeOperations);

async function initializeOperations() {
  await loadUser();
  initializeLoader();
  initializeCommandPalette();
  initializeQuickActions();
  initializeAnimations();
  initializeKeyboard();
  initializeButtons();
  initializeTheme();
  await loadDashboard();
  OPS.initialized = !0;
  console.log("Operations Console Ready");
}

async function loadUser() {
  try { OPS.user = JSON.parse(localStorage.getItem("currentUser") || "{}"); } catch { OPS.user = {}; }
}

function initializeLoader() {
  if (!EL.loader) return;
  setTimeout(() => {
    EL.loader.classList.add("hide");
    setTimeout(() => { EL.loader.remove(); }, 500);
  }, 900);
}

function initializeCommandPalette() {
  if (!EL.overlay) return;
  EL.commandBtn?.addEventListener("click", openCommandPalette);
  EL.close?.addEventListener("click", closeCommandPalette);
  EL.overlay.addEventListener("click", e => { if (e.target === EL.overlay) closeCommandPalette(); });
  EL.search?.addEventListener("input", filterCommandResults);
}

function openCommandPalette() { EL.overlay.classList.add("show"); EL.search?.focus(); }

function closeCommandPalette() {
  EL.overlay.classList.remove("show");
  if (EL.search) EL.search.value = "";
  filterCommandResults();
}

function filterCommandResults() {
  const keyword = (EL.search?.value || "").trim().toLowerCase();
  const container = $(".command-results");
  if (!container) return;
  container.innerHTML = "";
  const results = ENGINE.guideIndex
    .filter(g => g.title.toLowerCase().includes(keyword) || g.category.toLowerCase().includes(keyword) || g.keywords.join(" ").toLowerCase().includes(keyword))
    .slice(0, 12);
  results.forEach(g => {
    const btn = document.createElement("button");
    btn.innerHTML = `<i class="fa-solid fa-compass"></i><div><strong>${g.title}</strong><small>${g.category}</small></div>`;
    btn.onclick = () => location.href = g.url;
    container.appendChild(btn);
  });
}

function initializeKeyboard() {
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCommandPalette(); }
    if (e.key === "Escape") closeCommandPalette();
  });
}

function initializeButtons() {
  $$(".module-card").forEach(card => {
    card.addEventListener("mouseenter", () => { card.style.zIndex = 5; });
    card.addEventListener("mouseleave", () => { card.style.zIndex = ""; });
  });
}

function initializeQuickActions() {
  $$(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => { showToast(btn.innerText.trim()); });
  });
}

function animateCounter(el, target) {
  if (!el) return;
  let value = 0;
  const speed = Math.max(10, target / 60);
  const timer = setInterval(() => {
    value += speed;
    if (value >= target) { value = target; clearInterval(timer); }
    el.textContent = Math.floor(value).toLocaleString();
  }, 20);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "ops-toast";
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function formatNumber(v) { return Number(v || 0).toLocaleString(); }
function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const COLLECTIONS = {
  USERS: "approved_users",
  GUIDES: "guide_registry",
  USAGE: "guide_usage",
  FEEDBACK: "feedback",
  TEMPLATES: "billing_dispute_general_template",
  BULLETINS: "bulletins",
  AI: "ai_logs",
  SYSTEM: "system_logs"
};

async function loadDashboard() {
  await Promise.all([
    loadRealtimeStats(),
    loadRealtimeActivity(),
    loadRealtimeHealth(),
    loadRealtimeClock()
  ]);
  initializeGlobalSearch();
  initializeNotificationCenter();
  initializeSessionMonitor();
  initializeGuideHeatmap();
  initializeAutoRefresh();
  initializeAIEngine();
  initializeUsageLogger();
}

async function loadRealtimeStats() {
  try {
    const [users, guides, templates, feedback] = await Promise.all([
      db.collection(COLLECTIONS.USERS).get(),
      db.collection(COLLECTIONS.GUIDES).get(),
      db.collection(COLLECTIONS.TEMPLATES).get(),
      db.collection(COLLECTIONS.FEEDBACK).get()
    ]);
    animateCounter(EL.activeUsers, users.size);
    animateCounter(EL.guideCount, guides.size);
    animateCounter(EL.templateCount, templates.size);
    animateCounter(EL.feedbackCount, feedback.size);
  } catch (e) { console.error(e); }
}

db.collection(COLLECTIONS.USAGE).orderBy("timestamp", "desc").limit(1).onSnapshot(snap => {
  let today = 0;
  snap.forEach(() => today++);
  animateCounter(EL.todayActions, today);
});

db.collection(COLLECTIONS.USAGE).onSnapshot(snapshot => { animateCounter(EL.metricViews, snapshot.size); });
db.collection(COLLECTIONS.FEEDBACK).where("status", "==", "new").onSnapshot(snapshot => { animateCounter(EL.feedbackCount, snapshot.size); });
db.collection(COLLECTIONS.AI).onSnapshot(snapshot => { animateCounter(EL.aiRequests, snapshot.size); });
db.collection(COLLECTIONS.USAGE).where("type", "==", "search").onSnapshot(snapshot => { animateCounter(EL.metricSearches, snapshot.size); });
db.collection(COLLECTIONS.USAGE).where("type", "==", "template").onSnapshot(snapshot => { animateCounter(EL.metricTemplates, snapshot.size); });

function loadRealtimeActivity() {
  const feed = $(".activity-feed");
  if (!feed) return;
  db.collection(COLLECTIONS.SYSTEM).orderBy("timestamp", "desc").limit(15).onSnapshot(snapshot => {
    feed.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const row = document.createElement("div");
      row.className = "feed-item";
      row.innerHTML = `<div class="feed-icon blue"><i class="fa-solid fa-circle"></i></div><div><h4>${d.title || "Activity"}</h4><p>${timeAgo(d.timestamp?.toDate?.() || new Date())}</p></div>`;
      feed.appendChild(row);
    });
  });
}

function loadRealtimeHealth() {
  db.collection(COLLECTIONS.SYSTEM).doc("status").onSnapshot(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    updateHealth("#firebaseHealth", data.firebase);
    updateHealth("#aiHealth", data.ai);
    updateHealth("#guideHealth", data.guides);
    updateHealth("#cloudHealth", data.cloud);
  });
}

function updateHealth(id, status) {
  const el = $(id);
  if (!el) return;
  el.className = "health-pill " + status;
  el.textContent = status.toUpperCase();
}

function loadRealtimeClock() {
  setInterval(() => {
    const clock = $("#liveClock");
    if (clock) clock.textContent = new Date().toLocaleTimeString();
    const chips = $$(".status-chip");
    if (chips.length >= 4) chips[3].innerHTML = `<i class="fa-solid fa-clock"></i>${new Date().toLocaleTimeString()}`;
  }, 1000);
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return s + " sec ago";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hr ago";
  return Math.floor(s / 86400) + " day ago";
}

const ENGINE = {
  notifications: [],
  sessions: new Map(),
  guideIndex: [],
  refreshTimer: null
};

function initializeGlobalSearch() {
  db.collection(COLLECTIONS.GUIDES).get().then(snap => {
    ENGINE.guideIndex = [];
    snap.forEach(doc => {
      const d = doc.data();
      ENGINE.guideIndex.push({ id: doc.id, title: d.title || "", keywords: d.keywords || [], category: d.category || "", url: d.url || "#" });
    });
  }).catch(console.error);
}

function initializeNotificationCenter() {
  db.collection(COLLECTIONS.SYSTEM).orderBy("timestamp", "desc").limit(20).onSnapshot(snapshot => {
    ENGINE.notifications = [];
    snapshot.forEach(doc => { ENGINE.notifications.push(doc.data()); });
    updateNotificationBadge();
  });
}

function updateNotificationBadge() {
  const badge = $("#notificationBadge");
  if (!badge) return;
  badge.textContent = ENGINE.notifications.length;
  badge.style.display = ENGINE.notifications.length ? "flex" : "none";
}

function initializeSessionMonitor() {
  db.collection(COLLECTIONS.USERS).onSnapshot(snapshot => {
    ENGINE.sessions.clear();
    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.online) ENGINE.sessions.set(doc.id, d);
    });
    animateCounter(EL.activeUsers, ENGINE.sessions.size);
  });
}

function initializeGuideHeatmap() {
  db.collection(COLLECTIONS.USAGE).where("type", "==", "guide").onSnapshot(snapshot => {
    const counts = {};
    snapshot.forEach(doc => {
      const g = doc.data().guide;
      counts[g] = (counts[g] || 0) + 1;
    });
    renderHeatmap(counts);
  });
}

function renderHeatmap(data) {
  $$("[data-guide]").forEach(card => {
    const id = card.dataset.guide;
    const count = data[id] || 0;
    card.style.setProperty("--usage", count);
    const usage = card.querySelector(".usage-count");
    if (usage) usage.textContent = count;
  });
}

function initializeAutoRefresh() {
  ENGINE.refreshTimer = setInterval(() => { loadRealtimeStats(); }, 60000);
}

function initializeAIEngine() {
  db.collection(COLLECTIONS.AI).orderBy("timestamp", "desc").limit(1).onSnapshot(snapshot => {
    snapshot.forEach(doc => {
      const ai = doc.data();
      updateAIStatus(ai);
    });
  });
}

function updateAIStatus(ai) {
  const status = $("#aiStatus");
  if (!status) return;
  status.textContent = ai.status || "ONLINE";
  status.className = "status-chip success";
  const confidence = $("#aiConfidence");
  if (confidence) confidence.textContent = (ai.confidence || 99) + "%";
}

function initializeUsageLogger() {
  document.addEventListener("click", async e => {
    const target = e.target.closest("[data-track]");
    if (!target) return;
    try {
      await db.collection(COLLECTIONS.USAGE).add({
        type: target.dataset.track,
        label: target.dataset.label || target.innerText,
        user: OPS.user?.email || "unknown",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) { console.error(err); }
  });
}

async function writeSystemLog(title) {
  try {
    await db.collection(COLLECTIONS.SYSTEM).add({
      title,
      user: OPS.user?.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) { console.error(e); }
}

function initializeTheme() {
  const toggle = EL.themeToggle;
  if (!toggle) return;
  const savedTheme = localStorage.getItem("operations-theme") || "theme-light";
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(savedTheme);
  toggle.checked = savedTheme === "theme-dark";
  const text = document.querySelector(".theme-text");
  if (text) text.textContent = toggle.checked ? "Dark" : "Light";
  toggle.addEventListener("change", () => {
    const dark = toggle.checked;
    document.body.classList.toggle("theme-dark", dark);
    document.body.classList.toggle("theme-light", !dark);
    localStorage.setItem("operations-theme", dark ? "theme-dark" : "theme-light");
    if (text) text.textContent = dark ? "Dark" : "Light";
  });
}

function initializeAnimations() {
  observeCards();
  animateProgress();
  parallaxBackground();
}

function observeCards() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.animate([
          { opacity: 0, transform: "translateY(35px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 600, fill: "forwards", easing: "ease" });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .15 });
  $$(".glass-card,.panel,.side-panel,.module-card,.kpi-card,.metric-card").forEach(card => observer.observe(card));
}

function animateProgress() {
  $$(".progress span").forEach(bar => {
    const width = bar.style.width || "80%";
    bar.style.width = "0";
    requestAnimationFrame(() => {
      bar.style.transition = "width 1.2s ease";
      bar.style.width = width;
    });
  });
}

function parallaxBackground() {
  const auroras = $$(".aurora");
  window.addEventListener("mousemove", e => {
    const x = e.clientX / window.innerWidth - .5;
    const y = e.clientY / window.innerHeight - .5;
    auroras.forEach((a, i) => {
      const speed = (i + 1) * 18;
      a.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
    });
  });
}

window.OPS = OPS;
console.log("Operations Suite Loaded");
