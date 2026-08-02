function loadSidebarUserProfile() {

    const nameEl = document.getElementById("sidebarName");
    const roleEl = document.getElementById("sidebarRole");
    const emailEl = document.getElementById("sidebarEmail");
    const avatarEl = document.getElementById("sidebarAvatar");

    if (!nameEl || !roleEl || !emailEl || !avatarEl) return;

    if (!window.currentUserProfile) {

        nameEl.textContent = "Guest User";
        roleEl.textContent = "Not signed in";
        emailEl.textContent = "";
        avatarEl.textContent = "GU";
        return;

    }

    const profile = window.currentUserProfile;

    const fullName =
        profile.displayName ||
        profile.name ||
        "Unknown User";

    nameEl.textContent = fullName;

    roleEl.textContent =
        profile.role ||
        "Authenticated User";

    emailEl.textContent =
        profile.email || "";

    avatarEl.textContent = fullName
        .split(" ")
        .map(word => word.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase();

}

const sidebarProfileWatcher = setInterval(() => {

    if (
        window.currentUserProfile &&
        window.currentUserProfile.displayName
    ) {

        clearInterval(sidebarProfileWatcher);

        loadSidebarUserProfile();

    }

}, 100);
