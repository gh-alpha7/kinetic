/* Ray optics, lab 3: a ray through a triangular prism, the deviation curve and its minimum, and dispersion.
   Each colour is traced face by face with the vector form of Snell's law; n(λ) follows Cauchy's formula. */
(function () {
  "use strict";
  var DEG = Math.PI / 180, SIDE = 34;
  var COLOURS = [[700, "#ef4444", "red"], [620, "#f97316", "orange"], [580, "#eab308", "yellow"], [530, "#22c55e", "green"],
    [470, "#3b82f6", "blue"], [440, "#6366f1", "indigo"], [400, "#a855f7", "violet"]];

  var lab = {
    id: "prism", chapter: "rays", title: "Prisms & dispersion", short: "deviation, minimum deviation, spectra",
    lede: "Swing the laser and watch how much the prism bends the beam. The bending never drops below a minimum, and that minimum tells you the glass's refractive index.",
    tries: [
      { id: "min", title: "Find the minimum deviation",
        text: "Adjust the angle of incidence until the deviation is as small as it gets.",
        why: "At minimum deviation the ray passes through symmetrically: $i = e$, $r_1 = r_2 = A/2$, and inside the prism it runs parallel to the base. Then $n = \\dfrac{\\sin\\frac{A+\\delta_m}{2}}{\\sin\\frac A2}$." },
      { id: "tir", title: "Stop the light getting out",
        text: "Find an angle of incidence where no light leaves the second face.",
        why: "Small $i$ means small $r_1$, so $r_2 = A - r_1$ is large. Once $r_2 \\gt \\theta_c$ the second face totally reflects. With $A = 60°$ and $n = 1.5$ that's any $i$ below $27.9°$." },
      { id: "white", title: "Split white light",
        text: "Switch to white light and spread the colours by at least 0.5°. Which colour bends most?",
        why: "Glass has a larger $n$ for shorter wavelengths (Cauchy: $n = a + b/\\lambda^2$), so violet deviates most and red least. Each colour has its own $\\delta$; the fan between them is the angular dispersion." },
      { id: "thin", title: "Check the thin-prism rule",
        text: "Make $A \\le 6°$ with $i \\le 10°$ and compare $\\delta$ with $(n-1)A$.",
        why: "For small angles $\\sin x \\approx x$, so $i = nr_1$, $e = nr_2$ and $\\delta = n(r_1 + r_2) - A = (n-1)A$, whatever the (small) angle of incidence." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- vector optics ---------- */
  function norm(x, y) { var l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
  function refract(d, nr, n1, n2) {
    var c = -(d.x * nr.x + d.y * nr.y), eta = n1 / n2, k = 1 - eta * eta * (1 - c * c);
    if (k < 0) return null;
    var s = eta * c - Math.sqrt(k);
    return { x: eta * d.x + s * nr.x, y: eta * d.y + s * nr.y };
  }
  function reflect(d, nr) { var c = -(d.x * nr.x + d.y * nr.y); return { x: d.x + 2 * c * nr.x, y: d.y + 2 * c * nr.y }; }
  function meet(p1, d1, p2, d2) {
    var den = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(den) < 1e-14) return null;
    var s = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
    return { x: p1.x + s * d1.x, y: p1.y + s * d1.y, s: s };
  }
  function ang(d) { return Math.atan2(d.y, d.x) / DEG; }

  // prism with its base on y = 0, apex up
  function geom(A) {
    var h = SIDE * Math.cos(A / 2 * DEG), b = SIDE * Math.sin(A / 2 * DEG);
    return { apex: { x: 0, y: h }, L: { x: -b, y: 0 }, R: { x: b, y: 0 },
      n1: { x: -Math.cos(A / 2 * DEG), y: Math.sin(A / 2 * DEG) }, n2: { x: Math.cos(A / 2 * DEG), y: Math.sin(A / 2 * DEG) } };
  }
  // trace one ray of index n hitting the first face at incidence i (degrees)
  function trace(A, n, i, frac) {
    var g = geom(A), a = (-A / 2 + i) * DEG, d = { x: Math.cos(a), y: Math.sin(a) };
    var f = frac === undefined ? 0.5 : frac, Q, t1, X, guard = 0;
    t1 = refract(d, g.n1, 1, n);
    do {   // move the entry point up until the ray reaches the second face (not the base)
      Q = { x: g.apex.x + f * (g.L.x - g.apex.x), y: g.apex.y + f * (g.L.y - g.apex.y) };
      X = meet(Q, t1, g.apex, { x: g.R.x - g.apex.x, y: g.R.y - g.apex.y });
      f *= 0.85;
    } while (X && X.y < 0.02 * g.apex.y && guard++ < 30);
    var r1 = ang(t1) + A / 2, r2 = A / 2 - ang(t1);     // signed, each from its own face's normal
    var o = refract(t1, { x: -g.n2.x, y: -g.n2.y }, n, 1);
    var res = { d: d, Q: Q, t1: t1, X: X, r1: r1, r2: r2, o: o, g: g };
    if (!o) { res.tir = true; res.ref = reflect(t1, { x: -g.n2.x, y: -g.n2.y }); return res; }
    res.e = A / 2 - ang(o);
    res.delta = ang(d) - ang(o);
    return res;
  }
  function formula(A, n, i) {          // textbook: r1 from Snell, r2 = A - r1, delta = i + e - A
    var r1 = Math.asin(Math.sin(i * DEG) / n) / DEG, r2 = A - r1, s = n * Math.sin(r2 * DEG);
    if (Math.abs(s) > 1) return { r1: r1, r2: r2, tir: true };
    var e = Math.asin(s) / DEG;
    return { r1: r1, r2: r2, e: e, delta: i + e - A };
  }
  function minDev(A, n) { var s = n * Math.sin(A / 2 * DEG); return s < 1 ? { i: Math.asin(s) / DEG, delta: 2 * Math.asin(s) / DEG - A } : null; }
  // the smallest deviation the traced rays manage, found by a golden-section search over i
  function tracedMin(A, n) {
    var lo = 0, hi = 90, gr = (Math.sqrt(5) - 1) / 2;
    function dv(i) { var t = trace(A, n, i); return t.tir ? 1e9 : t.delta; }
    var c = hi - gr * (hi - lo), d = lo + gr * (hi - lo), fc = dv(c), fd = dv(d);
    for (var k = 0; k < 60; k++) {
      if (fc < fd) { hi = d; d = c; fd = fc; c = hi - gr * (hi - lo); fc = dv(c); }
      else { lo = c; c = d; fc = fd; d = lo + gr * (hi - lo); fd = dv(d); }
    }
    return { i: (lo + hi) / 2, delta: Math.min(fc, fd) };
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 500;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 10, origin: { x: 470, y: 440 }, g: 0, gridStep: 1, gridMajor: 5, labels: false });

    var S = { A: 60, n: 1.5, i: 40, white: false, B: 4500 };
    function nOf(lam) { return S.n + S.B * (1 / (lam * lam) - 1 / (589 * 589)); }

    /* ---------- controls ---------- */
    function sl(o, key) { o.onInput = function (v) { S[key] = v; changed(); }; return K.slider(o); }
    var aS = sl({ label: "Apex angle $A$", unit: "°", min: 2, max: 80, step: 1, value: S.A }, "A");
    var nS = sl({ label: "Refractive index $n$ (yellow, 589 nm)", min: 1.2, max: 2, step: 0.01, value: S.n }, "n");
    var iS = sl({ label: "Angle of incidence $i$", unit: "°", min: 0, max: 90, step: 0.5, value: S.i, hint: "Or drag the laser." }, "i");
    var bS = sl({ label: "Cauchy $b$ (how strongly $n$ depends on $\\lambda$)", unit: "nm²", min: 0, max: 15000, step: 500, value: S.B,
      hint: "$n(\\lambda) = n_{589} + b\\left(\\frac1{\\lambda^2} - \\frac1{589^2}\\right)$" }, "B");
    var lightSeg = K.seg([{ label: "One colour", value: false }, { label: "White light", value: true }], false,
      function (v) { S.white = v; syncUI(); changed(); }, "Light");
    P.controls.innerHTML = "<h3>Prism</h3>";
    [aS, nS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Light</h3>"));
    P.controls.appendChild(lightSeg);
    [iS, bS].forEach(function (s) { P.controls.appendChild(s.el); });
    var row = K.h('<div class="row"></div>');
    var minBtn = K.h('<button class="btn btn-sm" type="button">Go to minimum deviation</button>');
    minBtn.addEventListener("click", function () {
      var m = minDev(S.A, S.n);
      if (!m) { K.flash(P.note, "No angle gets light through this prism: n sin(A/2) ≥ 1"); return; }
      S.i = m.i; syncUI(); changed(); K.flash(P.note, "Symmetric passage: i = e, ray parallel to the base");
    });
    row.appendChild(minBtn);
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-ten"><i></i>light (one colour)</span><span style="color:#ef4444"><i></i>red</span><span style="color:#a855f7"><i></i>violet</span>' +
      '<span style="color:var(--muted)"><i></i>normals</span></div>'));
    function syncUI() {
      aS.set(S.A); nS.set(S.n); iS.set(S.i); bS.set(S.B); bS.el.hidden = !S.white;
      lightSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String((b.dataset.value === "true") === S.white)); });
    }

    function current() {
      var main = trace(S.A, S.n, S.i), cols = null;
      if (S.white) cols = COLOURS.map(function (c) { var t = trace(S.A, nOf(c[0]), S.i); t.lam = c[0]; t.color = c[1]; t.name = c[2]; t.nl = nOf(c[0]); return t; });
      return { main: main, cols: cols };
    }

    /* ---------- tries ---------- */
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();
    function checkTries(c) {
      var m = c.main;
      if (!m.tir && Math.abs(m.r1 - S.A / 2) <= 0.3) tries.mark("min");
      if (m.tir) tries.mark("tir");
      if (S.white && c.cols.every(function (t) { return !t.tir; }) && c.cols[6].delta - c.cols[0].delta >= 0.5) tries.mark("white");
      if (S.A <= 6 && S.i <= 10 && !m.tir && Math.abs(m.delta - (S.n - 1) * S.A) <= 0.03 * (S.n - 1) * S.A) tries.mark("thin");
    }

    /* ---------- pointer: drag the laser ---------- */
    var dragging = false, LASER = 26;
    sim.pointer({
      down: function (pt) {
        var g = geom(S.A);
        if (pt.m.x > g.apex.x - 2) return false;
        dragging = true; this.drag(pt); return true;
      },
      drag: function (pt) {
        var Q = trace(S.A, S.n, S.i).Q, d = norm(Q.x - pt.m.x, Q.y - pt.m.y);
        S.i = K.clamp(Math.round((ang(d) + S.A / 2) * 2) / 2, 0, 90);
        syncUI(); changed();
      },
      up: function () { dragging = false; }
    });

    /* ---------- Play: sweep the angle of incidence ---------- */
    var sweep = null;
    function startSweep() { sweep = { d: [], e: [], red: [], vio: [] }; S.i = 0; syncUI(); changed(true); }
    sim.on("step", function () {
      if (!sweep) return;
      S.i = Math.min(90, S.i + 15 * K.DT);
      var c = current();
      if (!c.main.tir) { sweep.d.push([S.i, c.main.delta]); sweep.e.push([S.i, c.main.e]); }
      if (c.cols) {
        if (!c.cols[0].tir) sweep.red.push([S.i, c.cols[0].delta]);
        if (!c.cols[6].tir) sweep.vio.push([S.i, c.cols[6].delta]);
      }
      iS.set(S.i);
      if (S.i >= 90) {
        sim.pause(); transportUI.render(); sweep.done = true;
        var low = sweep.d.reduce(function (a, p) { return p[1] < a[1] ? p : a; }, [0, 1e9]);
        if (sweep.d.length) K.flash(P.note, "Smallest deviation " + K.fmt(low[1], 1) + "° at i ≈ " + K.fmt(low[0], 1) + "°", 4000);
      }
      changed(true);
    });

    /* ---------- drawing ---------- */
    function beam(ctx, a, b, color, op, w) {
      var A = sim.px(a.x, a.y), B = sim.px(b.x, b.y);
      ctx.save(); ctx.globalAlpha = op; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineWidth = sim.u(w || 3);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = sim.u(1.2); ctx.setLineDash([sim.u(5), sim.u(17)]);
      ctx.lineDashOffset = -(performance.now() / 1000 * 50) % sim.u(22);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.restore();
    }
    function dashed(ctx, a, b, color, w) {
      var A = sim.px(a.x, a.y), B = sim.px(b.x, b.y);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = sim.u(w || 1.2); ctx.setLineDash([sim.u(4), sim.u(5)]);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.restore();
    }
    function along(p, d, L) { return { x: p.x + d.x * L, y: p.y + d.y * L }; }
    var SCREEN = 46;
    function toScreen(p, d) { var s = (SCREEN - p.x) / d.x; return along(p, d, d.x > 0.05 ? Math.min(s, 80) : 40); }

    sim.on("under", function (ctx) {
      var g = geom(S.A), a = sim.px(g.apex.x, g.apex.y), l = sim.px(g.L.x, g.L.y), r = sim.px(g.R.x, g.R.y), v = sim.view();
      sim.drawGround(ctx, sim.px(0, -0.3).y);
      ctx.fillStyle = K.alpha(th.normal, 0.16 + (S.n - 1.2) * 0.2); ctx.strokeStyle = K.alpha(th.normal, 0.9); ctx.lineWidth = sim.u(1.5);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(r.x, r.y); ctx.lineTo(l.x, l.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      // apex angle
      var a0 = Math.PI / 2 + S.A / 2 * DEG, a1 = Math.PI / 2 - S.A / 2 * DEG;
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.2);
      ctx.beginPath(); ctx.arc(a.x, a.y, sim.u(26), a1, a0); ctx.stroke();
      K.label(ctx, "A = " + K.fmt(S.A, 0) + "°", a.x, a.y + sim.u(46), th.ink, { s: sim.u(1) });
      K.label(ctx, "n = " + K.fmt(S.n, 2), (l.x + r.x) / 2, l.y - sim.u(10), th.ink, { s: sim.u(1) });
      // a screen to catch the beam
      var sc = sim.px(SCREEN, 0);
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.line; ctx.fillRect(sc.x, v.y0 + sim.u(20), sim.u(8), sc.y - v.y0 - sim.u(20)); ctx.strokeRect(sc.x, v.y0 + sim.u(20), sim.u(8), sc.y - v.y0 - sim.u(20));
      K.label(ctx, "screen", sc.x + sim.u(4), v.y0 + sim.u(18), th.muted, { s: sim.u(1) });
    });

    sim.on("over", function (ctx) {
      var c = current(), m = c.main, g = m.g, src = along(m.Q, m.d, -LASER);
      // normals at both faces
      dashed(ctx, along(m.Q, g.n1, 8), along(m.Q, g.n1, -6), th.muted);
      if (m.X) dashed(ctx, along(m.X, g.n2, 8), along(m.X, g.n2, -6), th.muted);
      var rays = c.cols || [m];
      beam(ctx, src, m.Q, c.cols ? th.ink : th.ten, 1, 3.5);
      rays.forEach(function (t) {
        var col = c.cols ? t.color : th.ten, op = c.cols ? 0.85 : 1;
        if (!t.X) return;
        beam(ctx, t.Q, t.X, col, op, c.cols ? 2 : 3.5);
        if (t.tir) { beam(ctx, t.X, along(t.X, t.ref, 10), col, 0.8, 2.5); return; }
        beam(ctx, t.X, toScreen(t.X, t.o), col, op, c.cols ? 2.5 : 3.5);
      });
      // the laser
      var s = sim.px(src.x, src.y), a = Math.atan2(-m.d.y, m.d.x);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
      ctx.fillStyle = th.body; ctx.fillRect(-sim.u(34), -sim.u(7), sim.u(34), sim.u(14));
      ctx.fillStyle = c.cols ? th.surface : th.ten; ctx.fillRect(-sim.u(4), -sim.u(8), sim.u(6), sim.u(16));
      ctx.restore();
      if (!dragging && !sweep) K.label(ctx, "drag the laser", s.x, s.y - sim.u(16), th.muted, { s: sim.u(1) });
      // the deviation: original direction (dashed) against the way it leaves
      if (!m.tir) {
        var Xp = meet(m.Q, m.d, m.X, m.o);
        if (Xp) {
          dashed(ctx, m.Q, along(m.Q, m.d, Xp.s + 18), K.alpha(th.ink, 0.5), 1.4);
          var C = sim.px(Xp.x, Xp.y), r = sim.u(46), a0 = -ang(m.d) * DEG, a1 = -ang(m.o) * DEG;
          ctx.strokeStyle = th.acc; ctx.lineWidth = sim.u(2);
          ctx.beginPath(); ctx.arc(C.x, C.y, r, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
          K.label(ctx, "δ = " + K.fmt(m.delta, 1) + "°", C.x + r + sim.u(8), C.y + sim.u(16), th.acc, { s: sim.u(1), align: "left", bg: true });
        }
        var Qp = sim.px(m.Q.x, m.Q.y);
        K.label(ctx, "i = " + K.fmt(S.i, 1) + "°", Qp.x - sim.u(14), Qp.y - sim.u(18), th.ten, { s: sim.u(1), align: "right", bg: true });
        var Xq = sim.px(m.X.x, m.X.y);
        K.label(ctx, "e = " + K.fmt(m.e, 1) + "°", Xq.x + sim.u(14), Xq.y - sim.u(18), th.ten, { s: sim.u(1), align: "left", bg: true });
      } else {
        var Xr = sim.px(m.X.x, m.X.y);
        K.label(ctx, "r₂ = " + K.fmt(m.r2, 1) + "° > θc: totally reflected", Xr.x + sim.u(14), Xr.y - sim.u(18), th.app, { s: sim.u(1), align: "left", bg: true });
      }
      if (c.cols && c.cols.every(function (t) { return !t.tir; })) {
        var top = toScreen(c.cols[0].X, c.cols[0].o), bot = toScreen(c.cols[6].X, c.cols[6].o), tp = sim.px(top.x, top.y), bp = sim.px(bot.x, bot.y);
        K.label(ctx, "red", tp.x + sim.u(14), tp.y + sim.u(6), "#ef4444", { s: sim.u(1), align: "left" });
        K.label(ctx, "violet", bp.x + sim.u(14), bp.y + sim.u(14), "#a855f7", { s: sim.u(1), align: "left" });
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">deviation δ vs i</b> · a U-shaped curve with one minimum, δ<sub>m</sub></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-ten">emergent angle e vs i</b> · crosses the line e = i exactly at minimum deviation</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">δ<sub>m</sub> vs apex angle A</b> · dashed is the thin-prism rule (n − 1)A, good for small A</p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gD = new K.Graph(cv[0], { yLabel: "δ (°)", xLabel: "i (°)", xMax: 90, yMin: 0, color: th.acc });
    var gE = new K.Graph(cv[1], { yLabel: "e (°)", xLabel: "i (°)", xMax: 90, yMin: 0, yMax: 90, color: th.ten });
    var gA = new K.Graph(cv[2], { yLabel: "δm (°)", xLabel: "A (°)", xMax: 60, yMin: 0, color: th.acc });

    var lastKey = "";
    function formulaCurves() {
      var d = [], e = [], red = [], vio = [];
      for (var i = 0; i <= 90; i += 0.5) {
        var f = formula(S.A, S.n, i);
        if (!f.tir) { d.push([i, f.delta]); e.push([i, f.e]); }
        if (S.white) {
          var fr = formula(S.A, nOf(700), i), fv = formula(S.A, nOf(400), i);
          if (!fr.tir) red.push([i, fr.delta]);
          if (!fv.tir) vio.push([i, fv.delta]);
        }
      }
      gD.clear(); gE.clear();
      gD.set("theory", { points: d, color: th.acc, dash: [5, 5], width: 1.5 });
      if (S.white) {
        gD.set("tred", { points: red, color: "#ef4444", dash: [4, 4], width: 1.2 });
        gD.set("tvio", { points: vio, color: "#a855f7", dash: [4, 4], width: 1.2 });
      }
      gE.set("line", { points: [[0, 0], [90, 90]], color: th.muted, dash: [3, 4], width: 1 });
      gE.set("theory", { points: e, color: th.ten, dash: [5, 5], width: 1.5 });
      // the δm-vs-A curve only depends on n, so recompute it only when n changes
      var key = S.n + "";
      if (key !== lastKey) {
        lastKey = key;
        var sm = [], thin = [];
        for (var A = 1; A <= 60; A += 1) {
          if (S.n * Math.sin(A / 2 * DEG) < 1) sm.push([A, tracedMin(A, S.n).delta]);
          thin.push([A, (S.n - 1) * A]);
        }
        gA.clear();
        gA.set("theory", { points: [[0, 0]].concat(thin), color: th.acc, dash: [5, 5], width: 1.5 });
        gA.set("sim", { points: [[0, 0]].concat(sm), color: th.acc, width: 2.5 });
      }
    }
    function graphUpdate(c) {
      if (sweep) {
        gD.set("sim", { points: sweep.d, color: th.acc, width: 2.5, dot: true });
        gE.set("sim", { points: sweep.e, color: th.ten, width: 2.5, dot: true });
        if (S.white) { gD.set("sred", { points: sweep.red, color: "#ef4444", width: 2 }); gD.set("svio", { points: sweep.vio, color: "#a855f7", width: 2 }); }
      }
      var m = c.main, md = minDev(S.A, S.n);
      gD.extra = function (ctx, X, Y) {
        if (md) {
          ctx.strokeStyle = th.acc; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(X(md.i), Y(0)); ctx.lineTo(X(md.i), Y(md.delta)); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = th.acc; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
          ctx.fillText("δm " + K.fmt(md.delta, 1) + "°", X(md.i), Y(md.delta) + 14);
        }
        if (!m.tir) { ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(X(S.i), Y(m.delta), 4, 0, Math.PI * 2); ctx.fill(); }
      };
      gE.extra = m.tir ? null : function (ctx, X, Y) { ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(X(S.i), Y(m.e), 4, 0, Math.PI * 2); ctx.fill(); };
      gA.extra = S.A <= 60 && md ? function (ctx, X, Y) { ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(X(S.A), Y(md.delta), 4, 0, Math.PI * 2); ctx.fill(); } : null;
      [gD, gE, gA].forEach(function (g) { g.dirty = true; g.draw(); });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Snell's law at each face", "Deviation", "Minimum deviation gives n", ""].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "r", label: "r₁ and r₂" }, { id: "e", label: "emergent angle e", cls: "c-ten" }, { id: "d", label: "deviation δ", cls: "c-acc" },
      { id: "dm", label: "minimum deviation δm", cls: "c-acc" }, { id: "nm", label: "n from δm" }, { id: "x", label: "" }
    ]);
    var xLabel = P.readouts.querySelectorAll(".readout span")[5];
    function B(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths(c) {
      var m = c.main, f = formula(S.A, S.n, S.i), md = minDev(S.A, S.n), n = K.fmt(S.n, 2);
      K.tex(eqEls[0], "\\sin" + K.fmt(S.i, 1) + "^\\circ = " + n + "\\sin r_1 \\Rightarrow r_1 = " + K.fmt(f.r1, 2) + "^\\circ;\\ r_2 = A - r_1 = " + K.fmt(f.r2, 2) + "^\\circ;\\ " +
        (f.tir ? n + "\\sin r_2 = " + K.fmt(S.n * Math.sin(f.r2 * DEG), 3) + " \\gt 1:\\ \\mathbf{TIR}" : "\\sin e = " + n + "\\sin r_2 \\Rightarrow e = \\mathbf{" + K.fmt(f.e, 2) + "^\\circ}"));
      K.tex(eqEls[1], f.tir ? "\\text{no emergent ray, so no deviation to measure}" : "\\delta = i + e - A = " + K.fmt(S.i, 1) + " + " + K.fmt(f.e, 2) + " - " + K.fmt(S.A, 0) + " = \\mathbf{" + K.fmt(f.delta, 2) + "^\\circ}");
      K.tex(eqEls[2], md ? "n = \\frac{\\sin\\frac{A + \\delta_m}{2}}{\\sin\\frac A2} = \\frac{\\sin" + K.fmt((S.A + md.delta) / 2, 2) + "^\\circ}{\\sin" + K.fmt(S.A / 2, 1) + "^\\circ} = " + K.fmt(S.n, 3) + "\\ \\Leftarrow\\ \\delta_m = \\mathbf{" + K.fmt(md.delta, 2) + "^\\circ}"
        : "n\\sin\\frac A2 = " + K.fmt(S.n * Math.sin(S.A / 2 * DEG), 3) + " \\ge 1:\\ \\text{no ray gets through at any angle}");
      if (S.white) {
        var nr = nOf(700), nv = nOf(400), dr = c.cols[0], dvv = c.cols[6];
        eqLabels[3].textContent = "Dispersion (thin-prism estimate, and dispersive power)";
        K.tex(eqEls[3], "\\delta_v - \\delta_r \\approx (n_v - n_r)A = (" + K.fmt(nv, 4) + " - " + K.fmt(nr, 4) + ")" + K.fmt(S.A, 0) + "^\\circ = \\mathbf{" + K.fmt((nv - nr) * S.A, 2) + "^\\circ},\\ \\omega = \\frac{n_v - n_r}{n_y - 1} = \\mathbf{" + K.fmt((nv - nr) / (S.n - 1), 4) + "}");
        xLabel.textContent = "violet − red spread";
        setR("x", dr.tir || dvv.tir ? "—" : K.fmt(dvv.delta - dr.delta, 2) + "°", "traced, at this i");
      } else {
        eqLabels[3].textContent = "Thin prism (small A and i)";
        K.tex(eqEls[3], "\\delta \\approx (n - 1)A = (" + n + " - 1)" + K.fmt(S.A, 0) + "^\\circ = \\mathbf{" + K.fmt((S.n - 1) * S.A, 2) + "^\\circ}" + (S.A > 10 ? "\\quad\\text{(A is large: expect a bigger error)}" : ""));
        xLabel.textContent = "critical angle θc";
        setR("x", S.n > 1 ? K.fmt(Math.asin(1 / S.n) / DEG, 2) + "°" : "—", "r₂ must stay below this");
      }
      setR("r", K.fmt(m.r1, 2) + "°, " + K.fmt(m.r2, 2) + "°", "sum " + K.fmt(m.r1 + m.r2, 2) + "° = A");
      setR("e", m.tir ? "none" : K.fmt(m.e, 2) + "°", m.tir ? "TIR at face 2" : "formula " + K.fmt(f.e, 2) + "°");
      setR("d", m.tir ? "—" : K.fmt(m.delta, 2) + "°", m.tir ? "" : "formula " + K.fmt(f.delta, 2) + "°");
      setR("dm", md ? K.fmt(md.delta, 2) + "°" : "—", md ? "at i = " + K.fmt(md.i, 2) + "°" : "");
      var nm = md ? Math.sin((S.A + md.delta) / 2 * DEG) / Math.sin(S.A / 2 * DEG) : null;
      setR("nm", md ? K.fmt(nm, 3) : "—", "sin((A+δm)/2) / sin(A/2)");
    }

    var slowMaths = K.throttle(function () { renderMaths(current()); }, 100);
    function changed(fromSweep) {
      if (!fromSweep && sweep) { sweep = null; sim.pause(); if (transportUI) transportUI.render(); }
      var c = current();
      formulaCurves(); graphUpdate(c);
      if (fromSweep) slowMaths(); else renderMaths(c);
      checkTries(c);
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>A prism bends light twice, both times towards its base. At the first face $\\sin i = n\\sin r_1$, at the second $n\\sin r_2 = \\sin e$, and geometry ties the two inside angles together: $r_1 + r_2 = A$. The total turn is the <b class=\"c-acc\">deviation</b> $\\delta = i + e - A$.</p>" +
      "<p>Sweep $i$ and $\\delta$ falls, bottoms out, then rises again. The bottom, <b>minimum deviation</b>, is the symmetric passage: $i = e$ and $r_1 = r_2 = A/2$. Measuring $\\delta_m$ is how labs find $n$: $n = \\sin\\frac{A+\\delta_m}{2} / \\sin\\frac A2$.</p>" +
      "<p>Glass slows violet light more than red, so $n$ depends on wavelength and white light fans out into a spectrum: <b>dispersion</b>. For a thin prism everything is linear: $\\delta = (n-1)A$.</p>" +
      '<div class="trap"><b>JEE trap: $\\delta = (n-1)A$ is only for thin prisms.</b> For $A = 60°$ it is badly wrong; use $\\delta_m = 2\\sin^{-1}(n\\sin\\frac A2) - A$. And don\'t assume light always gets through: if $r_2$ exceeds $\\theta_c$ it is totally reflected at the second face.</div>');

    function apply(s) {
      Object.keys(s).forEach(function (k) { S[k] = s[k]; });
      if (!("white" in s)) S.white = false;
      sweep = null; sim.pause(); sim.resetClock(); transportUI.render();
      syncUI(); changed();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "thin prism", setup: { A: 5, n: 1.5, i: 3.75 }, watch: "Predict δ, then read it on the stage",
        q: "A thin prism has apex angle $5°$ and refractive index $1.5$. Through what angle does it deviate a ray near normal incidence?",
        options: ["$2.5°$", "$3.3°$", "$5°$", "$7.5°$"], answer: 0,
        explain: "$\\delta = (n-1)A = 0.5 \\times 5° = 2.5°$. $7.5°$ is $nA$, and $3.3°$ is $A/n$. The lab's exact trace gives $2.50°$." },
      { level: "medium", tag: "minimum deviation", setup: { A: 60, n: Math.SQRT2, i: 45 }, watch: "Check that this is the bottom of the δ–i curve, then read n from δm",
        q: "An equilateral prism ($A = 60°$) gives a minimum deviation of $30°$. What is its refractive index?",
        options: ["$1.22$", "$1.41$", "$1.50$", "$1.73$"], answer: 1,
        hints: ["Use $n = \\sin\\frac{A+\\delta_m}{2} / \\sin\\frac A2$.", "That's $\\sin 45° / \\sin 30°$."],
        explain: "$n = \\dfrac{\\sin 45°}{\\sin 30°} = \\dfrac{0.707}{0.5} = \\sqrt2 = 1.41$. At minimum deviation $i = e = 45°$ and the ray inside runs parallel to the base. $1.73 = \\sqrt3$ comes from using $\\sin 60°/\\sin 30°$." },
      { level: "hard", tag: "grazing emergence", setup: { A: 60, n: 1.5, i: 28 }, watch: "The ray leaves almost along the face. Drop i by half a degree and it's trapped",
        q: "A prism has $A = 60°$ and $n = 1.5$. What is the smallest angle of incidence for which a ray can come out of the second face?",
        options: ["$18.2°$", "$27.9°$", "$41.8°$", "$48.6°$"], answer: 1,
        hints: ["The limiting ray meets the second face at the critical angle: $r_2 = \\theta_c$, with $\\sin\\theta_c = 1/1.5$.", "Then $r_1 = A - \\theta_c$, and $\\sin i = n\\sin r_1$."],
        explain: "$\\theta_c = \\sin^{-1}(1/1.5) = 41.8°$, so $r_1 = 60° - 41.8° = 18.2°$ and $\\sin i = 1.5\\sin 18.2° = 0.468$: $i = 27.9°$. Any smaller $i$ makes $r_2 \\gt \\theta_c$ and the light is trapped. $18.2°$ is $r_1$, not $i$." }
    ], apply, P);

    var transportUI = null;
    transportUI = K.transport(P, sim, {
      playLabel: "Sweep i",
      onPlay: function () { if (!sweep || sweep.done) startSweep(); },
      onReset: function () { sweep = null; sim.resetClock(); P.time.textContent = "t = 0.00 s"; changed(); }
    });
    syncUI(); changed();
    if (location.hostname === "localhost") window.__lab_prism = { S: S, apply: apply, current: current, trace: trace, formula: formula, minDev: minDev,
      tracedMin: tracedMin, nOf: nOf, changed: changed, sweep: function () { return sweep; } };

    return function destroy() { sim.destroy(); [gD, gE, gA].forEach(function (g) { g.destroy(); }); };
  }
})();
