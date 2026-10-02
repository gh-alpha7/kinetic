/* Catalog: every unit, chapter and lab in one place (#/topics), and the Topics menu in the header.
   Both are built from K.UNITS / K.CHAPTERS / the registered labs, so new chapters show up by themselves. */
var Catalog = (function () {
  "use strict";

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function plain(s) { return String(s || "").replace(/\$([^$]*)\$/g, "$1").replace(/\\[a-z]+/gi, ""); }
  function href(l) { return "#/" + l.chapter + "/" + l.id; }

  // the whole syllabus, with progress and search text worked out once
  function tree() {
    return K.UNITS.map(function (u) {
      var chapters = K.CHAPTERS.filter(function (c) { return c.unit === u.id; }).map(function (c) {
        var labs = K.chapterLabs(c.id).map(function (l) {
          var done = K.progress(l.id, l.tries.length);
          return { lab: l, done: done, total: l.tries.length,
            text: [l.title, l.short, plain(l.lede)].concat(l.tries.map(function (t) { return t.title; })).join(" ").toLowerCase() };
        });
        var done = 0, total = 0;
        labs.forEach(function (l) { done += l.done; total += l.total; });
        return { ch: c, labs: labs, live: labs.length > 0, done: done, total: total,
          text: [c.title, c.blurb].concat(c.planned || []).join(" ").toLowerCase() };
      });
      return { unit: u, chapters: chapters };
    });
  }
  function stats(t) {
    var s = { units: t.length, chapters: 0, live: 0, labs: 0 };
    t.forEach(function (u) { u.chapters.forEach(function (c) { s.chapters++; if (c.live) s.live++; s.labs += c.labs.length; }); });
    return s;
  }

  /* ---------- #/topics ---------- */
  function mount(root, query) {
    var t = tree(), st = stats(t), filter = "all";
    var el = K.h(
      '<section class="cat">' +
        '<header class="lab-head"><p class="eyebrow">Catalog · IIT JEE physics</p><h1>All topics</h1>' +
          '<p class="lede">' + st.live + " chapters ready to play, " + st.labs + " labs, and " + (st.chapters - st.live) + " more on the way. Every lab is a simulation you can poke, with formulas checked live and practice from easy to hard.</p></header>" +
        '<div class="cat-bar">' +
          '<label class="cat-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>' +
            '<input type="search" placeholder="Search topics: friction, orbit, Atwood, lenses…" aria-label="Search topics" /></label>' +
          '<span class="cat-filter"></span>' +
        "</div>" +
        '<div class="cat-body">' +
          '<nav class="cat-units" aria-label="Units"></nav>' +
          '<div class="cat-main">' +
            '<div class="cat-tools">' +
              '<a class="cat-tool" href="#/playground"><b>Playground</b><span>Build your own system from blocks, pulleys, springs, ramps and planets, then run it.</span></a>' +
              '<a class="cat-tool" href="#/map"><b>Concept map</b><span>Every idea linked by cause and effect. Tap one to see what drives it.</span></a>' +
            "</div>" +
            '<div class="cat-units-list"></div>' +
            '<p class="cat-empty muted" hidden>No topics match. Try a broader word, like “force” or “energy”.</p>' +
          "</div>" +
        "</div>" +
      "</section>");
    root.appendChild(el);
    var input = el.querySelector(".cat-search input"), list = el.querySelector(".cat-units-list"), side = el.querySelector(".cat-units");
    el.querySelector(".cat-filter").appendChild(K.seg([{ label: "All", value: "all" }, { label: "Ready to play", value: "live" }, { label: "Coming soon", value: "soon" }], "all",
      function (v) { filter = v; render(); }, "Show"));
    input.value = query || "";
    input.addEventListener("input", render);

    function chapterCard(c, q) {
      var ch = c.ch;
      if (!c.live) {
        return '<article class="cat-ch soon" id="ch-' + ch.id + '"><span class="tag">coming soon</span><h3>' + esc(ch.title) + "</h3><p>" + esc(ch.blurb) + "</p>" +
          '<ul class="cat-planned">' + (ch.planned || []).map(function (p) { return "<li" + (q && p.toLowerCase().indexOf(q) !== -1 ? ' class="hit"' : "") + ">" + esc(p) + "</li>"; }).join("") + "</ul></article>";
      }
      var pct = c.total ? Math.round(100 * c.done / c.total) : 0;
      return '<article class="cat-ch live" id="ch-' + ch.id + '">' +
        '<span class="tag">' + c.labs.length + " labs" + (c.done ? " · " + pct + "% explored" : "") + "</span>" +
        '<h3><a href="' + href(c.labs[0].lab) + '">' + esc(ch.title) + "</a></h3><p>" + esc(ch.blurb) + "</p>" +
        '<div class="cat-prog" aria-label="' + c.done + " of " + c.total + ' experiments done"><i style="width:' + pct + '%"></i></div>' +
        '<ol class="cat-labs">' + c.labs.map(function (l, i) {
          var hit = q && l.text.indexOf(q) !== -1;
          return '<li' + (hit ? ' class="hit"' : "") + '><a href="' + href(l.lab) + '"><span class="n">' + (i + 1) + "</span><span><b>" + esc(l.lab.title) + "</b><small>" + esc(l.lab.short) + "</small></span>" +
            '<em class="' + (l.done === l.total ? "full" : "") + '">' + (l.done ? l.done + "/" + l.total : "") + "</em></a></li>";
        }).join("") + "</ol></article>";
    }

    function render() {
      var q = input.value.trim().toLowerCase(), any = false, sideHtml = "", html = "";
      t.forEach(function (u) {
        var shown = u.chapters.filter(function (c) {
          if (filter === "live" && !c.live) return false;
          if (filter === "soon" && c.live) return false;
          return !q || c.text.indexOf(q) !== -1 || c.labs.some(function (l) { return l.text.indexOf(q) !== -1; });
        });
        var live = u.chapters.filter(function (c) { return c.live; }).length;
        sideHtml += '<button type="button" data-unit="' + u.unit.id + '"' + (shown.length ? "" : " disabled") + '><i class="u-' + u.unit.id + '"></i>' + esc(u.unit.title) +
          '<small>' + (live ? live + " live · " : "") + u.chapters.length + "</small></button>";
        if (!shown.length) return;
        any = true;
        html += '<section class="cat-unit" id="unit-' + u.unit.id + '"><header><h2><i class="u-' + u.unit.id + '"></i>' + esc(u.unit.title) + "</h2><p>" + esc(u.unit.blurb) +
          ' <span class="muted mono">' + live + " of " + u.chapters.length + " chapters live</span></p></header>" +
          '<div class="cat-grid">' + shown.map(function (c) { return chapterCard(c, q); }).join("") + "</div></section>";
      });
      list.innerHTML = html;
      side.innerHTML = sideHtml;
      el.querySelector(".cat-empty").hidden = any;
      el.querySelector(".cat-tools").hidden = !!q || filter === "soon";
    }
    side.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-unit]");
      if (!b) return;
      var s = el.querySelector("#unit-" + b.dataset.unit);
      if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    render();
    if (query) input.focus();
    return function () {};
  }

  /* ---------- Topics menu in the header ---------- */
  function initMenu(btn, panel) {
    function build() {
      var t = tree();
      panel.innerHTML =
        '<div class="tm-inner">' +
          '<form class="tm-search" role="search"><input type="search" placeholder="Search topics…" aria-label="Search topics" /><button class="btn btn-sm" type="submit">Search</button></form>' +
          '<div class="tm-grid">' + t.map(function (u) {
            return '<div class="tm-unit"><h3><i class="u-' + u.unit.id + '"></i>' + esc(u.unit.title) + "</h3><ul>" + u.chapters.map(function (c) {
              if (!c.live) return '<li class="soon">' + esc(c.ch.title) + "</li>";
              return '<li><a class="tm-ch" href="' + href(c.labs[0].lab) + '">' + esc(c.ch.title) + "</a><ul>" +
                c.labs.map(function (l) { return '<li><a href="' + href(l.lab) + '">' + esc(l.lab.title) + "</a></li>"; }).join("") + "</ul></li>";
            }).join("") + "</ul></div>";
          }).join("") + "</div>" +
          '<div class="tm-foot"><a class="btn btn-sm btn-primary" href="#/topics">Browse all topics →</a><a class="btn btn-sm" href="#/playground">Playground</a><a class="btn btn-sm" href="#/map">Concept map</a></div>' +
        "</div>";
      panel.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();
        var v = panel.querySelector("input").value.trim();
        close();
        location.hash = "#/topics" + (v ? "/" + encodeURIComponent(v) : "");
      });
    }
    function open() { build(); panel.hidden = false; btn.setAttribute("aria-expanded", "true"); var i = panel.querySelector("input"); if (i && matchMedia("(hover: hover)").matches) i.focus(); }
    function close() { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function (e) { e.stopPropagation(); if (panel.hidden) open(); else close(); });
    panel.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) { close(); btn.focus(); } });
    window.addEventListener("hashchange", close);
  }

  return { mount: mount, initMenu: initMenu, tree: tree, stats: stats };
})();
