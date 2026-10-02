/* Lab 2: projectile motion. A launcher, gravity you can change, and crates to knock over. */
(function () {
  "use strict";
  var R_BALL = 0.9;                 // m
  var PLANETS = [{ label: "Moon", value: 1.62 }, { label: "Mars", value: 3.71 }, { label: "Earth", value: 9.8 }, { label: "Jupiter", value: 24.8 }];

  var lab = {
    id: "projectile", chapter: "kinematics", title: "Projectile motion", short: "two motions at once",
    lede: "Drag back from the launcher to aim, or use the sliders. The ball only knows about gravity, yet it traces the exact parabola the formulas predict.",
    tries: [
      { id: "pair", title: "Find two angles that land on the same spot",
        text: "From the ground ($h = 0$), same speed, two different angles, same range.",
        why: "Range depends on $\\sin 2\\theta$, and $\\sin 2\\theta = \\sin(180° - 2\\theta)$. So $\\theta$ and $90° - \\theta$ (say 30° and 60°) land together; the higher one just stays up longer." },
      { id: "max", title: "Find the angle for maximum range",
        text: "From the ground, fire at least three angles with the same speed and find the farthest one.",
        why: "$\\sin 2\\theta$ peaks at $2\\theta = 90°$, so 45° wins when you land at the height you launched from. From a tower ($h > 0$) the best angle is a little below 45°." },
      { id: "target", title: "Knock over the crate stack",
        text: "Work out an angle and speed that reach the crates.",
        why: "You just solved $R = u^2 \\sin 2\\theta / g$ by experiment. In JEE you'd be given $R$ and $u$ and asked for $\\theta$, and there are usually two answers." },
      { id: "planet", title: "Repeat a shot on another planet",
        text: "Keep speed, angle and height the same; change only gravity.",
        why: "Range, height and flight time all scale with $1/g$. On the Moon ($g \\approx 1.6$) the same throw goes about 6 times farther and stays up 6 times longer." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 560, ppm = 8, origin = { x: 60, y: 500 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 9.8, gridStep: 1, gridMajor: 10 });
    sim.zoom = 1;

    /* ---------- controls ---------- */
    var uS = K.slider({ label: "Launch speed $u$", unit: "m/s", min: 5, max: 35, step: 0.5, value: 22, onInput: changed });
    var thS = K.slider({ label: "Launch angle $\\theta$", unit: "°", min: 0, max: 90, step: 1, value: 45, onInput: changed });
    var hS = K.slider({ label: "Launch height $h$", unit: "m", min: 0, max: 40, step: 1, value: 0, onInput: function () { buildTower(); changed(); },
      hint: "Fire from a tower, a classic JEE twist." });
    var g = 9.8;
    var show = { path: true, vec: true, comp: true };
    P.controls.innerHTML = "<h3>Launch</h3>";
    [uS, thS, hS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Gravity</h3>"));
    P.controls.appendChild(K.seg(PLANETS, 9.8, function (v) { g = v; sim.setG(v); changed(); }, "Planet"));
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Predicted path", true, function (v) { show.path = v; }));
    row.appendChild(K.check("Vectors", true, function (v) { show.vec = v; }));
    row.appendChild(K.check("x / y shadows", true, function (v) { show.comp = v; }));
    P.controls.appendChild(row);
    var tRow = K.h('<div class="row"></div>');
    var newTarget = K.h('<button class="btn btn-sm" type="button">New target</button>');
    var clearBtn = K.h('<button class="btn btn-sm" type="button">Clear trails</button>');
    newTarget.addEventListener("click", function () { buildCrates(true); });
    clearBtn.addEventListener("click", function () { shots = []; renderShots(); });
    tRow.appendChild(newTarget); tRow.appendChild(clearBtn);
    P.controls.appendChild(tRow);

    function params() { return { u: uS.get(), th: thS.get(), h: hS.get(), g: g }; }
    function theory(p) {
      var s = Math.sin(p.th * K.DEG), c = Math.cos(p.th * K.DEG);
      var T = (p.u * s + Math.sqrt(p.u * p.u * s * s + 2 * p.g * p.h)) / p.g;
      return { T: T, H: p.h + p.u * p.u * s * s / (2 * p.g), R: p.u * c * T, tTop: p.u * s / p.g, s: s, c: c };
    }

    /* ---------- world ---------- */
    var ground = sim.add(Matter.Bodies.rectangle(sim.px(600, -5).x, sim.px(600, -5).y, 1300 * ppm, 10 * ppm,
      { isStatic: true, friction: 0.8, label: "ground", plugin: { k: { hidden: true } } }));
    var tower = null, crates = [], ball = null, flight = null, shots = [], targetX = 60, settleUntil = 0;
    var aim = null;

    function buildTower() {
      if (tower) sim.remove(tower);
      tower = null;
      var hh = hS.get();
      if (hh > 0) {
        var c = sim.px(-1.2, hh / 2);
        tower = sim.add(Matter.Bodies.rectangle(c.x, c.y, 3.4 * ppm, hh * ppm, { isStatic: true, label: "tower", plugin: { k: { draw: drawTower } } }));
      }
    }
    function buildCrates(moveIt) {
      crates.forEach(function (b) { sim.remove(b); });
      crates = [];
      if (moveIt) targetX = Math.round(30 + Math.random() * 60);
      var size = 2.6;
      [[0, 0], [size, 0], [size / 2, size]].forEach(function (o, i) {
        var c = sim.px(targetX + o[0], size / 2 + o[1] + 0.01);
        crates.push(sim.add(Matter.Bodies.rectangle(c.x, c.y, size * ppm, size * ppm, {
          friction: 0.5, frictionStatic: 0.6, restitution: 0.1, density: 0.00025, label: "crate", plugin: { k: { draw: drawCrate, i: i } }
        })));
      });
      changed();
    }

    function launchPoint() { return { x: 0, y: hS.get() + R_BALL }; }

    function fire() {
      var p = params(), t = theory(p);
      if (ball) sim.remove(ball);
      var lp = launchPoint(), c = sim.px(lp.x, lp.y);
      ball = sim.add(Matter.Bodies.circle(c.x, c.y, R_BALL * ppm, {
        frictionAir: 0, friction: 0.4, restitution: 0.35, density: 0.012, label: "ball", plugin: { k: { draw: drawBall } }
      }));
      sim.setVel(ball, p.u * t.c, p.u * t.s, 0, -p.g);
      sim.resetClock();
      flight = { p: p, t: t, path: [[0, p.h]], vel: [[p.u * t.c, p.u * t.s]], top: p.h, done: false, contact: null,
        xs: [0], ys: [p.h], color: th.ink };
      settleUntil = 0;
      sim.play(); transportUI.render();
    }

    sim.collide(function (ev) {
      if (!flight || flight.done) return;
      if (sim.steps < 3) return;            // it starts out touching the ground or tower
      ev.pairs.forEach(function (pr) {
        var other = pr.bodyA === ball ? pr.bodyB : pr.bodyB === ball ? pr.bodyA : null;
        if (!other) return;
        if (!flight.contact) flight.contact = other.label;
        if (other.label === "crate" && !flight.hit) {
          flight.hit = true;
          K.flash(P.note, "Direct hit!");
          tries.mark("target");
        }
      });
    });

    sim.on("step", function (time) {
      if (!flight || !ball) return;
      if (!flight.done) {
        if (flight.contact) {
          finish();
        } else {
          var pm = sim.posM(ball), v = sim.getVel(ball, 0, -flight.p.g);
          flight.path.push([pm.x, pm.y - R_BALL]);
          flight.vel.push([v.x, v.y]);
          flight.top = Math.max(flight.top, pm.y - R_BALL);
          if (sim.steps % 15 === 0) { flight.xs.push(pm.x); flight.ys.push(pm.y - R_BALL); }
          if (pm.x > 1250) finish();
        }
        update();
      } else if (sim.time >= settleUntil) {
        sim.pause(); transportUI.render();
      }
      void time;
    });

    // The ball touched something between the last step and this one: find the exact
    // moment it reached ground level by solving the last 1/60 s of free fall.
    function finish() {
      var f = flight, n = f.path.length - 1, last = f.path[n], v = f.vel[n], gg = f.p.g;
      var tau = 0;
      if (f.contact === "ground") {
        var a = -0.5 * gg, b = v[1], c = last[1];
        var disc = b * b - 4 * a * c;
        tau = disc >= 0 ? (-b - Math.sqrt(disc)) / (2 * a) : 0;
        if (!(tau >= 0 && tau <= 2 * K.DT)) tau = 0;
      }
      f.T = n * K.DT + tau;
      f.R = last[0] + v[0] * tau;
      f.H = f.top;
      f.path.push([f.R, f.contact === "ground" ? 0 : last[1] + v[1] * tau - 0.5 * gg * tau * tau]);
      f.done = true;
      settleUntil = sim.time + 1.6;
      shots.push(f);
      if (shots.length > 6) shots.shift();
      checkTries(f);
      renderShots();
      update(true);
      K.flash(P.note, f.contact === "ground" ? "Landed at " + K.fmt(f.R, 1) + " m" : "Hit the " + f.contact + "!");
    }

    function same(a, b, k) { return Math.abs(a[k] - b[k]) < 1e-6; }
    function checkTries(f) {
      if (f.contact !== "ground") return;
      shots.forEach(function (s) {
        if (s === f || s.contact !== "ground") return;
        if (same(s.p, f.p, "u") && same(s.p, f.p, "g") && s.p.h === 0 && f.p.h === 0 &&
            Math.abs(s.p.th - f.p.th) >= 4 && Math.abs(s.p.th + f.p.th - 90) <= 2 && Math.abs(s.R - f.R) / Math.max(s.R, f.R) <= 0.03) {
          tries.mark("pair");
        }
        if (same(s.p, f.p, "u") && same(s.p, f.p, "th") && same(s.p, f.p, "h") && !same(s.p, f.p, "g")) tries.mark("planet");
      });
      if (f.p.h === 0 && Math.abs(f.p.th - 45) <= 1) {
        var lower = shots.filter(function (s) { return s !== f && s.contact === "ground" && s.p.h === 0 && same(s.p, f.p, "u") && same(s.p, f.p, "g") && s.R < f.R; });
        if (lower.length >= 2) tries.mark("max");
      }
    }

    /* ---------- aiming by drag ---------- */
    sim.pointer({
      down: function (pt) {
        var lp = launchPoint();
        if (Math.hypot(pt.m.x - lp.x, pt.m.y - lp.y) > sim.u(60) / ppm) return false;
        aim = pt.m;
        return true;
      },
      drag: function (pt) {
        aim = pt.m;
        var lp = launchPoint(), dx = lp.x - pt.m.x, dy = lp.y - pt.m.y, dist = Math.hypot(dx, dy);
        var ang = K.clamp(Math.round(Math.atan2(dy, dx) / K.DEG), 0, 90);
        // pull distance in screen px -> speed, so it feels the same at every zoom
        var speed = K.clamp(Math.round(dist * ppm * sim.zoom / 4.5 * 2) / 2, 5, 35);
        thS.set(ang); uS.set(speed); changed();
      },
      up: function () { if (aim) { aim = null; fire(); } }
    });

    /* ---------- camera ---------- */
    var zoomTarget = 1;
    function changed() {
      var p = params(), t = theory(p);
      var xNeed = Math.max(t.R, targetX + 6, 20) + 8, yNeed = Math.max(t.H, p.h) + 8;
      // zoom out for long shots, and in (up to 2.2x) so short ones still fill the stage
      zoomTarget = Math.min(2.2, W / (origin.x + xNeed * ppm), H / (yNeed * ppm + (H - origin.y)));
      renderMaths();
    }
    sim.on("under", function (ctx) {
      sim.zoom += (zoomTarget - sim.zoom) * 0.12;
      if (Math.abs(zoomTarget - sim.zoom) < 1e-4) sim.zoom = zoomTarget;
      sim.drawGround(ctx);
      // old shots
      shots.forEach(function (s, i) {
        if (s === flight && !s.done) return;
        drawPath(ctx, s.path, K.alpha(th.muted, 0.25 + 0.5 * (i + 1) / shots.length), [], 2);
        var end = s.path[s.path.length - 1], e = sim.px(end[0], end[1]);
        K.label(ctx, s.p.th + "°", e.x, e.y - sim.u(4), th.muted, { s: sim.u(1) });
      });
      // prediction
      var p = params(), t = theory(p);
      if (show.path || aim) {
        var pts = [];
        for (var i = 0; i <= 80; i++) {
          var tt = t.T * i / 80;
          pts.push([p.u * t.c * tt, p.h + p.u * t.s * tt - 0.5 * p.g * tt * tt]);
        }
        drawPath(ctx, pts, th.vel, [sim.u(6), sim.u(6)], 1.5);
        var top = sim.px(p.u * t.c * t.tTop, t.H), land = sim.px(t.R, 0);
        if (t.H > p.h + 0.3) K.label(ctx, "H = " + K.fmt(t.H, 1) + " m", top.x, top.y - sim.u(6), th.vel, { s: sim.u(1), bg: true });
        K.label(ctx, "R = " + K.fmt(t.R, 1) + " m", land.x, land.y - sim.u(10), th.vel, { s: sim.u(1), bg: true });
      }
      // component shadows
      if (show.comp && flight) {
        var gy = sim.px(0, 0).y, axisX = sim.px(-6, 0).x;
        ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = sim.u(1);
        ctx.beginPath(); ctx.moveTo(axisX, gy); ctx.lineTo(axisX, sim.px(0, Math.max(flight.top, 4) + 2).y); ctx.stroke();
        ctx.fillStyle = K.alpha(th.disp, 0.55);
        flight.xs.forEach(function (xm) { var q = sim.px(xm, 0); dot(ctx, q.x, gy - sim.u(5), sim.u(3)); });
        flight.ys.forEach(function (ym) { var q = sim.px(-6, ym); dot(ctx, axisX, q.y, sim.u(3)); });
        if (!flight.done && ball) {
          var bp = sim.posM(ball), bx = sim.px(bp.x, 0), by = sim.px(-6, bp.y - R_BALL);
          ctx.fillStyle = th.disp;
          dot(ctx, bx.x, gy - sim.u(5), sim.u(5)); dot(ctx, axisX, by.y, sim.u(5));
          ctx.setLineDash([sim.u(3), sim.u(4)]); ctx.strokeStyle = K.alpha(th.disp, 0.5);
          var bpx = sim.px(bp.x, bp.y);
          ctx.beginPath(); ctx.moveTo(bpx.x, bpx.y); ctx.lineTo(bx.x, gy - sim.u(5)); ctx.moveTo(bpx.x, bpx.y); ctx.lineTo(axisX, bpx.y); ctx.stroke();
          ctx.setLineDash([]);
        }
        K.label(ctx, "x-shadow: evenly spaced", sim.px(1, 0).x, gy + sim.u(32), th.disp, { s: sim.u(1), align: "left" });
        K.label(ctx, "y-shadow", axisX, sim.px(0, Math.max(flight.top, 4) + 2).y - sim.u(2), th.disp, { s: sim.u(1) });
      }
      if (flight) drawPath(ctx, flight.path, th.ink, [], 2.5);
    });
    sim.on("over", function (ctx) {
      drawLauncher(ctx);
      if (aim) {
        var lp = sim.px(launchPoint().x, launchPoint().y), ap = sim.px(aim.x, aim.y);
        ctx.strokeStyle = th.acc; ctx.lineWidth = sim.u(2); ctx.setLineDash([sim.u(4), sim.u(4)]);
        ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(ap.x, ap.y); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, uS.get() + " m/s at " + thS.get() + "°", ap.x, ap.y - sim.u(10), th.acc, { s: sim.u(1), bg: true });
      }
      if (ball && flight && !flight.done && show.vec) {
        var v = sim.getVel(ball, 0, -flight.p.g), b = ball.position, k = sim.u(2.4), s = sim.u(1);
        K.arrow(ctx, b.x, b.y, b.x + v.x * k, b.y, K.alpha(th.vel, 0.75), { s: s, dash: [4, 4], label: "vx", lx: 4 });
        K.arrow(ctx, b.x, b.y, b.x, b.y - v.y * k, K.alpha(th.vel, 0.75), { s: s, dash: [4, 4], label: "vy", ly: v.y > 0 ? -6 : 6 });
        K.arrow(ctx, b.x, b.y, b.x + v.x * k, b.y - v.y * k, th.vel, { s: s, label: "v" });
        K.arrow(ctx, b.x + sim.u(18), b.y, b.x + sim.u(18), b.y + sim.u(34), th.grav, { s: s, label: "g", lx: 5 });
        if (Math.abs(v.y) < flight.p.g * K.DT * 1.5) K.flash(P.note, "Top of the path: vy = 0, but vx doesn't change", 1600);
      }
      if (!flight && !aim) {
        var lp2 = sim.px(launchPoint().x, launchPoint().y);
        K.label(ctx, "drag back from here to aim ↙", lp2.x + sim.u(20), lp2.y - sim.u(24), th.muted, { s: sim.u(1), align: "left" });
      }
    });

    function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function drawPath(ctx, pts, color, dash, width) {
      if (!pts.length) return;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = sim.u(width); ctx.lineJoin = "round"; ctx.setLineDash(dash);
      ctx.beginPath();
      pts.forEach(function (p, i) { var q = sim.px(p[0], p[1] + R_BALL); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      ctx.stroke(); ctx.restore();
    }
    function drawBall(ctx, b) {
      var r = Math.max(b.circleRadius, sim.u(5));
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.arc(b.position.x - r * .35, b.position.y - r * .35, r * .3, 0, Math.PI * 2); ctx.fill();
    }
    function drawLauncher(ctx) {
      var lp = launchPoint(), c = sim.px(lp.x, lp.y), a = thS.get() * K.DEG, L = Math.max(4 * ppm, sim.u(26));
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-a);
      ctx.fillStyle = th.body; ctx.fillRect(0, -sim.u(5), L, sim.u(10));
      ctx.restore();
      ctx.fillStyle = th.body; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1.3 * ppm, sim.u(9)), 0, Math.PI * 2); ctx.fill();
    }
    function drawTower(ctx, b) {
      ctx.fillStyle = th.bank;
      ctx.beginPath(); b.vertices.forEach(function (v, i) { if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y); }); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = sim.u(1); ctx.stroke();
      var top = sim.px(1.2, hS.get());
      K.label(ctx, "h = " + hS.get() + " m", top.x + sim.u(6), top.y + sim.u(18), th.muted, { s: sim.u(1), align: "left" });
    }
    function drawCrate(ctx, b) {
      ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
      var s = 2.6 * ppm;
      ctx.fillStyle = "#c08a4d"; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = Math.max(1.5, sim.u(1.5));
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2); ctx.stroke();
      ctx.restore();
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">y–t</b> · up, slows, stops, falls: a parabola in time</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">vₓ and v_y vs t</b> · vₓ is flat, v_y falls by g every second</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">x–t</b> · a straight line: no horizontal force</p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gy = new K.Graph(cv[0], { yLabel: "y (m)", xMax: 1, xAuto: true, yMin: 0, color: th.disp });
    var gv = new K.Graph(cv[1], { yLabel: "v (m/s)", xMax: 1, xAuto: true, color: th.vel });
    var gxg = new K.Graph(cv[2], { yLabel: "x (m)", xMax: 1, xAuto: true, yMin: 0, color: th.disp });

    function update(force) {
      var p = flight ? flight.p : params(), t = flight ? flight.t : theory(p);
      var ty = [], tx = [], tvx = [], tvy = [];
      for (var i = 0; i <= 60; i++) {
        var tt = t.T * i / 60;
        ty.push([tt, p.h + p.u * t.s * tt - 0.5 * p.g * tt * tt]);
        tx.push([tt, p.u * t.c * tt]);
        tvx.push([tt, p.u * t.c]); tvy.push([tt, p.u * t.s - p.g * tt]);
      }
      gy.set("theory", { points: ty, color: th.disp, dash: [5, 5], width: 1.5 });
      gxg.set("theory", { points: tx, color: th.disp, dash: [5, 5], width: 1.5 });
      gv.set("tvx", { points: tvx, color: K.alpha(th.vel, 0.6), dash: [5, 5], width: 1.5 });
      gv.set("tvy", { points: tvy, color: th.vel, dash: [5, 5], width: 1.5 });
      if (flight) {
        var dt = K.DT;
        gy.set("sim", { points: flight.path.map(function (q, i) { return [Math.min(i * dt, flight.T || 1e9), q[1]]; }), color: th.disp, width: 2.5, dot: true });
        gxg.set("sim", { points: flight.path.map(function (q, i) { return [Math.min(i * dt, flight.T || 1e9), q[0]]; }), color: th.disp, width: 2.5, dot: true });
        gv.set("svx", { points: flight.vel.map(function (q, i) { return [i * dt, q[0]]; }), color: K.alpha(th.vel, 0.6), width: 2.5 });
        gv.set("svy", { points: flight.vel.map(function (q, i) { return [i * dt, q[1]]; }), color: th.vel, width: 2.5, dot: true });
      } else {
        ["sim"].forEach(function (k) { delete gy.series[k]; delete gxg.series[k]; });
        delete gv.series.svx; delete gv.series.svy;
      }
      [gy, gv, gxg].forEach(function (gr) { gr.dirty = true; gr.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Horizontal: no force, steady", "Vertical: a throw upward", "Time of flight", "Maximum height", "Range"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "T", label: "time of flight" }, { id: "H", label: "max height", cls: "c-disp" }, { id: "R", label: "range", cls: "c-disp" },
      { id: "vx", label: "vₓ now", cls: "c-vel" }, { id: "vy", label: "v_y now", cls: "c-vel" }, { id: "g", label: "gravity", cls: "c-grav" }
    ]);
    var slowMaths = K.throttle(renderMaths, 100);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      var p = params(), t = theory(p);
      var live = flight && flight.p, fp = live ? flight.p : p, ft = live ? flight.t : t;
      var tn = flight ? (flight.done ? flight.T : (flight.path.length - 1) * K.DT) : 0;
      var xn = fp.u * ft.c * tn, yn = fp.h + fp.u * ft.s * tn - 0.5 * fp.g * tn * tn;
      K.tex(eqEls[0], "x = u\\cos\\theta\\,t = " + fp.u + "\\cos" + fp.th + "^\\circ\\times" + n(tn, 2) + " = \\mathbf{" + K.fmt(xn, 1) + "}\\ \\text{m}");
      K.tex(eqEls[1], "y = h + u\\sin\\theta\\,t - \\tfrac12 g t^2 = " + fp.h + " + " + fp.u + "\\sin" + fp.th + "^\\circ\\times" + n(tn, 2) + " - \\tfrac12(" + fp.g + ")" + n(tn, 2) + "^2 = \\mathbf{" + K.fmt(yn, 1) + "}\\ \\text{m}");
      if (p.h === 0) {
        K.tex(eqEls[2], "T = \\frac{2u\\sin\\theta}{g} = \\frac{2(" + p.u + ")\\sin" + p.th + "^\\circ}{" + p.g + "} = \\mathbf{" + K.fmt(t.T, 2) + "}\\ \\text{s}");
        K.tex(eqEls[4], "R = \\frac{u^2\\sin 2\\theta}{g} = \\frac{" + p.u + "^2\\sin" + (2 * p.th) + "^\\circ}{" + p.g + "} = \\mathbf{" + K.fmt(t.R, 1) + "}\\ \\text{m}");
      } else {
        K.tex(eqEls[2], "T = \\frac{u\\sin\\theta + \\sqrt{u^2\\sin^2\\theta + 2gh}}{g} = \\mathbf{" + K.fmt(t.T, 2) + "}\\ \\text{s}");
        K.tex(eqEls[4], "R = u\\cos\\theta\\,T = " + p.u + "\\cos" + p.th + "^\\circ\\times" + K.fmt(t.T, 2) + " = \\mathbf{" + K.fmt(t.R, 1) + "}\\ \\text{m}");
      }
      K.tex(eqEls[3], "H = h + \\frac{u^2\\sin^2\\theta}{2g} = " + p.h + " + \\frac{" + p.u + "^2\\sin^2" + p.th + "^\\circ}{2(" + p.g + ")} = \\mathbf{" + K.fmt(t.H, 1) + "}\\ \\text{m}");
      var f = flight && flight.done ? flight : null;
      setR("T", f ? K.fmt(f.T, 2) + " s" : "—", "formula " + K.fmt(t.T, 2) + " s");
      setR("H", f ? K.fmt(f.H, 2) + " m" : "—", "formula " + K.fmt(t.H, 2) + " m");
      setR("R", f ? K.fmt(f.R, 2) + " m" : "—", f && f.contact !== "ground" ? "hit the " + f.contact : "formula " + K.fmt(t.R, 2) + " m");
      var v = ball && flight && !flight.done ? sim.getVel(ball, 0, -flight.p.g) : { x: p.u * t.c, y: p.u * t.s };
      setR("vx", K.fmt(v.x, 2) + " m/s", "never changes");
      setR("vy", K.fmt(v.y, 2) + " m/s", "drops 1 g per second");
      setR("g", K.fmt(p.g, 2) + " m/s²", PLANETS.filter(function (q) { return q.value === p.g; })[0].label);
    }
    function renderShots() { update(true); }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A projectile is <b>two motions running at once</b>. Sideways nothing pushes it, so $v_x = u\\cos\\theta$ never changes: watch the blue <i>x-shadow</i> on the ground, with its dots evenly spaced. " +
      "Up-and-down it's a ball thrown straight up: $v_y$ starts at $u\\sin\\theta$, drops by $g$ every second, is zero at the top, and the <i>y-shadow</i> bunches up there.</p>" +
      "<p>Combine them and the path is a parabola: $y = x\\tan\\theta - \\dfrac{g x^2}{2u^2\\cos^2\\theta}$.</p>" +
      '<div class="trap"><b>JEE trap: velocity at the top isn\'t zero.</b> Only $v_y$ is. The ball still moves sideways at $u\\cos\\theta$, so its speed there is $u\\cos\\theta$ and its acceleration is still $g$ downward.</div>');
    function apply(s) {
      uS.set(s.u); thS.set(s.th); hS.set(s.h || 0);
      g = s.g || 9.8; sim.setG(g);
      P.controls.querySelectorAll(".seg button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.value === g)); });
      targetX = 95;                                   // keep the crates out of the way of the question's shot
      buildTower(); buildCrates(false); P.resetBtn.click();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "maximum height", setup: { u: 20, th: 30, h: 0 }, watch: "Fire at 30°, then set 60° and fire again. Compare H",
        q: "Two balls are thrown with the same speed at 30° and 60° to the horizontal. What is the ratio of their maximum heights, $H_{30} : H_{60}$?",
        options: ["1 : 1", "1 : 3", "1 : √3", "3 : 1"], answer: 1,
        explain: "$H = u^2\\sin^2\\theta / 2g$, so the ratio is $\\sin^2 30° : \\sin^2 60° = \\tfrac14 : \\tfrac34 = 1 : 3$. Their ranges are equal though, because $30° + 60° = 90°$." },
      { level: "medium", tag: "launch from a height", setup: { u: 20, th: 30, h: 20 }, watch: "Predict the range, then press Fire",
        q: "A ball is thrown at 20 m/s, 30° above the horizontal, from the top of a 20 m tower ($g = 9.8$). How far from the base does it land?",
        options: ["35.3 m", "45.1 m", "56.9 m", "69.3 m"], answer: 2,
        hints: ["The landing time solves $0 = h + u\\sin\\theta\\,t - \\tfrac12 g t^2$. Take the positive root.", "Then the range is $u\\cos\\theta \\times T$: horizontal motion never changes."],
        explain: "$4.9t^2 - 10t - 20 = 0$ gives $T = \\dfrac{10 + \\sqrt{100 + 392}}{9.8} = 3.28$ s. Then $R = 20\\cos 30° \\times 3.28 = 17.32 \\times 3.28 = 56.9$ m, much more than the 35.3 m from ground level." },
      { level: "hard", tag: "two angles, one target", setup: { u: 25, th: 26, h: 0 }, watch: "Fire at 26°, then try 64°. Where do both land?",
        q: "A ball launched at 25 m/s from the ground must land 50 m away on level ground ($g = 9.8$). At what angle(s) can it be thrown?",
        options: ["25.8° and 64.2°", "38.3° and 51.7°", "45° only", "No angle works"], answer: 0,
        hints: ["Start from $R = u^2 \\sin 2\\theta / g$ and solve for $\\sin 2\\theta$.", "$\\sin x = k$ has two answers between 0° and 180°: $x$ and $180° - x$."],
        explain: "$\\sin 2\\theta = Rg/u^2 = 50 \\times 9.8 / 625 = 0.784$, so $2\\theta = 51.6°$ or $128.4°$, i.e. $\\theta = 25.8°$ or $64.2°$. They add to 90°, as complementary angles must. With whole degrees, 26° and 64° both land at 50.3 m; the 64° shot just stays in the air about twice as long." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = K.transport(P, sim, {
      playLabel: "Fire",
      onPlay: function () { if (!flight || flight.done) { fire(); sim.pause(); } },
      onReset: function () {
        if (ball) sim.remove(ball);
        ball = null; flight = null; sim.resetClock(); P.time.textContent = "t = 0.00 s";
        buildCrates(false); update(true);
      }
    });
    buildTower(); buildCrates(true); update(true);
    sim.zoom = zoomTarget;

    return function destroy() { sim.destroy(); [gy, gv, gxg].forEach(function (gr) { gr.destroy(); }); };
  }
})();
