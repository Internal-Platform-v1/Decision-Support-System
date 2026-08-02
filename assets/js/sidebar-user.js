function loadSidebarUserProfile() {

    console.log("===== SIDEBAR DEBUG =====");

    const nameEl = document.getElementById("sidebarName");
    const roleEl = document.getElementById("sidebarRole");
    const emailEl = document.getElementById("sidebarEmail");
    const avatarEl = document.getElementById("sidebarAvatar");

    console.log("nameEl:", nameEl);
    console.log("roleEl:", roleEl);
    console.log("emailEl:", emailEl);
    console.log("avatarEl:", avatarEl);

    console.log("currentUserProfile:", window.currentUserProfile);

    if (!nameEl || !roleEl || !emailEl || !avatarEl) {
        console.log("Missing DOM elements.");
        return;
    }

    if (!window.currentUserProfile) {
        console.log("Missing profile.");
        return;
    }

    const profile = window.currentUserProfile;

    console.log("Updating sidebar...");

    nameEl.textContent = profile.displayName;
    roleEl.textContent = profile.role;
    emailEl.textContent = profile.email;

    avatarEl.textContent = profile.displayName
        .split(" ")
        .map(x => x[0])
        .join("")
        .substring(0,2)
        .toUpperCase();

    console.log("Sidebar updated.");

}
