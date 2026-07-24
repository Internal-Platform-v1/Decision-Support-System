// =====================================
// Bulletin Preview Module
// =====================================

const BulletinPreview = (() => {

    function update(data) {

        document.getElementById("previewTitle").textContent =
            data.title || "Untitled Bulletin";

        document.getElementById("previewAuthor").textContent =
            data.author || "Administrator";

        document.getElementById("previewDate").textContent =
            data.date || new Date().toLocaleDateString();

        document.getElementById("previewPriority").textContent =
            (data.priority || "normal").toUpperCase();

        document.getElementById("previewPriority").className =
            `priority ${data.priority || "normal"}`;

        document.getElementById("previewViews").textContent =
            `${data.views || 0} Views`;

        document.getElementById("previewMessage").innerHTML =
            `<p>${(data.message || "").replace(/\n/g,"</p><p>")}</p>`;
    }

    return {

        update

    };

})();
