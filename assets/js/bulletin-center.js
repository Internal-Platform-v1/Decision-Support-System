document.addEventListener("DOMContentLoaded",()=>{

    BulletinUI.init();

    document
        .getElementById("previewBulletinBtn")
        .addEventListener("click",()=>{

            BulletinPreview.update({

                title:document.getElementById("bulletinTitle").value,

                author:document.getElementById("bulletinAuthor").value,

                priority:document.getElementById("bulletinPriority").value,

                message:document.getElementById("bulletinMessage").value,

                views:0

            });

            BulletinToast.show("Preview Updated");

        });

});
