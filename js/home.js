/* Home: a sandbox to throw things around in, and the chapter map. */
var Home = (function () {
  "use strict";

  function mount(root) {
    var st = Catalog.stats(Catalog.tree());
    function live(ch) {
      var list = K.chapterLabs(ch.id);
      return '<a class="chapter-card live" href="#/' + ch.id + "/" + list[0].id + '"><span class="tag">' + K.unitOf(ch).title + " · " + list.length + " labs</span><h3>" + ch.title + "</h3>" +
        "<p>" + ch.blurb + "</p><ul>" +
        list.map(function (l) { return "<li>" + l.title + ' <span class="muted">· ' + l.short + "</span></li>"; }).join("") + "</ul></a>";
    }
    var el = K.h(
      '<div class="home">' +
        '<section class="hero">' +
          "<div>" +
            '<p class="mono muted">IIT JEE · Physics</p>' +
            "<h1>Physics you can <em>poke</em>.</h1>" +
            '<p class="lede">Every chapter is a little lab built on a real physics engine. Change a number, throw a ball, flip your frame of reference, and watch the JEE formulas come true in front of you.</p>' +
            '<div class="cta"><a class="btn btn-primary" href="#/kinematics/line">Start with kinematics →</a><a class="btn" href="#/topics">Browse all topics</a><a class="btn" href="#/playground">Open the playground</a><a class="btn" href="#/map">See the concept map</a><a class="btn" href="#how">How it works</a></div>' +
          "</div>" +
          '<div class="play"><canvas aria-label="Physics sandbox: drag and throw the objects"></canvas>' +
            '<p class="play-hint">grab anything and throw it</p><p class="play-readout"></p></div>' +
        "</section>" +
        '<h2 class="section-title">Ready to play <a class="section-more" href="#/topics">All ' + st.chapters + " chapters →</a></h2>" +
        '<div class="chapter-grid">' +
          K.CHAPTERS.filter(function (c) { return K.chapterLabs(c.id).length; }).map(live).join("") +
          browse() +
        "</div>" +
        '<h2 class="section-title" id="how">How it works</h2>' +
        '<div class="how">' +
          "<div><b>A real engine, in SI units</b><p>Each lab runs <a href=\"https://brm.io/matter-js/\">matter.js</a> in metres and seconds, stepped 60 times a second. The engine never sees a JEE formula.</p></div>" +
          "<div><b>Formulas, checked live</b><p>Next to every simulation the textbook equations update with your numbers, and the measured result sits beside the predicted one.</p></div>" +
          "<div><b>Learn by trying</b><p>Each lab has experiments that tick themselves off when you pull them off, a note on the classic JEE trap, and one exam-style question.</p></div>" +
        "</div>" +
      "</div>");
    root.appendChild(el);
    function browse() {
      var next = K.CHAPTERS.filter(function (c) { return !K.chapterLabs(c.id).length; }).slice(0, 4).map(function (c) { return c.title; });
      return '<a class="chapter-card browse" href="#/topics"><span class="tag">catalog · ' + st.units + " units</span><h3>Browse all " + st.chapters + " chapters</h3>" +
        "<p>The whole JEE syllabus in one place. Coming next: " + next.join(", ") + '.</p><span class="go">Open the catalog →</span></a>';
    }

    /* ---------- sandbox ---------- */
    var th = K.theme, W = 800, H = 500, ppm = 20;
    var sim = new K.Sim(el.querySelector(".play canvas"), { W: W, H: H, ppm: ppm, origin: { x: 0, y: 470 }, g: 9.8, gridStep: 1, gridMajor: 5, labels: false });
    var readout = el.querySelector(".play-readout");
    var B = Matter.Bodies, wall = { isStatic: true, plugin: { k: { hidden: true } } };
    sim.add([
      B.rectangle(W / 2, 470 + 40, W + 200, 80, wall),
      B.rectangle(-40, H / 2, 80, H * 3, wall),
      B.rectangle(W + 40, H / 2, 80, H * 3, wall),
      B.rectangle(W / 2, -H * 1.5, W + 200, 80, wall),
      B.rectangle(560, 400, 260, 16, { isStatic: true, angle: -0.32, plugin: { k: { fill: th["ground-top"] } } })
    ]);
    sim.on("under", function (ctx) { sim.drawGround(ctx); });
    var colors = [th.acc, th.disp, th.vel, th.grav];
    function spawn() {
      for (var i = 0; i < 6; i++) {
        var x = 80 + Math.random() * 420, y = 60 + Math.random() * 150, c = colors[i % colors.length];
        sim.add(i % 2
          ? B.circle(x, y, 16 + Math.random() * 14, { restitution: 0.55, friction: 0.05, frictionAir: 0, plugin: { k: { fill: c } } })
          : B.rectangle(x, y, 40 + Math.random() * 20, 40 + Math.random() * 20, { restitution: 0.2, friction: 0.4, frictionAir: 0, chamfer: { radius: 6 }, plugin: { k: { fill: c } } }));
      }
    }
    spawn();

    var drag = null, watched = null, watchedUntil = 0;
    sim.pointer({
      down: function (pt) {
        var bodies = Matter.Composite.allBodies(sim.world).filter(function (b) { return !b.isStatic; });
        var hit = Matter.Query.point(bodies, { x: pt.px, y: pt.py })[0];
        if (!hit) return false;
        drag = Matter.Constraint.create({
          pointA: { x: pt.px, y: pt.py }, bodyB: hit,
          pointB: { x: pt.px - hit.position.x, y: pt.py - hit.position.y }, stiffness: 0.18, damping: 0.08, length: 0
        });
        sim.add(drag);
        watched = hit;
        return true;
      },
      drag: function (pt) { if (drag) { drag.pointA.x = pt.px; drag.pointA.y = pt.py; } },
      up: function () {
        if (!drag) return;
        sim.remove(drag); drag = null;
        watchedUntil = sim.time + 4;
      }
    });
    sim.on("over", function (ctx) {
      if (drag) {
        var b = drag.bodyB, a = { x: b.position.x + drag.pointB.x, y: b.position.y + drag.pointB.y };
        ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(drag.pointA.x, drag.pointA.y); ctx.stroke(); ctx.setLineDash([]);
      }
      if (watched && (drag || sim.time < watchedUntil)) {
        var v = Matter.Body.getVelocity(watched), k = 60 / ppm, vx = v.x * k, vy = -v.y * k, sp = Math.hypot(vx, vy);
        K.arrow(ctx, watched.position.x, watched.position.y, watched.position.x + vx * 6, watched.position.y - vy * 6, th.vel, { label: "v" });
        readout.textContent = "v = " + K.fmt(sp, 1) + " m/s";
      } else readout.textContent = "";
    });
    sim.play();

    return function destroy() { sim.destroy(); };
  }

  return { mount: mount };
})();
