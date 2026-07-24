// =====================================
// Toast Module
// =====================================

const BulletinToast = (() => {

    const container = document.getElementById("toastContainer");

    function show(message, type="success") {

        const toast = document.createElement("div");

        toast.className = `toast ${type}`;

        toast.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => toast.classList.add("show"),50);

        setTimeout(()=>{

            toast.classList.remove("show");

            setTimeout(()=>toast.remove(),300);

        },3000);

    }

    return {

        show

    };

})();
