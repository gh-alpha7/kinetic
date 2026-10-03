/* Semiconductors, lab 1: the p–n junction. Carriers and the depletion region, the Shockley I–V curve,
   Zener breakdown, and half-wave / full-wave rectifiers with a smoothing capacitor. */
(function () {
  "use strict";
  var VT = 0.02585;                         // thermal voltage kT/q at 300 K (V)
  // Each diode: knee / barrier voltage, ideality factor and reverse saturation current.
  // I_s is picked so the Shockley curve reaches a few mA right around the textbook knee.
  var MAT = {
    si: { name: "Si", Vk: 0.7, eta: 2, Is: 1e-8 },
    ge: { name: "Ge", Vk: 0.3, eta: 1, Is: 2e-7 }
  };
  var IZK = 1e-3, VBD = 0.1;                // Zener: 1 mA of reverse current at V = −V_z, rising e-fold every 0.1 V
  var SLOW = 50;                            // rectifier slow motion: 1 s on screen = 20 ms of circuit time
  var T_RECT = 0.1;                         // one rectifier run lasts 100 ms of circuit time
  var SUB = 20;                             // circuit substeps per frame

  var lab = {
    id: "diode", chapter: "semi", title: "p–n junction & diodes", short: "depletion, I–V curve, rectifiers",
    lede: "Join p-type to n-type silicon and a one-way valve for current appears. Drag the bias, watch the depletion region breathe, then put diodes to work turning AC into DC.",
    tries: [
      { id: "widen", title: "Double the depletion region",
        text: "Reverse-bias the junction until the depletion region is at least twice as wide as with no battery.",
        why: "Reverse bias adds to the built-in barrier, so more fixed ions are uncovered: $W \\propto \\sqrt{V_0 - V}$. Doubling $W$ needs $V_0 - V = 4V_0$, so about $-2.1$ V for silicon. The current hardly changes: it's stuck at the tiny saturation value $I_s$." },
      { id: "zener", title: "Break down a Zener diode",
        text: "Turn on the Zener diode and drive at least 1 mA backwards through it.",
        why: "Past $-V_z$ the field in the thin depletion region rips electrons out of bonds, and the reverse current shoots up while the voltage stays pinned near $V_z$. That flat part is why Zeners are used as voltage regulators." },
      { id: "smooth", title: "Smooth the output to under 10 % ripple",
        text: "With a full-wave bridge and a capacitor, get the peak-to-peak ripple below 10 % of the peak output.",
        why: "Between peaks the capacitor feeds the load and sags by about $V_p/(f_r R C)$. Full-wave doubles $f_r$, so it halves the ripple for the same capacitor. Bigger $R$ or $C$ smooths it further." },
      { id: "broken", title: "Break one diode in the bridge",
        text: "In full-wave mode, click a diode to open it, and run for two cycles.",
        why: "Each half-cycle needs its own pair of diodes. Open one diode and that pair can't conduct, so the bridge becomes a half-wave rectifier: the ripple frequency falls from $2f$ to $f$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- the physics (pure functions, also used by the tests) ---------- */
  // d: { m: material, zener: bool, Vz }
  function diodeI(V, d) {
    var I = d.m.Is * (Math.exp(V / (d.m.eta * VT)) - 1);
    if (d.zener) I -= IZK * Math.exp(-(V + d.Vz) / VBD);
    return I;
  }
  function diodeG(V, d) {                    // dI/dV
    var g = d.m.Is / (d.m.eta * VT) * Math.exp(V / (d.m.eta * VT));
    if (d.zener) g += IZK / VBD * Math.exp(-(V + d.Vz) / VBD);
    return g;
  }
  // Battery V_B in series with R and the diode: solve I_diode(V) = (V_B − V) / R by bisection (it's monotonic).
  function operate(VB, R, d) {
    var lo = Math.min(VB, 0), hi = Math.max(VB, 0);
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      if (diodeI(mid, d) - (VB - mid) / R > 0) hi = mid; else lo = mid;
      if (hi - lo < 1e-13) break;
    }
    var V = (lo + hi) / 2;
    return { V: V, I: (VB - V) / R };
  }
  // exact average of a rectified sine with n knee drops (no capacitor): (k/π)[2V_m cosθ₀ − nV_k(π − 2θ₀)], k = ½ for half-wave
  function exactAvg(Vm, nVk, full) {
    if (nVk >= Vm) return 0;
    var th0 = Math.asin(nVk / Vm);
    return (full ? 1 : 0.5) / Math.PI * (2 * Vm * Math.cos(th0) - nVk * (Math.PI - 2 * th0));
  }

  function fI(I) {
    var a = Math.abs(I);
    if (a >= 1e-3) return K.fmt(I * 1e3, 2) + " mA";
    if (a >= 1e-6) return K.fmt(I * 1e6, 2) + " µA";
    return K.fmt(I * 1e9, 2) + " nA";
  }
  function fIt(I) { return fI(I).replace(" µA", "\\ \\mu\\text{A}").replace(/ (mA|nA)/, "\\ \\text{$1}"); }
  function fR(r) {
    if (!isFinite(r) || r > 1e12) return "> 1 TΩ";
    var a = Math.abs(r);
    if (a >= 1e9) return K.fmt(r / 1e9, 2) + " GΩ";
    if (a >= 1e6) return K.fmt(r / 1e6, 2) + " MΩ";
    if (a >= 1e3) return K.fmt(r / 1e3, 2) + " kΩ";
    return K.fmt(r, 2) + " Ω";
  }

  // K.Graph always starts x at 0; the I–V curve needs negative voltages, so this copy of its draw takes o.xMin too.
  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function xyGraph(canvas, o) {
    var g = new K.Graph(canvas, o), th = K.theme;
    g.draw = function () {
      if (!this.dirty) return;
      this.dirty = false;
      var ctx = this.ctx, o = this.o, w = this.w, h = this.h, self = this, fmt = K.fmt;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var L = 44, R = 10, T = 12, B = 26;
      var xMin = o.xMin || 0, xMax = o.xMax, yMin = 0, yMax = 0;
      Object.keys(this.series).forEach(function (k) {
        self.series[k].points.forEach(function (p) { if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1]; });
      });
      if (o.yMin !== undefined) yMin = Math.min(yMin, o.yMin);
      if (o.yMax !== undefined) yMax = Math.max(yMax, o.yMax);
      if (yMax - yMin < 1e-9) { yMax += 1; yMin -= 1; }
      var pad = (yMax - yMin) * 0.08; yMax += pad; if (yMin < 0) yMin -= pad;
      var X = function (t) { return L + (t - xMin) / (xMax - xMin) * (w - L - R); };
      var Y = function (v) { return T + (1 - (v - yMin) / (yMax - yMin)) * (h - T - B); };
      ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.fillStyle = th.muted; ctx.lineWidth = 1;
      var ys = niceStep(yMax - yMin, 4);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
        ctx.strokeStyle = Math.abs(v) < 1e-9 ? th["grid-strong"] : th.grid;
        ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke();
        ctx.fillText(fmt(v, ys < 1 ? 1 : 0), L - 6, Y(v));
      }
      var xs = niceStep(xMax - xMin, 5), xd = xs < 0.1 ? 2 : xs < 1 ? 1 : 0;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var t = Math.ceil(xMin / xs - 1e-9) * xs; t <= xMax + 1e-9; t += xs) {
        ctx.strokeStyle = Math.abs(t) < 1e-9 ? th["grid-strong"] : th.grid;
        ctx.beginPath(); ctx.moveTo(X(t), T); ctx.lineTo(X(t), h - B); ctx.stroke();
        ctx.fillText(fmt(t, xd), X(t), h - B + 5);
      }
      ctx.strokeStyle = th["grid-strong"];
      ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, h - B); ctx.lineTo(w - R, h - B); ctx.stroke();
      ctx.save(); ctx.translate(11, (T + h - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = o.color || th.ink; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.fillText(o.yLabel, 0, 0); ctx.restore();
      ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillStyle = th.muted;
      ctx.fillText(o.xLabel || "t (s)", w - R, h - B - 2);
      Object.keys(this.series).forEach(function (k) {
        var s = self.series[k], pts = s.points;
        if (!pts.length) return;
        ctx.save();
        ctx.beginPath(); ctx.rect(L, T - 2, w - L - R, h - T - B + 4); ctx.clip();
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.lineJoin = "round";
        if (s.dash) ctx.setLineDash(s.dash);
        ctx.beginPath();
        pts.forEach(function (p, i) { if (i && !p[2]) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
        ctx.stroke();
        ctx.restore();
        if (s.dot) {
          var last = pts[pts.length - 1];
          ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 4, 0, Math.PI * 2); ctx.fill();
        }
      });
    };
    g.dirty = true; g.draw();
    return g;
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 460;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "junction", matKey = "si", zener = false, rectType = "full", cap = false, ideal = false;
    var segs = {};
    function segRow(name, opts, value, fn, label) { segs[name] = K.seg(opts, value, fn, label); return segs[name]; }
    function setSeg(name, value) {
      var b = segs[name].querySelector('button[data-value="' + value + '"]');
      if (b && b.getAttribute("aria-pressed") !== "true") b.click();
    }
    var vbS = K.slider({ label: "Battery $V_B$", unit: "V", min: -15, max: 5, step: 0.1, value: 2, onInput: onBias,
      hint: "Positive pushes the p side up: forward bias. You can also drag sideways on the junction." });
    var rS = K.slider({ label: "Series resistor $R$", unit: "Ω", min: 100, max: 5000, step: 100, value: 1000, onInput: onBias });
    var vzS = K.slider({ label: "Zener voltage $V_z$", unit: "V", min: 2, max: 10, step: 0.5, value: 5, onInput: onBias });
    var vmS = K.slider({ label: "AC peak $V_m$", unit: "V", min: 2, max: 20, step: 0.5, value: 10, onInput: reset });
    var fS = K.slider({ label: "Frequency $f$", unit: "Hz", min: 25, max: 100, step: 5, value: 50, onInput: reset });
    var rlS = K.slider({ label: "Load $R_L$", unit: "kΩ", min: 0.1, max: 10, step: 0.1, value: 1, onInput: reset });
    var cS = K.slider({ label: "Capacitor $C$", unit: "µF", min: 10, max: 1000, step: 10, value: 100, onInput: reset });

    P.controls.innerHTML = "<h3>What to look at</h3>";
    P.controls.appendChild(segRow("mode", [{ label: "Junction & I–V", value: "junction" }, { label: "Rectifier", value: "rect" }], mode,
      function (v) { mode = v; layoutMode(); reset(); }, "Mode"));
    P.controls.appendChild(K.h("<h3>Diode</h3>"));
    P.controls.appendChild(segRow("mat", [{ label: "Silicon (0.7 V)", value: "si" }, { label: "Germanium (0.3 V)", value: "ge" }], matKey,
      function (v) { matKey = v; history = []; reset(); }, "Material"));

    var jBox = K.h("<div><h3>Bias circuit</h3></div>");
    [vbS, rS].forEach(function (s) { jBox.appendChild(s.el); });
    var zRow = K.h('<div class="row"></div>');
    zRow.appendChild(K.check("Zener diode (breaks down at −V<sub>z</sub>)", false, function (v) { zener = v; vzS.el.hidden = !v; history = []; onBias(); }));
    jBox.appendChild(zRow);
    jBox.appendChild(vzS.el); vzS.el.hidden = true;
    var zCheck = zRow.querySelector("input");
    var jPresets = K.h('<div class="row"></div>');
    [
      { label: "Forward", vb: 2 }, { label: "No battery", vb: 0 }, { label: "Reverse", vb: -6 }
    ].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p.label + "</button>");
      b.addEventListener("click", function () { vbS.set(p.vb); onBias(); });
      jPresets.appendChild(b);
    });
    jBox.appendChild(K.h("<h3>Quick bias</h3>"));
    jBox.appendChild(jPresets);
    P.controls.appendChild(jBox);

    var rBox = K.h("<div><h3>Rectifier</h3></div>");
    rBox.appendChild(segRow("rect", [{ label: "Half-wave", value: "half" }, { label: "Full-wave bridge", value: "full" }], rectType,
      function (v) { rectType = v; diodes = [true, true, true, true]; flipped = false; reset(); }, "Rectifier"));
    [vmS, fS, rlS].forEach(function (s) { rBox.appendChild(s.el); });
    var cRow = K.h('<div class="row"></div>');
    cRow.appendChild(K.check("Smoothing capacitor", false, function (v) { cap = v; cS.el.hidden = !v; reset(); }));
    cRow.appendChild(K.check("Ideal diodes (no knee drop)", false, function (v) { ideal = v; reset(); }));
    rBox.appendChild(cRow);
    rBox.appendChild(cS.el); cS.el.hidden = true;
    var capCheck = cRow.querySelectorAll("input")[0], idealCheck = cRow.querySelectorAll("input")[1];
    rBox.appendChild(K.h('<p class="control-hint">Click a diode on the stage: in the bridge it breaks (opens); in half-wave it turns round.</p>'));
    P.controls.appendChild(rBox);

    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-app"><i></i>holes (p side)</span><span class="c-disp"><i></i>electrons (n side)</span>' +
      '<span class="c-acc"><i></i>current</span><span class="c-grav"><i></i>junction field</span></div>'));

    function setCheck(input, v) { if (input.checked !== !!v) { input.checked = !!v; input.dispatchEvent(new Event("change")); } }
    function layoutMode() { jBox.hidden = mode !== "junction"; rBox.hidden = mode !== "rect"; buildPanels(); }

    function dev() { return { m: MAT[matKey], zener: zener, Vz: vzS.get() }; }
    function rp() {
      var m = MAT[matKey];
      return { Vm: vmS.get(), f: fS.get(), R: rlS.get() * 1000, C: cap ? cS.get() * 1e-6 : 0, Vk: ideal ? 0 : m.Vk, full: rectType === "full" };
    }

    /* ---------- junction state ---------- */
    var op = null, history = [], holes = [], elecs = [], minor = [], acc = { f: 0, r: 0 }, wire = 0, dragging = null;
    var BAR = { x0: 200, x1: 800, y0: 140, y1: 260, j: 500 }, W0PX = 32;

    function wRel(V) { var V0 = MAT[matKey].Vk; return Math.sqrt(Math.max(0, 1 - V / V0)); }
    function halfW() { return K.clamp(W0PX * wRel(op.V), 3, 250); }

    function solveJ() {
      var d = dev(), VB = vbS.get(), R = rS.get();
      op = operate(VB, R, d);
      // dynamic resistance from the circuit itself: nudge the battery and see how V_D and I move
      var a = operate(VB - 1e-3, R, d), b = operate(VB + 1e-3, R, d);
      op.rdSim = (b.V - a.V) / (b.I - a.I);
      op.rdExact = 1 / diodeG(op.V, d);
      op.W = wRel(op.V);
      var last = history[history.length - 1];
      if (!last || Math.abs(last[0] - op.V) > 1e-6) history.push([op.V, op.I]);
      if (history.length > 400) history.shift();
      if (mode === "junction") {
        if (op.W >= 2) tries.mark("widen");
        if (zener && op.I <= -1e-3) tries.mark("zener");
      }
    }
    function onBias() { solveJ(); if (mode === "junction") { theoryJ(); update(true); } }

    function seedCarriers() {
      holes = []; elecs = []; minor = [];
      for (var i = 0; i < 70; i++) {
        holes.push({ x: BAR.x0 + 8 + Math.random() * (BAR.j - BAR.x0 - 16), y: BAR.y0 + 8 + Math.random() * (BAR.y1 - BAR.y0 - 16), st: "free" });
        elecs.push({ x: BAR.j + 8 + Math.random() * (BAR.x1 - BAR.j - 16), y: BAR.y0 + 8 + Math.random() * (BAR.y1 - BAR.y0 - 16), st: "free" });
      }
      settle();
    }
    // push majority carriers out of the depletion region (it has none: that's why it's "depleted")
    function settle() {
      var w = halfW();
      holes.forEach(function (c) { if (c.st === "free" && c.x > BAR.j - w - 3) c.x = Math.max(BAR.x0 + 6, BAR.j - w - 3 - Math.random() * 6); });
      elecs.forEach(function (c) { if (c.st === "free" && c.x < BAR.j + w + 3) c.x = Math.min(BAR.x1 - 6, BAR.j + w + 3 + Math.random() * 6); });
    }
    function jitter(c, lo, hi) {
      c.x = K.clamp(c.x + (Math.random() - 0.5) * 2.2, lo, hi);
      c.y = K.clamp(c.y + (Math.random() - 0.5) * 2.2, BAR.y0 + 6, BAR.y1 - 6);
    }
    function stepJunction() {
      var w = halfW(), I = op.I;
      // visual crossing rates (per second) on a log scale of the current
      var fwd = I > 0 ? Math.min(30, 7 * Math.log10(1 + I / 1e-5)) : 0;
      var rev = I < -1e-4 ? Math.min(30, 7 * Math.log10(1 + -I / 1e-5)) : I < 0 ? 0.6 : 0;
      acc.f += fwd * K.DT; acc.r += rev * K.DT;
      while (acc.f >= 1) { acc.f -= 1; inject(); }
      while (acc.r >= 1) { acc.r -= 1; minor.push({ e: true, x: BAR.j - w - 4 - Math.random() * 30, y: BAR.y0 + 10 + Math.random() * 100 }); if (Math.random() < 0.5) minor.push({ e: false, x: BAR.j + w + 4 + Math.random() * 30, y: BAR.y0 + 10 + Math.random() * 100 }); }
      holes.forEach(function (c) { move(c, 1); });
      elecs.forEach(function (c) { move(c, -1); });
      // minority carriers: the field sweeps electrons to n and holes to p
      minor = minor.filter(function (c) { c.x += c.e ? 3.2 : -3.2; c.y += (Math.random() - 0.5) * 1.5; return c.e ? c.x < BAR.x1 - 4 : c.x > BAR.x0 + 4; });
      function move(c, dir) {
        if (c.st === "free") { if (dir > 0) jitter(c, BAR.x0 + 6, BAR.j - w - 3); else jitter(c, BAR.j + w + 3, BAR.x1 - 6); return; }
        if (c.st === "cross") {
          c.x += dir * 2.6; c.y += (Math.random() - 0.5) * 1.5;
          if ((dir > 0 && c.x > c.end) || (dir < 0 && c.x < c.end)) { c.st = "pop"; c.life = 14; }
          return;
        }
        if (c.st === "pop" && --c.life <= 0) {
          // recombined with a carrier of the other kind; the battery feeds in a fresh one at the contact
          c.st = "free"; c.x = dir > 0 ? BAR.x0 + 6 + Math.random() * 10 : BAR.x1 - 6 - Math.random() * 10;
        }
      }
      // conventional current dots in the wires
      wire += (I > 0 ? 1 : I < 0 ? -1 : 0) * Math.min(6, 0.9 * Math.log10(1 + Math.abs(I) / 1e-7));
    }
    function inject() {
      var w = halfW();
      var h = holes.filter(function (c) { return c.st === "free" && c.x > BAR.j - w - 70; });
      var e = elecs.filter(function (c) { return c.st === "free" && c.x < BAR.j + w + 70; });
      if (h.length) { var a = h[Math.floor(Math.random() * h.length)]; a.st = "cross"; a.end = BAR.j + w + 15 + Math.random() * 90; }
      if (e.length) { var b = e[Math.floor(Math.random() * e.length)]; b.st = "cross"; b.end = BAR.j - w - 15 - Math.random() * 90; }
    }

    /* ---------- rectifier state ---------- */
    var rs = null, diodes = [true, true, true, true], flipped = false;
    function newRun() {
      rs = { tau: 0, vc: 0, cond: false, branch: 0, iD: 0, starts: [], samples: [], done: false, openFor: 0, phase: 0,
        rec: { t: [], vin: [], vout: [], ideal: [], iD: [] } };
    }
    // advance the circuit by dt seconds of circuit time (exact for ideal switches with a knee drop)
    function stepRect(dt) {
      var p = rp(), w = 2 * Math.PI * p.f, tau = rs.tau + dt, src = p.Vm * Math.sin(w * tau), dsrc = p.Vm * w * Math.cos(w * tau);
      var m = -Infinity, slope = 0, branch = 0, sign = 1;
      if (p.full) {
        var okP = diodes[0] && diodes[2], okN = diodes[1] && diodes[3];
        if (okP && src - 2 * p.Vk > m) { m = src - 2 * p.Vk; slope = dsrc; branch = 1; }
        if (okN && -src - 2 * p.Vk > m) { m = -src - 2 * p.Vk; slope = -dsrc; branch = -1; }
      } else {
        sign = flipped ? -1 : 1;
        m = sign * src - p.Vk; slope = sign * dsrc; branch = sign;
      }
      var vc, cond;
      if (p.C > 0) {
        var decay = rs.vc * Math.exp(-dt / (p.R * p.C));
        cond = m > decay; vc = cond ? m : decay;
      } else { cond = m > 0; vc = cond ? m : 0; }
      if (cond && !rs.cond) rs.starts.push(tau);
      rs.cond = cond; rs.branch = cond ? branch : 0; rs.vc = vc; rs.tau = tau;
      rs.iD = cond ? Math.max(0, vc / p.R + p.C * slope) : 0;
      rs.vin = src; rs.vout = sign * vc;
      rs.samples.push(rs.vout);
      // the textbook wave with no capacitor, for the dashed line
      var mi = p.full ? Math.abs(src) - 2 * p.Vk : sign * src - p.Vk;
      if (p.full && !(diodes[0] && diodes[2]) && src > 0) mi = -1;
      if (p.full && !(diodes[1] && diodes[3]) && src < 0) mi = -1;
      rs.idealOut = sign * Math.max(0, mi);
    }
    // measurements over the last whole input period
    function measure() {
      var p = rp(), n = Math.round(1 / p.f / (K.DT / SLOW / SUB));
      if (!rs || rs.samples.length < n * 1.25) return null;
      var s = rs.samples.slice(-n), mx = -Infinity, mn = Infinity, sum = 0;
      s.forEach(function (v) { if (v > mx) mx = v; if (v < mn) mn = v; sum += v; });
      var st = rs.starts.filter(function (t) { return t > 0.5 / p.f; }), fr = null;
      if (st.length >= 2) fr = (st.length - 1) / (st[st.length - 1] - st[0]);
      var peak = Math.abs(mx) >= Math.abs(mn) ? mx : mn;
      return { peak: peak, min: Math.abs(mx) >= Math.abs(mn) ? mn : mx, avg: sum / n, ripple: mx - mn, fr: fr };
    }
    function rectTheory() {
      var p = rp(), n = p.full ? 2 : 1, broken = p.full && !(diodes.every(Boolean));
      var halfOnly = !p.full || broken;
      var Vp = Math.max(0, p.Vm - n * p.Vk), fr = halfOnly ? p.f : 2 * p.f;
      var deadPair = p.full && !(diodes[0] && diodes[2]) && !(diodes[1] && diodes[3]);
      return {
        Vp: deadPair ? 0 : Vp, n: n, fr: fr, halfOnly: halfOnly,
        avg: deadPair ? 0 : (broken ? exactAvg(p.Vm, 2 * p.Vk, false) : exactAvg(p.Vm, n * p.Vk, p.full)),
        ripple: p.C > 0 ? Vp / (fr * p.R * p.C) : Vp
      };
    }

    /* ---------- reset + stepping ---------- */
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      solveJ();
      if (mode === "junction") { seedCarriers(); theoryJ(); }
      else { newRun(); rs.vin = 0; rs.vout = 0; rs.idealOut = 0; recordRect(); theoryR(); }
      P.time.textContent = mode === "rect" ? "τ = 0.0 ms of circuit time" : "t = 0.00 s";
      update(true);
    }
    function recordRect() {
      var r = rs.rec, t = rs.tau * 1000;
      r.t.push(t); r.vin.push(rs.vin); r.vout.push(rs.vout); r.ideal.push(rs.idealOut); r.iD.push(rs.iD * 1000);
    }

    sim.on("step", function () {
      if (mode === "junction") { stepJunction(); update(false); return; }
      if (!rs || rs.done) return;
      var p = rp(), dt = K.DT / SLOW / SUB;
      for (var k = 0; k < SUB; k++) stepRect(dt);
      recordRect();
      rs.phase += rs.iD * 1000 * 0.8;
      if (p.full && !diodes.every(Boolean)) { rs.openFor += dt * SUB; if (rs.openFor >= 2 / p.f) tries.mark("broken"); }
      if (rs.tau >= T_RECT - 1e-9) {
        rs.done = true; sim.pause(); transportUI.render();
        var m = measure();
        K.flash(P.note, m ? "Peak " + K.fmt(m.peak, 2) + " V, ripple " + K.fmt(m.ripple, 2) + " V" : "Done");
        if (m && p.full && p.C > 0 && diodes.every(Boolean) && Math.abs(m.peak) > 0 && m.ripple <= 0.1 * Math.abs(m.peak)) tries.mark("smooth");
      }
      update(rs.done);
    });

    /* ---------- direct manipulation ---------- */
    var DIODE_POS = [{ x: 350, y: 155 }, { x: 450, y: 155 }, { x: 450, y: 245 }, { x: 350, y: 245 }], HALF_POS = { x: 330, y: 70 };
    sim.pointer({
      down: function (p) {
        if (mode === "junction") { dragging = { x: p.px, vb: vbS.get() }; return; }
        if (rectType === "full") {
          for (var i = 0; i < 4; i++) if (Math.hypot(p.px - DIODE_POS[i].x, p.py - DIODE_POS[i].y) < 34) { toggleDiode(i); return; }
        } else if (Math.hypot(p.px - HALF_POS.x, p.py - HALF_POS.y) < 40) { toggleDiode(0); return; }
        return false;
      },
      drag: function (p) {
        if (!dragging) return;
        var v = Math.round(K.clamp(dragging.vb + (p.px - dragging.x) / 40, -15, 5) * 10) / 10;
        if (v !== vbS.get()) { vbS.set(v); onBias(); }
      },
      up: function () { dragging = null; },
      hover: function (p) {
        var hit = mode === "junction" ? p.py > 100 && p.py < 300 :
          rectType === "full" ? DIODE_POS.some(function (d) { return Math.hypot(p.px - d.x, p.py - d.y) < 34; }) : Math.hypot(p.px - HALF_POS.x, p.py - HALF_POS.y) < 40;
        P.canvas.style.cursor = hit ? (mode === "junction" ? "ew-resize" : "pointer") : "";
      }
    });
    function toggleDiode(i) {
      if (rectType === "full") {
        diodes[i] = !diodes[i];
        K.flash(P.note, "D" + (i + 1) + (diodes[i] ? " repaired" : " is open: no current through it"));
        if (rs && !diodes.every(Boolean)) rs.openFor = 0;
      } else {
        flipped = !flipped;
        K.flash(P.note, flipped ? "Diode reversed: now only the negative half gets through" : "Diode forward again");
      }
      if (rs && (rs.done || rs.tau === 0)) reset(); else update(true);
    }

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      if (mode === "junction") drawJunction(ctx); else drawRect(ctx);
    });
    function txt(ctx, s, x, y, color, size, align, weight) {
      ctx.fillStyle = color || th.ink; ctx.font = (weight || 700) + " " + (size || 13) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
    }
    function poly(ctx, pts, color, width) {
      ctx.strokeStyle = color; ctx.lineWidth = width || 2.5; ctx.lineJoin = "round"; ctx.beginPath();
      pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
    }
    // dots spaced along a polyline, offset by phase (px)
    function dots(ctx, pts, phase, color) {
      var segs = [], total = 0;
      for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
      ctx.fillStyle = color;
      var gap = 26, off = ((phase % gap) + gap) % gap;
      for (var d = off; d < total; d += gap) {
        var s = d, k = 0;
        while (k < segs.length && s > segs[k]) { s -= segs[k]; k++; }
        if (k >= segs.length) break;
        var f = s / segs[k], x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawJunction(ctx) {
      var w = halfW(), j = BAR.j, V = op.V, I = op.I, m = MAT[matKey], VB = vbS.get();
      // the circuit: battery on top, resistor, wires to both contacts
      var loop = [[370, 60], [120, 60], [120, 200], [BAR.x0 - 6, 200]], loop2 = [[BAR.x1 + 6, 200], [880, 200], [880, 60], [652, 60]];
      poly(ctx, loop, th.muted); poly(ctx, loop2, th.muted); poly(ctx, [[588, 60], [392, 60]], th.muted);
      // resistor zigzag
      var zz = [[588, 60]]; for (var z = 0; z < 8; z++) zz.push([596 + z * 7, z % 2 ? 50 : 70]); zz.push([652, 60]);
      poly(ctx, zz, th.ink, 2.5);
      txt(ctx, "R = " + (rS.get() >= 1000 ? K.fmt(rS.get() / 1000, 1) + " kΩ" : rS.get() + " Ω"), 620, 30, th.muted, 12);
      // battery: long plate is +. Forward bias puts + on the p side (left)
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(362, 30, 40, 60);
      var plusLeft = VB >= 0, lx = 372, sx = 392;
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx, plusLeft ? 36 : 48); ctx.lineTo(lx, plusLeft ? 84 : 72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, plusLeft ? 48 : 36); ctx.lineTo(sx, plusLeft ? 72 : 84); ctx.stroke();
      txt(ctx, plusLeft ? "+" : "−", lx - 12, 32, th.ink, 15); txt(ctx, plusLeft ? "−" : "+", sx + 12, 32, th.ink, 15);
      txt(ctx, "V_B = " + K.fmt(VB, 1) + " V", 412, 84, th.ink, 12, "left");
      // current dots: conventional current leaves the + terminal
      if (Math.abs(I) > 1e-9) {
        var path = [[372, 60], [120, 60], [120, 200], [BAR.x0 - 6, 200]], path2 = [[BAR.x1 + 6, 200], [880, 200], [880, 60], [392, 60]];
        dots(ctx, path, wire, th.acc); dots(ctx, path2, wire, th.acc);
        var right = I > 0;
        K.arrow(ctx, right ? 210 : 290, 112, right ? 290 : 210, 112, th.acc, { width: 3, label: "I = " + fI(I), lx: right ? 8 : -150 });
      }
      // p and n regions
      ctx.fillStyle = K.alpha(th.app, 0.12); ctx.fillRect(BAR.x0, BAR.y0, j - BAR.x0, BAR.y1 - BAR.y0);
      ctx.fillStyle = K.alpha(th.disp, 0.12); ctx.fillRect(j, BAR.y0, BAR.x1 - j, BAR.y1 - BAR.y0);
      ctx.fillStyle = th.muted; ctx.fillRect(BAR.x0 - 8, BAR.y0, 8, BAR.y1 - BAR.y0); ctx.fillRect(BAR.x1, BAR.y0, 8, BAR.y1 - BAR.y0);
      txt(ctx, "p", BAR.x0 + 24, BAR.y0 + 20, th.app, 20); txt(ctx, "n", BAR.x1 - 24, BAR.y0 + 20, th.disp, 20);
      // depletion region with its fixed ions: − acceptors on the p side, + donors on the n side
      ctx.fillStyle = K.alpha(th.grav, 0.12); ctx.fillRect(j - w, BAR.y0, 2 * w, BAR.y1 - BAR.y0);
      ctx.strokeStyle = th.grav; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(j - w, BAR.y0); ctx.lineTo(j - w, BAR.y1); ctx.moveTo(j + w, BAR.y0); ctx.lineTo(j + w, BAR.y1); ctx.stroke(); ctx.setLineDash([]);
      for (var gy = BAR.y0 + 14; gy < BAR.y1 - 6; gy += 22) {
        for (var gx = 9; gx < w; gx += 18) {
          txt(ctx, "−", j - gx, gy, K.alpha(th.app, 0.9), 14);
          txt(ctx, "+", j + gx, gy, K.alpha(th.disp, 0.9), 14);
        }
      }
      ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.strokeRect(BAR.x0, BAR.y0, BAR.x1 - BAR.x0, BAR.y1 - BAR.y0);
      if (w > 24) K.arrow(ctx, j + w * 0.6, BAR.y1 - 12, j - w * 0.6, BAR.y1 - 12, th.grav, { width: 2.5, label: "E", lx: -16, ly: -12 });
      txt(ctx, "depletion W = " + K.fmt(op.W, 2) + " W₀", j, BAR.y1 + 16, th.grav, 12);
      // carriers
      holes.forEach(function (c) {
        ctx.strokeStyle = th.app; ctx.lineWidth = 2;
        if (c.st === "pop") { ctx.globalAlpha = c.life / 14; ctx.beginPath(); ctx.arc(c.x, c.y, 9 - c.life / 2, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; return; }
        ctx.beginPath(); ctx.arc(c.x, c.y, 4.5, 0, Math.PI * 2); ctx.stroke();
      });
      elecs.forEach(function (c) {
        ctx.fillStyle = th.disp;
        if (c.st === "pop") { ctx.globalAlpha = c.life / 14; ctx.beginPath(); ctx.arc(c.x, c.y, 9 - c.life / 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return; }
        ctx.beginPath(); ctx.arc(c.x, c.y, 3.8, 0, Math.PI * 2); ctx.fill();
      });
      minor.forEach(function (c) {
        if (c.e) { ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(c.x, c.y, 2.6, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = th.app; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2); ctx.stroke(); }
      });
      // the potential hill electrons must climb to cross from n to p
      var base = 420, hgt = K.clamp(60 * (m.Vk - V) / m.Vk, 2, 110), barrier = Math.max(0, m.Vk - V);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5; ctx.beginPath();
      for (var x = BAR.x0; x <= BAR.x1; x += 4) {
        var s = x < j - w ? 0 : x > j + w ? 1 : (x - (j - w)) / (2 * w), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s);
        var y = base - hgt + e * hgt;               // electron energy: high on the p side, low on the n side
        if (x === BAR.x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      txt(ctx, "electron energy", BAR.x0, base + 22, th.muted, 11, "left", 600);
      txt(ctx, "barrier V₀ − V = " + K.fmt(barrier, 2) + " V", j, base - hgt - 14, th.ink, 12);
      var state = op.I <= -1e-3 && zener ? "Zener breakdown" : V > 0.02 ? "forward biased" : V < -0.02 ? "reverse biased" : "no bias";
      txt(ctx, state, 960, 20, op.I > 0 ? th.acc : th.grav, 13, "right");
      txt(ctx, "drag sideways to change V_B", 960, 440, th.muted, 11, "right", 600);
    }

    function drawDiode(ctx, x1, y1, x2, y2, on, open, label) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, a = Math.atan2(y2 - y1, x2 - x1), s = 13;
      var col = open ? th.fric : on ? th.acc : th.ink;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(a);
      ctx.strokeStyle = col; ctx.fillStyle = on ? K.alpha(th.acc, 0.35) : th["canvas-bg"]; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, 0); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s, -s); ctx.lineTo(s, s); ctx.stroke();
      if (open) { ctx.strokeStyle = th.fric; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(8, 18); ctx.moveTo(8, -18); ctx.lineTo(-8, 18); ctx.stroke(); }
      ctx.restore();
      if (label) txt(ctx, label, mx + (label.x || 0), my, col, 12);
    }
    function drawRect(ctx) {
      var p = rp(), on = rs ? rs.branch : 0, src = rs ? rs.vin : 0, vout = rs ? rs.vout : 0;
      // AC source
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(110, 260, 32, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); for (var k = 0; k <= 30; k++) { var xx = 92 + k * 1.2, yy = 260 - 10 * Math.sin(k / 30 * 2 * Math.PI); if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke();
      txt(ctx, "v_s = " + K.fmt(src, 1) + " V", 152, 252, th.disp, 12, "left");
      txt(ctx, K.fmt(p.Vm, 1) + " V, " + p.f + " Hz", 152, 270, th.muted, 11, "left", 600);
      var top = 70, bot = 390, xR = 720, xC = 840, path;
      if (p.full) {
        var Lp = [300, 200], Tp = [400, 110], Rp = [500, 200], Bp = [400, 290];
        poly(ctx, [[110, 228], [110, 200], Lp], th.muted);
        poly(ctx, [[110, 292], [110, 430], [540, 430], [540, 200], Rp], th.muted);
        poly(ctx, [Tp, [400, top], [xC, top]], th.muted);
        poly(ctx, [Bp, [400, bot], [530, bot]], th.muted); poly(ctx, [[550, bot], [xC, bot]], th.muted);
        ctx.strokeStyle = th.muted; ctx.beginPath(); ctx.arc(540, bot, 10, Math.PI, 0); ctx.stroke();      // wire hop
        poly(ctx, [Lp, Tp], th.muted, 2); poly(ctx, [Rp, Tp], th.muted, 2); poly(ctx, [Bp, Rp], th.muted, 2); poly(ctx, [Bp, Lp], th.muted, 2);
        // D1: L→T, D2: R→T, D3: B→R, D4: B→L (anode → cathode)
        var D = [[Lp, Tp], [Rp, Tp], [Bp, Rp], [Bp, Lp]], lit = [on === 1, on === -1, on === 1, on === -1];
        D.forEach(function (d, i) {
          drawDiode(ctx, d[0][0] + (d[1][0] - d[0][0]) * 0.3, d[0][1] + (d[1][1] - d[0][1]) * 0.3, d[0][0] + (d[1][0] - d[0][0]) * 0.7, d[0][1] + (d[1][1] - d[0][1]) * 0.7, lit[i], !diodes[i]);
          var c = DIODE_POS[i]; txt(ctx, "D" + (i + 1), c.x + (i === 0 || i === 3 ? -34 : 34), c.y, diodes[i] ? th.muted : th.fric, 12);
        });
        var load = [Tp, [400, top], [xR, top], [xR, bot], [400, bot], Bp];
        if (on === 1) path = [[110, 228], [110, 200], Lp, Tp].concat(load.slice(1)).concat([Rp, [540, 200], [540, 430], [110, 430], [110, 292]]);
        if (on === -1) path = [[110, 292], [110, 430], [540, 430], [540, 200], Rp, Tp].concat(load.slice(1)).concat([Lp, [110, 200], [110, 228]]);
      } else {
        poly(ctx, [[110, 228], [110, top], [xC, top]], th.muted);
        poly(ctx, [[110, 292], [110, bot], [xC, bot]], th.muted);
        if (flipped) drawDiode(ctx, 350, top, 310, top, on !== 0, false); else drawDiode(ctx, 310, top, 350, top, on !== 0, false);
        txt(ctx, "D", 330, top - 28, th.muted, 12);
        var hp = [[110, 228], [110, top], [xR, top], [xR, bot], [110, bot], [110, 292]];
        if (on) path = on > 0 ? hp : hp.slice().reverse();
      }
      // load resistor and capacitor
      var zz = [[xR, top], [xR, 180]]; for (var z = 0; z < 8; z++) zz.push([z % 2 ? xR - 10 : xR + 10, 188 + z * 11]); zz.push([xR, 280], [xR, bot]);
      poly(ctx, zz, th.ink, 2.5);
      txt(ctx, "R_L", xR + 34, 230, th.muted, 12);
      if (p.C > 0) {
        poly(ctx, [[xC, top], [xC, 222]], th.muted); poly(ctx, [[xC, 238], [xC, bot]], th.muted);
        ctx.strokeStyle = th.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xC - 22, 222); ctx.lineTo(xC + 22, 222); ctx.moveTo(xC - 22, 238); ctx.lineTo(xC + 22, 238); ctx.stroke();
        txt(ctx, "C", xC + 40, 230, th.muted, 12);
      } else poly(ctx, [[xR, top], [xR, top]], th.muted);
      txt(ctx, "+", 930, top + 8, th.ink, 16); txt(ctx, "−", 930, bot - 8, th.ink, 16);
      txt(ctx, "v_out", 930, 220, th.vel, 13); txt(ctx, K.fmt(vout, 2) + " V", 930, 240, th.vel, 13);
      if (path && rs) dots(ctx, path, rs.phase, th.acc);
      txt(ctx, rs && rs.cond ? "conducting: " + (p.full ? (on === 1 ? "D1 + D3" : "D2 + D4") : "D") : "diodes off: " + (p.C > 0 ? "C feeds the load" : "no current"), 600, 20, rs && rs.cond ? th.acc : th.muted, 13);
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML = '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>';
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".graph-cap");
    var g1 = xyGraph(cv[0], { yLabel: "I (mA)", xLabel: "V (V)", xMin: -2, xMax: 1, color: th.acc });
    var g2 = xyGraph(cv[1], { yLabel: "W / W₀", xLabel: "V (V)", xMin: -2, xMax: 1, yMin: 0, color: th.grav });
    var g3 = xyGraph(cv[2], { yLabel: "ln(I/Is + 1)", xLabel: "V (V)", xMin: 0, xMax: 1, yMin: 0, color: th.acc });
    var graphs = [g1, g2, g3];
    function setCaps(list) { list.forEach(function (c, i) { caps[i].innerHTML = K.md(c); }); }

    function vRange() {
      var m = MAT[matKey], lo = zener ? -(vzS.get() + 1.5) : -2;
      lo = Math.min(lo, Math.floor(op.V) - 0.5);
      return { lo: Math.max(-15.5, lo), hi: m.Vk + 0.25 };
    }
    function theoryJ() {
      var d = dev(), m = d.m, r = vRange(), Imax = Math.max(0.02, Math.abs(op.I) * 1.4), curve = [], wC = [], lnC = [], load = [];
      [g1, g2].forEach(function (g) { g.clear(); g.o.xMin = r.lo; g.o.xMax = r.hi; });
      g3.clear(); g3.o.xMin = 0; g3.o.xMax = r.hi;
      var brk = false;
      for (var i = 0; i <= 400; i++) {
        var V = r.lo + (r.hi - r.lo) * i / 400, I = diodeI(V, d);
        if (Math.abs(I) <= Imax) { curve.push([V, I * 1000, brk]); brk = false; } else brk = true;
        if (V <= m.Vk) wC.push([V, wRel(V)]);
        if (V >= 0) lnC.push([V, V / (m.eta * VT)]);
        var IL = (vbS.get() - V) / rS.get();
        if (Math.abs(IL) <= Imax) load.push([V, IL * 1000]);
      }
      g1.set("theory", { points: curve, color: th.acc, dash: [5, 5], width: 1.5 });
      g1.set("load", { points: load, color: th.muted, dash: [2, 4], width: 1.5 });
      g2.set("theory", { points: wC, color: th.grav, dash: [5, 5], width: 1.5 });
      g3.set("theory", { points: lnC, color: th.acc, dash: [5, 5], width: 1.5 });
    }
    function theoryR() {
      graphs.forEach(function (g) { g.clear(); g.o.xMin = 0; g.o.xMax = T_RECT * 1000; g.o.xLabel = "t (ms)"; });
      var p = rp(), pts = [], idl = [];
      for (var i = 0; i <= 400; i++) { var t = T_RECT * i / 400; pts.push([t * 1000, p.Vm * Math.sin(2 * Math.PI * p.f * t)]); }
      g1.set("theory", { points: pts, color: th.disp, dash: [5, 5], width: 1.5 });
      void idl;
    }

    /* ---------- maths + readouts ---------- */
    var eqEls = [], setR = function () {};
    function buildPanels() {
      var labels = mode === "junction" ?
        ["Shockley diode equation", "Kirchhoff round the loop", "Depletion width", "Dynamic resistance (JEE twist)"] :
        ["Peak output", "Average (DC) output", "Ripple frequency", "Ripple with a capacitor"];
      P.eqs.innerHTML = labels.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = mode === "junction" ? K.readout(P.readouts, [
        { id: "vd", label: "diode voltage V_D" }, { id: "i", label: "current I", cls: "c-acc" }, { id: "knee", label: "knee-model estimate", cls: "c-acc" },
        { id: "w", label: "depletion width", cls: "c-grav" }, { id: "rd", label: "dynamic r_d = ΔV/ΔI" }, { id: "rs", label: "static V/I" }
      ]) : K.readout(P.readouts, [
        { id: "peak", label: "peak output", cls: "c-vel" }, { id: "avg", label: "average (DC) output", cls: "c-vel" }, { id: "fr", label: "ripple frequency" },
        { id: "rip", label: "ripple (peak to peak)" }, { id: "now", label: "v_in now", cls: "c-disp" }, { id: "cond", label: "conducting", cls: "c-acc" }
      ]);
      if (mode === "junction") {
        setCaps(["<b class=\"c-acc\">I–V characteristic</b> · dashed: Shockley curve, dotted: load line, solid: where you've been",
          "<b class=\"c-grav\">depletion width vs V</b> · $W \\propto \\sqrt{V_0 - V}$: reverse bias widens it",
          "<b class=\"c-acc\">ln(I/I_s + 1) vs V</b> · a straight line of slope $1/\\eta V_T$: the current is exponential"]);
        g1.o.yLabel = "I (mA)"; g2.o.yLabel = "W / W₀"; g3.o.yLabel = "ln(I/Is + 1)";
        g1.o.color = th.acc; g2.o.color = th.grav; g3.o.color = th.acc;
        [g1, g2, g3].forEach(function (g) { g.o.xLabel = "V (V)"; g.o.yMin = g === g1 ? undefined : 0; });
      } else {
        setCaps(["<b class=\"c-disp\">input v_s</b> · the AC from the transformer",
          "<b class=\"c-vel\">output v_out</b> · solid: simulated, dashed: rectified wave with no capacitor",
          "<b class=\"c-acc\">diode current</b> · with a capacitor it flows only in short, tall bursts near each peak"]);
        g1.o.yLabel = "v_s (V)"; g2.o.yLabel = "v_out (V)"; g3.o.yLabel = "i_D (mA)";
        g1.o.color = th.disp; g2.o.color = th.vel; g3.o.color = th.acc;
        g1.o.yMin = undefined; g2.o.yMin = 0; g3.o.yMin = 0;
      }
    }

    var slowMaths = K.throttle(function () { renderMaths(); }, 120);
    function update(force) {
      if (mode === "junction") {
        var V = op.V;
        g1.set("sim", { points: history.map(function (h) { return [h[0], h[1] * 1000, true]; }).concat([]), color: th.acc, width: 0.01 });
        g1.set("trace", { points: history.map(function (h, i) { return [h[0], h[1] * 1000, i === 0]; }), color: th.acc, width: 2.5 });
        g1.set("dot", { points: [[V, op.I * 1000]], color: th.acc, dot: true });
        g2.set("trace", { points: history.filter(function (h) { return h[0] <= MAT[matKey].Vk; }).map(function (h) { return [h[0], wRel(h[0])]; }), color: th.grav, width: 2.5 });
        g2.set("dot", { points: [[V, wRel(V)]], color: th.grav, dot: true });
        var fw = history.filter(function (h) { return h[0] >= 0 && h[1] > -MAT[matKey].Is; });
        g3.set("trace", { points: fw.map(function (h) { return [h[0], Math.log(h[1] / MAT[matKey].Is + 1)]; }), color: th.acc, width: 2.5 });
        if (V >= 0) g3.set("dot", { points: [[V, Math.log(Math.max(op.I, 0) / MAT[matKey].Is + 1)]], color: th.acc, dot: true }); else g3.set("dot", { points: [] });
        delete g1.series.sim;
        P.hud.innerHTML = "<span>V_D = " + K.fmt(V, 3) + " V</span><span class=\"c-acc\">I = " + fI(op.I) + "</span>";
      } else if (rs) {
        var r = rs.rec;
        g1.set("sim", { points: r.t.map(function (t, i) { return [t, r.vin[i]]; }), color: th.disp, width: 2.5, dot: true });
        g2.set("ideal", { points: r.t.map(function (t, i) { return [t, r.ideal[i]]; }), color: th.vel, dash: [5, 5], width: 1.5 });
        g2.set("sim", { points: r.t.map(function (t, i) { return [t, r.vout[i]]; }), color: th.vel, width: 2.5, dot: true });
        g3.set("sim", { points: r.t.map(function (t, i) { return [t, r.iD[i]]; }), color: th.acc, width: 2.5, dot: true });
        g2.o.yMin = Math.min(0, -rp().Vm * (flipped && rectType === "half" ? 1 : 0));
        P.hud.innerHTML = "<span class=\"c-disp\">v_s = " + K.fmt(rs.vin, 2) + " V</span><span class=\"c-vel\">v_out = " + K.fmt(rs.vout, 2) + " V</span>";
        P.time.textContent = "τ = " + K.fmt(rs.tau * 1000, 1) + " ms of circuit time (" + SLOW + "× slow)";
      }
      graphs.forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      if (mode === "junction") {
        var d = dev(), m = d.m, V = op.V, I = op.I, VB = vbS.get(), R = rS.get();
        var Ishock = diodeI(V, d), knee = (VB - m.Vk) / R;
        K.tex(eqEls[0], "I = I_s\\left(e^{V/\\eta V_T} - 1\\right) = (" + K.fmt(m.Is * 1e9, 0) + "\\,\\text{nA})\\left(e^{" + n(V, 3) + "/(" + m.eta + "\\times 0.02585)} - 1\\right)" +
          (zener ? " - I_{Z}" : "") + " = \\mathbf{" + fIt(Ishock) + "}");
        K.tex(eqEls[1], "I = \\frac{V_B - V_D}{R} = \\frac{" + K.fmt(VB, 1) + " - " + n(V, 3) + "}{" + R + "} = \\mathbf{" + fIt(I) + "}" +
          (VB > m.Vk ? "\\quad\\text{knee model: } \\frac{V_B - " + m.Vk + "}{R} = " + fIt(knee) : ""));
        K.tex(eqEls[2], "\\frac{W}{W_0} = \\sqrt{1 - \\frac{V}{V_0}} = \\sqrt{1 - \\frac{" + n(V, 3) + "}{" + m.Vk + "}} = \\mathbf{" + (V < m.Vk ? K.fmt(op.W, 2) : "0\\ (\\text{barrier flattened})") + "}");
        K.tex(eqEls[3], I > 0 ? "r_d = \\frac{dV}{dI} = \\frac{\\eta V_T}{I + I_s} = \\frac{" + m.eta + "\\times 25.85\\,\\text{mV}}{" + fIt(I + m.Is) + "} = \\mathbf{" + fR(m.eta * VT / (I + m.Is)).replace("Ω", "\\Omega").replace(/ (k|M|G)?\\Omega/, "\\ \\text{$1}\\Omega") + "}"
          : "r_d = \\left(\\frac{dI}{dV}\\right)^{-1} = \\mathbf{" + fR(op.rdExact).replace(/ ?(k|M|G|T)?Ω/, "\\ \\text{$1}\\Omega").replace(">", "\\gt") + "}\\ \\text{(reverse: almost no current change)}");
        setR("vd", K.fmt(V, 3) + " V", V > 0.02 ? "forward" : V < -0.02 ? "reverse" : "zero bias");
        setR("i", fI(I), "Shockley gives " + fI(Ishock));
        setR("knee", VB > m.Vk ? fI(knee) : "0", "(V_B − " + m.Vk + " V)/R");
        setR("w", K.fmt(op.W, 2) + " W₀", "barrier " + K.fmt(Math.max(0, m.Vk - V), 2) + " V");
        setR("rd", fR(op.rdSim), I > 0 ? "ηV_T/I = " + fR(m.eta * VT / (I + m.Is)) : "1/(dI/dV) = " + fR(op.rdExact));
        setR("rs", Math.abs(I) > 1e-12 ? fR(V / I) : "—", "not r_d!");
      } else {
        var p = rp(), t = rectTheory(), ms = measure(), nk = p.full ? 2 : 1;
        K.tex(eqEls[0], "V_p = V_m - " + (nk === 2 ? "2" : "") + "V_k = " + K.fmt(p.Vm, 1) + " - " + (nk === 2 ? "2(" + K.fmt(p.Vk, 1) + ")" : K.fmt(p.Vk, 1)) + " = \\mathbf{" + K.fmt(t.Vp, 2) + "}\\ \\text{V}" +
          (p.full ? "\\quad(\\text{two diodes in each path})" : ""));
        K.tex(eqEls[1], (t.halfOnly ? "V_{dc} \\approx \\frac{V_p}{\\pi} = \\frac{" + K.fmt(t.Vp, 2) + "}{\\pi}" : "V_{dc} \\approx \\frac{2V_p}{\\pi} = \\frac{2(" + K.fmt(t.Vp, 2) + ")}{\\pi}") +
          " = \\mathbf{" + K.fmt((t.halfOnly ? 1 : 2) * t.Vp / Math.PI, 2) + "}\\ \\text{V}\\quad(\\text{no } C" + (p.Vk ? ",\\ \\text{exact } " + K.fmt(t.avg, 2) : "") + ")");
        K.tex(eqEls[2], "f_r = " + (t.halfOnly ? "f = " : "2f = 2\\times ") + p.f + " = \\mathbf{" + t.fr + "}\\ \\text{Hz}");
        K.tex(eqEls[3], p.C > 0 ? "V_r \\approx \\frac{V_p}{f_r R C} = \\frac{" + K.fmt(t.Vp, 2) + "}{" + t.fr + "\\times " + p.R + "\\times " + K.fmt(p.C * 1e6, 0) + "\\times10^{-6}} = \\mathbf{" + K.fmt(t.ripple, 3) + "}\\ \\text{V}"
          : "\\text{no capacitor: the output falls to 0 every cycle, } V_r = V_p = \\mathbf{" + K.fmt(t.Vp, 2) + "}\\ \\text{V}");
        setR("peak", ms ? K.fmt(Math.abs(ms.peak), 2) + " V" : "—", "formula " + K.fmt(t.Vp, 2) + " V");
        setR("avg", ms ? K.fmt(Math.abs(ms.avg), 2) + " V" : "—", p.C > 0 ? "smoothed" : "exact " + K.fmt(t.avg, 2) + " V");
        setR("fr", ms && ms.fr ? K.fmt(ms.fr, 0) + " Hz" : "—", "formula " + t.fr + " Hz");
        setR("rip", ms ? K.fmt(ms.ripple, 3) + " V" : "—", "formula " + (p.C > 0 ? "≈ " : "") + K.fmt(t.ripple, 3) + " V");
        setR("now", K.fmt(rs ? rs.vin : 0, 2) + " V", "");
        setR("cond", rs && rs.cond ? (p.full ? (rs.branch > 0 ? "D1, D3" : "D2, D4") : "D") : "none", "");
      }
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Dope silicon with boron and it gets spare <b class=\"c-app\">holes</b> (p-type); dope it with phosphorus and it gets spare <b class=\"c-disp\">electrons</b> (n-type). Put them together and carriers diffuse across and cancel, leaving a <b class=\"c-grav\">depletion region</b> of fixed ions. Its field builds a barrier of about $V_0 = 0.7$ V (Si) or $0.3$ V (Ge) that stops further diffusion.</p>" +
      "<p><b>Forward bias</b> lowers the barrier and the current grows exponentially: $I = I_s(e^{V/\\eta V_T} - 1)$ with $V_T = kT/q \\approx 25.85$ mV. That's why the I–V curve has a <b>knee</b>: below it almost nothing flows, above it a tiny extra voltage gives a lot more current. <b>Reverse bias</b> raises the barrier and widens the depletion region, and only the tiny saturation current $I_s$ leaks through, until <b>breakdown</b>.</p>" +
      "<p>A diode passes one half of an AC wave (<b>half-wave</b>). A bridge of four flips the other half too (<b>full-wave</b>), doubling the ripple frequency to $2f$. A capacitor across the load fills in the gaps, leaving a ripple $V_r \\approx V_p/(f_r R C)$.</p>" +
      '<div class="trap"><b>JEE trap: dynamic resistance is ΔV/ΔI, not V/I.</b> At 4.3 mA a silicon diode has $V/I \\approx 155\\ \\Omega$, but a small change in voltage sees only $r_d = \\eta V_T / I \\approx 12\\ \\Omega$. ' +
      "Questions on small AC signals riding on a DC bias always want $r_d$, the slope of the I–V curve at the operating point.</div>");

    function apply(s) {
      setSeg("mode", s.mode);
      if (s.mat) setSeg("mat", s.mat);
      if (s.mode === "junction") {
        setCheck(zCheck, !!s.zener);
        if (s.Vz) vzS.set(s.Vz);
        vbS.set(s.VB); rS.set(s.R);
      } else {
        setSeg("rect", s.rect);
        vmS.set(s.Vm); fS.set(s.f); rlS.set(s.RL);
        setCheck(idealCheck, !!s.ideal);
        setCheck(capCheck, !!s.C);
        if (s.C) cS.set(s.C);
        diodes = [true, true, true, true]; flipped = false;
      }
      history = [];
      reset();
    }
    var Q = [
      { level: "easy", tag: "knee model", setup: { mode: "junction", mat: "si", VB: 5, R: 1000, zener: false }, watch: "Compare your answer with the current readout",
        q: "A silicon diode (knee voltage 0.7 V) is forward-biased by a 5 V battery through a 1 kΩ resistor. About how much current flows?",
        options: ["5.0 mA", "4.3 mA", "5.7 mA", "0.7 mA"], answer: 1,
        explain: "Take 0.7 V across the diode: the resistor gets $5 - 0.7 = 4.3$ V, so $I = 4.3/1000 = 4.3$ mA. The full Shockley equation gives 4.33 mA, so the knee model is very good." },
      { level: "medium", tag: "bridge rectifier", setup: { mode: "rect", mat: "si", rect: "full", Vm: 12, f: 50, RL: 1, C: 0, ideal: false }, watch: "Press Play and read the peak output and ripple frequency",
        q: "A bridge rectifier with silicon diodes (0.7 V each) is fed 50 Hz AC of peak 12 V. What are the peak output voltage and the frequency of the output ripple?",
        options: ["11.3 V, 50 Hz", "10.6 V, 100 Hz", "10.6 V, 50 Hz", "12 V, 100 Hz"], answer: 1,
        hints: ["Trace one half-cycle through the bridge: how many diodes does the current pass through?", "Both halves now push current the same way through the load. How many output humps per input cycle?"],
        explain: "Two diodes conduct in series on each half-cycle, so $V_p = 12 - 2(0.7) = 10.6$ V. Both halves give a hump, so the output repeats at $2f = 100$ Hz. 11.3 V is the half-wave peak." },
      { level: "hard", tag: "filter capacitor", setup: { mode: "rect", rect: "full", Vm: 20, f: 50, RL: 1, C: 200, ideal: true }, watch: "Press Play and read the ripple after the first cycle",
        q: "A full-wave rectifier with ideal diodes gives a 20 V peak at 50 Hz mains into a 1 kΩ load. What is the smallest capacitor across the load that keeps the peak-to-peak ripple at or below 1 V?",
        options: ["100 µF", "200 µF", "400 µF", "20 µF"], answer: 1,
        hints: ["Between peaks the capacitor discharges through $R$ at about $I = V_p/R$, for a time of one ripple period $1/f_r$.", "$V_r \\approx \\dfrac{I}{f_r C} = \\dfrac{V_p}{f_r R C}$, and full-wave means $f_r = 100$ Hz."],
        explain: "$C = \\dfrac{V_p}{f_r R V_r} = \\dfrac{20}{100 \\times 1000 \\times 1} = 200\\ \\mu$F. 100 µF uses $f_r = 50$ Hz (half-wave thinking) and doubles the ripple. The lab shows about 0.88 V, just under 1 V: the formula assumes the capacitor discharges for the whole 10 ms, but the rising input catches it a little early, so the estimate errs on the safe side." }
    ];
    K.practice(P.quiz, Q, apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { onReset: reset, onPlay: function () { if (mode === "rect" && rs && rs.done) reset(); } });
    sim.on("step", function () { if (mode === "rect" && rs) P.time.textContent = "τ = " + K.fmt(rs.tau * 1000, 1) + " ms of circuit time (" + SLOW + "× slow)"; });
    layoutMode();
    reset();
    sim.play(); transportUI.render();             // the junction is alive from the start

    if (location.hostname === "localhost") {
      window.__lab_diode = {
        apply: apply, questions: Q, operate: operate, diodeI: diodeI, exactAvg: exactAvg, MAT: MAT, VT: VT,
        toggleDiode: toggleDiode, setSeg: setSeg,
        state: function () { return { mode: mode, op: op, rs: rs, m: rs ? measure() : null, t: mode === "rect" ? rectTheory() : null, wRel: op ? op.W : null, dev: dev() }; },
        bias: function (vb) { vbS.set(vb); onBias(); },
        steps: function (n) { for (var i = 0; i < n; i++) sim.stepOnce(); },
        runRect: function () { reset(); var guard = 0; while (!rs.done && guard++ < 5000) sim.stepOnce(); return measure(); }
      };
    }

    return function destroy() { sim.destroy(); graphs.forEach(function (g) { g.destroy(); }); if (window.__lab_diode) delete window.__lab_diode; };
  }
})();
