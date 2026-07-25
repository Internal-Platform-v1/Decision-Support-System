(() => {

const root = document.getElementById("enterpriseSpotlight");

if (!root) return;

/* ==========================================================
   CONFIG
========================================================== */

const AUTO_TIME = 5000;

let timer = null;
let progressTimer = null;
let progress = 0;
let current = 0;
let paused = false;

/* ==========================================================
   SAMPLE DATA
   Firestore will replace this later.
========================================================== */

let bulletins = [];
/* ==========================================================
   FIRESTORE
========================================================== */

const db = firebase.firestore();

const BULLETIN_COLLECTION = "enterprise_bulletins";

/* ==========================================================
   GREETING
========================================================== */

function getGreeting(){

    const hour = new Date().getHours();

    if(hour < 12){

        return "☀ Good Morning";

    }

    if(hour < 18){

        return "🌤 Good Afternoon";

    }

    return "🌙 Good Evening";

}

    /* ==========================================================
   LOAD BULLETINS
========================================================== */

function loadBulletins(){

    db.collection(BULLETIN_COLLECTION)

    .where("status","==","published")

    .orderBy("publishedAt","desc")

    .onSnapshot(snapshot=>{

        bulletins=[];

        snapshot.forEach(doc=>{

            bulletins.push({

                id:doc.id,

                ...doc.data()

            });

        });

        prioritize();

        if(current>=bulletins.length){

            current=0;

        }

        if(bulletins.length){

            render();

        }

    });

}

    /* ==========================================================
   PRIORITY SORT
========================================================== */

function prioritize(){

    const weight={

        critical:1,

        high:2,

        normal:3,

        low:4

    };

    bulletins.sort((a,b)=>{

        const pa=weight[a.priority]||99;
        const pb=weight[b.priority]||99;

        if(pa!==pb){

            return pa-pb;

        }

        const da=a.publishedAt?.seconds||0;
        const db=b.publishedAt?.seconds||0;

        return db-da;

    });

}

    /* ==========================================================
   DATE FORMAT
========================================================== */

function formatDate(timestamp){

    if(!timestamp) return "";

    const date=timestamp.toDate();

    return date.toLocaleString([],{

        month:"short",

        day:"numeric",

        year:"numeric",

        hour:"numeric",

        minute:"2-digit"

    });

}

    function getCategoryIcon(category){

    switch((category || "").toLowerCase()){

        case "announcement":
            return "fa-solid fa-bullhorn";

        case "guide update":
            return "fa-solid fa-book-open";

        case "maintenance":
            return "fa-solid fa-server";

        case "critical":
            return "fa-solid fa-triangle-exclamation";

        case "system":
            return "fa-solid fa-gears";

        default:
            return "fa-regular fa-newspaper";

    }

}

function formatCategory(category){

    if(!category) return "Announcement";

    return category
        .replace(/_/g," ")
        .replace(/\b\w/g,m=>m.toUpperCase());

}
    /* ==========================================================
   RECENT
========================================================== */

function isRecent(timestamp){

    if(!timestamp) return false;

    const published = timestamp.toDate();

    const now = new Date();

    const diff =

        (now-published)/(1000*60*60*24);

    return diff <= 3;

}
/* ==========================================================
   RENDER
========================================================== */

function render(){

    if(!bulletins.length){

    root.innerHTML=`

    <div class="spotlight-card">

        <div class="spotlight-empty">

            <i class="fa-regular fa-newspaper"></i>

            <h3>No Enterprise Bulletins</h3>

            <p>

                You're all caught up.

            </p>

        </div>

    </div>

    `;

    return;

}

const b=bulletins[current];
const isNew = isRecent(b.publishedAt);    

    root.innerHTML = `

<div class="spotlight-card slide-in">

    <div class="spotlight-progress">

        <div
            class="spotlight-progress-fill"
            id="spotProgress">
        </div>

    </div>

    <div class="spotlight-header">

        <div>

            <div class="spotlight-greeting">

                ${getGreeting()}

            </div>

            <div class="spotlight-subtitle">

                Latest Updates

            </div>

        </div>

        <div class="spotlight-count">

            ${current+1} / ${bulletins.length}

        </div>

    </div>

    <div class="spotlight-content">

        <div class="spotlight-badge ${b.category || "announcement"}">

            <i class="${getCategoryIcon(b.category)}"></i>

            ${b.category || "Announcement"}

        </div>

        <h2>

    ${b.title || ""}

    ${isNew ? '<span class="spot-new">NEW</span>' : ''}

</h2>

        <p>${b.summary || b.message || ""}</p>

    </div>

    <div class="spotlight-bottom">

        <div class="spotlight-published">

            <i class="fa-regular fa-clock"></i>

            ${formatDate(b.publishedAt)}

        </div>

        <div class="spotlight-dots">

            ${renderDots()}

        </div>

    </div>

</div>

`;

bindEvents();

startProgress();

}

 /* ==========================================================
   DOTS
========================================================== */

function renderDots(){

    return bulletins.map((item,index)=>{

        return `
            <span
                class="${index===current?'active':''}"
                data-index="${index}">
            </span>
        `;

    }).join("");

}


/* ==========================================================
   NEXT
========================================================== */

function nextSlide(){

    cancelAnimationFrame(progressTimer);

    current++;

    if(current>=bulletins.length){

        current=0;

    }

    render();

}


/* ==========================================================
   PREVIOUS
========================================================== */

function previousSlide(){

    cancelAnimationFrame(progressTimer);

    current--;

    if(current<0){

        current=bulletins.length-1;

    }

    render();

}


/* ==========================================================
   GO TO
========================================================== */

function goToSlide(index){

    cancelAnimationFrame(progressTimer);

    current=index;

    render();

}


/* ==========================================================
   EVENTS
========================================================== */

function bindEvents(){

    const card=document.querySelector(".spotlight-card");

    if(!card) return;

    /* Entire card clickable */

    card.addEventListener("click",()=>{

        openBulletin();

    });


    /* Pause while hovering */

card.addEventListener("mouseenter",()=>{

    paused=true;

});

card.addEventListener("mouseleave",()=>{

    paused=false;

});


    /* Dot Navigation */

    document
        .querySelectorAll(".spotlight-dots span")
        .forEach(dot=>{

            dot.onclick=(e)=>{

                e.stopPropagation();

                goToSlide(
                    Number(dot.dataset.index)
                );

            };

        });

}


/* ==========================================================
   KEYBOARD
========================================================== */

document.addEventListener("keydown",(e)=>{

    switch(e.key){

        case "ArrowRight":

            nextSlide();

            break;

        case "ArrowLeft":

            previousSlide();

            break;

    }

});

/* ==========================================================
   STORY PROGRESS
========================================================== */

function startProgress(){

    cancelAnimationFrame(progressTimer);

    progress = 0;

    const bar = document.getElementById("spotProgress");

    if(!bar) return;

    let last = performance.now();

    function animate(now){

        if(paused){

            last = now;

            progressTimer = requestAnimationFrame(animate);

            return;

        }

        const delta = now - last;

        last = now;

        progress += delta / AUTO_TIME * 100;

        if(progress > 100){

            progress = 100;

        }

        bar.style.width = progress + "%";

        if(progress >= 100){

            nextSlide();

            return;

        }

        progressTimer = requestAnimationFrame(animate);

    }

    progressTimer = requestAnimationFrame(animate);

}
    /* ==========================================================
   STOP
========================================================== */

function stopProgress(){

    cancelAnimationFrame(progressTimer);

}

/* ==========================================================
   BULLETIN MODAL
========================================================== */

function openBulletin(){

    const bulletin = bulletins[current];

increaseViews(bulletin.id);

    closeBulletin();

    const modal = document.createElement("div");

    modal.className = "bulletin-overlay";

    modal.innerHTML = `

<div class="bulletin-modal">

    <button class="bulletin-close">

        <i class="fa-solid fa-xmark"></i>

    </button>

    <div class="bulletin-top">

       <div class="spotlight-badge ${bulletin.category || "announcement"}">

            <i class="${getCategoryIcon(bulletin.category)}"></i>

            ${formatCategory(bulletin.category)}

        </div>

        <div class="bulletin-date">

            <i class="fa-regular fa-clock"></i>

            ${formatDate(bulletin.publishedAt)}

        </div>

    </div>

    <h2>

        ${bulletin.title}

    </h2>

<div class="bulletin-body">

    ${bulletin.message || bulletin.summary || ""}

</div>

${renderAttachments(bulletin)}

${renderGuideButton(bulletin)}

    <div class="bulletin-footer">

        Click anywhere outside this window to close.

    </div>

</div>

`;

    document.body.appendChild(modal);

    requestAnimationFrame(()=>{

        modal.classList.add("show");

    });

    modal.addEventListener("click",(e)=>{

        if(e.target===modal){

            closeBulletin();

        }

    });

    modal
        .querySelector(".bulletin-close")
        .onclick=closeBulletin;

}
    /* ==========================================================
   CLOSE MODAL
========================================================== */

function closeBulletin(){

    const modal=document.querySelector(".bulletin-overlay");

    if(!modal) return;

    modal.classList.remove("show");

    setTimeout(()=>{

        modal.remove();

    },250);

}

    /* ==========================================================
   VIEW COUNTER
========================================================== */

function increaseViews(id){

    db.collection(BULLETIN_COLLECTION)
      .doc(id)
      .update({

          views:firebase.firestore.FieldValue.increment(1)

      })
      .catch(()=>{});

}


/* ==========================================================
   ATTACHMENTS
========================================================== */

function renderAttachments(bulletin){

    if(
        !bulletin.attachments ||
        !bulletin.attachments.length
    ){

        return "";

    }

    return `

<div class="bulletin-attachments">

    <h4>

        <i class="fa-solid fa-paperclip"></i>

        Attachments

    </h4>

    ${bulletin.attachments.map(file=>`

        <a
            href="${file.url}"
            target="_blank">

            <i class="fa-solid fa-file"></i>

            ${file.name}

        </a>

    `).join("")}

</div>

`;

}


/* ==========================================================
   GUIDE BUTTON
========================================================== */

function renderGuideButton(bulletin){

    if(!bulletin.guideUrl){

        return "";

    }

    return `

<div class="bulletin-guide">

    <a
        href="${bulletin.guideUrl}"
        class="spotlight-guide-btn">

        <i class="fa-solid fa-book-open"></i>

        Open Guide

    </a>

</div>

`;

}

    /* ==========================================================
   ESC CLOSE
========================================================== */

document.addEventListener("keydown",(e)=>{

    if(e.key==="Escape"){

        closeBulletin();

    }

});

loadBulletins();
});
