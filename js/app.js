/* Tiny hash router: #/ is home, #/topics[/query] the catalog, #/map the concept map,
   #/playground the sandbox, #/<chapter>/<lab> a lab. */
(function () {
  "use strict";
  var app = document.getElementById("app"), destroy = null;
  Catalog.initMenu(document.querySelector(".topics-btn"), document.getElementById("topics-panel"));

  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "how") return;                         // in-page anchor on the home page
    if (destroy) { destroy(); destroy = null; }
    app.innerHTML = "";
    var ch = K.chapter(parts[0]), labs = ch ? K.chapterLabs(parts[0]) : [];
    // "Topics" stays lit on the catalog and inside any lab
    var section = ch ? "topics" : parts[0];
    document.querySelectorAll(".chapters [data-chapter]").forEach(function (a) {
      if (a.dataset.chapter === section) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (parts[0] === "topics" || (ch && !labs.length)) {
      // a chapter that's coming soon opens the catalog, filtered to it
      destroy = Catalog.mount(app, ch ? ch.title : decodeURIComponent(parts[1] || ""));
      document.title = "All topics · Kinetic";
    } else if (parts[0] === "playground") {
      destroy = Playground.mount(app, parts[1]);
      document.title = "Playground · Kinetic";
    } else if (parts[0] === "map") {
      destroy = Maps.mount(app);
      document.title = "Concept map · Kinetic";
    } else if (labs.length) {
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
