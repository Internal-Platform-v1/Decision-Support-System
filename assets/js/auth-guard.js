(function () {
  function waitForFirebase() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      setTimeout(waitForFirebase, 50);
      return;
    }

    const auth = firebase.auth();

    auth.onAuthStateChanged((user) => {
      const currentPage = window.location.pathname.split("/").pop() || "index.html";

      // login page
      if (currentPage === "index.html") {
        if (user && user.emailVerified) {
          window.location.replace("index-main.html");
        }
        return;
      }

      // protected pages
      if (!user) {
        window.location.replace("index.html");
        return;
      }

      if (!user.emailVerified) {
        auth.signOut().then(() => {
          window.location.replace("index.html");
        });
        return;
      }

      document.documentElement.style.visibility = "visible";
    });
  }

  waitForFirebase();
})();
