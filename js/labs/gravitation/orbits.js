/* Gravitation, lab 1: orbits. Launch a planet around a star; the ellipse, the equal areas and T² ∝ a³ all come out of F = GMm/r². */
(function () {
  "use strict";
  var G = 6.674e-11, MSUN = 1.989e30, AU = 1.496e11, YR = 3.156e7;
  var KMS = AU / YR / 1000;           // 1 AU/yr in km/s (4.74). Note (km/s)² = MJ/kg.
  var YR_PER_S = 0.4;                 // 1 s on the stage = 0.4 yr
  var SECTORS = 12, STAR_HIT = 0.02;  // equal-time sectors per lap; crash radius (AU)
  var W = 1000, H = 600, KPX = 2.2;   // stage size; velocity arrow px per km/s
  function muOf(ms) { return G * MSUN * ms * YR * YR / (AU * AU * AU); }   // GM in AU³/yr²

  var lab = {
    id: "orbits", chapter: "gravitation", title: "Orbits & Kepler's laws", short: "ellipses, equal areas, T² ∝ a³",
    lede: "Drag the arrow to throw a planet past the Sun. One rule, $F = GMm/r^2$, gives you circles, ellipses and escape paths, plus all three of Kepler's laws for free.",
    tries: [
      { id: "circle", title: "Make a perfect circle",
        text: "Launch at the circular speed $\\sqrt{GM/r}$, square to the radius ($\\varphi = 0$), and let it go once round.",
        why: "Gravity then supplies exactly the centripetal force $mv^2/r$, so $r$ never changes. At 1 AU around the Sun that's 29.8 km/s, which is Earth's speed." },
      { id: "areas", title: "Check equal areas on a long ellipse",
        text: "Complete a lap with eccentricity above 0.4 and compare the shaded sectors.",
        why: "Gravity points straight at the star, so it has no torque about it and angular momentum $L = mrv_\\perp$ stays fixed. The area swept per second is $L/2m$: short and fat near the star, long and thin far away, same area." },
      { id: "kepler3", title: "Put three orbits on the T² vs a³ graph",
        text: "Complete laps on three orbits with clearly different sizes, around the same star.",
        why: "The dots fall on one straight line through the origin, $T^2 = \\frac{4\\pi^2}{GM}a^3$. Its slope depends only on the star's mass, not the planet's mass and not the orbit's shape." },
      { id: "escape", title: "Escape for good",
        text: "Launch with total energy $E \\ge 0$ and watch the planet leave.",
        why: "At $v_0 = \\sqrt2\\,v_c$ the kinetic energy exactly cancels the potential energy: the path opens into a parabola and never closes. Only the speed matters, not the direction." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var r0S = K.slider({ label: "Start distance $r_0$", unit: "AU", min: 0.4, max: 4, step: 0.05, value: 1, onInput: reset });
    var vS = K.slider({ label: "Launch speed $v_0$", unit: "km/s", min: 5, max: 80, step: 0.01, value: 34, onInput: reset,
      hint: "Earth moves at 29.79 km/s at 1 AU." });
    var phS = K.slider({ label: "Direction $\\varphi$ from square-on", unit: "°", min: -60, max: 60, step: 1, value: 0, onInput: reset,
      hint: "Or drag the green arrow on the stage." });
    var ms = 1;
    var show = { sec: true, pred: true, vec: true };
    P.controls.innerHTML = "<h3>Launch</h3>";
    [r0S, vS, phS].forEach(function (s) { P.controls.appendChild(s.el); });
    var quick = K.h('<div class="row"></div>');
    [["Circular speed", function () { vS.set(round2(vcirc(params()))); phS.set(0); reset(); }],
     ["Escape speed", function () { vS.set(Math.ceil(Math.SQRT2 * vcirc(params()) * 100) / 100); reset(); }],
     ["Clear orbits", function () { orbits = []; ghosts = []; reset(); }]].forEach(function (q) {
      var b = K.h('<button class="btn btn-sm" type="button">' + q[0] + "</button>");
      b.addEventListener("click", q[1]); quick.appendChild(b);
    });
    P.controls.appendChild(quick);
    P.controls.appendChild(K.h("<h3>Star</h3>"));
    var starSeg = K.seg([{ label: "½ M☉", value: 0.5 }, { label: "1 M☉ (Sun)", value: 1 }, { label: "2 M☉", value: 2 }], 1,
      function (v) { ms = v; reset(); }, "Star mass");
    P.controls.appendChild(starSeg);
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Equal-time sectors", true, function (v) { show.sec = v; }));
    row.appendChild(K.check("Predicted path", true, function (v) { show.pred = v; }));
    row.appendChild(K.check("Vectors", true, function (v) { show.vec = v; }));
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-ten"><i></i>star</span><span class="c-disp"><i></i>planet path</span><span class="c-vel"><i></i>velocity</span>' +
      '<span class="c-grav"><i></i>gravity</span><span class="c-acc"><i></i>equal-time sectors</span></div>'));

    function round2(v) { return Math.round(v * 100) / 100; }
    function params() { return { r0: r0S.get(), v: vS.get(), phi: phS.get(), ms: ms, mu: muOf(ms) }; }
    function vcirc(p) { return Math.sqrt(p.mu / p.r0) * KMS; }                  // km/s
    function start(p) {
      var v = p.v / KMS, f = p.phi * K.DEG;
      return { x: p.r0, y: 0, vx: v * Math.sin(f), vy: v * Math.cos(f) };
    }
    // orbital elements from a state (AU, AU/yr)
    function elements(s, mu) {
      var r = Math.hypot(s.x, s.y), v2 = s.vx * s.vx + s.vy * s.vy, rv = s.x * s.vx + s.y * s.vy;
      var E = v2 / 2 - mu / r, h = s.x * s.vy - s.y * s.vx;
      var ex = ((v2 - mu / r) * s.x - rv * s.vx) / mu, ey = ((v2 - mu / r) * s.y - rv * s.vy) / mu;
      var e = Math.hypot(ex, ey), pp = h * h / mu, bound = E < 0;
      var a = bound ? -mu / (2 * E) : Infinity;
      return { E: E, h: h, e: e, w: Math.atan2(ey, ex), p: pp, a: a, bound: bound,
        T: bound ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity, rp: pp / (1 + e), ra: bound ? pp / (1 - e) : Infinity };
    }

    /* ---------- flight ---------- */
    var fl = null, orbits = [], ghosts = [];
    var view = { sx: W / 2, sy: H / 2, scl: 100 }, vt = { sx: W / 2, sy: H / 2, scl: 100 };
    function X(x) { return view.sx + x * view.scl; }
    function Y(y) { return view.sy - y * view.scl; }

    function fitView(el, p) {
      if (el.bound && el.ra < 25) {
        var a = el.a, b = a * Math.sqrt(1 - el.e * el.e), c = Math.cos(el.w), s = Math.sin(el.w);
        var wx = Math.sqrt(a * a * c * c + b * b * s * s), wy = Math.sqrt(a * a * s * s + b * b * c * c);
        var scl = Math.min((W / 2 - 40) / wx, (H / 2 - 48) / wy);
        // the ellipse's centre sits a·e from the star, away from perihelion: put that centre mid-stage
        vt = { scl: scl, sx: W / 2 + a * el.e * c * scl, sy: H / 2 - a * el.e * s * scl };
      } else {
        var fit = el.bound ? 8 : 2.4 * p.r0;
        vt = { scl: (H / 2 - 30) / fit, sx: W / 2 - (el.bound ? 0 : 0.8 * p.r0 * (H / 2 - 30) / fit), sy: H / 2 };
      }
    }

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      if (fl && fl.path.length > 20) { ghosts.push(fl.path); if (ghosts.length > 4) ghosts.shift(); }
      fl = null;
      var p = params();
      fitView(elements(start(p), p.mu), p);
      setTime(0);
      update(true);
    }

    function launch() {
      var p = params(), s = start(p), el = elements(s, p.mu);
      if (fl && fl.path.length > 20) { ghosts.push(fl.path); if (ghosts.length > 4) ghosts.shift(); }
      fl = { p: p, el: el, x: s.x, y: s.y, vx: s.vx, vy: s.vy, ax: 0, ay: 0, t: 0, theta: 0, lapT0: 0, laps: [],
        rmin: p.r0, rmax: p.r0, path: [[s.x, s.y]], tau: el.bound ? el.T / SECTORS : 0.05,
        secs: [{ k: 0, A: 0, pts: [[s.x, s.y]], full: false }], done: null, rec: null, stride: 1, frames: 0 };
      accel(fl);
      fl.rec = { t: [], v: [], vf: [], ke: [], u: [], e: [] };
      record(fl);
      fitView(el, p);
      sim.resetClock(); setTime(0);
      update(true);
    }
    function accel(f) {
      var r = Math.hypot(f.x, f.y), k = -f.p.mu / (r * r * r);
      f.ax = k * f.x; f.ay = k * f.y;
    }

    // Velocity Verlet with a step that shrinks near the star (about 1/3000 of the local circular period).
    function advance(f, dtTot) {
      var mu = f.p.mu, left = dtTot, guard = 0;
      while (left > 1e-12 && guard++ < 40000) {
        var r = Math.hypot(f.x, f.y), h = Math.min(left, 0.002 * Math.sqrt(r * r * r / mu));
        var x1 = f.x, y1 = f.y, t1 = f.t;
        f.vx += 0.5 * h * f.ax; f.vy += 0.5 * h * f.ay;
        f.x += h * f.vx; f.y += h * f.vy;
        accel(f);
        f.vx += 0.5 * h * f.ax; f.vy += 0.5 * h * f.ay;
        f.t = t1 + h; left -= h;
        book(f, x1, y1, t1, h);
        if (Math.hypot(f.x, f.y) < STAR_HIT) { f.done = "crash"; return; }
      }
    }

    // swept areas, unwrapped angle (for laps) and closest / farthest points, once per substep
    function book(f, x1, y1, t1, h) {
      var x2 = f.x, y2 = f.y, dA = 0.5 * (x1 * y2 - x2 * y1), cur = f.secs[f.secs.length - 1];
      var tb = (cur.k + 1) * f.tau;
      if (f.t >= tb) {
        // split this little triangle at the sector boundary (areal speed is constant, so split by time)
        var q = (tb - t1) / h, xb = x1 + q * (x2 - x1), yb = y1 + q * (y2 - y1);
        cur.A += q * dA; cur.pts.push([xb, yb]); cur.full = true;
        f.secs.push({ k: cur.k + 1, A: (1 - q) * dA, pts: [[xb, yb], [x2, y2]], full: false });
        if (f.secs.length > SECTORS + 1) f.secs.shift();
      } else {
        cur.A += dA; cur.pts.push([x2, y2]);
      }
      var r = Math.hypot(x2, y2);
      if (r < f.rmin) f.rmin = r;
      if (r > f.rmax) f.rmax = r;
      var dth = Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2), th0 = f.theta;
      f.theta += dth;
      var goal = 2 * Math.PI * (f.laps.length + 1);
      if (Math.abs(f.theta) >= goal) {
        var tc = t1 + h * (goal - Math.abs(th0)) / (Math.abs(f.theta) - Math.abs(th0));
        f.laps.push({ T: tc - f.lapT0, a: (f.rmin + f.rmax) / 2, rmin: f.rmin, rmax: f.rmax });
        f.lapT0 = tc; f.rmin = r; f.rmax = r;
        lapDone(f);
      }
    }

    function record(f) {
      var v = Math.hypot(f.vx, f.vy) * KMS, r = Math.hypot(f.x, f.y), mu = f.p.mu;
      var vf = Math.sqrt(Math.max(0, mu * (2 / r - (f.el.bound ? 1 / f.el.a : 0) + (f.el.bound ? 0 : 2 * f.el.E / mu)))) * KMS;
      var ke = v * v / 2, u = -mu / r * KMS * KMS;
      var R = f.rec;
      R.t.push(f.t); R.v.push(v); R.vf.push(vf); R.ke.push(ke); R.u.push(u); R.e.push(ke + u);
      if (R.t.length > 2400) Object.keys(R).forEach(function (k) { R[k] = R[k].filter(function (_, i) { return i % 2 === 0; }); });
    }

    function sectorStats(f) {
      var full = f.secs.filter(function (s) { return s.full; }).slice(-SECTORS);
      if (!full.length) return null;
      var A = full.map(function (s) { return Math.abs(s.A); }), mean = A.reduce(function (a, b) { return a + b; }, 0) / A.length;
      return { n: A.length, last: A[A.length - 1], spread: (Math.max.apply(null, A) - Math.min.apply(null, A)) / mean };
    }

    function lapDone(f) {
      var lap = f.laps[f.laps.length - 1];
      if (f.laps.length === 1) {
        // one dot per orbit on the T² vs a³ graph; a new dot for (almost) the same orbit replaces the old one
        orbits = orbits.filter(function (o) { return !(o.ms === f.p.ms && Math.abs(o.a - lap.a) / lap.a < 0.02); });
        orbits.push({ a: lap.a, T: lap.T, ms: f.p.ms });
        if (orbits.length > 12) orbits.shift();
      }
      K.flash(P.note, "One lap: T = " + K.fmt(lap.T, 3) + " yr");
      if ((lap.rmax - lap.rmin) / (lap.rmax + lap.rmin) < 0.01) tries.mark("circle");
      var st = sectorStats(f);
      if (f.el.e > 0.4 && st && st.n >= SECTORS - 1 && st.spread < 0.01) tries.mark("areas");
      var mine = orbits.filter(function (o) { return o.ms === f.p.ms; }).map(function (o) { return o.a; }).sort(function (a, b) { return a - b; });
      var distinct = mine.filter(function (a, i) { return i === 0 || a > mine[i - 1] * 1.1; });
      if (distinct.length >= 3) tries.mark("kepler3");
    }

    sim.on("step", function () {
      if (!fl || fl.done) return;
      advance(fl, K.DT * YR_PER_S);
      fl.frames++;
      fl.path.push([fl.x, fl.y]);
      if (fl.path.length > 4000) fl.path = fl.path.filter(function (_, i) { return i % 2 === 0 || i === fl.path.length - 1; });
      if (fl.frames % fl.stride === 0) record(fl);
      var sx = X(fl.x), sy = Y(fl.y);
      if (!fl.done && (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) && !fl.el.bound) fl.done = "away";
      if (fl.done) {
        sim.pause(); transportUI.render();
        if (fl.done === "away") { K.flash(P.note, "Escaped: E ≥ 0, it never comes back", 3000); if (fl.el.E >= 0) tries.mark("escape"); }
        else K.flash(P.note, "Crashed into the star", 3000);
      }
      setTime(fl.t);
      update(!!fl.done);
    });
    function setTime(t) { P.time.textContent = "t = " + K.fmt(t, 2) + " yr"; }

    /* ---------- aiming by drag ---------- */
    var aim = null;
    sim.pointer({
      down: function (pt) {
        if (sim.running) return false;
        var p = params(), s = start(p), x0 = X(s.x), y0 = Y(s.y);
        var tipX = x0 + s.vx * KMS * KPX, tipY = y0 - s.vy * KMS * KPX;
        if (Math.hypot(pt.px - x0, pt.py - y0) > sim.u(40) && Math.hypot(pt.px - tipX, pt.py - tipY) > sim.u(30)) return false;
        aim = true; return true;
      },
      drag: function (pt) {
        var p = params(), x0 = X(p.r0), y0 = Y(0);
        var dx = pt.px - x0, dy = y0 - pt.py;          // y up
        var v = K.clamp(Math.hypot(dx, dy) / KPX, 5, 80), phi = Math.atan2(dx, dy) / K.DEG;
        vS.set(round2(v)); phS.set(K.clamp(Math.round(phi), -60, 60));
        fl = null; update(true);
      },
      up: function () { if (aim) { aim = null; reset(); launch(); sim.play(); transportUI.render(); } }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      ["scl", "sx", "sy"].forEach(function (k) { view[k] += (vt[k] - view[k]) * 0.15; if (Math.abs(vt[k] - view[k]) < 1e-3) view[k] = vt[k]; });
      var s = sim.u(1);
      // distance rings
      ctx.save(); ctx.strokeStyle = th.grid; ctx.lineWidth = s; ctx.setLineDash([3 * s, 5 * s]);
      var step = view.scl > 60 ? 1 : view.scl > 20 ? 2 : 5;
      for (var r = step; r * view.scl < W * 1.2; r += step) {
        ctx.beginPath(); ctx.arc(X(0), Y(0), r * view.scl, 0, Math.PI * 2); ctx.stroke();
        K.label(ctx, r + " AU", X(0) + r * view.scl * 0.7071 + 4 * s, Y(0) - r * view.scl * 0.7071, th.muted, { s: s * 0.85, align: "left" });
      }
      ctx.restore();
      ghosts.forEach(function (g, i) { drawPath(ctx, g, K.alpha(th.muted, 0.25 + 0.1 * i), [], 1.5); });
      if (show.sec && fl) {
        fl.secs.forEach(function (sc) {
          if (sc.pts.length < 2) return;
          ctx.fillStyle = K.alpha(th.acc, sc.k % 2 ? 0.14 : 0.32);
          ctx.beginPath(); ctx.moveTo(X(0), Y(0));
          sc.pts.forEach(function (q) { ctx.lineTo(X(q[0]), Y(q[1])); });
          ctx.closePath(); ctx.fill();
        });
      }
      if (show.pred || !fl) drawConic(ctx, fl ? fl.el : elements(start(params()), params().mu));
      if (fl) drawPath(ctx, fl.path, th.disp, [], 2.5);
      // the star
      var gl = ctx.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), sim.u(34));
      gl.addColorStop(0, K.alpha(th.ten, 0.55)); gl.addColorStop(1, K.alpha(th.ten, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(X(0), Y(0), sim.u(34), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.ten; ctx.beginPath(); ctx.arc(X(0), Y(0), sim.u(10 + 2 * ms), 0, Math.PI * 2); ctx.fill();
    });
    sim.on("over", function (ctx) {
      var p = params(), s = fl ? fl : start(p), x = X(s.x), y = Y(s.y), u = sim.u(1);
      if (show.vec || !fl) {
        K.arrow(ctx, x, y, x + s.vx * KMS * KPX, y - s.vy * KMS * KPX, th.vel, { s: u, label: "v " + K.fmt(Math.hypot(s.vx, s.vy) * KMS, 1) + " km/s" });
        var r = Math.hypot(s.x, s.y), gl = K.clamp(45 * Math.sqrt(p.mu / (r * r) / 39.5), 10, 120);
        K.arrow(ctx, x, y, x - s.x / r * gl, y + s.y / r * gl, th.grav, { s: u, label: "F", lx: -16, ly: 12 });
      }
      ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(x, y, sim.u(7), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(x - sim.u(2), y - sim.u(2), sim.u(2.5), 0, Math.PI * 2); ctx.fill();
      if (!fl) K.label(ctx, "drag the arrow to aim, release to launch", x + sim.u(16), y + sim.u(30), th.muted, { s: u, align: "left" });
      if (aim) K.label(ctx, K.fmt(p.v, 2) + " km/s at φ = " + p.phi + "°", x, y - sim.u(18), th.vel, { s: u, bg: true });
    });
    function drawPath(ctx, pts, color, dash, width) {
      if (pts.length < 2) return;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = sim.u(width); ctx.lineJoin = "round"; ctx.setLineDash(dash);
      ctx.beginPath();
      pts.forEach(function (q, i) { if (i) ctx.lineTo(X(q[0]), Y(q[1])); else ctx.moveTo(X(q[0]), Y(q[1])); });
      ctx.stroke(); ctx.restore();
    }
    // r(θ) = p / (1 + e cos(θ − ω)), drawn wherever it stays on (or near) the stage
    function drawConic(ctx, el) {
      var pts = [], segs = [], lim = 3 * Math.max(W, H) / view.scl;
      for (var i = 0; i <= 360; i++) {
        var a = i * Math.PI / 180, d = 1 + el.e * Math.cos(a - el.w), r = d > 1e-3 ? el.p / d : Infinity;
        if (r < lim) pts.push([r * Math.cos(a), r * Math.sin(a)]);
        else if (pts.length) { segs.push(pts); pts = []; }
      }
      if (pts.length) segs.push(pts);
      // join the wrap-around piece of an open path
      if (segs.length > 1 && segs[0][0] && Math.abs(Math.atan2(segs[0][0][1], segs[0][0][0])) < 0.02) segs[0] = segs.pop().concat(segs[0]);
      segs.forEach(function (sg) { drawPath(ctx, sg, K.alpha(th.vel, 0.7), [sim.u(6), sim.u(6)], 1.5); });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">speed vs t</b> · fastest at perihelion; dashed is $v^2 = GM(2/r - 1/a)$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">energy per kg vs t</b> · KE and U trade, the total stays flat</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">T² vs a³</b> · your orbits (dots) on Kepler\'s line</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gv = new K.Graph(cv[0], { yLabel: "v (km/s)", xLabel: "t (yr)", xMax: 1, xAuto: true, yMin: 0, color: th.vel });
    var ge = new K.Graph(cv[1], { yLabel: "E (MJ/kg)", xLabel: "t (yr)", xMax: 1, xAuto: true, color: th.grav });
    var gk = new K.Graph(cv[2], { yLabel: "T² (yr²)", xLabel: "a³ (AU³)", xMax: 8, xAuto: true, yMin: 0, color: th.disp });

    function update(force) {
      var p = fl ? fl.p : params(), el = fl ? fl.el : elements(start(p), p.mu);
      if (fl) {
        var R = fl.rec, z = function (arr) { return R.t.map(function (t, i) { return [t, arr[i]]; }); };
        var xEnd = Math.max(R.t[R.t.length - 1], el.bound ? el.T : 1);
        gv.o.xMax = ge.o.xMax = xEnd;
        gv.set("sim", { points: z(R.v), color: th.vel, width: 2.5, dot: true });
        gv.set("f", { points: z(R.vf), color: th.ink, dash: [5, 5], width: 1.5 });
        ge.set("ke", { points: z(R.ke), color: th.vel, width: 2 });
        ge.set("u", { points: z(R.u), color: th.grav, width: 2 });
        ge.set("e", { points: z(R.e), color: th.ink, width: 2.5, dot: true });
        ge.set("ef", { points: [[0, el.E * KMS * KMS], [xEnd, el.E * KMS * KMS]], color: th.muted, dash: [5, 5], width: 1.5 });
      } else { gv.clear(); ge.clear(); gv.o.xMax = ge.o.xMax = el.bound ? Math.min(el.T, 30) : 1; }
      var mine = orbits.filter(function (o) { return o.ms === ms; });
      var xm = Math.max(8, Math.max.apply(null, mine.map(function (o) { return o.a * o.a * o.a; }).concat([0])) * 1.15);
      gk.o.xMax = xm;
      gk.set("law", { points: [[0, 0], [xm, xm * 4 * Math.PI * Math.PI / muOf(ms)]], color: th.disp, dash: [5, 5], width: 1.5 });
      gk.extra = function (ctx, GX, GY) {
        ctx.fillStyle = th.disp;
        mine.forEach(function (o) { ctx.beginPath(); ctx.arc(GX(o.a * o.a * o.a), GY(o.T * o.T), 4.5, 0, Math.PI * 2); ctx.fill(); });
        if (el.bound && el.a < 30) {
          ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(GX(el.a * el.a * el.a), GY(el.T * el.T), 6, 0, Math.PI * 2); ctx.stroke();
        }
      };
      [gv, ge, gk].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Circular-orbit speed at r₀", "Total energy per kg decides the path", "Kepler's 2nd law: area swept per year", "Kepler's 3rd law"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "v", label: "speed now", cls: "c-vel" }, { id: "r", label: "distance r", cls: "c-disp" },
      { id: "rr", label: "closest / farthest", cls: "c-disp" }, { id: "a", label: "semi-major axis a", cls: "c-disp" },
      { id: "T", label: "period T" }, { id: "A", label: "sector area", cls: "c-acc" }, { id: "E", label: "energy per kg", cls: "c-grav" }
    ]);
    var slowMaths = K.throttle(renderMaths, 100);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function sci(v, d) {
      var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
      if (+m.toFixed(d) >= 10) { m /= 10; e++; }
      return m.toFixed(d) + "\\times10^{" + e + "}";
    }
    function shape(el) { return !el.bound ? (el.E * KMS * KMS > 0.05 ? "hyperbola" : "parabola") : el.e < 0.005 ? "circle" : "ellipse"; }
    function renderMaths() {
      var p = fl ? fl.p : params(), el = fl ? fl.el : elements(start(p), p.mu), vc = vcirc(p), E = el.E * KMS * KMS;
      K.tex(eqEls[0], "v_c = \\sqrt{\\frac{GM}{r_0}} = \\sqrt{\\frac{(6.674\\times10^{-11})(" + sci(MSUN * p.ms, 3) + ")}{" + sci(p.r0 * AU, 3) + "}} = \\mathbf{" + K.fmt(vc, 2) + "}\\ \\text{km/s}");
      K.tex(eqEls[1], "\\frac{E}{m} = \\tfrac12 v_0^2 - \\frac{GM}{r_0} = \\tfrac12(" + K.fmt(p.v, 2) + ")^2 - (" + K.fmt(vc, 2) + ")^2 = \\mathbf{" + K.fmt(E, 1) + "}\\ \\text{MJ/kg}" +
        (el.bound ? " < 0:\\ \\text{bound}" : "\\ge 0:\\ \\text{escapes}"));
      var vA = p.v / KMS;
      K.tex(eqEls[2], "\\frac{dA}{dt} = \\tfrac12 r_0 v_0\\cos\\varphi = \\tfrac12(" + K.fmt(p.r0, 2) + ")(" + K.fmt(vA, 3) + ")\\cos" + p.phi + "^\\circ = \\mathbf{" + K.fmt(Math.abs(el.h) / 2, 3) + "}\\ \\text{AU}^2/\\text{yr}");
      if (el.bound) K.tex(eqEls[3], "a = \\frac{GM}{-2E/m} = \\mathbf{" + K.fmt(el.a, 3) + "}\\ \\text{AU},\\quad T = 2\\pi\\sqrt{\\frac{a^3}{GM}} = \\mathbf{" + K.fmt(el.T, 3) + "}\\ \\text{yr}");
      else K.tex(eqEls[3], "E \\ge 0:\\ a \\to \\infty,\\ \\text{no period. It never comes back.}");

      var f = fl, lap = f && f.laps.length ? f.laps[f.laps.length - 1] : null;
      var vNow = f ? Math.hypot(f.vx, f.vy) * KMS : p.v, rNow = f ? Math.hypot(f.x, f.y) : p.r0;
      var vf = Math.sqrt(Math.max(0, el.E * 2 + 2 * p.mu / rNow)) * KMS;
      setR("v", K.fmt(vNow, 2) + " km/s", "energy says " + K.fmt(vf, 2));
      setR("r", K.fmt(rNow, 3) + " AU");
      setR("rr", lap ? K.fmt(lap.rmin, 2) + " / " + K.fmt(lap.rmax, 2) + " AU" : f && f.rmax > p.r0 * 1.0001 ? "… / " + K.fmt(f.rmax, 2) + " AU" : "—",
        "formula " + K.fmt(el.rp, 2) + " / " + (el.bound ? K.fmt(el.ra, 2) : "∞"));
      setR("a", lap ? K.fmt(lap.a, 3) + " AU" : "—", el.bound ? "formula " + K.fmt(el.a, 3) + " AU" : "unbound");
      setR("T", lap ? K.fmt(lap.T, 3) + " yr" : "—", el.bound ? "formula " + K.fmt(el.T, 3) + " yr" : "no period");
      var st = f ? sectorStats(f) : null;
      setR("A", st ? K.fmt(st.last, 4) + " AU²" : "—", "formula " + K.fmt(Math.abs(el.h) / 2 * (f ? f.tau : el.bound ? el.T / SECTORS : 0.05), 4) + (st && st.n > 1 ? " · spread " + K.fmt(st.spread * 100, 2) + "%" : ""));
      var eNow = f ? ((f.vx * f.vx + f.vy * f.vy) / 2 - p.mu / rNow) * KMS * KMS : E;
      setR("E", K.fmt(eNow, 2) + " MJ/kg", "at launch " + K.fmt(E, 2));
      P.hud.innerHTML = "<span>" + shape(el) + (el.bound ? " · e = " + K.fmt(el.e, 2) : "") + "</span><span>" + (el.bound ? "E < 0: bound" : "E ≥ 0: unbound") + "</span>";
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>The planet only ever feels one force: $F = \\dfrac{GMm}{r^2}$, pointing at the star. That single rule explains Kepler's three laws.</p>" +
      "<p><b>1. Orbits are conic sections</b> with the star at a focus. The sign of the total energy $E = \\tfrac12 mv^2 - \\dfrac{GMm}{r}$ decides which: $E < 0$ ellipse (a circle if $v = \\sqrt{GM/r}$ square-on), $E = 0$ parabola, $E > 0$ hyperbola.</p>" +
      "<p><b>2. Equal areas in equal times</b>, because a force aimed at the star has no torque about it, so $L = mr v_\\perp$ is conserved and $dA/dt = L/2m$.</p>" +
      "<p><b>3. $T^2 = \\dfrac{4\\pi^2}{GM}a^3$</b>, where $a$ is the semi-major axis, half the longest diameter. For the Sun, with $T$ in years and $a$ in AU, that's just $T^2 = a^3$.</p>" +
      '<div class="trap"><b>JEE trap: $v = \\sqrt{GM/r}$ is only for circles.</b> On an ellipse the speed changes all the time. Use energy, $v^2 = GM\\left(\\dfrac{2}{r} - \\dfrac{1}{a}\\right)$, or angular momentum, $r_1 v_1 = r_2 v_2$ at perihelion and aphelion. And Kepler\'s third law needs $a$, never the distance at one point.</div>');
    function apply(s) {
      ms = s.ms || 1;
      starSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.value === ms)); });
      r0S.set(s.r0); phS.set(s.phi || 0);
      vS.set(s.v === "circ" ? round2(vcirc(params())) : s.v);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "circular orbit speed", setup: { r0: 4, v: "circ", phi: 0 }, watch: "Predict the speed, then launch and read it",
        q: "Earth circles the Sun at 29.8 km/s at 1 AU. How fast does a planet move on a circular orbit of radius 4 AU?",
        options: ["7.4 km/s", "14.9 km/s", "29.8 km/s", "59.6 km/s"], answer: 1,
        explain: "$v = \\sqrt{GM/r}$, so $v \\propto 1/\\sqrt r$. Four times farther means half the speed: $29.8 / 2 = 14.9$ km/s. Farther planets are slower and also have farther to go, so their years are much longer (8 years here)." },
      { level: "medium", tag: "Kepler's 3rd law", setup: { r0: 1, v: 36.48, phi: 0 }, watch: "Launch and read the period after one lap",
        q: "A comet's closest distance to the Sun is 1 AU and its farthest is 3 AU. What is its orbital period?",
        options: ["1.41 yr", "2.83 yr", "5.20 yr", "8.00 yr"], answer: 1,
        hints: ["Kepler's third law uses the semi-major axis $a = (r_{min} + r_{max})/2$, not either distance.", "For the Sun, $T^2 = a^3$ with $T$ in years and $a$ in AU."],
        explain: "$a = (1 + 3)/2 = 2$ AU, so $T = 2^{3/2} = 2.83$ yr. Using $r_{max} = 3$ AU gives 5.20 yr, and forgetting the square root gives 8. In the lab, 36.48 km/s square-on at 1 AU is exactly this orbit." },
      { level: "hard", tag: "energy + angular momentum", setup: { r0: 1, v: 35.75, phi: 0 }, watch: "Launch, then read the farthest distance after half a lap",
        q: "A planet 1 AU from the Sun moves square-on to the Sun–planet line at 1.2 times the circular-orbit speed there. What is its greatest distance from the Sun?",
        options: ["1.44 AU", "2.00 AU", "2.57 AU", "It escapes"], answer: 2,
        hints: ["At the nearest and farthest points the velocity is square-on, so $r_1 v_1 = r_2 v_2$. Energy gives $\\tfrac12 v_1^2 - \\dfrac{GM}{r_1} = \\tfrac12 v_2^2 - \\dfrac{GM}{r_2}$.",
          "Put $v_1 = k\\sqrt{GM/r_1}$ with $k = 1.2$ and eliminate $v_2$. One root is $r_2 = r_1$ (where you started); the other is the answer."],
        explain: "Eliminating $v_2$ gives $r_2 = \\dfrac{r_1}{2/k^2 - 1} = \\dfrac{1}{1.389 - 1} = 2.57$ AU. It doesn't escape: that needs $k = \\sqrt2 = 1.41$. The lab shows a farthest point of 2.57 AU and $a = 1.79$ AU." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Launch", onReset: reset,
      onPlay: function () { if (!fl || fl.done) launch(); } });
    sim.on("step", function () { if (fl) setTime(fl.t); });
    reset();
    view = { sx: vt.sx, sy: vt.sy, scl: vt.scl };

    if (location.hostname === "localhost") {
      window.__lab_orbits = { apply: apply, launch: launch, sim: sim, tries: tries,
        state: function () { return { fl: fl, orbits: orbits, el: fl ? fl.el : elements(start(params()), params().mu), p: params(), sec: fl ? sectorStats(fl) : null, vc: vcirc(params()) }; } };
    }
    return function destroy() { sim.destroy(); [gv, ge, gk].forEach(function (g) { g.destroy(); }); };
  }
})();
