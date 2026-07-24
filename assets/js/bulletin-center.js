document.addEventListener("DOMContentLoaded",()=>{

    BulletinUI.init();

    // =====================================
// Listen for Published Bulletins
// =====================================

BulletinService.listenPublished((bulletins) => {

    console.log("Published Bulletins:", bulletins);

    window.allBulletins = bulletins;

    renderCategory(
        bulletins,
        "announcement",
        "announcementList",
        "announcementCount"
    );

    renderCategory(
        bulletins,
        "whatsnew",
        "whatsNewList",
        "whatsNewCount"
    );

    renderCategory(
        bulletins,
        "reminder",
        "reminderList",
        "reminderCount"
    );

    renderCategory(
        bulletins,
        "issue",
        "issueList",
        "issueCount"
    );

    renderCategory(
        bulletins,
        "guide",
        "guideList",
        "guideCount"
    );

    // Automatically show the newest bulletin
    if (bulletins.length) {
        showPreview(bulletins[0]);
    }

});

    function getFormData() {

        return {

            title: document.getElementById("bulletinTitle").value,

            summary: document.getElementById("bulletinSummary").value,

            message: document.getElementById("bulletinMessage").value,

            category: document.getElementById("bulletinCategory").value,

            priority: document.getElementById("bulletinPriority").value,

            author: document.getElementById("bulletinAuthor").value,

audience: [
    document.getElementById("bulletinAudience").value.trim()
],

            attachments: []

        };

    }

    // =====================================
    // Preview Button
    // =====================================

    document
        .getElementById("previewBulletinBtn")
        .addEventListener("click",()=>{

            BulletinPreview.update({

                title:document.getElementById("bulletinTitle").value,

                author:document.getElementById("bulletinAuthor").value,

                priority:document.getElementById("bulletinPriority").value,

                message:document.getElementById("bulletinMessage").value,

                views:0

            });

            BulletinToast.show("Preview Updated");

        });

    // =====================================
    // Save Draft Button
    // =====================================

    document
        .getElementById("saveDraftBtn")
        .addEventListener("click", async () => {

            try {

                const data = getFormData();

                const result = await BulletinService.saveDraft(data);

                BulletinToast.show("Draft saved successfully!");

                console.log("Draft ID:", result.id);

            } catch (error) {

                console.error(error);

                BulletinToast.show(
                    "Unable to save draft.",
                    "error"
                );

            }

        });

    // =====================================
// Publish Button
// =====================================

document
    .getElementById("publishBulletinBtn")
    .addEventListener("click", async () => {

        try {

            const data = getFormData();

            // Required field validation
            if (!data.title.trim()) {
                BulletinToast.show("Please enter a bulletin title.", "error");
                return;
            }

            if (!data.message.trim()) {
                BulletinToast.show("Please enter the bulletin message.", "error");
                return;
            }

            const result = await BulletinService.publish(data);

            BulletinToast.show("Bulletin published successfully!");

            console.log("Published ID:", result.id);

        } catch (error) {

            console.error(error);

            BulletinToast.show(
                "Unable to publish bulletin.",
                "error"
            );

        }

    });

});

function renderCategory(bulletins, category, listId, countId) {

    const list = document.getElementById(listId);
    const count = document.getElementById(countId);

    if (!list || !count) return;

    const items = bulletins
        .filter(b => b.category === category)
        .sort((a, b) => {

            const aTime = a.publishedAt?.seconds || 0;
            const bTime = b.publishedAt?.seconds || 0;

            return bTime - aTime;

        });

    count.textContent = items.length;

    list.innerHTML = "";

    if (items.length === 0) {

        list.innerHTML = `
            <div class="mini-item empty">
                <div>
                    <h4>No bulletins yet</h4>
                    <small>Publish one to get started.</small>
                </div>
            </div>
        `;

        return;
    }

    items.slice(0, 3).forEach(bulletin => {

        const date = bulletin.publishedAt?.seconds
            ? new Date(bulletin.publishedAt.seconds * 1000).toLocaleDateString()
            : "Just now";

        const item = document.createElement("div");

        item.className = "mini-item";

        item.dataset.id = bulletin.id;

        item.innerHTML = `
            <div>
                <h4>${bulletin.title}</h4>
                <small>${date}</small>
            </div>

            <i class="fa-solid fa-angle-right"></i>
        `;

        item.addEventListener("click", () => {

    document
        .querySelectorAll(".mini-item.active")
        .forEach(el => el.classList.remove("active"));

    item.classList.add("active");

    showPreview(bulletin);

});

list.appendChild(item);

    });

}

function showPreview(bulletin) {

    document.getElementById("previewTitle").textContent =
        bulletin.title || "";

    document.getElementById("previewAuthor").textContent =
        bulletin.author || "Administrator";

    document.getElementById("previewMessage").innerHTML =
        `<p>${(bulletin.message || "").replace(/\n/g,"<br>")}</p>`;

    document.getElementById("previewViews").textContent =
        `${bulletin.views || 0} Views`;

    document.getElementById("previewDate").textContent =
        bulletin.publishedAt?.seconds
            ? new Date(
                bulletin.publishedAt.seconds * 1000
            ).toLocaleString()
            : "";

    const priority=document.getElementById("previewPriority");

    priority.textContent=(bulletin.priority || "normal").toUpperCase();

    priority.className="priority "+(bulletin.priority || "normal");

    const audience=document.getElementById("previewAudience");

    audience.innerHTML="";

    (bulletin.audience || []).forEach(person=>{

        const span=document.createElement("span");

        span.textContent=person;

        audience.appendChild(span);

    });

}
