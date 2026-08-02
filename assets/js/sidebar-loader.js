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
