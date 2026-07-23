/*========== Feedback Center ==========*/

let db,auth,currentUser,feedback=[],editingId=null;

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",async()=>{
    initFirebase();
    loadHeaderFooter();
    await authenticate();
    bindEvents();
    loadFeedback();
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

/*========== Events ==========*/

function bindEvents(){
    $("refreshBtn").onclick=loadFeedback;
    $("exportBtn").onclick=exportFeedback;
    $("searchFeedback").oninput=filterFeedback;
    $("statusFilter").onchange=filterFeedback;
    $("typeFilter").onchange=filterFeedback;
    $("closeModal").onclick=closeModal;
    $("cancelBtn").onclick=closeModal;
    $("saveBtn").onclick=saveFeedback;
    window.onclick=e=>{if(e.target===$("feedbackModal")) closeModal();};
}

/*========== Load ==========*/

async function loadFeedback(){

    $("feedbackTable").innerHTML="<tr><td colspan='7' class='loading'>Loading feedback...</td></tr>";

    try{

        const snap=await db.collection("feedback").orderBy("submittedAt","desc").get();

        feedback=snap.docs.map(d=>({id:d.id,...d.data()}));

        let open=0,progress=0,resolved=0;

        feedback.forEach(f=>{
            switch((f.status||"Open").toLowerCase()){
                case"open":open++;break;
                case"in progress":progress++;break;
                case"resolved":resolved++;break;
            }
        });

        $("totalFeedback").textContent=feedback.length;
        $("openFeedback").textContent=open;
        $("progressFeedback").textContent=progress;
        $("resolvedFeedback").textContent=resolved;

        renderFeedback(feedback);

    }catch(err){

        console.error(err);

        $("feedbackTable").innerHTML="<tr><td colspan='7' class='loading'>Unable to load feedback.</td></tr>";

    }

}

/*========== Render ==========*/

function renderFeedback(list){

    if(!list.length){
        $("feedbackTable").innerHTML="<tr><td colspan='7' class='loading'>No feedback found.</td></tr>";
        return;
    }

    $("feedbackTable").innerHTML=list.map(f=>`
        <tr>
            <td>${escapeHtml(f.name||f.email||"-")}</td>
            <td><span class="badge-type ${typeClass(f.type)}">${f.type||"Other"}</span></td>
            <td>${escapeHtml(f.subject||"-")}</td>
            <td><span class="badge-priority ${priorityClass(f.priority)}">${f.priority||"Medium"}</span></td>
            <td><span class="badge-status ${statusClass(f.status)}">${f.status||"Open"}</span></td>
            <td>${formatDate(f.submittedAt)}</td>
            <td>
                <div class="actions">
                    <button class="btn-view" onclick="viewFeedback('${f.id}')">View</button>
                    <button class="btn-save" onclick="editFeedback('${f.id}')">Update</button>
                    <button class="btn-delete" onclick="deleteFeedback('${f.id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");

}

/*========== Filter ==========*/

function filterFeedback(){

    const keyword=$("searchFeedback").value.toLowerCase();
    const status=$("statusFilter").value;
    const type=$("typeFilter").value;

    renderFeedback(feedback.filter(f=>{

        const matchKeyword=(f.subject||"").toLowerCase().includes(keyword)||(f.message||"").toLowerCase().includes(keyword)||(f.name||"").toLowerCase().includes(keyword);
        const matchStatus=!status||(f.status||"Open")===status;
        const matchType=!type||(f.type||"Other")===type;

        return matchKeyword&&matchStatus&&matchType;

    }));

}

/*========== View/Edit ==========*/

function viewFeedback(id){

    const f=feedback.find(x=>x.id===id);
    if(!f) return;

    editingId=id;

    $("feedbackUser").value=f.name||f.email||"";
    $("feedbackType").value=f.type||"";
    $("feedbackPriority").value=f.priority||"Medium";
    $("feedbackStatus").value=f.status||"Open";
    $("feedbackSubject").value=f.subject||"";
    $("feedbackMessage").value=f.message||"";
    $("feedbackNotes").value=f.notes||"";

    $("feedbackModal").classList.add("show");

}

function editFeedback(id){
    viewFeedback(id);
}

function closeModal(){
    editingId=null;
    $("feedbackModal").classList.remove("show");
}

/*========== Save ==========*/

async function saveFeedback(){

    if(!editingId) return;

    try{

        await db.collection("feedback").doc(editingId).update({
            status:$("feedbackStatus").value,
            priority:$("feedbackPriority").value,
            notes:$("feedbackNotes").value.trim(),
            updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy:currentUser.email
        });

        closeModal();
        loadFeedback();

    }catch(err){

        console.error(err);
        alert("Unable to update feedback.");

    }

}

/*========== Delete ==========*/

async function deleteFeedback(id){

    if(!confirm("Delete this feedback?")) return;

    try{

        await db.collection("feedback").doc(id).delete();
        loadFeedback();

    }catch(err){

        console.error(err);

    }

}

/*========== Export ==========*/

function exportFeedback(){

    const rows=[["Name","Email","Type","Subject","Priority","Status","Submitted"]];

    feedback.forEach(f=>{
        rows.push([
            csv(f.name),
            csv(f.email),
            csv(f.type),
            csv(f.subject),
            csv(f.priority),
            csv(f.status),
            formatDate(f.submittedAt)
        ]);
    });

    const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="feedback.csv";
    a.click();
    URL.revokeObjectURL(url);

}

/*========== Helpers ==========*/

function formatDate(ts){
    return ts?.toDate?ts.toDate().toLocaleString():"-";
}

function typeClass(v){
    switch((v||"").toLowerCase()){
        case"bug":return"type-bug";
        case"suggestion":return"type-suggestion";
        case"feature request":return"type-feature";
        case"ai feedback":return"type-ai";
        default:return"type-other";
    }
}

function statusClass(v){
    switch((v||"").toLowerCase()){
        case"open":return"status-open";
        case"in progress":return"status-progress";
        case"resolved":return"status-resolved";
        default:return"status-closed";
    }
}

function priorityClass(v){
    switch((v||"").toLowerCase()){
        case"low":return"priority-low";
        case"medium":return"priority-medium";
        case"high":return"priority-high";
        default:return"priority-critical";
    }
}

function csv(v){
    return `"${String(v||"").replace(/"/g,'""')}"`;
}

function escapeHtml(text){
    return text?text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";
}
