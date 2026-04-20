(function () {
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

  firebase.auth().onAuthStateChanged((user) => {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const publicPages = ["login.html"];

    if (!user && !publicPages.includes(currentPage)) {
      window.location.replace("login.html");
      return;
    }

    if (user && !user.emailVerified && !publicPages.includes(currentPage)) {
      firebase.auth().signOut().then(() => {
        window.location.replace("login.html");
      });
      return;
    }

    document.documentElement.style.visibility = "visible";
  });
})();
