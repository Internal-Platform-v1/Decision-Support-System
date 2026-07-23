/*========== Analytics ==========*/

let db,auth,currentUser;
let guideChart,categoryChart,dailyChart,monthlyChart;
let usage=[],users=[];

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",async()=>{
    initFirebase();
    loadHeaderFooter();
    await authenticate();
    bindEvents();
    loadAnalytics();
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
    $("refreshBtn").onclick=loadAnalytics;
    $("exportBtn").onclick=exportReport;
}

/*========== Load Analytics ==========*/

async function loadAnalytics(){

    try{

        const usageSnap=await db.collection("guide_usage").get();
        const userSnap=await db.collection("approved_users").get();

        usage=usageSnap.docs.map(d=>({id:d.id,...d.data()}));
        users=userSnap.docs.map(d=>({id:d.id,...d.data()}));

        buildDashboard();

    }catch(err){

        console.error(err);

    }

}

/*========== Dashboard ==========*/

function buildDashboard(){

    const total=usage.length;
    const today=getToday();
    const unique=new Set();
    const guideMap={};
    const categoryMap={};
    const dailyMap={};
    const monthlyMap={};
    const userMap={};

    let todayCount=0;
    let searches=0;

    usage.forEach(x=>{

        if(x.email) unique.add(x.email);

        if(x.action==="search") searches++;

        if(formatDateKey(x.timestamp)===today) todayCount++;

        const guide=x.guide||"Unknown";
        guideMap[guide]=(guideMap[guide]||0)+1;

        const cat=x.category||"Other";
        categoryMap[cat]=(categoryMap[cat]||0)+1;

        const day=formatDateKey(x.timestamp);
        dailyMap[day]=(dailyMap[day]||0)+1;

        const month=formatMonthKey(x.timestamp);
        monthlyMap[month]=(monthlyMap[month]||0)+1;

        if(x.email){
            if(!userMap[x.email]) userMap[x.email]={email:x.email,count:0,department:x.department||"-"};
            userMap[x.email].count++;
        }

    });

    $("totalUsage").textContent=total.toLocaleString();
    $("todayUsage").textContent=todayCount.toLocaleString();
    $("uniqueUsers").textContent=unique.size.toLocaleString();
    $("searchCount").textContent=searches.toLocaleString();

    renderGuideTable(guideMap,userMap);
    drawGuideChart(guideMap);
    drawCategoryChart(categoryMap);
    drawDailyChart(dailyMap);
    drawMonthlyChart(monthlyMap);

}

/*========== Tables ==========*/

function renderGuideTable(guideMap,userMap){

    const guideRows=Object.entries(guideMap).sort((a,b)=>b[1]-a[1]).slice(0,10);

    $("guideTable").innerHTML=guideRows.map((g,i)=>`
        <tr>
            <td><div class="rank">${i+1}</div></td>
            <td>${escapeHtml(g[0])}</td>
            <td>${guessCategory(g[0])}</td>
            <td><span class="views">${g[1]}</span></td>
            <td>${countGuideUsers(g[0])}</td>
        </tr>
    `).join("");

    const activeUsers=Object.values(userMap).sort((a,b)=>b.count-a.count).slice(0,10);

    $("userTable").innerHTML=activeUsers.map(u=>`
        <tr>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.department)}</td>
            <td><span class="views">${u.count}</span></td>
        </tr>
    `).join("");

}

/*========== Charts ==========*/

function drawGuideChart(map){

    destroyChart(guideChart);

    const data=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);

    guideChart=new Chart($("guideChart"),{
        type:"bar",
        data:{labels:data.map(x=>x[0]),datasets:[{label:"Views",data:data.map(x=>x[1])}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
    });

}

function drawCategoryChart(map){

    destroyChart(categoryChart);

    categoryChart=new Chart($("categoryChart"),{
        type:"doughnut",
        data:{labels:Object.keys(map),datasets:[{data:Object.values(map)}]},
        options:{responsive:true,maintainAspectRatio:false}
    });

}

function drawDailyChart(map){

    destroyChart(dailyChart);

    const keys=Object.keys(map).sort();

    dailyChart=new Chart($("dailyChart"),{
        type:"line",
        data:{labels:keys,datasets:[{label:"Daily Usage",data:keys.map(k=>map[k]),fill:false}]},
        options:{responsive:true,maintainAspectRatio:false}
    });

}

function drawMonthlyChart(map){

    destroyChart(monthlyChart);

    const keys=Object.keys(map).sort();

    monthlyChart=new Chart($("monthlyChart"),{
        type:"bar",
        data:{labels:keys,datasets:[{label:"Monthly",data:keys.map(k=>map[k])}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
    });

}

function destroyChart(chart){
    if(chart) chart.destroy();
}

/*========== Export ==========*/

function exportReport(){

    const rows=[["Guide","Views"]];

    const guideMap={};

    usage.forEach(x=>{
        const g=x.guide||"Unknown";
        guideMap[g]=(guideMap[g]||0)+1;
    });

    Object.entries(guideMap).sort((a,b)=>b[1]-a[1]).forEach(x=>rows.push(x));

    const csv=rows.map(r=>r.join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);

    const a=document.createElement("a");
    a.href=url;
    a.download="analytics-report.csv";
    a.click();

    URL.revokeObjectURL(url);

}

/*========== Helpers ==========*/

function countGuideUsers(name){
    return new Set(usage.filter(x=>x.guide===name).map(x=>x.email)).size;
}

function guessCategory(name){
    const n=(name||"").toLowerCase();
    if(n.includes("billing")) return "Billing";
    if(n.includes("pricing")) return "Pricing";
    if(n.includes("fuel")) return "Fuel";
    if(n.includes("account")) return "Account";
    if(n.includes("paud")) return "PAUD";
    return "General";
}

function formatDateKey(ts){
    if(!ts?.toDate) return "";
    return ts.toDate().toISOString().split("T")[0];
}

function formatMonthKey(ts){
    if(!ts?.toDate) return "";
    const d=ts.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function getToday(){
    return new Date().toISOString().split("T")[0];
}

function escapeHtml(text){
    return text?text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";
}
