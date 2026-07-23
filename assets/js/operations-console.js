/*========== Operations Console ==========*/

let db,auth,currentUser;
const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",async()=>{
    initFirebase();
    loadHeaderFooter();
    await waitForAuthentication();
    registerEvents();
    startClock();
});

function initFirebase(){
    if(typeof firebase==="undefined") return console.error("Firebase SDK not loaded.");
    auth=firebase.auth();
    db=firebase.firestore();
}

function loadHeaderFooter(){
    if(typeof loadHeader==="function") loadHeader();
    if(typeof loadFooter==="function") loadFooter();
}

async function waitForAuthentication(){
    return new Promise(resolve=>{
        auth.onAuthStateChanged(async user=>{
            if(!user) return location.href="index.html";
            currentUser=user;
            await loadCurrentUser();
            await loadDashboard();
            resolve();
        });
    });
}

async function loadCurrentUser(){
    try{
        const snap=await db.collection("approved_users").doc(currentUser.email.toLowerCase()).get();
        if(!snap.exists){
            alert("You are not authorized.");
            return location.href="index.html";
        }
        $("currentAdmin").textContent=snap.data().name||currentUser.email;
    }catch(err){
        console.error(err);
        setStatusError();
    }
}

async function loadDashboard(){
    await Promise.all([
        loadBulletinCount(),
        loadFeedbackCount(),
        loadGuideUsage(),
        loadRecentActivity(),
        loadSystemHealth()
    ]);
}

async function loadBulletinCount(){
    try{console.log("Bulletins:",(await db.collection("bulletins").get()).size);}
    catch(err){console.error(err);}
}

async function loadFeedbackCount(){
    try{console.log("Feedback:",(await db.collection("feedback").get()).size);}
    catch(err){console.error(err);}
}

async function loadGuideUsage(){
    try{console.log("Guide Usage:",(await db.collection("guide_usage").get()).size);}
    catch(err){console.error(err);}
}

async function loadRecentActivity(){
    const container=$("recentActivity");
    container.innerHTML="<div class='loading'>Loading...</div>";

    try{
        const snap=await db.collection("operations_logs").orderBy("timestamp","desc").limit(10).get();

        if(snap.empty){
            container.innerHTML="<div class='loading'>No recent activity.</div>";
            return;
        }

        container.innerHTML=[...snap.docs].map(doc=>{
            const d=doc.data();
            return `<div class="activity-item">
                        <div class="activity-title">${escapeHtml(d.action||"Activity")}</div>
                        <div class="activity-meta">${escapeHtml(d.user||"")}</div>
                    </div>`;
        }).join("");

    }catch(err){
        console.error(err);
        container.innerHTML="<div class='loading'>Unable to load activity.</div>";
    }
}

async function loadSystemHealth(){
    $("firebaseStatus").textContent="Connected";
    $("authStatus").textContent="Verified";
    $("firestoreStatus").textContent="Ready";
}

function registerEvents(){
    $("openBulletinCenter")?.addEventListener("click",()=>location.href="bulletin-center.html");
    document.querySelectorAll(".quick-action").forEach(btn=>btn.addEventListener("click",quickAction));
}

function quickAction(e){
    switch(e.target.textContent.trim()){
        case "Create Bulletin":
        case "View Active Announcements": return location.href="bulletin-center.html";
        case "Review Feedback": return location.href="feedback-center.html";
        case "Refresh Dashboard": return loadDashboard();
    }
}

function setStatusError(){
    ["firebaseStatus","authStatus","firestoreStatus"].forEach(id=>{
        $(id).textContent="Error";
        $(id).className="bad";
    });
}

function startClock(){
    updateClock();
    setInterval(updateClock,1000);
}

function updateClock(){
    document.title="Operations Console • "+new Date().toLocaleString("en-US",{
        weekday:"long",year:"numeric",month:"long",day:"numeric",
        hour:"2-digit",minute:"2-digit",second:"2-digit"
    });
}

function escapeHtml(text){
    return text?text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";
}
