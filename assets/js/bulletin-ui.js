// =====================================
// Bulletin UI Module
// =====================================

const BulletinUI = (() => {

    const drawer = document.getElementById("composeDrawer");
    const backdrop = document.querySelector(".drawer-backdrop");

    function openDrawer(){

        drawer.classList.add("open");
        backdrop.classList.add("show");

    }

    function closeDrawer(){

        drawer.classList.remove("open");
        backdrop.classList.remove("show");

    }

    function init(){

        document.getElementById("newBulletinBtn")
            ?.addEventListener("click",openDrawer);

        document.getElementById("fabNewBulletin")
            ?.addEventListener("click",openDrawer);

        document.getElementById("closeDrawerBtn")
            ?.addEventListener("click",closeDrawer);

        backdrop?.addEventListener("click",closeDrawer);

    }

    return{

        init,
        openDrawer,
        closeDrawer

    };

})();
