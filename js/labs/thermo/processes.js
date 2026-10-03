/* Thermodynamics, lab 1: an ideal gas in a cylinder, driven through the four textbook processes.
   Units on the stage: P in kPa and V in litres, so PV comes out in joules and T = PV / nR in kelvin. */
(function () {
  "use strict";
  var R = 8.314, V_LO = 2, V_HI = 60, P_LO = 10, P_HI = 5000, RUN_T = 3;
  var PROC = {
    isobaric: { label: "Isobaric", col: "disp", law: "constant P" },
    isochoric: { label: "Isochoric", col: "acc", law: "constant V" },
    isothermal: { label: "Isothermal", col: "vel", law: "constant T" },
    adiabatic: { label: "Adiabatic", col: "grav", law: "Q = 0" }
  };
  var ORDER = ["isobaric", "isochoric", "isothermal", "adiabatic"];

  var lab = {
    id: "processes", chapter: "thermo", title: "Gas processes & the first law", short: "Q, W, ΔU, isothermal, adiabatic",
    lede: "Trap some gas under a piston, then push, pull, heat or cool it. Every joule is accounted for: the heat you put in either raises the gas's internal energy or leaves as work on the piston, $Q = \\Delta U + W$.",
    tries: [
      { id: "iso", title: "Turn all the heat into work",
        text: "Expand the gas isothermally to at least 1.5 times its starting volume.",
        why: "On an isotherm $T$ is fixed, so $\\Delta U = nC_v\\Delta T = 0$ and $Q = W = nRT\\ln(V_2/V_1)$. Every joule of heat that flows in leaves again as work on the piston." },
      { id: "cpcv", title: "Heat it two ways",
        text: "Raise the temperature by at least 50 K at constant volume, and again at constant pressure (same gas, same $n$). Compare the heat needed per kelvin.",
        why: "At constant volume all the heat goes into $U$: $Q = nC_v\\Delta T$. At constant pressure the gas also pushes the piston out, so it needs more: $Q = nC_p\\Delta T$, with $C_p - C_v = R$." },
      { id: "double", title: "Double the temperature without any heat",
        text: "Compress the gas adiabatically until $T$ is twice its starting value.",
        why: "With $Q = 0$, all the work you do on the gas goes into $U$. $TV^{\\gamma-1}$ stays constant, so you need $V_2 = V_1/2^{1/(\\gamma-1)}$: that's $V_1/2.83$ for a monatomic gas and $V_1/5.66$ for a diatomic one." },
      { id: "allneg", title: "Make Q, W and ΔU all negative",
        text: "Find a process where heat leaves, the gas is squeezed and it cools, all at once.",
        why: "Compress at constant pressure: $W = P\\Delta V < 0$, $T \\propto V$ falls so $\\Delta U < 0$, and $Q = nC_p\\Delta T$ is negative too. More heat leaves than the work you put in." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- the gas ---------- */
  // Move the gas reversibly along a process to x (V in L, or P in kPa at constant volume),
  // in small substeps: the work is the numerically integrated area under P(V) (Simpson's rule),
  // the adiabatic temperature comes from n Cv dT = -P dV (RK4). Q is booked as dU + dW.
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
      dQ = proc === "adiabatic" ? 0 : nCv * (g.T - T0) + dW;   // insulated walls: no heat, by definition
      g.W += dW; g.Q += dQ;
      if (dQ > 0) g.Qin += dQ; else g.Qout -= dQ;
    }
  }
  // dT/dV = -(R/Cv) T/V for a reversible adiabatic step
  function rk4(T, V, h, cv) {
    var f = function (t, v) { return -t / (cv * v); };
    var k1 = f(T, V), k2 = f(T + h / 2 * k1, V + h / 2), k3 = f(T + h / 2 * k2, V + h / 2), k4 = f(T + h * k3, V + h);
    return T + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  // The textbook closed forms, from state 1 to x along the process.
  function exact(p, proc, x) {
    var nR = p.n * R, nCv = p.n * p.cv * R, T1 = p.P1 * p.V1 / nR, gam = (p.cv + 1) / p.cv, s = {};
    if (proc === "isobaric") { s.P = p.P1; s.V = x; s.T = p.P1 * x / nR; s.W = p.P1 * (x - p.V1); s.Q = (nCv + nR) * (s.T - T1); }
    else if (proc === "isochoric") { s.P = x; s.V = p.V1; s.T = x * p.V1 / nR; s.W = 0; s.Q = nCv * (s.T - T1); }
    else if (proc === "isothermal") { s.V = x; s.T = T1; s.P = nR * T1 / x; s.W = nR * T1 * Math.log(x / p.V1); s.Q = s.W; }
    else { s.V = x; s.P = p.P1 * Math.pow(p.V1 / x, gam); s.T = T1 * Math.pow(p.V1 / x, gam - 1); s.W = (p.P1 * p.V1 - s.P * x) / (gam - 1); s.Q = 0; }
    s.U = nCv * (s.T - T1);
    return s;
  }
  // round up to a whole number of nice ticks, so the axis fits the data snugly
  function snug(v) { var s = nice(v / 5); return Math.ceil(v / s - 1e-9) * s; }
  function nice(v) {
    var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  // a few significant figures for things like PV^gamma
  function sig(x) { return Math.abs(x) >= 1000 ? K.fmt(x, 0) : String(Number(x.toPrecision(4))); }
  function mix(a, b, t) {
    var A = /^#?([0-9a-f]{6})$/i.exec(a), B2 = /^#?([0-9a-f]{6})$/i.exec(b);
    if (!A || !B2) return b;
    var x = parseInt(A[1], 16), y = parseInt(B2[1], 16), c = function (s) { return Math.round((x >> s & 255) * (1 - t) + (y >> s & 255) * t); };
    return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 460;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });
    var CYL = { x: 90, w: 230, top: 70, bottom: 350 }, HS = (CYL.bottom - CYL.top - 40) / V_HI;   // px per litre
    var BOX = { x0: 500, x1: 965, y0: 36, y1: 400 };

    /* ---------- controls ---------- */
    var proc = "isobaric", gas = "mono";
    var nS = K.slider({ label: "Amount of gas $n$", unit: "mol", min: 0.5, max: 3, step: 0.5, value: 1, onInput: reset });
    var p1S = K.slider({ label: "Start pressure $P_1$", unit: "kPa", min: 50, max: 300, step: 10, value: 100, onInput: reset });
    var v1S = K.slider({ label: "Start volume $V_1$", unit: "L", min: 5, max: 50, step: 1, value: 25, onInput: reset });
    var v2S = K.slider({ label: "Target volume $V_2$", unit: "L", min: V_LO, max: V_HI, step: 1, value: 40, onInput: retarget,
      hint: "Run drives the piston here. Or drag the piston, or the dot on the P–V diagram." });
    var p2S = K.slider({ label: "Target pressure $P_2$", unit: "kPa", min: 20, max: 600, step: 10, value: 200, onInput: retarget,
      hint: "The piston is pinned, so only heating or cooling changes anything." });
    P.controls.innerHTML = "<h3>Process</h3>";
    var procSeg = K.seg(ORDER.map(function (k) { return { label: PROC[k].label, value: k }; }), proc, function (v) { proc = v; showTarget(); reset(); }, "Process");
    P.controls.appendChild(procSeg);
    P.controls.appendChild(K.h("<h3>The gas</h3>"));
    var gasSeg = K.seg([{ label: "Monatomic (He)", value: "mono" }, { label: "Diatomic (N₂)", value: "di" }], gas, function (v) { gas = v; reset(); }, "Gas");
    P.controls.appendChild(gasSeg);
    [nS, p1S, v1S].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Where to</h3>"));
    P.controls.appendChild(v2S.el); P.controls.appendChild(p2S.el);
    var row = K.h('<div class="row"></div>');
    var heatB = K.h('<button class="btn btn-sm" type="button">Heat +100 J</button>');
    var coolB = K.h('<button class="btn btn-sm" type="button">Cool −100 J</button>');
    heatB.addEventListener("click", function () { heat(100); });
    coolB.addEventListener("click", function () { heat(-100); });
    row.appendChild(heatB); row.appendChild(coolB);
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-fric"><i></i>heat Q</span><span class="c-app"><i></i>work W</span><span class="c-ten"><i></i>ΔU</span>' +
      '<span class="c-disp"><i></i>isobaric</span><span class="c-acc"><i></i>isochoric</span><span class="c-vel"><i></i>isothermal</span><span class="c-grav"><i></i>adiabatic</span></div>'));
    function showTarget() { v2S.el.hidden = proc === "isochoric"; p2S.el.hidden = proc !== "isochoric"; }
    showTarget();

    function params() {
      return { n: nS.get(), P1: p1S.get(), V1: v1S.get(), V2: v2S.get(), P2: p2S.get(), cv: gas === "mono" ? 1.5 : 2.5 };
    }
    function xOf(g) { return proc === "isochoric" ? g.P : g.V; }
    function target() { return proc === "isochoric" ? st.p.P2 : st.p.V2; }
    function clampX(x) { return proc === "isochoric" ? K.clamp(x, P_LO, P_HI) : K.clamp(x, V_LO, V_HI); }

    /* ---------- state ---------- */
    var st, transportUI = null, perK = {};
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();
    var mol = [];
    for (var i = 0; i < 40; i++) mol.push({ u: Math.random(), v: Math.random(), du: Math.random() - 0.5, dv: Math.random() - 0.5 });

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params(), T1 = p.P1 * p.V1 / (p.n * R);
      st = { p: p, T1: T1, g: { n: p.n, cv: p.cv, P: p.P1, V: p.V1, T: T1, Q: 0, W: 0, Qin: 0, Qout: 0 }, rec: [], flow: 0, fade: 0, dV: 0, ended: false };
      st.rate = Math.abs(target() - xOf(st.g)) / RUN_T;
      P.time.textContent = "t = 0.00 s";
      record(); update(true);
    }
    function retarget() {
      st.p = Object.assign({}, st.p, { V2: v2S.get(), P2: p2S.get() });
      st.rate = Math.abs(target() - xOf(st.g)) / RUN_T; st.ended = false;
      update(true);
    }
    function record() {
      var g = st.g;
      st.rec.push({ x: xOf(g), V: g.V, P: g.P, T: g.T, Q: g.Q, W: g.W, U: g.n * g.cv * R * (g.T - st.T1) });
      if (st.rec.length > 4000) st.rec.splice(1, 1);
    }
    // move the gas to x along the current process, then book-keep and check the experiments
    function move(x) {
      var g = st.g, Q0 = g.Q, V0 = g.V;
      x = clampX(x);
      if (x === xOf(g)) return;
      advance(g, proc, x);
      st.flow = g.Q - Q0; st.dV = g.V - V0; st.fade = 1;
      record(); checkTries(); update();
    }
    // a fixed amount of heat in (or out): work out where it takes the gas, then go there
    function heat(dQ) {
      var g = st.g, nR = g.n * R, nCv = g.n * g.cv * R;
      if (proc === "adiabatic") { K.flash(P.note, "The walls are insulated: no heat can flow. Push or pull the piston instead"); return; }
      sim.pause(); if (transportUI) transportUI.render();
      if (proc === "isobaric") move(g.V + nR * (dQ / (nCv + nR)) / g.P);
      else if (proc === "isochoric") move(g.P + nR * (dQ / nCv) / g.V);
      else move(g.V * Math.exp(dQ / (nR * g.T)));
      update(true);
    }

    function checkTries() {
      var g = st.g, p = st.p, dT = g.T - st.T1;
      if (proc === "isothermal" && g.V >= 1.5 * p.V1 - 1e-9) tries.mark("iso");
      if (proc === "adiabatic" && g.T >= 2 * st.T1 - 0.5) tries.mark("double");
      if (proc === "isobaric" && g.W < -50) tries.mark("allneg");
      if ((proc === "isochoric" || proc === "isobaric") && dT >= 50) {
        var key = p.n + gas, c = g.Q / (p.n * dT);
        if (!perK[proc] || perK[proc].key !== key || Math.abs(perK[proc].c - c) > 1e-6) {
          perK[proc] = { key: key, c: c };
          var other = perK[proc === "isochoric" ? "isobaric" : "isochoric"];
          if (other && other.key === key) {
            var cp = proc === "isobaric" ? c : other.c, cv = proc === "isobaric" ? other.c : c;
            K.flash(P.note, "Per mole per kelvin: Cp = " + K.fmt(cp, 2) + ", Cv = " + K.fmt(cv, 2) + " J/(mol·K). Difference " + K.fmt(cp - cv, 2) + " = R", 4000);
            tries.mark("cpcv");
          }
        }
      }
    }

    sim.on("step", function () {
      var X2 = target(), x = xOf(st.g), d = X2 - x, h = st.rate * K.DT;
      if (Math.abs(d) < 1e-12 || !(h > 0)) { if (sim.running) { sim.pause(); transportUI.render(); } return; }
      move(Math.abs(d) <= h + 1e-12 ? X2 : x + (d > 0 ? h : -h));
      if (xOf(st.g) === X2) {
        sim.pause(); transportUI.render(); st.ended = true;
        K.flash(P.note, "Q = " + K.fmt(st.g.Q, 0) + " J, W = " + K.fmt(st.g.W, 0) + " J, ΔU = " + K.fmt(st.g.Q - st.g.W, 0) + " J", 3500);
        update(true);
      }
    });

    /* ---------- direct manipulation ---------- */
    var drag = null;
    function inCyl(pt) { return pt.px > CYL.x - 20 && pt.px < CYL.x + CYL.w + 20 && pt.py > CYL.top - 40 && pt.py < CYL.bottom + 10; }
    function inBox(pt) { return pt.px > BOX.x0 - 10 && pt.px < BOX.x1 + 10 && pt.py > BOX.y0 - 10 && pt.py < BOX.y1 + 10; }
    sim.pointer({
      down: function (pt) {
        if (inCyl(pt)) drag = { kind: "piston", y0: pt.py, x0: xOf(st.g), ax: axes() };
        else if (inBox(pt)) drag = { kind: "pv", ax: axes() };
        else return false;
        sim.pause(); transportUI.render();
        if (proc === "isochoric" && drag.kind === "piston") K.flash(P.note, "The piston is pinned. Drag up to heat the gas, down to cool it");
        dragTo(pt);
      },
      drag: function (pt) { dragTo(pt); },
      up: function () { drag = null; update(true); },
      hover: function (pt) { P.canvas.style.cursor = inCyl(pt) || inBox(pt) ? "grab" : "default"; }
    });
    function dragTo(pt) {
      if (!drag) return;
      var ax = drag.ax, x;
      if (proc === "isochoric") x = drag.kind === "piston" ? drag.x0 + (drag.y0 - pt.py) * ax.Pmax / 300 : (BOX.y1 - pt.py) / (BOX.y1 - BOX.y0) * ax.Pmax;
      else x = drag.kind === "piston" ? (CYL.bottom - pt.py - 9) / HS : (pt.px - BOX.x0) / (BOX.x1 - BOX.x0) * ax.Vmax;
      move(x);
    }

    /* ---------- drawing ---------- */
    function axes() {
      var p = st.p, g = st.g, top = Math.max(p.P1, g.P, exact(p, proc, clampX(target())).P);
      return { Vmax: V_HI, Pmax: snug(top * 1.12) };
    }
    function gasColor(T) { return mix(th.normal, th.fric, K.clamp((T - 150) / 650, 0, 1)); }

    sim.on("under", function (ctx) {
      drawCylinder(ctx);
      drawPV(ctx);
    });
    sim.on("over", function () { st.fade *= 0.95; });

    function drawCylinder(ctx) {
      var c = CYL, g = st.g, u = sim.u(1), gy = c.bottom - g.V * HS, pc = th[PROC[proc].col];
      // isothermal: the cylinder sits in a big reservoir at T
      if (proc === "isothermal") {
        ctx.fillStyle = K.alpha(th.vel, 0.1); ctx.fillRect(c.x - 34, c.top + 30, c.w + 68, c.bottom - c.top + 44);
        K.label(ctx, "reservoir at " + K.fmt(st.T1, 0) + " K", c.x + c.w / 2, c.bottom + 70, th.vel, { s: u });
      }
      // gas + molecules: they jiggle faster when it's hotter
      ctx.fillStyle = K.alpha(gasColor(g.T), 0.28); ctx.fillRect(c.x, gy, c.w, c.bottom - gy);
      var sp = 0.004 * Math.sqrt(Math.max(g.T, 1) / 300);
      ctx.fillStyle = gasColor(g.T);
      mol.forEach(function (m) {
        m.u += m.du * sp * 2; m.v += m.dv * sp * 2 * (V_HI * HS) / Math.max(c.bottom - gy, 10);
        if (m.u < 0 || m.u > 1) { m.du = -m.du; m.u = K.clamp(m.u, 0, 1); }
        if (m.v < 0 || m.v > 1) { m.dv = -m.dv; m.v = K.clamp(m.v, 0, 1); }
        ctx.beginPath(); ctx.arc(c.x + 8 + m.u * (c.w - 16), c.bottom - 5 - m.v * Math.max(c.bottom - gy - 10, 0), 3 * u, 0, Math.PI * 2); ctx.fill();
      });
      // walls
      ctx.strokeStyle = th.ink; ctx.lineWidth = 4 * u; ctx.lineJoin = "miter";
      ctx.beginPath(); ctx.moveTo(c.x - 2, c.top); ctx.lineTo(c.x - 2, c.bottom + 2); ctx.lineTo(c.x + c.w + 2, c.bottom + 2); ctx.lineTo(c.x + c.w + 2, c.top); ctx.stroke();
      if (proc === "adiabatic") {           // insulation: hatched lagging on every wall
        ctx.save(); ctx.strokeStyle = K.alpha(th.grav, 0.7); ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        for (var y = c.top; y < c.bottom + 14; y += 9) {
          ctx.moveTo(c.x - 16, y + 9); ctx.lineTo(c.x - 4, y);
          ctx.moveTo(c.x + c.w + 4, y + 9); ctx.lineTo(c.x + c.w + 16, y);
        }
        for (var x = c.x - 16; x < c.x + c.w + 16; x += 9) { ctx.moveTo(x, c.bottom + 16); ctx.lineTo(x + 9, c.bottom + 4); }
        ctx.stroke(); ctx.restore();
        K.label(ctx, "insulated: Q = 0", c.x + c.w / 2, c.bottom + 42, th.grav, { s: u });
      }
      // piston + rod
      ctx.fillStyle = th.body; ctx.fillRect(c.x + 1, gy - 18, c.w - 2, 18);
      ctx.fillRect(c.x + c.w / 2 - 6, c.top - 18, 12, gy - 18 - (c.top - 18));
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(c.x + 10, gy - 11, c.w - 20, 3);
      if (proc === "isobaric") {            // a fixed load keeps the pressure fixed
        ctx.fillStyle = K.alpha(th.disp, 0.85);
        ctx.fillRect(c.x + 30, gy - 40, 60, 22); ctx.fillRect(c.x + c.w - 90, gy - 40, 60, 22);
        K.label(ctx, "load", c.x + 60, gy - 22, th["canvas-bg"], { s: u * 0.9 }); K.label(ctx, "load", c.x + c.w - 60, gy - 22, th["canvas-bg"], { s: u * 0.9 });
      }
      if (proc === "isochoric") {           // pins through the wall above the piston
        ctx.fillStyle = th.acc;
        ctx.fillRect(c.x - 14, gy - 30, 34, 9); ctx.fillRect(c.x + c.w - 20, gy - 30, 34, 9);
        K.label(ctx, "pinned", c.x + c.w / 2, gy - 28, th.acc, { s: u });
      }
      // heater plate and heat arrows
      var hot = st.fade > 0.05 && Math.abs(st.flow) > 1e-6;
      if (proc !== "adiabatic") {
        ctx.fillStyle = hot ? (st.flow > 0 ? th.fric : th.normal) : th["grid-strong"];
        ctx.fillRect(c.x, c.bottom + 6, c.w, 8);
      }
      if (hot && proc !== "adiabatic") {
        var inn = st.flow > 0, col = inn ? th.fric : th.normal;
        ctx.save(); ctx.globalAlpha = Math.min(1, st.fade * 1.4);
        [0.2, 0.5, 0.8].forEach(function (f) {
          var ax = c.x + c.w * f;
          if (inn) K.arrow(ctx, ax, c.bottom + 58, ax, c.bottom - 22, col, { s: u, width: 4 });
          else K.arrow(ctx, ax, c.bottom - 22, ax, c.bottom + 58, col, { s: u, width: 4 });
        });
        K.label(ctx, inn ? "Q in" : "Q out", c.x + c.w + 30, c.bottom + 46, col, { s: u, align: "left" });
        ctx.restore();
      }
      // work arrow on the piston
      if (st.fade > 0.05 && Math.abs(st.dV) > 1e-9) {
        ctx.save(); ctx.globalAlpha = Math.min(1, st.fade * 1.4);
        var wx = c.x + c.w + 34, up = st.dV > 0;
        K.arrow(ctx, wx, gy - (up ? 0 : 50), wx, gy - (up ? 50 : 0), th.app, { s: u, width: 4, label: up ? "W > 0" : "W < 0", lx: 8, ly: up ? 0 : -50 });
        ctx.restore();
      }
      // state label
      K.label(ctx, "P " + K.fmt(g.P, 1) + " kPa   V " + K.fmt(g.V, 1) + " L   T " + K.fmt(g.T, 1) + " K", c.x + c.w / 2, 24, th.ink, { s: u, bg: true });
      K.label(ctx, PROC[proc].label + " · " + PROC[proc].law, c.x + c.w / 2, 44, pc, { s: u });
    }

    function drawPV(ctx) {
      var b = BOX, ax = axes(), p = st.p, g = st.g, u = sim.u(1), pc = th[PROC[proc].col];
      var X = function (V) { return b.x0 + V / ax.Vmax * (b.x1 - b.x0); }, Y = function (Pk) { return b.y1 - Pk / ax.Pmax * (b.y1 - b.y0); };
      // grid + ticks
      ctx.font = "500 " + 11 * u + "px 'JetBrains Mono', monospace"; ctx.lineWidth = u;
      var vs = 10, ps = nice(ax.Pmax / 5);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var V = 0; V <= ax.Vmax + 1e-9; V += vs) {
        ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(X(V), b.y0); ctx.lineTo(X(V), b.y1); ctx.stroke();
        ctx.fillStyle = th.muted; ctx.fillText(String(V), X(V), b.y1 + 6);
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

      ctx.save(); ctx.beginPath(); ctx.rect(b.x0, b.y0 - 4, b.x1 - b.x0, b.y1 - b.y0 + 4); ctx.clip();
      // work = area under the path from V1 to V
      if (proc !== "isochoric" && Math.abs(g.V - p.V1) > 1e-6) {
        ctx.fillStyle = K.alpha(th.app, g.W >= 0 ? 0.22 : 0.14);
        ctx.beginPath(); ctx.moveTo(X(p.V1), Y(0));
        for (var k = 0; k <= 80; k++) { var v = p.V1 + (g.V - p.V1) * k / 80; ctx.lineTo(X(v), Y(exact(p, proc, v).P)); }
        ctx.lineTo(X(g.V), Y(0)); ctx.closePath(); ctx.fill();
      }
      // the other three processes through state 1, faint, for comparing slopes
      ORDER.forEach(function (k2) {
        var mine = k2 === proc;
        ctx.strokeStyle = mine ? pc : K.alpha(th[PROC[k2].col], 0.35); ctx.lineWidth = (mine ? 2 : 1.2) * u;
        ctx.setLineDash(mine ? [6 * u, 5 * u] : [3 * u, 4 * u]);
        ctx.beginPath();
        if (k2 === "isochoric") { ctx.moveTo(X(p.V1), Y(0)); ctx.lineTo(X(p.V1), Y(ax.Pmax * 1.1)); }
        else for (var j = 0; j <= 120; j++) {
          var vv = V_LO + (V_HI - V_LO) * j / 120, pp = exact(p, k2, vv).P;
          if (j) ctx.lineTo(X(vv), Y(Math.min(pp, ax.Pmax * 1.2))); else ctx.moveTo(X(vv), Y(Math.min(pp, ax.Pmax * 1.2)));
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
      // the path actually taken (simulated)
      ctx.strokeStyle = pc; ctx.lineWidth = 3.5 * u; ctx.beginPath();
      st.rec.forEach(function (r, i) { if (i) ctx.lineTo(X(r.V), Y(r.P)); else ctx.moveTo(X(r.V), Y(r.P)); });
      ctx.stroke();
      ctx.restore();
      // target, start and the draggable state
      var tx = exact(p, proc, clampX(target()));
      ctx.strokeStyle = pc; ctx.lineWidth = 2 * u; ctx.setLineDash([3 * u, 3 * u]);
      ctx.beginPath(); ctx.arc(X(tx.V), Y(tx.P), 7 * u, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "2", X(tx.V) + 12 * u, Y(tx.P) - 4 * u, pc, { s: u, align: "left" });
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(X(p.V1), Y(p.P1), 4.5 * u, 0, Math.PI * 2); ctx.fill();
      K.label(ctx, "1", X(p.V1) - 10 * u, Y(p.P1) - 4 * u, th.ink, { s: u });
      ctx.fillStyle = pc; ctx.beginPath(); ctx.arc(X(g.V), Y(g.P), 7 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th["canvas-bg"]; ctx.lineWidth = 2 * u; ctx.stroke();
      if (proc !== "isochoric" && Math.abs(g.V - p.V1) > 1) {
        var mid = (p.V1 + g.V) / 2;
        K.label(ctx, "W = " + K.fmt(g.W, 0) + " J", X(mid), Y(exact(p, proc, mid).P * 0.4) + 8 * u, th.app, { s: u, bg: true });
      } else if (proc === "isochoric") K.label(ctx, "no area: W = 0", X(p.V1) + 10 * u, Y(ax.Pmax * 0.12), th.app, { s: u, bg: true, align: "left" });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b>P–V</b> · all four processes from state 1: the adiabat is $\\gamma$ times steeper than the isotherm</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-fric">Q</b>, <b class="c-app">W</b> and <b class="c-ten">ΔU</b> along the way · ΔU = Q − W at every point</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">Temperature</b> along the way · $U$ follows $T$ alone</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gP = new K.Graph(cv[0], { yLabel: "P (kPa)", xLabel: "V (L)", xMax: V_HI, yMin: 0, color: th.ink });
    var gE = new K.Graph(cv[1], { yLabel: "energy (J)", xLabel: "V (L)", xMax: V_HI, color: th.ink });
    var gT = new K.Graph(cv[2], { yLabel: "T (K)", xLabel: "V (L)", xMax: V_HI, yMin: 0, color: th.acc });

    function drawGraphs() {
      var p = st.p, ax = axes(), cap = Math.max(2 * p.P1, ax.Pmax);
      ORDER.forEach(function (k2) {
        var pts = [];
        if (k2 === "isochoric") pts = [[p.V1, 0], [p.V1, cap]];
        else for (var j = 0; j <= 120; j++) { var v = V_LO + (V_HI - V_LO) * j / 120, pp = exact(p, k2, v).P; if (pp <= cap) pts.push([v, pp]); }
        gP.set(k2, { points: pts, color: k2 === proc ? th[PROC[k2].col] : K.alpha(th[PROC[k2].col], 0.45), dash: [5, 5], width: k2 === proc ? 1.8 : 1.2 });
      });
      gP.set("sim", { points: st.rec.map(function (r) { return [r.V, r.P]; }), color: th[PROC[proc].col], width: 3, dot: true });
      // energy and temperature against V (or P, when V can't change)
      var iso = proc === "isochoric", xm = iso ? ax.Pmax : V_HI;
      [gE, gT].forEach(function (gr) { gr.o.xMax = xm; gr.o.xLabel = iso ? "P (kPa)" : "V (L)"; });
      var x1 = iso ? p.P1 : p.V1, xs = st.rec.map(function (r) { return r.x; }).concat([x1, clampX(target())]);
      var lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs), q = [], w = [], du = [], tt = [];
      for (var k = 0; k <= 100; k++) {
        var x = lo + (hi - lo) * k / 100, e = exact(p, proc, x);
        q.push([x, e.Q]); w.push([x, e.W]); du.push([x, e.U]); tt.push([x, e.T]);
      }
      gE.set("fQ", { points: q, color: th.fric, dash: [5, 5], width: 1.5 });
      gE.set("fW", { points: w, color: th.app, dash: [5, 5], width: 1.5 });
      gE.set("fU", { points: du, color: th.ten, dash: [5, 5], width: 1.5 });
      gE.set("sQ", { points: st.rec.map(function (r) { return [r.x, r.Q]; }), color: th.fric, width: 2.5, dot: true });
      gE.set("sW", { points: st.rec.map(function (r) { return [r.x, r.W]; }), color: th.app, width: 2.5, dot: true });
      gE.set("sU", { points: st.rec.map(function (r) { return [r.x, r.U]; }), color: th.ten, width: 2.5, dot: true });
      gT.set("f", { points: tt, color: th.acc, dash: [5, 5], width: 1.5 });
      gT.set("s", { points: st.rec.map(function (r) { return [r.x, r.T]; }), color: th.acc, width: 2.5, dot: true });
      [gP, gE, gT].forEach(function (gr) { gr.dirty = true; gr.draw(); });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["First law (W = work done by the gas)", "Work = area under the P–V curve", "Heat", "What stays constant"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "state", label: "P, V, T" },
      { id: "Q", label: "heat in Q", cls: "c-fric" },
      { id: "W", label: "work by gas W", cls: "c-app" },
      { id: "U", label: "ΔU = nCᵥΔT", cls: "c-ten" },
      { id: "QW", label: "Q − W", cls: "c-ten" },
      { id: "C", label: "Cᵥ, Cₚ, γ" },
      { id: "Cp", label: "molar heat of this process" }
    ]);
    var slow = K.throttle(function () { renderMaths(); drawGraphs(); }, 80);
    function update(force) { if (force) { renderMaths(); drawGraphs(); } else slow(); }

    function renderMaths() {
      var p = st.p, g = st.g, cvJ = p.cv * R, cpJ = cvJ + R, gam = (p.cv + 1) / p.cv, dT = g.T - st.T1, U = p.n * cvJ * dT;
      var e = exact(p, proc, xOf(g));
      var B = function (v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 && s !== "0" && !/^-0\.?0*$/.test(s) ? "(" + s + ")" : s; };
      var J = "\\ \\text{J}";
      K.tex(eqEls[0], "\\Delta U = nC_v\\Delta T = (" + p.n + ")(" + K.fmt(cvJ, 2) + ")" + "(" + K.fmt(dT, 1) + ") = \\mathbf{" + K.fmt(U, 0) + "}" + J +
        "\\;=\\; Q - W = " + B(g.Q, 0) + " - " + B(g.W, 0) + " = \\mathbf{" + K.fmt(g.Q - g.W, 0) + "}" + J);
      if (proc === "isobaric") K.tex(eqEls[1], "W = P\\,\\Delta V = (" + K.fmt(p.P1, 0) + ")(" + K.fmt(g.V, 2) + " - " + K.fmt(p.V1, 0) + ") = \\mathbf{" + K.fmt(e.W, 0) + "}" + J);
      else if (proc === "isochoric") K.tex(eqEls[1], "W = P\\,\\Delta V = P \\times 0 = \\mathbf{0}" + J + "\\quad\\text{(the piston can't move)}");
      else if (proc === "isothermal") K.tex(eqEls[1], "W = nRT\\ln\\frac{V}{V_1} = (" + p.n + ")(8.314)(" + K.fmt(st.T1, 1) + ")\\ln\\frac{" + K.fmt(g.V, 2) + "}{" + p.V1 + "} = \\mathbf{" + K.fmt(e.W, 0) + "}" + J);
      else K.tex(eqEls[1], "W = \\frac{P_1V_1 - PV}{\\gamma - 1} = \\frac{(" + p.P1 + ")(" + p.V1 + ") - (" + K.fmt(e.P, 1) + ")(" + K.fmt(g.V, 2) + ")}{" + K.fmt(gam, 3) + " - 1} = \\mathbf{" + K.fmt(e.W, 0) + "}" + J);
      if (proc === "isobaric") K.tex(eqEls[2], "Q = nC_p\\Delta T,\\; C_p = C_v + R = " + K.fmt(cvJ, 2) + " + 8.31 = " + K.fmt(cpJ, 2) + "\\;\\Rightarrow\\; Q = (" + p.n + ")(" + K.fmt(cpJ, 2) + ")(" + K.fmt(dT, 1) + ") = \\mathbf{" + K.fmt(e.Q, 0) + "}" + J);
      else if (proc === "isochoric") K.tex(eqEls[2], "Q = nC_v\\Delta T = (" + p.n + ")(" + K.fmt(cvJ, 2) + ")(" + K.fmt(dT, 1) + ") = \\mathbf{" + K.fmt(e.Q, 0) + "}" + J + "\\quad\\text{(all of it into } U)");
      else if (proc === "isothermal") K.tex(eqEls[2], "\\Delta T = 0 \\Rightarrow \\Delta U = 0 \\Rightarrow Q = W = \\mathbf{" + K.fmt(e.Q, 0) + "}" + J);
      else K.tex(eqEls[2], "Q = \\mathbf{0}\\;\\text{(insulated)} \\Rightarrow \\Delta U = -W = \\mathbf{" + K.fmt(-e.W, 0) + "}" + J);
      if (proc === "isobaric") K.tex(eqEls[3], "\\frac{V}{T}:\\; \\frac{" + p.V1 + "}{" + K.fmt(st.T1, 1) + "} = " + sig(p.V1 / st.T1) + ",\\; \\frac{" + K.fmt(g.V, 2) + "}{" + K.fmt(g.T, 1) + "} = \\mathbf{" + sig(g.V / g.T) + "}");
      else if (proc === "isochoric") K.tex(eqEls[3], "\\frac{P}{T}:\\; \\frac{" + p.P1 + "}{" + K.fmt(st.T1, 1) + "} = " + sig(p.P1 / st.T1) + ",\\; \\frac{" + K.fmt(g.P, 1) + "}{" + K.fmt(g.T, 1) + "} = \\mathbf{" + sig(g.P / g.T) + "}");
      else if (proc === "isothermal") K.tex(eqEls[3], "PV:\\; (" + p.P1 + ")(" + p.V1 + ") = " + sig(p.P1 * p.V1) + ",\\; (" + K.fmt(g.P, 1) + ")(" + K.fmt(g.V, 2) + ") = \\mathbf{" + sig(g.P * g.V) + "}");
      else K.tex(eqEls[3], "PV^{\\gamma},\\ \\gamma = \\tfrac{C_p}{C_v} = " + K.fmt(gam, 3) + ":\\; (" + p.P1 + ")(" + p.V1 + ")^{" + K.fmt(gam, 2) + "} = " + sig(p.P1 * Math.pow(p.V1, gam)) +
        ",\\; (" + K.fmt(g.P, 1) + ")(" + K.fmt(g.V, 2) + ")^{" + K.fmt(gam, 2) + "} = \\mathbf{" + sig(g.P * Math.pow(g.V, gam)) + "}");
      setR("state", K.fmt(g.P, 1) + " kPa · " + K.fmt(g.V, 2) + " L · " + K.fmt(g.T, 1) + " K", "T = PV/nR");
      setR("Q", K.fmt(g.Q, 0) + " J", "formula " + K.fmt(e.Q, 0) + " J");
      setR("W", K.fmt(g.W, 0) + " J", "formula " + K.fmt(e.W, 0) + " J");
      setR("U", K.fmt(U, 0) + " J", "formula " + K.fmt(e.U, 0) + " J");
      setR("QW", K.fmt(g.Q - g.W, 0) + " J", "equals ΔU");
      setR("C", K.fmt(cvJ, 2) + ", " + K.fmt(cpJ, 2) + " J/(mol·K), γ = " + K.fmt(gam, 3), "Cₚ − Cᵥ = R");
      setR("Cp", proc === "isothermal" ? "∞" : proc === "adiabatic" ? "0" : K.fmt(proc === "isobaric" ? cpJ : cvJ, 2) + " J/(mol·K)",
        proc === "isothermal" ? "heat flows, T doesn't change" : proc === "adiabatic" ? "T changes with no heat" : "Q / nΔT");
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>An ideal gas has three state variables tied by $PV = nRT$. Its internal energy depends only on temperature: $U = nC_vT$, with $C_v = \\tfrac32R$ for a monatomic gas and $\\tfrac52R$ for a diatomic one. (Here $P$ is in kPa and $V$ in L, so $PV$ comes out in joules.)</p>" +
      "<p>The <b>first law</b> is energy bookkeeping: <b class=\"c-fric\">heat in</b> = <b class=\"c-ten\">rise in internal energy</b> + <b class=\"c-app\">work done by the gas</b>, $Q = \\Delta U + W$. NCERT and JEE take $W$ as the work done <i>by</i> the gas, so an expansion has $W > 0$ and $\\Delta U = Q - W$. That work is the <b>area under the P–V curve</b>.</p>" +
      "<p>Each process holds one thing fixed: isobaric $P$, isochoric $V$, isothermal $T$, adiabatic $Q = 0$ (and then $PV^\\gamma$ stays constant, $\\gamma = C_p/C_v$). Heating at constant pressure costs more than at constant volume because the gas also does work: $C_p - C_v = R$.</p>" +
      '<div class="trap"><b>JEE trap: isothermal is not adiabatic.</b> On an isotherm heat <i>does</i> flow, $Q = W$; only $\\Delta U$ is zero. In an adiabatic process no heat flows, yet the temperature changes. Through the same point the adiabat is steeper than the isotherm by exactly a factor $\\gamma$. And watch the sign: some chemistry books write $\\Delta U = Q + W$ with $W$ done <i>on</i> the gas.</div>');

    function apply(s) {
      proc = s.proc; gas = s.gas;
      procSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === proc)); });
      gasSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === gas)); });
      nS.set(s.n); p1S.set(s.P1); v1S.set(s.V1);
      if (s.V2 != null) v2S.set(s.V2);
      if (s.P2 != null) p2S.set(s.P2);
      showTarget(); reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "heating at constant volume", setup: { proc: "isochoric", gas: "mono", n: 1, P1: 100, V1: 20, P2: 150 }, watch: "Predict Q, then press Run process",
        q: "A rigid 20 L vessel holds a monatomic ideal gas at 100 kPa. It is heated until the pressure reaches 150 kPa. How much heat is supplied?",
        options: ["1000 J", "1500 J", "2500 J", "0 J, since no work is done"], answer: 1,
        explain: "No work is done at constant volume, so $Q = \\Delta U = nC_v\\Delta T$. Since $nR\\Delta T = V\\Delta P = 20 \\times 50 = 1000$ J, $Q = \\tfrac32 \\times 1000 = 1500$ J. 2500 J uses $C_p$, which only applies at constant pressure." },
      { level: "medium", tag: "heating at constant pressure", setup: { proc: "isobaric", gas: "di", n: 1, P1: 100, V1: 20, V2: 30 }, watch: "Predict Q, then press Run process and read the three energies",
        q: "A diatomic ideal gas at 100 kPa expands at constant pressure from 20 L to 30 L. How much heat does it absorb?",
        options: ["1000 J", "2500 J", "3500 J", "1400 J"], answer: 2,
        hints: ["Work first: $W = P\\Delta V$, and kPa × L = J.", "At constant pressure $nR\\Delta T = P\\Delta V$, so $Q = nC_p\\Delta T = \\tfrac{C_p}{R}P\\Delta V$ with $C_p = \\tfrac72R$."],
        explain: "$W = 100 \\times 10 = 1000$ J and $\\Delta U = \\tfrac52 nR\\Delta T = 2500$ J, so $Q = 3500$ J. Only $R/C_p = 2/7$ of the heat comes out as work. 1000 J forgets $\\Delta U$; 2500 J forgets the work; 1400 J is $\\gamma W$." },
      { level: "hard", tag: "adiabatic compression", setup: { proc: "adiabatic", gas: "mono", n: 1, P1: 100, V1: 32, V2: 4 }, watch: "Predict both, then press Run process. Compare the dashed isotherm too",
        q: "A monatomic ideal gas at 100 kPa and 32 L is compressed reversibly and adiabatically to 4 L. What is its final pressure, and how much work is done <i>on</i> the gas?",
        options: ["3200 kPa and 14.4 kJ", "800 kPa and 6.65 kJ", "3200 kPa and 9.6 kJ", "1600 kPa and 14.4 kJ"], answer: 0,
        hints: ["$PV^\\gamma$ is constant with $\\gamma = 5/3$, and $8^{5/3} = 32$.", "Work done by the gas is $W = \\dfrac{P_1V_1 - P_2V_2}{\\gamma - 1}$. Work done on it is $-W$."],
        explain: "$P_2 = 100 \\times 8^{5/3} = 3200$ kPa. Then $W = \\dfrac{3200 - 12800}{2/3} = -14400$ J, so 14.4 kJ is done on the gas and all of it becomes internal energy: $T$ rises by a factor $8^{2/3} = 4$. 800 kPa and 6.65 kJ is the isothermal answer; 9.6 kJ forgets to divide by $\\gamma - 1$." }
    ], apply, P);

    transportUI = K.transport(P, sim, { playLabel: "Run process", onReset: reset, onPlay: function () {
      if (st.ended) reset();
      st.rate = Math.abs(target() - xOf(st.g)) / RUN_T;
      if (!(st.rate > 0)) K.flash(P.note, "Already there: move the target, or drag the piston");
    } });
    reset();
    if (location.hostname === "localhost") {
      window.__lab_processes = { apply: apply, move: move, heat: heat, state: function () { return { g: st.g, T1: st.T1, p: st.p, proc: proc, exact: exact(st.p, proc, xOf(st.g)) }; } };
    }

    return function destroy() { sim.destroy(); [gP, gE, gT].forEach(function (g) { g.destroy(); }); };
  }
})();
