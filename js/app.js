/* Tiny hash router: #/ is home, #/kinematics/<lab> is a lab. */
(function () {
  "use strict";
  var app = document.getElementById("app"), destroy = null;

  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "how") return;                         // in-page anchor on the home page
    if (destroy) { destroy(); destroy = null; }
    app.innerHTML = "";
    var nav = document.querySelector('.chapters a[data-chapter="kinematics"]');
    if (parts[0] === "kinematics") {
      var lab = K.labs.filter(function (l) { return l.id === parts[1]; })[0] || K.labs[0];
      destroy = lab.mount(app);
      document.title = lab.title + " · Kinetic";
      nav.setAttribute("aria-current", "page");
    } else {
      destroy = Home.mount(app);
      document.title = "Kinetic · JEE physics you can play with";
      nav.removeAttribute("aria-current");
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  route();
})();
