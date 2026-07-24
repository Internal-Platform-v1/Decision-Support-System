/*==================================================
ENTERPRISE BULLETIN CENTER
==================================================*/

const STATE={
  bulletins:[],
  filtered:[],
  selected:null,
  activeTab:"preview",
  activeFilter:"All",
  search:"",
  composeOpen:false
};

/*==================================================
SAMPLE DATA
==================================================*/

STATE.bulletins=[

{
  id:1,
  title:"Scheduled System Maintenance",
  category:"Maintenance",
  department:"IT Operations",
  priority:"Critical",
  status:"Published",
  published:"2 hours ago",
  views:482,
  unread:31,
  dismissed:18,
  readRate:94,
  attachments:2,
  message:`The Enterprise Bulletin Center will undergo scheduled maintenance tonight from 11:00 PM until 1:00 AM. During this maintenance window employees may experience temporary interruptions while infrastructure upgrades are completed.`,
  audience:["All Employees","IT Operations","Management"],
  files:[
    {name:"Maintenance Schedule.pdf",type:"pdf",size:"2.3 MB"},
    {name:"Server Checklist.xlsx",type:"excel",size:"842 KB"}
  ]
},

{
  id:2,
  title:"Fuel Guide Updated",
  category:"Guide Update",
  department:"Pricing",
  priority:"Normal",
  status:"Published",
  published:"Yesterday",
  views:185,
  unread:8,
  dismissed:4,
  readRate:89,
  attachments:0,
  message:`The Pricing Team has released the latest Fuel Guide with updated surcharge calculations and processing examples.`,
  audience:["Pricing","Customer Support"],
  files:[]
},

{
  id:3,
  title:"New Operations SOP",
  category:"Operations",
  department:"Operations",
  priority:"High",
  status:"Draft",
  published:"Today",
  views:28,
  unread:0,
  dismissed:0,
  readRate:0,
  attachments:1,
  message:`A revised Standard Operating Procedure has been prepared and is currently awaiting management approval before publication.`,
  audience:["Operations"],
  files:[
    {name:"Operations SOP.pdf",type:"pdf",size:"1.2 MB"}
  ]
}

];

STATE.filtered=[...STATE.bulletins];
STATE.selected=STATE.bulletins[0];

/*==================================================
ELEMENTS
==================================================*/

const $=selector=>document.querySelector(selector);
const $$=selector=>document.querySelectorAll(selector);

const feed=$("#feed");
const searchInput=$(".search-box input");
const filters=$$(".filter");
const tabs=$$(".tab");
const composeDrawer=$("#composeDrawer");
const backdrop=$(".drawer-backdrop");
const fab=$("#fabNewBulletin");
const newBtn=$(".primary-btn");
const closeDrawer=$(".drawer-close");

/*==================================================
START
==================================================*/

document.addEventListener("DOMContentLoaded",()=>{

  initialize();

});

function initialize(){

  bindEvents();

  renderKPIs();

  renderFeed();

  renderPreview(STATE.selected);

}

/*==================================================
HELPERS
==================================================*/

function numberFormat(value){
  return new Intl.NumberFormat().format(value);
}

function percentage(value){
  return `${value}%`;
}

function badgeClass(priority){

  switch(priority){

    case "Critical":
      return "critical";

    case "High":
      return "high";

    default:
      return "normal";

  }

}

/*==================================================
EVENTS
==================================================*/

function bindEvents(){

  /* Search */

  if(searchInput){
    searchInput.addEventListener("input",e=>{
      STATE.search=e.target.value.trim().toLowerCase();
      applyFilters();
    });
  }

  /* Filter Chips */

  filters.forEach(filter=>{

    filter.addEventListener("click",()=>{

      filters.forEach(btn=>btn.classList.remove("active"));
      filter.classList.add("active");

      STATE.activeFilter=filter.textContent.trim();

      applyFilters();

    });

  });

  /* Tabs */

  tabs.forEach(tab=>{

    tab.addEventListener("click",()=>{

      tabs.forEach(btn=>btn.classList.remove("active"));
      tab.classList.add("active");

      STATE.activeTab=tab.textContent.trim().toLowerCase();

    });

  });

  /* Compose Drawer */

  if(fab) fab.addEventListener("click",openCompose);
  if(newBtn) newBtn.addEventListener("click",openCompose);

  if(closeDrawer){
    closeDrawer.addEventListener("click",closeCompose);
  }

  if(backdrop){
    backdrop.addEventListener("click",closeCompose);
  }

}

/*==================================================
FILTERING
==================================================*/

function applyFilters(){

  const keyword=STATE.search;

  STATE.filtered=STATE.bulletins.filter(item=>{

    const searchMatch=
      item.title.toLowerCase().includes(keyword) ||
      item.department.toLowerCase().includes(keyword) ||
      item.category.toLowerCase().includes(keyword);

    let filterMatch=true;

    switch(STATE.activeFilter){

      case "Published":
        filterMatch=item.status==="Published";
        break;

      case "Draft":
        filterMatch=item.status==="Draft";
        break;

      case "Critical":
        filterMatch=item.priority==="Critical";
        break;

      case "Guide Updates":
        filterMatch=item.category==="Guide Update";
        break;

      case "Maintenance":
        filterMatch=item.category==="Maintenance";
        break;

      case "Security":
        filterMatch=item.category==="Security";
        break;

      default:
        filterMatch=true;

    }

    return searchMatch && filterMatch;

  });

  renderFeed();

}

/*==================================================
FEED
==================================================*/

function renderFeed(){

  if(!feed) return;

  feed.innerHTML="";

  if(!STATE.filtered.length){

    feed.innerHTML=`
      <div class="empty-feed">
        <i class="fa-regular fa-folder-open"></i>
        <h3>No Bulletins Found</h3>
        <p>Try another keyword or filter.</p>
      </div>
    `;

    return;

  }

  STATE.filtered.forEach(item=>{

    const card=document.createElement("article");

    card.className=`bulletin-card ${STATE.selected.id===item.id?"active":""}`;

    card.innerHTML=`

      <div class="card-accent ${badgeClass(item.priority)}"></div>

      <div class="card-body">

        <div class="card-top">

          <span class="status ${item.status.toLowerCase()}">
            ${item.status}
          </span>

          <span class="time">
            <i class="fa-regular fa-clock"></i>
            ${item.published}
          </span>

        </div>

        <h3>${item.title}</h3>

        <p>${item.message}</p>

        <div class="card-meta">

          <span>
            <i class="fa-solid fa-building"></i>
            ${item.department}
          </span>

          <span>
            <i class="fa-regular fa-eye"></i>
            ${numberFormat(item.views)}
          </span>

          <span>
            <i class="fa-solid fa-paperclip"></i>
            ${item.attachments}
          </span>

        </div>

      </div>

    `;

    card.addEventListener("click",()=>{

      STATE.selected=item;

      renderFeed();

      renderPreview(item);

    });

    feed.appendChild(card);

  });

}

/*==================================================
PREVIEW
==================================================*/

function renderPreview(item){

  const preview=$("#previewContent");
  if(!preview) return;

  preview.innerHTML=`

    <div class="preview-banner">

      <span class="priority ${badgeClass(item.priority).toLowerCase()}">
        ${item.priority.toUpperCase()}
      </span>

      <div class="preview-actions">

        <button title="Edit">
          <i class="fa-regular fa-pen-to-square"></i>
        </button>

        <button title="Duplicate">
          <i class="fa-regular fa-copy"></i>
        </button>

        <button title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>

      </div>

    </div>

    <div class="preview-title">

      <h2>${item.title}</h2>

      <div class="preview-info">

        <span>
          <i class="fa-solid fa-building"></i>
          ${item.department}
        </span>

        <span>
          <i class="fa-regular fa-clock"></i>
          ${item.published}
        </span>

        <span>
          <i class="fa-regular fa-eye"></i>
          ${numberFormat(item.views)} Views
        </span>

      </div>

    </div>

    <div class="preview-message">

      <p>${item.message}</p>

      <div class="info-box">

        <div class="info-icon">
          <i class="fa-solid fa-circle-info"></i>
        </div>

        <div>

          <h4>Important Notice</h4>

          <p>
            Please ensure that all affected employees are informed before the
            scheduled implementation.
          </p>

        </div>

      </div>

    </div>

    ${renderAttachments(item)}

    ${renderAudience(item)}

    ${renderStatistics(item)}

  `;

}

/*==================================================
ATTACHMENTS
==================================================*/

function renderAttachments(item){

  let html=`
    <div class="attachment-section">

      <div class="section-title">
        <h3>Attachments</h3>
      </div>
  `;

  if(item.files.length===0){

    html+=`
      <div class="attachment-card">

        <div class="file-icon">
          <i class="fa-regular fa-file"></i>
        </div>

        <div class="file-info">

          <h4>No Attachments</h4>

          <span>This bulletin has no attached files.</span>

        </div>

      </div>
    `;

  }else{

    item.files.forEach(file=>{

      html+=`

        <div class="attachment-card">

          <div class="file-icon ${file.type}">
            <i class="fa-solid fa-file-${file.type==="excel"?"excel":"pdf"}"></i>
          </div>

          <div class="file-info">

            <h4>${file.name}</h4>

            <span>${file.size}</span>

          </div>

          <button class="download-btn">
            <i class="fa-solid fa-download"></i>
          </button>

        </div>

      `;

    });

  }

  html+=`</div>`;

  return html;

}

/*==================================================
AUDIENCE
==================================================*/

function renderAudience(item){

  let html=`

    <div class="audience-section">

      <div class="section-title">
        <h3>Audience</h3>
      </div>

      <div class="audience-tags">

  `;

  item.audience.forEach(person=>{

    html+=`
      <span>${person}</span>
    `;

  });

  html+=`

      </div>

    </div>

  `;

  return html;

}

/*==================================================
STATISTICS
==================================================*/

function renderStatistics(item){

  return `

    <div class="stats-grid">

      <div class="stat-card">

        <span>Total Views</span>

        <h2>${numberFormat(item.views)}</h2>

        <small>
          <i class="fa-solid fa-chart-line"></i>
          Engagement
        </small>

      </div>

      <div class="stat-card">

        <span>Read Rate</span>

        <h2>${percentage(item.readRate)}</h2>

        <small>
          <i class="fa-solid fa-circle-check"></i>
          Employees
        </small>

      </div>

      <div class="stat-card">

        <span>Unread</span>

        <h2>${item.unread}</h2>

        <small>
          <i class="fa-regular fa-envelope"></i>
          Pending
        </small>

      </div>

      <div class="stat-card">

        <span>Dismissed</span>

        <h2>${item.dismissed}</h2>

        <small>
          <i class="fa-solid fa-xmark"></i>
          Hidden
        </small>

      </div>

    </div>

  `;

}

/*==================================================
KPI
==================================================*/

function renderKPIs(){

  const cards=$$(".kpi-card");
  if(cards.length<5) return;

  const total=STATE.bulletins.length;
  const published=STATE.bulletins.filter(x=>x.status==="Published").length;
  const drafts=STATE.bulletins.filter(x=>x.status==="Draft").length;
  const views=STATE.bulletins.reduce((t,x)=>t+x.views,0);
  const unread=STATE.bulletins.reduce((t,x)=>t+x.unread,0);

  cards[0].querySelector("h2").textContent=numberFormat(total);
  cards[1].querySelector("h2").textContent=numberFormat(published);
  cards[2].querySelector("h2").textContent=numberFormat(drafts);
  cards[3].querySelector("h2").textContent=numberFormat(views);
  cards[4].querySelector("h2").textContent=numberFormat(unread);

}

/*==================================================
COMPOSE DRAWER
==================================================*/

function openCompose(){

  STATE.composeOpen=true;

  composeDrawer.classList.add("open");
  backdrop.classList.add("show");

}

function closeCompose(){

  STATE.composeOpen=false;

  composeDrawer.classList.remove("open");
  backdrop.classList.remove("show");

}

/*==================================================
LOADING
==================================================*/

function showLoading(){

  const loading=$("#loadingOverlay");

  if(loading){
    loading.style.display="flex";
  }

}

function hideLoading(){

  const loading=$("#loadingOverlay");

  if(loading){
    loading.style.display="none";
  }

}

/*==================================================
TOAST
==================================================*/

function showToast(title,message,icon="fa-circle-check"){

  const container=$("#toastContainer");
  if(!container) return;

  const toast=document.createElement("div");

  toast.className="toast";

  toast.innerHTML=`
    <i class="fa-solid ${icon}"></i>

    <div>

      <h4>${title}</h4>

      <p>${message}</p>

    </div>
  `;

  container.appendChild(toast);

  setTimeout(()=>{

    toast.style.opacity="0";
    toast.style.transform="translateX(60px)";

    setTimeout(()=>toast.remove(),300);

  },3500);

}

/*==================================================
SIMULATED LOADING
==================================================*/

function simulateLoading(){

  showLoading();

  setTimeout(()=>{

    hideLoading();

    showToast(
      "Bulletins Loaded",
      "Latest enterprise announcements are now available."
    );

  },1200);

}

/*==================================================
REFRESH BUTTON
==================================================*/

const refreshBtn=document.querySelector(".ghost-btn");

if(refreshBtn){

  refreshBtn.addEventListener("click",()=>{

    simulateLoading();

  });

}

/*==================================================
PREVIEW ACTIONS
==================================================*/

document.addEventListener("click",e=>{

  const btn=e.target.closest(".preview-actions button");
  if(!btn) return;

  const icon=btn.querySelector("i");

  if(icon.classList.contains("fa-copy")){

    showToast(
      "Bulletin Duplicated",
      `"${STATE.selected.title}" copied successfully.`,
      "fa-copy"
    );

  }

  if(icon.classList.contains("fa-trash")){

    showToast(
      "Delete Disabled",
      "Delete functionality will be connected to Firestore.",
      "fa-trash"
    );

  }

  if(icon.classList.contains("fa-pen-to-square")){

    openCompose();

    showToast(
      "Edit Mode",
      "Editing bulletin information.",
      "fa-pen"
    );

  }

});

/*==================================================
COMPOSE FORM
==================================================*/

const composeForm=$("#composeForm");
const publishBtn=$("#publishBulletin");
const draftBtn=$("#saveDraft");
const resetBtn=$("#resetCompose");
const uploadArea=$("#uploadArea");
const fileInput=$("#fileInput");

let pendingFiles=[];

/*==================================================
INITIALIZE FORM
==================================================*/

if(composeForm){

  composeForm.addEventListener("submit",e=>{
    e.preventDefault();
  });

}

if(resetBtn){

  resetBtn.addEventListener("click",resetComposeForm);

}

if(draftBtn){

  draftBtn.addEventListener("click",saveDraft);

}

if(publishBtn){

  publishBtn.addEventListener("click",publishBulletin);

}

/*==================================================
PUBLISH
==================================================*/

function publishBulletin(){

  const bulletin=getComposeData();

  if(!bulletin){

    showToast(
      "Missing Information",
      "Please complete all required fields.",
      "fa-circle-exclamation"
    );

    return;

  }

  bulletin.id=Date.now();
  bulletin.status="Published";
  bulletin.published="Just now";

  STATE.bulletins.unshift(bulletin);

  renderKPIs();
  applyFilters();

  closeCompose();
  resetComposeForm();

  showToast(
    "Bulletin Published",
    `"${bulletin.title}" has been published successfully.`
  );

}

/*==================================================
SAVE DRAFT
==================================================*/

function saveDraft(){

  const bulletin=getComposeData();

  if(!bulletin){

    showToast(
      "Missing Information",
      "Please complete required fields.",
      "fa-circle-exclamation"
    );

    return;

  }

  bulletin.id=Date.now();
  bulletin.status="Draft";
  bulletin.published="Today";

  STATE.bulletins.unshift(bulletin);

  renderKPIs();
  applyFilters();

  closeCompose();
  resetComposeForm();

  showToast(
    "Draft Saved",
    `"${bulletin.title}" was saved as draft.`,
    "fa-floppy-disk"
  );

}

/*==================================================
FORM DATA
==================================================*/

function getComposeData(){

  const title=$("#composeTitle")?.value.trim();
  const message=$("#composeMessage")?.value.trim();
  const department=$("#composeDepartment")?.value;
  const category=$("#composeCategory")?.value;
  const priority=$("#composePriority")?.value;

  if(
    !title ||
    !message ||
    !department ||
    !category ||
    !priority
  ){
    return null;
  }

  return{

    title,
    message,
    department,
    category,
    priority,

    views:0,
    unread:0,
    dismissed:0,
    readRate:0,

    attachments:pendingFiles.length,

    audience:["All Employees"],

    files:pendingFiles.map(file=>({

      name:file.name,
      size:formatFileSize(file.size),
      type:getFileType(file.name)

    }))

  };

}

/*==================================================
RESET
==================================================*/

function resetComposeForm(){

  if(composeForm){

    composeForm.reset();

  }

  pendingFiles=[];

  const list=$("#uploadList");

  if(list){

    list.innerHTML="";

  }

}

/*==================================================
UPLOAD
==================================================*/

if(uploadArea && fileInput){

  uploadArea.addEventListener("click",()=>{

    fileInput.click();

  });

  fileInput.addEventListener("change",e=>{

    [...e.target.files].forEach(file=>{

      pendingFiles.push(file);

    });

    renderUploadFiles();

  });

}

/*==================================================
UPLOAD LIST
==================================================*/

function renderUploadFiles(){

  const list=$("#uploadList");

  if(!list) return;

  list.innerHTML="";

  pendingFiles.forEach((file,index)=>{

    const row=document.createElement("div");

    row.className="upload-item";

    row.innerHTML=`

      <div>

        <strong>${file.name}</strong>

        <small>${formatFileSize(file.size)}</small>

      </div>

      <button data-index="${index}">
        <i class="fa-solid fa-xmark"></i>
      </button>

    `;

    list.appendChild(row);

  });

}

document.addEventListener("click",e=>{

  const btn=e.target.closest(".upload-item button");

  if(!btn) return;

  pendingFiles.splice(btn.dataset.index,1);

  renderUploadFiles();

});

/*==================================================
KEYBOARD SHORTCUTS
==================================================*/

document.addEventListener("keydown",e=>{

  if(e.ctrlKey && e.key==="n"){

    e.preventDefault();

    openCompose();

  }

  if(e.key==="Escape"){

    closeCompose();

  }

});

/*==================================================
HELPERS
==================================================*/

function formatFileSize(bytes){

  if(bytes<1024){

    return bytes+" B";

  }

  if(bytes<1048576){

    return (bytes/1024).toFixed(1)+" KB";

  }

  return (bytes/1048576).toFixed(1)+" MB";

}

function getFileType(name){

  const ext=name.split(".").pop().toLowerCase();

  if(["xls","xlsx","csv"].includes(ext)){

    return "excel";

  }

  if(ext==="pdf"){

    return "pdf";

  }

  if(["png","jpg","jpeg","gif","webp"].includes(ext)){

    return "image";

  }

  if(["doc","docx"].includes(ext)){

    return "word";

  }

  return "file";

}

/*==================================================
LOCAL STORAGE
==================================================*/

const STORAGE_KEY="enterprise_bulletins";

function saveToStorage(){

  try{

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(STATE.bulletins)
    );

  }catch(error){

    console.warn("Unable to save bulletins.",error);

  }

}

function loadFromStorage(){

  try{

    const saved=localStorage.getItem(STORAGE_KEY);

    if(!saved) return;

    const data=JSON.parse(saved);

    if(Array.isArray(data) && data.length){

      STATE.bulletins=data;
      STATE.filtered=[...data];
      STATE.selected=data[0];

    }

  }catch(error){

    console.warn("Unable to load bulletins.",error);

  }

}

/*==================================================
AUTO SAVE
==================================================*/

function refreshApplication(){

  saveToStorage();

  renderKPIs();

  applyFilters();

  if(STATE.selected){

    const latest=STATE.bulletins.find(
      b=>b.id===STATE.selected.id
    );

    if(latest){

      STATE.selected=latest;

      renderPreview(latest);

    }

  }

}

/*==================================================
OVERRIDE PUBLISH
==================================================*/

const _publishBulletin=publishBulletin;

publishBulletin=function(){

  _publishBulletin();

  refreshApplication();

};

/*==================================================
OVERRIDE DRAFT
==================================================*/

const _saveDraft=saveDraft;

saveDraft=function(){

  _saveDraft();

  refreshApplication();

};

/*==================================================
AUTO REFRESH (Demo)
==================================================*/

let refreshTimer=null;

function startAutoRefresh(){

  stopAutoRefresh();

  refreshTimer=setInterval(()=>{

    renderKPIs();

  },60000);

}

function stopAutoRefresh(){

  if(refreshTimer){

    clearInterval(refreshTimer);

    refreshTimer=null;

  }

}

/*==================================================
THEME SUPPORT
==================================================*/

function applyTheme(theme){

  document.documentElement.setAttribute(
    "data-theme",
    theme
  );

  localStorage.setItem(
    "enterprise_theme",
    theme
  );

}

function initializeTheme(){

  const savedTheme=
    localStorage.getItem("enterprise_theme");

  if(savedTheme){

    applyTheme(savedTheme);

  }

}

/*==================================================
WINDOW EVENTS
==================================================*/

window.addEventListener("beforeunload",()=>{

  saveToStorage();

});

window.addEventListener("storage",e=>{

  if(e.key!==STORAGE_KEY) return;

  loadFromStorage();

  renderKPIs();

  renderFeed();

  if(STATE.selected){

    renderPreview(STATE.selected);

  }

});

/*==================================================
BOOTSTRAP
==================================================*/

document.addEventListener("DOMContentLoaded",()=>{

  loadFromStorage();

  initializeTheme();

  renderKPIs();

  renderFeed();

  if(STATE.selected){

    renderPreview(STATE.selected);

  }

  startAutoRefresh();

});

/*==================================================
PUBLIC API
==================================================*/

window.BulletinCenter={

  getState(){

    return STATE;

  },

  refresh(){

    refreshApplication();

  },

  save(){

    saveToStorage();

  },

  openCompose(){

    openCompose();

  },

  closeCompose(){

    closeCompose();

  }

};

/*==================================================
BULLETIN CATEGORY ACCORDION
==================================================*/

document.addEventListener("DOMContentLoaded",()=>{

const sections=[...document.querySelectorAll(".bulletin-section")];

sections.forEach((section,index)=>{

const list=section.querySelector(".mini-list");
const btn=section.querySelector(".view-all-btn");
const header=section.querySelector(".section-head");

if(index!==0){
list.style.display="none";
btn.style.display="none";
}

header.style.cursor="pointer";

header.addEventListener("click",()=>{

sections.forEach(s=>{

const l=s.querySelector(".mini-list");
const b=s.querySelector(".view-all-btn");

if(s===section){

const open=l.style.display!=="none";

if(open){
l.style.display="none";
b.style.display="none";
}else{
l.style.display="flex";
b.style.display="flex";
}

}else{

l.style.display="none";
b.style.display="none";

}

});

});

});

});

/*==================================================
SELECT BULLETIN
==================================================*/

document.querySelectorAll(".mini-item").forEach(item=>{

item.addEventListener("click",()=>{

document.querySelectorAll(".mini-item")
.forEach(i=>i.classList.remove("active"));

item.classList.add("active");

/*
Future Firebase code

loadBulletin(item.dataset.id);

*/

});

});

/*==================================================
VIEW ALL
==================================================*/

document.querySelectorAll(".view-all-btn").forEach(btn=>{

btn.addEventListener("click",()=>{

const category=btn.dataset.category;

/*
Future

openCategory(category)

*/

console.log("Category:",category);

});

});
