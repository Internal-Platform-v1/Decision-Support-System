/*========== Bulletin Center ==========*/

let db,auth,currentUser,editingId=null;
const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",async()=>{
    initFirebase();
    loadHeaderFooter();
    await authenticate();
    bindEvents();
    loadBulletins();
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
        auth.onAuthStateChanged(async user=>{
            if(!user) return location.href="index.html";
            currentUser=user;
            resolve();
        });
    });
}

/*========== Events ==========*/

function bindEvents(){

    $("newBulletinBtn").onclick=()=>openModal();

    $("closeModal").onclick=closeModal;
    $("cancelBulletin").onclick=closeModal;

    $("saveBulletin").onclick=saveBulletin;
    $("refreshBtn").onclick=loadBulletins;

    $("searchBulletin").addEventListener("input",filterTable);
    $("filterStatus").addEventListener("change",filterTable);
    $("filterPriority").addEventListener("change",filterTable);

    window.onclick=e=>{
        if(e.target===$("bulletinModal")) closeModal();
    };

}

/*========== Load Bulletins ==========*/

async function loadBulletins(){

    const body=$("bulletinTable");
    body.innerHTML="<tr><td colspan='7' class='loading'>Loading...</td></tr>";

    try{

        const snap=await db.collection("bulletins").orderBy("createdAt","desc").get();

        $("totalBulletins").textContent=snap.size;

        let published=0,draft=0,archived=0;
        let html="";

        snap.forEach(doc=>{

            const b=doc.data();

            if(b.status==="Published") published++;
            if(b.status==="Draft") draft++;
            if(b.status==="Archived") archived++;

            html+=`
            <tr data-id="${doc.id}">
                <td><span class="status ${b.status.toLowerCase()}">${b.status}</span></td>
                <td>${escapeHtml(b.title)}</td>
                <td>${b.priority}</td>
                <td>${escapeHtml(b.createdBy||"-")}</td>
                <td>${formatDate(b.createdAt)}</td>
                <td>${b.views||0}</td>
                <td>
                    <div class="actions">
                        <button class="btn-view" onclick="viewBulletin('${doc.id}')">View</button>
                        <button class="btn-edit" onclick="editBulletin('${doc.id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteBulletin('${doc.id}')">Delete</button>
                    </div>
                </td>
            </tr>`;
        });

        body.innerHTML=html||"<tr><td colspan='7' class='loading'>No bulletins found.</td></tr>";

        $("publishedBulletins").textContent=published;
        $("draftBulletins").textContent=draft;
        $("archivedBulletins").textContent=archived;

    }catch(err){
        console.error(err);
        body.innerHTML="<tr><td colspan='7' class='loading'>Unable to load bulletins.</td></tr>";
    }

}

/*========== Save ==========*/

async function saveBulletin(){

    const data={
        title:$("bulletinTitle").value.trim(),
        message:$("bulletinMessage").value.trim(),
        priority:$("bulletinPriority").value,
        status:$("bulletinStatus").value,
        popupAfterLogin:$("popupAfterLogin").checked,
        allowDismiss:$("allowDismiss").checked,
        showOnce:$("showOnce").checked,
        createdBy:currentUser.email,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        views:0
    };

    if(!data.title) return alert("Title is required.");
    if(!data.message) return alert("Message is required.");

    try{

        if(editingId){
            delete data.createdAt;
            delete data.createdBy;
            await db.collection("bulletins").doc(editingId).update(data);
        }else{
            await db.collection("bulletins").add(data);
        }

        closeModal();
        loadBulletins();

    }catch(err){
        console.error(err);
        alert("Unable to save bulletin.");
    }

}

/*========== Edit ==========*/

async function editBulletin(id){

    try{

        const doc=await db.collection("bulletins").doc(id).get();
        if(!doc.exists) return;

        const b=doc.data();

        editingId=id;

        $("bulletinTitle").value=b.title||"";
        $("bulletinMessage").value=b.message||"";
        $("bulletinPriority").value=b.priority||"Normal";
        $("bulletinStatus").value=b.status||"Published";

        $("popupAfterLogin").checked=!!b.popupAfterLogin;
        $("allowDismiss").checked=!!b.allowDismiss;
        $("showOnce").checked=!!b.showOnce;

        openModal("Edit Bulletin");

    }catch(err){
        console.error(err);
    }

}

/*========== Delete ==========*/

async function deleteBulletin(id){

    if(!confirm("Delete this bulletin?")) return;

    try{
        await db.collection("bulletins").doc(id).delete();
        loadBulletins();
    }catch(err){
        console.error(err);
    }

}

/*========== View ==========*/

async function viewBulletin(id){

    try{

        const doc=await db.collection("bulletins").doc(id).get();
        if(!doc.exists) return;

        const b=doc.data();

        alert(`${b.title}\n\n${b.message}`);

    }catch(err){
        console.error(err);
    }

}

/*========== Search ==========*/

function filterTable(){

    const keyword=$("searchBulletin").value.toLowerCase();
    const status=$("filterStatus").value;
    const priority=$("filterPriority").value;

    document.querySelectorAll("#bulletinTable tr").forEach(row=>{

        const text=row.innerText.toLowerCase();

        const showKeyword=text.includes(keyword);
        const showStatus=!status||text.includes(status.toLowerCase());
        const showPriority=!priority||text.includes(priority.toLowerCase());

        row.style.display=showKeyword&&showStatus&&showPriority?"":"none";

    });

}

/*========== Modal ==========*/

function openModal(title="Create Bulletin"){
    editingId=editingId||null;
    document.querySelector(".modal-header h2").textContent=title;
    $("bulletinModal").classList.add("show");
}

function closeModal(){

    editingId=null;

    $("bulletinTitle").value="";
    $("bulletinMessage").value="";
    $("bulletinPriority").value="Normal";
    $("bulletinStatus").value="Published";

    $("popupAfterLogin").checked=false;
    $("allowDismiss").checked=true;
    $("showOnce").checked=false;

    $("bulletinModal").classList.remove("show");

}

/*========== Helpers ==========*/

function formatDate(ts){
    if(!ts) return "-";
    return ts.toDate().toLocaleString();
}

function escapeHtml(text){
    return text?text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";
}
