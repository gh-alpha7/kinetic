/* Thermal properties, lab 3: heat transfer. Conduction through slabs in series and parallel, radiation, and Newton's law of cooling. */
(function () {
  "use strict";
  var SIGMA = 5.67e-8, WIEN = 2.8978e-3, NC = 24;               // Stefan–Boltzmann (W/m²K⁴), Wien (m·K), cells per bar
  var HP = 6.62607015e-34, CL = 299792458, KB = 1.380649e-23;    // for Planck's spectrum
  var MATS = {
    copper: { name: "Copper", k: 400, rc: 3.45e6, col: "#c2703d" },
    alu:    { name: "Aluminium", k: 200, rc: 2.4e6, col: "#b8c4d6" },
    brass:  { name: "Brass", k: 100, rc: 3.2e6, col: "#d4a72c" },
    steel:  { name: "Steel", k: 50, rc: 3.6e6, col: "#94a3b8" },
    glass:  { name: "Glass", k: 1, rc: 2.0e6, col: "#a7d3d8" }
  };
  var MAT_OPTS = Object.keys(MATS).map(function (k) { return { label: MATS[k].name, value: k }; });
  var BALL = { rho: 19300, c: 134, name: "tungsten" };          // a tungsten ball survives 3000 K

  var lab = {
    id: "conduction", chapter: "heat", title: "Heat transfer", short: "conduction, radiation, Newton's cooling",
    lede: "Heat a bar at one end and watch the warmth creep along it until a steady current flows, just like charge through resistors. Then let a hot ball glow and cool by radiation, and time a cup of tea with Newton's law of cooling.",
    tries: [
      { id: "mid", title: "Put the junction exactly halfway",
        text: "In <b>Series</b>, with two different metals, get the junction temperature within 0.5 °C of the average of the two ends at steady state.",
        why: "The same current $H$ crosses both slabs, so each drops $HR$. Equal drops need equal resistances: $L_1/k_1 = L_2/k_2$. Copper (400) and brass (100) do it with $L_1 = 4L_2$." },
      { id: "four", title: "Get four times the heat current",
        text: "Run two identical bars in <b>Series</b> to steady state, then switch to <b>Parallel</b> with the same bars.",
        why: "In series the resistance is $2R$; in parallel it's $R/2$. Same ΔT, so the current goes up by a factor of 4." },
      { id: "sixteen", title: "Double the temperature, get 16 times the power",
        text: "In <b>Radiation</b>, start one run at some temperature and another at exactly twice it (in kelvin).",
        why: "$P = e\\sigma AT^4$, so $2^4 = 16$. Temperature must be absolute: doubling 27 °C to 54 °C only takes 300 K to 327 K." },
      { id: "half", title: "Watch the tea lose half its excess heat",
        text: "In <b>Newton cooling</b>, let it cool until it's halfway from where it started to room temperature.",
        why: "With $dT/dt = -k(T - T_0)$ the excess $T - T_0$ decays exponentially, so it always halves in the same time, $\\ln 2/k$, whatever it started at." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function sig(n, s) {
    if (!isFinite(n)) return "—";
    if (n === 0) return "0";
    var d = Math.max(0, (s || 3) - 1 - Math.floor(Math.log10(Math.abs(n))));
    return K.fmt(n, Math.min(d, 8));
  }
  function sci(v, s) {   // 1234 -> 1.23\times10^{3}
    if (!v) return "0";
    var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
    if (Math.abs(K.fmt(m, (s || 3) - 1)) >= 10) { e++; m /= 10; }
    return K.fmt(m, (s || 3) - 1) + "\\times10^{" + e + "}";
  }
  function lerpRGB(stops, T) {
    if (T <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (T <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], f = (T - a[0]) / (b[0] - a[0]);
        return a[1].map(function (c, j) { return Math.round(c + (b[1][j] - c) * f); });
      }
    }
    return stops[stops.length - 1][1];
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a === undefined ? 1 : a) + ")"; }
  var TSTOPS = [[0, [80, 140, 235]], [25, [150, 160, 175]], [100, [240, 140, 50]], [200, [225, 40, 30]]];
  function tempCol(T, a) { return rgba(lerpRGB(TSTOPS, T), a); }
  // roughly what a hot body looks like: dark, dull red, orange, yellow, white
  function glowRGB(T) { return lerpRGB([[600, [55, 45, 45]], [900, [150, 25, 10]], [1300, [235, 80, 10]], [1900, [255, 175, 60]], [3000, [255, 240, 210]]], T); }
  // spectral exitance (W/m² per µm) at wavelength lam (µm)
  function planck(lam, T) {
    var l = lam * 1e-6, x = HP * CL / (l * KB * T);
    if (x > 700) return 0;
    return 2 * Math.PI * HP * CL * CL / Math.pow(l, 5) / (Math.exp(x) - 1) * 1e-6;
  }
  function peakOf(T) {   // find the spectrum's peak numerically: coarse scan, then golden-section search
    var best = 0.1, bv = 0;
    for (var lam = 0.1; lam < 40; lam *= 1.01) { var v = planck(lam, T); if (v > bv) { bv = v; best = lam; } }
    var a = best / 1.02, b = best * 1.02, g = (Math.sqrt(5) - 1) / 2;
    for (var i = 0; i < 60; i++) {
      var c = b - g * (b - a), d = a + g * (b - a);
      if (planck(c, T) > planck(d, T)) b = d; else a = c;
    }
    return (a + b) / 2;
  }
  // tridiagonal solve (Thomas): a lower, b diagonal, c upper, d right-hand side
  function tridiag(a, b, c, d) {
    var n = b.length, cp = new Array(n), dp = new Array(n), x = new Array(n);
    cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
    for (var i = 1; i < n; i++) { var m = b[i] - a[i] * cp[i - 1]; cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m; }
    x[n - 1] = dp[n - 1];
    for (var j = n - 2; j >= 0; j--) x[j] = dp[j] - cp[j] * x[j + 1];
    return x;
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 440;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "series", m1 = "copper", m2 = "steel";
    var L1S = K.slider({ label: "Length of slab 1 $L_1$", unit: "cm", min: 1, max: 20, step: 1, value: 10, onInput: reset });
    var L2S = K.slider({ label: "Length of slab 2 $L_2$", unit: "cm", min: 1, max: 20, step: 1, value: 10, onInput: reset });
    var AS = K.slider({ label: "Cross-section $A$ (each)", unit: "cm²", min: 1, max: 20, step: 1, value: 10, onInput: reset });
    var THS = K.slider({ label: "Hot end $T_H$", unit: "°C", min: 0, max: 200, step: 5, value: 100, onInput: function (v) { if (TCS.get() > v) TCS.set(v); reset(); } });
    var TCS = K.slider({ label: "Cold end $T_C$", unit: "°C", min: 0, max: 100, step: 5, value: 0, onInput: function (v) { if (THS.get() < v) THS.set(v); reset(); } });
    var TrS = K.slider({ label: "Ball temperature $T$", unit: "K", min: 300, max: 3000, step: 50, value: 1200, onInput: reset });
    var TsS = K.slider({ label: "Surroundings $T_0$", unit: "K", min: 0, max: 600, step: 10, value: 300, onInput: reset });
    var eS = K.slider({ label: "Emissivity $e$", min: 0.1, max: 1, step: 0.05, value: 1, onInput: reset });
    var rS = K.slider({ label: "Radius $r$", unit: "cm", min: 0.5, max: 5, step: 0.5, value: 2, onInput: reset, hint: "A tungsten ball: ρ = 19 300 kg/m³, c = 134 J/kg·K." });
    var TiS = K.slider({ label: "Starts at $T_i$", unit: "°C", min: 40, max: 100, step: 1, value: 80, onInput: reset });
    var T0S = K.slider({ label: "Room $T_0$", unit: "°C", min: 0, max: 35, step: 1, value: 20, onInput: reset });
    var T1S = K.slider({ label: "Reads $T_1$ …", unit: "°C", min: 1, max: 99, step: 1, value: 60, onInput: reset });
    var t1S = K.slider({ label: "… after $t_1$", unit: "min", min: 1, max: 20, step: 0.5, value: 5, onInput: reset });
    var T2S = K.slider({ label: "How long from $T_1$ to $T_2$?", unit: "°C", min: 1, max: 99, step: 1, value: 40, onInput: reset });
    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Series", value: "series" }, { label: "Parallel", value: "parallel" }, { label: "Radiation", value: "rad" }, { label: "Newton cooling", value: "cool" }], mode,
      function (v) { mode = v; show(); reset(); }, "Experiment");
    P.controls.appendChild(modeSeg);
    var grpCond = K.h("<div><h3>Slab 1</h3></div>"), grpRad = K.h("<div><h3>Hot ball</h3></div>"), grpCool = K.h("<div><h3>Cooling cup</h3></div>");
    var seg1 = K.seg(MAT_OPTS, m1, function (v) { m1 = v; reset(); }, "Slab 1");
    var seg2 = K.seg(MAT_OPTS, m2, function (v) { m2 = v; reset(); }, "Slab 2");
    grpCond.appendChild(seg1); grpCond.appendChild(L1S.el);
    grpCond.appendChild(K.h("<h3>Slab 2</h3>")); grpCond.appendChild(seg2); grpCond.appendChild(L2S.el);
    grpCond.appendChild(K.h("<h3>Both</h3>"));
    [AS, THS, TCS].forEach(function (s) { grpCond.appendChild(s.el); });
    [TrS, TsS, eS, rS].forEach(function (s) { grpRad.appendChild(s.el); });
    [TiS, T0S, T1S, t1S, T2S].forEach(function (s) { grpCool.appendChild(s.el); });
    [grpCond, grpRad, grpCool].forEach(function (g) { P.controls.appendChild(g); });
    P.controls.appendChild(K.h('<div class="legend"><span style="color:' + tempCol(0) + '"><i></i>0 °C</span><span style="color:' + tempCol(100) + '"><i></i>100 °C</span>' +
      '<span style="color:' + tempCol(200) + '"><i></i>200 °C</span><span class="c-acc"><i></i>heat current</span><span class="c-normal"><i></i>absorbed radiation</span></div>'));
    function segSet(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function show() {
      grpCond.hidden = !(mode === "series" || mode === "parallel"); grpRad.hidden = mode !== "rad"; grpCool.hidden = mode !== "cool";
      L2S.el.hidden = mode === "parallel";
      L1S.el.querySelector("label").innerHTML = K.md(mode === "parallel" ? "Length of both bars $L$" : "Length of slab 1 $L_1$");
    }
    show();

    function params() {
      var p = { mode: mode, k1: m1, k2: m2, M1: MATS[m1], M2: MATS[m2], L1: L1S.get() / 100, L2: (mode === "parallel" ? L1S.get() : L2S.get()) / 100, A: AS.get() * 1e-4,
        TH: THS.get(), TC: TCS.get(), Tr: TrS.get(), Ts: TsS.get(), e: eS.get(), r: rS.get() / 100,
        Ti: TiS.get(), T0: T0S.get(), T1: T1S.get(), t1: t1S.get(), T2: T2S.get() };
      p.R1 = p.L1 / (p.M1.k * p.A); p.R2 = p.L2 / (p.M2.k * p.A);
      var mass = BALL.rho * 4 / 3 * Math.PI * Math.pow(p.r, 3);
      p.Cb = mass * BALL.c; p.Ab = 4 * Math.PI * p.r * p.r;
      p.kc = Math.log((p.Ti - p.T0) / (p.T1 - p.T0)) / p.t1;    // per minute, from the calibration reading
      return p;
    }
    // keep the cooling readings in order: T0 < T2 < T1 < Ti
    function orderCool() {
      var Ti = TiS.get(), T0 = T0S.get();
      if (T1S.get() >= Ti) T1S.set(Ti - 1);
      if (T1S.get() <= T0 + 1) T1S.set(Math.min(Ti - 1, T0 + 2));
      if (T2S.get() >= T1S.get()) T2S.set(T1S.get() - 1);
      if (T2S.get() <= T0) T2S.set(Math.min(T1S.get() - 1, T0 + 1));
    }

    /* ---------- conduction model: a chain of cells per bar, stepped implicitly ---------- */
    function chain(mats, A) {   // mats: [{M, L}] in order hot -> cold
      var cells = [];
      mats.forEach(function (s) { var dx = s.L / NC; for (var i = 0; i < NC; i++) cells.push({ k: s.M.k, dx: dx, C: s.M.rc * A * dx }); });
      var n = cells.length, G = [];
      for (var j = 0; j < n - 1; j++) G.push(1 / (cells[j].dx / (2 * cells[j].k * A) + cells[j + 1].dx / (2 * cells[j + 1].k * A)));
      return { cells: cells, G: G, gL: 2 * cells[0].k * A / cells[0].dx, gR: 2 * cells[n - 1].k * A / cells[n - 1].dx, A: A, T: [] };
    }
    function stepChain(c, TH, TC, h) {
      var n = c.cells.length, a = [], b = [], cc = [], d = [];
      for (var j = 0; j < n; j++) {
        var gl = j ? c.G[j - 1] : c.gL, gr = j < n - 1 ? c.G[j] : c.gR, Ch = c.cells[j].C / h;
        a.push(j ? -gl : 0); cc.push(j < n - 1 ? -gr : 0); b.push(Ch + gl + gr);
        d.push(Ch * c.T[j] + (j === 0 ? c.gL * TH : 0) + (j === n - 1 ? c.gR * TC : 0));
      }
      c.T = tridiag(a, b, cc, d);
    }
    function flows(c, TH, TC) { return { in: c.gL * (TH - c.T[0]), out: c.gR * (c.T[c.T.length - 1] - TC) }; }
    function interfaceT(c) {   // temperature where slab 1 meets slab 2
      var j = NC - 1, g1 = 2 * c.cells[j].k * c.A / c.cells[j].dx, g2 = 2 * c.cells[j + 1].k * c.A / c.cells[j + 1].dx;
      return (g1 * c.T[j] + g2 * c.T[j + 1]) / (g1 + g2);
    }
    function profile(c, TH, TC, split) {   // [x (m), T] along the chain, ends and interface included
      var pts = [[0, TH]], x = 0;
      c.cells.forEach(function (cell, j) {
        if (split && j === NC) pts.push([x, interfaceT(c)]);
        pts.push([x + cell.dx / 2, c.T[j]]); x += cell.dx;
      });
      pts.push([x, TC]);
      return pts;
    }
    function at(pts, x) {
      for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) { var f = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1); return pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1]); }
      return pts[pts.length - 1][1];
    }

    var st, rec, lastSeries = [], radRuns = [];
    var transOpts = { playLabel: "Heat it", onReset: function () { reset(); }, onPlay: function () { if (st.done) reset(); } };
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      if (mode === "cool") orderCool();
      var p = params();
      if (p.mode === "series" || p.mode === "parallel") {
        var chains = p.mode === "series" ? [chain([{ M: p.M1, L: p.L1 }, { M: p.M2, L: p.L2 }], p.A)] : [chain([{ M: p.M1, L: p.L1 }], p.A), chain([{ M: p.M2, L: p.L1 }], p.A)];
        chains.forEach(function (c) { c.T = c.cells.map(function () { return p.TC; }); });
        // time-lapse from the slowest bar's R C, so it reaches steady state in a few seconds
        var RC = Math.max.apply(null, chains.map(function (c) { var R = 1 / c.gL + c.G.reduce(function (s, g) { return s + 1 / g; }, 0) + 1 / c.gR, C = c.cells.reduce(function (s, x) { return s + x.C; }, 0); return R * C; }));
        st = { kind: "cond", chains: chains, h: RC / 600, t: 0, done: false, steady: false, probe: (p.mode === "series" ? (p.L1 + p.L2) : p.L1) * 0.3, probeBar: 0 };
        transOpts.playLabel = "Heat it";
      } else if (p.mode === "rad") {
        var P0 = p.e * SIGMA * p.Ab * (Math.pow(p.Tr, 4) - Math.pow(p.Ts, 4));
        var tau = Math.abs(P0) > 1e-9 ? p.Cb * Math.abs(p.Tr - p.Ts) / Math.abs(P0) : 10;
        var lapse = 1;
        [1, 2, 5, 10, 20, 50, 100, 200, 500].forEach(function (v) { if (tau / v >= 1.5) lapse = v; });
        st = { kind: "rad", T: p.Tr, t: 0, E: 0, lapse: lapse, done: false };
        transOpts.playLabel = "Let it cool";
      } else {
        st = { kind: "cool", T: p.Ti, t: 0, done: false, marks: {} };
        transOpts.playLabel = "Start the clock";
      }
      rec = []; record(p);
      P.time.textContent = "t = 0.00 s";
      if (transportUI) transportUI.render();
      theory(); update(true);
    }
    function condNow(p) {
      var o = { chains: st.chains.map(function (c) { return flows(c, p.TH, p.TC); }) };
      o.in = o.chains.reduce(function (s, f) { return s + f.in; }, 0);
      o.out = o.chains.reduce(function (s, f) { return s + f.out; }, 0);
      if (p.mode === "series") o.Tj = interfaceT(st.chains[0]);
      return o;
    }
    function record(p) {
      if (st.kind === "cond") { var o = condNow(p); rec.push({ t: st.t, in: o.in, out: o.out, Tj: o.Tj, I1: o.chains[0].out, I2: o.chains[1] ? o.chains[1].out : 0 }); }
      else if (st.kind === "rad") rec.push({ t: st.t, T: st.T, P: p.e * SIGMA * p.Ab * (Math.pow(st.T, 4) - Math.pow(p.Ts, 4)), x: (Math.pow(st.T, 4) - Math.pow(p.Ts, 4)) / 1e12 });
      else rec.push({ t: st.t, T: st.T, rate: p.kc * (st.T - p.T0) });
      if (rec.length > 4000) rec.splice(1, 1);
    }
    sim.on("step", function () {
      if (st.done) return;
      var p = params();
      if (st.kind === "cond") stepCond(p); else if (st.kind === "rad") stepRad(p); else stepCool(p);
      update(st.done);
    });
    function formulaH(p) { return p.mode === "series" ? (p.TH - p.TC) / (p.R1 + p.R2) : (p.TH - p.TC) * (1 / p.R1 + 1 / p.R2); }
    function stepCond(p) {
      st.chains.forEach(function (c) { stepChain(c, p.TH, p.TC, st.h); });
      st.t += st.h;
      record(p);
      var o = condNow(p), Hf = formulaH(p);
      if (Math.abs(o.in - o.out) <= 1e-6 * Math.max(Math.abs(Hf), 1e-9) || sim.steps > 20000) {
        st.done = st.steady = true; sim.pause(); transportUI.render();
        K.flash(P.note, "Steady: H = " + sig(o.out, 4) + " W in and out", 3000);
        if (p.mode === "series") {
          if (p.k1 !== p.k2 && Math.abs(o.Tj - (p.TH + p.TC) / 2) <= 0.5 && p.TH > p.TC) tries.mark("mid");
          lastSeries.push({ k1: p.k1, k2: p.k2, L1: p.L1, L2: p.L2, A: p.A, dT: p.TH - p.TC, H: o.out }); if (lastSeries.length > 20) lastSeries.shift();
        } else if (p.k1 === p.k2 && p.TH > p.TC) {
          lastSeries.forEach(function (s) {
            if (s.k1 === p.k1 && s.k2 === p.k1 && Math.abs(s.L1 - p.L1) < 1e-9 && Math.abs(s.L2 - p.L1) < 1e-9 && Math.abs(s.A - p.A) < 1e-12 && s.dT === p.TH - p.TC && Math.abs(o.out / s.H - 4) < 0.04) tries.mark("four");
          });
        }
      }
    }
    function dTdt(p, T) { return -p.e * SIGMA * p.Ab * (Math.pow(T, 4) - Math.pow(p.Ts, 4)) / p.Cb; }
    function stepRad(p) {
      if (st.t === 0) {   // a new run: remember where it started
        radRuns.push({ T: p.Tr, e: p.e, r: p.r, P: p.e * SIGMA * p.Ab * Math.pow(p.Tr, 4) }); if (radRuns.length > 20) radRuns.shift();
        var me = radRuns[radRuns.length - 1];
        radRuns.forEach(function (q) { if (q !== me && q.e === me.e && q.r === me.r && (Math.abs(q.T * 2 - me.T) < 1e-9 || Math.abs(me.T * 2 - q.T) < 1e-9)) tries.mark("sixteen"); });
      }
      var n = 10, h = K.DT * st.lapse / n;
      for (var i = 0; i < n; i++) {   // RK4
        var T = st.T, k1 = dTdt(p, T), k2 = dTdt(p, T + h * k1 / 2), k3 = dTdt(p, T + h * k2 / 2), k4 = dTdt(p, T + h * k3);
        st.T += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
      }
      st.t += K.DT * st.lapse;
      record(p);
      if (Math.abs(st.T - p.Ts) < 0.02 * Math.abs(p.Tr - p.Ts) + 0.5 || st.t > 400 * st.lapse) {
        st.done = true; sim.pause(); transportUI.render(); K.flash(P.note, "Nearly at the surroundings' temperature");
      }
    }
    function stepCool(p) {
      var dt = K.DT, T0 = st.T, t0 = st.t;     // 1 s on screen is 1 minute
      st.T = p.T0 + (st.T - p.T0) * Math.exp(-p.kc * dt);    // the exact step of dT/dt = -k(T - T0)
      st.t += dt;
      // exact crossing times inside this step
      [["T1", p.T1], ["T2", p.T2], ["half", (p.Ti + p.T0) / 2]].forEach(function (m) {
        if (st.marks[m[0]] === undefined && T0 > m[1] && st.T <= m[1]) st.marks[m[0]] = t0 + Math.log((T0 - p.T0) / (m[1] - p.T0)) / p.kc;
      });
      if (st.marks.half !== undefined) tries.mark("half");
      record(p);
      if (st.T - p.T0 <= 0.05 * (p.Ti - p.T0) || st.t >= 120) { st.done = true; sim.pause(); transportUI.render(); K.flash(P.note, "Close to room temperature"); }
    }

    /* ---------- direct manipulation: drag the probe along a bar ---------- */
    var X0 = 150, X1 = 850, probeDrag = false;
    function barGeom(p) {
      var hb = 16 + 3 * AS.get();
      return p.mode === "series" ? [{ y: 300, h: hb }] : [{ y: 270, h: hb }, { y: 370, h: hb }];
    }
    sim.pointer({
      down: function (q) {
        if (st.kind !== "cond") return false;
        var p = params(), bars = barGeom(p), hit = -1;
        bars.forEach(function (b, i) { if (Math.abs(q.py - b.y) < b.h / 2 + 24) hit = i; });
        if (hit < 0 || q.px < X0 - 10 || q.px > X1 + 10) return false;
        probeDrag = true; st.probeBar = hit; moveProbe(q, p);
      },
      drag: function (q) { if (probeDrag) moveProbe(q, params()); },
      up: function () { probeDrag = false; }
    });
    function moveProbe(q, p) {
      var Lt = p.mode === "series" ? p.L1 + p.L2 : p.L1;
      st.probe = K.clamp((q.px - X0) / (X1 - X0), 0, 1) * Lt;
      renderMaths();
    }
    function probeT(p) {
      var c = st.chains[st.probeBar] || st.chains[0];
      return at(profile(c, p.TH, p.TC, p.mode === "series"), st.probe);
    }

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      var p = params();
      if (st.kind === "cond") drawCond(ctx, p); else if (st.kind === "rad") drawRad(ctx, p); else drawCool(ctx, p);
    });
    function drawCond(ctx, p) {
      var bars = barGeom(p), top = bars[0].y - bars[0].h / 2 - 30, bot = bars[bars.length - 1].y + bars[bars.length - 1].h / 2 + 30;
      var Lt = p.mode === "series" ? p.L1 + p.L2 : p.L1, sx = (X1 - X0) / Lt;
      // reservoirs
      ctx.fillStyle = tempCol(p.TH, 0.9); ctx.fillRect(X0 - 100, top, 100, bot - top);
      ctx.fillStyle = tempCol(p.TC, 0.9); ctx.fillRect(X1, top, 100, bot - top);
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5); ctx.strokeRect(X0 - 100, top, 100, bot - top); ctx.strokeRect(X1, top, 100, bot - top);
      K.label(ctx, "T_H = " + p.TH + " °C", X0 - 50, bot + 22, th.ink); K.label(ctx, "T_C = " + p.TC + " °C", X1 + 50, bot + 22, th.ink);
      // the profile T(x) above the bars, with the steady-state formula dashed
      var pt = 60, pb = top - 26, Tmax = Math.max(p.TH, p.TC + 1), Tmin = p.TC;
      var Y = function (T) { return pb - (T - Tmin) / (Tmax - Tmin) * (pb - pt); };
      ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X0, pt); ctx.lineTo(X0, pb); ctx.lineTo(X1, pb); ctx.stroke();
      K.label(ctx, "T(x)", X0 - 8, pt + 10, th.muted, { align: "right" });
      st.chains.forEach(function (c, i) {
        var M = p.mode === "series" ? null : i ? p.M2 : p.M1;
        // steady-state formula: straight lines with a kink at the junction
        ctx.strokeStyle = th.muted; ctx.setLineDash([5, 4]); ctx.lineWidth = sim.u(1.5); ctx.beginPath();
        steadyPts(p, i).forEach(function (q, j) { var x = X0 + q[0] * sx, y = Y(q[1]); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = i ? th.app : th.disp; ctx.lineWidth = sim.u(2.5); ctx.beginPath();
        profile(c, p.TH, p.TC, p.mode === "series").forEach(function (q, j) { var x = X0 + q[0] * sx, y = Y(q[1]); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
        // the bar itself, one rectangle per cell coloured by its temperature
        var b = bars[i], x = X0;
        c.cells.forEach(function (cell, j) {
          var w = cell.dx * sx;
          var mat = M || (j < NC ? p.M1 : p.M2);
          ctx.fillStyle = mat.col; ctx.fillRect(x, b.y - b.h / 2, w + 0.5, b.h);
          ctx.fillStyle = tempCol(c.T[j], 0.6); ctx.fillRect(x, b.y - b.h / 2, w + 0.5, b.h);
          x += w;
        });
        ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5); ctx.strokeRect(X0, b.y - b.h / 2, X1 - X0, b.h);
        if (p.mode === "series") {
          var xj = X0 + p.L1 * sx;
          ctx.beginPath(); ctx.moveTo(xj, b.y - b.h / 2 - 6); ctx.lineTo(xj, b.y + b.h / 2 + 6); ctx.stroke();
          K.label(ctx, p.M1.name, (X0 + xj) / 2, b.y + b.h / 2 + 20, th.ink); K.label(ctx, p.M2.name, (xj + X1) / 2, b.y + b.h / 2 + 20, th.ink);
          K.label(ctx, "junction " + K.fmt(interfaceT(c), 2) + " °C", xj, b.y - b.h / 2 - 10, th.ink, { bg: true });
        } else K.label(ctx, M.name, X0 + 12, b.y + 5, th.ink, { align: "left" });
        // heat current arrow on the bar, thickness by size
        var f = flows(c, p.TH, p.TC), Hc = (f.in + f.out) / 2;
        if (Math.abs(Hc) > 1e-6) {
          var w2 = K.clamp(2 + Math.log10(1 + Math.abs(Hc)) * 2, 2, 10);
          K.arrow(ctx, X0 + (X1 - X0) * 0.62, b.y, X0 + (X1 - X0) * 0.62 + 60, b.y, th.acc, { width: w2, label: sig(Hc, 3) + " W" });
        }
      });
      // probe
      var pb2 = bars[st.probeBar] || bars[0], px = X0 + st.probe * sx;
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.moveTo(px, pb2.y - pb2.h / 2); ctx.lineTo(px - 7, pb2.y - pb2.h / 2 - 14); ctx.lineTo(px + 7, pb2.y - pb2.h / 2 - 14); ctx.fill();
      K.label(ctx, "probe " + K.fmt(probeT(p), 1) + " °C (drag)", px, pb2.y - pb2.h / 2 - 16, th.ink, { bg: true });
      K.label(ctx, "time-lapse ×" + sig(st.h * 60, 2) + " · " + K.fmt(st.t, 0) + " s", X1 + 90, 30, th.muted, { align: "right", font: "600 12px 'JetBrains Mono', monospace" });
    }
    function steadyPts(p, i) {
      if (p.mode === "series") { var Hs = formulaH(p), Tj = p.TH - Hs * p.R1; return [[0, p.TH], [p.L1, Tj], [p.L1 + p.L2, p.TC]]; }
      return [[0, p.TH], [p.L1, p.TC]];
      void i;
    }
    function drawRad(ctx, p) {
      var cx = 300, cy = 240, R = 30 + p.r * 100 * 18;
      ctx.fillStyle = rgba(glowRGB(p.Ts * 1.0 + 300), 0.08); ctx.fillRect(40, 40, 520, 380);
      ctx.strokeStyle = th.line; ctx.lineWidth = 1.5; ctx.strokeRect(40, 40, 520, 380);
      K.label(ctx, "surroundings at " + p.Ts + " K", 300, 412, th.muted, { font: "600 12px 'JetBrains Mono', monospace" });
      var c = glowRGB(st.T), glow = K.clamp((st.T - 700) / 1500, 0, 1);
      if (glow > 0) {
        var gr = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 2.6);
        gr.addColorStop(0, rgba(c, 0.55 * glow)); gr.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R * 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = rgba(c); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5); ctx.stroke();
      // emitted (out) and absorbed (in) arrows, length by log of power
      var Pe = p.e * SIGMA * p.Ab * Math.pow(st.T, 4), Pa = p.e * SIGMA * p.Ab * Math.pow(p.Ts, 4);
      var lenE = K.clamp(20 * Math.log10(1 + Pe), 0, 110), lenA = K.clamp(20 * Math.log10(1 + Pa), 0, 110);
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4 + 0.2, ux = Math.cos(a), uy = Math.sin(a);
        if (lenE > 4) K.arrow(ctx, cx + ux * (R + 6), cy + uy * (R + 6), cx + ux * (R + 6 + lenE), cy + uy * (R + 6 + lenE), th.acc, { width: 2.5 });
        var b2 = a + Math.PI / 8;
        if (lenA > 4) K.arrow(ctx, cx + Math.cos(b2) * (R + 10 + lenA), cy + Math.sin(b2) * (R + 10 + lenA), cx + Math.cos(b2) * (R + 10), cy + Math.sin(b2) * (R + 10), th.normal, { width: 2 });
      }
      K.label(ctx, K.fmt(st.T, 0) + " K", cx, cy + 6, st.T > 1500 ? "#222" : "#fff", { font: "700 14px 'JetBrains Mono', monospace" });
      var lm = WIEN / st.T * 1e6;
      K.label(ctx, "emits " + sig(Pe, 3) + " W", 600, 90, th.acc, { align: "left" });
      K.label(ctx, "absorbs " + sig(Pa, 3) + " W", 600, 120, th.normal, { align: "left" });
      K.label(ctx, "net loss " + sig(Pe - Pa, 3) + " W", 600, 150, th.ink, { align: "left" });
      K.label(ctx, "peak λ = " + sig(lm, 3) + " µm" + (lm < 0.75 ? " (visible)" : " (infrared)"), 600, 190, th.ink, { align: "left" });
      // where the peak sits against the visible band
      var bx = 600, bw = 360, by = 230, lmax = 6, LX = function (l) { return bx + Math.min(l, lmax) / lmax * bw; };
      var grd = ctx.createLinearGradient(LX(0.38), 0, LX(0.75), 0);
      ["#7b2cbf", "#3a86ff", "#38b000", "#ffd60a", "#fb5607", "#d00000"].forEach(function (col, k) { grd.addColorStop(k / 5, col); });
      ctx.fillStyle = th["surface-2"]; ctx.fillRect(bx, by, bw, 22);
      ctx.fillStyle = grd; ctx.fillRect(LX(0.38), by, LX(0.75) - LX(0.38), 22);
      ctx.strokeStyle = th.line; ctx.strokeRect(bx, by, bw, 22);
      ctx.fillStyle = th.ink; ctx.beginPath(); var xm = LX(lm); ctx.moveTo(xm, by - 2); ctx.lineTo(xm - 6, by - 12); ctx.lineTo(xm + 6, by - 12); ctx.fill();
      ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.fillStyle = th.muted; ctx.textAlign = "center"; ctx.textBaseline = "top";
      [0, 1, 2, 3, 4, 5, 6].forEach(function (l) { ctx.fillText(l + (l === 6 ? "+ µm" : ""), LX(l), by + 26); });
      K.label(ctx, "time-lapse ×" + st.lapse + " · " + K.fmt(st.t, 0) + " s", 960, 30, th.muted, { align: "right", font: "600 12px 'JetBrains Mono', monospace" });
    }
    function drawCool(ctx, p) {
      var x0 = 260, x1 = 440, top = 160, bot = 360, T = st.T;
      ctx.fillStyle = tempCol(T, 0.85); ctx.fillRect(x0, top + 30, x1 - x0, bot - top - 30);
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5);
      ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.lineTo(x1, bot); ctx.lineTo(x1, top); ctx.stroke();
      ctx.beginPath(); ctx.arc(x1 + 22, (top + bot) / 2 + 10, 34, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      // steam wisps fade as the excess temperature drops
      var ex = (T - p.T0) / Math.max(p.Ti - p.T0, 1);
      ctx.strokeStyle = K.alpha(th.muted, 0.15 + 0.6 * ex); ctx.lineWidth = 3;
      for (var k = 0; k < 3; k++) {
        ctx.beginPath();
        for (var s = 0; s <= 20; s++) { var y = top + 10 - s * 5, x = x0 + 50 + k * 40 + Math.sin(s * 0.6 + st.t * 3 + k) * 8; if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      }
      K.label(ctx, K.fmt(T, 1) + " °C", (x0 + x1) / 2, top + 70, th.ink, { bg: true, font: "700 14px 'JetBrains Mono', monospace" });
      K.label(ctx, "room " + p.T0 + " °C", (x0 + x1) / 2, bot + 30, th.muted);
      // stopwatch and the timeline of readings
      K.label(ctx, "t = " + K.fmt(st.t, 2) + " min", 720, 90, th.ink, { font: "700 18px 'JetBrains Mono', monospace" });
      K.label(ctx, "1 s on screen = 1 minute", 720, 115, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      var mk = st.marks, lines = [];
      lines.push("reached " + p.T1 + " °C at " + (mk.T1 !== undefined ? K.fmt(mk.T1, 2) + " min" : "…") + " (set: " + p.t1 + ")");
      lines.push("reached " + p.T2 + " °C at " + (mk.T2 !== undefined ? K.fmt(mk.T2, 2) + " min" : "…"));
      lines.push(mk.T1 !== undefined && mk.T2 !== undefined ? p.T1 + " → " + p.T2 + " °C took " + K.fmt(mk.T2 - mk.T1, 2) + " min" : "");
      lines.forEach(function (l, i) { K.label(ctx, l, 560, 170 + i * 30, i === 2 ? th.acc : th.ink, { align: "left" }); });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML = [0, 1, 2].map(function () { return '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>'; }).join("");
    var cv = P.graphs.querySelectorAll("canvas"), capEls = P.graphs.querySelectorAll(".graph-cap");
    var g1 = new K.Graph(cv[0], { yLabel: "T (°C)", xMax: 20, color: th.disp });
    var g2 = new K.Graph(cv[1], { yLabel: "H (W)", xMax: 5, xAuto: true, color: th.acc });
    var g3 = new K.Graph(cv[2], { yLabel: "T (°C)", xMax: 5, xAuto: true, color: th.app });
    var CAPS = {
      series: ['<b class="c-disp">T along the bar</b> · dashed: steady straight lines, kinked at the junction', '<b class="c-acc">heat current in and out</b> · equal once steady, dashed: $\\Delta T/(R_1 + R_2)$', '<b class="c-app">junction temperature</b> · dashed: $T_H - HR_1$'],
      parallel: ['<b class="c-disp">bar 1</b> and <b class="c-app">bar 2</b> profiles · both straight when steady', '<b class="c-acc">total heat current</b> · dashed: $\\Delta T(1/R_1 + 1/R_2)$', '<b class="c-disp">current in each bar</b> · dashed: $\\Delta T/R$'],
      rad: ['<b class="c-acc">spectrum now</b> · dashed line: Wien\'s $\\lambda_m = b/T$', '<b class="c-disp">T–t cooling</b> · dashed: Newton\'s law with $k = 4e\\sigma AT_0^3/mc$', '<b class="c-acc">net power vs $T^4 - T_0^4$</b> · straight: dashed slope $e\\sigma A$'],
      cool: ['<b class="c-disp">T–t</b> · dashed: $T_0 + (T_i - T_0)e^{-kt}$', '<b class="c-acc">ln(T − T₀) vs t</b> · a straight line of slope $-k$', '<b class="c-app">cooling rate vs T − T₀</b> · straight through 0, slope $k$']
    };
    function theory() {
      var p = params();
      [g1, g2, g3].forEach(function (g) { g.clear(); g.extra = null; });
      CAPS[p.mode].forEach(function (c, i) { capEls[i].innerHTML = K.md(c); });
      var dash = function (pts, col) { return { points: pts, color: col, dash: [5, 5], width: 1.5 }; };
      if (st.kind === "cond") {
        var Lt = (p.mode === "series" ? p.L1 + p.L2 : p.L1) * 100, tEnd = st.h * 1200;
        g1.o.xMax = Lt; g1.o.xLabel = "x (cm)"; g1.o.yLabel = "T (°C)"; g1.o.yMin = Math.min(p.TC, 0); g1.o.xAuto = false;
        g2.o.xMax = g3.o.xMax = tEnd; g2.o.xLabel = g3.o.xLabel = "t (s)"; g2.o.yLabel = "H (W)";
        g1.set("f0", dash(steadyPts(p, 0).map(function (q) { return [q[0] * 100, q[1]]; }), th.muted));
        g2.set("f", dash([[0, formulaH(p)], [tEnd, formulaH(p)]], th.acc));
        if (p.mode === "series") {
          var Tj = p.TH - formulaH(p) * p.R1;
          g3.o.yLabel = "T (°C)"; g3.set("f", dash([[0, Tj], [tEnd, Tj]], th.app));
        } else {
          g3.o.yLabel = "H (W)";
          g3.set("f1", dash([[0, (p.TH - p.TC) / p.R1], [tEnd, (p.TH - p.TC) / p.R1]], th.disp));
          g3.set("f2", dash([[0, (p.TH - p.TC) / p.R2], [tEnd, (p.TH - p.TC) / p.R2]], th.app));
        }
      } else if (st.kind === "rad") {
        g1.o.xMax = 12; g1.o.xLabel = "λ (µm)"; g1.o.yLabel = "M_λ (W/m²·µm)"; g1.o.yMin = 0; g1.o.xAuto = false;
        var tEnd2 = 60 * st.lapse;
        g2.o.xMax = tEnd2; g2.o.xLabel = "t (s)"; g2.o.yLabel = "T (K)";
        g3.o.xMax = Math.max(1e-6, (Math.pow(p.Tr, 4) - Math.pow(p.Ts, 4)) / 1e12); g3.o.xLabel = "T⁴ − T₀⁴ (×10¹² K⁴)"; g3.o.yLabel = "P (W)"; g3.o.xAuto = false;
        if (p.Ts > 0) {
          var kN = 4 * p.e * SIGMA * p.Ab * Math.pow(p.Ts, 3) / p.Cb, pts = [];
          for (var i = 0; i <= 80; i++) { var t = tEnd2 * i / 80; pts.push([t, p.Ts + (p.Tr - p.Ts) * Math.exp(-kN * t)]); }
          g2.set("f", dash(pts, th.disp));
        }
        g3.set("f", dash([[0, 0], [g3.o.xMax, p.e * SIGMA * p.Ab * g3.o.xMax * 1e12]], th.acc));
      } else {
        var te = Math.max(30, Math.log(20) / p.kc);
        g1.o.xMax = g2.o.xMax = te; g1.o.xLabel = g2.o.xLabel = "t (min)"; g1.o.yLabel = "T (°C)"; g1.o.yMin = p.T0; g1.o.xAuto = true;
        g2.o.yLabel = "ln(T − T₀)";
        g3.o.xMax = p.Ti - p.T0; g3.o.xLabel = "T − T₀ (°C)"; g3.o.yLabel = "−dT/dt (°C/min)"; g3.o.xAuto = false;
        var e1 = [], e2 = [];
        for (var j = 0; j <= 80; j++) { var tt = te * j / 80; e1.push([tt, p.T0 + (p.Ti - p.T0) * Math.exp(-p.kc * tt)]); e2.push([tt, Math.log(p.Ti - p.T0) - p.kc * tt]); }
        g1.set("f", dash(e1, th.disp)); g2.set("f", dash(e2, th.acc));
        g3.set("f", dash([[0, 0], [p.Ti - p.T0, p.kc * (p.Ti - p.T0)]], th.app));
      }
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params();
      if (st.kind === "cond") {
        st.chains.forEach(function (c, i) {
          g1.set("p" + i, { points: profile(c, p.TH, p.TC, p.mode === "series").map(function (q) { return [q[0] * 100, q[1]]; }), color: i ? th.app : th.disp, width: 2.5 });
        });
        if (p.mode === "parallel") g1.set("f0", { points: steadyPts(p, 0).map(function (q) { return [q[0] * 100, q[1]]; }), color: th.muted, dash: [5, 5], width: 1.5 });
        var cap = 3 * Math.abs(formulaH(p));   // the first instant at the hot face is a huge spike: clip it so the curve stays readable
        g2.set("in", { points: rec.map(function (r) { return [r.t, Math.min(r.in, cap)]; }), color: th.acc, width: 2.5, dot: true });
        g2.set("out", { points: rec.map(function (r) { return [r.t, r.out]; }), color: th.fric, width: 2.5, dot: true });
        if (p.mode === "series") g3.set("Tj", { points: rec.map(function (r) { return [r.t, r.Tj]; }), color: th.app, width: 2.5, dot: true });
        else {
          g3.set("I1", { points: rec.map(function (r) { return [r.t, r.I1]; }), color: th.disp, width: 2.5, dot: true });
          g3.set("I2", { points: rec.map(function (r) { return [r.t, r.I2]; }), color: th.app, width: 2.5, dot: true });
        }
        var o = condNow(p);
        ["f", "f1", "f2"].forEach(function (k) { [g2, g3].forEach(function (g) { if (g.series[k]) g.series[k].points[1][0] = Math.max(st.h * 1200, st.t); }); });
        P.hud.innerHTML = "<span>H in " + sig(o.in, 3) + " W</span><span>H out " + sig(o.out, 3) + " W</span>" + (st.steady ? "<span>steady</span>" : "");
      } else if (st.kind === "rad") {
        var sp = [];
        for (var l = 0.05; l <= 12; l += 0.05) sp.push([l, planck(l, st.T)]);
        g1.set("s", { points: sp, color: th.acc, width: 2.5 });
        var lm = WIEN / st.T * 1e6, top = planck(peakOf(st.T), st.T);
        g1.set("w", { points: [[lm, 0], [lm, top * 1.05]], color: th.ink, dash: [5, 5], width: 1.5 });
        g2.set("T", { points: rec.map(function (r) { return [r.t, r.T]; }), color: th.disp, width: 2.5, dot: true });
        if (p.Ts > 0 && g2.series.f && st.t > g2.series.f.points[80][0]) { var kN = 4 * p.e * SIGMA * p.Ab * Math.pow(p.Ts, 3) / p.Cb; g2.series.f.points = g2.series.f.points.map(function (q, i) { var tt = st.t * 1.5 * i / 80; return [tt, p.Ts + (p.Tr - p.Ts) * Math.exp(-kN * tt)]; }); }
        g3.set("P", { points: rec.map(function (r) { return [r.x, r.P]; }), color: th.acc, width: 2.5, dot: true });
        P.hud.innerHTML = "<span>T = " + K.fmt(st.T, 0) + " K</span><span>λₘ = " + sig(lm, 3) + " µm</span>";
      } else {
        g1.set("T", { points: rec.map(function (r) { return [r.t, r.T]; }), color: th.disp, width: 2.5, dot: true });
        g2.set("l", { points: rec.map(function (r) { return [r.t, Math.log(r.T - p.T0)]; }), color: th.acc, width: 2.5, dot: true });
        g3.set("r", { points: rec.map(function (r) { return [r.T - p.T0, r.rate]; }), color: th.app, width: 2.5, dot: true });
        P.hud.innerHTML = "<span>T = " + K.fmt(st.T, 2) + " °C</span><span>t = " + K.fmt(st.t, 2) + " min</span>";
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLbl = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [{ id: "a", label: "" }, { id: "b", label: "" }, { id: "c", label: "" }, { id: "d", label: "" }, { id: "e", label: "" }, { id: "f", label: "" }]);
    var rl = P.readouts.querySelectorAll(".readout > span"), rb = P.readouts.querySelectorAll(".readout > b");
    function R(i, label, cls, value, note) { rl[i].textContent = label; rb[i].className = cls || ""; setR("abcdef"[i], value, note); }
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function eq(i, label, s) { eqLbl[i].textContent = label; K.tex(eqEls[i], s); }
    function renderMaths() {
      var p = params();
      if (st.kind === "cond") mathsCond(p); else if (st.kind === "rad") mathsRad(p); else mathsCool(p);
    }
    function mathsCond(p) {
      var dT = p.TH - p.TC, Hf = formulaH(p), o = condNow(p);
      eq(0, "Thermal resistance R = L/kA", "R_1 = \\frac{" + K.fmt(p.L1, 2) + "}{" + p.M1.k + "\\times" + sci(p.A, 2) + "} = \\mathbf{" + sig(p.R1, 3) + "},\\quad R_2 = \\frac{" + K.fmt(p.L2, 2) + "}{" + p.M2.k + "\\times" + sci(p.A, 2) + "} = \\mathbf{" + sig(p.R2, 3) + "}\\ \\text{K/W}");
      if (p.mode === "series") {
        var Tj = p.TH - Hf * p.R1;
        eq(1, "In series, resistances add", "H = \\frac{T_H - T_C}{R_1 + R_2} = \\frac{" + K.fmt(dT, 0) + "}{" + sig(p.R1, 3) + " + " + sig(p.R2, 3) + "} = \\mathbf{" + sig(Hf, 4) + "}\\ \\text{W}");
        eq(2, "Junction temperature", "T_j = T_H - HR_1 = " + p.TH + " - " + B(Hf, 2) + B(p.R1, 4) + " = \\mathbf{" + K.fmt(Tj, 2) + "}\\ ^\\circ\\text{C}");
        eq(3, "Equivalent conductivity", "k_{eq} = \\frac{L_1 + L_2}{L_1/k_1 + L_2/k_2} = \\mathbf{" + sig((p.L1 + p.L2) / (p.L1 / p.M1.k + p.L2 / p.M2.k), 3) + "}\\ \\text{W/m·K}");
        R(2, "junction now", "c-app", K.fmt(o.Tj, 2) + " °C", "steady formula " + K.fmt(Tj, 2) + " °C");
      } else {
        var Rp = 1 / (1 / p.R1 + 1 / p.R2);
        eq(1, "In parallel, conductances add", "\\frac{1}{R} = \\frac{1}{" + sig(p.R1, 3) + "} + \\frac{1}{" + sig(p.R2, 3) + "} \\Rightarrow R = \\mathbf{" + sig(Rp, 3) + "}\\ \\text{K/W}");
        eq(2, "Total heat current", "H = \\frac{\\Delta T}{R} = \\frac{" + K.fmt(dT, 0) + "}{" + sig(Rp, 3) + "} = \\mathbf{" + sig(Hf, 4) + "}\\ \\text{W}");
        eq(3, "Equivalent conductivity (equal areas)", "k_{eq} = \\frac{k_1 + k_2}{2} = \\mathbf{" + sig((p.M1.k + p.M2.k) / 2, 3) + "}\\ \\text{W/m·K}");
        R(2, "bar 1 · bar 2", "c-disp", sig(o.chains[0].out, 3) + " · " + sig(o.chains[1].out, 3) + " W", "formula " + sig(dT / p.R1, 3) + " · " + sig(dT / p.R2, 3));
      }
      R(0, "heat current in", "c-acc", sig(o.in, 4) + " W", "at the hot end");
      R(1, "heat current out", "c-acc", sig(o.out, 4) + " W", st.steady ? "steady: formula " + sig(Hf, 4) : "still warming up");
      R(3, "probe", "", K.fmt(probeT(p), 2) + " °C", "x = " + K.fmt(st.probe * 100, 1) + " cm");
      R(4, "time to steady state", "", st.steady ? sig(st.t, 3) + " s" : "…", "real seconds");
      R(5, "time-lapse", "", "×" + sig(st.h * 60, 2), "storing heat slows the start");
    }
    function mathsRad(p) {
      var T = st.T, Pe = p.e * SIGMA * p.Ab * Math.pow(T, 4), Pn = p.e * SIGMA * p.Ab * (Math.pow(T, 4) - Math.pow(p.Ts, 4)), lm = WIEN / T * 1e6;
      eq(0, "Stefan–Boltzmann: P = eσAT⁴", "P = (" + K.fmt(p.e, 2) + ")(5.67\\times10^{-8})(" + sci(p.Ab, 3) + ")" + B(T, 0) + "^4 = \\mathbf{" + sig(Pe, 3) + "}\\ \\text{W}");
      eq(1, "Net loss to the surroundings", "P_{net} = e\\sigma A(T^4 - T_0^4) = \\mathbf{" + sig(Pn, 3) + "}\\ \\text{W}");
      eq(2, "Wien's law", "\\lambda_m = \\frac{b}{T} = \\frac{2.898\\times10^{-3}}{" + K.fmt(T, 0) + "} = \\mathbf{" + sig(lm, 3) + "}\\ \\mu\\text{m}");
      eq(3, "Cooling rate", "\\frac{dT}{dt} = -\\frac{P_{net}}{mc} = -\\frac{" + sig(Pn, 3) + "}{" + sig(p.Cb, 3) + "} = \\mathbf{" + sig(-Pn / p.Cb, 3) + "}\\ \\text{K/s}");
      R(0, "temperature", "", K.fmt(T, 0) + " K", K.fmt(T - 273.15, 0) + " °C");
      R(1, "emitted power", "c-acc", sig(Pe, 3) + " W", "∝ T⁴");
      R(2, "net power", "c-acc", sig(Pn, 3) + " W", "absorbs " + sig(Pe - Pn, 3) + " W");
      R(3, "spectrum peak", "", sig(peakOf(T), 3) + " µm", "found on the curve; b/T = " + sig(lm, 3));
      R(4, "energy radiated (net)", "", sig(p.Cb * (p.Tr - T), 3) + " J", "mc(Tᵢ − T)");
      R(5, "time-lapse", "", "×" + st.lapse, K.fmt(st.t, 0) + " s of cooling");
    }
    function mathsCool(p) {
      var k = p.kc, mk = st.marks, tex = Math.log((p.T1 - p.T0) / (p.T2 - p.T0)) / k;
      var ka = (p.Ti - p.T1) / (p.t1 * ((p.Ti + p.T1) / 2 - p.T0)), ta = (p.T1 - p.T2) / (ka * ((p.T1 + p.T2) / 2 - p.T0));
      eq(0, "k from the first reading", "k = \\frac{1}{t_1}\\ln\\frac{T_i - T_0}{T_1 - T_0} = \\frac{1}{" + K.fmt(p.t1, 1) + "}\\ln\\frac{" + (p.Ti - p.T0) + "}{" + (p.T1 - p.T0) + "} = \\mathbf{" + K.fmt(k, 4) + "}\\ \\text{min}^{-1}");
      eq(1, "Exponential approach", "T = T_0 + (T_i - T_0)e^{-kt} = " + p.T0 + " + " + (p.Ti - p.T0) + "e^{-" + K.fmt(k, 4) + "t}");
      eq(2, "Exact time from T₁ to T₂", "t = \\frac{1}{k}\\ln\\frac{T_1 - T_0}{T_2 - T_0} = \\frac{1}{" + K.fmt(k, 4) + "}\\ln\\frac{" + (p.T1 - p.T0) + "}{" + (p.T2 - p.T0) + "} = \\mathbf{" + K.fmt(tex, 2) + "}\\ \\text{min}");
      eq(3, "JEE shortcut: use the average temperature", "\\frac{T_1 - T_2}{t} = k'\\left(\\frac{T_1 + T_2}{2} - T_0\\right),\\ k' = " + K.fmt(ka, 4) + " \\Rightarrow t \\approx \\mathbf{" + K.fmt(ta, 2) + "}\\ \\text{min}");
      R(0, "temperature", "c-disp", K.fmt(st.T, 2) + " °C", "t = " + K.fmt(st.t, 2) + " min");
      R(1, "cooling rate now", "c-app", K.fmt(k * (st.T - p.T0), 3) + " °C/min", "k(T − T₀)");
      R(2, "T₁ → T₂ took", "c-acc", mk.T1 !== undefined && mk.T2 !== undefined ? K.fmt(mk.T2 - mk.T1, 2) + " min" : "…", "exact " + K.fmt(tex, 2) + ", shortcut " + K.fmt(ta, 2));
      R(3, "reached T₁ at", "", mk.T1 !== undefined ? K.fmt(mk.T1, 2) + " min" : "…", "you set " + K.fmt(p.t1, 1));
      R(4, "excess halved at", "", mk.half !== undefined ? K.fmt(mk.half, 2) + " min" : "…", "ln 2 / k = " + K.fmt(Math.LN2 / k, 2));
      R(5, "k", "", K.fmt(k, 4) + " /min");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Heat conducts like charge: a temperature difference drives a <b class=\"c-acc\">heat current</b> $H = \\Delta T/R$ through a <b>thermal resistance</b> $R = L/kA$. Slabs in series add resistances and carry the same $H$; slabs in parallel add conductances and share $\\Delta T$. Until the bar is warm, some heat gets stored on the way, so $H_{in} > H_{out}$; at steady state they match.</p>" +
      "<p>Everything also radiates: $P = e\\sigma AT^4$ with $T$ in kelvin, and the spectrum peaks at $\\lambda_m = b/T$, so hotter bodies shift from infrared to red to white. When the excess temperature is small, the net loss is close to $4e\\sigma AT_0^3(T - T_0)$: that's <b>Newton's law of cooling</b>, $dT/dt = -k(T - T_0)$, an exponential approach to room temperature.</p>" +
      '<div class="trap"><b>JEE trap: the average-temperature shortcut is an approximation.</b> Using $(T_1 - T_2)/t = k(\\bar T - T_0)$ is fine for small drops, but when the question says the law holds exactly, use the exponential: equal <i>ratios</i> of excess temperature take equal times. And in radiation, always convert to kelvin before raising to the fourth power.</div>');
    function apply(s) {
      mode = s.mode; segSet(modeSeg, mode); show();
      if (s.m1) { m1 = s.m1; segSet(seg1, m1); } if (s.m2) { m2 = s.m2; segSet(seg2, m2); }
      ["L1", "L2", "A", "TH", "TC", "Tr", "Ts", "e", "r", "Ti", "T0", "T1", "t1", "T2"].forEach(function (k) {
        var sl = { L1: L1S, L2: L2S, A: AS, TH: THS, TC: TCS, Tr: TrS, Ts: TsS, e: eS, r: rS, Ti: TiS, T0: T0S, T1: T1S, t1: t1S, T2: T2S }[k];
        if (s[k] !== undefined) sl.set(s[k]);
      });
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "Stefan–Boltzmann", setup: { mode: "rad", Tr: 1000, Ts: 0, e: 1, r: 2 }, watch: "Read the emitted power, then set the ball to 2000 K and compare",
        q: "A black body at 1000 K is heated to 2000 K. By what factor does the power it radiates increase?",
        options: ["2", "4", "8", "16"], answer: 3,
        explain: "$P \\propto T^4$, so $(2000/1000)^4 = 16$. In the lab, 1000 K gives 285 W for the 2 cm ball and 2000 K gives 4560 W." },
      { level: "medium", tag: "slabs in series", setup: { mode: "series", m1: "copper", m2: "steel", L1: 10, L2: 10, A: 10, TH: 100, TC: 0 }, watch: "Predict the junction temperature, then press Heat it and wait for steady state",
        q: "A copper bar ($k = 400$ W/m·K) and a steel bar ($k = 50$ W/m·K), each 10 cm long with the same cross-section, are joined end to end. The free copper end is held at 100 °C and the free steel end at 0 °C. What is the steady temperature of the junction?",
        options: ["50.0 °C", "88.9 °C", "87.5 °C", "11.1 °C"], answer: 1,
        hints: ["The same heat current $H$ flows through both, so each bar's temperature drop is $HR$ with $R = L/kA$.", "With equal $L$ and $A$, $R_{Cu} : R_{steel} = 1 : 8$, so copper gets 1/9 of the 100 °C drop."],
        explain: "$R \\propto 1/k$ here, so $R_{Cu} : R_{steel} = 50 : 400 = 1 : 8$. Copper takes $1/9$ of the drop: $T_j = 100 - 100/9 = 88.9$ °C. 87.5 °C uses 1/8 instead of 1/9; 11.1 °C puts the big drop across the copper." },
      { level: "hard", tag: "exact Newton's law", setup: { mode: "cool", Ti: 80, T0: 20, T1: 60, t1: 5, T2: 40 }, watch: "Predict, then start the clock and read how long 60 → 40 °C takes",
        q: "A body cools from 80 °C to 60 °C in 5 minutes in a room at 20 °C. Assuming Newton's law of cooling holds exactly, how long does it take to cool from 60 °C to 40 °C?",
        options: ["5.00 min", "8.33 min", "8.55 min", "10.0 min"], answer: 2,
        hints: ["Exactly means exponential: $T - T_0$ is multiplied by the same factor in equal times.", "The excess goes 60 → 40 (×2/3) in 5 min. You need 40 → 20 (×1/2): $t = 5\\ln 2/\\ln 1.5$."],
        explain: "$k = \\ln(60/40)/5 = 0.0811$ /min. From 60 °C to 40 °C the excess goes 40 → 20, so $t = \\ln 2/k = 5\\ln 2/\\ln 1.5 = 8.55$ min. The average-temperature shortcut gives 8.33 min; it's close, but not exact. 5 min assumes equal drops in equal times." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, transOpts);
    reset();

    if (location.hostname === "localhost") window.__lab_conduction = {
      apply: apply, params: params, formulaH: formulaH, peakOf: peakOf,
      state: function () {
        var p = params();
        if (st.kind === "cond") { var o = condNow(p); return { done: st.done, steady: st.steady, in: o.in, out: o.out, Tj: o.Tj, I: o.chains.map(function (c) { return c.out; }), probe: probeT(p), t: st.t }; }
        if (st.kind === "rad") return { done: st.done, T: st.T, t: st.t, lapse: st.lapse, P: p.e * SIGMA * p.Ab * Math.pow(st.T, 4), Cb: p.Cb, Ab: p.Ab };
        return { done: st.done, T: st.T, t: st.t, marks: st.marks, k: p.kc };
      },
      probe: function (x) { st.probe = x; }
    };
    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); if (window.__lab_conduction) delete window.__lab_conduction; };
  }
})();
