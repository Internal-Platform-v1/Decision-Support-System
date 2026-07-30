"use strict";

const OPS = { user: null, stats: {}, collections: {}, activity: [], guides: [], initialized: !1 };
const $ = e => document.querySelector(e);
const $$ = e => document.querySelectorAll(e);

const EL={
loader:$("#opsLoader"),
overlay:$("#commandOverlay"),
search:$("#commandSearch"),
close:$("#closeCommand"),
commandBtn:$(".primary-btn"),
themeButton:$("#themeToggleButton"),
notificationDrawer:$("#notificationDrawer"),
notificationButton:$("#openNotifications"),
notificationClose:$("#closeNotifications"),
activeUsers:$("#activeUsers"),
guideCount:$("#guideCount"),
templateCount:$("#templateCount"),
aiRequests:$("#aiRequests"),
feedbackCount:$("#feedbackCount"),
pendingApprovals:$("#pendingApprovals"),
todaySearches:$("#todaySearches"),
todayUsers:$("#todayUsers"),
todayActions:$("#todayActions"),
activityFeed:$("#activityFeed"),
onlineUsers:$("#onlineUsers"),
onlineBadge:$("#onlineCountBadge"),
groqStatus:$("#groqStatus"),
firebaseStatus:$("#firebaseStatus"),
knowledgeStatus:$("#knowledgeStatus"),
responseTime:$("#responseTime")
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

function initializeLoader(){

if(!EL.loader)return;

requestAnimationFrame(()=>{

setTimeout(()=>{

EL.loader.classList.add("hide");

setTimeout(()=>{
EL.loader.remove();
},500);

},900);

});

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

function filterCommandResults(){

const keyword=(EL.search?.value||"").trim().toLowerCase();

const container=document.querySelector(".command-results");

if(!container)return;

container.innerHTML="";

const list=ENGINE.guideIndex
.filter(g=>{

if(!keyword)return true;

return(
g.title.toLowerCase().includes(keyword)||
g.category.toLowerCase().includes(keyword)||
(g.keywords||[]).join(" ").toLowerCase().includes(keyword)
);

})
.slice(0,15);

list.forEach(g=>{

const btn=document.createElement("button");

btn.innerHTML=`
<i class="fa-solid fa-compass"></i>
<div>
<strong>${g.title}</strong>
<small>${g.category}</small>
</div>`;

btn.onclick=()=>location.href=g.url;

container.appendChild(btn);

});

}

function initializeKeyboard() {
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCommandPalette(); }
    if (e.key === "Escape") closeCommandPalette();
  });
}

function initializeButtons(){

$$(".module-card").forEach(card=>{

card.addEventListener("mouseenter",()=>{
card.style.zIndex="5";
});

card.addEventListener("mouseleave",()=>{
card.style.zIndex="";
});

});

$$(".panel-btn").forEach(btn=>{

btn.addEventListener("click",()=>{

btn.classList.add("spin");

setTimeout(()=>{
btn.classList.remove("spin");
},500);

});

});

}

function initializeQuickActions(){
$$(".action-btn").forEach(btn=>{
btn.addEventListener("click",()=>{
showToast(btn.innerText.trim());
});
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

function showToast(message){

const container=document.getElementById("toastContainer");

if(!container)return;

const toast=document.createElement("div");

toast.className="ops-toast";

toast.innerHTML=`
<i class="fa-solid fa-circle-check"></i>
<span>${message}</span>`;

container.appendChild(toast);

requestAnimationFrame(()=>{

toast.classList.add("show");

});

setTimeout(()=>{

toast.classList.remove("show");

setTimeout(()=>toast.remove(),300);

},2500);

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

async function loadRealtimeStats(){

try{

const[
users,
guides,
templates,
feedback
]=await Promise.all([
db.collection(COLLECTIONS.USERS).get(),
db.collection(COLLECTIONS.GUIDES).get(),
db.collection(COLLECTIONS.TEMPLATES).get(),
db.collection(COLLECTIONS.FEEDBACK).get()
]);

animateCounter(EL.activeUsers,users.size);
animateCounter(EL.guideCount,guides.size);
animateCounter(EL.templateCount,templates.size);
animateCounter(EL.feedbackCount,feedback.size);

db.collection(COLLECTIONS.USAGE).onSnapshot(snapshot=>{

let searches=0;
let actions=0;

snapshot.forEach(doc=>{

const d=doc.data();

actions++;

if(d.type==="search")searches++;

});

animateCounter(EL.todayActions,actions);
animateCounter(EL.todaySearches,searches);

});

db.collection(COLLECTIONS.AI).onSnapshot(snapshot=>{
animateCounter(EL.aiRequests,snapshot.size);
});

db.collection(COLLECTIONS.USERS)
.where("online","==",true)
.onSnapshot(snapshot=>{

animateCounter(EL.todayUsers,snapshot.size);

});

db.collection(COLLECTIONS.USERS)
.where("approved","==",false)
.onSnapshot(snapshot=>{

if(EL.pendingApprovals)
animateCounter(EL.pendingApprovals,snapshot.size);

});

}catch(err){

console.error(err);

}

}

function loadRealtimeActivity(){

if(!EL.activityFeed)return;

db.collection(COLLECTIONS.SYSTEM)
.orderBy("timestamp","desc")
.limit(15)
.onSnapshot(snapshot=>{

EL.activityFeed.innerHTML="";

if(snapshot.empty){

EL.activityFeed.innerHTML=`
<div class="activity-item">
<div class="activity-icon blue">
<i class="fa-solid fa-circle-info"></i>
</div>
<div class="activity-body">
<strong>No recent activity</strong>
<p>The system is waiting for new events.</p>
<small>Just now</small>
</div>
</div>`;

return;

}

snapshot.forEach(doc=>{

const d=doc.data();

const row=document.createElement("div");

row.className="activity-item";

row.innerHTML=`
<div class="activity-icon blue">
<i class="fa-solid fa-circle"></i>
</div>
<div class="activity-body">
<strong>${d.title||"System Activity"}</strong>
<p>${d.description||"Operations update received."}</p>
<small>${timeAgo(d.timestamp?.toDate?.()||new Date())}</small>
</div>`;

EL.activityFeed.appendChild(row);

});

});

}

function loadRealtimeHealth(){

db.collection(COLLECTIONS.SYSTEM)
.doc("status")
.onSnapshot(doc=>{

if(!doc.exists)return;

const d=doc.data();

if(EL.firebaseStatus)
EL.firebaseStatus.textContent=d.firebase||"Connected";

if(EL.knowledgeStatus)
EL.knowledgeStatus.textContent=d.guides||"Healthy";

if(EL.groqStatus)
EL.groqStatus.textContent=d.aiProvider||"Groq";

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

function timeAgo(date){

const seconds=Math.floor((Date.now()-date.getTime())/1000);

if(seconds<10)return"Just now";

if(seconds<60)return`${seconds} sec ago`;

const minutes=Math.floor(seconds/60);

if(minutes<60)return`${minutes} min ago`;

const hours=Math.floor(minutes/60);

if(hours<24)return`${hours} hr ago`;

const days=Math.floor(hours/24);

if(days<30)return`${days} day${days>1?"s":""} ago`;

const months=Math.floor(days/30);

if(months<12)return`${months} month${months>1?"s":""} ago`;

const years=Math.floor(months/12);

return`${years} year${years>1?"s":""} ago`;

}

const ENGINE = {
  notifications: [],
  sessions: new Map(),
  guideIndex: [],
  refreshTimer: null
};

function initializeGlobalSearch(){

db.collection(COLLECTIONS.GUIDES)
.get()
.then(snapshot=>{

ENGINE.guideIndex=[];

snapshot.forEach(doc=>{

const d=doc.data();

ENGINE.guideIndex.push({

id:doc.id,
title:d.title||"",
category:d.category||"",
keywords:d.keywords||[],
url:d.url||"#"

});

});

filterCommandResults();

})
.catch(console.error);

}

function initializeNotificationCenter(){

if(EL.notificationButton){

EL.notificationButton.addEventListener("click",()=>{

EL.notificationDrawer?.classList.toggle("show");

});

}

if(EL.notificationClose){

EL.notificationClose.addEventListener("click",()=>{

EL.notificationDrawer?.classList.remove("show");

});

}

db.collection(COLLECTIONS.SYSTEM)
.orderBy("timestamp","desc")
.limit(20)
.onSnapshot(snapshot=>{

ENGINE.notifications=[];

snapshot.forEach(doc=>ENGINE.notifications.push(doc.data()));

const badge=EL.notificationButton?.querySelector(".badge");

if(badge){

badge.textContent=ENGINE.notifications.length;

badge.style.display=
ENGINE.notifications.length?"flex":"none";

}

});

}

function updateNotificationBadge() {
  const badge = $("#notificationBadge");
  if (!badge) return;
  badge.textContent = ENGINE.notifications.length;
  badge.style.display = ENGINE.notifications.length ? "flex" : "none";
}

function initializeSessionMonitor(){

db.collection(COLLECTIONS.USERS).onSnapshot(snapshot=>{

ENGINE.sessions.clear();

snapshot.forEach(doc=>{

const d=doc.data();

if(d.online)ENGINE.sessions.set(doc.id,d);

});

animateCounter(EL.activeUsers,ENGINE.sessions.size);

if(EL.onlineBadge)
EL.onlineBadge.textContent=`${ENGINE.sessions.size} Online`;

if(!EL.onlineUsers)return;

EL.onlineUsers.innerHTML="";

ENGINE.sessions.forEach(user=>{

const row=document.createElement("div");

row.className="online-user";

row.innerHTML=`
<div class="user-avatar">${(user.name||"U").substring(0,2).toUpperCase()}</div>
<div class="user-info">
<strong>${user.name||user.email||"Unknown User"}</strong>
<small>${user.role||"Employee"}</small>
</div>
<div class="user-status online"></div>
`;

EL.onlineUsers.appendChild(row);

});

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

function initializeAutoRefresh(){

clearInterval(ENGINE.refreshTimer);

ENGINE.refreshTimer=setInterval(()=>{

loadRealtimeStats();

loadRealtimeHealth();

},60000);

}

function initializeAIEngine(){

db.collection(COLLECTIONS.AI)
.orderBy("timestamp","desc")
.limit(1)
.onSnapshot(snapshot=>{

snapshot.forEach(doc=>{

updateAIStatus(doc.data());

});

});

}

function updateAIStatus(ai){

if(EL.groqStatus)
EL.groqStatus.textContent=ai.provider||"Groq";

if(EL.firebaseStatus)
EL.firebaseStatus.textContent=
ai.firebase||"Connected";

if(EL.knowledgeStatus)
EL.knowledgeStatus.textContent=
ai.status||"Healthy";

if(EL.responseTime)
EL.responseTime.textContent=
(ai.latency||218)+" ms";

}

function initializeUsageLogger()

async function writeSystemLog(title,description=""){

try{

await db.collection(COLLECTIONS.SYSTEM).add({

title,
description,
user:OPS.user?.email||"System",
timestamp:firebase.firestore.FieldValue.serverTimestamp()

});

}catch(err){

console.error(err);

}

}

function initializeTheme(){

const btn=EL.themeButton;

if(!btn)return;

const saved=localStorage.getItem("operations-theme")||"theme-light";

document.body.classList.remove("theme-light","theme-dark");
document.body.classList.add(saved);

btn.addEventListener("click",()=>{

const dark=document.body.classList.contains("theme-dark");

document.body.classList.toggle("theme-dark",!dark);
document.body.classList.toggle("theme-light",dark);

localStorage.setItem(
"operations-theme",
!dark?"theme-dark":"theme-light"
);

showToast(!dark?"Dark theme enabled":"Light theme enabled");

});

}

function initializeAnimations(){

observeCards();

animateProgress();

parallaxBackground();

document.querySelectorAll(".glow-card").forEach(card=>{

card.addEventListener("mousemove",e=>{

const rect=card.getBoundingClientRect();

card.style.setProperty("--mouse-x",(e.clientX-rect.left)+"px");

card.style.setProperty("--mouse-y",(e.clientY-rect.top)+"px");

});

});

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
