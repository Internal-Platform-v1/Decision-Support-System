/*========== User Management ==========*/

let db,auth,currentUser,editingId=null;
let users=[];

const $=id=>document.getElementById(id);

document.addEventListener("DOMContentLoaded",async()=>{
    initFirebase();
    loadHeaderFooter();
    await authenticate();
    bindEvents();
    loadUsers();
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

    $("refreshBtn").onclick=loadUsers;
    $("addUserBtn").onclick=()=>openModal();

    $("closeModal").onclick=closeModal;
    $("cancelUser").onclick=closeModal;
    $("saveUser").onclick=saveUser;

    $("searchUser").oninput=filterUsers;
    $("filterRole").onchange=filterUsers;
    $("filterStatus").onchange=filterUsers;

    window.onclick=e=>{
        if(e.target===$("userModal")) closeModal();
    };

}

/*========== Load Users ==========*/

async function loadUsers(){

    const body=$("userTable");
    body.innerHTML="<tr><td colspan='7' class='loading'>Loading users...</td></tr>";

    try{

        const snap=await db.collection("approved_users").orderBy("name").get();

        users=[];

        let active=0,inactive=0,ops=0;

        snap.forEach(doc=>{

            const u={id:doc.id,...doc.data()};
            users.push(u);

            if(u.active) active++;
            else inactive++;

            if(u.operationsConsole) ops++;

        });

        $("totalUsers").textContent=users.length;
        $("activeUsers").textContent=active;
        $("inactiveUsers").textContent=inactive;
        $("opsAdmins").textContent=ops;

        renderUsers(users);

    }catch(err){

        console.error(err);

        body.innerHTML="<tr><td colspan='7' class='loading'>Unable to load users.</td></tr>";

    }

}

/*========== Render ==========*/

function renderUsers(list){

    const body=$("userTable");

    if(!list.length){
        body.innerHTML="<tr><td colspan='7' class='loading'>No users found.</td></tr>";
        return;
    }

    body.innerHTML=list.map(user=>`
        <tr>
            <td>${escapeHtml(user.name||"-")}</td>
            <td>${escapeHtml(user.email||"-")}</td>

            <td>
                <span class="role ${(user.role||"User").toLowerCase()}">
                    ${user.role||"User"}
                </span>
            </td>

            <td>
                <span class="status ${user.active?"active":"inactive"}">
                    ${user.active?"Active":"Inactive"}
                </span>
            </td>

            <td>
                <span class="ops ${user.operationsConsole?"yes":"no"}">
                    ${user.operationsConsole?"Enabled":"Disabled"}
                </span>
            </td>

            <td>${user.lastLogin||"-"}</td>

            <td>
                <div class="actions">
                    <button class="btn-edit" onclick="editUser('${user.id}')">Edit</button>
                    <button class="btn-access" onclick="toggleAccess('${user.id}')">${user.operationsConsole?"Disable":"Enable"}</button>
                    <button class="btn-delete" onclick="deleteUser('${user.id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");

}

/*========== Search ==========*/

function filterUsers(){

    const keyword=$("searchUser").value.toLowerCase();
    const role=$("filterRole").value;
    const status=$("filterStatus").value;

    const filtered=users.filter(u=>{

        const matchKeyword=
            (u.name||"").toLowerCase().includes(keyword) ||
            (u.email||"").toLowerCase().includes(keyword);

        const matchRole=!role || (u.role||"")==role;

        const matchStatus=
            !status ||
            (status==="Active" && u.active) ||
            (status==="Inactive" && !u.active);

        return matchKeyword && matchRole && matchStatus;

    });

    renderUsers(filtered);

}

/*========== Edit ==========*/

function openModal(title="Add User"){

    editingId=null;

    document.querySelector(".modal-header h2").textContent=title;

    $("userModal").classList.add("show");

}

function closeModal(){

    editingId=null;

    $("userName").value="";
    $("userEmail").value="";
    $("userRole").value="User";

    $("userActive").checked=true;
    $("operationsConsole").checked=false;

    $("userModal").classList.remove("show");

}

async function editUser(id){

    const user=users.find(u=>u.id===id);

    if(!user) return;

    editingId=id;

    $("userName").value=user.name||"";
    $("userEmail").value=user.email||"";
    $("userRole").value=user.role||"User";

    $("userActive").checked=!!user.active;
    $("operationsConsole").checked=!!user.operationsConsole;

    document.querySelector(".modal-header h2").textContent="Edit User";

    $("userModal").classList.add("show");

}

/*========== Save ==========*/

async function saveUser(){

    const data={
        name:$("userName").value.trim(),
        email:$("userEmail").value.trim().toLowerCase(),
        role:$("userRole").value,
        active:$("userActive").checked,
        operationsConsole:$("operationsConsole").checked,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    if(!data.name) return alert("Name is required.");
    if(!data.email) return alert("Email is required.");

    try{

        if(editingId){

            await db.collection("approved_users").doc(editingId).update(data);

        }else{

            data.createdAt=firebase.firestore.FieldValue.serverTimestamp();

            await db.collection("approved_users").doc(data.email).set(data);

        }

        closeModal();
        loadUsers();

    }catch(err){

        console.error(err);
        alert("Unable to save user.");

    }

}

/*========== Operations Access ==========*/

async function toggleAccess(id){

    const user=users.find(u=>u.id===id);
    if(!user) return;

    try{

        await db.collection("approved_users").doc(id).update({
            operationsConsole:!user.operationsConsole
        });

        loadUsers();

    }catch(err){

        console.error(err);

    }

}

/*========== Delete ==========*/

async function deleteUser(id){

    const user=users.find(u=>u.id===id);
    if(!user) return;

    if(!confirm(`Delete ${user.name}?`)) return;

    try{

        await db.collection("approved_users").doc(id).delete();

        loadUsers();

    }catch(err){

        console.error(err);
        alert("Unable to delete user.");

    }

}

/*========== Helpers ==========*/

function escapeHtml(text){
    return text?text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):"";
}
