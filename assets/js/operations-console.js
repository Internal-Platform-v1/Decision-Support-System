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
