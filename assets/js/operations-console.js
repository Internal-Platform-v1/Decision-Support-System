/*=========================================================
OPERATIONS CONSOLE
Decision Support System
=========================================================*/

"use strict";

/*=========================================================
GLOBAL
=========================================================*/

const OPS={
user:null,
stats:{},
collections:{},
activity:[],
guides:[],
initialized:false
};

/*=========================================================
SELECTORS
=========================================================*/

const $=e=>document.querySelector(e);
const $$=e=>document.querySelectorAll(e);

/*=========================================================
ELEMENTS
=========================================================*/

const EL={
loader:$("#opsLoader"),
overlay:$("#commandOverlay"),
search:$("#commandSearch"),
close:$("#closeCommand"),
commandBtn:$(".primary-btn"),

activeUsers:$("#activeUsers"),
guideCount:$("#guideCount"),
templateCount:$("#templateCount"),
aiRequests:$("#aiRequests"),
feedbackCount:$("#feedbackCount"),
todayUsers:$("#todayUsers"),
todayActions:$("#todayActions"),

metricSearches:$("#metricSearches"),
metricViews:$("#metricViews"),
metricTemplates:$("#metricTemplates")
};

/*=========================================================
INITIALIZE
=========================================================*/

document.addEventListener("DOMContentLoaded",initializeOperations);

async function initializeOperations(){

await loadUser();

initializeLoader();

initializeCommandPalette();

initializeQuickActions();

initializeCounters();

initializeAnimations();

initializeKeyboard();

initializeButtons();

await loadDashboard();

OPS.initialized=true;

console.log("Operations Console Ready");

}

/*=========================================================
USER
=========================================================*/

async function loadUser(){

try{

OPS.user=JSON.parse(localStorage.getItem("currentUser")||"{}");

}catch{

OPS.user={};

}

}

/*=========================================================
LOADER
=========================================================*/

function initializeLoader(){

if(!EL.loader)return;

setTimeout(()=>{

EL.loader.classList.add("hide");

setTimeout(()=>{

EL.loader.remove();

},500);

},900);

}

/*=========================================================
COMMAND PALETTE
=========================================================*/

function initializeCommandPalette(){

if(!EL.overlay)return;

EL.commandBtn?.addEventListener("click",openCommandPalette);

EL.close?.addEventListener("click",closeCommandPalette);

EL.overlay.addEventListener("click",e=>{

if(e.target===EL.overlay){

closeCommandPalette();

}

});

EL.search?.addEventListener("input",filterCommandResults);

}

function openCommandPalette(){

EL.overlay.classList.add("show");

EL.search?.focus();

}

function closeCommandPalette(){

EL.overlay.classList.remove("show");

if(EL.search)EL.search.value="";

filterCommandResults();

}

/*=========================================================
FILTER COMMANDS
=========================================================*/

function filterCommandResults(){

const value=(EL.search?.value||"").toLowerCase();

$$(".command-results button").forEach(btn=>{

btn.style.display=btn.textContent.toLowerCase().includes(value)
?"flex":"none";

});

}

/*=========================================================
KEYBOARD
=========================================================*/

function initializeKeyboard(){

document.addEventListener("keydown",e=>{

if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){

e.preventDefault();

openCommandPalette();

}

if(e.key==="Escape"){

closeCommandPalette();

}

});

}

/*=========================================================
BUTTONS
=========================================================*/

function initializeButtons(){

$$(".module-card").forEach(card=>{

card.addEventListener("mouseenter",()=>{

card.style.zIndex=5;

});

card.addEventListener("mouseleave",()=>{

card.style.zIndex="";

});

});

}

/*=========================================================
QUICK ACTIONS
=========================================================*/

function initializeQuickActions(){

$$(".quick-btn").forEach(btn=>{

btn.addEventListener("click",()=>{

const action=btn.innerText.trim();

showToast(action);

});

});

}

/*=========================================================
COUNTERS
=========================================================*/

function initializeCounters(){

animateCounter(EL.activeUsers,138);

animateCounter(EL.guideCount,47);

animateCounter(EL.templateCount,382);

animateCounter(EL.aiRequests,1248);

animateCounter(EL.feedbackCount,9);

animateCounter(EL.todayUsers,42);

animateCounter(EL.todayActions,689);

animateCounter(EL.metricSearches,1834);

animateCounter(EL.metricViews,9250);

animateCounter(EL.metricTemplates,647);

}

function animateCounter(el,target){

if(!el)return;

let value=0;

const speed=Math.max(10,target/60);

const timer=setInterval(()=>{

value+=speed;

if(value>=target){

value=target;

clearInterval(timer);

}

el.textContent=Math.floor(value).toLocaleString();

},20);

}
/*=========================================================
DASHBOARD
=========================================================*/

async function loadDashboard(){

await Promise.all([
loadGuideStatistics(),
loadActivityFeed(),
loadSystemHealth(),
loadRealtimeClock()
]);

}

/*=========================================================
GUIDE STATS
=========================================================*/

async function loadGuideStatistics(){

OPS.stats={
guides:47,
templates:382,
users:138,
feedback:9,
aiRequests:1248
};

}

/*=========================================================
ACTIVITY
=========================================================*/

async function loadActivityFeed(){

const feed=$(".activity-feed");

if(!feed)return;

const events=[
["fa-file-lines","purple","Fuel Guide Updated","2 minutes ago"],
["fa-user-plus","blue","New User Approved","5 minutes ago"],
["fa-robot","orange","AI Processed 186 Requests","Live"],
["fa-chart-line","green","Analytics Refreshed","Realtime"],
["fa-cloud-arrow-up","cyan","Cloud Sync Completed","12 minutes ago"],
["fa-bullhorn","red","Bulletin Published","18 minutes ago"]
];

feed.innerHTML="";

events.forEach(item=>{

const row=document.createElement("div");

row.className="feed-item";

row.innerHTML=`
<div class="feed-icon ${item[1]}"><i class="fa-solid ${item[0]}"></i></div>
<div><h4>${item[2]}</h4><p>${item[3]}</p></div>
`;

feed.appendChild(row);

});

}

/*=========================================================
SYSTEM HEALTH
=========================================================*/

async function loadSystemHealth(){

$$(".health-pill").forEach(pill=>{

pill.classList.add("success");

});

}

/*=========================================================
CLOCK
=========================================================*/

async function loadRealtimeClock(){

setInterval(()=>{

const chips=$$(".status-chip");

if(chips.length<4)return;

chips[3].innerHTML=`<i class="fa-solid fa-clock"></i>${new Date().toLocaleTimeString()}`;

},1000);

}

/*=========================================================
ANIMATIONS
=========================================================*/

function initializeAnimations(){

observeCards();

animateProgress();

parallaxBackground();

}

function observeCards(){

const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.animate([
{opacity:0,transform:"translateY(35px)"},
{opacity:1,transform:"translateY(0)"}
],{
duration:600,
fill:"forwards",
easing:"ease"
});

observer.unobserve(entry.target);

}

});

},{threshold:.15});

$$(".glass-card,.panel,.side-panel,.module-card,.kpi-card,.metric-card").forEach(card=>observer.observe(card));

}

function animateProgress(){

$$(".progress span").forEach(bar=>{

const width=bar.style.width||"80%";

bar.style.width="0";

requestAnimationFrame(()=>{

bar.style.transition="width 1.2s ease";

bar.style.width=width;

});

});

}

function parallaxBackground(){

const auroras=$$(".aurora");

window.addEventListener("mousemove",e=>{

const x=e.clientX/window.innerWidth-.5;
const y=e.clientY/window.innerHeight-.5;

auroras.forEach((a,i)=>{

const speed=(i+1)*18;

a.style.transform=`translate(${x*speed}px,${y*speed}px)`;

});

});

}

/*=========================================================
TOAST
=========================================================*/

function showToast(message){

const toast=document.createElement("div");

toast.className="ops-toast";

toast.innerHTML=`<i class="fa-solid fa-circle-check"></i><span>${message}</span>`;

document.body.appendChild(toast);

requestAnimationFrame(()=>toast.classList.add("show"));

setTimeout(()=>{

toast.classList.remove("show");

setTimeout(()=>toast.remove(),300);

},2500);

}

/*=========================================================
UTILITY
=========================================================*/

function formatNumber(v){

return Number(v||0).toLocaleString();

}

function random(min,max){

return Math.floor(Math.random()*(max-min+1))+min;

}

/*=========================================================
FUTURE FIREBASE
=========================================================*/
/*
Replace these placeholder functions with Firestore:

loadGuideStatistics()
loadActivityFeed()
loadSystemHealth()

Suggested collections:

approved_users
guide_registry
guide_usage
feedback
bulletins
templates
system_logs
ai_logs

The HTML and UI will automatically update once these
functions return real data.
*/

/*=========================================================
READY
=========================================================*/

window.OPS=OPS;
console.log("Operations Suite Loaded");

/*=========================================================
PART 3 — FIREBASE LIVE DATA
Replace placeholder data with real Firestore
=========================================================*/

/*---------------------------------------------------------
Collections
---------------------------------------------------------*/

const COLLECTIONS={
USERS:"approved_users",
GUIDES:"guide_registry",
USAGE:"guide_usage",
FEEDBACK:"feedback",
TEMPLATES:"billing_dispute_general_template",
BULLETINS:"bulletins",
AI:"ai_logs",
SYSTEM:"system_logs"
};

/*---------------------------------------------------------
Load Dashboard
---------------------------------------------------------*/

async function loadDashboard(){

await Promise.all([
loadRealtimeStats(),
loadRealtimeActivity(),
loadRealtimeHealth(),
loadRealtimeClock()
]);

}

/*---------------------------------------------------------
Realtime Stats
---------------------------------------------------------*/

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

}catch(e){

console.error(e);

}

}

/*---------------------------------------------------------
Guide Usage Today
---------------------------------------------------------*/

db.collection(COLLECTIONS.USAGE)
.orderBy("timestamp","desc")
.limit(1)
.onSnapshot(snap=>{

let today=0;

snap.forEach(()=>today++);

animateCounter(EL.todayActions,today);

});

/*---------------------------------------------------------
Realtime Activity Feed
---------------------------------------------------------*/

function loadRealtimeActivity(){

const feed=$(".activity-feed");

if(!feed)return;

db.collection(COLLECTIONS.SYSTEM)
.orderBy("timestamp","desc")
.limit(15)
.onSnapshot(snapshot=>{

feed.innerHTML="";

snapshot.forEach(doc=>{

const d=doc.data();

const row=document.createElement("div");

row.className="feed-item";

row.innerHTML=`
<div class="feed-icon blue">
<i class="fa-solid fa-circle"></i>
</div>

<div>

<h4>${d.title||"Activity"}</h4>

<p>${timeAgo(d.timestamp?.toDate?.()||new Date())}</p>

</div>
`;

feed.appendChild(row);

});

});

}

/*---------------------------------------------------------
Health
---------------------------------------------------------*/

function loadRealtimeHealth(){

db.collection(COLLECTIONS.SYSTEM)
.doc("status")
.onSnapshot(doc=>{

if(!doc.exists)return;

const data=doc.data();

updateHealth("#firebaseHealth",data.firebase);

updateHealth("#aiHealth",data.ai);

updateHealth("#guideHealth",data.guides);

updateHealth("#cloudHealth",data.cloud);

});

}

function updateHealth(id,status){

const el=$(id);

if(!el)return;

el.className="health-pill "+status;

el.textContent=status.toUpperCase();

}

/*---------------------------------------------------------
Live Usage Counter
---------------------------------------------------------*/

db.collection(COLLECTIONS.USAGE)
.onSnapshot(snapshot=>{

animateCounter(EL.metricViews,snapshot.size);

});

/*---------------------------------------------------------
Feedback Counter
---------------------------------------------------------*/

db.collection(COLLECTIONS.FEEDBACK)
.where("status","==","new")
.onSnapshot(snapshot=>{

animateCounter(EL.feedbackCount,snapshot.size);

});

/*---------------------------------------------------------
AI Requests
---------------------------------------------------------*/

db.collection(COLLECTIONS.AI)
.onSnapshot(snapshot=>{

animateCounter(EL.aiRequests,snapshot.size);

});

/*---------------------------------------------------------
Searches
---------------------------------------------------------*/

db.collection(COLLECTIONS.USAGE)
.where("type","==","search")
.onSnapshot(snapshot=>{

animateCounter(EL.metricSearches,snapshot.size);

});

/*---------------------------------------------------------
Templates Used
---------------------------------------------------------*/

db.collection(COLLECTIONS.USAGE)
.where("type","==","template")
.onSnapshot(snapshot=>{

animateCounter(EL.metricTemplates,snapshot.size);

});

/*---------------------------------------------------------
Realtime Clock
---------------------------------------------------------*/

function loadRealtimeClock(){

setInterval(()=>{

const clock=$("#liveClock");

if(clock){

clock.textContent=new Date().toLocaleTimeString();

}

},1000);

}

/*---------------------------------------------------------
Time Ago
---------------------------------------------------------*/

function timeAgo(date){

const s=Math.floor((Date.now()-date.getTime())/1000);

if(s<60)return s+" sec ago";

if(s<3600)return Math.floor(s/60)+" min ago";

if(s<86400)return Math.floor(s/3600)+" hr ago";

return Math.floor(s/86400)+" day ago";

}

/*=========================================================
PART 4 — ENTERPRISE ENGINE
Notifications • Search • Session • Auto Refresh
=========================================================*/

const ENGINE={
notifications:[],
sessions:new Map(),
guideIndex:[],
refreshTimer:null
};

/*---------------------------------------------------------
BOOT
---------------------------------------------------------*/

initializeEnterprise();

function initializeEnterprise(){

initializeGlobalSearch();

initializeNotificationCenter();

initializeSessionMonitor();

initializeGuideHeatmap();

initializeAutoRefresh();

initializeAIEngine();

initializeUsageLogger();

}

/*---------------------------------------------------------
GLOBAL SEARCH
---------------------------------------------------------*/

async function initializeGlobalSearch(){

try{

const snap=await db.collection(COLLECTIONS.GUIDES).get();

ENGINE.guideIndex=[];

snap.forEach(doc=>{

const d=doc.data();

ENGINE.guideIndex.push({
id:doc.id,
title:d.title||"",
keywords:d.keywords||[],
category:d.category||"",
url:d.url||"#"
});

});

}catch(e){

console.error(e);

}

}

function filterCommandResults(){

const keyword=(EL.search?.value||"").trim().toLowerCase();

const container=$(".command-results");

if(!container)return;

container.innerHTML="";

ENGINE.guideIndex
.filter(g=>

g.title.toLowerCase().includes(keyword) ||

g.category.toLowerCase().includes(keyword) ||

g.keywords.join(" ").toLowerCase().includes(keyword)

)
.slice(0,12)

.forEach(g=>{

const btn=document.createElement("button");

btn.innerHTML=`
<i class="fa-solid fa-compass"></i>
<div>
<strong>${g.title}</strong>
<small>${g.category}</small>
</div>
`;

btn.onclick=()=>location.href=g.url;

container.appendChild(btn);

});

}

/*---------------------------------------------------------
NOTIFICATIONS
---------------------------------------------------------*/

function initializeNotificationCenter(){

db.collection(COLLECTIONS.SYSTEM)
.orderBy("timestamp","desc")
.limit(20)
.onSnapshot(snapshot=>{

ENGINE.notifications=[];

snapshot.forEach(doc=>{

ENGINE.notifications.push(doc.data());

});

updateNotificationBadge();

});

}

function updateNotificationBadge(){

const badge=$("#notificationBadge");

if(!badge)return;

badge.textContent=ENGINE.notifications.length;

badge.style.display=
ENGINE.notifications.length?"flex":"none";

}

/*---------------------------------------------------------
SESSION MONITOR
---------------------------------------------------------*/

function initializeSessionMonitor(){

db.collection(COLLECTIONS.USERS)
.onSnapshot(snapshot=>{

ENGINE.sessions.clear();

snapshot.forEach(doc=>{

const d=doc.data();

if(d.online){

ENGINE.sessions.set(doc.id,d);

}

});

animateCounter(
EL.activeUsers,
ENGINE.sessions.size
);

});

}

/*---------------------------------------------------------
GUIDE HEATMAP
---------------------------------------------------------*/

function initializeGuideHeatmap(){

db.collection(COLLECTIONS.USAGE)
.where("type","==","guide")
.onSnapshot(snapshot=>{

const counts={};

snapshot.forEach(doc=>{

const g=doc.data().guide;

counts[g]=(counts[g]||0)+1;

});

renderHeatmap(counts);

});

}

function renderHeatmap(data){

$$("[data-guide]").forEach(card=>{

const id=card.dataset.guide;

const count=data[id]||0;

card.style.setProperty("--usage",count);

card.querySelector(".usage-count")?.textContent=count;

});

}

/*---------------------------------------------------------
AUTO REFRESH
---------------------------------------------------------*/

function initializeAutoRefresh(){

ENGINE.refreshTimer=setInterval(()=>{

loadRealtimeStats();

},60000);

}

/*---------------------------------------------------------
AI STATUS
---------------------------------------------------------*/

function initializeAIEngine(){

db.collection(COLLECTIONS.AI)
.orderBy("timestamp","desc")
.limit(1)
.onSnapshot(snapshot=>{

snapshot.forEach(doc=>{

const ai=doc.data();

updateAIStatus(ai);

});

});

}

function updateAIStatus(ai){

const status=$("#aiStatus");

if(!status)return;

status.textContent=ai.status||"ONLINE";

status.className="status-chip success";

const confidence=$("#aiConfidence");

if(confidence){

confidence.textContent=
(ai.confidence||99)+"%";

}

}

/*---------------------------------------------------------
USAGE LOGGER
---------------------------------------------------------*/

function initializeUsageLogger(){

document.addEventListener("click",async e=>{

const target=e.target.closest("[data-track]");

if(!target)return;

try{

await db.collection(COLLECTIONS.USAGE).add({

type:target.dataset.track,

label:target.dataset.label||target.innerText,

user:OPS.user?.email||"unknown",

timestamp:firebase.firestore.FieldValue.serverTimestamp()

});

}catch(err){

console.error(err);

}

});

}

/*---------------------------------------------------------
SYSTEM LOG
---------------------------------------------------------*/

async function writeSystemLog(title){

try{

await db.collection(COLLECTIONS.SYSTEM).add({

title,

user:OPS.user?.email,

timestamp:firebase.firestore.FieldValue.serverTimestamp()

});

}catch(e){

console.error(e);

}

}

/*---------------------------------------------------------
PAGE VISIT
---------------------------------------------------------*/

writeSystemLog("Operations Console Opened");

const themeSelector=document.getElementById("themeSelector");
const savedTheme=localStorage.getItem("operations-theme")||"theme-dark";

document.body.classList.remove("theme-dark","theme-light");
document.body.classList.add(savedTheme);

if(themeSelector)themeSelector.value=savedTheme;

themeSelector?.addEventListener("change",e=>{
const theme=e.target.value;
document.body.classList.remove("theme-dark","theme-light");
document.body.classList.add(theme);
localStorage.setItem("operations-theme",theme);
});
