/* Thermal properties, lab 1: thermal expansion. Rods, a bimetallic strip, a plate and a cube, and a rod clamped between walls. */
(function () {
  "use strict";
  var RAMP = 4;                       // seconds for one heating (or cooling) run
  var TMIN = -50, TMAX = 400;         // thermometer range (°C)
  var MATS = {
    invar:  { name: "Invar", a: 1.0e-6, Y: 1.4e11, col: "#6b7280" },
    steel:  { name: "Steel", a: 1.2e-5, Y: 2.0e11, col: "#94a3b8" },
    copper: { name: "Copper", a: 1.7e-5, Y: 1.1e11, col: "#c2703d" },
    brass:  { name: "Brass", a: 1.9e-5, Y: 1.0e11, col: "#d4a72c" },
    alu:    { name: "Aluminium", a: 2.3e-5, Y: 7.0e10, col: "#b8c4d6" }
  };
  var MAT_OPTS = Object.keys(MATS).map(function (k) { return { label: MATS[k].name, value: k }; });

  var lab = {
    id: "expansion", chapter: "heat", title: "Thermal expansion", short: "ΔL = αLΔT, bimetal strips, thermal stress",
    lede: "Heat a metal and every length in it grows by the same fraction, $\\alpha\\Delta T$. It's tiny, so the lab magnifies it. Stop it growing and the metal pushes back hard enough to buckle rails.",
    tries: [
      { id: "equal", title: "Keep the gap between two rods constant",
        text: "In <b>Rods</b>, pick two different metals and lengths so both rods grow by the same $\\Delta L$ (within 1%) when heated by at least 50 °C.",
        why: "Both grow by $\\alpha L\\Delta T$, so the difference in length stays fixed when $\\alpha_A L_A = \\alpha_B L_B$. For steel and copper: $L_{steel}/L_{copper} = 17/12$, e.g. 1.7 m and 1.2 m." },
      { id: "cool", title: "Make the bimetallic strip curl the other way",
        text: "In <b>Bimetal strip</b>, cool it at least 20 °C below the temperature it was made straight at.",
        why: "Heated, the high-α metal grows more and ends up on the outside of the curve, so the strip bends toward the low-α metal. Cooled, the high-α metal shrinks more and goes on the inside." },
      { id: "area", title: "Check that β = 2α and γ = 3α",
        text: "In <b>Plate & cube</b>, heat by at least 100 °C and compare $\\Delta A/A$ and $\\Delta V/V$ with $\\Delta L/L$.",
        why: "Every side grows by $(1 + \\alpha\\Delta T)$, so the area grows by $(1+\\alpha\\Delta T)^2 \\approx 1 + 2\\alpha\\Delta T$ and the volume by $1 + 3\\alpha\\Delta T$. The ratios are 2 and 3 up to a tiny $\\alpha\\Delta T$ correction." },
      { id: "stress", title: "Show the stress in a clamped rod doesn't depend on its length",
        text: "In <b>Clamped rod</b> with no gap, heat two rods of the same metal through the same $\\Delta T$ but with different lengths.",
        why: "A longer rod wants to grow more, but strain is $\\Delta L/L = \\alpha\\Delta T$ either way. So $\\sigma = Y\\alpha\\Delta T$ and $F = YA\\alpha\\Delta T$: no $L$ in sight." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  // three significant figures without switching to e-notation
  function sig(n, s) {
    if (!isFinite(n)) return "—";
    if (n === 0) return "0";
    var d = Math.max(0, (s || 3) - 1 - Math.floor(Math.log10(Math.abs(n))));
    return K.fmt(n, Math.min(d, 8));
  }
  function sci(a) {   // 1.7e-5 -> 1.7\times10^{-5}
    var e = Math.floor(Math.log10(Math.abs(a))), m = a / Math.pow(10, e);
    return K.fmt(m, Math.abs(m - Math.round(m)) < 1e-9 ? 0 : 1) + "\\times10^{" + e + "}";
  }
  // temperature as colour: blue when cold, grey at room temperature, orange then red when hot
  function tempRGB(T) {
    var stops = [[-50, [70, 130, 235]], [20, [150, 155, 165]], [150, [240, 140, 50]], [400, [235, 45, 35]]];
    if (T <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (T <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], f = (T - a[0]) / (b[0] - a[0]);
        return a[1].map(function (c, j) { return Math.round(c + (b[1][j] - c) * f); });
      }
    }
    return stops[stops.length - 1][1];
  }
  function tempCol(T, al) { var c = tempRGB(T); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (al === undefined ? 1 : al) + ")"; }
  function niceMag(maxPx) {   // the largest "nice" magnification that keeps the drawn change under maxPx
    var list = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 1e4, 2e4, 5e4, 1e5];
    var m = 1;
    list.forEach(function (v) { if (v <= maxPx) m = v; });
    return m;
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 420;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "rods", matA = "copper", matB = "steel";
    var T0S = K.slider({ label: "Start temperature $T_0$", unit: "°C", min: -50, max: 100, step: 5, value: 20, onInput: reset });
    var T1S = K.slider({ label: "Final temperature $T$", unit: "°C", min: TMIN, max: TMAX, step: 5, value: 220, onInput: reset,
      hint: "Or drag the thermometer on the stage." });
    var LAS = K.slider({ label: "Length of rod A $L_A$", unit: "m", min: 0.2, max: 2.5, step: 0.1, value: 1, onInput: reset });
    var LBS = K.slider({ label: "Length of rod B $L_B$", unit: "m", min: 0.2, max: 2.5, step: 0.1, value: 1, onInput: reset });
    var lS = K.slider({ label: "Strip length $\\ell$", unit: "cm", min: 5, max: 30, step: 1, value: 20, onInput: reset });
    var dS = K.slider({ label: "Thickness of each layer $d$", unit: "mm", min: 0.2, max: 2, step: 0.1, value: 0.5, onInput: reset });
    var aS = K.slider({ label: "Cross-section $A$", unit: "cm²", min: 0.5, max: 10, step: 0.5, value: 2, onInput: reset });
    var gS = K.slider({ label: "Gap to the right wall", unit: "mm", min: 0, max: 2, step: 0.05, value: 0, onInput: reset,
      hint: "0 means the rod is fixed to both walls." });
    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Rods", value: "rods" }, { label: "Bimetal strip", value: "bimetal" }, { label: "Plate & cube", value: "area" }, { label: "Clamped rod", value: "clamp" }], mode,
      function (v) { mode = v; if (v === "bimetal" && matA === matB) { matA = "brass"; matB = "invar"; segSet(segA, matA); segSet(segB, matB); } show(); reset(); }, "Experiment");
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h("<h3>Temperature</h3>"));
    [T0S, T1S].forEach(function (s) { P.controls.appendChild(s.el); });
    var grpA = K.h('<div><h3 class="lblA">Metal A</h3></div>');
    var segA = K.seg(MAT_OPTS, matA, function (v) { matA = v; reset(); }, "Metal A");
    grpA.appendChild(segA);
    var grpB = K.h("<div><h3>Metal B</h3></div>");
    var segB = K.seg(MAT_OPTS, matB, function (v) { matB = v; reset(); }, "Metal B");
    grpB.appendChild(segB);
    var grpRod = K.h("<div></div>"), grpStrip = K.h("<div></div>"), grpClamp = K.h("<div></div>");
    [LAS, LBS].forEach(function (s) { grpRod.appendChild(s.el); });
    [lS, dS].forEach(function (s) { grpStrip.appendChild(s.el); });
    [aS, gS].forEach(function (s) { grpClamp.appendChild(s.el); });
    [grpA, grpB, grpRod, grpStrip, grpClamp].forEach(function (g) { P.controls.appendChild(g); });
    P.controls.appendChild(K.h('<div class="legend"><span style="color:' + tempCol(-50) + '"><i></i>cold</span><span style="color:' + tempCol(20) + '"><i></i>20 °C</span>' +
      '<span style="color:' + tempCol(150) + '"><i></i>150 °C</span><span style="color:' + tempCol(400) + '"><i></i>400 °C</span><span class="c-app"><i></i>force on the walls</span></div>'));
    function segSet(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function show() {
      grpB.hidden = !(mode === "rods" || mode === "bimetal");
      LBS.el.hidden = mode !== "rods";
      LAS.el.hidden = mode === "bimetal";
      grpStrip.hidden = mode !== "bimetal";
      grpClamp.hidden = mode !== "clamp";
      grpA.querySelector(".lblA").textContent = mode === "rods" || mode === "bimetal" ? "Metal A" : "Metal";
      LAS.el.querySelector("label").innerHTML = K.md(mode === "rods" ? "Length of rod A $L_A$" : mode === "area" ? "Side of plate and cube $a$" : "Rod length $L$");
    }
    show();

    function params() {
      var A = MATS[matA], B = MATS[matB];
      return { mode: mode, A: A, B: B, kA: matA, kB: matB, T0: T0S.get(), T1: T1S.get(), LA: LAS.get(), LB: LBS.get(),
        l: lS.get() / 100, d: dS.get() / 1000, area: aS.get() * 1e-4, gap: gS.get() / 1000 };
    }

    /* ---------- the model ---------- */
    // Everything is stepped from the temperature: each step adds α L dT to every length.
    var st, rec, runs = [], mag = 1, stripS = 1800;
    function fresh(p) {
      return { T: p.T0, dLA: 0, dLB: 0, dlA: 0, dlB: 0, ext: 0, done: false };
    }
    function derived(p) {
      var dT = st.T - p.T0, o = { dT: dT };
      o.LAn = p.LA + st.dLA; o.LBn = p.LB + st.dLB;
      // bimetal: two layers with midlines d apart bend so their strain difference is d/R; + means it bends toward B
      var la = p.l + st.dlA, lb = p.l + st.dlB;
      o.kappa = Math.abs(la - lb) < 1e-15 ? 0 : (la - lb) / (p.l * p.d);
      o.R = o.kappa ? 1 / o.kappa : Infinity;
      var lm = p.l;
      o.tip = o.kappa ? (1 - Math.cos(o.kappa * lm)) / o.kappa : 0;
      // plate and cube from the stretched side
      var r = o.LAn / p.LA;
      o.fL = r - 1; o.fA = r * r - 1; o.fV = r * r * r - 1;
      // clamped rod: welded to both walls when there's no gap, otherwise it only pushes once it touches
      o.strain = p.gap === 0 ? st.ext / p.LA : Math.max(0, st.ext - p.gap) / p.LA;
      o.sigma = p.A.Y * o.strain;
      o.F = o.sigma * p.area;
      return o;
    }
    function setT(T) {   // move the temperature and stretch everything by α L dT
      var p = params(), dT = T - st.T;
      st.dLA += p.A.a * p.LA * dT; st.dLB += p.B.a * p.LB * dT;
      st.dlA += p.A.a * p.l * dT; st.dlB += p.B.a * p.l * dT;
      st.ext += p.A.a * p.LA * dT;
      st.T = T;
      var o = derived(p);
      rec.push({ x: Math.abs(o.dT), dLA: st.dLA * 1000, dLB: st.dLB * 1000, dlA: st.dlA * 1000, dlB: st.dlB * 1000, fL: o.fL * 1e3, fA: o.fA * 1e3, fV: o.fV * 1e3,
        diff: (o.LBn - o.LAn - (p.LB - p.LA)) * 1000, tip: o.tip * 1000, rA: o.fL ? o.fA / o.fL : 2, rV: o.fL ? o.fV / o.fL : 3, sig: o.sigma / 1e6 });
      if (rec.length > 2000) rec.splice(1, 1);
      checkTries(p, o);
    }

    var transOpts = { playLabel: "Heat", onReset: function () { reset(); }, onPlay: function () { if (st.done) reset(); } };
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params();
      st = fresh(p); rec = [{ x: 0, dLA: 0, dLB: 0, dlA: 0, dlB: 0, fL: 0, fA: 0, fV: 0, diff: 0, tip: 0, rA: 2, rV: 3, sig: 0 }];
      transOpts.playLabel = p.T1 < p.T0 ? "Cool" : "Heat";
      if (transportUI) transportUI.render();
      // magnify the change so the biggest one in this run shows up as ~120 px
      var span = Math.max(Math.abs(p.T1 - p.T0), 50), big;
      if (p.mode === "rods") big = Math.max(p.A.a * p.LA, p.B.a * p.LB) * span * S_ROD;
      else if (p.mode === "clamp") big = Math.max(p.A.a * p.LA * span, p.gap, 1e-9) * S_ROD;
      else big = p.A.a * span * 220;
      mag = niceMag(120 / Math.max(big, 1e-12));
      // the strip is drawn to a true scale chosen so its most curled shape this run still fits on the stage
      var km = Math.abs(p.A.a - p.B.a) * span / p.d, th2 = km * p.l, ext = km ? { x: th2 > Math.PI / 2 ? 1 / km : Math.sin(th2) / km, y: th2 > Math.PI ? 2 / km : (1 - Math.cos(th2)) / km } : { x: p.l, y: 0 };
      stripS = Math.min(1800, 600 / Math.max(ext.x, 1e-9), 170 / Math.max(ext.y, 1e-9));
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }

    sim.on("step", function () {
      if (st.done) return;
      var p = params(), rate = Math.max(Math.abs(p.T1 - p.T0), 5) / RAMP, dir = Math.sign(p.T1 - st.T);
      var next = st.T + dir * rate * K.DT;
      if (dir === 0 || (dir > 0 ? next >= p.T1 : next <= p.T1)) next = p.T1;
      setT(next);
      if (st.T === p.T1) finish();
      update(st.done);
    });

    function finish() {
      st.done = true;
      sim.pause(); transportUI.render();
      var p = params(), o = derived(p);
      if (p.mode === "clamp") {
        var run = { k: p.kA, dT: o.dT, gap: p.gap, L: p.LA, sigma: o.sigma };
        runs.forEach(function (r) {
          if (r.k === run.k && r.gap === 0 && run.gap === 0 && Math.abs(r.dT - run.dT) < 1e-9 && r.L !== run.L && Math.abs(o.dT) >= 10 &&
            Math.abs(r.sigma - run.sigma) <= 0.005 * Math.abs(run.sigma)) tries.mark("stress");
        });
        runs.push(run); if (runs.length > 30) runs.shift();
        K.flash(P.note, "σ = " + sig(o.sigma / 1e6, 3) + " MPa, F = " + sig(o.F / 1000, 3) + " kN");
      } else if (p.mode === "bimetal") K.flash(P.note, o.kappa ? "R = " + sig(Math.abs(o.R) * 100, 3) + " cm, bending toward " + (o.kappa > 0 ? p.B.name : p.A.name) : "Same metals: no bending");
      else K.flash(P.note, "ΔL = " + K.fmt(st.dLA * 1000, 3) + " mm");
    }

    function checkTries(p, o) {
      if (p.mode === "rods" && p.kA !== p.kB && Math.abs(o.dT) >= 50 && Math.abs(st.dLA) > 0 && Math.abs(st.dLA - st.dLB) <= 0.01 * Math.abs(st.dLA)) tries.mark("equal");
      if (p.mode === "bimetal" && p.kA !== p.kB && o.dT <= -20) tries.mark("cool");
      if (p.mode === "area" && o.dT >= 100) tries.mark("area");
    }

    /* ---------- direct manipulation: drag the thermometer ---------- */
    var TH = { x: 935, top: 55, bot: 360 };
    function tY(T) { return TH.bot - (T - TMIN) / (TMAX - TMIN) * (TH.bot - TH.top); }
    function yT(y) { return TMIN + (TH.bot - y) / (TH.bot - TH.top) * (TMAX - TMIN); }
    var dragging = false;
    function scrub(p) {
      var T = Math.round(K.clamp(yT(p.py), TMIN, TMAX));
      sim.pause(); transportUI.render();
      if (st.done) st.done = false;
      setT(T);
      update(true);
    }
    sim.pointer({
      down: function (p) { if (Math.abs(p.px - TH.x) > 30 || p.py < TH.top - 20 || p.py > TH.bot + 30) return false; dragging = true; scrub(p); },
      drag: function (p) { if (dragging) scrub(p); },
      up: function () { dragging = false; }
    });

    /* ---------- drawing ---------- */
    var S_ROD = 300, X0 = 90;     // px per metre for rods, left wall face
    function rect(ctx, x, y, w, h, fill, stroke) {
      ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sim.u(1.5); ctx.strokeRect(x, y, w, h); }
    }
    function wall(ctx, x, y0, y1, side) {
      ctx.fillStyle = th.ground; ctx.fillRect(side < 0 ? x - 26 : x, y0, 26, y1 - y0);
      ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      ctx.lineWidth = 1;
      for (var y = y0 + 8; y < y1; y += 14) { ctx.beginPath(); ctx.moveTo(x + side * 4, y); ctx.lineTo(x + side * 22, y - 10); ctx.stroke(); }
    }
    function rod(ctx, x, y, len, h, m, T, name) {
      rect(ctx, x, y - h / 2, len, h, m.col, th.ink);
      ctx.fillStyle = tempCol(T, 0.55); ctx.fillRect(x, y - h / 2, len, h);
      K.label(ctx, name, x + 10, y + 6, th.ink, { align: "left", font: "700 12px 'JetBrains Mono', monospace" });
    }
    function ghost(ctx, x, y, h) {
      ctx.strokeStyle = th.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = sim.u(1.5);
      ctx.beginPath(); ctx.moveTo(x, y - h / 2 - 12); ctx.lineTo(x, y + h / 2 + 12); ctx.stroke(); ctx.setLineDash([]);
    }
    sim.on("under", function (ctx) {
      var p = params(), o = derived(p);
      if (p.mode === "rods") drawRods(ctx, p, o);
      else if (p.mode === "bimetal") drawStrip(ctx, p, o);
      else if (p.mode === "area") drawArea(ctx, p, o);
      else drawClamp(ctx, p, o);
      drawThermo(ctx, p);
    });
    function magLabel(ctx, x, y) { K.label(ctx, "changes drawn ×" + mag, x, y, th.muted, { align: "left", font: "600 12px 'JetBrains Mono', monospace" }); }
    function drawRods(ctx, p, o) {
      wall(ctx, X0, 90, 330, -1);
      [[p.A, p.LA, st.dLA, 150, "A: " + p.A.name], [p.B, p.LB, st.dLB, 270, "B: " + p.B.name]].forEach(function (r) {
        var len = r[1] * S_ROD + r[2] * mag * S_ROD;
        ghost(ctx, X0 + r[1] * S_ROD, r[3], 34);
        rod(ctx, X0, r[3], len, 34, r[0], st.T, r[4]);
        K.label(ctx, (r[2] >= 0 ? "+" : "") + K.fmt(r[2] * 1000, 3) + " mm", X0 + len + 8, r[3] + 7, th.disp, { align: "left" });
      });
      magLabel(ctx, X0 + 10, 395);
    }
    function drawStrip(ctx, p, o) {
      var S = stripS, x0 = 170, y0 = 210, h = 14, l = p.l * S, k = o.kappa / S, n = 80;
      rect(ctx, x0 - 50, y0 - 40, 50, 80, th.ground, th["ground-top"]);
      K.label(ctx, "clamp", x0 - 25, y0 + 62, th.muted);
      // midline: heading turns toward B (screen +y) at curvature k
      function at(s, off) {
        var x, y, c, sn;
        if (Math.abs(k) < 1e-12) { x = s; y = 0; c = 1; sn = 0; }
        else { x = Math.sin(k * s) / k; y = (1 - Math.cos(k * s)) / k; c = Math.cos(k * s); sn = Math.sin(k * s); }
        return { x: x0 + x + sn * off, y: y0 + y - c * off };
      }
      [[h / 2, p.A], [-h / 2, p.B]].forEach(function (L) {
        ctx.strokeStyle = L[1].col; ctx.lineWidth = h; ctx.lineCap = "butt";
        ctx.beginPath();
        for (var i = 0; i <= n; i++) { var q = at(l * i / n, L[0]); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
        ctx.stroke();
        ctx.strokeStyle = tempCol(st.T, 0.5); ctx.stroke();
      });
      ctx.strokeStyle = th.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = sim.u(1.5);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + l, y0); ctx.stroke(); ctx.setLineDash([]);
      var tip = at(l, 0);
      K.label(ctx, "A: " + p.A.name + " (α = " + sig(p.A.a * 1e6, 2) + "×10⁻⁶)", x0 + 6, y0 - h - 12, th.ink, { align: "left" });
      K.label(ctx, "B: " + p.B.name + " (α = " + sig(p.B.a * 1e6, 2) + "×10⁻⁶)", x0 + 6, y0 + h + 26, th.ink, { align: "left" });
      if (o.kappa) {
        K.label(ctx, "R = " + sig(Math.abs(o.R) * 100, 3) + " cm", tip.x + 14, tip.y + 6, th.disp, { align: "left", bg: true });
        K.label(ctx, "bends toward " + (o.kappa > 0 ? "B" : "A") + " (lower α)", 580, 395, th.acc, { align: "left" });
      }
      K.label(ctx, "drawn to scale (1 cm = " + K.fmt(S / 100, 0) + " px), layers thickened", x0 - 40, 395, th.muted, { align: "left", font: "600 12px 'JetBrains Mono', monospace" });
    }
    function drawArea(ctx, p, o) {
      var s0 = 210, cx = 250, cy = 215, sc = 1 + o.fL * mag, s = s0 * sc;
      // plate with a hole
      ctx.strokeStyle = th.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = sim.u(1.5);
      ctx.strokeRect(cx - s0 / 2, cy - s0 / 2, s0, s0);
      ctx.beginPath(); ctx.arc(cx, cy, s0 * 0.2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.rect(cx - s / 2, cy - s / 2, s, s); ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2, true);
      ctx.fillStyle = p.A.col; ctx.fill("evenodd"); ctx.fillStyle = tempCol(st.T, 0.55); ctx.fill("evenodd");
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5); ctx.stroke();
      K.label(ctx, "plate with a hole: the hole grows too", cx, cy + s0 / 2 + 40, th.ink);
      K.label(ctx, "ΔA/A = " + sig(o.fA * 1000, 3) + "×10⁻³", cx, cy - s0 / 2 - 22, th.disp, { bg: true });
      // cube in oblique projection
      var c0 = 150, c = c0 * sc, bx = 610, by = 300, dx = 0.45, dy = 0.35;
      function cube(sz, fill) {
        var f = [[bx, by], [bx + sz, by], [bx + sz, by - sz], [bx, by - sz]], o2 = [sz * dx, -sz * dy];
        var top = [f[3], f[2], [f[2][0] + o2[0], f[2][1] + o2[1]], [f[3][0] + o2[0], f[3][1] + o2[1]]];
        var side = [f[1], [f[1][0] + o2[0], f[1][1] + o2[1]], [f[2][0] + o2[0], f[2][1] + o2[1]], f[2]];
        [f, top, side].forEach(function (poly, i) {
          ctx.beginPath(); poly.forEach(function (q, j) { if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath();
          if (fill) { ctx.fillStyle = p.A.col; ctx.fill(); ctx.fillStyle = tempCol(st.T, 0.4 + 0.12 * i); ctx.fill(); ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5); ctx.stroke(); }
          else { ctx.strokeStyle = th.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = sim.u(1.5); ctx.stroke(); ctx.setLineDash([]); }
        });
      }
      cube(c, true); cube(c0, false);
      K.label(ctx, "ΔV/V = " + sig(o.fV * 1000, 3) + "×10⁻³", bx + c0 * 0.7, by + 38, th.disp, { bg: true });
      magLabel(ctx, 40, 400);
    }
    function drawClamp(ctx, p, o) {
      var y = 210, h = 40, L = p.LA * S_ROD, gapPx = p.gap * mag * S_ROD, xr = X0 + L + gapPx;
      wall(ctx, X0, 120, 300, -1); wall(ctx, xr, 120, 300, 1);
      var free = L + st.ext * mag * S_ROD, drawn = p.gap === 0 ? L : Math.min(free, L + gapPx);
      // where the end would be if nothing held it
      if (Math.abs(free - drawn) > 0.5) {
        ctx.strokeStyle = th.muted; ctx.setLineDash([5, 4]); ctx.lineWidth = sim.u(1.5);
        ctx.strokeRect(X0, y - h / 2, free, h); ctx.setLineDash([]);
        K.label(ctx, "free length", X0 + free, y - h / 2 - 8, th.muted, { align: "right" });
      }
      rod(ctx, X0, y, drawn, h, p.A, st.T, p.A.name + ", L = " + K.fmt(p.LA, 1) + " m");
      if (o.F) {
        var k = 90 / Math.max(Math.abs(o.F), 1), sgn = o.F > 0 ? 1 : -1;
        // compression: the walls push in on the rod; tension: they pull out
        K.arrow(ctx, X0 - 30 - (sgn > 0 ? 70 : 0), y, X0 - 30 - (sgn > 0 ? 0 : 70), y, th.app, { s: sim.u(1), width: 4 });
        K.arrow(ctx, xr + 30 + (sgn > 0 ? 70 : 0), y, xr + 30 + (sgn > 0 ? 0 : 70), y, th.app, { s: sim.u(1), width: 4 });
        K.label(ctx, (sgn > 0 ? "compressed: " : "stretched: ") + "F = " + sig(Math.abs(o.F) / 1000, 3) + " kN", X0 + 10, y + h / 2 + 34, th.app, { align: "left" });
        void k;
      }
      K.label(ctx, "σ = " + sig(o.sigma / 1e6, 3) + " MPa", X0 + 10, y - h / 2 - 14, th.ink, { align: "left", bg: true });
      if (p.gap > 0) K.label(ctx, "gap " + K.fmt(p.gap * 1000, 2) + " mm", X0 + L + gapPx / 2, y + h / 2 + 62, th.muted);
      magLabel(ctx, X0 + 10, 395);
    }
    function drawThermo(ctx, p) {
      var x = TH.x;
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.line; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 9, TH.top - 10, 18, TH.bot - TH.top + 20, 9) : ctx.rect(x - 9, TH.top - 10, 18, TH.bot - TH.top + 20);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, TH.bot + 22, 16, 0, Math.PI * 2); ctx.fillStyle = tempCol(st.T); ctx.fill(); ctx.stroke();
      ctx.fillStyle = tempCol(st.T); ctx.fillRect(x - 4, tY(st.T), 8, TH.bot + 10 - tY(st.T));
      ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.fillStyle = th.muted; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      [-50, 0, 100, 200, 300, 400].forEach(function (T) { ctx.fillText(T + "°", x - 14, tY(T)); ctx.fillRect(x - 12, tY(T), 4, 1); });
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.moveTo(x + 11, tY(p.T1)); ctx.lineTo(x + 20, tY(p.T1) - 5); ctx.lineTo(x + 20, tY(p.T1) + 5); ctx.fill();
      ctx.textAlign = "left"; ctx.fillText("T", x + 22, tY(p.T1));
      K.label(ctx, K.fmt(st.T, 0) + " °C", x, TH.top - 16, th.ink, { bg: true });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">ΔL vs |ΔT|</b> · straight lines, slope $\\alpha L$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">fractional change</b> · length, area, volume: slopes $\\alpha$, $2\\alpha$, $3\\alpha$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap g3cap"></p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas"), g3cap = P.graphs.querySelector(".g3cap");
    var g1 = new K.Graph(cv[0], { yLabel: "ΔL (mm)", xLabel: "|ΔT| (°C)", xMax: 200, color: th.disp });
    var g2 = new K.Graph(cv[1], { yLabel: "× 10⁻³", xLabel: "|ΔT| (°C)", xMax: 200, color: th.acc });
    var g3 = new K.Graph(cv[2], { yLabel: "", xLabel: "|ΔT| (°C)", xMax: 200, color: th.app });
    var G3 = {
      rods: { y: "L_B − L_A change (mm)", cap: '<b class="c-app">change in L_B − L_A</b> · flat when $\\alpha_A L_A = \\alpha_B L_B$' },
      bimetal: { y: "tip deflection (mm)", cap: '<b class="c-app">tip deflection</b> · dashed: $R(1 - \\cos\\frac{\\ell}{R})$, close to $\\ell^2/2R$ while small' },
      area: { y: "ratio to ΔL/L", cap: '<b class="c-app">(ΔA/A)/(ΔL/L) and (ΔV/V)/(ΔL/L)</b> · dashed at 2 and 3' },
      clamp: { y: "σ (MPa)", cap: '<b class="c-app">thermal stress</b> · dashed: $Y(\\alpha L\\Delta T - \\text{gap})/L$' }
    };
    function theory() {
      var p = params(), xm = Math.max(Math.abs(p.T1 - p.T0), 10), sg = p.T1 >= p.T0 ? 1 : -1, n = 40;
      [g1, g2, g3].forEach(function (g) { g.clear(); g.o.xMax = xm; });
      g3.o.yLabel = G3[p.mode].y; g3cap.innerHTML = K.md(G3[p.mode].cap);
      function line(f) { var pts = []; for (var i = 0; i <= n; i++) { var x = xm * i / n; pts.push([x, f(x * sg)]); } return pts; }
      var LA = p.mode === "bimetal" ? p.l : p.LA, LB = p.mode === "bimetal" ? p.l : p.LB;
      g1.set("fA", { points: line(function (d) { return p.A.a * LA * d * 1000; }), color: th.disp, dash: [5, 5], width: 1.5 });
      if (p.mode === "rods" || p.mode === "bimetal") g1.set("fB", { points: line(function (d) { return p.B.a * LB * d * 1000; }), color: th.app, dash: [5, 5], width: 1.5 });
      g2.set("fL", { points: line(function (d) { return p.A.a * d * 1e3; }), color: th.disp, dash: [5, 5], width: 1.5 });
      g2.set("fA", { points: line(function (d) { return 2 * p.A.a * d * 1e3; }), color: th.vel, dash: [5, 5], width: 1.5 });
      g2.set("fV", { points: line(function (d) { return 3 * p.A.a * d * 1e3; }), color: th.acc, dash: [5, 5], width: 1.5 });
      var f3 = {
        rods: function (d) { return (p.B.a * p.LB - p.A.a * p.LA) * d * 1000; },
        bimetal: function (d) { var k = (p.A.a - p.B.a) * d / p.d; return k ? (1 - Math.cos(k * p.l)) / k * 1000 : 0; },
        clamp: function (d) { var e = p.A.a * p.LA * d; return p.A.Y * (p.gap === 0 ? e : Math.max(0, e - p.gap)) / p.LA / 1e6; }
      };
      if (p.mode === "area") {
        g3.set("two", { points: [[0, 2], [xm, 2]], color: th.vel, dash: [5, 5], width: 1.5 });
        g3.set("three", { points: [[0, 3], [xm, 3]], color: th.acc, dash: [5, 5], width: 1.5 });
        g3.o.yMin = 0;
      } else { g3.o.yMin = undefined; g3.set("f", { points: line(f3[p.mode]), color: th.app, dash: [5, 5], width: 1.5 }); }
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params();
      function s(key) { return rec.map(function (r) { return [r.x, r[key]]; }); }
      var bim = p.mode === "bimetal";
      g1.set("A", { points: s(bim ? "dlA" : "dLA"), color: th.disp, width: 2.5, dot: true });
      if (p.mode === "rods" || bim) g1.set("B", { points: s(bim ? "dlB" : "dLB"), color: th.app, width: 2.5, dot: true });
      g2.set("L", { points: s("fL"), color: th.disp, width: 2.5, dot: true });
      g2.set("A", { points: s("fA"), color: th.vel, width: 2.5, dot: true });
      g2.set("V", { points: s("fV"), color: th.acc, width: 2.5, dot: true });
      if (p.mode === "area") {
        var pts = rec.filter(function (r) { return r.x > 0; });
        g3.set("rA", { points: pts.map(function (r) { return [r.x, r.rA]; }), color: th.vel, width: 2.5, dot: true });
        g3.set("rV", { points: pts.map(function (r) { return [r.x, r.rV]; }), color: th.acc, width: 2.5, dot: true });
      } else g3.set("s", { points: s({ rods: "diff", bimetal: "tip", clamp: "sig" }[p.mode]), color: th.app, width: 2.5, dot: true });
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      var o = derived(p);
      P.hud.innerHTML = "<span>T = " + K.fmt(st.T, 0) + " °C</span><span>ΔT = " + K.fmt(o.dT, 0) + " °C</span>";
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLbl = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "T", label: "temperature" }, { id: "dT", label: "ΔT" }, { id: "a", label: "ΔL", cls: "c-disp" },
      { id: "b", label: "", cls: "c-app" }, { id: "c", label: "" }, { id: "m", label: "drawn magnified" }
    ]);
    var rl = P.readouts.querySelectorAll(".readout > span");
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function eq(i, label, s) { eqLbl[i].textContent = label; K.tex(eqEls[i], s); }
    function renderMaths() {
      var p = params(), o = derived(p), dT = o.dT, a = p.A.a, Bt = B(dT, 0);
      var lenA = p.mode === "bimetal" ? p.l : p.LA;
      eq(0, (p.mode === "rods" ? "Rod A" : p.mode === "bimetal" ? "Layer A" : p.mode === "clamp" ? "If it were free" : "Each side") + ": ΔL = αLΔT",
        "\\Delta L = \\alpha L\\Delta T = (" + sci(a) + ")" + B(lenA, 2) + Bt + " = \\mathbf{" + K.fmt(a * lenA * dT * 1000, 3) + "}\\ \\text{mm}");
      setR("T", K.fmt(st.T, 0) + " °C"); setR("dT", K.fmt(dT, 0) + " °C", "T − T₀");
      setR("m", "×" + mag, "only in the drawing");
      if (p.mode === "rods") {
        var b = p.B.a;
        eq(1, "Rod B", "\\Delta L_B = (" + sci(b) + ")" + B(p.LB, 1) + Bt + " = \\mathbf{" + K.fmt(b * p.LB * dT * 1000, 3) + "}\\ \\text{mm}");
        eq(2, "The gap between them", "\\Delta(L_B - L_A) = (\\alpha_B L_B - \\alpha_A L_A)\\Delta T = \\mathbf{" + K.fmt((b * p.LB - a * p.LA) * dT * 1000, 3) + "}\\ \\text{mm}");
        eq(3, "New length of A", "L_A' = L_A(1 + \\alpha_A\\Delta T) = \\mathbf{" + K.fmt(p.LA * (1 + a * dT), 5) + "}\\ \\text{m}");
        rl[2].textContent = "ΔL of rod A"; rl[3].textContent = "ΔL of rod B"; rl[4].textContent = "αL of A vs B";
        setR("a", K.fmt(st.dLA * 1000, 3) + " mm", "formula " + K.fmt(a * p.LA * dT * 1000, 3));
        setR("b", K.fmt(st.dLB * 1000, 3) + " mm", "formula " + K.fmt(b * p.LB * dT * 1000, 3));
        setR("c", sig(a * p.LA * 1e6, 3) + " vs " + sig(b * p.LB * 1e6, 3), "μm/°C: equal keeps the gap");
      } else if (p.mode === "bimetal") {
        var da = a - p.B.a, Rf = da && dT ? p.d / (da * dT) : Infinity;
        eq(1, "One layer outgrows the other", "\\Delta\\ell_A - \\Delta\\ell_B = (\\alpha_A - \\alpha_B)\\ell\\Delta T = \\mathbf{" + K.fmt(da * p.l * dT * 1000, 4) + "}\\ \\text{mm}");
        eq(2, "Radius of curvature", isFinite(Rf) ? "R = \\frac{d}{(\\alpha_A - \\alpha_B)\\Delta T} = \\frac{" + K.fmt(p.d * 1000, 1) + "\\times10^{-3}}{(" + sci(Math.abs(da)) + ")" + B(Math.abs(dT), 0) + "} = \\mathbf{" + sig(Math.abs(Rf) * 100, 3) + "}\\ \\text{cm}" : "R = \\infty\\ \\text{(straight)}");
        eq(3, "Tip deflection (an arc of radius R)", isFinite(Rf) ? "y = R\\left(1 - \\cos\\tfrac{\\ell}{R}\\right) = " + B(Math.abs(Rf) * 100, 2) + "\\left(1 - \\cos\\tfrac{" + K.fmt(p.l * 100, 0) + "}{" + K.fmt(Math.abs(Rf) * 100, 2) + "}\\right) = \\mathbf{" + sig(Math.abs(Rf) * (1 - Math.cos(p.l / Math.abs(Rf))) * 1000, 3) + "}\\ \\text{mm}" +
          (p.l / Math.abs(Rf) < 0.3 ? "\\ \\approx \\frac{\\ell^2}{2R}" : "") : "y = 0");
        rl[2].textContent = "ΔL of layer A"; rl[3].textContent = "radius R"; rl[4].textContent = "tip moves";
        setR("a", K.fmt(st.dlA * 1000, 4) + " mm", "B: " + K.fmt(st.dlB * 1000, 4) + " mm");
        setR("b", o.kappa ? sig(Math.abs(o.R) * 100, 3) + " cm" : "∞", isFinite(Rf) ? "formula " + sig(Math.abs(Rf) * 100, 3) + " cm" : "straight");
        setR("c", sig(Math.abs(o.tip) * 1000, 3) + " mm", o.kappa ? "toward " + (o.kappa > 0 ? p.B.name : p.A.name) : "");
      } else if (p.mode === "area") {
        eq(1, "Area: β = 2α", "\\frac{\\Delta A}{A} = 2\\alpha\\Delta T = 2(" + sci(a) + ")" + Bt + " = \\mathbf{" + K.fmt(2 * a * dT * 1000, 3) + "}\\times10^{-3}\\quad\\text{exact } (1+\\alpha\\Delta T)^2 - 1 = " + K.fmt((Math.pow(1 + a * dT, 2) - 1) * 1000, 3) + "\\times10^{-3}");
        eq(2, "Volume: γ = 3α", "\\frac{\\Delta V}{V} = 3\\alpha\\Delta T = 3(" + sci(a) + ")" + Bt + " = \\mathbf{" + K.fmt(3 * a * dT * 1000, 3) + "}\\times10^{-3}\\quad\\text{exact } (1+\\alpha\\Delta T)^3 - 1 = " + K.fmt((Math.pow(1 + a * dT, 3) - 1) * 1000, 3) + "\\times10^{-3}");
        eq(3, "The hole grows like the metal around it", "\\Delta D = \\alpha D\\Delta T = (" + sci(a) + ")" + B(0.4 * p.LA * 100, 0) + "\\ \\text{cm}" + Bt + " = \\mathbf{" + K.fmt(a * 0.4 * p.LA * dT * 1000, 3) + "}\\ \\text{mm}");
        rl[2].textContent = "ΔL/L of a side"; rl[3].textContent = "ΔA/A ÷ ΔL/L"; rl[4].textContent = "ΔV/V ÷ ΔL/L";
        setR("a", K.fmt(o.fL * 1000, 3) + " ×10⁻³", "αΔT = " + K.fmt(a * dT * 1000, 3));
        setR("b", o.fL ? K.fmt(o.fA / o.fL, 4) : "—", "β/α = 2 (+αΔT)");
        setR("c", o.fL ? K.fmt(o.fV / o.fL, 4) : "—", "γ/α = 3 (+3αΔT)");
      } else {
        var e = a * p.LA * dT, strainF = p.gap === 0 ? e / p.LA : Math.max(0, e - p.gap) / p.LA, sigF = p.A.Y * strainF;
        eq(1, "Strain the walls force on it", p.gap === 0 ? "\\varepsilon = \\frac{\\alpha L\\Delta T}{L} = \\alpha\\Delta T = \\mathbf{" + sig(strainF * 1000, 3) + "}\\times10^{-3}"
          : "\\varepsilon = \\frac{\\alpha L\\Delta T - \\text{gap}}{L} = \\frac{" + K.fmt(e * 1000, 3) + " - " + K.fmt(p.gap * 1000, 2) + "}{" + K.fmt(p.LA * 1000, 0) + "} = \\mathbf{" + sig(strainF * 1000, 3) + "}\\times10^{-3}");
        eq(2, "Thermal stress", "\\sigma = Y\\varepsilon = (" + sci(p.A.Y) + ")(" + sig(strainF * 1000, 3) + "\\times10^{-3}) = \\mathbf{" + sig(sigF / 1e6, 3) + "}\\ \\text{MPa}");
        eq(3, "Force on each wall", "F = \\sigma A = (" + sig(sigF / 1e6, 3) + "\\times10^{6})(" + K.fmt(p.area * 1e4, 1) + "\\times10^{-4}) = \\mathbf{" + sig(sigF * p.area / 1000, 3) + "}\\ \\text{kN}");
        rl[2].textContent = "free expansion"; rl[3].textContent = "stress σ"; rl[4].textContent = "force on walls";
        setR("a", K.fmt(st.ext * 1000, 3) + " mm", "αLΔT");
        setR("b", sig(o.sigma / 1e6, 3) + " MPa", "formula " + sig(sigF / 1e6, 3));
        setR("c", sig(Math.abs(o.F) / 1000, 3) + " kN", o.F > 0 ? "rod pushes the walls" : o.F < 0 ? "rod pulls the walls" : "not touching");
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Heat a solid and its atoms jiggle further apart, so <b>every length grows by the same fraction</b>: $\\Delta L = \\alpha L\\Delta T$. That includes the gap inside a ring and the hole in a plate: they grow as if they were made of the metal.</p>" +
      "<p>Areas pick up two such factors and volumes three: $\\beta = 2\\alpha$, $\\gamma = 3\\alpha$. Bond two metals with different $\\alpha$ and one outgrows the other, so the strip curls with $R = d/(\\alpha_1 - \\alpha_2)\\Delta T$, the high-α metal on the outside. That is a thermostat.</p>" +
      "<p>Stop a rod expanding and the walls must squeeze it back by the strain $\\alpha\\Delta T$. The stress is <b class=\"c-app\">$\\sigma = Y\\alpha\\Delta T$</b>, and it can reach hundreds of MPa for a modest ΔT.</p>" +
      '<div class="trap"><b>JEE trap: the hole gets bigger, not smaller.</b> Heat a plate with a hole and the hole expands by the plate\'s own $\\alpha$. And the force from a clamped rod, $YA\\alpha\\Delta T$, doesn\'t depend on its length: the length cancels in the strain.</div>');
    function apply(s) {
      mode = s.mode; segSet(modeSeg, mode);
      matA = s.A; segSet(segA, matA); if (s.B) { matB = s.B; segSet(segB, matB); }
      T0S.set(s.T0); T1S.set(s.T1);
      if (s.LA) LAS.set(s.LA); if (s.LB) LBS.set(s.LB);
      if (s.l) lS.set(s.l); if (s.d) dS.set(s.d);
      if (s.area) aS.set(s.area); gS.set(s.gap || 0);
      show(); reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "linear expansion", setup: { mode: "rods", A: "copper", B: "steel", LA: 2, LB: 1, T0: 20, T1: 120 }, watch: "Predict ΔL for rod A, then press Heat",
        q: "A 2.0 m copper rod ($\\alpha = 1.7\\times10^{-5}\\ /°\\text{C}$) is heated from 20 °C to 120 °C. By how much does it lengthen?",
        options: ["0.34 mm", "3.4 mm", "6.8 mm", "34 mm"], answer: 1,
        explain: "$\\Delta L = \\alpha L\\Delta T = (1.7\\times10^{-5})(2.0)(100) = 3.4\\times10^{-3}$ m = 3.4 mm. 6.8 mm would be using $2\\alpha$, which belongs to area. In the lab, rod A's readout lands on 3.400 mm." },
      { level: "medium", tag: "area expansion", setup: { mode: "area", A: "brass", LA: 0.5, T0: 20, T1: 120 }, watch: "Predict ΔA/A, then press Heat and watch the hole",
        q: "A brass plate ($\\alpha = 1.9\\times10^{-5}\\ /°\\text{C}$) has a circular hole in it. It is heated by 100 °C. What happens to the area of the hole?",
        options: ["It shrinks by 0.38%", "It grows by 0.19%", "It grows by 0.38%", "It grows by 0.57%"], answer: 2,
        hints: ["The hole behaves as if it were filled with brass: every length, including its diameter, grows by $\\alpha\\Delta T$.", "Area takes two factors of $(1 + \\alpha\\Delta T)$: $\\beta = 2\\alpha$."],
        explain: "The hole grows like the brass around it. $\\Delta A/A = 2\\alpha\\Delta T = 2(1.9\\times10^{-5})(100) = 3.8\\times10^{-3}$, i.e. 0.38%. 0.19% uses $\\alpha$ (that's the diameter), 0.57% uses $3\\alpha$ (volume), and the hole never shrinks on heating." },
      { level: "hard", tag: "stress with a gap", setup: { mode: "clamp", A: "steel", LA: 1, T0: 20, T1: 120, area: 2, gap: 0.3 }, watch: "Predict σ, then press Heat: watch the rod close the gap first",
        q: "A 1.0 m steel rod ($\\alpha = 1.2\\times10^{-5}\\ /°\\text{C}$, $Y = 2.0\\times10^{11}$ Pa) is fixed at one end. At 20 °C its free end is 0.30 mm from a rigid wall. What is the stress in the rod at 120 °C?",
        options: ["240 MPa", "180 MPa", "60 MPa", "0: the gap absorbs it"], answer: 1,
        hints: ["First find how far it would grow if free: $\\alpha L\\Delta T$. Compare with the gap.", "Only the part beyond the gap is squeezed: strain $= (\\alpha L\\Delta T - \\text{gap})/L$, then $\\sigma = Y \\times$ strain."],
        explain: "Free, it would grow $(1.2\\times10^{-5})(1.0)(100) = 1.2$ mm. The first 0.3 mm closes the gap, so the wall compresses it by 0.9 mm: strain $= 0.9\\times10^{-3}$ and $\\sigma = (2.0\\times10^{11})(0.9\\times10^{-3}) = 1.8\\times10^{8}$ Pa = 180 MPa. 240 MPa ignores the gap; 60 MPa uses the gap instead of what's left over." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, transOpts);
    reset();

    if (location.hostname === "localhost") window.__lab_expansion = {
      apply: apply, params: params,
      state: function () { var o = derived(params()); return { T: st.T, done: st.done, dLA: st.dLA, dLB: st.dLB, R: o.R, tip: o.tip, fL: o.fL, fA: o.fA, fV: o.fV, sigma: o.sigma, F: o.F, mag: mag }; },
      setT: function (T) { setT(T); update(true); },
      mode: function (v) { modeSeg.querySelector('[data-value="' + v + '"]').click(); },
      matA: function (v) { segA.querySelector('[data-value="' + v + '"]').click(); },
      matB: function (v) { segB.querySelector('[data-value="' + v + '"]').click(); },
      sliders: { T0: T0S, T1: T1S, LA: LAS, LB: LBS, l: lS, d: dS, area: aS, gap: gS }
    };
    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); if (window.__lab_expansion) delete window.__lab_expansion; };
  }
})();
