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

window.auth = firebase.auth();
window.db = firebase.firestore();

window.ALLOWED_DOMAIN = "@fedexfreight.com";
window.APPROVED_USERS_COLLECTION = "approved_users";
window.LOGIN_PAGE = "index.html";
