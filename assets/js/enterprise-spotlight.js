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

function loadBulletins() {

    db.collection(BULLETIN_COLLECTION)
        .where("status", "==", "published")
        .orderBy("publishedAt", "desc")
        .onSnapshot(

            (snapshot) => {

                bulletins = [];

                snapshot.forEach((doc) => {

                    bulletins.push({
                        id: doc.id,
                        ...doc.data()
                    });

                });

                prioritize();

                if (current >= bulletins.length) {
                    current = 0;
                }

                render();

            },

            (error) => {

                console.error("Enterprise Spotlight:", error);

                bulletins = [];

                root.innerHTML = `
                    <div class="spotlight-card">
                        <div class="spotlight-empty">
                            <i class="fa-solid fa-circle-exclamation"></i>
                            <h3>Unable to load Enterprise Bulletins</h3>
                            <p>Please try again later.</p>
                        </div>
                    </div>
                `;

            }

        );

}
    /* ==========================================================
   PRIORITY SORT
========================================================== */

function prioritize() {

    const priorityWeight = {
        critical: 1,
        high: 2,
        normal: 3,
        low: 4
    };

    bulletins.sort((a, b) => {

        const pa = priorityWeight[(a.priority || "").toLowerCase()] ?? 99;
        const pb = priorityWeight[(b.priority || "").toLowerCase()] ?? 99;

        if (pa !== pb) {
            return pa - pb;
        }

        const da = a.publishedAt?.seconds || 0;
        const db = b.publishedAt?.seconds || 0;

        return db - da;

    });

}

    /* ==========================================================
   DATE FORMAT
========================================================== */

function formatDate(timestamp) {

    if (!timestamp) {
        return "";
    }

    try {

        const date = typeof timestamp.toDate === "function"
            ? timestamp.toDate()
            : new Date(timestamp);

        if (isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });

    } catch (err) {

        console.error("Error formatting bulletin date:", err);
        return "";

    }

}

function getCategoryIcon(category) {

    const value = (category || "").trim().toLowerCase();

    switch (value) {

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

        case "training":
            return "fa-solid fa-graduation-cap";

        case "policy":
            return "fa-solid fa-scale-balanced";

        case "security":
            return "fa-solid fa-shield-halved";

        case "event":
            return "fa-solid fa-calendar-days";

        default:
            return "fa-regular fa-newspaper";

    }

}

function formatCategory(category) {

    if (!category) {
        return "Announcement";
    }

    return String(category)
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, letter => letter.toUpperCase());

}
    /* ==========================================================
   RECENT
========================================================== */

function isRecent(timestamp) {

    if (!timestamp) {
        return false;
    }

    try {

        const published = typeof timestamp.toDate === "function"
            ? timestamp.toDate()
            : new Date(timestamp);

        if (isNaN(published.getTime())) {
            return false;
        }

        const now = new Date();
        const diffDays = (now - published) / (1000 * 60 * 60 * 24);

        return diffDays >= 0 && diffDays <= 3;

    } catch (err) {

        console.error("Error checking recent bulletin:", err);
        return false;

    }

}
/* ==========================================================
   RENDER
========================================================== */

function render() {

    stopProgress();

    if (!bulletins.length) {

        root.innerHTML = `
            <div class="spotlight-card">

                <div class="spotlight-empty">

                    <i class="fa-regular fa-newspaper"></i>

                    <h3>No Enterprise Bulletins</h3>

                    <p>You're all caught up.</p>

                </div>

            </div>
        `;

        return;

    }

    if (current < 0) {
        current = 0;
    }

    if (current >= bulletins.length) {
        current = 0;
    }

    const b = bulletins[current];

    const isNew = isRecent(b.publishedAt);

    const badgeClass = (b.category || "announcement")
        .toLowerCase()
        .replace(/\s+/g, "-");

    const title = b.title || "";

    const summary = b.summary || b.message || "";

    const publishedDate = formatDate(b.publishedAt);

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
                    ${current + 1} / ${bulletins.length}
                </div>

            </div>

            <div class="spotlight-content">

                <div class="spotlight-badge ${badgeClass}">

                    <i class="${getCategoryIcon(b.category)}"></i>

                    ${formatCategory(b.category)}

                </div>

                <h2>

                    ${title}

                    ${isNew
                        ? '<span class="spot-new">NEW</span>'
                        : ''}

                </h2>

                <p>${summary}</p>

            </div>

            <div class="spotlight-bottom">

                <div class="spotlight-published">

                    <i class="fa-regular fa-clock"></i>

                    ${publishedDate}

                </div>

                <div class="spotlight-dots">

                    ${renderDots()}

                </div>

            </div>

        </div>

    `;
    bindEvents();

    if (bulletins.length > 1) {
        startProgress();
    } else {
        stopProgress();
    }

}

 /* ==========================================================
   DOTS
========================================================== */

function renderDots() {

    if (!bulletins.length) {
        return "";
    }

    return bulletins
        .map((bulletin, index) => {

            const active = index === current;

            return `
                <span
                    class="${active ? "active" : ""}"
                    data-index="${index}"
                    title="${bulletin.title || `Bulletin ${index + 1}`}"
                    aria-label="Go to bulletin ${index + 1}"
                    role="button">
                </span>
            `;

        })
        .join("");

}


/* ==========================================================
   NEXT
========================================================== */

function nextSlide() {

    stopProgress();

    if (!bulletins.length) {
        return;
    }

    if (bulletins.length === 1) {

        current = 0;
        render();
        return;

    }

    current++;

    if (current >= bulletins.length) {
        current = 0;
    }

    render();

}


/* ==========================================================
   PREVIOUS
========================================================== */

function previousSlide() {

    stopProgress();

    if (!bulletins.length) {
        return;
    }

    if (bulletins.length === 1) {

        current = 0;
        render();
        return;

    }

    current--;

    if (current < 0) {
        current = bulletins.length - 1;
    }

    render();

}


/* ==========================================================
   GO TO
========================================================== */

function goToSlide(index) {

    stopProgress();

    if (!bulletins.length) {
        return;
    }

    const target = Number(index);

    if (!Number.isInteger(target)) {
        return;
    }

    if (target < 0 || target >= bulletins.length) {
        return;
    }

    if (target === current) {

        startProgress();
        return;

    }

    current = target;

    render();

}


/* ==========================================================
   EVENTS
========================================================== */

function bindEvents() {

    const card = root.querySelector(".spotlight-card");

    if (!card) {
        return;
    }

    /* ===============================
       Card Click
    =============================== */

    card.onclick = () => {

        if (!bulletins.length) {
            return;
        }

        openBulletin();

    };

    /* ===============================
       Pause / Resume
    =============================== */

    card.onmouseenter = () => {

        paused = true;

    };

    card.onmouseleave = () => {

        paused = false;

    };

    /* ===============================
       Dot Navigation
    =============================== */

    const dots = card.querySelectorAll(".spotlight-dots span");

    dots.forEach((dot) => {

        dot.onclick = (event) => {

            event.preventDefault();
            event.stopPropagation();

            const index = Number(dot.dataset.index);

            if (Number.isNaN(index)) {
                return;
            }

            goToSlide(index);

        };

    });

}


/* ==========================================================
   KEYBOARD
========================================================== */

/* ==========================================================
   KEYBOARD
========================================================== */

document.addEventListener("keydown", (e) => {

    /* Close bulletin modal */

    if (e.key === "Escape") {

        if (document.querySelector(".bulletin-overlay")) {
            closeBulletin();
        }

        return;

    }

    /* Ignore keyboard shortcuts while typing */

    const tag = document.activeElement?.tagName;

    if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
    ) {
        return;
    }

    if (!bulletins.length) {
        return;
    }

    switch (e.key) {

        case "ArrowRight":

            e.preventDefault();
            nextSlide();
            break;

        case "ArrowLeft":

            e.preventDefault();
            previousSlide();
            break;

    }

});

/* ==========================================================
   STORY PROGRESS
========================================================== */

/* ==========================================================
   STORY PROGRESS
========================================================== */

function startProgress() {

    stopProgress();

    if (!bulletins.length) {
        return;
    }

    if (bulletins.length <= 1) {

        const bar = document.getElementById("spotProgress");

        if (bar) {
            bar.style.width = "100%";
        }

        return;

    }

    progress = 0;

    const bar = document.getElementById("spotProgress");

    if (!bar) {
        return;
    }

    bar.style.width = "0%";

    let lastFrame = performance.now();

    const animate = (now) => {

        if (paused) {

            lastFrame = now;
            progressTimer = requestAnimationFrame(animate);
            return;

        }

        const delta = now - lastFrame;
        lastFrame = now;

        progress += (delta / AUTO_TIME) * 100;

        if (progress > 100) {
            progress = 100;
        }

        bar.style.width = progress + "%";

        if (progress >= 100) {

            nextSlide();
            return;

        }

        progressTimer = requestAnimationFrame(animate);

    };

    progressTimer = requestAnimationFrame(animate);

}


/* ==========================================================
   STOP PROGRESS
========================================================== */

function stopProgress() {

    if (progressTimer) {

        cancelAnimationFrame(progressTimer);
        progressTimer = null;

    }

    progress = 0;

    const bar = document.getElementById("spotProgress");

    if (bar) {
        bar.style.width = "0%";
    }

}

/* ==========================================================
   BULLETIN MODAL
========================================================== */

/* ==========================================================
   BULLETIN MODAL
========================================================== */

function openBulletin() {

    if (!bulletins.length) {
        return;
    }

    const bulletin = bulletins[current];

    if (!bulletin) {
        return;
    }

    if (bulletin.id) {
        increaseViews(bulletin.id);
    }

    closeBulletin();

    const modal = document.createElement("div");

    modal.className = "bulletin-overlay";

    const title = bulletin.title || "Enterprise Bulletin";

    const message = bulletin.message || bulletin.summary || "";

    const category = formatCategory(bulletin.category);

    const categoryClass = (bulletin.category || "announcement")
        .toLowerCase()
        .replace(/\s+/g, "-");

    const publishedDate = formatDate(bulletin.publishedAt);

    modal.innerHTML = `

        <div class="bulletin-modal">

            <button
                class="bulletin-close"
                type="button"
                aria-label="Close bulletin">

                <i class="fa-solid fa-xmark"></i>

            </button>

            <div class="bulletin-top">

                <div class="spotlight-badge ${categoryClass}">

                    <i class="${getCategoryIcon(bulletin.category)}"></i>

                    ${category}

                </div>

                <div class="bulletin-date">

                    <i class="fa-regular fa-clock"></i>

                    ${publishedDate}

                </div>

            </div>

            <h2>${title}</h2>

            <div class="bulletin-body">

                ${message}

            </div>

            ${renderAttachments(bulletin)}

            ${renderGuideButton(bulletin)}

            <div class="bulletin-footer">

                <i class="fa-solid fa-circle-info"></i>

                Click outside this window or press <strong>Esc</strong> to close.

            </div>

        </div>

    `;

        document.body.appendChild(modal);

    requestAnimationFrame(() => {

        modal.classList.add("show");

    });

    /* ===============================
       Close when clicking outside
    =============================== */

    modal.addEventListener("click", (event) => {

        if (event.target === modal) {
            closeBulletin();
        }

    });

    /* ===============================
       Close button
    =============================== */

    const closeButton = modal.querySelector(".bulletin-close");

    if (closeButton) {

        closeButton.addEventListener("click", (event) => {

            event.preventDefault();
            event.stopPropagation();

            closeBulletin();

        });

    }

    /* ===============================
       Prevent modal body clicks
       from closing the dialog
    =============================== */

    const dialog = modal.querySelector(".bulletin-modal");

    if (dialog) {

        dialog.addEventListener("click", (event) => {

            event.stopPropagation();

        });

    }

}
    /* ==========================================================
   CLOSE MODAL
========================================================== */

/* ==========================================================
   CLOSE MODAL
========================================================== */

function closeBulletin() {

    const modal = document.querySelector(".bulletin-overlay");

    if (!modal) {
        return;
    }

    if (modal.dataset.closing === "true") {
        return;
    }

    modal.dataset.closing = "true";

    modal.classList.remove("show");

    const removeModal = () => {

        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }

    };

    modal.addEventListener(
        "transitionend",
        removeModal,
        { once: true }
    );

    setTimeout(removeModal, 300);

}

/* ==========================================================
   VIEW COUNTER
========================================================== */

function increaseViews(id) {

    if (!id || typeof id !== "string") {
        return;
    }

    db.collection(BULLETIN_COLLECTION)
        .doc(id)
        .update({
            views: firebase.firestore.FieldValue.increment(1)
        })
        .catch((error) => {

            // Ignore expected permission/network issues silently
            if (
                error?.code === "permission-denied" ||
                error?.code === "unavailable" ||
                error?.code === "failed-precondition"
            ) {
                return;
            }

            console.warn(
                "Unable to update bulletin view count:",
                error
            );

        });

}


/* ==========================================================
   ATTACHMENTS
========================================================== */

/* ==========================================================
   ATTACHMENTS
========================================================== */

function renderAttachments(bulletin) {

    if (
        !bulletin ||
        !Array.isArray(bulletin.attachments) ||
        bulletin.attachments.length === 0
    ) {
        return "";
    }

    const attachments = bulletin.attachments
        .map((file) => {

            // String URL support
            if (typeof file === "string") {

                const fileName = file.split("/").pop() || "Attachment";

                return `
                    <a
                        href="${file}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="bulletin-attachment">

                        <i class="fa-solid fa-file"></i>

                        ${fileName}

                    </a>
                `;
            }

            // Object support
            if (
                file &&
                typeof file === "object" &&
                file.url
            ) {

                return `
                    <a
                        href="${file.url}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="bulletin-attachment">

                        <i class="fa-solid fa-file"></i>

                        ${file.name || "Attachment"}

                    </a>
                `;
            }

            return "";

        })
        .join("");

    if (!attachments.trim()) {
        return "";
    }

    return `

        <div class="bulletin-attachments">

            <h4>

                <i class="fa-solid fa-paperclip"></i>

                Attachments

            </h4>

            ${attachments}

        </div>

    `;

}


/* ==========================================================
   GUIDE BUTTON
========================================================== */

function renderGuideButton(bulletin) {

    if (!bulletin) {
        return "";
    }

    const guideUrl = (bulletin.guideUrl || "").trim();
    const guideLabel = (bulletin.guideLabel || "Open Guide").trim();

    if (!guideUrl) {
        return "";
    }

    return `

        <div class="bulletin-guide">

            <a
                href="${guideUrl}"
                class="bulletin-guide-button"
                target="_blank"
                rel="noopener noreferrer">

                <i class="fa-solid fa-book-open"></i>

                ${guideLabel}

            </a>

        </div>

    `;

}


/* ==========================================================
   KEYBOARD
========================================================== */

document.addEventListener("keydown", (e) => {

    /* Close bulletin modal */

    if (e.key === "Escape") {

        if (document.querySelector(".bulletin-overlay")) {
            closeBulletin();
        }

        return;

    }

    /* Ignore keyboard shortcuts while typing */

    const tag = document.activeElement?.tagName;

    if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
    ) {
        return;
    }

    if (!bulletins.length) {
        return;
    }

    switch (e.key) {

        case "ArrowRight":

            e.preventDefault();
            nextSlide();
            break;

        case "ArrowLeft":

            e.preventDefault();
            previousSlide();
            break;

    }

});

loadBulletins();
});
