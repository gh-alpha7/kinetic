/* EMI & AC, lab 2: a series LCR circuit on an AC source (integrated with RK4, shown in slow motion with its phasors),
   and an RL circuit switched on and off (stepped with the exact exponential). */
(function () {
  "use strict";
  var SPP = 120, SUB = 20;           // AC: steps per source period (2 s on screen at 1×), RK4 substeps per step
  var SPT = 40;                      // RL: steps per time constant

  var lab = {
    id: "lcr", chapter: "emi", title: "Inductance & AC circuits", short: "phasors, impedance, resonance, RL",
    lede: "Drive a resistor, a coil and a capacitor in series from an AC source and watch it in slow motion. The three voltages spin as phasors, the current peaks at one special frequency, and the voltage across the coil can be ten times the supply.",
    tries: [
      { id: "resonance", title: "Find resonance",
        text: "Tune $\\omega$ until the current is as big as it gets (power factor above 0.999).",
        why: "At $\\omega_0 = 1/\\sqrt{LC}$ the reactances cancel, $X_L = X_C$, so $Z = R$: the current is in phase with the voltage and as large as $R$ allows." },
      { id: "lead", title: "Make the current lead the voltage",
        text: "Get the current to peak at least 30° before the source voltage.",
        why: "Below resonance $X_C > X_L$, so the circuit acts like a capacitor and $\\tan\\phi = (X_L - X_C)/R$ goes negative: the current leads." },
      { id: "magnify", title: "Get more voltage across the coil than the supply gives",
        text: "Make the rms voltage across $L$ bigger than the source's rms voltage.",
        why: "Near resonance $V_L = IX_L$ can be $Q = \\omega_0L/R$ times the supply. $V_C$ is just as big and exactly opposite, so they cancel in the sum." },
      { id: "rl", title: "Let the current build to 99%, then cut the battery out",
        text: "In the RL circuit, wait until $i \\ge 0.99\\,E/R$, then flip the switch.",
        why: "It takes about $5\\tau$ to get there, $\\tau = L/R$. When the battery goes, the coil keeps the current flowing and it dies away as $e^{-t/\\tau}$: inductors hate sudden changes in current." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 400;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });
    var mode = "ac", transient = false;

    /* ---------- controls ---------- */
    var VS = K.slider({ label: "Source voltage $V_{rms}$", unit: "V", min: 1, max: 20, step: 1, value: 10, onInput: changed });
    var wS = K.slider({ label: "Angular frequency $\\omega$", unit: "rad/s", min: 100, max: 5000, step: 10, value: 600, onInput: changed,
      hint: "$f = \\omega/2\\pi$. Sweep it and watch the current." });
    var ES = K.slider({ label: "Battery emf $E$", unit: "V", min: 1, max: 20, step: 1, value: 10, onInput: changed });
    var RS = K.slider({ label: "Resistance $R$", unit: "Ω", min: 1, max: 100, step: 1, value: 10, onInput: changed });
    var LS = K.slider({ label: "Inductance $L$", unit: "mH", min: 10, max: 500, step: 10, value: 100, onInput: changed });
    var CS = K.slider({ label: "Capacitance $C$", unit: "µF", min: 1, max: 100, step: 1, value: 10, onInput: changed });
    P.controls.innerHTML = "<h3>Circuit</h3>";
    P.controls.appendChild(K.seg([{ label: "Series LCR on AC", value: "ac" }, { label: "RL switch", value: "rl" }], "ac", function (v) { setMode(v); }, "Circuit"));
    var acBox = K.h("<div><h3>The AC source</h3></div>"), rlBox = K.h("<div><h3>The battery</h3></div>"), cBox = K.h("<div></div>");
    [VS, wS].forEach(function (s) { acBox.appendChild(s.el); });
    acBox.appendChild(K.check("Start from rest (show the switch-on transient)", false, function (v) { transient = v; changed(); }));
    rlBox.appendChild(ES.el);
    var flipBtn = K.h('<button class="btn btn-sm btn-primary" type="button">Flip the switch</button>');
    flipBtn.addEventListener("click", function () { flip(); });
    var row = K.h('<div class="row"></div>'); row.appendChild(flipBtn); rlBox.appendChild(row);
    rlBox.appendChild(K.h('<p class="control-hint">' + K.md("Flipping takes the battery out and joins the coil straight across $R$.") + "</p>"));
    rlBox.hidden = true;
    cBox.appendChild(K.h("<h3>Components</h3>"));
    [RS, LS].forEach(function (s) { cBox.appendChild(s.el); });
    var cWrap = K.h("<div></div>"); cWrap.appendChild(CS.el); cBox.appendChild(cWrap);
    P.controls.appendChild(acBox); P.controls.appendChild(rlBox); P.controls.appendChild(cBox);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>source V</span><span class="c-ten"><i></i>current</span><span class="c-disp"><i></i>V_R</span>' +
      '<span class="c-acc"><i></i>V_L</span><span class="c-normal"><i></i>V_C</span><span class="c-fric"><i></i>power</span></div>'));

    function params() {
      return { V: VS.get(), w: wS.get(), E: ES.get(), R: RS.get(), L: LS.get() * 1e-3, C: CS.get() * 1e-6 };
    }
    function solve(p) {
      var XL = p.w * p.L, XC = 1 / (p.w * p.C), Z = Math.sqrt(p.R * p.R + (XL - XC) * (XL - XC));
      var phi = Math.atan2(XL - XC, p.R), I = p.V / Z, w0 = 1 / Math.sqrt(p.L * p.C);
      return { XL: XL, XC: XC, Z: Z, phi: phi, I: I, I0: Math.SQRT2 * I, V0: Math.SQRT2 * p.V, P: p.V * I * Math.cos(phi),
        w0: w0, Q: w0 * p.L / p.R, T: 2 * Math.PI / p.w, VR: I * p.R, VL: I * XL, VC: I * XC };
    }

    /* ---------- state ---------- */
    var ac, rl, rec, dot = 0;
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    function changed() { var run = sim.running; reset(); if (run) { if (mode === "rl") start(); sim.play(); transportUI.render(); } }

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params();
      if (mode === "ac") {
        var s = solve(p);
        // steady state: i = I0 sin(ωt - φ), q = -(I0/ω) cos(ωt - φ); or everything at rest
        ac = { tc: 0, n: 0, i: transient ? 0 : s.I0 * Math.sin(-s.phi), q: transient ? 0 : -s.I0 * Math.cos(s.phi) / p.w,
          sums: zero(), meas: null, buf: [] };
        ac.buf.push(sample(0, ac.i, ac.q, p));
      } else {
        rl = { tc: 0, i: 0, closed: false, started: false, ts: 0, is: 0, ended: false, sinceFlip: 0 };
        rec = { t: [0], i: [0], f: [0], vL: [0], vLf: [0], U: [0] };
      }
      P.time.textContent = "t = 0.00 ms";
      theory(); update(true);
    }
    function zero() { return { I2: 0, P: 0, VL2: 0, VC2: 0, VLC2: 0 }; }

    function setMode(m) {
      mode = m;
      P.controls.querySelectorAll(".seg")[0].querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === m)); });
      acBox.hidden = m !== "ac"; rlBox.hidden = m !== "rl"; cWrap.hidden = m !== "ac";
      tOpts.playLabel = m === "ac" ? "Switch on" : "Close switch";
      buildPanels();
      reset();
    }

    /* ---------- AC: L di/dt + Ri + q/C = V0 sin ωt ---------- */
    function vSrc(t, p) { return Math.SQRT2 * p.V * Math.sin(p.w * t); }
    function deriv(t, i, q, p) { return [(vSrc(t, p) - p.R * i - q / p.C) / p.L, i]; }
    // instantaneous values: [t, v, vR, vL, vC, i]
    function sample(t, i, q, p) { var v = vSrc(t, p), vR = p.R * i, vC = q / p.C; return [t, v, vR, v - vR - vC, vC, i]; }

    function stepAC() {
      var p = params(), s = solve(p), h = s.T / SPP / SUB, S = ac.sums;
      var a = sample(ac.tc, ac.i, ac.q, p);
      for (var k = 0; k < SUB; k++) {
        var t = ac.tc, i = ac.i, q = ac.q;
        var k1 = deriv(t, i, q, p), k2 = deriv(t + h / 2, i + h / 2 * k1[0], q + h / 2 * k1[1], p);
        var k3 = deriv(t + h / 2, i + h / 2 * k2[0], q + h / 2 * k2[1], p), k4 = deriv(t + h, i + h * k3[0], q + h * k3[1], p);
        ac.i = i + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        ac.q = q + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        ac.tc = t + h;
        var b = sample(ac.tc, ac.i, ac.q, p);
        // trapezoid sums over this period: ∫i², ∫vi, ∫vL², ∫vC², ∫(vL + vC)²
        S.I2 += h / 2 * (a[5] * a[5] + b[5] * b[5]);
        S.P += h / 2 * (a[1] * a[5] + b[1] * b[5]);
        S.VL2 += h / 2 * (a[3] * a[3] + b[3] * b[3]);
        S.VC2 += h / 2 * (a[4] * a[4] + b[4] * b[4]);
        S.VLC2 += h / 2 * ((a[3] + a[4]) * (a[3] + a[4]) + (b[3] + b[4]) * (b[3] + b[4]));
        a = b;
      }
      ac.n++;
      ac.buf.push(a);
      if (ac.buf.length > 2 * SPP + 1) ac.buf.shift();
      if (ac.n % SPP === 0) {
        ac.meas = { Irms: Math.sqrt(S.I2 / s.T), P: S.P / s.T, VL: Math.sqrt(S.VL2 / s.T), VC: Math.sqrt(S.VC2 / s.T), VLC: Math.sqrt(S.VLC2 / s.T) };
        ac.sums = zero();
        if (Math.cos(s.phi) >= 0.999) tries.mark("resonance");
        if (s.phi <= -30 * K.DEG) tries.mark("lead");
        if (ac.meas.VL > p.V) tries.mark("magnify");
      }
    }

    /* ---------- RL: exact exponential approach to E/R (closed) or 0 (battery out) ---------- */
    function tauOf(p) { return p.L / p.R; }
    function start() { if (rl.started) return; rl.started = true; rl.closed = true; rl.ts = rl.tc; rl.is = rl.i; rl.sinceFlip = 0; }
    function flip() {
      if (mode !== "rl") return;
      if (rl.ended) reset();
      if (!rl.started) start();
      else {
        var p = params();
        rl.closed = !rl.closed; rl.ts = rl.tc; rl.is = rl.i; rl.sinceFlip = 0;
        if (!rl.closed && rl.is >= 0.99 * p.E / p.R) tries.mark("rl");
        K.flash(P.note, rl.closed ? "Battery back in: the current grows again" : "Battery out: the coil keeps the current going");
      }
      if (!sim.running) { sim.play(); transportUI.render(); }
      update(true);
    }
    function rlFormula(p) {
      var tau = tauOf(p), inf = rl.closed ? p.E / p.R : 0;
      return inf + (rl.is - inf) * Math.exp(-(rl.tc - rl.ts) / tau);
    }
    function stepRL() {
      var p = params(), tau = tauOf(p), dt = tau / SPT;
      rl.tc += dt;
      if (!rl.started) return;
      var inf = rl.closed ? p.E / p.R : 0;
      rl.i = inf + (rl.i - inf) * Math.exp(-dt / tau);
      rl.sinceFlip++;
    }

    sim.on("before", function () { if (mode === "ac") stepAC(); else stepRL(); });
    sim.on("step", function () {
      var stop = false;
      if (mode === "rl") {
        var p = params(), vL = rl.started ? (rl.closed ? p.E : 0) - rl.i * p.R : 0, f = rl.started ? rlFormula(p) : 0;
        rec.t.push(rl.tc * 1e3); rec.i.push(rl.i); rec.f.push(f); rec.vL.push(vL);
        rec.vLf.push(rl.started ? (rl.closed ? p.E : 0) - f * p.R : 0); rec.U.push(0.5 * p.L * rl.i * rl.i * 1e3);
        if (rl.sinceFlip >= 10 * SPT) {
          stop = true; sim.pause(); transportUI.render();
          K.flash(P.note, rl.closed ? "Steady: i = E/R. Flip the switch to cut the battery out" : "The current has died away", 3500);
        }
        if (rl.tc >= 60 * tauOf(p)) { rl.ended = true; stop = true; sim.pause(); transportUI.render(); }
      } else if (ac.n >= 200 * SPP) { sim.pause(); transportUI.render(); stop = true; }
      update(stop);
    });

    /* ---------- drawing ---------- */
    var LOOP = { l: 70, r: 470, t: 80, b: 320 };
    function polyDots(ctx, pts, speed, color) {
      var segs = [], tot = 0;
      for (var k = 1; k < pts.length; k++) { var d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); segs.push(d); tot += d; }
      dot = ((dot + speed) % 30 + 30) % 30;
      ctx.fillStyle = color;
      for (var s = dot; s < tot; s += 30) {
        var rem = s, j = 0;
        while (j < segs.length - 1 && rem > segs[j]) { rem -= segs[j]; j++; }
        var f = segs[j] ? rem / segs[j] : 0, x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    function wire(ctx, pts) { ctx.beginPath(); pts.forEach(function (q, k) { if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); }
    function resistorH(ctx, x0, x1, y) {
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(x0, y - 12, x1 - x0, 24);
      ctx.beginPath(); ctx.moveTo(x0, y);
      for (var k = 0; k < 8; k++) ctx.lineTo(x0 + (x1 - x0) * (k + 0.5) / 8, y + (k % 2 ? 10 : -10));
      ctx.lineTo(x1, y); ctx.stroke();
    }
    function coil(ctx, x0, x1, y, vertical) {
      var n = 5, len = x1 - x0, r = len / n / 2;
      ctx.fillStyle = th["canvas-bg"];
      if (vertical) ctx.fillRect(y - 14, x0, 28, len); else ctx.fillRect(x0, y - 14, len, 28);
      ctx.beginPath();
      for (var k = 0; k < n; k++) {
        var c = x0 + r * (2 * k + 1);
        if (vertical) ctx.arc(y, c, r, -Math.PI / 2, Math.PI / 2, false);
        else ctx.arc(c, y, r, Math.PI, 0, false);
      }
      ctx.stroke();
    }

    sim.on("over", function (ctx) {
      var p = params();
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.save(); ctx.translate(0, 22);              // room for the HUD above the circuit
      if (mode === "ac") drawAC(ctx, p); else drawRL(ctx, p);
      ctx.restore();
    });

    function drawAC(ctx, p) {
      var s = solve(p), o = LOOP, last = ac.buf[ac.buf.length - 1], i = last[5];
      wire(ctx, [[o.l, o.t], [o.r, o.t], [o.r, o.b], [o.l, o.b], [o.l, o.t]]);
      // source
      ctx.fillStyle = th.surface; ctx.beginPath(); ctx.arc(o.l, 200, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = th.grav; ctx.beginPath();
      for (var k = 0; k <= 20; k++) { var xx = o.l - 16 + k * 1.6; if (k) ctx.lineTo(xx, 200 - 9 * Math.sin(k / 20 * 2 * Math.PI)); else ctx.moveTo(xx, 200); }
      ctx.stroke(); ctx.strokeStyle = th.ink;
      resistorH(ctx, 140, 220, o.t); coil(ctx, 280, 380, o.t, false);
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(o.r - 24, 192, 48, 16);
      ctx.beginPath(); ctx.moveTo(o.r - 22, 192); ctx.lineTo(o.r + 22, 192); ctx.moveTo(o.r - 22, 208); ctx.lineTo(o.r + 22, 208); ctx.stroke();
      polyDots(ctx, [[o.l, o.t], [o.r, o.t], [o.r, o.b], [o.l, o.b], [o.l, o.t]], 4 * i / Math.max(s.I0, 1e-9), th.ten);
      var f = { font: "600 12px 'JetBrains Mono', monospace" };
      K.label(ctx, "R " + p.R + " Ω", 180, o.t - 16, th.ink, f);
      K.label(ctx, "L " + K.fmt(p.L * 1e3, 0) + " mH", 330, o.t - 16, th.ink, f);
      K.label(ctx, "C " + K.fmt(p.C * 1e6, 0) + " µF", o.r - 28, 205, th.ink, { font: f.font, align: "right" });
      K.label(ctx, "v_R " + K.fmt(last[2], 1) + " V", 180, o.t + 36, th.disp, { bg: true });
      K.label(ctx, "v_L " + K.fmt(last[3], 1) + " V", 330, o.t + 36, th.acc, { bg: true });
      K.label(ctx, "v_C " + K.fmt(last[4], 1) + " V", o.r - 28, 236, th.normal, { bg: true, align: "right" });
      K.label(ctx, "v " + K.fmt(last[1], 1) + " V", o.l + 36, 206, th.grav, { bg: true, align: "left" });
      K.label(ctx, "i " + K.fmt(i, 3) + " A", 270, o.b + 24, th.ten, { bg: true });
      // phasors (steady state), rotating at ω: projections on the vertical axis are the instantaneous values
      var cx = 760, cy = 200, wt = p.w * last[0], ti = wt - s.phi;
      var Vmax = Math.max(s.V0, s.VR * Math.SQRT2, s.VL * Math.SQRT2, s.VC * Math.SQRT2), k2 = 150 / Vmax;
      ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, s.V0 * k2, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = th["grid-strong"];
      ctx.beginPath(); ctx.moveTo(cx - 170, cy); ctx.lineTo(cx + 170, cy); ctx.moveTo(cx, cy - 180); ctx.lineTo(cx, cy + 180); ctx.stroke();
      function ph(x, y, len, ang, color, label, opt) {
        var x2 = x + len * k2 * Math.cos(ang), y2 = y - len * k2 * Math.sin(ang);
        K.arrow(ctx, x, y, x2, y2, color, Object.assign({ label: label, width: 3 }, opt || {}));
        return [x2, y2];
      }
      var r0 = s.VR * Math.SQRT2, l0 = s.VL * Math.SQRT2, c0 = s.VC * Math.SQRT2;
      var a1 = ph(cx, cy, r0, ti, th.disp, "V_R");
      var a2 = ph(a1[0], a1[1], l0, ti + Math.PI / 2, th.acc, "V_L");
      ph(a2[0], a2[1], c0, ti - Math.PI / 2, th.normal, "V_C");
      var vt = ph(cx, cy, s.V0, wt, th.grav, "V", { width: 3.5 });
      K.arrow(ctx, cx, cy, cx + 70 * Math.cos(ti), cy - 70 * Math.sin(ti), th.ten, { width: 2, label: "I", dash: [5, 4] });
      ctx.strokeStyle = K.alpha(th.grav, 0.6); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(vt[0], vt[1]); ctx.lineTo(cx, vt[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = th.grav; ctx.beginPath(); ctx.arc(cx, vt[1], 4, 0, Math.PI * 2); ctx.fill();
      var deg = s.phi / K.DEG;
      K.label(ctx, "φ = " + K.fmt(deg, 1) + "° " + (Math.abs(deg) < 0.05 ? "(in phase)" : deg > 0 ? "(current lags)" : "(current leads)"), cx, 32, th.ink, { bg: true });
    }

    function drawRL(ctx, p) {
      var o = LOOP, closed = rl.started && rl.closed, Iinf = p.E / p.R;
      // battery branch, the switch, the shorting branch, R on top and L on the right
      wire(ctx, [[130, o.t], [o.l, o.t], [o.l, o.b], [o.r, o.b], [o.r, o.t], [200, o.t]]);
      wire(ctx, [[150, 125], [150, o.b]]);
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(o.l - 20, 190, 40, 22);
      ctx.beginPath(); ctx.moveTo(o.l - 18, 192); ctx.lineTo(o.l + 18, 192); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(o.l - 9, 208); ctx.lineTo(o.l + 9, 208); ctx.stroke(); ctx.lineWidth = 2.5;
      K.label(ctx, "E " + p.E + " V", o.l + 16, 206, th.ink, { align: "left", font: "600 12px 'JetBrains Mono', monospace" });
      ctx.fillStyle = th.ink;
      [[130, o.t], [150, 125], [200, o.t]].forEach(function (q) { ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, Math.PI * 2); ctx.fill(); });
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(200, o.t);
      if (!rl.started) ctx.lineTo(140, o.t - 30); else if (closed) ctx.lineTo(130, o.t); else ctx.lineTo(150, 125);
      ctx.stroke(); ctx.lineWidth = 2.5;
      K.label(ctx, !rl.started ? "switch open" : closed ? "battery in" : "battery out", 170, o.t - 22, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      resistorH(ctx, 270, 360, o.t); coil(ctx, 150, 250, o.r, true);
      K.label(ctx, "R " + p.R + " Ω", 315, o.t - 16, th.ink, { font: "600 12px 'JetBrains Mono', monospace" });
      K.label(ctx, "L " + K.fmt(p.L * 1e3, 0) + " mH", o.r - 24, 206, th.ink, { align: "right", font: "600 12px 'JetBrains Mono', monospace" });
      var path = closed ? [[o.l, o.b], [o.l, o.t], [200, o.t], [o.r, o.t], [o.r, o.b], [o.l, o.b]] : [[150, o.b], [150, 125], [200, o.t], [o.r, o.t], [o.r, o.b], [150, o.b]];
      if (rl.i > 1e-4) polyDots(ctx, path, 4 * rl.i / Iinf, th.ten);
      var vL = rl.started ? (rl.closed ? p.E : 0) - rl.i * p.R : 0;
      K.label(ctx, "v_L " + K.fmt(vL, 2) + " V", o.r - 24, 270, th.acc, { bg: true, align: "right" });
      K.label(ctx, "i " + K.fmt(rl.i, 3) + " A", 315, o.t + 36, th.ten, { bg: true });
      // gauges: current as a fraction of E/R, and the coil's stored energy
      var gx = 560, gw = 380;
      function bar(y, frac, color, label, marks) {
        ctx.fillStyle = th.surface; ctx.fillRect(gx, y, gw, 26); ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.strokeRect(gx, y, gw, 26);
        ctx.fillStyle = color; ctx.fillRect(gx, y, gw * K.clamp(frac, 0, 1), 26);
        (marks || []).forEach(function (m) {
          ctx.strokeStyle = th.ink; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(gx + gw * m[0], y - 4); ctx.lineTo(gx + gw * m[0], y + 30); ctx.stroke(); ctx.setLineDash([]);
          K.label(ctx, m[1], gx + gw * m[0], y - 6, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
        });
        K.label(ctx, label, gx, y + 46, th.ink, { align: "left", font: "600 12px 'JetBrains Mono', monospace" });
      }
      bar(110, rl.i / Iinf, th.ten, "i / (E/R) = " + K.fmt(100 * rl.i / Iinf, 1) + "%", [[1 - Math.exp(-1), "63%"], [0.99, "99%"]]);
      bar(220, (0.5 * p.L * rl.i * rl.i) / (0.5 * p.L * Iinf * Iinf), th.acc, "energy in the coil ½Li² = " + K.fmt(0.5 * p.L * rl.i * rl.i * 1e3, 2) + " mJ");
      var tau = tauOf(p);
      K.label(ctx, rl.started ? "t − t_switch = " + K.fmt((rl.tc - rl.ts) / tau, 2) + " τ" : "press Close switch", gx + gw / 2, 340, th.ink, { bg: true });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>';
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".graph-cap");
    var g1 = new K.Graph(cv[0], { yLabel: "V", xLabel: "t (ms)", xMax: 10, color: th.grav });
    var g2 = new K.Graph(cv[1], { yLabel: "I rms (A)", xLabel: "ω (rad/s)", xMax: 3000, yMin: 0, color: th.ten });
    var g3 = new K.Graph(cv[2], { yLabel: "p (W)", xLabel: "t (ms)", xMax: 10, color: th.fric });

    function theory() {
      var p = params();
      if (mode === "ac") {
        var s = solve(p), pts = [], half = [], top = p.V / p.R;
        var xMax = Math.max(Math.ceil(2.5 * s.w0 / 500) * 500, Math.ceil(p.w * 1.2 / 500) * 500);
        xMax = Math.min(xMax, 6000);
        g2.o.xMax = xMax;
        for (var w = xMax / 400; w <= xMax + 1e-9; w += xMax / 400) pts.push([w, p.V / solve({ V: p.V, w: w, R: p.R, L: p.L, C: p.C }).Z]);
        half = [[0, top / Math.SQRT2], [xMax, top / Math.SQRT2]];
        g2.set("half", { points: half, color: K.alpha(th.muted, 0.6), width: 1 });
        g2.set("theory", { points: pts, color: th.ten, dash: [5, 5], width: 1.5 });
        g2.extra = function (ctx, X, Y) {
          ctx.strokeStyle = K.alpha(th.muted, 0.7); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(X(s.w0), Y(0)); ctx.lineTo(X(s.w0), Y(top)); ctx.stroke(); ctx.setLineDash([]);
          var m = ac.meas ? ac.meas.Irms : s.I;
          ctx.fillStyle = th.ten; ctx.beginPath(); ctx.arc(X(p.w), Y(m), ac.meas ? 5 : 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(p.w), Y(s.I), 7, 0, Math.PI * 2); ctx.stroke();
        };
        g1.o.xMax = g3.o.xMax = 2 * s.T * 1e3;
      } else {
        g2.extra = null;
        [g1, g2, g3].forEach(function (g) { g.clear(); g.o.xMax = 8 * tauOf(p) * 1e3; });
      }
    }

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params();
      if (mode === "ac") {
        var s = solve(p), b = ac.buf, now = b[b.length - 1][0], off = Math.max(0, now - 2 * s.T);
        var X = function (t) { return (t - off) * 1e3; };
        g1.set("v", { points: b.map(function (q) { return [X(q[0]), q[1]]; }), color: th.grav, width: 2 });
        g1.set("theory", { points: b.map(function (q) { return [X(q[0]), p.R * s.I0 * Math.sin(p.w * q[0] - s.phi)]; }), color: th.disp, dash: [5, 5], width: 1.5 });
        g1.set("sim", { points: b.map(function (q) { return [X(q[0]), q[2]]; }), color: th.disp, width: 2.5, dot: true });
        g3.set("theory", { points: [[0, s.P], [2 * s.T * 1e3, s.P]], color: th.fric, dash: [5, 5], width: 1.5 });
        g3.set("sim", { points: b.map(function (q) { return [X(q[0]), q[1] * q[5]]; }), color: th.fric, width: 2.5, dot: true, fill: K.alpha(th.fric, 0.12) });
      } else {
        var ser = function (arr) { return rec.t.map(function (t, k) { return [t, arr[k]]; }); };
        g1.o.xAuto = g2.o.xAuto = g3.o.xAuto = true;
        g1.set("theory", { points: ser(rec.f), color: th.ten, dash: [5, 5], width: 1.5 });
        g1.set("sim", { points: ser(rec.i), color: th.ten, width: 2.5, dot: true });
        g2.set("theory", { points: ser(rec.vLf), color: th.acc, dash: [5, 5], width: 1.5 });
        g2.set("sim", { points: ser(rec.vL), color: th.acc, width: 2.5, dot: true });
        g3.set("sim", { points: ser(rec.U), color: th.acc, width: 2.5, dot: true, fill: K.alpha(th.acc, 0.12) });
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    var eqEls, setR;
    function buildPanels() {
      var isAC = mode === "ac";
      var labels = isAC
        ? ["Reactances", "Impedance and current", "Phase angle and average power", "Resonance and the quality factor"]
        : ["Time constant", "Current since the switch flipped", "Voltage across the coil", "Energy stored in the coil"];
      P.eqs.innerHTML = labels.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = K.readout(P.readouts, isAC ? [
        { id: "I", label: "current I rms", cls: "c-ten" }, { id: "Z", label: "impedance Z" }, { id: "phi", label: "phase φ" },
        { id: "pf", label: "power factor cosφ" }, { id: "P", label: "average power", cls: "c-fric" }, { id: "VR", label: "V_R rms", cls: "c-disp" },
        { id: "VL", label: "V_L rms", cls: "c-acc" }, { id: "VC", label: "V_C rms", cls: "c-normal" }, { id: "VLC", label: "across L and C together" },
        { id: "w0", label: "resonance ω₀" }
      ] : [
        { id: "i", label: "current i", cls: "c-ten" }, { id: "pct", label: "fraction of E/R", cls: "c-ten" }, { id: "tau", label: "time constant τ" },
        { id: "vL", label: "voltage across L", cls: "c-acc" }, { id: "U", label: "energy in L", cls: "c-acc" }, { id: "t", label: "time since switch" }
      ]);
      if (isAC) {
        caps[0].innerHTML = '<b class="c-grav">source v</b> and <b class="c-disp">v_R = iR</b> · last two cycles; the gap between peaks is the phase';
        caps[1].innerHTML = '<b class="c-ten">resonance curve</b> · ' + K.md("$I_{rms}$ vs $\\omega$") + "; grey line is the half-power level, dot is your measured current";
        caps[2].innerHTML = '<b class="c-fric">power p = vi</b> · dips below zero when L and C hand energy back; dashed is the average';
        g1.o.yLabel = "V"; g1.o.xLabel = "t (ms)"; g1.o.xAuto = false; g1.o.color = th.grav; g1.o.yMin = undefined;
        g2.o.yLabel = "I rms (A)"; g2.o.xLabel = "ω (rad/s)"; g2.o.xAuto = false; g2.o.color = th.ten; g2.o.yMin = 0;
        g3.o.yLabel = "p (W)"; g3.o.xLabel = "t (ms)"; g3.o.xAuto = false; g3.o.color = th.fric; g3.o.yMin = undefined;
      } else {
        caps[0].innerHTML = '<b class="c-ten">i–t</b> · ' + K.md("$(E/R)(1 - e^{-t/\\tau})$") + " on the way up, " + K.md("$i_0e^{-t/\\tau}$") + " on the way down";
        caps[1].innerHTML = '<b class="c-acc">v_L–t</b> · the coil\'s back-emf ' + K.md("$L\\,di/dt$") + ": all of E at first, none at the end";
        caps[2].innerHTML = '<b class="c-acc">energy ½Li²</b> · stored in the magnetic field, given back to R when the battery goes';
        g1.o.yLabel = "i (A)"; g1.o.xLabel = "t (ms)"; g1.o.color = th.ten; g1.o.yMin = 0;
        g2.o.yLabel = "v_L (V)"; g2.o.xLabel = "t (ms)"; g2.o.color = th.acc; g2.o.yMin = undefined;
        g3.o.yLabel = "U (mJ)"; g3.o.xLabel = "t (ms)"; g3.o.color = th.acc; g3.o.yMin = 0;
      }
      [g1, g2, g3].forEach(function (g) { g.clear(); });
    }

    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function renderMaths() {
      var p = params();
      if (mode === "ac") {
        var s = solve(p), m = ac.meas, deg = s.phi / K.DEG;
        K.tex(eqEls[0], "X_L = \\omega L = " + B(p.w, 0) + B(p.L, 2) + " = \\mathbf{" + K.fmt(s.XL, 1) + "}\\ \\Omega,\\quad X_C = \\frac{1}{\\omega C} = \\frac{1}{" + B(p.w, 0) + B(p.C * 1e6, 0) + "\\times10^{-6}} = \\mathbf{" + K.fmt(s.XC, 1) + "}\\ \\Omega");
        K.tex(eqEls[1], "Z = \\sqrt{R^2 + (X_L - X_C)^2} = \\sqrt{" + B(p.R, 0) + "^2 + " + B(s.XL - s.XC, 1) + "^2} = \\mathbf{" + K.fmt(s.Z, 1) + "}\\ \\Omega,\\quad I = \\frac{V}{Z} = \\mathbf{" + K.fmt(s.I, 3) + "}\\ \\text{A}");
        K.tex(eqEls[2], "\\tan\\phi = \\frac{X_L - X_C}{R} \\Rightarrow \\phi = " + K.fmt(deg, 1) + "^\\circ,\\quad P = VI\\cos\\phi = " + B(p.V, 0) + B(s.I, 3) + B(Math.cos(s.phi), 3) + " = \\mathbf{" + K.fmt(s.P, 2) + "}\\ \\text{W}");
        K.tex(eqEls[3], "\\omega_0 = \\frac{1}{\\sqrt{LC}} = \\mathbf{" + K.fmt(s.w0, 0) + "}\\ \\text{rad/s},\\quad Q = \\frac{\\omega_0 L}{R} = \\mathbf{" + K.fmt(s.Q, 2) + "},\\quad V_L = IX_L = \\mathbf{" + K.fmt(s.VL, 1) + "}\\ \\text{V}");
        var note = function (f, d, u) { return m ? "formula " + K.fmt(f, d) + (u || "") : "formula (measuring…)"; };
        setR("I", K.fmt(m ? m.Irms : s.I, 3) + " A", note(s.I, 3));
        setR("Z", K.fmt(s.Z, 1) + " Ω");
        setR("phi", K.fmt(deg, 1) + "°", Math.abs(deg) < 0.05 ? "in phase" : deg > 0 ? "current lags" : "current leads");
        setR("pf", K.fmt(Math.cos(s.phi), 3), "R/Z");
        setR("P", K.fmt(m ? m.P : s.P, 2) + " W", m ? "measured ∫vi dt/T · formula " + K.fmt(s.P, 2) : "formula (measuring…)");
        setR("VR", K.fmt(m ? m.Irms * p.R : s.VR, 1) + " V");
        setR("VL", K.fmt(m ? m.VL : s.VL, 1) + " V", note(s.VL, 1));
        setR("VC", K.fmt(m ? m.VC : s.VC, 1) + " V", note(s.VC, 1));
        setR("VLC", K.fmt(m ? m.VLC : Math.abs(s.VL - s.VC), 1) + " V", "|V_L − V_C| = " + K.fmt(Math.abs(s.VL - s.VC), 1));
        setR("w0", K.fmt(s.w0, 0) + " rad/s", "f₀ = " + K.fmt(s.w0 / 2 / Math.PI, 1) + " Hz, Q = " + K.fmt(s.Q, 2));
        P.hud.innerHTML = "<span>slow motion: 1 s on screen = " + K.fmt(s.T / 2 * 1e3, 2) + " ms</span>" +
          '<span class="c-ten">I = ' + K.fmt(m ? m.Irms : s.I, 3) + " A rms</span>";
      } else {
        var tau = tauOf(p), Iinf = p.E / p.R, dt = rl.tc - rl.ts, f = rl.started ? rlFormula(p) : 0;
        var vL = rl.started ? (rl.closed ? p.E : 0) - rl.i * p.R : 0;
        K.tex(eqEls[0], "\\tau = \\frac{L}{R} = \\frac{" + K.fmt(p.L, 2) + "}{" + p.R + "} = \\mathbf{" + K.fmt(tau * 1e3, 2) + "}\\ \\text{ms}");
        if (!rl.started || rl.closed) {
          K.tex(eqEls[1], rl.is === 0
            ? "i = \\frac{E}{R}\\left(1 - e^{-t/\\tau}\\right) = " + B(Iinf, 2) + "\\left(1 - e^{-" + K.fmt(dt / tau, 2) + "}\\right) = \\mathbf{" + K.fmt(f, 3) + "}\\ \\text{A}"
            : "i = \\frac{E}{R} + \\left(i_0 - \\frac{E}{R}\\right)e^{-t/\\tau} = " + K.fmt(Iinf, 2) + " + " + B(rl.is - Iinf, 3) + "e^{-" + K.fmt(dt / tau, 2) + "} = \\mathbf{" + K.fmt(f, 3) + "}\\ \\text{A}");
          K.tex(eqEls[2], "v_L = L\\frac{di}{dt} = E - iR = " + p.E + " - " + B(rl.i, 3) + B(p.R, 0) + " = \\mathbf{" + K.fmt(vL, 2) + "}\\ \\text{V}");
        } else {
          K.tex(eqEls[1], "i = i_0e^{-t/\\tau} = " + B(rl.is, 3) + "e^{-" + K.fmt(dt / tau, 2) + "} = \\mathbf{" + K.fmt(f, 3) + "}\\ \\text{A}");
          K.tex(eqEls[2], "v_L = L\\frac{di}{dt} = -iR = -" + B(rl.i, 3) + B(p.R, 0) + " = \\mathbf{" + K.fmt(vL, 2) + "}\\ \\text{V}");
        }
        K.tex(eqEls[3], "U = \\tfrac12 Li^2 = \\tfrac12" + B(p.L, 2) + B(rl.i, 3) + "^2 = \\mathbf{" + K.fmt(0.5 * p.L * rl.i * rl.i * 1e3, 2) + "}\\ \\text{mJ}");
        setR("i", K.fmt(rl.i, 3) + " A", "formula " + K.fmt(f, 3));
        setR("pct", K.fmt(100 * rl.i / Iinf, 1) + "%", "E/R = " + K.fmt(Iinf, 2) + " A");
        setR("tau", K.fmt(tau * 1e3, 2) + " ms", "L/R");
        setR("vL", K.fmt(vL, 2) + " V");
        setR("U", K.fmt(0.5 * p.L * rl.i * rl.i * 1e3, 2) + " mJ");
        setR("t", rl.started ? K.fmt(dt * 1e3, 2) + " ms" : "—", rl.started ? "= " + K.fmt(dt / tau, 2) + " τ" : "");
        P.hud.innerHTML = "<span>slow motion: 1 s on screen = " + K.fmt(tau * 1.5 * 1e3, 2) + " ms</span>";
      }
      P.time.textContent = "t = " + K.fmt((mode === "ac" ? ac.buf[ac.buf.length - 1][0] : rl.tc) * 1e3, 2) + " ms";
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A coil fights changes in its own current: its changing flux induces a back-emf $L\\,di/dt$. Switch on an RL circuit and the current creeps up as $(E/R)(1 - e^{-t/\\tau})$ with $\\tau = L/R$. Take the battery away and it doesn't stop dead, it dies away as $e^{-t/\\tau}$.</p>" +
      "<p>On AC, each part has its own rule. In the <b class=\"c-disp\">resistor</b> the voltage is in step with the current. Across the <b class=\"c-acc\">coil</b> it runs 90° ahead, with size $IX_L$, $X_L = \\omega L$. Across the <b class=\"c-normal\">capacitor</b> it runs 90° behind, with $X_C = 1/\\omega C$. Draw them as rotating arrows (phasors) and add them tip to tail: $V^2 = V_R^2 + (V_L - V_C)^2$, so $Z = \\sqrt{R^2 + (X_L - X_C)^2}$.</p>" +
      "<p>At $\\omega_0 = 1/\\sqrt{LC}$ the coil and capacitor cancel, $Z = R$ and the current peaks. Only the resistor uses energy on average: $P = V_{rms}I_{rms}\\cos\\phi$, with power factor $\\cos\\phi = R/Z$.</p>" +
      '<div class="trap"><b>JEE trap: rms voltages don\'t add as plain numbers.</b> $V \\ne V_R + V_L + V_C$, because they peak at different times. At resonance $V_L = V_C = QV$ can be far bigger than the supply, while a voltmeter across L and C together reads zero.</div>');

    function apply(s) {
      if (s.mode !== mode) setMode(s.mode);
      RS.set(s.R); LS.set(s.L);
      if (s.mode === "ac") { VS.set(s.V); CS.set(s.C); wS.set(s.w); } else ES.set(s.E);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "resonant frequency", setup: { mode: "ac", V: 10, R: 10, L: 100, C: 10, w: 600 }, watch: "Predict ω₀, then switch on and sweep ω until the current peaks",
        q: "A series circuit has $L = 100$ mH and $C = 10\\ \\mu$F. At what angular frequency does the current peak?",
        options: ["1000 rad/s", "100 rad/s", "10 000 rad/s", "159 rad/s"], answer: 0,
        explain: "$\\omega_0 = 1/\\sqrt{LC} = 1/\\sqrt{0.1 \\times 10^{-5}} = 1/\\sqrt{10^{-6}} = 1000$ rad/s. That's $f_0 = \\omega_0/2\\pi = 159$ Hz: mixing up $\\omega$ and $f$ is the trap." },
      { level: "medium", tag: "power factor", setup: { mode: "ac", V: 10, R: 30, L: 80, C: 25, w: 1000 }, watch: "Predict P, then switch on and read the average power after one cycle",
        q: "A 10 V rms, $\\omega = 1000$ rad/s source drives $R = 30\\ \\Omega$, $L = 80$ mH and $C = 25\\ \\mu$F in series. What average power does it deliver?",
        options: ["1.2 W", "2.0 W", "1.6 W", "3.3 W"], answer: 0,
        hints: ["$X_L = \\omega L = 80\\ \\Omega$ and $X_C = 1/\\omega C = 40\\ \\Omega$. Find $Z$, then $I$.", "Only the resistor dissipates: $P = I^2R$, or $VI\\cos\\phi$ with $\\cos\\phi = R/Z$."],
        explain: "$Z = \\sqrt{30^2 + (80 - 40)^2} = 50\\ \\Omega$, so $I = 0.2$ A and $\\cos\\phi = 30/50 = 0.6$. $P = 10 \\times 0.2 \\times 0.6 = 1.2$ W $= I^2R$. 2.0 W forgets the power factor, 1.6 W uses $\\sin\\phi$, 3.3 W is $V^2/R$." },
      { level: "hard", tag: "voltage magnification", setup: { mode: "ac", V: 12, R: 20, L: 200, C: 5, w: 1000 }, watch: "Predict both voltmeter readings, then switch on and read V_L and 'across L and C together'",
        q: "A 12 V rms source at $\\omega = 1000$ rad/s drives $R = 20\\ \\Omega$, $L = 200$ mH and $C = 5\\ \\mu$F in series. What does an ideal voltmeter read across the inductor alone, and across the inductor and capacitor together?",
        options: ["120 V and 0 V", "12 V and 0 V", "120 V and 240 V", "6 V and 6 V"], answer: 0,
        hints: ["Check first: is 1000 rad/s the resonant frequency $1/\\sqrt{LC}$?", "At resonance $I = V/R$. Then $V_L = IX_L$, and $V_L$ and $V_C$ are equal and 180° apart."],
        explain: "$1/\\sqrt{0.2 \\times 5 \\times 10^{-6}} = 1000$ rad/s, so it's at resonance: $Z = R$ and $I = 12/20 = 0.6$ A. $V_L = IX_L = 0.6 \\times 200 = 120$ V, ten times the supply ($Q = \\omega_0L/R = 10$). $V_C$ is also 120 V but exactly opposite, so across L and C together the meter reads 0 V." }
    ], apply, P);

    var transportUI = null, tOpts = { playLabel: "Switch on", onReset: reset, onPlay: function () {
      if (mode === "rl") { if (rl.ended) reset(); start(); }
    } };
    transportUI = K.transport(P, sim, tOpts);
    sim.on("step", function () { renderTime(); });
    function renderTime() { P.time.textContent = "t = " + K.fmt((mode === "ac" ? ac.buf[ac.buf.length - 1][0] : rl.tc) * 1e3, 2) + " ms"; }
    buildPanels();
    reset();

    if (location.hostname === "localhost") {
      window.__lab_lcr = { apply: apply, setMode: setMode, flip: flip,
        ac: function () { var s = solve(params()); return { meas: ac.meas, phi: s.phi, s: s, i: ac.i, n: ac.n }; },
        rl: function () { return rl; } };
    }

    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); };
  }
})();
