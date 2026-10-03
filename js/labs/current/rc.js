/* Current electricity, lab 3: RC circuits. Charge and discharge a capacitor through a resistor, stepped with the exact exponential. */
(function () {
  "use strict";

  var lab = {
    id: "rc", chapter: "current", title: "RC circuits", short: "charging, discharging, τ = RC",
    lede: "Flip the switch and a capacitor fills through a resistor: fast at first, then ever more slowly. One number, $\\tau = RC$, sets the pace, and the energy bill always comes out the same: half to the capacitor, half to heat.",
    tries: [
      { id: "full", title: "Charge it (almost) fully",
        text: "Start from an empty capacitor and charge it to 99 % of $CE$.",
        why: "$q = CE(1 - e^{-t/RC})$ never quite reaches $CE$. It takes $t = \\tau\\ln 100 \\approx 4.6\\tau$ to get to 99 %, which is why '5 time constants' is the rule of thumb for 'full'." },
      { id: "half", title: "Let half the charge drain away",
        text: "Discharge a charged capacitor until half its charge has gone.",
        why: "Discharging, $q = q_0e^{-t/RC}$, so the charge halves every $\\tau\\ln 2 \\approx 0.69\\tau$, whatever charge you start with. Each time constant leaves 37 %." },
      { id: "energy", title: "Show the heat doesn't depend on R",
        text: "Charge from empty to full twice, with resistances at least 4× apart. Compare the heat with the stored energy each time.",
        why: "A bigger $R$ means a smaller current for longer: $\\int I^2R\\,dt = \\frac12CE^2$ either way. The battery always does $W = QE = CE^2$, and exactly half ends up as heat." },
      { id: "flip", title: "Flip the switch halfway",
        text: "Switch to discharge while the capacitor is still charging (between 5 % and 90 % full).",
        why: "The capacitor's voltage can't jump (that would need infinite current), but the current can: it reverses at once to $-V_C/R$ and then decays with the same $\\tau$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 50;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: { x: 0, y: 520 }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var eS = K.slider({ label: "Battery EMF $E$", unit: "V", min: 1, max: 12, step: 0.5, value: 10, onInput: reset });
    var rS = K.slider({ label: "Resistance $R$", unit: "kΩ", min: 5, max: 50, step: 1, value: 20, onInput: reset });
    var cS = K.slider({ label: "Capacitance $C$", unit: "μF", min: 20, max: 200, step: 10, value: 100, onInput: reset });
    P.controls.innerHTML = "<h3>Circuit</h3>";
    [eS, rS, cS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h('<h3>Switch <small class="muted">or click it on the stage</small></h3>'));
    var swSeg = K.seg([{ label: "a: charge", value: "charge" }, { label: "b: discharge", value: "discharge" }], "charge", function (v) { flip(v); }, "Switch");
    P.controls.appendChild(swSeg);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-ten"><i></i>current (dots: speed ∝ I)</span><span class="c-normal"><i></i>charge / stored energy</span>' +
      '<span class="c-fric"><i></i>heat in R</span><span class="c-app"><i></i>battery work</span></div>'));

    function params() { return { E: eS.get(), R: rS.get() * 1e3, C: cS.get() * 1e-6 }; }
    function tau(p) { return p.R * p.C; }

    /* ---------- state ---------- */
    // seg: the current stretch since the switch last moved: { mode, t0, q0, W0, H0 }
    var st, rec, fullRuns = [];
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      st = { q: 0, I: 0, Wb: 0, Hr: 0, mode: "charge", seg: { mode: "charge", t0: 0, q0: 0, W0: 0, H0: 0 }, done: false, kDots: 0, phase: 0 };
      setSeg("charge");
      st.I = current(params());
      rec = { t: [0], q: [0], I: [st.I], U: [0], H: [0], W: [0] };
      st.kDots = 5 / Math.max(Math.abs(st.I), 1e-12);
      P.time.textContent = "t = 0.00 s";
      update(true);
    }
    function setSeg(m) { swSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === m)); }); }
    function target(p, mode) { return mode === "charge" ? p.C * p.E : 0; }
    function current(p) { return (target(p, st.mode) - st.q) / tau(p); }   // I = (E − q/C)/R charging, −q/(RC) discharging

    function flip(m) {
      if (m === st.mode) return;
      var p = params();
      st.mode = m; setSeg(m);
      var q0 = st.q, qf = p.C * p.E;
      st.seg = { mode: m, t0: sim.time, q0: q0, W0: st.Wb, H0: st.Hr };
      st.I = current(p);
      if (Math.abs(st.I) > 1e-12) st.kDots = 5 / Math.abs(st.I);
      st.done = false;
      rec.t.push(sim.time); rec.q.push(st.q); rec.I.push(st.I); rec.U.push(st.q * st.q / (2 * p.C)); rec.H.push(st.Hr); rec.W.push(st.Wb);
      if (m === "discharge" && q0 > 0.05 * qf && q0 < 0.9 * qf) tries.mark("flip");
      K.flash(P.note, m === "charge" ? "Switch to a: charging" : "Switch to b: discharging through R");
      if (!sim.running) { sim.play(); transportUI.render(); }
      update(true);
    }

    sim.on("step", function (t) {
      var p = params(), T = tau(p), qt = target(p, st.mode), d = Math.exp(-K.DT / T);
      var Is = (qt - st.q) / T, qn = qt + (st.q - qt) * d;
      st.Hr += p.R * Is * Is * T / 2 * (1 - d * d);          // ∫ I²R dt over the step, done exactly
      if (st.mode === "charge") st.Wb += p.E * (qn - st.q);   // battery work = E × charge pushed through it
      st.q = qn; st.I = (qt - st.q) / T;
      st.phase += st.kDots * st.I * K.DT;
      rec.t.push(t); rec.q.push(st.q); rec.I.push(st.I); rec.U.push(st.q * st.q / (2 * p.C)); rec.H.push(st.Hr); rec.W.push(st.Wb);
      var s = st.seg, qf = p.C * p.E;
      if (s.mode === "charge" && s.q0 < 0.01 * qf && st.q >= 0.99 * qf && !s.full) {
        s.full = true; tries.mark("full");
        fullRuns.push({ R: p.R, ratio: (st.Hr - s.H0) / (st.q * st.q / (2 * p.C)) });
        var rs = fullRuns.filter(function (r) { return Math.abs(r.ratio - 1) < 0.03; }).map(function (r) { return r.R; });
        if (rs.length > 1 && Math.max.apply(null, rs) >= 4 * Math.min.apply(null, rs)) tries.mark("energy");
      }
      if (s.mode === "discharge" && s.q0 > 1e-12 && st.q <= s.q0 / 2 && !s.half) { s.half = true; tries.mark("half"); }
      if (t - s.t0 > 8 * tau(p) && !st.done) {
        st.done = true; sim.pause(); transportUI.render();
        K.flash(P.note, "Settled after 8τ. Flip the switch to go on", 3000);
      }
      update(st.done);
    });

    /* ---------- pointer: click the switch ---------- */
    var PIV = [10.6, 8], TA = [8.4, 8], TB = [8.4, 6.2];
    function onSwitch(m) { return m.x > 7.6 && m.x < 11.4 && m.y > 5.6 && m.y < 8.8; }
    sim.pointer({
      down: function (p) { if (!onSwitch(p.m)) return false; flip(st.mode === "charge" ? "discharge" : "charge"); },
      hover: function (p) { P.canvas.style.cursor = onSwitch(p.m) ? "pointer" : "default"; }
    });

    /* ---------- drawing ---------- */
    function X(x, y) { return sim.px(x, y); }
    function poly(ctx, pts) { ctx.beginPath(); pts.forEach(function (q, i) { var a = X(q[0], q[1]); if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); }); ctx.stroke(); }
    // the loop the current runs round, starting at the switch pivot (positive I: towards the + plate)
    function loopPts() {
      return st.mode === "charge" ? [PIV, [17, 8], [17, 2], [3, 2], [3, 8], TA, PIV] : [PIV, [17, 8], [17, 2], [8.4, 2], TB, PIV];
    }
    function along(pts, s) {
      for (var i = 1; i < pts.length; i++) {
        var L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (s <= L) return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * s / L, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * s / L];
        s -= L;
      }
      return pts[pts.length - 1];
    }
    function lenOf(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }

    sim.on("under", function (ctx) {
      if (!st) return;
      var p = params(), qf = p.C * p.E, frac = qf > 0 ? st.q / (p.C * 12) : 0;
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5); ctx.lineCap = "round"; ctx.lineJoin = "round";
      poly(ctx, [[3, 5.25], [3, 8], TA]);                        // battery + to terminal a
      poly(ctx, [[3, 4.75], [3, 2], [17, 2], [17, 4.8]]);         // bottom rail to the lower plate
      poly(ctx, [[17, 5.2], [17, 8], [14.3, 8]]); poly(ctx, [[12.7, 8], PIV]);
      poly(ctx, [TB, [8.4, 2]]);                                  // terminal b straight down to the rail
      // battery
      var b0 = X(3, 4.9), b1 = X(3, 5.1);
      ctx.strokeStyle = th.app; ctx.lineWidth = sim.u(2.5); ctx.beginPath(); ctx.moveTo(b1.x - 0.45 * ppm, b1.y); ctx.lineTo(b1.x + 0.45 * ppm, b1.y); ctx.stroke();
      ctx.lineWidth = sim.u(6); ctx.beginPath(); ctx.moveTo(b0.x - 0.22 * ppm, b0.y); ctx.lineTo(b0.x + 0.22 * ppm, b0.y); ctx.stroke();
      K.label(ctx, "+", b1.x + 0.6 * ppm, b1.y + sim.u(2), th.app, { s: sim.u(1.1) });
      K.label(ctx, "E " + p.E + " V", b1.x - 0.6 * ppm, b1.y + sim.u(14), th.app, { s: sim.u(1), align: "right" });
      // resistor, glowing with the heat rate
      var heat = Math.min(1, st.I * st.I * p.R / (p.E * p.E / p.R)), r0 = X(12.7, 8), r1 = X(14.3, 8);
      var zig = function () { ctx.beginPath(); ctx.moveTo(r0.x, r0.y); for (var i = 0; i < 6; i++) ctx.lineTo(r0.x + (i + 0.5) / 6 * (r1.x - r0.x), r0.y + (i % 2 ? 1 : -1) * 0.22 * ppm); ctx.lineTo(r1.x, r1.y); };
      if (heat > 0.01) { zig(); ctx.strokeStyle = K.alpha(th.fric, 0.15 + 0.55 * heat); ctx.lineWidth = sim.u(12); ctx.stroke(); }
      zig(); ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5); ctx.stroke();
      K.label(ctx, "R " + rS.get() + " kΩ", (r0.x + r1.x) / 2, r0.y - 0.4 * ppm, th.muted, { s: sim.u(1) });
      // capacitor: field between the plates and charges on them
      var cT = X(17, 5.2), cB = X(17, 4.8), pw = 0.75 * ppm;
      ctx.fillStyle = K.alpha(th.normal, Math.min(0.5, 0.5 * Math.abs(frac)));
      ctx.fillRect(cT.x - pw, cT.y, 2 * pw, cB.y - cT.y);
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(4);
      ctx.beginPath(); ctx.moveTo(cT.x - pw, cT.y); ctx.lineTo(cT.x + pw, cT.y); ctx.moveTo(cB.x - pw, cB.y); ctx.lineTo(cB.x + pw, cB.y); ctx.stroke();
      var n = Math.round(8 * Math.abs(frac));
      for (var i = 0; i < n; i++) {
        var x = cT.x - pw + (i + 0.5) * 2 * pw / 8;
        K.label(ctx, "+", x, cT.y - sim.u(3), th.normal, { s: sim.u(0.9) });
        K.label(ctx, "−", x, cB.y + sim.u(16), th.normal, { s: sim.u(0.9) });
      }
      K.label(ctx, "C " + cS.get() + " μF", cT.x - pw - sim.u(8), cT.y + sim.u(18), th.muted, { s: sim.u(1), align: "right" });
      // switch: pivot, two terminals and the blade
      [PIV, TA, TB].forEach(function (q) { var a = X(q[0], q[1]); ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(a.x, a.y, sim.u(4.5), 0, Math.PI * 2); ctx.fill(); });
      var to = st.mode === "charge" ? TA : TB, pv = X(PIV[0], PIV[1]), tp = X(to[0], to[1]);
      ctx.strokeStyle = th.ten; ctx.lineWidth = sim.u(4); ctx.beginPath(); ctx.moveTo(pv.x, pv.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      var la = X(TA[0], TA[1]), lb = X(TB[0], TB[1]);
      K.label(ctx, "a", la.x - sim.u(12), la.y - sim.u(4), th.ink, { s: sim.u(1) });
      K.label(ctx, "b", lb.x - sim.u(12), lb.y + sim.u(6), th.ink, { s: sim.u(1) });
      K.label(ctx, "click to flip", pv.x, pv.y - sim.u(16), th.muted, { s: sim.u(0.85) });
      // meters: an ammeter on the rail, a voltmeter across the capacitor
      var am = X(13, 2);
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.arc(am.x, am.y, 0.42 * ppm, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      K.label(ctx, "A", am.x, am.y + sim.u(8), th.ink, { s: sim.u(1.1) });
      K.label(ctx, K.fmt(Math.abs(st.I) * 1e3, 3) + " mA", am.x, am.y + 0.5 * ppm + sim.u(20), th.ten, { s: sim.u(1), bg: true });
      var vm = X(19, 5);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = th.normal; ctx.lineWidth = sim.u(1.5);
      poly(ctx, [[18.52, 5], [18.4, 7], [17, 7]]); poly(ctx, [[18.52, 5], [18.4, 3], [17, 3]]); ctx.restore();
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.normal; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.arc(vm.x, vm.y, 0.48 * ppm, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      K.label(ctx, "V", vm.x, vm.y + sim.u(8), th.normal, { s: sim.u(1.1) });
      K.label(ctx, K.fmt(st.q / p.C, 2) + " V", vm.x, vm.y + 0.55 * ppm + sim.u(20), th.normal, { s: sim.u(1), bg: true });
    });
    sim.on("over", function (ctx) {
      if (!st || Math.abs(st.I) < 1e-12) return;
      var pts = loopPts(), L = lenOf(pts), n = Math.round(L / 0.55), g = L / n;
      ctx.fillStyle = th.ten;
      for (var i = 0; i < n; i++) {
        var s = ((st.phase + i * g) % L + L) % L, q = along(pts, s);
        if (Math.abs(q[0] - 17) < 0.1 && q[1] > 4.55 && q[1] < 5.45) continue;      // no charge crosses the gap between the plates
        if (Math.abs(q[0] - 3) < 0.1 && q[1] > 4.6 && q[1] < 5.4) continue;
        var a = X(q[0], q[1]);
        ctx.beginPath(); ctx.arc(a.x, a.y, sim.u(3.4), 0, Math.PI * 2); ctx.fill();
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-normal">q–t</b> · charge on the capacitor; the dotted lines mark one time constant (63 % of the way)</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-ten">I–t</b> · jumps when the switch flips, then decays: down to 37 % after one $\\tau$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">energy</b> · battery work (magenta), stored $\\frac{q^2}{2C}$ (cyan), heat in R (red)</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (cp) { cp.innerHTML = K.md(cp.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gq = new K.Graph(cv[0], { yLabel: "q (μC)", xMax: 10, xAuto: true, yMin: 0, color: th.normal });
    var gi = new K.Graph(cv[1], { yLabel: "I (mA)", xMax: 10, xAuto: true, color: th.ten });
    var ge = new K.Graph(cv[2], { yLabel: "energy (mJ)", xMax: 10, xAuto: true, yMin: 0, color: th.app });

    // the formula for the current stretch: q = q_f + (q₀ − q_f) e^(−(t − t₀)/τ)
    function formula(p, t) {
      var s = st.seg, T = tau(p), qf = target(p, s.mode), e = Math.exp(-(t - s.t0) / T), q = qf + (s.q0 - qf) * e;
      return { q: q, I: (qf - s.q0) / T * e, U: q * q / (2 * p.C) };
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params(), T = tau(p), s = st.seg, xm = Math.max(6 * T, s.t0 + 6 * T);
      [gq, gi, ge].forEach(function (g) { g.o.xMax = xm; });
      var fq = [], fi = [], fu = [];
      for (var k = 0; k <= 120; k++) {
        var t = s.t0 + 6 * T * k / 120, f = formula(p, t);
        fq.push([t, f.q * 1e6]); fi.push([t, f.I * 1e3]); fu.push([t, f.U * 1e3]);
      }
      var pts = function (arr, k) { return rec.t.map(function (t, i) { return [t, arr[i] * k]; }); };
      gq.set("theory", { points: fq, color: th.normal, dash: [5, 5], width: 1.5 });
      gq.set("sim", { points: pts(rec.q, 1e6), color: th.normal, width: 2.5, dot: true });
      gi.set("theory", { points: fi, color: th.ten, dash: [5, 5], width: 1.5 });
      gi.set("sim", { points: pts(rec.I, 1e3), color: th.ten, width: 2.5, dot: true });
      ge.set("w", { points: pts(rec.W, 1e3), color: th.app, width: 2 });
      ge.set("theory", { points: fu, color: th.normal, dash: [5, 5], width: 1.5 });
      ge.set("u", { points: pts(rec.U, 1e3), color: th.normal, width: 2.5 });
      ge.set("h", { points: pts(rec.H, 1e3), color: th.fric, width: 2 });
      var f1 = formula(p, s.t0 + T);
      gq.extra = function (ctx, Xf, Yf) { tauMark(ctx, Xf, Yf, s.t0 + T, f1.q * 1e6, s.mode === "charge" ? "τ: 63 %" : "τ: 37 % left"); };
      gi.extra = function (ctx, Xf, Yf) { tauMark(ctx, Xf, Yf, s.t0 + T, f1.I * 1e3, "τ: 37 %"); };
      [gq, gi, ge].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function tauMark(ctx, Xf, Yf, t, v, text) {
      ctx.save(); ctx.strokeStyle = K.alpha(th.muted, 0.9); ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Xf(t), Yf(0)); ctx.lineTo(Xf(t), Yf(v)); ctx.lineTo(Xf(0), Yf(v)); ctx.stroke(); ctx.restore();
      ctx.fillStyle = th.muted; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText(text, Xf(t) + 4, Yf(v) - 2);
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Charge on the capacitor", "Current", "Time constant", "Energy since the switch moved"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "t", label: "time since the switch moved" }, { id: "q", label: "charge q", cls: "c-normal" }, { id: "v", label: "capacitor voltage q/C", cls: "c-normal" },
      { id: "i", label: "current I", cls: "c-ten" }, { id: "u", label: "stored energy", cls: "c-normal" }, { id: "h", label: "heat in R", cls: "c-fric" },
      { id: "w", label: "battery work", cls: "c-app" }, { id: "tau", label: "time constant RC" }
    ]);
    function renderMaths() {
      var p = params(), T = tau(p), s = st.seg, tt = sim.time - s.t0, e = Math.exp(-tt / T), qf = p.C * p.E, f = formula(p, sim.time);
      var uq = function (q) { return K.fmt(q * 1e6, 1); };
      var et = "e^{-" + K.fmt(tt, 2) + "/" + K.fmt(T, 2) + "}";
      if (s.mode === "charge" && s.q0 < 1e-15) {
        K.tex(eqEls[0], "q = CE\\left(1 - e^{-t/RC}\\right) = " + uq(qf) + "\\left(1 - " + et + "\\right) = \\mathbf{" + uq(f.q) + "}\\ \\mu\\text{C}");
        K.tex(eqEls[1], "I = \\frac{E}{R}e^{-t/RC} = " + K.fmt(p.E / p.R * 1e3, 3) + "\\," + et + " = \\mathbf{" + K.fmt(f.I * 1e3, 3) + "}\\ \\text{mA}");
      } else if (s.mode === "charge") {
        K.tex(eqEls[0], "q = CE + (q_0 - CE)e^{-t/RC} = " + uq(qf) + " + (" + uq(s.q0) + " - " + uq(qf) + ")\\," + et + " = \\mathbf{" + uq(f.q) + "}\\ \\mu\\text{C}");
        K.tex(eqEls[1], "I = \\frac{E - q_0/C}{R}e^{-t/RC} = " + K.fmt((p.E - s.q0 / p.C) / p.R * 1e3, 3) + "\\," + et + " = \\mathbf{" + K.fmt(f.I * 1e3, 3) + "}\\ \\text{mA}");
      } else {
        K.tex(eqEls[0], "q = q_0e^{-t/RC} = " + uq(s.q0) + "\\," + et + " = \\mathbf{" + uq(f.q) + "}\\ \\mu\\text{C}");
        K.tex(eqEls[1], "I = -\\frac{q_0}{RC}e^{-t/RC} = (" + K.fmt(-s.q0 / T * 1e3, 3) + ")\\," + et + " = \\mathbf{" + K.fmt(f.I * 1e3, 3) + "}\\ \\text{mA}");
      }
      K.tex(eqEls[2], "\\tau = RC = (" + rS.get() + "\\ \\text{k}\\Omega)(" + cS.get() + "\\ \\mu\\text{F}) = \\mathbf{" + K.fmt(T, 2) + "}\\ \\text{s},\\quad e^{-1} = 0.368,\\ 1 - e^{-1} = 0.632");
      var dW = st.Wb - s.W0, dH = st.Hr - s.H0, U0 = s.q0 * s.q0 / (2 * p.C), dU = st.q * st.q / (2 * p.C) - U0;
      K.tex(eqEls[3], s.mode === "charge"
        ? "W = E\\,\\Delta q = " + K.fmt(dW * 1e3, 3) + "\\ \\text{mJ} = \\underbrace{" + K.fmt(dU * 1e3, 3) + "}_{\\Delta U} + \\underbrace{" + K.fmt(dH * 1e3, 3) + "}_{\\text{heat}}" + (s.q0 < 1e-15 ? "\\;\\to\\; \\tfrac12CE^2 + \\tfrac12CE^2 = " + K.fmt(qf * p.E * 1e3, 3) : "")
        : "\\text{heat} = -\\Delta U = " + K.fmt(dH * 1e3, 3) + "\\ \\text{mJ}\\;\\to\\; \\frac{q_0^2}{2C} = " + K.fmt(U0 * 1e3, 3) + "\\ \\text{mJ}");
      setR("t", K.fmt(tt, 2) + " s", K.fmt(tt / T, 2) + " τ");
      setR("q", uq(st.q) + " μC", K.fmt(100 * st.q / qf, 1) + " % of CE · formula " + uq(f.q));
      setR("v", K.fmt(st.q / p.C, 2) + " V");
      setR("i", K.fmt(st.I * 1e3, 3) + " mA", "formula " + K.fmt(f.I * 1e3, 3));
      setR("u", K.fmt(st.q * st.q / (2 * p.C) * 1e3, 3) + " mJ", "½CE² = " + K.fmt(qf * p.E / 2 * 1e3, 3));
      setR("h", K.fmt(st.Hr * 1e3, 3) + " mJ", "∫I²R dt, total");
      setR("w", K.fmt(st.Wb * 1e3, 3) + " mJ", st.Wb > 0 ? "heat / work = " + K.fmt(st.Hr / st.Wb, 3) : "");
      setR("tau", K.fmt(T, 2) + " s", "half-life τ ln 2 = " + K.fmt(T * Math.LN2, 2) + " s");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>At the moment the switch closes, an empty capacitor has no voltage, so the whole EMF sits across the resistor: $I_0 = E/R$. As charge builds up, $q/C$ pushes back, so the current falls, so the charging slows. KVL, $E = IR + q/C$, turns this into $q = CE(1 - e^{-t/RC})$ and $I = \\frac{E}{R}e^{-t/RC}$.</p>" +
      "<p>The <b>time constant</b> $\\tau = RC$ is the whole story: after $\\tau$ the charge is 63 % of the way there and the current has fallen to 37 %. Discharging is the same curve upside down: $q = q_0e^{-t/RC}$.</p>" +
      "<p>The battery pushes charge $CE$ through an EMF $E$, doing $W = CE^2$ of work. The capacitor ends up with $\\frac12CE^2$. The other half is heat in $R$, <b>whatever $R$ is</b>.</p>" +
      '<div class="trap"><b>JEE trap: half the charge is not half the energy.</b> $U = q^2/2C$, so at half charge the capacitor has only a quarter of its final energy. Half charge comes at $t = \\tau\\ln 2$; half energy needs $q = CE/\\sqrt2$, which takes $t = \\tau\\ln(2 + \\sqrt2) \\approx 1.23\\tau$.</div>');
    function apply(s) { eS.set(s.E); rS.set(s.R); cS.set(s.C); reset(); }
    K.practice(P.quiz, [
      { level: "easy", tag: "time constant", setup: { E: 10, R: 10, C: 100 }, watch: "Press Close switch, pause near t = 1 s and read q",
        q: "A 100 μF capacitor is charged through a 10 kΩ resistor from a 10 V battery. What is the time constant, and the charge after one time constant?",
        options: ["1 s, 632 μC", "1 s, 1000 μC", "0.1 s, 632 μC", "1 s, 368 μC"], answer: 0,
        explain: "$\\tau = RC = (10^4)(10^{-4}) = 1$ s. Then $q = CE(1 - e^{-1}) = 1000 \\times 0.632 = 632\\ \\mu$C. 368 μC is what's <i>left to go</i>, and 1000 μC is the final charge." },
      { level: "medium", tag: "energy", setup: { E: 12, R: 20, C: 200 }, watch: "Charge it fully and compare the heat readout with the stored energy",
        q: "An uncharged 200 μF capacitor is connected through a resistor to a 12 V battery and left until fully charged. How much heat is produced in the resistor?",
        options: ["14.4 mJ", "28.8 mJ", "7.2 mJ", "It depends on R"], answer: 0,
        hints: ["The battery moves $Q = CE$ through an EMF $E$. How much work is that?", "The capacitor keeps $\\frac12CE^2$. Where does the rest go?"],
        explain: "The battery does $W = CE^2 = (200\\times10^{-6})(144) = 28.8$ mJ. The capacitor stores $\\frac12CE^2 = 14.4$ mJ, so the other 14.4 mJ is heat. Change $R$ and the heat stays 14.4 mJ: it only changes how long it takes." },
      { level: "hard", tag: "energy vs charge", setup: { E: 10, R: 20, C: 100 }, watch: "Watch for q = 50 % of CE and read the time and the stored energy",
        q: "A 100 μF capacitor charges through 20 kΩ from a 10 V battery, starting empty. At what time is the energy stored in it one quarter of its final value?",
        options: ["1.39 s", "0.58 s", "2.77 s", "2.00 s"], answer: 0,
        hints: ["$U \\propto q^2$, so a quarter of the energy means what fraction of the charge?", "Half the charge: $1 - e^{-t/\\tau} = \\frac12$, with $\\tau = RC = 2$ s."],
        explain: "$U = q^2/2C$, so $U = \\frac14U_{max}$ when $q = \\frac12CE$. Then $e^{-t/\\tau} = \\frac12$, so $t = \\tau\\ln 2 = 2 \\times 0.693 = 1.39$ s. 0.58 s is when $q$ is a quarter of $CE$ ($\\tau\\ln\\frac43$); 2.77 s is $\\tau\\ln 4$, when the current is a quarter." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Close switch", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_rc = {
        apply: apply, flip: flip, render: function () { update(true); },
        state: function () { var p = params(); return { t: sim.time, q: st.q, I: st.I, H: st.Hr, W: st.Wb, U: st.q * st.q / (2 * p.C), seg: st.seg, tau: tau(p), p: p, f: formula(p, sim.time), done: st.done }; }
      };
    }

    return function destroy() { sim.destroy(); [gq, gi, ge].forEach(function (g) { g.destroy(); }); };
  }
})();
