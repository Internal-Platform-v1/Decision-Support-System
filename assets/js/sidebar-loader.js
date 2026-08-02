document.addEventListener("DOMContentLoaded", async () => {

    const container = document.getElementById("sidebar-container");

    if (!container) return;

    try {

        const response = await fetch("sidebar.html");

        if (!response.ok) {
            throw new Error("Unable to load sidebar.html");
        }

        container.innerHTML = await response.text();

        highlightCurrentPage();

        initializeSidebar();

    } catch (error) {

        console.error("Sidebar failed to load:", error);

    }

});

function initializeSidebar() {

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

    const container = document.getElementById("sidebar-container");

    if (!container) return;

    const activePage = container.dataset.active;

    document.querySelectorAll(".sidebar-nav .nav-item").forEach(link => {

        link.classList.remove("active");

        if (link.getAttribute("href") === activePage) {
            link.classList.add("active");
        }

    });

}
