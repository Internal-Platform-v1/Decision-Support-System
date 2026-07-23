/*========== Template Manager ==========*/

let db,auth,currentUser,editingId=null;
let templates=[];

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",async()=>{
    initFirebase();
    loadHeaderFooter();
    await authenticate();
    bindEvents();
    loadTemplates();
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

    $("refreshBtn").onclick=loadTemplates;
    $("newTemplateBtn").onclick=()=>openModal();

    $("closeModal").onclick=closeModal;
    $("cancelTemplate").onclick=closeModal;
    $("saveTemplate").onclick=saveTemplate;

    $("searchTemplate").oninput=filterTemplates;
    $("filterGuide").onchange=filterTemplates;
    $("filterType").onchange=filterTemplates;

    window.onclick=e=>{
        if(e.target===$("templateModal")) closeModal();
    };

}

/*========== Load ==========*/

async function loadTemplates(){

    const body=$("templateTable");
    body.innerHTML="<tr><td colspan='7' class='loading'>Loading templates...</td></tr>";

    try{

        const snap=await db.collection("billing_dispute_general_template").orderBy("updatedAt","desc").get();

        templates=[];

        let comments=0,corr=0,emails=0;

        snap.forEach(doc=>{

            const t={id:doc.id,...doc.data()};
            templates.push(t);

            switch((t.type||"").toLowerCase()){
                case "comment":comments++;break;
                case "corr":corr++;break;
                case "email":emails++;break;
            }

        });

        $("totalTemplates").textContent=templates.length;
        $("commentTemplates").textContent=comments;
        $("corrTemplates").textContent=corr;
        $("emailTemplates").textContent=emails;

        renderTemplates(templates);

    }catch(err){

        console.error(err);

        body.innerHTML="<tr><td colspan='7' class='loading'>Unable to load templates.</td></tr>";

    }

}

/*========== Render ==========*/

function renderTemplates(list){

    const body=$("templateTable");

    if(!list.length){
        body.innerHTML="<tr><td colspan='7' class='loading'>No templates found.</td></tr>";
        return;
    }

    body.innerHTML=list.map(t=>`
        <tr>
            <td>${escapeHtml(t.recommendation||"-")}</td>
            <td>${escapeHtml(t.guide||"-")}</td>
            <td><span class="type ${(t.type||"").toLowerCase()}">${t.type||"-"}</span></td>
            <td><div class="preview">${escapeHtml((t.content||"").substring(0,150))}</div></td>
            <td>${escapeHtml(t.updatedBy||"-")}</td>
            <td>${formatDate(t.updatedAt)}</td>
            <td>
                <div class="actions">
                    <button class="btn-view" onclick="viewTemplate('${t.id}')">View</button>
                    <button class="btn-edit" onclick="editTemplate('${t.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteTemplate('${t.id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");

}

/*========== Search ==========*/

function filterTemplates(){

    const keyword=$("searchTemplate").value.toLowerCase();
    const guide=$("filterGuide").value;
    const type=$("filterType").value;

    renderTemplates(templates.filter(t=>{

        const matchKeyword=(t.recommendation||"").toLowerCase().includes(keyword)||(t.content||"").toLowerCase().includes(keyword);
        const matchGuide=!guide||t.guide===guide;
        const matchType=!type||t.type===type;

        return matchKeyword&&matchGuide&&matchType;

    }));

}

/*========== Modal ==========*/

function openModal(title="New Template"){

    editingId=null;

    document.querySelector(".modal-header h2").textContent=title;

    $("templateModal").classList.add("show");

}

function closeModal(){

    editingId=null;

    $("recommendation").value="";
    $("guide").selectedIndex=0;
    $("templateType").selectedIndex=0;
    $("templateContent").value="";

    $("templateModal").classList.remove("show");

}

/*========== Edit ==========*/

function editTemplate(id){

    const t=templates.find(x=>x.id===id);
    if(!t) return;

    editingId=id;

    $("recommendation").value=t.recommendation||"";
    $("guide").value=t.guide||"Billing Dispute";
    $("templateType").value=t.type||"Comment";
    $("templateContent").value=t.content||"";

    openModal("Edit Template");

}

/*========== Save ==========*/

async function saveTemplate(){

    const data={
        recommendation:$("recommendation").value.trim(),
        guide:$("guide").value,
        type:$("templateType").value,
        content:$("templateContent").value.trim(),
        updatedBy:currentUser.email,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    if(!data.recommendation) return alert("Recommendation is required.");
    if(!data.content) return alert("Template content is required.");

    try{

        if(editingId){

            await db.collection("billing_dispute_general_template").doc(editingId).update(data);

        }else{

            data.createdBy=currentUser.email;
            data.createdAt=firebase.firestore.FieldValue.serverTimestamp();

            await db.collection("billing_dispute_general_template").add(data);

        }

        closeModal();
        loadTemplates();

    }catch(err){

        console.error(err);
        alert("Unable to save template.");

    }

}

/*========== Delete ==========*/

async function deleteTemplate(id){

    if(!confirm("Delete this template?")) return;

    try{

        await db.collection("billing_dispute_general_template").doc(id).delete();
        loadTemplates();

    }catch(err){

        console.error(err);

    }

}

/*========== View ==========*/

function viewTemplate(id){

    const t=templates.find(x=>x.id===id);
    if(!t) return;

    alert(
`${t.recommendation}

Guide : ${t.guide}
Type  : ${t.type}

----------------------------------------

${t.content}`
    );

}

/*========== Helpers ==========*/

function formatDate(ts){
    return ts?.toDate ? ts.toDate().toLocaleString() : "-";
}

function escapeHtml(text){
    return text?text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";
}
