document.addEventListener("DOMContentLoaded", () => {

    BulletinUI.init();

    // ==========================================================
    // Attachment Manager
    // ==========================================================

    document
        .getElementById("addAttachmentBtn")
        ?.addEventListener("click", addAttachmentRow);

    document
        .querySelector(".attachment-row .remove-attachment")
        ?.addEventListener("click", function () {

            const rows = document.querySelectorAll(".attachment-row");

            if (rows.length > 1) {

                this.closest(".attachment-row").remove();

            } else {

                this.closest(".attachment-row")
                    .querySelectorAll("input")
                    .forEach(input => input.value = "");

            }

        });

    // ==========================================================
    // Listen for Published Bulletins
    // ==========================================================

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

        if (bulletins.length) {
            showPreview(bulletins[0]);
        }

    });

    // ==========================================================
    // Helper Functions
    // ==========================================================

    function getAttachments() {

        return [...document.querySelectorAll(".attachment-row")]

            .map(row => ({

                type: row.querySelector(".attachment-type").value,

                name: row.querySelector(".attachment-name").value.trim(),

                url: row.querySelector(".attachment-url").value.trim()

            }))

            .filter(item => item.name && item.url);

    }

    function clearAttachmentRows() {

        const container =
            document.getElementById("attachmentContainer");

        container.innerHTML = `
            <div class="attachment-row">

                <select class="attachment-type">

                    <option value="guide">📘 Decision Guide</option>
                    <option value="sharepoint">📂 SharePoint</option>
                    <option value="onedrive">☁ OneDrive</option>
                    <option value="teams">💬 Microsoft Teams</option>
                    <option value="forms">📝 Microsoft Forms</option>
                    <option value="external">🌐 External Website</option>

                </select>

                <input
                    type="text"
                    class="attachment-name"
                    placeholder="Attachment Name">

                <input
                    type="url"
                    class="attachment-url"
                    placeholder="Paste URL">

                <button
                    type="button"
                    class="remove-attachment">

                    <i class="fa-solid fa-trash"></i>

                </button>

            </div>
        `;

        container
            .querySelector(".remove-attachment")
            .addEventListener("click", function () {

                this.closest(".attachment-row")
                    .querySelectorAll("input")
                    .forEach(input => input.value = "");

            });

    }

    function clearForm() {

        document.getElementById("bulletinTitle").value = "";

        document.getElementById("bulletinSummary").value = "";

        document.getElementById("bulletinMessage").value = "";

        document.getElementById("bulletinAudience").value = "";

        document.getElementById("bulletinCategory").selectedIndex = 0;

        document.getElementById("bulletinPriority").selectedIndex = 0;

        clearAttachmentRows();

    }

    function getFormData() {

        return {

            title: document
                .getElementById("bulletinTitle")
                .value
                .trim(),

            summary: document
                .getElementById("bulletinSummary")
                .value
                .trim(),

            message: document
                .getElementById("bulletinMessage")
                .value
                .trim(),

            category: document
                .getElementById("bulletinCategory")
                .value,

            priority: document
                .getElementById("bulletinPriority")
                .value,

            author: document
                .getElementById("bulletinAuthor")
                .value
                .trim(),

            audience: document
                .getElementById("bulletinAudience")
                .value
                .split(",")
                .map(a => a.trim())
                .filter(Boolean),

            attachments: getAttachments()

        };

    }

    // ==========================================================
    // Preview Button
    // ==========================================================

    document
        .getElementById("previewBulletinBtn")
        .addEventListener("click", () => {

            BulletinPreview.update({

                title: document.getElementById("bulletinTitle").value,

                author: document.getElementById("bulletinAuthor").value,

                priority: document.getElementById("bulletinPriority").value,

                message: document.getElementById("bulletinMessage").value,

                views: 0

            });

            BulletinToast.show("Preview Updated");

        });

        // ==========================================================
    // Save Draft
    // ==========================================================

    document
        .getElementById("saveDraftBtn")
        .addEventListener("click", async () => {

            try {

                const data = getFormData();

                if (!data.title) {

                    BulletinToast.show(
                        "Please enter a bulletin title.",
                        "error"
                    );

                    return;
                }

                const result =
                    await BulletinService.saveDraft(data);

                console.log("Draft ID:", result.id);

                BulletinToast.show(
                    "Draft saved successfully!"
                );

            } catch (error) {

                console.error(error);

                BulletinToast.show(
                    "Unable to save draft.",
                    "error"
                );

            }

        });

    // ==========================================================
    // Publish Bulletin
    // ==========================================================

    document
        .getElementById("publishBulletinBtn")
        .addEventListener("click", async () => {

            try {

                const data = getFormData();

                if (!data.title) {

                    BulletinToast.show(
                        "Please enter a bulletin title.",
                        "error"
                    );

                    return;

                }

                if (!data.message) {

                    BulletinToast.show(
                        "Please enter the bulletin message.",
                        "error"
                    );

                    return;

                }

                if (!data.author) {

                    BulletinToast.show(
                        "Please enter an author.",
                        "error"
                    );

                    return;

                }

                const result =
                    await BulletinService.publish(data);

                console.log(
                    "Published ID:",
                    result.id
                );

                BulletinToast.show(
                    "Bulletin published successfully!"
                );

                clearForm();

            } catch (error) {

                console.error(error);

                BulletinToast.show(
                    "Unable to publish bulletin.",
                    "error"
                );

            }

        });

});

function renderCategory(
    bulletins,
    category,
    listId,
    countId
) {

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

    if (!items.length) {

        list.innerHTML = `

            <div class="mini-item empty">

                <div>

                    <h4>No bulletins yet</h4>

                    <small>
                        Publish one to get started.
                    </small>

                </div>

            </div>

        `;

        return;

    }

    items
        .slice(0, 3)
        .forEach(bulletin => {

            const date = bulletin.publishedAt?.seconds

                ? new Date(
                    bulletin.publishedAt.seconds * 1000
                ).toLocaleDateString()

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

                    .forEach(card =>
                        card.classList.remove("active")
                    );

                item.classList.add("active");

                showPreview(bulletin);

            });

            list.appendChild(item);

        });

}

function addAttachmentRow() {

    const container = document.getElementById("attachmentContainer");

    const row = document.createElement("div");

    row.className = "attachment-row";

    row.innerHTML = `

        <select class="attachment-type">

            <option value="guide">📘 Decision Guide</option>

            <option value="sharepoint">📂 SharePoint</option>

            <option value="onedrive">☁ OneDrive</option>

            <option value="teams">💬 Microsoft Teams</option>

            <option value="forms">📝 Microsoft Forms</option>

            <option value="external">🌐 External Website</option>

        </select>

        <input
            type="text"
            class="attachment-name"
            placeholder="Attachment Name">

        <input
            type="url"
            class="attachment-url"
            placeholder="Paste URL">

        <button
            type="button"
            class="remove-attachment">

            <i class="fa-solid fa-trash"></i>

        </button>

    `;

    row
        .querySelector(".remove-attachment")
        .addEventListener("click", () => {

            row.remove();

        });

    document
        .getElementById("attachmentContainer")
        .appendChild(row);

}

function showPreview(bulletin) {

    document.getElementById("previewTitle").textContent =
        bulletin.title || "";

    document.getElementById("previewAuthor").textContent =
        bulletin.author || "Administrator";

    document.getElementById("previewMessage").innerHTML =
        `<p>${(bulletin.message || "").replace(/\n/g, "<br>")}</p>`;

    document.getElementById("previewViews").textContent =
        `${bulletin.views || 0} Views`;

    document.getElementById("previewDate").textContent =
        bulletin.publishedAt?.seconds
            ? new Date(
                bulletin.publishedAt.seconds * 1000
            ).toLocaleString()
            : "";

    // =====================================================
    // Priority
    // =====================================================

    const priority =
        document.getElementById("previewPriority");

    priority.textContent =
        (bulletin.priority || "normal").toUpperCase();

    priority.className =
        "priority " + (bulletin.priority || "normal");

    // =====================================================
    // Audience
    // =====================================================

    const audience =
        document.getElementById("previewAudience");

    audience.innerHTML = "";

    if (
        bulletin.audience &&
        bulletin.audience.length
    ) {

        bulletin.audience.forEach(person => {

            const tag =
                document.createElement("span");

            tag.textContent = person;

            audience.appendChild(tag);

        });

    } else {

        audience.innerHTML =
            "<span>All Employees</span>";

    }

    // =====================================================
    // Attachments
    // =====================================================

    const attachmentList =
        document.getElementById("previewAttachments");

    attachmentList.innerHTML = "";

    const icons = {

        guide: "fa-book",

        sharepoint: "fa-folder",

        onedrive: "fa-cloud",

        teams: "fa-comments",

        forms: "fa-file-lines",

        external: "fa-link"

    };

    if (
        !bulletin.attachments ||
        bulletin.attachments.length === 0
    ) {

        attachmentList.innerHTML = `

            <div class="attachment-card">

                <div class="file-icon">

                    <i class="fa-solid fa-paperclip"></i>

                </div>

                <div class="file-info">

                    <h4>No Attachments</h4>

                    <span>
                        This bulletin has no attached resources.
                    </span>

                </div>

            </div>

        `;

        return;

    }

    bulletin.attachments.forEach(file => {

        const card =
            document.createElement("div");

        card.className =
            "attachment-card";

        card.innerHTML = `

            <div class="file-icon">

                <i class="fa-solid ${icons[file.type] || "fa-paperclip"}"></i>

            </div>

            <div class="file-info">

                <h4>${file.name}</h4>

                <span>${file.type.toUpperCase()}</span>

            </div>

            <button
                class="download-btn">

                <i class="fa-solid fa-up-right-from-square"></i>

            </button>

        `;

        card
            .querySelector(".download-btn")
            .addEventListener("click", () => {

                window.open(file.url, "_blank");

            });

        attachmentList.appendChild(card);

    });

}
