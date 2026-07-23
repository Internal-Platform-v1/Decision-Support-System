/*========== AI Settings ==========*/

let db,auth,currentUser,settings={},logs=[];

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",async()=>{
    initFirebase();
    loadHeaderFooter();
    await authenticate();
    bindEvents();
    await loadSettings();
    loadLogs();
});

/*========== Initialize ==========*/

function initFirebase(){
    if(typeof firebase==="undefined") return console.error("Firebase not loaded.");
    auth=firebase.auth();
    db=firebase.firestore();
}

function loadHeaderFooter(){
    if(typeof loadHeader==="function") loadHeader();
    if(typeof loadFooter==="function") loadFooter();
}

async function authenticate(){
    return new Promise(resolve=>{
        auth.onAuthStateChanged(user=>{
            if(!user) return location.href="index.html";
            currentUser=user;
            resolve();
        });
    });
}

function bindEvents(){
    $("reloadBtn").onclick=async()=>{await loadSettings();loadLogs();};
    $("saveBtn").onclick=saveSettings;
}

/*========== Load Settings ==========*/

async function loadSettings(){

    try{

        const doc=await db.collection("system_settings").doc("ai").get();

        settings=doc.exists?doc.data():getDefaults();

        $("provider").value=settings.provider;
        $("model").value=settings.model;
        $("apiKey").value=settings.apiKey;
        $("temperature").value=settings.temperature;
        $("maxTokens").value=settings.maxTokens;

        $("guideRegistry").value=settings.guideRegistry;
        $("githubRepo").value=settings.githubRepo;
        $("branch").value=settings.branch;
        $("systemPrompt").value=settings.systemPrompt;

        $("enableHistory").checked=settings.enableHistory;
        $("enableTemplates").checked=settings.enableTemplates;
        $("enableGuides").checked=settings.enableGuides;
        $("enableComments").checked=settings.enableComments;
        $("enableEmails").checked=settings.enableEmails;
        $("enableCorr").checked=settings.enableCorr;
        $("topResults").value=settings.topResults;

        $("allowEmployees").checked=settings.allowEmployees;
        $("allowManagers").checked=settings.allowManagers;
        $("allowAdmins").checked=settings.allowAdmins;
        $("logPrompts").checked=settings.logPrompts;
        $("enableRateLimit").checked=settings.enableRateLimit;
        $("enableCache").checked=settings.enableCache;

    }catch(err){

        console.error(err);

    }

}

/*========== Save ==========*/

async function saveSettings(){

    const data={
        provider:$("provider").value,
        model:$("model").value.trim(),
        apiKey:$("apiKey").value.trim(),
        temperature:Number($("temperature").value),
        maxTokens:Number($("maxTokens").value),

        guideRegistry:$("guideRegistry").value.trim(),
        githubRepo:$("githubRepo").value.trim(),
        branch:$("branch").value.trim(),
        systemPrompt:$("systemPrompt").value.trim(),

        enableHistory:$("enableHistory").checked,
        enableTemplates:$("enableTemplates").checked,
        enableGuides:$("enableGuides").checked,
        enableComments:$("enableComments").checked,
        enableEmails:$("enableEmails").checked,
        enableCorr:$("enableCorr").checked,
        topResults:Number($("topResults").value),

        allowEmployees:$("allowEmployees").checked,
        allowManagers:$("allowManagers").checked,
        allowAdmins:$("allowAdmins").checked,
        logPrompts:$("logPrompts").checked,
        enableRateLimit:$("enableRateLimit").checked,
        enableCache:$("enableCache").checked,

        updatedBy:currentUser.email,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    try{

        await db.collection("system_settings").doc("ai").set(data,{merge:true});

        alert("AI settings saved.");

    }catch(err){

        console.error(err);
        alert("Unable to save AI settings.");

    }

}

/*========== Activity Log ==========*/

async function loadLogs(){

    try{

        const snap=await db.collection("operations_logs").where("type","==","ai").orderBy("createdAt","desc").limit(100).get();

        logs=snap.docs.map(d=>({id:d.id,...d.data()}));

        renderLogs();

    }catch(err){

        console.error(err);

        $("activityTable").innerHTML="<tr><td colspan='6' class='loading'>Unable to load logs.</td></tr>";

    }

}

function renderLogs(){

    if(!logs.length){
        $("activityTable").innerHTML="<tr><td colspan='6' class='loading'>No AI activity found.</td></tr>";
        return;
    }

    $("activityTable").innerHTML=logs.map(l=>`
        <tr>
            <td>${formatDate(l.createdAt)}</td>
            <td>${escapeHtml(l.user||l.email||"-")}</td>
            <td>${escapeHtml(l.provider||"-")}</td>
            <td>${escapeHtml(l.model||"-")}</td>
            <td>${truncate(l.prompt||"",140)}</td>
            <td>${Number(l.tokens||0).toLocaleString()}</td>
        </tr>
    `).join("");

}

/*========== Defaults ==========*/

function getDefaults(){

    return{
        provider:"groq",
        model:"llama-3.3-70b-versatile",
        apiKey:"",
        temperature:.2,
        maxTokens:4096,

        guideRegistry:"guide-registry.js",
        githubRepo:"",
        branch:"main",
        systemPrompt:"",

        enableHistory:true,
        enableTemplates:true,
        enableGuides:true,
        enableComments:true,
        enableEmails:true,
        enableCorr:true,
        topResults:8,

        allowEmployees:true,
        allowManagers:true,
        allowAdmins:true,
        logPrompts:true,
        enableRateLimit:true,
        enableCache:true
    };

}

/*========== Helpers ==========*/

function truncate(v,n){
    return escapeHtml(v.length>n?v.substring(0,n)+"...":v);
}

function formatDate(ts){
    return ts?.toDate?ts.toDate().toLocaleString():"-";
}

function escapeHtml(text){
    return text?text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";
}
