/* Tiny hash router: #/ is home, #/<chapter>/<lab> is a lab. */
(function () {
  "use strict";
  var app = document.getElementById("app"), destroy = null;

  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "how") return;                         // in-page anchor on the home page
    if (destroy) { destroy(); destroy = null; }
    app.innerHTML = "";
    var labs = K.chapter(parts[0]) ? K.chapterLabs(parts[0]) : [];
    document.querySelectorAll(".chapters a[data-chapter]").forEach(function (a) {
      if (a.dataset.chapter === parts[0] && labs.length) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (labs.length) {
      var lab = labs.filter(function (l) { return l.id === parts[1]; })[0] || labs[0];
      destroy = lab.mount(app);
      document.title = lab.title + " · Kinetic";
    } else {
      destroy = Home.mount(app);
      document.title = "Kinetic · JEE physics you can play with";
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  route();
})();
