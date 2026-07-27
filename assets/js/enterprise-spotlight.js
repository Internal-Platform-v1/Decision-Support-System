(() => {
  const root = document.getElementById("enterpriseSpotlight");
  if (!root) return;

  const AUTO_TIME = 5000;
  let progressTimer = null,
    progress = 0,
    current = 0,
    paused = false;
  let bulletins = [];
  const db = firebase.firestore();
  const BULLETIN_COLLECTION = "enterprise_bulletins";

  /* ===== HELPERS ===== */
  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "☀ Good Morning" : h < 18 ? "🌤 Good Afternoon" : "🌙 Good Evening";
  };

  const formatDate = ts => {
    if (!ts) return "";
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
      return isNaN(d.getTime()) ? "" : d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  };

  const isRecent = ts => {
    if (!ts) return false;
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
      const diff = (new Date() - d) / 86400000;
      return !isNaN(d.getTime()) && diff >= 0 && diff <= 3;
    } catch { return false; }
  };

  const formatCategory = cat => {
    if (!cat) return "Announcement";
    return String(cat).trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryIcon = cat => {
    const map = {
      announcement: "fa-solid fa-bullhorn",
      "guide update": "fa-solid fa-book-open",
      maintenance: "fa-solid fa-server",
      critical: "fa-solid fa-triangle-exclamation",
      system: "fa-solid fa-gears",
      training: "fa-solid fa-graduation-cap",
      policy: "fa-solid fa-scale-balanced",
      security: "fa-solid fa-shield-halved",
      event: "fa-solid fa-calendar-days"
    };
    return map[(cat || "").trim().toLowerCase()] || "fa-regular fa-newspaper";
  };

  const renderDots = () => {
    if (!bulletins.length) return "";
    return bulletins.map((b, i) =>
      `<span class="${i === current ? "active" : ""}" data-index="${i}" title="${b.title || `Bulletin ${i + 1}`}" aria-label="Go to bulletin ${i + 1}" role="button"></span>`
    ).join("");
  };

  const stopProgress = () => {
    if (progressTimer) { cancelAnimationFrame(progressTimer);
      progressTimer = null; }
    progress = 0;
    const bar = document.getElementById("spotProgress");
    if (bar) bar.style.width = "0%";
  };

  const startProgress = () => {
    stopProgress();
    if (!bulletins.length || bulletins.length <= 1) {
      const bar = document.getElementById("spotProgress");
      if (bar) bar.style.width = "100%";
      return;
    }
    progress = 0;
    const bar = document.getElementById("spotProgress");
    if (!bar) return;
    bar.style.width = "0%";
    let lastFrame = performance.now();
    const animate = now => {
      if (paused) { lastFrame = now;
        progressTimer = requestAnimationFrame(animate); return; }
      const delta = now - lastFrame;
      lastFrame = now;
      progress += (delta / AUTO_TIME) * 100;
      if (progress > 100) progress = 100;
      bar.style.width = progress + "%";
      if (progress >= 100) { nextSlide(); return; }
      progressTimer = requestAnimationFrame(animate);
    };
    progressTimer = requestAnimationFrame(animate);
  };

  const nextSlide = () => {
    stopProgress();
    if (!bulletins.length) return;
    if (bulletins.length === 1) { current = 0;
      render(); return; }
    current = (current + 1) % bulletins.length;
    render();
  };

  const previousSlide = () => {
    stopProgress();
    if (!bulletins.length) return;
    if (bulletins.length === 1) { current = 0;
      render(); return; }
    current = current - 1 < 0 ? bulletins.length - 1 : current - 1;
    render();
  };

  const goToSlide = index => {
    stopProgress();
    if (!bulletins.length) return;
    const target = Number(index);
    if (!Number.isInteger(target) || target < 0 || target >= bulletins.length || target === current) {
      if (target === current) startProgress();
      return;
    }
    current = target;
    render();
  };

  const closeBulletin = () => {
    const modal = document.querySelector(".bulletin-overlay");
    if (!modal || modal.dataset.closing === "true") return;
    modal.dataset.closing = "true";
    modal.classList.remove("show");
    const remove = () => { if (modal.parentNode) modal.parentNode.removeChild(modal); };
    modal.addEventListener("transitionend", remove, { once: true });
    setTimeout(remove, 300);
  };

  const renderAttachments = b => {
    if (!b || !Array.isArray(b.attachments) || !b.attachments.length) return "";
    const html = b.attachments.map(f => {
      if (typeof f === "string") {
        const name = f.split("/").pop() || "Attachment";
        return `<a href="${f}" target="_blank" rel="noopener noreferrer" class="bulletin-attachment"><i class="fa-solid fa-file"></i> ${name}</a>`;
      }
      if (f && typeof f === "object" && f.url) {
        return `<a href="${f.url}" target="_blank" rel="noopener noreferrer" class="bulletin-attachment"><i class="fa-solid fa-file"></i> ${f.name || "Attachment"}</a>`;
      }
      return "";
    }).join("");
    if (!html.trim()) return "";
    return `<div class="bulletin-attachments"><h4><i class="fa-solid fa-paperclip"></i> Attachments</h4>${html}</div>`;
  };

  const renderGuideButton = b => {
    if (!b) return "";
    const url = (b.guideUrl || "").trim();
    const label = (b.guideLabel || "Open Guide").trim();
    return url ? `<div class="bulletin-guide"><a href="${url}" class="bulletin-guide-button" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-book-open"></i> ${label}</a></div>` : "";
  };

  const openBulletin = () => {
    if (!bulletins.length) return;
    const b = bulletins[current];
    if (!b) return;
    if (b.id) {
      db.collection(BULLETIN_COLLECTION).doc(b.id).update({ views: firebase.firestore.FieldValue.increment(1) })
        .catch(e => { if (!["permission-denied", "unavailable", "failed-precondition"].includes(e?.code)) console.warn("View count error:", e); });
    }
    closeBulletin();
    const modal = document.createElement("div");
    modal.className = "bulletin-overlay";
    const catClass = (b.category || "announcement").toLowerCase().replace(/\s+/g, "-");
    modal.innerHTML = `
      <div class="bulletin-modal">
        <button class="bulletin-close" type="button" aria-label="Close bulletin"><i class="fa-solid fa-xmark"></i></button>
        <div class="bulletin-top">
          <div class="spotlight-badge ${catClass}"><i class="${getCategoryIcon(b.category)}"></i> ${formatCategory(b.category)}</div>
          <div class="bulletin-date"><i class="fa-regular fa-clock"></i> ${formatDate(b.publishedAt)}</div>
        </div>
        <h2>${b.title || "Enterprise Bulletin"}</h2>
        <div class="bulletin-body">${b.message || b.summary || ""}</div>
        ${renderAttachments(b)}
        ${renderGuideButton(b)}
        <div class="bulletin-footer"><i class="fa-solid fa-circle-info"></i> Click outside or press <strong>Esc</strong> to close.</div>
      </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("show"));
    modal.addEventListener("click", e => { if (e.target === modal) closeBulletin(); });
    const closeBtn = modal.querySelector(".bulletin-close");
    if (closeBtn) closeBtn.addEventListener("click", e => { e.preventDefault();
      e.stopPropagation();
      closeBulletin(); });
    const dialog = modal.querySelector(".bulletin-modal");
    if (dialog) dialog.addEventListener("click", e => e.stopPropagation());
  };

const bindEvents = () => {

    const card = root.querySelector(".spotlight-card");
    if (!card) return;

    // Open bulletin
const openArea = card.querySelector(".spotlight-open");

if (openArea) {

    openArea.onclick = () => {

        if (bulletins.length) {

            openBulletin();

        }

    };

}

    // Pause on hover
    card.onmouseenter = () => {
        paused = true;
    };

    card.onmouseleave = () => {
        paused = false;
    };

    // Previous Arrow
    const prevBtn = card.querySelector(".spot-arrow.prev");

    if (prevBtn) {
        prevBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            previousSlide();
        };
    }

    // Next Arrow
    const nextBtn = card.querySelector(".spot-arrow.next");

    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            nextSlide();
        };
    }

    // Dot Navigation
    card.querySelectorAll(".spotlight-dots span").forEach(dot => {

        dot.onclick = (e) => {

            e.preventDefault();
            e.stopPropagation();

            const idx = Number(dot.dataset.index);

            if (!isNaN(idx)) {
                goToSlide(idx);
            }

        };

    });

};

  const render = () => {
    stopProgress();
    if (!bulletins.length) {
      root.innerHTML = `<div class="spotlight-card"><div class="spotlight-empty"><i class="fa-regular fa-newspaper"></i><h3>No Enterprise Bulletins</h3><p>You're all caught up.</p></div></div>`;
      return;
    }
    if (current < 0 || current >= bulletins.length) current = 0;
    const b = bulletins[current];
    const isNew = isRecent(b.publishedAt);
    const badgeClass = (b.category || "announcement").toLowerCase().replace(/\s+/g, "-");
root.innerHTML = `
    <div class="spotlight-card">
        <div class="spotlight-progress"><div class="spotlight-progress-fill" id="spotProgress"></div></div>
        <div class="spotlight-header">
          <div><div class="spotlight-greeting">${getGreeting()}</div><div class="spotlight-subtitle">Latest Updates</div></div>
          <div class="spotlight-count">${current + 1} / ${bulletins.length}</div>
        </div>
        <div class="spotlight-content spotlight-open">
          <div class="spotlight-badge ${badgeClass}"><i class="${getCategoryIcon(b.category)}"></i> ${formatCategory(b.category)}</div>
          <h2>${b.title || ""} ${isNew ? '<span class="spot-new">NEW</span>' : ''}</h2>
          <p>${b.summary || b.message || ""}</p>
        </div>
       <div class="spotlight-bottom">

    <div class="spotlight-published">

        <i class="fa-regular fa-clock"></i>

        ${publishedDate}

    </div>

    <div class="spotlight-navigation">

        <button
            class="spot-arrow prev"
            type="button"
            aria-label="Previous Bulletin">

            <i class="fa-solid fa-chevron-left"></i>

        </button>

        <div class="spotlight-dots">

            ${renderDots()}

        </div>

        <button
            class="spot-arrow next"
            type="button"
            aria-label="Next Bulletin">

            <i class="fa-solid fa-chevron-right"></i>

        </button>

    </div>

</div>
      </div>
    `;

    const card = root.querySelector(".spotlight-card");

if (card) {

    card.animate(
        [
            {
                opacity: 0,
                transform: "translateX(80px)"
            },
            {
                opacity: 1,
                transform: "translateX(0)"
            }
        ],
        {
            duration: 650,
            easing: "cubic-bezier(.22,1,.36,1)"
        }
    );

}
    
    bindEvents();
    bulletins.length > 1 ? startProgress() : stopProgress();
  };

  const prioritize = () => {
    const weight = { critical: 1, high: 2, normal: 3, low: 4 };
    bulletins.sort((a, b) => {
      const pa = weight[(a.priority || "").toLowerCase()] ?? 99;
      const pb = weight[(b.priority || "").toLowerCase()] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.publishedAt?.seconds || 0) - (a.publishedAt?.seconds || 0);
    });
  };

  const loadBulletins = () => {
    db.collection(BULLETIN_COLLECTION)
      .where("status", "==", "published")
      .orderBy("publishedAt", "desc")
      .onSnapshot(snap => {
        bulletins = [];
        snap.forEach(d => bulletins.push({ id: d.id, ...d.data() }));
        prioritize();
        if (current >= bulletins.length) current = 0;
        render();
      }, err => {
        console.error("Enterprise Spotlight:", err);
        bulletins = [];
        root.innerHTML = `<div class="spotlight-card"><div class="spotlight-empty"><i class="fa-solid fa-circle-exclamation"></i><h3>Unable to load Enterprise Bulletins</h3><p>Please try again later.</p></div></div>`;
      });
  };

  /* ===== KEYBOARD ===== */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.querySelector(".bulletin-overlay")) { closeBulletin(); return; }
    const tag = document.activeElement?.tagName;
    if (["INPUT", "TEXTAREA"].includes(tag) || document.activeElement?.isContentEditable) return;
    if (!bulletins.length) return;
    if (e.key === "ArrowRight") { e.preventDefault();
      nextSlide(); }
    if (e.key === "ArrowLeft") { e.preventDefault();
      previousSlide(); }
  });

  loadBulletins();
})();
