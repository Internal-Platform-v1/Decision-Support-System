// =====================================
// Firebase Initialization
// =====================================

    const firebaseConfig = {
      apiKey: "AIzaSyDjaMdeh0Cgx00hzDyZOi54fDkR81wnxJU",
      authDomain: "bdgg-database.firebaseapp.com",
      projectId: "bdgg-database",
      storageBucket: "bdgg-database.appspot.com",
      messagingSenderId: "43574975434",
      appId: "1:43574975434:web:4c79e581267fdfcc6ccd33"
    };

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}



const db = firebase.firestore();

const auth = firebase.auth();

const BULLETIN_COLLECTION = "enterprise_bulletins";

const BulletinService = (() => {
   

    // =====================================
    // Private Helpers
    // =====================================

    function collection() {
        return db.collection(BULLETIN_COLLECTION);
    }

    function currentUser() {
        return auth.currentUser;
    }

// =====================================
// Build Bulletin Object
// =====================================

function createBulletin(data) {

    const user = currentUser();

    return {

        title: data.title?.trim() || "",

        summary: data.summary?.trim() || "",

        message: data.message?.trim() || "",

        category: data.category || "",

        priority: data.priority || "normal",

        author: data.author?.trim() || "",

        audience: data.audience || [],

attachments: data.attachments || [],

// System Fields
status: "draft",
version: 1,
views: 0,

        createdBy: user?.email || "",

        publishedBy: "",

        createdAt: firebase.firestore.FieldValue.serverTimestamp(),

        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),

        publishedAt: null

    };

}

  // =====================================
// Save Draft
// =====================================

async function saveDraft(data) {

    const bulletin = createBulletin(data);

    const docRef = await collection().add(bulletin);

    return {
        success: true,
        id: docRef.id
    };

}

    // =====================================
// Publish Bulletin
// =====================================

async function publish(data) {

    const bulletin = createBulletin(data);

    bulletin.status = "published";

    bulletin.publishedBy = currentUser()?.email || "";

    bulletin.publishedAt =
        firebase.firestore.FieldValue.serverTimestamp();

    bulletin.updatedAt =
        firebase.firestore.FieldValue.serverTimestamp();

    const docRef = await collection().add(bulletin);

    return {
        success: true,
        id: docRef.id
    };

}

// =====================================
// Listen for Published Bulletins
// =====================================

function listenPublished(callback) {

    return collection()

        .where("status", "==", "published")

        .orderBy("publishedAt", "desc")

        .onSnapshot(snapshot => {

            const bulletins = [];

            snapshot.forEach(doc => {

                bulletins.push({

                    id: doc.id,

                    ...doc.data()

                });

            });

            callback(bulletins);

        });

}    

   return {
    saveDraft,
    publish,
    listenPublished
};

})();

