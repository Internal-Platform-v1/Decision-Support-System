(function () {
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();

  auth.onAuthStateChanged((user) => {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const publicPages = ["login.html"];

    if (!user && !publicPages.includes(currentPage)) {
      window.location.replace("login.html");
      return;
    }

    if (user && !user.emailVerified && !publicPages.includes(currentPage)) {
      auth.signOut().then(() => {
        window.location.replace("login.html");
      });
      return;
    }

    document.documentElement.style.visibility = "visible";
  });
})();
