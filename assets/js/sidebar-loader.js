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

    const current = window.location.pathname
        .split("/")
        .pop() || "operations-console.html";

    document.querySelectorAll(".sidebar-nav .nav-item").forEach(link => {

        const href = link.getAttribute("href");

        link.classList.remove("active");

        if (href === current) {
            link.classList.add("active");
        }

    });

}
