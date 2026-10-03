/* Dual nature, lab 1: the photoelectric effect. Light of one colour on a metal plate, a collector at a voltage you set,
   and an ensemble of photoelectrons that either make it across the gap or get turned back. */
(function () {
  "use strict";
  var H_PL = 6.626e-34, E_CH = 1.602e-19, HC = 1240;   // J s, C, eV nm
  var H_E = H_PL / E_CH;                               // h/e = 4.136e-15 V s
  var C = HC * 1e-9 / H_E;                             // 2.998e8 m/s: the c that makes hc = 1240 eV nm with this h and e
  var M_E = 9.109e-31;                                 // kg
  var QE = 0.01;                                       // 1 photon in 100 frees an electron
  var N_ENS = 10000;                                   // electrons in the measuring ensemble
  var LMIN = 150, LMAX = 700, VMIN = -7, VMAX = 5, PMAX = 5;
  var KV = 0.25;                                       // animation: gap lengths/s² per volt (½v² = KV·KE in eV)
  var METALS = [
    { id: "Cs", name: "Caesium", phi: 2.14 }, { id: "K", name: "Potassium", phi: 2.30 }, { id: "Na", name: "Sodium", phi: 2.75 },
    { id: "Zn", name: "Zinc", phi: 4.30 }, { id: "Cu", name: "Copper", phi: 4.65 }, { id: "Pt", name: "Platinum", phi: 5.65 },
    { id: "X", name: "Metal X", phi: 3.20, hidden: true }
  ];

  var lab = {
    id: "photoelectric", chapter: "dual", title: "Photoelectric effect", short: "photons, threshold, stopping potential",
    lede: "Shine light on a metal and electrons fly off, but only if each photon carries enough energy. Change the colour, the brightness and the collector voltage, and find out which one controls what.",
    tries: [
      { id: "dark", title: "Make it bright but useless",
        text: "Pick light below the metal's threshold, turn the intensity up to at least 4 mW and let it shine for a moment.",
        why: "Each electron is freed by one photon. If $hf \\lt \\phi$ no single photon can do it, and adding more of them doesn't help: no electrons, however bright." },
      { id: "stop", title: "Stop every electron",
        text: "With electrons flying, make the collector negative enough that the current drops to zero.",
        why: "A retarding voltage $V$ takes $eV$ of kinetic energy from each electron. Once $eV \\ge KE_{max}$ even the fastest one turns back, so the current is zero from $V = -V_0$ downwards." },
      { id: "bright", title: "Double the light, same $V_0$",
        text: "Measure $V_0$, then measure it again at the same wavelength with at least twice the intensity.",
        why: "More intensity means more photons per second, so more electrons and a bigger saturation current. Each photon still has the same $hf$, so $KE_{max}$ and $V_0$ don't move." },
      { id: "planck", title: "Measure Planck's constant",
        text: "For one metal, measure $V_0$ at three or more different frequencies and read $h$ from the slope.",
        why: "$V_0 = \\frac{h}{e}f - \\frac{\\phi}{e}$ is a straight line. Its slope is $h/e$ for every metal, and it crosses the $f$ axis at the threshold $f_0 = \\phi/h$. Millikan did exactly this in 1916." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  // spectral colour for a wavelength in nm (null for ultraviolet)
  function specColor(l) {
    if (l < 380) return null;
    var r = 0, g = 0, b = 0;
    if (l < 440) { r = (440 - l) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; }
    else if (l < 510) { g = 1; b = (510 - l) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; }
    else if (l < 645) { r = 1; g = (645 - l) / 65; } else { r = 1; }
    var f = l < 420 ? 0.4 + 0.6 * (l - 380) / 40 : 1;
    return "rgb(" + Math.round(255 * r * f) + "," + Math.round(255 * g * f) + "," + Math.round(255 * b * f) + ")";
  }
  // 6.63e-34 -> "6.63 \times 10^{-34}" (tex) or "6.63×10⁻³⁴" (text)
  function sciParts(x, d) {
    if (!x) return { m: (0).toFixed(d), e: 0 };
    var e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e);
    if (Math.abs(+m.toFixed(d)) >= 10) { m /= 10; e++; }
    return { m: m.toFixed(d), e: e };
  }
  function texSci(x, d) { var s = sciParts(x, d); return s.m + "\\times10^{" + s.e + "}"; }
  var SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function txtSci(x, d) { var s = sciParts(x, d); return s.m + "×10" + String(s.e).split("").map(function (c) { return SUP[c]; }).join(""); }

  // A K.Graph whose x axis starts at xMin instead of 0 (the I–V curve needs negative voltages).
  function rangedGraph(canvas, o) {
    var g = new K.Graph(canvas, o), th = K.theme, fmt = K.fmt;
    function niceStep(range, target) {
      var raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
      return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
    }
    g.draw = function () {
      if (!this.dirty) return;
      this.dirty = false;
      var ctx = this.ctx, w = this.w, h = this.h, self = this, xMin = o.xMin, xMax = o.xMax;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var L = 44, R = 10, T = 12, B = 26, yMin = 0, yMax = 0;
      Object.keys(this.series).forEach(function (k) { self.series[k].points.forEach(function (p) { if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1]; }); });
      if (o.yMax !== undefined) yMax = Math.max(yMax, o.yMax);
      if (yMax - yMin < 1e-9) { yMax += 1; }
      yMax += (yMax - yMin) * 0.08;
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
      var xs = niceStep(xMax - xMin, 6);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var t = Math.ceil(xMin / xs) * xs; t <= xMax + 1e-9; t += xs) {
        ctx.strokeStyle = Math.abs(t) < 1e-9 ? th["grid-strong"] : th.grid;
        ctx.beginPath(); ctx.moveTo(X(t), T); ctx.lineTo(X(t), h - B); ctx.stroke();
        ctx.fillText(fmt(t, xs < 1 ? 1 : 0), X(t), h - B + 5);
      }
      ctx.strokeStyle = th["grid-strong"];
      ctx.beginPath(); ctx.moveTo(L, h - B); ctx.lineTo(w - R, h - B); ctx.stroke();
      ctx.save(); ctx.translate(11, (T + h - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = o.color || th.ink; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.fillText(o.yLabel, 0, 0); ctx.restore();
      ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillStyle = th.muted; ctx.fillText(o.xLabel, w - R, h - B - 2);
      Object.keys(this.series).forEach(function (k) {
        var s = self.series[k], pts = s.points;
        if (!pts.length) return;
        ctx.save(); ctx.beginPath(); ctx.rect(L, T - 2, w - L - R, h - T - B + 4); ctx.clip();
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.lineJoin = "round";
        if (s.dash) ctx.setLineDash(s.dash);
        ctx.beginPath();
        pts.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
        ctx.stroke(); ctx.restore();
      });
      if (this.extra) this.extra(ctx, X, Y);
    };
    g.dirty = true; g.draw();
    return g;
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 480;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- state + physics ---------- */
    var st = { lam: 400, P: 2, V: 0, metal: METALS[2] };
    function photonE(lam) { return HC / lam; }                       // eV
    function freq(lam) { return C / (lam * 1e-9); }                  // Hz
    function solve() {
      var E = photonE(st.lam), ke = E - st.metal.phi, f = freq(st.lam);
      return { E: E, f: f, ke: ke, V0: Math.max(ke, 0), Isat: ke > 0 ? QE * st.P * 1e3 / E : 0,   // μA
        rate: st.P * 1e-3 / (E * E_CH), f0: st.metal.phi / H_E, lam0: HC / st.metal.phi,
        vmax: ke > 0 ? Math.sqrt(2 * ke * E_CH / M_E) : 0 };
    }
    // formula: KE fractions q have P(q > x) = 1 - x², so the retarding current falls as 1 - (|V|/V0)²
    function formulaI(V, s) {
      if (s.ke <= 0) return 0;
      if (V >= 0) return s.Isat;
      var x = -V / s.ke;
      return x < 1 ? s.Isat * (1 - x * x) : 0;
    }
    // the measurement: count which of the ensemble's electrons get across. Electron k leaves with KE = √(k/N)·KEmax
    // (the ones from deeper in the metal lose energy on the way out); it arrives if its KE beats the barrier e|V|.
    var Q = []; for (var k = 0; k <= N_ENS; k++) Q.push(Math.sqrt(k / N_ENS));
    function measuredI(V, s) {
      if (s.ke <= 0 || st.P <= 0) return 0;
      if (V >= 0) return s.Isat;
      var n = 0, x = -V;
      for (var i = 0; i <= N_ENS; i++) if (Q[i] * s.ke > x) n++;
      return s.Isat * n / (N_ENS + 1);
    }

    /* ---------- controls ---------- */
    var lamS = K.slider({ label: "Wavelength $\\lambda$", unit: "nm", min: LMIN, max: LMAX, step: 1, value: st.lam, digits: 0,
      onInput: function (v) { st.lam = v; fS.set(freq(v) / 1e14); changed(); }, hint: "Below 380 nm it's ultraviolet: invisible, but the metal still feels it." });
    var fS = K.slider({ label: "or frequency $f$", unit: "×10¹⁴ Hz", min: 4.3, max: 19.98, step: 0.01, value: freq(st.lam) / 1e14,
      onInput: function (v) { st.lam = C / (v * 1e14) * 1e9; lamS.set(Math.round(st.lam)); changed(); } });
    var pS = K.slider({ label: "Intensity (light power)", unit: "mW", min: 0, max: PMAX, step: 0.1, value: st.P,
      onInput: function (v) { st.P = v; changed(); }, hint: "More power at one colour means more photons per second." });
    var vS = K.slider({ label: "Collector voltage $V$", unit: "V", min: VMIN, max: VMAX, step: 0.01, value: st.V,
      onInput: function (v) { st.V = v; }, hint: "Negative means the collector repels electrons. You can also drag the knob under the tube." });
    P.controls.innerHTML = "<h3>The metal</h3>";
    var metalSeg = K.seg(METALS.map(function (m) { return { label: m.id, value: m.id }; }), st.metal.id, function (v) {
      st.metal = METALS.filter(function (m) { return m.id === v; })[0]; changed();
    }, "Metal");
    P.controls.appendChild(metalSeg);
    P.controls.appendChild(K.h("<h3>The light</h3>"));
    [lamS, fS, pS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>The circuit</h3>"));
    P.controls.appendChild(vS.el);
    var row = K.h('<div class="row"></div>');
    var measureBtn = K.h('<button class="btn btn-sm btn-primary" type="button">Measure V₀</button>');
    var clearBtn = K.h('<button class="btn btn-sm" type="button">Clear V₀ points</button>');
    measureBtn.addEventListener("click", startSweep);
    clearBtn.addEventListener("click", function () { runs = []; update(true); });
    row.appendChild(measureBtn); row.appendChild(clearBtn);
    P.controls.appendChild(row);
    var show = { others: true, wave: false };
    var row2 = K.h('<div class="row"></div>');
    row2.appendChild(K.check("Other metals on V₀–f", true, function (v) { show.others = v; update(true); }));
    row2.appendChild(K.check("Wave-picture prediction", false, function (v) { show.wave = v; update(true); }));
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    P.controls.appendChild(row2);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-ten"><i></i>photon (its colour)</span><span class="c-normal"><i></i>electron</span>' +
      '<span class="c-vel"><i></i>kinetic energy</span><span class="c-fric"><i></i>work function</span><span class="c-app"><i></i>collector voltage</span></div>'));

    /* ---------- world ---------- */
    var photons = [], electrons = [], trace = [], runs = [], sweep = null, emitted = 0, arrivedLog = [];
    var darkFor = 0, stopFor = 0, spawnAcc = 0, lastV = null;
    var LAMP = { x: 170, y: 105 }, EM = { x: 330, y0: 195, y1: 325 }, CO = { x: 700 }, GAP0 = 340, GAP1 = 692;
    var KNOB = { x0: 380, x1: 640, y: 455 };

    function changed() {
      trace = []; sweep = null; lastV = null;
      fS.set(freq(st.lam) / 1e14);
      theory(); update(true);
    }
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      photons = []; electrons = []; trace = []; sweep = null; lastV = null; arrivedLog = []; darkFor = 0; stopFor = 0;
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }
    function setV(v) { st.V = K.clamp(Math.round(v * 1000) / 1000, VMIN, VMAX); vS.set(st.V); }

    // "Measure V0": start at +1 V and lower the voltage until the ammeter reads exactly zero
    function startSweep() {
      var s = solve();
      if (s.ke <= 0 || st.P <= 0) {
        K.flash(P.note, st.P <= 0 ? "No light, no electrons: turn the intensity up" : "No current at all: each photon has less energy than φ", 3500);
        if (!sim.running) { sim.play(); transportUI.render(); }
        return;
      }
      trace = []; setV(1); sweep = { done: false, I0: measuredI(1, s) };
      if (!sim.running) { sim.play(); transportUI.render(); }
    }
    function sweepStep(s) {
      for (var i = 0; i < 20 && sweep && !sweep.done; i++) {
        var v = st.V - 0.002, I = measuredI(v, s);
        st.V = v;
        if (i % 4 === 0) trace.push([v, I]);
        if (I === 0) {
          // home in on the edge between the last voltage with current and this one
          var hi = v + 0.002, lo = v;
          for (var b = 0; b < 16; b++) { var mid = (hi + lo) / 2; if (measuredI(mid, s) > 0) hi = mid; else lo = mid; }
          finishSweep(-lo, s);
        } else if (v <= VMIN) { sweep = null; K.flash(P.note, "V₀ is beyond the meter's range"); }
      }
      vS.set(st.V);
    }
    function finishSweep(V0, s) {
      sweep.done = true; trace.push([st.V, 0]);
      var r = { metal: st.metal.id, lam: st.lam, f: s.f, P: st.P, V0: V0, Isat: sweep.I0 };
      runs.push(r); if (runs.length > 40) runs.shift();
      sweep = null;
      K.flash(P.note, "Current hits zero at V = −" + K.fmt(V0, 2) + " V, so V₀ = " + K.fmt(V0, 2) + " V", 3500);
      runs.forEach(function (q) {
        if (q !== r && q.metal === r.metal && Math.abs(q.lam - r.lam) < 1e-6 && Math.max(q.P, r.P) >= 2 * Math.min(q.P, r.P) && Math.min(q.P, r.P) > 0 &&
          Math.abs(q.V0 - r.V0) < 0.005) tries.mark("bright");
      });
      var fit = fitFor(r.metal);
      if (fit && fit.n >= 3 && Math.abs(fit.h - H_PL) / H_PL < 0.02) tries.mark("planck");
      update(true);
    }
    // least squares V0 = m f + b over the distinct frequencies measured for one metal
    function fitFor(id) {
      var byF = {};
      runs.forEach(function (r) { if (r.metal === id) byF[r.f.toPrecision(6)] = r; });
      var pts = Object.keys(byF).map(function (k) { return byF[k]; });
      if (pts.length < 2) return null;
      var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
      pts.forEach(function (p) { sx += p.f; sy += p.V0; sxx += p.f * p.f; sxy += p.f * p.V0; });
      var m = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - m * sx) / n;
      return { n: n, m: m, b: b, h: m * E_CH, phi: -b, f0: -b / m, lam0: C / (-b / m) * 1e9 };
    }

    var golden = 0;
    sim.on("step", function () {
      var s = solve(), dt = K.DT;
      if (sweep) sweepStep(s);
      // photons: a packet stands for a huge number of real photons; the packet rate follows the photon rate
      spawnAcc += Math.min(40, 12 * st.P / s.E) * dt;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        photons.push({ p: 0, y: EM.y0 + 12 + Math.random() * (EM.y1 - EM.y0 - 24) });
      }
      photons = photons.filter(function (ph) {
        ph.p += dt * 2.2;
        if (ph.p < 1) return true;
        if (s.ke > 0 && electrons.length < 160) {
          golden = (golden + 0.6180339887) % 1;
          var KE = Math.sqrt(golden) * s.ke;
          electrons.push({ s: 0, v: Math.sqrt(2 * KV * KE), y: ph.y, age: 0 });
          emitted++;
        }
        return false;
      });
      var a = KV * st.V, now = sim.time;
      electrons = electrons.filter(function (el) {
        el.v += a * dt; el.s += el.v * dt; el.age += dt;
        if (el.s >= 1) { arrivedLog.push(now); return false; }
        return el.s >= 0 && el.age < 6;
      });
      while (arrivedLog.length && arrivedLog[0] < now - 1) arrivedLog.shift();
      // the I–V trace also follows the knob while the light is on
      if (!sweep && lastV !== st.V) { trace.push([st.V, measuredI(st.V, s)]); lastV = st.V; }
      darkFor = s.ke <= 0 && st.P >= 4 ? darkFor + dt : 0;
      if (darkFor >= 1.5) tries.mark("dark");
      stopFor = s.ke > 0 && st.P > 0 && measuredI(st.V, s) === 0 ? stopFor + dt : 0;
      if (stopFor >= 1) tries.mark("stop");
      update(false);
    });

    /* ---------- direct manipulation: spectrum strip and voltage knob ---------- */
    var SPEC = { x0: 80, x1: 920, y0: 14, y1: 36 };
    function lamAt(px) { return Math.round(LMIN + (px - SPEC.x0) / (SPEC.x1 - SPEC.x0) * (LMAX - LMIN)); }
    function knobX(v) { return KNOB.x0 + (v - VMIN) / (VMAX - VMIN) * (KNOB.x1 - KNOB.x0); }
    var dragging = null, handlers = {
      down: function (p) {
        if (p.py >= SPEC.y0 - 6 && p.py <= SPEC.y1 + 6 && p.px >= SPEC.x0 - 6 && p.px <= SPEC.x1 + 6) dragging = "lam";
        else if (Math.abs(p.py - KNOB.y) < 16 && p.px >= KNOB.x0 - 12 && p.px <= KNOB.x1 + 12) dragging = "V";
        else return false;
        handlers.drag(p); return true;
      },
      drag: function (p) {
        if (dragging === "lam") { st.lam = K.clamp(lamAt(p.px), LMIN, LMAX); lamS.set(st.lam); changed(); }
        else if (dragging === "V") { sweep = null; setV(VMIN + (p.px - KNOB.x0) / (KNOB.x1 - KNOB.x0) * (VMAX - VMIN)); if (!sim.running) update(true); }
      },
      up: function () { dragging = null; }
    };
    sim.pointer(handlers);

    /* ---------- drawing ---------- */
    function beamColor() { return specColor(st.lam) || th.grav; }
    sim.on("under", function (ctx) {
      var s = solve(), col = beamColor();
      // spectrum strip
      for (var x = SPEC.x0; x < SPEC.x1; x += 2) {
        var l = LMIN + (x - SPEC.x0) / (SPEC.x1 - SPEC.x0) * (LMAX - LMIN), c = specColor(l);
        ctx.fillStyle = c || K.alpha(th.grav, 0.25 + 0.35 * (380 - l) / 230);
        ctx.fillRect(x, SPEC.y0, 2, SPEC.y1 - SPEC.y0);
      }
      ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.strokeRect(SPEC.x0, SPEC.y0, SPEC.x1 - SPEC.x0, SPEC.y1 - SPEC.y0);
      ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.fillStyle = th.muted; ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.fillText("ultraviolet", SPEC.x0 + 6, SPEC.y1 + 4);
      ctx.textAlign = "right"; ctx.fillText("visible →  drag to pick λ", SPEC.x1, SPEC.y1 + 4);
      // threshold mark on the strip
      var lx0 = SPEC.x0 + (s.lam0 - LMIN) / (LMAX - LMIN) * (SPEC.x1 - SPEC.x0);
      if (s.lam0 > LMIN && s.lam0 < LMAX && !st.metal.hidden) {
        ctx.strokeStyle = th.fric; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx0, SPEC.y0 - 4); ctx.lineTo(lx0, SPEC.y1 + 4); ctx.stroke();
        K.label(ctx, "λ₀ " + K.fmt(s.lam0, 0), lx0, SPEC.y1 + 30, th.fric, { font: "700 11px 'JetBrains Mono', monospace" });
      }
      var mx = SPEC.x0 + (st.lam - LMIN) / (LMAX - LMIN) * (SPEC.x1 - SPEC.x0);
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.moveTo(mx, SPEC.y1 + 1); ctx.lineTo(mx - 7, SPEC.y1 + 12); ctx.lineTo(mx + 7, SPEC.y1 + 12); ctx.closePath(); ctx.fill();
      ctx.fillRect(mx - 1, SPEC.y0 - 4, 2, SPEC.y1 - SPEC.y0 + 4);

      // beam from lamp to plate
      if (st.P > 0) {
        ctx.save(); ctx.globalAlpha = 0.08 + 0.05 * st.P;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(LAMP.x + 18, LAMP.y - 6); ctx.lineTo(EM.x, EM.y0 + 8); ctx.lineTo(EM.x, EM.y1 - 8); ctx.lineTo(LAMP.x + 8, LAMP.y + 16); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // lamp
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.save(); ctx.translate(LAMP.x, LAMP.y); ctx.rotate(0.6);
      ctx.fillRect(-34, -16, 50, 32); ctx.strokeRect(-34, -16, 50, 32);
      ctx.fillStyle = col; ctx.fillRect(14, -12, 6, 24);
      ctx.restore();
      K.label(ctx, s.E.toFixed(2) + " eV photons", LAMP.x - 10, LAMP.y - 30, th.ink, { font: "700 12px 'JetBrains Mono', monospace" });
      if (st.lam < 380) K.label(ctx, "UV: invisible", LAMP.x - 10, LAMP.y + 52, th.grav, { font: "600 11px 'JetBrains Mono', monospace" });

      // vacuum tube
      ctx.fillStyle = K.alpha(th.surface, 0.5) ; ctx.strokeStyle = th.line; ctx.lineWidth = 2;
      roundRect(ctx, 290, 160, 450, 200, 40); ctx.fill(); ctx.stroke();
      K.label(ctx, "vacuum", 515, 352, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      // plates
      ctx.fillStyle = th.muted; ctx.fillRect(EM.x - 8, EM.y0, 16, EM.y1 - EM.y0);
      ctx.fillStyle = th.body; ctx.fillRect(CO.x - 8, EM.y0, 16, EM.y1 - EM.y0);
      K.label(ctx, st.metal.name + (st.metal.hidden ? " (φ = ?)" : " (φ = " + st.metal.phi.toFixed(2) + " eV)"), EM.x, EM.y0 - 6, th.fric, { font: "700 12px 'JetBrains Mono', monospace" });
      K.label(ctx, "collector", CO.x, EM.y0 - 6, th.ink, { font: "700 12px 'JetBrains Mono', monospace" });
      // the field's push on electrons
      if (Math.abs(st.V) > 0.005) {
        var dir = st.V > 0 ? 1 : -1, ay = EM.y1 + 18;
        K.arrow(ctx, 515 - dir * 50, ay, 515 + dir * 50, ay, th.app, { width: 2.5 });
        K.label(ctx, st.V > 0 ? "pulls electrons across" : "pushes electrons back", 515, ay - 6, th.app, { font: "600 11px 'JetBrains Mono', monospace" });
      }
      // circuit
      var wy = 420;
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(EM.x, EM.y1); ctx.lineTo(EM.x, wy); ctx.lineTo(470, wy); ctx.moveTo(490, wy); ctx.lineTo(578, wy);
      ctx.moveTo(622, wy); ctx.lineTo(CO.x, wy); ctx.lineTo(CO.x, EM.y1); ctx.stroke();
      // battery (long plate = +). Positive collector: + on the right.
      ctx.lineWidth = 3;
      var plus = st.V >= 0 ? 490 : 470, minus = st.V >= 0 ? 470 : 490;
      ctx.beginPath(); ctx.moveTo(plus, wy - 16); ctx.lineTo(plus, wy + 16); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(minus, wy - 8); ctx.lineTo(minus, wy + 8); ctx.stroke();
      K.label(ctx, "V = " + (st.V > 0 ? "+" : "") + st.V.toFixed(2) + " V", 480, wy - 20, th.app, { font: "700 12px 'JetBrains Mono', monospace" });
      // ammeter
      var I = measuredI(st.V, s);
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(600, wy, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      K.label(ctx, "A", 600, wy + 9, th.ink, { font: "800 15px 'JetBrains Mono', monospace" });
      K.label(ctx, I.toFixed(2) + " μA", 600, wy - 26, th.acc, { font: "700 12px 'JetBrains Mono', monospace", bg: true });
      // voltage knob
      ctx.fillStyle = th.line; ctx.fillRect(KNOB.x0, KNOB.y - 2, KNOB.x1 - KNOB.x0, 4);
      var zx = knobX(0); ctx.fillStyle = th.muted; ctx.fillRect(zx - 1, KNOB.y - 8, 2, 16);
      ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = th.muted;
      ctx.fillText(VMIN + " V", KNOB.x0, KNOB.y + 8); ctx.fillText("0", zx, KNOB.y + 8); ctx.fillText("+" + VMAX + " V", KNOB.x1, KNOB.y + 8);
      ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(knobX(st.V), KNOB.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = th.muted; ctx.fillText("← drag V", KNOB.x1 + 16, KNOB.y);

      drawEnergy(ctx, s);
    });

    // energy ladder: photon energy in, work function out, what's left is KEmax
    function drawEnergy(ctx, s) {
      var x = 820, base = 400, k = 24, top = base - Math.max(s.E, st.metal.phi) * k;
      ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillStyle = th.muted;
      ctx.fillText("energy of one electron", x - 30, top - 14);
      ctx.fillStyle = K.alpha(th.muted, 0.25); ctx.fillRect(x - 30, base, 150, 8);
      ctx.fillStyle = th.muted; ctx.textBaseline = "top"; ctx.fillText("inside the metal", x - 30, base + 10);
      var yphi = base - st.metal.phi * k;
      ctx.strokeStyle = th.fric; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 30, yphi); ctx.lineTo(x + 120, yphi); ctx.stroke(); ctx.setLineDash([]);
      K.arrow(ctx, x + 105, base, x + 105, yphi, th.fric, { width: 2 });
      K.label(ctx, st.metal.hidden ? "φ = ?" : "φ " + st.metal.phi.toFixed(2), x + 104, yphi - 2, th.fric, { align: "right", font: "700 11px 'JetBrains Mono', monospace" });
      var ye = base - s.E * k;
      K.arrow(ctx, x, base, x, ye, beamColor(), { width: 4, label: "hf " + s.E.toFixed(2), lx: 6, ly: 8 });
      if (s.ke > 0) {
        ctx.fillStyle = K.alpha(th.vel, 0.3); ctx.fillRect(x + 30, ye, 40, yphi - ye);
        ctx.strokeStyle = th.vel; ctx.lineWidth = 2; ctx.strokeRect(x + 30, ye, 40, yphi - ye);
        K.label(ctx, "KE " + s.ke.toFixed(2), x + 50, ye - 2, th.vel, { font: "700 11px 'JetBrains Mono', monospace" });
      } else {
        K.label(ctx, "short by " + (st.metal.hidden ? "?" : (-s.ke).toFixed(2) + " eV"), x + 50, ye - 4, th.bad, { font: "700 11px 'JetBrains Mono', monospace" });
      }
    }

    sim.on("over", function (ctx) {
      var col = beamColor(), wl = 3 + (st.lam - LMIN) / (LMAX - LMIN) * 13;
      ctx.lineWidth = 2; ctx.strokeStyle = col;
      photons.forEach(function (ph) {
        var x0 = LAMP.x + 14, y0 = LAMP.y + 6, x = x0 + (EM.x - x0) * ph.p, y = y0 + (ph.y - y0) * ph.p;
        var dx = EM.x - x0, dy = ph.y - y0, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
        ctx.beginPath();
        for (var t = -14; t <= 0; t += 1) {
          var amp = 4 * Math.sin(Math.PI * (t + 14) / 14), w = amp * Math.sin(2 * Math.PI * t / wl);
          var px = x + ux * t - uy * w, py = y + uy * t + ux * w;
          if (t === -14) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      ctx.fillStyle = th.normal;
      electrons.forEach(function (el) {
        var x = GAP0 + (GAP1 - GAP0) * el.s;
        ctx.beginPath(); ctx.arc(x, el.y, 4, 0, Math.PI * 2); ctx.fill();
      });
    });
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">I–V</b> · flat at the saturation current, zero beyond $-V_0$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">V₀–f</b> · dots are your measurements; slope $h/e$, crosses the axis at $f_0$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">I<sub>sat</sub> vs intensity</b> · at your wavelength; dots from your runs</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var giv = rangedGraph(cv[0], { yLabel: "I (μA)", xLabel: "V (V)", xMin: VMIN, xMax: VMAX, yMax: 1, color: th.acc });
    var gvf = new K.Graph(cv[1], { yLabel: "V₀ (V)", xLabel: "f (10¹⁴ Hz)", xMax: 20, yMax: 2, color: th.app });
    var gis = new K.Graph(cv[2], { yLabel: "Isat (μA)", xLabel: "P (mW)", xMax: PMAX, yMin: 0, yMax: 1, color: th.acc });

    function theory() {
      var s = solve(), iv = [], vf = [], ext = [], is = [];
      for (var v = VMIN; v <= VMAX + 1e-9; v += 0.02) iv.push([v, formulaI(v, s)]);
      giv.set("theory", { points: iv, color: th.acc, dash: [5, 5], width: 1.5 });
      gvf.clear();
      if (show.others) METALS.forEach(function (m) {
        if (m === st.metal || m.hidden) return;
        var f0 = m.phi / H_E / 1e14;
        gvf.set("m" + m.id, { points: [[f0, 0], [20, H_E * 20e14 - m.phi]], color: K.alpha(th.muted, 0.45), width: 1 });
      });
      if (!st.metal.hidden) {
        var f0 = s.f0 / 1e14;
        vf.push([f0, 0], [20, H_E * 20e14 - st.metal.phi]);
        ext.push([0, -st.metal.phi], [f0, 0]);
        gvf.set("theory", { points: vf, color: th.app, dash: [5, 5], width: 1.5 });
        gvf.set("ext", { points: ext, color: K.alpha(th.app, 0.5), dash: [2, 4], width: 1.2 });
      }
      var fit = fitFor(st.metal.id);
      if (fit) gvf.set("fit", { points: [[0, fit.b], [20, fit.m * 20e14 + fit.b]], color: th.app, width: 2 });
      if (show.wave) gvf.set("wave", { points: [[0, 0.8 * st.P], [20, 0.8 * st.P]], color: K.alpha(th.muted, 0.9), dash: [1, 4], width: 2 });
      for (var p = 0; p <= PMAX + 1e-9; p += 0.1) is.push([p, s.ke > 0 ? QE * p * 1e3 / s.E : 0]);
      gis.set("theory", { points: is, color: th.acc, dash: [5, 5], width: 1.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100), slowGraphs = K.throttle(drawGraphs, 50);
    function update(force) { if (force) { theory(); drawGraphs(); renderMaths(); } else { slowGraphs(); slowMaths(); } }
    function drawGraphs() {
      var s = solve(), mine = runs.filter(function (r) { return r.metal === st.metal.id; });
      var pts = trace.slice().sort(function (a, b) { return a[0] - b[0]; });
      giv.set("sim", { points: pts, color: th.acc, width: 2.5 });
      giv.extra = function (ctx, X, Y) { ring(ctx, X(st.V), Y(measuredI(st.V, s))); };
      gvf.extra = function (ctx, X, Y) {
        dots(ctx, X, Y, mine.map(function (r) { return [r.f / 1e14, r.V0]; }), th.app);
        if (s.ke > 0 && !st.metal.hidden) ring(ctx, X(s.f / 1e14), Y(s.ke));
        if (show.wave) { ctx.fillStyle = th.muted; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.fillText("wave picture: V₀ set by brightness", X(19.5), Y(0.8 * st.P) - 6); }
      };
      gis.extra = function (ctx, X, Y) {
        dots(ctx, X, Y, runs.filter(function (r) { return r.metal === st.metal.id && Math.abs(r.lam - st.lam) < 1e-6; }).map(function (r) { return [r.P, r.Isat]; }), th.acc);
        ring(ctx, X(st.P), Y(s.Isat));
      };
      [giv, gvf, gis].forEach(function (g) { g.dirty = true; g.draw(); });
    }
    function dots(ctx, X, Y, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4.5, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Energy of one photon (hc = 1240 eV nm)", "Einstein's equation", "Stopping potential", "Threshold"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "f", label: "frequency f" }, { id: "E", label: "photon energy hf" }, { id: "phi", label: "work function φ", cls: "c-fric" },
      { id: "ke", label: "KE max", cls: "c-vel" }, { id: "V0", label: "stopping potential V₀", cls: "c-app" }, { id: "I", label: "photocurrent", cls: "c-acc" },
      { id: "Isat", label: "saturation current", cls: "c-acc" }, { id: "rate", label: "photons per second" }, { id: "h", label: "h from your slope" }
    ]);
    function lastRun() {
      var r = runs[runs.length - 1];
      return r && r.metal === st.metal.id && Math.abs(r.lam - st.lam) < 1e-6 ? r : null;
    }
    function renderMaths() {
      var s = solve(), hid = st.metal.hidden, fit = fitFor(st.metal.id), r = lastRun();
      var phiTxt = hid ? (fit ? K.fmt(fit.phi, 2) : "\\phi_X") : st.metal.phi.toFixed(2);
      K.tex(eqEls[0], "E = \\frac{hc}{\\lambda} = \\frac{1240}{" + K.fmt(st.lam, 0) + "} = \\mathbf{" + s.E.toFixed(2) + "}\\ \\text{eV} = " + texSci(s.E * E_CH, 2) + "\\ \\text{J}");
      if (hid && !fit) K.tex(eqEls[1], "KE_{max} = hf - \\phi_X = " + s.E.toFixed(2) + " - \\phi_X \\quad(\\phi_X\\text{ unknown: measure } V_0)");
      else K.tex(eqEls[1], "KE_{max} = hf - \\phi = " + s.E.toFixed(2) + " - " + phiTxt + " = " + (s.ke > 0 || hid ? "\\mathbf{" + K.fmt(hid ? s.E - fit.phi : s.ke, 2) + "}\\ \\text{eV}" : "(" + K.fmt(s.ke, 2) + ") \\lt 0\\;\\Rightarrow\\;\\text{no electrons}"));
      K.tex(eqEls[2], "eV_0 = KE_{max} \\;\\Rightarrow\\; V_0 = " + (hid && !fit ? "?" : "\\mathbf{" + K.fmt(hid ? Math.max(s.E - fit.phi, 0) : s.V0, 2) + "}\\ \\text{V}") +
        (r ? "\\quad(\\text{measured } " + K.fmt(r.V0, 2) + "\\ \\text{V})" : ""));
      if (hid && !fit) K.tex(eqEls[3], "f_0 = \\frac{\\phi}{h},\\ \\lambda_0 = \\frac{1240}{\\phi}\\quad\\text{(measure two } V_0\\text{ values to find them)}");
      else {
        var ph = hid ? fit.phi : st.metal.phi;
        K.tex(eqEls[3], "f_0 = \\frac{\\phi}{h} = \\frac{(" + K.fmt(ph, 2) + ")(1.602\\times10^{-19})}{6.626\\times10^{-34}} = \\mathbf{" + texSci(ph / H_E, 2) + "}\\ \\text{Hz},\\ \\lambda_0 = \\frac{1240}{" + K.fmt(ph, 2) + "} = \\mathbf{" + K.fmt(HC / ph, 1) + "}\\ \\text{nm}");
      }
      setR("f", txtSci(s.f, 3) + " Hz", "f = c/λ");
      setR("E", s.E.toFixed(2) + " eV", txtSci(s.E * E_CH, 2) + " J");
      setR("phi", hid ? (fit ? K.fmt(fit.phi, 2) + " eV" : "?") : st.metal.phi.toFixed(2) + " eV", hid ? (fit ? "from your V₀–f line" : "measure V₀ at two colours") : "λ₀ = " + K.fmt(s.lam0, 1) + " nm");
      setR("ke", hid && !fit ? "?" : K.fmt(Math.max(hid ? s.E - fit.phi : s.ke, 0), 2) + " eV", s.ke > 0 && !hid ? "v max = " + K.fmt(s.vmax / 1000, 0) + " km/s" : s.ke > 0 ? "" : "below threshold");
      setR("V0", r ? K.fmt(r.V0, 2) + " V" : "—", r ? "measured · formula " + (hid ? "?" : K.fmt(s.V0, 2)) : "press Measure V₀");
      setR("I", measuredI(st.V, s).toFixed(2) + " μA", "formula " + formulaI(st.V, s).toFixed(2));
      setR("Isat", s.Isat.toFixed(2) + " μA", "1% of photons free an electron");
      setR("rate", st.P > 0 ? txtSci(s.rate, 2) + " /s" : "0", "P / hf");
      setR("h", fit ? txtSci(fit.h, 3) + " J s" : "—", fit ? "slope " + txtSci(fit.m, 3) + " V s, " + fit.n + " colours" : "measure V₀ at 2+ colours");
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Light arrives in packets, <b>photons</b>, each with energy $E = hf = hc/\\lambda$. One photon gives all its energy to one electron. The electron spends the <b class=\"c-fric\">work function $\\phi$</b> getting out of the metal and keeps the rest as <b class=\"c-vel\">kinetic energy</b>: $KE_{max} = hf - \\phi$. Electrons from deeper inside lose a bit more on the way out, so $KE_{max}$ is the top of a spread.</p>" +
      "<p>The collector sorts them. A retarding voltage $V$ turns back every electron with $KE \\lt eV$, so the current falls to zero at the <b class=\"c-app\">stopping potential</b> $eV_0 = KE_{max}$. Colour sets $V_0$; intensity only sets how many photons, and so the <b class=\"c-acc\">saturation current</b>.</p>" +
      "<p>The wave picture got all of this wrong: it said brighter light should mean faster electrons, any colour should work if you wait, and there should be a delay. None of it happens. Plot $V_0$ against $f$ and every metal gives a parallel line of slope $h/e$.</p>" +
      '<div class="trap"><b>JEE trap: doubling $f$ does not double $KE_{max}$.</b> $KE_{max} = hf - \\phi$, so doubling $f$ adds another $hf$: the new value is $2hf - \\phi$, more than double. And at the same intensity, higher $f$ means fewer photons per second, so the saturation current goes <i>down</i>.</div>');
    function apply(s) {
      st.metal = METALS.filter(function (m) { return m.id === s.metal; })[0];
      metalSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === s.metal)); });
      st.lam = s.lam; lamS.set(s.lam); st.P = s.P; pS.set(s.P); setV(s.V || 0);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "Einstein's equation", setup: { metal: "Na", lam: 400, P: 2, V: 0 }, watch: "Predict V₀, then press Measure V₀",
        q: "Light of wavelength 400 nm falls on sodium ($\\phi = 2.75$ eV). What is the stopping potential? Take $hc = 1240$ eV nm.",
        options: ["0.35 V", "2.75 V", "3.10 V", "5.85 V"], answer: 0,
        explain: "$E = 1240/400 = 3.10$ eV, so $KE_{max} = 3.10 - 2.75 = 0.35$ eV and $V_0 = 0.35$ V. 3.10 V forgets the work function; 5.85 V adds it instead of subtracting." },
      { level: "medium", tag: "intensity vs frequency", setup: { metal: "Zn", lam: 250, P: 2, V: 0 }, watch: "Measure V₀ at 2 mW, then at 4 mW, and compare I_sat",
        q: "250 nm light on zinc ($\\phi = 4.30$ eV) gives a saturation current $I$. The intensity is doubled at the same wavelength. What are the new saturation current and stopping potential?",
        options: ["$2I$ and 0.66 V", "$I$ and 1.32 V", "$2I$ and 1.32 V", "$\\sqrt2\\,I$ and 0.66 V"], answer: 0,
        hints: ["What does doubling the intensity double: the number of photons, or the energy of each?", "$V_0$ comes from one photon and one electron: $eV_0 = hc/\\lambda - \\phi$."],
        explain: "Twice the photons per second frees twice the electrons, so $I_{sat}$ doubles (4.03 → 8.06 μA in the lab). Each photon still has $1240/250 = 4.96$ eV, so $V_0 = 4.96 - 4.30 = 0.66$ V either way." },
      { level: "hard", tag: "unknown metal", setup: { metal: "X", lam: 250, P: 2, V: 0 }, watch: "Measure V₀ at 250 nm, then at 350 nm, and read φ and λ₀",
        q: "An unknown metal gives a stopping potential of 1.76 V with 250 nm light and 0.34 V with 350 nm light. Find its work function and threshold wavelength ($hc = 1240$ eV nm).",
        options: ["3.20 eV and 388 nm", "1.42 eV and 873 nm", "4.96 eV and 250 nm", "3.20 eV and 350 nm"], answer: 0,
        hints: ["Write $eV_0 = hc/\\lambda - \\phi$ for both wavelengths.", "Either equation then gives $\\phi$; the threshold is where $V_0$ would be zero: $\\lambda_0 = hc/\\phi$."],
        explain: "$\\phi = 1240/250 - 1.76 = 4.96 - 1.76 = 3.20$ eV, and the second point agrees: $3.54 - 0.34 = 3.20$ eV. Then $\\lambda_0 = 1240/3.20 = 387.5 \\approx 388$ nm. Subtracting the two equations instead gives $h$: slope $= \\Delta V_0/\\Delta f = 1.42/(3.43\\times10^{14}) = 4.14\\times10^{-15}$ V s $= h/e$. 1.42 eV is that difference, not $\\phi$." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Light on", onReset: reset });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_photoelectric = {
        apply: apply, measure: startSweep, sweeping: function () { return !!sweep; },
        setV: function (v) { setV(v); }, setP: function (p) { st.P = p; pS.set(p); changed(); }, setLam: function (l) { st.lam = l; lamS.set(l); changed(); },
        state: function () { var s = solve(); return { s: s, st: st, runs: runs, fit: fitFor(st.metal.id), I: measuredI(st.V, s), Iformula: formulaI(st.V, s), photons: photons.length, electrons: electrons.length }; },
        measuredI: function (v) { return measuredI(v, solve()); }, formulaI: function (v) { return formulaI(v, solve()); }
      };
    }

    return function destroy() { sim.destroy(); [giv, gvf, gis].forEach(function (g) { g.destroy(); }); if (window.__lab_photoelectric) delete window.__lab_photoelectric; };
  }
})();
