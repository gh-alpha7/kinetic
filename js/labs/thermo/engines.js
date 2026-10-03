/* Thermodynamics, lab 2: an ideal gas taken round a closed cycle (rectangle, Otto, Carnot), as an engine or a refrigerator.
   Units on the stage: P in kPa and V in litres, so PV comes out in joules and T = PV / nR in kelvin. */
(function () {
  "use strict";
  var R = 8.314, LEG_T = 1.5, CYCLE_T = 4 * LEG_T;
  var COL = { isobaric: "disp", isochoric: "acc", isothermal: "vel", adiabatic: "grav" };

  var lab = {
    id: "engines", chapter: "thermo", title: "Heat engines & Carnot", short: "cycles, efficiency, refrigerators",
    lede: "Take a gas round a closed loop on the P–V diagram and it comes back to where it started, yet it has done work: the area inside the loop. Find out why no engine can turn all its heat into work, and how close Carnot gets.",
    tries: [
      { id: "area", title: "Get exactly 1000 J out of one cycle",
        text: "Size the rectangle cycle so it delivers 1000 J of net work per cycle.",
        why: "Net work is the area enclosed: for a rectangle $W = (P_h - P_l)(V_b - V_a)$. 100 kPa × 10 L or 50 kPa × 20 L both give 1000 J, because kPa × L = J." },
      { id: "half", title: "Run a Carnot engine at exactly 50%",
        text: "Pick the two reservoir temperatures so the Carnot engine's efficiency is 50%.",
        why: "$\\eta = 1 - T_c/T_h$ depends only on the two temperatures, so you need $T_h = 2T_c$, say 600 K and 300 K. The gas, $n$ and the volumes don't matter." },
      { id: "otto", title: "Show the Otto efficiency ignores the fuel",
        text: "Run two Otto cycles with the same compression ratio and gas but different heat input. Compare $\\eta$.",
        why: "Both adiabats scale the temperature by the same factor $r^{\\gamma-1}$, so heat out is always the same fraction of heat in: $\\eta = 1 - 1/r^{\\gamma-1}$, whatever you burn." },
      { id: "fridge", title: "Build a refrigerator with COP above 3",
        text: "Reverse the Carnot cycle and get at least 3 J of heat out of the cold side per joule of work.",
        why: "Run backwards, the cycle takes $Q_c$ from the cold reservoir and dumps $Q_c + W$ into the hot one. For Carnot $\\text{COP} = T_c/(T_h - T_c)$: the closer the temperatures, the better it works." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- the gas (same model as the processes lab) ---------- */
  // Move the gas reversibly along a process to x (V in L, or P in kPa at constant volume) in small substeps:
  // W is the integrated area under P(V) (Simpson's rule), the adiabatic T comes from n Cv dT = -P dV (RK4).
  function advance(g, proc, x1) {
    var nR = g.n * R, nCv = g.n * g.cv * R, iso = proc === "isochoric";
    var x0 = iso ? g.P : g.V, N = Math.max(1, Math.ceil(Math.abs(x1 - x0) / (iso ? 0.05 : 0.004)));
    for (var i = 1; i <= N; i++) {
      var xe = i === N ? x1 : x0 + (x1 - x0) * i / N, T0 = g.T, dW = 0, dQ;
      if (iso) { g.P = xe; g.T = g.P * g.V / nR; }
      else {
        var V0 = g.V, d = xe - V0, Vm = V0 + d / 2, P0 = g.P, Pm, P1;
        if (proc === "isobaric") { Pm = P1 = P0; g.T = P0 * xe / nR; }
        else if (proc === "isothermal") { Pm = nR * T0 / Vm; P1 = nR * T0 / xe; }
        else {
          var Tm = rk4(T0, V0, d / 2, g.cv);
          g.T = rk4(Tm, Vm, d / 2, g.cv);
          Pm = nR * Tm / Vm; P1 = nR * g.T / xe;
        }
        dW = (P0 + 4 * Pm + P1) / 6 * d;
        g.V = xe; g.P = P1;
      }
      dQ = proc === "adiabatic" ? 0 : nCv * (g.T - T0) + dW;
      g.W += dW; g.Q += dQ;
      if (dQ > 0) g.Qin += dQ; else g.Qout -= dQ;
    }
  }
  function rk4(T, V, h, cv) {
    var f = function (t, v) { return -t / (cv * v); };
    var k1 = f(T, V), k2 = f(T + h / 2 * k1, V + h / 2), k3 = f(T + h / 2 * k2, V + h / 2), k4 = f(T + h * k3, V + h);
    return T + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  // round up to a whole number of nice ticks, so the axis fits the data snugly
  function snug(v) { var s = nice(v / 5); return Math.ceil(v / s - 1e-9) * s; }
  function nice(v) {
    var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  function mix(a, b, t) {
    var A = /^#?([0-9a-f]{6})$/i.exec(a), B2 = /^#?([0-9a-f]{6})$/i.exec(b);
    if (!A || !B2) return b;
    var x = parseInt(A[1], 16), y = parseInt(B2[1], 16), c = function (s) { return Math.round((x >> s & 255) * (1 - t) + (y >> s & 255) * t); };
    return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
  }

  /* ---------- the cycles ---------- */
  function corner(n, P, V, T, name) {
    if (T == null) T = P * V / (n * R); else P = n * R * T / V;
    return { P: P, V: V, T: T, name: name };
  }
  // corners and the four legs, run forwards (engine) or backwards (refrigerator)
  function build(p) {
    var n = p.n, gam = (p.cv + 1) / p.cv, c, legs;
    if (p.cyc === "rect") {
      c = [corner(n, p.Pl, p.Va, null, "A"), corner(n, p.Ph, p.Va, null, "B"), corner(n, p.Ph, p.Vb, null, "C"), corner(n, p.Pl, p.Vb, null, "D")];
      legs = ["isochoric", "isobaric", "isochoric", "isobaric"];
    } else if (p.cyc === "otto") {
      var V2 = p.V1 / p.r, T2 = p.T1 * Math.pow(p.r, gam - 1), T3 = T2 + p.Q / (n * p.cv * R);
      c = [corner(n, 0, p.V1, p.T1, "1"), corner(n, 0, V2, T2, "2"), corner(n, 0, V2, T3, "3"), corner(n, 0, p.V1, T3 / Math.pow(p.r, gam - 1), "4")];
      legs = ["adiabatic", "isochoric", "adiabatic", "isochoric"];
    } else {
      var k = Math.pow(p.Th / p.Tc, 1 / (gam - 1));
      c = [corner(n, 0, p.V1, p.Th, "1"), corner(n, 0, p.V1 * p.ratio, p.Th, "2"), corner(n, 0, p.V1 * p.ratio * k, p.Tc, "3"), corner(n, 0, p.V1 * k, p.Tc, "4")];
      legs = ["isothermal", "adiabatic", "isothermal", "adiabatic"];
    }
    var L = legs.map(function (t, i) { return { type: t, a: i, b: (i + 1) % 4 }; });
    if (p.dir === "fridge") L = L.reverse().map(function (l) { return { type: l.type, a: l.b, b: l.a }; });
    var cyc = { p: p, gam: gam, c: c, legs: L };
    // textbook closed forms for each whole leg
    cyc.legs.forEach(function (l) { var e = legExact(cyc, l, xEnd(cyc, l)); l.Q = e.Q; l.W = e.W; });
    cyc.W = sum(L, "W"); cyc.Qin = L.reduce(function (s, l) { return s + Math.max(l.Q, 0); }, 0); cyc.Qout = L.reduce(function (s, l) { return s + Math.max(-l.Q, 0); }, 0);
    var Ts = c.map(function (q) { return q.T; });
    cyc.Tmax = Math.max.apply(null, Ts); cyc.Tmin = Math.min.apply(null, Ts);
    cyc.eta = cyc.W / cyc.Qin;
    cyc.cop = cyc.Qin / -cyc.W;
    cyc.etaC = 1 - cyc.Tmin / cyc.Tmax;
    cyc.copC = cyc.Tmin / (cyc.Tmax - cyc.Tmin);
    return cyc;
  }
  function sum(a, k) { return a.reduce(function (s, x) { return s + x[k]; }, 0); }
  function xOf(type, s) { return type === "isochoric" ? s.P : s.V; }
  function xStart(cyc, l) { return xOf(l.type, cyc.c[l.a]); }
  function xEnd(cyc, l) { return xOf(l.type, cyc.c[l.b]); }
  function legExact(cyc, l, x) {
    var a = cyc.c[l.a], n = cyc.p.n, nR = n * R, nCv = n * cyc.p.cv * R, gam = cyc.gam, s = {};
    if (l.type === "isochoric") { s.V = a.V; s.P = x; s.T = x * a.V / nR; s.W = 0; s.Q = nCv * (s.T - a.T); }
    else if (l.type === "isobaric") { s.P = a.P; s.V = x; s.T = a.P * x / nR; s.W = a.P * (x - a.V); s.Q = (nCv + nR) * (s.T - a.T); }
    else if (l.type === "isothermal") { s.V = x; s.T = a.T; s.P = nR * a.T / x; s.W = nR * a.T * Math.log(x / a.V); s.Q = s.W; }
    else { s.V = x; s.P = a.P * Math.pow(a.V / x, gam); s.T = a.T * Math.pow(a.V / x, gam - 1); s.W = (a.P * a.V - s.P * x) / (gam - 1); s.Q = 0; }
    return s;
  }
  // the textbook values a time t into the cycle (each leg takes LEG_T at a steady rate)
  function exactAt(cyc, t) {
    var i = Math.min(3, Math.floor(t / LEG_T + 1e-9)), s = Math.min(1, (t - i * LEG_T) / LEG_T), out = { W: 0, Qin: 0, Qout: 0 };
    for (var j = 0; j < i; j++) { var l = cyc.legs[j]; out.W += l.W; out.Qin += Math.max(l.Q, 0); out.Qout += Math.max(-l.Q, 0); }
    var L = cyc.legs[i], x0 = xStart(cyc, L), e = legExact(cyc, L, x0 + (xEnd(cyc, L) - x0) * s);
    out.W += e.W; out.Qin += Math.max(e.Q, 0); out.Qout += Math.max(-e.Q, 0); out.T = e.T; out.P = e.P; out.V = e.V;
    return out;
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 460;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });
    var CYL = { x: 120, w: 190, top: 70, bottom: 330 };
    var BOX = { x0: 500, x1: 965, y0: 36, y1: 400 };

    /* ---------- controls ---------- */
    var cycT = "rect", dir = "engine", gas = "mono";
    var nS = K.slider({ label: "Amount of gas $n$", unit: "mol", min: 0.5, max: 3, step: 0.5, value: 1, onInput: rebuild });
    var vaS = K.slider({ label: "Small volume $V_a$", unit: "L", min: 5, max: 50, step: 1, value: 10, onInput: function (v) { if (vbS.get() <= v) vbS.set(v + 1); rebuild(); } });
    var vbS = K.slider({ label: "Large volume $V_b$", unit: "L", min: 6, max: 60, step: 1, value: 25, onInput: function (v) { if (vaS.get() >= v) vaS.set(v - 1); rebuild(); } });
    var plS = K.slider({ label: "Low pressure $P_l$", unit: "kPa", min: 50, max: 400, step: 10, value: 100, onInput: function (v) { if (phS.get() <= v) phS.set(v + 10); rebuild(); } });
    var phS = K.slider({ label: "High pressure $P_h$", unit: "kPa", min: 60, max: 500, step: 10, value: 300, onInput: function (v) { if (plS.get() >= v) plS.set(v - 10); rebuild(); } });
    var t1S = K.slider({ label: "Intake temperature $T_1$", unit: "K", min: 200, max: 500, step: 10, value: 300, onInput: rebuild });
    var o1S = K.slider({ label: "Cylinder volume $V_1$", unit: "L", min: 10, max: 50, step: 1, value: 24, onInput: rebuild });
    var rS = K.slider({ label: "Compression ratio $r = V_1/V_2$", min: 2, max: 12, step: 0.5, value: 8, onInput: rebuild });
    var qS = K.slider({ label: "Heat from the fuel $Q_{in}$", unit: "J", min: 500, max: 6000, step: 100, value: 4000, onInput: rebuild });
    var thS = K.slider({ label: "Hot reservoir $T_h$", unit: "K", min: 300, max: 1000, step: 10, value: 500, onInput: function (v) { if (tcS.get() >= v) tcS.set(v - 10); rebuild(); } });
    var tcS = K.slider({ label: "Cold reservoir $T_c$", unit: "K", min: 200, max: 900, step: 10, value: 300, onInput: function (v) { if (thS.get() <= v) thS.set(v + 10); rebuild(); } });
    var c1S = K.slider({ label: "Start volume $V_1$", unit: "L", min: 5, max: 30, step: 1, value: 10, onInput: rebuild });
    var xS = K.slider({ label: "Isothermal expansion $V_2/V_1$", min: 1.5, max: 4, step: 0.1, value: 2, onInput: rebuild });

    P.controls.innerHTML = "<h3>Cycle</h3>";
    var cycSeg = K.seg([{ label: "Rectangle", value: "rect" }, { label: "Otto", value: "otto" }, { label: "Carnot", value: "carnot" }], cycT,
      function (v) { cycT = v; showGroups(); rebuild(); }, "Cycle");
    P.controls.appendChild(cycSeg);
    var dirSeg = K.seg([{ label: "Engine", value: "engine" }, { label: "Refrigerator", value: "fridge" }], dir, function (v) { dir = v; rebuild(); }, "Direction");
    P.controls.appendChild(dirSeg);
    P.controls.appendChild(K.h("<h3>The gas</h3>"));
    var gasSeg = K.seg([{ label: "Monatomic", value: "mono" }, { label: "Diatomic", value: "di" }], gas, function (v) { gas = v; rebuild(); }, "Gas");
    P.controls.appendChild(gasSeg);
    P.controls.appendChild(nS.el);
    function group(title, sl, hint) {
      var d = K.h("<div><h3>" + title + "</h3></div>");
      sl.forEach(function (s) { d.appendChild(s.el); });
      if (hint) d.appendChild(K.h('<p class="control-hint">' + hint + "</p>"));
      P.controls.appendChild(d); return d;
    }
    var groups = {
      rect: group("Rectangle corners", [vaS, vbS, plS, phS], "Or drag corners A and C on the P–V diagram."),
      otto: group("Otto cycle (petrol engine)", [t1S, o1S, rS, qS], "Or drag point 1 on the P–V diagram."),
      carnot: group("Carnot cycle", [thS, tcS, c1S, xS], "Or drag points 1 and 2 along the hot isotherm.")
    };
    function showGroups() { Object.keys(groups).forEach(function (k) { groups[k].hidden = k !== cycT; }); }
    showGroups();
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-fric"><i></i>heat in / hot</span><span class="c-normal"><i></i>heat out / cold</span><span class="c-app"><i></i>net work</span>' +
      '<span class="c-disp"><i></i>isobaric</span><span class="c-acc"><i></i>isochoric</span><span class="c-vel"><i></i>isothermal</span><span class="c-grav"><i></i>adiabatic</span></div>'));

    function params() {
      return { cyc: cycT, dir: dir, n: nS.get(), cv: gas === "mono" ? 1.5 : 2.5, gas: gas,
        Va: vaS.get(), Vb: vbS.get(), Pl: plS.get(), Ph: phS.get(), T1: t1S.get(), V1: cycT === "otto" ? o1S.get() : c1S.get(),
        r: rS.get(), Q: qS.get(), Th: thS.get(), Tc: tcS.get(), ratio: xS.get() };
    }

    /* ---------- state ---------- */
    var cyc, st, transportUI = null, results = [], lastOtto = null;
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();
    var mol = [];
    for (var i = 0; i < 36; i++) mol.push({ u: Math.random(), v: Math.random(), du: Math.random() - 0.5, dv: Math.random() - 0.5 });

    function freshGas() { var a = cyc.c[cyc.legs[0].a]; return { n: cyc.p.n, cv: cyc.p.cv, P: a.P, V: a.V, T: a.T, Q: 0, W: 0, Qin: 0, Qout: 0 }; }
    function rebuild() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      cyc = build(params());
      st = { g: freshGas(), leg: 0, tl: 0, t: 0, cycles: 0, last: null, legQ: [null, null, null, null], flow: 0, fade: 0, dV: 0 };
      st.rec = [rec0()];
      P.time.textContent = "t = 0.00 s";
      update(true);
    }
    function rec0() { var g = st.g; return { t: st.t, W: g.W, Qin: g.Qin, Qout: g.Qout, T: g.T, V: g.V, P: g.P }; }

    sim.on("step", function () {
      var L = cyc.legs[st.leg], g = st.g, Q0 = g.Q, V0 = g.V;
      st.tl += K.DT; st.t += K.DT;
      var s = st.tl >= LEG_T - 1e-9 ? 1 : st.tl / LEG_T, x0 = xStart(cyc, L), x1 = xEnd(cyc, L);
      advance(g, L.type, s >= 1 ? x1 : x0 + (x1 - x0) * s);
      st.flow = g.Q - Q0; st.dV = g.V - V0; st.fade = 1;
      if (s >= 1) {
        var b = cyc.c[L.b];
        st.legQ[st.leg] = g.Q - (st.legStartQ || 0); st.legStartQ = g.Q;
        g.P = b.P; g.V = b.V; g.T = b.T;          // land exactly on the corner so cycles don't drift
        st.leg++; st.tl = 0;
        if (st.leg === 4) { st.rec.push(rec0()); finishCycle(); return update(true); }
      }
      st.rec.push(rec0());
      update();
    });

    function finishCycle() {
      var g = st.g, p = cyc.p;
      var r = { W: g.W, Qin: g.Qin, Qout: g.Qout, eta: g.W / g.Qin, cop: g.Qin / -g.W, x: cyc.Tmin / cyc.Tmax, cyc: p.cyc, dir: p.dir };
      st.last = r; st.cycles++;
      results.push(r); if (results.length > 40) results.shift();
      if (p.dir === "engine") {
        K.flash(P.note, "One cycle: W = " + K.fmt(r.W, 0) + " J from Q_in = " + K.fmt(r.Qin, 0) + " J, so η = " + K.fmt(100 * r.eta, 1) + "%", 3500);
        if (p.cyc === "rect" && Math.abs(r.W - 1000) <= 1) tries.mark("area");
        if (p.cyc === "carnot" && Math.abs(r.eta - 0.5) < 5e-4) tries.mark("half");
        if (p.cyc === "otto") {
          if (lastOtto && lastOtto.r === p.r && lastOtto.gas === p.gas && lastOtto.Q !== p.Q && Math.abs(lastOtto.eta - r.eta) < 1e-4) tries.mark("otto");
          lastOtto = { r: p.r, gas: p.gas, Q: p.Q, eta: r.eta };
        }
      } else {
        K.flash(P.note, "One cycle: took " + K.fmt(r.Qin, 0) + " J from the cold side for " + K.fmt(-r.W, 0) + " J of work, COP = " + K.fmt(r.cop, 2), 3500);
        if (p.cyc === "carnot" && r.cop >= 3 - 1e-9) tries.mark("fridge");
      }
      // start the next lap from a clean slate
      st.g = freshGas(); st.leg = 0; st.tl = 0; st.t = 0; st.legStartQ = 0; st.rec = [rec0()];
    }

    /* ---------- direct manipulation: drag the corners ---------- */
    var drag = null;
    function handles() {
      if (cycT === "rect") return [{ id: "A", c: cyc.c[0] }, { id: "C", c: cyc.c[2] }];
      if (cycT === "otto") return [{ id: "1", c: cyc.c[0] }];
      return [{ id: "1", c: cyc.c[0] }, { id: "2", c: cyc.c[1] }];
    }
    sim.pointer({
      down: function (pt) {
        var ax = axes(), best = null, bd = 22;
        handles().forEach(function (hd) { var d = Math.hypot(pt.px - ax.X(hd.c.V), pt.py - ax.Y(hd.c.P)); if (d < bd) { bd = d; best = hd; } });
        if (!best) return false;
        drag = { id: best.id, ax: ax };
      },
      drag: function (pt) {
        if (!drag) return;
        var ax = drag.ax, V = ax.Vinv(pt.px), Pk = ax.Pinv(pt.py);
        if (cycT === "rect") {
          if (drag.id === "A") { vaS.set(Math.min(V, vbS.get() - 1)); plS.set(Math.min(Pk, phS.get() - 10)); }
          else { vbS.set(Math.max(V, vaS.get() + 1)); phS.set(Math.max(Pk, plS.get() + 10)); }
        } else if (cycT === "otto") { o1S.set(V); t1S.set(Pk * o1S.get() / (nS.get() * R)); }
        else if (drag.id === "1") c1S.set(V);
        else xS.set(V / c1S.get());
        rebuild(); drag.ax = ax;
      },
      up: function () { drag = null; },
      hover: function (pt) {
        var ax = axes(), near = handles().some(function (hd) { return Math.hypot(pt.px - ax.X(hd.c.V), pt.py - ax.Y(hd.c.P)) < 22; });
        P.canvas.style.cursor = near ? "grab" : "default";
      }
    });

    /* ---------- drawing ---------- */
    function axes() {
      var Vmax = snug(Math.max.apply(null, cyc.c.map(function (q) { return q.V; })) * 1.1);
      var Pmax = snug(Math.max.apply(null, cyc.c.map(function (q) { return q.P; })) * 1.12), b = BOX;
      return { Vmax: Vmax, Pmax: Pmax,
        X: function (V) { return b.x0 + V / Vmax * (b.x1 - b.x0); }, Y: function (Pk) { return b.y1 - Pk / Pmax * (b.y1 - b.y0); },
        Vinv: function (px) { return (px - b.x0) / (b.x1 - b.x0) * Vmax; }, Pinv: function (py) { return (b.y1 - py) / (b.y1 - b.y0) * Pmax; } };
    }
    function gasColor(T) { return mix(th.normal, th.fric, K.clamp((T - 150) / 750, 0, 1)); }
    function legPts(l, N) {
      var x0 = xStart(cyc, l), x1 = xEnd(cyc, l), pts = [];
      for (var k = 0; k <= N; k++) pts.push(legExact(cyc, l, x0 + (x1 - x0) * k / N));
      return pts;
    }
    sim.on("under", function (ctx) { drawCylinder(ctx); drawPV(ctx); });
    sim.on("over", function () { st.fade *= 0.93; });

    function drawCylinder(ctx) {
      var c = CYL, g = st.g, u = sim.u(1), ax = axes(), hs = (c.bottom - c.top - 40) / ax.Vmax, gy = c.bottom - g.V * hs;
      var L = cyc.legs[st.leg % 4], fr = cyc.p.dir === "fridge";
      ctx.fillStyle = K.alpha(gasColor(g.T), 0.28); ctx.fillRect(c.x, gy, c.w, c.bottom - gy);
      var sp = 0.004 * Math.sqrt(Math.max(g.T, 1) / 300);
      ctx.fillStyle = gasColor(g.T);
      mol.forEach(function (m) {
        m.u += m.du * sp * 2; m.v += m.dv * sp * 2 * 200 / Math.max(c.bottom - gy, 10);
        if (m.u < 0 || m.u > 1) { m.du = -m.du; m.u = K.clamp(m.u, 0, 1); }
        if (m.v < 0 || m.v > 1) { m.dv = -m.dv; m.v = K.clamp(m.v, 0, 1); }
        ctx.beginPath(); ctx.arc(c.x + 8 + m.u * (c.w - 16), c.bottom - 5 - m.v * Math.max(c.bottom - gy - 10, 0), 3 * u, 0, Math.PI * 2); ctx.fill();
      });
      ctx.strokeStyle = th.ink; ctx.lineWidth = 4 * u;
      ctx.beginPath(); ctx.moveTo(c.x - 2, c.top); ctx.lineTo(c.x - 2, c.bottom + 2); ctx.lineTo(c.x + c.w + 2, c.bottom + 2); ctx.lineTo(c.x + c.w + 2, c.top); ctx.stroke();
      if (L.type === "adiabatic") {
        ctx.save(); ctx.strokeStyle = K.alpha(th.grav, 0.7); ctx.lineWidth = 1.5 * u; ctx.beginPath();
        for (var y = c.top; y < c.bottom; y += 9) { ctx.moveTo(c.x - 16, y + 9); ctx.lineTo(c.x - 4, y); ctx.moveTo(c.x + c.w + 4, y + 9); ctx.lineTo(c.x + c.w + 16, y); }
        ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = th.body; ctx.fillRect(c.x + 1, gy - 18, c.w - 2, 18);
      ctx.fillRect(c.x + c.w / 2 - 6, c.top - 18, 12, gy - 18 - (c.top - 18));
      // the two reservoirs
      var hot = { x: 20, y: 392, w: 170, h: 46 }, cold = { x: 240, y: 392, w: 170, h: 46 };
      ctx.fillStyle = K.alpha(th.fric, 0.2); ctx.fillRect(hot.x, hot.y, hot.w, hot.h);
      ctx.fillStyle = K.alpha(th.normal, 0.2); ctx.fillRect(cold.x, cold.y, cold.w, cold.h);
      K.label(ctx, "hot · " + K.fmt(cyc.Tmax, 0) + " K", hot.x + hot.w / 2, hot.y + 30, th.fric, { s: u });
      K.label(ctx, "cold · " + K.fmt(cyc.Tmin, 0) + " K", cold.x + cold.w / 2, cold.y + 30, th.normal, { s: u });
      // heat arrows: an engine takes heat from the hot side; a refrigerator takes it from the cold side
      if (st.fade > 0.05 && Math.abs(st.flow) > 1e-6) {
        var inn = st.flow > 0, from = inn ? (fr ? cold : hot) : null, to = inn ? null : (fr ? hot : cold);
        var col = (from || to) === hot ? th.fric : th.normal, box = from || to, bx = box.x + box.w / 2;
        ctx.save(); ctx.globalAlpha = Math.min(1, st.fade * 1.4);
        if (inn) K.arrow(ctx, bx, box.y - 4, c.x + c.w / 2 + (bx - c.x - c.w / 2) * 0.3, c.bottom + 8, col, { s: u, width: 5, label: "Q in", lx: 8 });
        else K.arrow(ctx, c.x + c.w / 2 + (bx - c.x - c.w / 2) * 0.3, c.bottom + 8, bx, box.y - 4, col, { s: u, width: 5, label: "Q out", lx: 8 });
        ctx.restore();
      }
      if (st.fade > 0.05 && Math.abs(st.dV) > 1e-9) {
        var up = st.dV > 0, wx = c.x + c.w + 30;
        K.arrow(ctx, wx, gy - (up ? 0 : 46), wx, gy - (up ? 46 : 0), th.app, { s: u, width: 4, label: up ? "W > 0" : "W < 0", lx: 8, ly: up ? 0 : -46 });
      }
      var a = cyc.c[L.a], b = cyc.c[L.b];
      K.label(ctx, "P " + K.fmt(g.P, 0) + " kPa   V " + K.fmt(g.V, 1) + " L   T " + K.fmt(g.T, 0) + " K", c.x + c.w / 2, 24, th.ink, { s: u, bg: true });
      K.label(ctx, a.name + " → " + b.name + ": " + L.type + (L.type === "isochoric" ? "" : b.V > a.V ? " expansion" : " compression"), c.x + c.w / 2, 44, th[COL[L.type]], { s: u });
    }

    function drawPV(ctx) {
      var b = BOX, ax = axes(), u = sim.u(1), X = ax.X, Y = ax.Y, fr = cyc.p.dir === "fridge";
      ctx.font = "500 " + 11 * u + "px 'JetBrains Mono', monospace"; ctx.lineWidth = u;
      var vs = nice(ax.Vmax / 6), ps = nice(ax.Pmax / 6);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var V = 0; V <= ax.Vmax + 1e-9; V += vs) {
        ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(X(V), b.y0); ctx.lineTo(X(V), b.y1); ctx.stroke();
        ctx.fillStyle = th.muted; ctx.fillText(String(Number(V.toPrecision(4))), X(V), b.y1 + 6);
      }
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var Pk = 0; Pk <= ax.Pmax + 1e-9; Pk += ps) {
        ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(b.x0, Y(Pk)); ctx.lineTo(b.x1, Y(Pk)); ctx.stroke();
        ctx.fillStyle = th.muted; ctx.fillText(String(Number(Pk.toPrecision(4))), b.x0 - 6, Y(Pk));
      }
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x0, b.y1); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      K.label(ctx, "V (L)", b.x1, b.y1 - 4, th.muted, { s: u, align: "right" });
      K.label(ctx, "P (kPa)", b.x0 + 8, b.y0 + 14, th.muted, { s: u, align: "left" });
      // enclosed area = net work
      ctx.fillStyle = K.alpha(th.app, 0.2); ctx.beginPath();
      cyc.legs.forEach(function (l, i) { legPts(l, 60).forEach(function (q, k) { if (!i && !k) ctx.moveTo(X(q.V), Y(q.P)); else ctx.lineTo(X(q.V), Y(q.P)); }); });
      ctx.closePath(); ctx.fill();
      var cx = sum(cyc.c, "V") / 4, cy = sum(cyc.c, "P") / 4;
      K.label(ctx, "W = " + K.fmt(cyc.W, 0) + " J", X(cx), Y(cy) + 8 * u, th.app, { s: u, bg: true });
      // each leg in its process colour, with an arrow for the direction and its heat
      cyc.legs.forEach(function (l, i) {
        var pts = legPts(l, 60), col = th[COL[l.type]];
        ctx.strokeStyle = col; ctx.lineWidth = (i === st.leg ? 3.5 : 2.2) * u; ctx.setLineDash(i === st.leg ? [] : [6 * u, 4 * u]);
        ctx.beginPath(); pts.forEach(function (q, k) { if (k) ctx.lineTo(X(q.V), Y(q.P)); else ctx.moveTo(X(q.V), Y(q.P)); }); ctx.stroke();
        ctx.setLineDash([]);
        var m0 = pts[27], m1 = pts[33];
        K.arrow(ctx, X(m0.V), Y(m0.P), X(m1.V), Y(m1.P), col, { s: u, width: 2.5, head: 11 });
        var mid = pts[30], hc = l.Q > 1e-6 ? th.fric : l.Q < -1e-6 ? th.normal : th.muted;
        var dx = X(mid.V) < X(cx) ? -10 : 10, dy = Y(mid.P) < Y(cy) ? -8 : 20;
        K.label(ctx, (l.Q > 1e-6 ? "+" : "") + K.fmt(l.Q, 0) + " J", X(mid.V) + dx * u, Y(mid.P) + dy * u, hc, { s: u * 0.9, bg: true, align: dx < 0 ? "right" : "left" });
      });
      // the simulated trace this lap
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5 * u; ctx.beginPath();
      st.rec.forEach(function (r, k) { if (k) ctx.lineTo(X(r.V), Y(r.P)); else ctx.moveTo(X(r.V), Y(r.P)); });
      ctx.stroke();
      var hs = handles().map(function (h) { return h.id; });
      cyc.c.forEach(function (q) {
        var big = hs.indexOf(q.name) >= 0;
        ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(X(q.V), Y(q.P), (big ? 6 : 4) * u, 0, Math.PI * 2); ctx.fill();
        if (big) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(X(q.V), Y(q.P), 10 * u, 0, Math.PI * 2); ctx.stroke(); }
        K.label(ctx, q.name, X(q.V) + 14 * u, Y(q.P) - 6 * u, th.ink, { s: u });
      });
      var g = st.g;
      ctx.fillStyle = gasColor(g.T); ctx.beginPath(); ctx.arc(X(g.V), Y(g.P), 7 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th["canvas-bg"]; ctx.lineWidth = 2 * u; ctx.stroke();
      K.label(ctx, fr ? "refrigerator: anticlockwise, W < 0" : "engine: clockwise, W > 0", b.x1 - 4, b.y0 + 14, th.muted, { s: u, align: "right" });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-fric">heat in</b>, <b class="c-normal">heat out</b> and <b class="c-app">net work</b> over one lap · W = Q<sub>in</sub> − Q<sub>out</sub></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap eff-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">Temperature</b> round the lap · it ends where it started, so ΔU = 0 per cycle</p></div>';
    var cv = P.graphs.querySelectorAll("canvas"), effCap = P.graphs.querySelector(".eff-cap");
    var gE = new K.Graph(cv[0], { yLabel: "energy (J)", xMax: CYCLE_T, yMin: 0, color: th.ink });
    var gEff = new K.Graph(cv[1], { yLabel: "η", xLabel: "T_min / T_max", xMax: 1, yMin: 0, yMax: 1, color: th.app });
    var gT = new K.Graph(cv[2], { yLabel: "T (K)", xMax: CYCLE_T, yMin: 0, color: th.acc });

    function drawGraphs() {
      var fW = [], fI = [], fO = [], fT = [];
      for (var k = 0; k <= 160; k++) {
        var t = CYCLE_T * k / 160, e = exactAt(cyc, t);
        fW.push([t, e.W]); fI.push([t, e.Qin]); fO.push([t, e.Qout]); fT.push([t, e.T]);
      }
      gE.set("fI", { points: fI, color: th.fric, dash: [5, 5], width: 1.5 });
      gE.set("fO", { points: fO, color: th.normal, dash: [5, 5], width: 1.5 });
      gE.set("fW", { points: fW, color: th.app, dash: [5, 5], width: 1.5 });
      gE.set("sI", { points: st.rec.map(function (r) { return [r.t, r.Qin]; }), color: th.fric, width: 2.5, dot: true });
      gE.set("sO", { points: st.rec.map(function (r) { return [r.t, r.Qout]; }), color: th.normal, width: 2.5, dot: true });
      gE.set("sW", { points: st.rec.map(function (r) { return [r.t, r.W]; }), color: th.app, width: 2.5, dot: true });
      gT.set("f", { points: fT, color: th.acc, dash: [5, 5], width: 1.5 });
      gT.set("s", { points: st.rec.map(function (r) { return [r.t, r.T]; }), color: th.acc, width: 2.5, dot: true });
      // efficiency (or COP) against the temperature ratio, with Carnot's limit dashed
      var fr = cyc.p.dir === "fridge", lim = [];
      if (fr) for (var x = 0.02; x <= 0.9001; x += 0.01) lim.push([x, x / (1 - x)]);
      else lim = [[0, 1], [1, 0]];
      gEff.o.yLabel = fr ? "COP" : "η"; gEff.o.yMax = fr ? 4 : 1;
      gEff.set("carnot", { points: lim, color: th.app, dash: [5, 5], width: 1.5 });
      var mine = results.filter(function (r) { return r.dir === cyc.p.dir; });
      gEff.extra = function (ctx, X, Y) {
        mine.forEach(function (r) {
          ctx.fillStyle = th[r.cyc === "rect" ? "disp" : r.cyc === "otto" ? "acc" : "vel"];
          ctx.beginPath(); ctx.arc(X(r.x), Y(fr ? r.cop : r.eta), 4.5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.arc(X(cyc.Tmin / cyc.Tmax), Y(fr ? cyc.cop : cyc.eta), 6, 0, Math.PI * 2); ctx.stroke();
      };
      effCap.innerHTML = K.md(fr ? "<b class=\"c-app\">COP</b> vs $T_{min}/T_{max}$ · dashed: Carnot $T_c/(T_h - T_c)$; dots: your laps (blue rectangle, orange Otto, green Carnot)"
        : "<b class=\"c-app\">Efficiency</b> vs $T_{min}/T_{max}$ · dashed: Carnot's limit $1 - T_c/T_h$; dots: your laps (blue rectangle, orange Otto, green Carnot)");
      [gE, gEff, gT].forEach(function (gr) { gr.dirty = true; gr.draw(); });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Net work = enclosed area = the sum over the four legs", "Heat in and heat out", "Efficiency", "Carnot's limit for these two temperatures"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLab = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "laps", label: "laps done" },
      { id: "W", label: "net work W", cls: "c-app" },
      { id: "Qin", label: "heat in", cls: "c-fric" },
      { id: "Qout", label: "heat out", cls: "c-normal" },
      { id: "eta", label: "efficiency η", cls: "c-app" },
      { id: "lim", label: "Carnot limit" },
      { id: "T", label: "T_max, T_min" }
    ]);
    var slow = K.throttle(function () { renderMaths(); drawGraphs(); }, 80);
    function update(force) { if (force) { renderMaths(); drawGraphs(); } else slow(); }
    var B = function (v, d) { var s = K.fmt(v, d === undefined ? 0 : d); return v < 0 && s !== "0" ? "(" + s + ")" : s; };

    function renderMaths() {
      var p = cyc.p, fr = p.dir === "fridge", gam = cyc.gam, J = "\\ \\text{J}", L = cyc.legs;
      K.tex(eqEls[0], "W = " + L.map(function (l) { return B(l.W); }).join(" + ") + " = \\mathbf{" + K.fmt(cyc.W, 0) + "}" + J +
        (p.cyc === "rect" ? "\\;=\\; (P_h - P_l)(V_b - V_a) = (" + (p.Ph - p.Pl) + ")(" + (p.Vb - p.Va) + ")" : ""));
      var ins = L.filter(function (l) { return l.Q > 1e-6; }).map(function (l) { return K.fmt(l.Q, 0); });
      K.tex(eqEls[1], "Q_{in} = " + (ins.length > 1 ? ins.join(" + ") + " = " : "") + "\\mathbf{" + K.fmt(cyc.Qin, 0) + "}" + J +
        ",\\quad Q_{out} = \\mathbf{" + K.fmt(cyc.Qout, 0) + "}" + J + ",\\quad Q_{in} - Q_{out} = " + K.fmt(cyc.Qin - cyc.Qout, 0) + J);
      if (!fr) {
        eqLab[2].textContent = "Efficiency: work out per joule of heat in";
        var tb = p.cyc === "otto" ? "\\;=\\; 1 - \\frac{1}{r^{\\gamma - 1}} = 1 - \\frac{1}{" + p.r + "^{" + K.fmt(gam - 1, 3) + "}} = \\mathbf{" + K.fmt(1 - Math.pow(p.r, 1 - gam), 3) + "}"
          : p.cyc === "carnot" ? "\\;=\\; 1 - \\frac{T_c}{T_h} = 1 - \\frac{" + p.Tc + "}{" + p.Th + "} = \\mathbf{" + K.fmt(1 - p.Tc / p.Th, 3) + "}" : "";
        K.tex(eqEls[2], "\\eta = \\frac{W}{Q_{in}} = \\frac{" + K.fmt(cyc.W, 0) + "}{" + K.fmt(cyc.Qin, 0) + "} = \\mathbf{" + K.fmt(cyc.eta, 3) + "}" + tb);
        K.tex(eqEls[3], "\\eta_C = 1 - \\frac{T_{min}}{T_{max}} = 1 - \\frac{" + K.fmt(cyc.Tmin, 1) + "}{" + K.fmt(cyc.Tmax, 1) + "} = \\mathbf{" + K.fmt(cyc.etaC, 3) + "}\\;\\ge\\; \\eta = " + K.fmt(cyc.eta, 3));
      } else {
        eqLab[2].textContent = "Coefficient of performance: heat pulled out per joule of work";
        K.tex(eqEls[2], "\\text{COP} = \\frac{Q_{c}}{|W|} = \\frac{" + K.fmt(cyc.Qin, 0) + "}{" + K.fmt(-cyc.W, 0) + "} = \\mathbf{" + K.fmt(cyc.cop, 2) + "}" +
          (p.cyc === "carnot" ? "\\;=\\; \\frac{T_c}{T_h - T_c} = \\frac{" + p.Tc + "}{" + (p.Th - p.Tc) + "} = \\mathbf{" + K.fmt(p.Tc / (p.Th - p.Tc), 2) + "}" : ""));
        K.tex(eqEls[3], "\\text{COP}_C = \\frac{T_{min}}{T_{max} - T_{min}} = \\frac{" + K.fmt(cyc.Tmin, 1) + "}{" + K.fmt(cyc.Tmax - cyc.Tmin, 1) + "} = \\mathbf{" + K.fmt(cyc.copC, 2) + "}\\;\\ge\\; " + K.fmt(cyc.cop, 2));
      }
      var r = st.last, g = st.g;
      setR("laps", String(st.cycles), r ? "numbers below: last full lap" : "running total this lap");
      setR("W", K.fmt(r ? r.W : g.W, 0) + " J", "formula " + K.fmt(cyc.W, 0) + " J");
      setR("Qin", K.fmt(r ? r.Qin : g.Qin, 0) + " J", (fr ? "from the cold side · " : "") + "formula " + K.fmt(cyc.Qin, 0) + " J");
      setR("Qout", K.fmt(r ? r.Qout : g.Qout, 0) + " J", (fr ? "to the hot side · " : "") + "formula " + K.fmt(cyc.Qout, 0) + " J");
      if (fr) setR("eta", r ? "COP " + K.fmt(r.cop, 2) : "—", "formula " + K.fmt(cyc.cop, 2));
      else setR("eta", r ? K.fmt(100 * r.eta, 1) + " %" : "—", "formula " + K.fmt(100 * cyc.eta, 1) + " %");
      setR("lim", fr ? "COP " + K.fmt(cyc.copC, 2) : K.fmt(100 * cyc.etaC, 1) + " %", "between T_max and T_min");
      setR("T", K.fmt(cyc.Tmax, 1) + " K, " + K.fmt(cyc.Tmin, 1) + " K");
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>A <b>cycle</b> brings the gas back to its starting state, so $\\Delta U = 0$ over a lap and the first law leaves $W = Q_{in} - Q_{out}$. The net work is the <b class=\"c-app\">area enclosed</b> on the P–V diagram: positive when the loop runs clockwise (an engine).</p>" +
      "<p>The <b>efficiency</b> is what you get over what you pay: $\\eta = W/Q_{in} = 1 - Q_{out}/Q_{in}$. Some heat always has to be dumped to get the gas back to the start. For the Otto cycle $\\eta = 1 - 1/r^{\\gamma-1}$; for Carnot (two isotherms and two adiabats) $\\eta = 1 - T_c/T_h$, and no engine working between the same two temperatures can beat it.</p>" +
      "<p>Run the loop anticlockwise and it becomes a <b>refrigerator</b>: work goes in, heat $Q_c$ is pulled from the cold side, and $\\text{COP} = Q_c/|W|$, which for Carnot is $T_c/(T_h - T_c)$. A COP above 1 is normal.</p>" +
      '<div class="trap"><b>JEE trap: temperatures in kelvin, and which T goes where.</b> $1 - T_c/T_h$ with 27 °C and 127 °C is $1 - 300/400 = 25\\%$, not $1 - 27/127$. And for a refrigerator it\'s $T_c/(T_h - T_c)$, not $T_h/(T_h - T_c)$: that one is a heat pump\'s COP.</div>');

    function press(seg, v) { seg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === v)); }); }
    function apply(s) {
      cycT = s.cyc; dir = s.dir; gas = s.gas;
      press(cycSeg, cycT); press(dirSeg, dir); press(gasSeg, gas); showGroups();
      nS.set(s.n);
      if (s.cyc === "rect") { vaS.set(s.Va); vbS.set(s.Vb); plS.set(s.Pl); phS.set(s.Ph); }
      if (s.cyc === "otto") { t1S.set(s.T1); o1S.set(s.V1); rS.set(s.r); qS.set(s.Q); }
      if (s.cyc === "carnot") { thS.set(s.Th); tcS.set(s.Tc); c1S.set(s.V1); xS.set(s.ratio); }
      rebuild();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "work from the loop", setup: { cyc: "rect", dir: "engine", gas: "mono", n: 1, Va: 10, Vb: 20, Pl: 100, Ph: 300 }, watch: "Predict W, then press Run and read one lap",
        q: "A gas is taken round a rectangle on the P–V diagram between 100 kPa and 300 kPa, and between 10 L and 20 L, clockwise. How much net work does it do per cycle?",
        options: ["2000 J", "3000 J", "1000 J", "4000 J"], answer: 0,
        explain: "Net work is the enclosed area: $(300 - 100)\\ \\text{kPa} \\times (20 - 10)\\ \\text{L} = 2000$ J. 3000 J is only the expansion leg's work $P_h\\Delta V$; the compression at 100 kPa gives 1000 J of it back." },
      { level: "medium", tag: "Carnot refrigerator", setup: { cyc: "carnot", dir: "fridge", gas: "mono", n: 1, Th: 300, Tc: 250, V1: 10, ratio: 2 }, watch: "Predict the COP, then press Run",
        q: "A Carnot refrigerator keeps its inside at 250 K in a 300 K room. How many joules of heat does it remove from the inside per joule of work?",
        options: ["5", "6", "0.17", "1.2"], answer: 0,
        hints: ["For a reversible cycle $Q_c/Q_h = T_c/T_h$.", "$\\text{COP} = Q_c/W$ and $W = Q_h - Q_c$."],
        explain: "$\\text{COP} = \\dfrac{T_c}{T_h - T_c} = \\dfrac{250}{50} = 5$. 6 is $T_h/(T_h - T_c)$, the heat delivered to the room per joule (a heat pump). 0.17 is the Carnot engine efficiency." },
      { level: "hard", tag: "Otto cycle", setup: { cyc: "otto", dir: "engine", gas: "di", n: 1, T1: 300, V1: 24, r: 8, Q: 4000 }, watch: "Predict T₂ and W, then press Run and read the corners and one lap",
        q: "One mole of a diatomic ideal gas at 300 K runs an Otto cycle with compression ratio 8, and gets 4000 J of heat at constant volume each cycle. What is the temperature at the end of the compression, and the net work per cycle?",
        options: ["689 K and 2259 J", "2400 K and 3500 J", "689 K and 3500 J", "1200 K and 3000 J"], answer: 0,
        hints: ["On the adiabat $TV^{\\gamma-1}$ is constant, with $\\gamma = 1.4$ for a diatomic gas.", "$\\eta = 1 - 1/r^{\\gamma - 1}$, and $W = \\eta Q_{in}$."],
        explain: "$T_2 = 300 \\times 8^{0.4} = 300 \\times 2.297 = 689$ K. Then $\\eta = 1 - 1/2.297 = 0.565$, so $W = 0.565 \\times 4000 = 2259$ J. 3500 J uses $\\eta = 1 - 1/r$; 1200 K uses the monatomic exponent $2/3$; 2400 K is $rT_1$, as if it were isobaric." }
    ], apply, P);

    transportUI = K.transport(P, sim, { onReset: rebuild });
    rebuild();
    if (location.hostname === "localhost") {
      window.__lab_engines = { apply: apply, cyc: function () { return cyc; }, state: function () { return st; }, exactAt: function (t) { return exactAt(cyc, t); } };
    }

    return function destroy() { sim.destroy(); [gE, gEff, gT].forEach(function (g) { g.destroy(); }); };
  }
})();
