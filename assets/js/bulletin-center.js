document.addEventListener("DOMContentLoaded",()=>{

    BulletinUI.init();

    // =====================================
// Listen for Published Bulletins
// =====================================

BulletinService.listenPublished((bulletins) => {

    console.log("Published Bulletins:", bulletins);

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

    const items = bulletins.filter(
        b => b.category === category
    );

    count.textContent = items.length;

    list.innerHTML = "";

    items.forEach(bulletin => {

        const date = bulletin.publishedAt?.seconds
            ? new Date(bulletin.publishedAt.seconds * 1000).toLocaleDateString()
            : "";

        const item = document.createElement("div");

        item.className = "mini-item";

        item.innerHTML = `
            <div>
                <h4>${bulletin.title}</h4>
                <small>${date}</small>
            </div>

            <i class="fa-solid fa-angle-right"></i>
        `;

        list.appendChild(item);

    });

}
