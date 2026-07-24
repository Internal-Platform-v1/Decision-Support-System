// =========================================
// Bulletin UI Module
// Handles UI interactions only
// =========================================

const BulletinUI = (() => {

    const drawer = document.getElementById("composeDrawer");
    const backdrop = document.querySelector(".drawer-backdrop");

    const newBtn = document.getElementById("newBulletinBtn");
    const fabBtn = document.getElementById("fabNewBulletin");
    const closeBtn = document.getElementById("closeDrawerBtn");

    const previewBtn = document.getElementById("previewBulletinBtn");

    const toastContainer = document.getElementById("toastContainer");
    const loadingOverlay = document.getElementById("loadingOverlay");

    const previewContent = document.getElementById("previewContent");

    // -------------------------------------
    // Drawer
    // -------------------------------------

    function openDrawer() {
        drawer.classList.add("open");
        backdrop.classList.add("show");
    }

    function closeDrawer() {
        drawer.classList.remove("open");
        backdrop.classList.remove("show");
    }

    // -------------------------------------
    // Loading
    // -------------------------------------

    function showLoading() {
        loadingOverlay.classList.add("show");
    }

    function hideLoading() {
        loadingOverlay.classList.remove("show");
    }

    // -------------------------------------
    // Toast
    // -------------------------------------

    function showToast(message, type = "success") {

        const toast = document.createElement("div");

        toast.className = `toast ${type}`;

        toast.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("show");
        }, 50);

        setTimeout(() => {

            toast.classList.remove("show");

            setTimeout(() => toast.remove(), 300);

        }, 3000);

    }

    // -------------------------------------
    // Preview
    // -------------------------------------

    function updatePreview(data) {

        previewContent.innerHTML = `
            <div class="preview-banner">

                <span class="priority ${data.priority}">
                    ${data.priority.toUpperCase()}
                </span>

            </div>

            <div class="preview-title">

                <h2>${data.title}</h2>

                <div class="preview-info">

                    <span>
                        <i class="fa-solid fa-user"></i>
                        ${data.author}
                    </span>

                    <span>
                        <i class="fa-solid fa-calendar"></i>
                        ${new Date().toLocaleDateString()}
                    </span>

                </div>

            </div>

            <div class="preview-message">

                <p>${data.message}</p>

            </div>
        `;

    }

    // -------------------------------------
    // Event Listeners
    // -------------------------------------

    function init() {

        newBtn?.addEventListener("click", openDrawer);

        fabBtn?.addEventListener("click", openDrawer);

        closeBtn?.addEventListener("click", closeDrawer);

        backdrop?.addEventListener("click", closeDrawer);

        previewBtn?.addEventListener("click", () => {

            updatePreview({

                title: document.getElementById("bulletinTitle").value,

                message: document.getElementById("bulletinMessage").value,

                author: document.getElementById("bulletinAuthor").value || "Administrator",

                priority: document.getElementById("bulletinPriority").value

            });

            showToast("Preview updated");

        });

    }

    return {

        init,
        openDrawer,
        closeDrawer,
        showToast,
        showLoading,
        hideLoading,
        updatePreview

    };

})();
