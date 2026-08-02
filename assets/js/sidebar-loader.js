document.addEventListener("DOMContentLoaded", async () => {

    const container = document.getElementById("sidebar-container");

    if (!container) return;

    try {

        const response = await fetch("sidebar.html");

        if (!response.ok) {
            throw new Error("Unable to load sidebar.html");
        }

        container.innerHTML = await response.text();

        initializeSidebar();

    } catch (error) {

        console.error(error);

    }

});

function initializeSidebar() {

    highlightCurrentPage();

    waitForUserProfile();

}

function waitForUserProfile() {

    const watcher = setInterval(() => {

        if (
            window.currentUserProfile &&
            window.currentUserProfile.displayName
        ) {

            clearInterval(watcher);

            if (typeof loadSidebarUserProfile === "function") {
                loadSidebarUserProfile();
            }

        }

    }, 100);

}

function highlightCurrentPage() {

    const currentPage = document.body.dataset.page;

    document.querySelectorAll(".sidebar-nav .nav-item").forEach(link => {

        link.classList.toggle(
            "active",
            link.dataset.page === currentPage
        );

    });

}
