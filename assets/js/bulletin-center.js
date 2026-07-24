document.addEventListener("DOMContentLoaded",()=>{

    BulletinUI.init();

    function getFormData() {

        return {

            title: document.getElementById("bulletinTitle").value,

            summary: document.getElementById("bulletinSummary").value,

            message: document.getElementById("bulletinMessage").value,

            category: document.getElementById("bulletinCategory").value,

            priority: document.getElementById("bulletinPriority").value,

            author: document.getElementById("bulletinAuthor").value,

audience: [
    document.getElementById("bulletinAudience").value.trim()
],

            attachments: []

        };

    }

    // =====================================
    // Preview Button
    // =====================================

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

    // =====================================
    // Save Draft Button
    // =====================================

    document
        .getElementById("saveDraftBtn")
        .addEventListener("click", async () => {

            try {

                const data = getFormData();

                const result = await BulletinService.saveDraft(data);

                BulletinToast.show("Draft saved successfully!");

                console.log("Draft ID:", result.id);

            } catch (error) {

                console.error(error);

                BulletinToast.show(
                    "Unable to save draft.",
                    "error"
                );

            }

        });

    // =====================================
// Publish Button
// =====================================

document
    .getElementById("publishBulletinBtn")
    .addEventListener("click", async () => {

        try {

            const data = getFormData();

            // Required field validation
            if (!data.title.trim()) {
                BulletinToast.show("Please enter a bulletin title.", "error");
                return;
            }

            if (!data.message.trim()) {
                BulletinToast.show("Please enter the bulletin message.", "error");
                return;
            }

            const result = await BulletinService.publish(data);

            BulletinToast.show("Bulletin published successfully!");

            console.log("Published ID:", result.id);

        } catch (error) {

            console.error(error);

            BulletinToast.show(
                "Unable to publish bulletin.",
                "error"
            );

        }

    });

});
