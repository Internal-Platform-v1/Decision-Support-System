window.editMode = false;
window.copyMode = false;
window.currentBulletin = null;
document.addEventListener("DOMContentLoaded", () => {


    BulletinUI.init();
    // ==========================================================
// Search
// ==========================================================

document
    .getElementById("bulletinSearch")
    ?.addEventListener("input", () => {

        applyFilters();

    });

    // ==========================================================
// View All Buttons
// ==========================================================

document
.querySelectorAll(".view-all-btn")
.forEach(button=>{

    button.addEventListener("click",()=>{

        openViewAll(
            button.dataset.category
        );

    });

});

document
.getElementById("closeViewAllBtn")
?.addEventListener(
    "click",
    closeViewAll
);

    // ==========================================================
// Search
// ==========================================================

document
    .getElementById("bulletinSearch")
    ?.addEventListener("input", applyFilters);

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

    document
    .getElementById("newBulletinBtn")
    ?.addEventListener("click", () => {

        resetFormMode();

        clearForm();

    });

document
    .getElementById("fabNewBulletin")
    ?.addEventListener("click", () => {

        resetFormMode();

        clearForm();

    });

    document
    .getElementById("editBulletinBtn")
    ?.addEventListener("click", () => {

        const bulletin = getSelectedBulletin();

        if (!bulletin) return;

        window.editMode = true;

        loadBulletinIntoForm(bulletin);

        BulletinUI.openDrawer();

        document.querySelector(".drawer-header h2").textContent =
            "Edit Bulletin";

        document.querySelector(".drawer-header p").textContent =
            "Update the selected enterprise bulletin.";

        document.getElementById("publishBulletinBtn").innerHTML = `
            <i class="fa-solid fa-floppy-disk"></i>
            Save Changes
        `;

    });

    // ==========================================================
// Copy Bulletin
// ==========================================================

document
    .getElementById("copyBulletinBtn")
    ?.addEventListener("click", () => {

        const bulletin = getSelectedBulletin();

        if (!bulletin) return;

        prepareCopy(bulletin);

        BulletinUI.openDrawer();

    });
    

    // ==========================================================
// Delete Bulletin
// ==========================================================

document
    .getElementById("deleteBulletinBtn")
    ?.addEventListener("click", async () => {

        const bulletin = getSelectedBulletin();

        if (!bulletin) return;

        const confirmed = confirm(
            `Delete "${bulletin.title}"?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        try {

            await BulletinService.remove(bulletin.id);

            BulletinToast.show(
                "Bulletin deleted successfully."
            );

            clearForm();

        } catch (err) {

            console.error(err);

            BulletinToast.show(
                "Unable to delete bulletin.",
                "error"
            );

        }

    });

    // ==========================================================
// View All Search
// ==========================================================

document
.getElementById("viewAllSearch")
?.addEventListener("input", () => {

    if(window.currentViewAllCategory){

        renderViewAll(window.currentViewAllCategory);

    }

});

    // ==========================================================
    // Listen for Published Bulletins
    // ==========================================================

BulletinService.listenPublished((bulletins) => {

    console.log("Published Bulletins:", bulletins);

    window.allBulletins = bulletins;

    applyFilters();

    if (bulletins.length) {

        window.currentBulletin = bulletins[0];

        showPreview(bulletins[0]);

    } else {

        clearPreview();

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

    function loadBulletinIntoForm(bulletin) {

    document.getElementById("bulletinTitle").value =
        bulletin.title || "";

    document.getElementById("bulletinSummary").value =
        bulletin.summary || "";

    document.getElementById("bulletinMessage").value =
        bulletin.message || "";

    document.getElementById("bulletinCategory").value =
        bulletin.category || "announcement";

    document.getElementById("bulletinPriority").value =
        bulletin.priority || "normal";

    document.getElementById("bulletinAuthor").value =
        bulletin.author || "";

    document.getElementById("bulletinAudience").value =
        (bulletin.audience || []).join(", ");

        const container =
    document.getElementById("attachmentContainer");

container.innerHTML = "";

(bulletin.attachments || []).forEach(attachment => {

    addAttachmentRow(attachment);

});

}

    function prepareCopy(bulletin) {

    window.editMode = false;

    window.copyMode = true;

    loadBulletinIntoForm(bulletin);

    document.getElementById("bulletinTitle").value =
        bulletin.title + " (Copy)";

    document.querySelector(".drawer-header h2").textContent =
        "Copy Bulletin";

    document.querySelector(".drawer-header p").textContent =
        "Review and publish the copied bulletin.";

    document.getElementById("publishBulletinBtn").innerHTML = `
        <i class="fa-solid fa-paper-plane"></i>
        Publish Copy
    `;

}
    
function resetFormMode() {

    window.editMode = false;
    window.copyMode = false;

    document.querySelector(".drawer-header h2").textContent =
        "Create Bulletin";

    document.querySelector(".drawer-header p").textContent =
        "Create or publish a new enterprise announcement.";

    document.getElementById("publishBulletinBtn").innerHTML = `
        <i class="fa-solid fa-paper-plane"></i>
        Publish
    `;

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


                let result;

if (window.editMode) {

    result = await BulletinService.update(
        window.currentBulletin.id,
        data
    );

    BulletinToast.show("Bulletin updated successfully!");

    resetFormMode();

clearForm();

BulletinUI.closeDrawer();

} else {

    result = await BulletinService.publish(data);

    BulletinToast.show("Bulletin published successfully!");

}

console.log(
    "Published ID:",
    result.id
);

resetFormMode();

clearForm();

BulletinUI.closeDrawer();

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

function applyFilters() {

    let filtered = [...(window.allBulletins || [])];

    // =====================================
    // Search
    // =====================================

    const keyword = (
        document.getElementById("bulletinSearch")?.value || ""
    )
    .trim()
    .toLowerCase();

    if (keyword) {

        filtered = filtered.filter(bulletin => {

            return [

                bulletin.title,

                bulletin.summary,

                bulletin.message,

                bulletin.category,

                ...(bulletin.audience || [])

            ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);

        });

    }

    renderCategory(
        filtered,
        "announcement",
        "announcementList",
        "announcementCount"
    );

    renderCategory(
        filtered,
        "whatsnew",
        "whatsNewList",
        "whatsNewCount"
    );

    renderCategory(
        filtered,
        "reminder",
        "reminderList",
        "reminderCount"
    );

    renderCategory(
        filtered,
        "issue",
        "issueList",
        "issueCount"
    );

    renderCategory(
        filtered,
        "guide",
        "guideList",
        "guideCount"
    );

}

function addAttachmentRow(attachment = {}) {

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

    row.querySelector(".attachment-type").value =
        attachment.type || "guide";

    row.querySelector(".attachment-name").value =
        attachment.name || "";

    row.querySelector(".attachment-url").value =
        attachment.url || "";

    row
        .querySelector(".remove-attachment")
        .addEventListener("click", () => {

            row.remove();

        });

    container.appendChild(row);

}

function clearPreview() {

    window.currentBulletin = null;

    const preview = document.getElementById("bulletinPreview");

    if (!preview) return;

    preview.innerHTML = `

        <div class="empty-state">

            <i class="fa-regular fa-newspaper"></i>

            <h3>No Bulletin Selected</h3>

            <p>Select a bulletin to view its details.</p>

        </div>

    `;

}

function showPreview(bulletin) {
    window.currentBulletin = bulletin;
    document.getElementById("previewTitle").textContent =
        bulletin.title || "";

    document.getElementById("previewAuthor").textContent =
    bulletin.author || "";

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

// ==========================================================
// View All Modal
// ==========================================================

function openViewAll(category){

    window.currentViewAllCategory = category;
    window.currentViewAllBulletin = null;

    renderViewAll(category);

    document
        .getElementById("viewAllModal")
        .classList.add("show");

}

function closeViewAll(){

    document
        .getElementById("viewAllModal")
        .classList.remove("show");

}

function formatDate(timestamp) {

    if (!timestamp) return "";

    let date;

    // Firestore Timestamp
    if (typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

}

// ==========================================================
// Render View All List
// ==========================================================

function renderViewAll(category){

    const list = document.getElementById("viewAllList");
    const title = document.getElementById("viewAllTitle");
    const subtitle = document.getElementById("viewAllSubtitle");

    const search =
        document
            .getElementById("viewAllSearch")
            ?.value
            .trim()
            .toLowerCase() || "";

    let bulletins = (window.allBulletins || [])
        .filter(b => b.category === category);

    // Search Filter
    if(search){

        bulletins = bulletins.filter(b => {

            return (
                (b.title || "").toLowerCase().includes(search) ||
                (b.summary || "").toLowerCase().includes(search) ||
                (b.message || "").toLowerCase().includes(search)
            );

        });

    }

    title.textContent = capitalize(category);

    subtitle.textContent = `${bulletins.length} bulletin(s)`;

    if (!bulletins.length) {

        list.innerHTML = `
            <div class="empty-state">
                No bulletins found.
            </div>
        `;

        document.getElementById("viewAllPreview").innerHTML = `
            <div class="empty-preview">
                No bulletin selected.
            </div>
        `;

        return;

    }

    if (
        !window.currentViewAllBulletin ||
        !bulletins.find(b => b.id === window.currentViewAllBulletin.id)
    ) {

        window.currentViewAllBulletin = bulletins[0];

    }

    list.innerHTML = bulletins.map(b => `

        <div class="viewall-card ${
            window.currentViewAllBulletin.id === b.id
                ? "selected"
                : ""
        }"
        data-id="${b.id}">

            <div class="viewall-card-top">

                <span class="category-pill">

                    ${getCategoryIcon(b.category)}

                    ${capitalize(b.category)}

                </span>

                <span class="priority-pill priority-${(b.priority || "Normal").toLowerCase()}">

                    ${b.priority || "Normal"}

                </span>

            </div>

            <div class="viewall-card-title">

                ${b.title}

            </div>

            <div class="viewall-card-summary">

                ${b.summary || "No summary available."}

            </div>

            <div class="viewall-card-footer">

                <span>

                    <i class="fa-regular fa-calendar"></i>

                    ${formatDate(b.publishedAt)}

                </span>

                <span>

                    <i class="fa-solid fa-chevron-right"></i>

                </span>

            </div>

        </div>

    `).join("");

    renderViewAllPreview(window.currentViewAllBulletin);

    list.querySelectorAll(".viewall-card").forEach(card => {

        card.addEventListener("click", () => {

            const bulletin = bulletins.find(
                b => b.id === card.dataset.id
            );

            if (!bulletin) return;

            window.currentViewAllBulletin = bulletin;

            renderViewAll(category);

        });

    });

}

function renderViewAllPreview(bulletin){

    const preview = document.getElementById("viewAllPreview");

    const attachments = (bulletin.attachments || [])
        .filter(a => a.name || a.url);

    preview.innerHTML = `

        <div class="viewall-preview-header">

            <div class="viewall-category">

                ${getCategoryIcon(bulletin.category)}
                ${capitalize(bulletin.category)}

            </div>

            <h2 class="viewall-preview-title">

                ${bulletin.title}

            </h2>

            <div class="viewall-meta">

                <span>

                    <strong>Priority:</strong>

                    ${bulletin.priority || "Normal"}

                </span>

                <span>

                    <strong>Published:</strong>

                    ${formatDate(bulletin.publishedAt)}

                </span>

            </div>

        </div>

        ${
            bulletin.summary
            ? `
            <div class="viewall-summary">

                <h4>Summary</h4>

                <p>${bulletin.summary}</p>

            </div>
            `
            : ""
        }

        <div class="viewall-message">

            <h4>Message</h4>

            <div>

                ${bulletin.message || ""}

            </div>

        </div>

        ${
            attachments.length
            ? `
                <div class="viewall-attachments">

                    <h4>Attachments</h4>

                    ${attachments.map(a => `
                        <div class="attachment-item">

                            <i class="fa-solid fa-paperclip"></i>

                            <a href="${a.url}" target="_blank">

                                ${a.name}

                            </a>

                        </div>
                    `).join("")}

                </div>
            `
            : ""
        }

    `;

}

function capitalize(text){

    if(!text) return "";

    return text.charAt(0).toUpperCase() + text.slice(1);

}

function getCategoryIcon(category){

    switch(category){

        case "announcement":
            return "📢";

        case "whatsnew":
            return "🆕";

        case "guide":
            return "📘";

        case "issue":
            return "⚠";

        case "reminder":
            return "⏰";

        default:
            return "📄";

    }

}

function getSelectedBulletin() {

    if (!window.currentBulletin) {

        BulletinToast.show(
            "Please select a bulletin first.",
            "warning"
        );

        return null;
    }

    return window.currentBulletin;

}

