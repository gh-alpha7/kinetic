/* SHM, lab 3: damping and resonance. A block on a spring with a dashpot, left alone or driven by a periodic force. */
(function () {
  "use strict";
  var SUB = 20, WD_MAX = 25, XDRAW = 0.7;

  var lab = {
    id: "resonance", chapter: "shm", title: "Damping & resonance", short: "e^(−bt/2m), critical damping, A(ω_d)",
    lede: "Add a damper and the swing dies away by the same factor every cycle. Too much damping and it doesn't swing at all. Then push it with a periodic force and tune the frequency: near $\\omega_0$ a small push builds a big motion.",
    tries: [
      { id: "under", title: "See the same fraction lost every swing",
        text: "Let a lightly damped block swing at least three times, with each peak visibly smaller than the last.",
        why: "Each peak is $e^{-bT'/2m}$ times the one before, a fixed ratio. That's what an exponential envelope means, and $\\ln$ of the ratio is the logarithmic decrement." },
      { id: "critical", title: "Find critical damping",
        text: "Set $b$ within 5% of the value that makes it return to rest fastest without overshooting, and release it.",
        why: "Critical damping is $b = 2\\sqrt{km}$, where $\\gamma = b/2m$ equals $\\omega_0$. Less and it overshoots; more and it creeps back slowly. Car shock absorbers aim just below it." },
      { id: "resonance", title: "Hit the resonance peak",
        text: "In driven mode, tune $\\omega_d$ until the steady amplitude is within 3% of the largest it can be.",
        why: "The peak sits at $\\omega_d = \\sqrt{\\omega_0^2 - b^2/2m^2}$, just below $\\omega_0$. Halve the damping and the peak roughly doubles in height and halves in width." },
      { id: "phase", title: "Make the block lag a quarter cycle behind the force",
        text: "In driven mode, get the measured phase lag within 3° of 90°.",
        why: "At exactly $\\omega_d = \\omega_0$ the spring and the mass cancel, the force only fights the damper, and it's in step with velocity: $x$ lags by 90°. Far below, $\\delta \\to 0$; far above, $\\delta \\to 180°$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function rk4(f, t, x, v, h) {
    var a1 = f(t, x, v);
    var x2 = x + v * h / 2, v2 = v + a1 * h / 2, a2 = f(t + h / 2, x2, v2);
    var x3 = x + v2 * h / 2, v3 = v + a2 * h / 2, a3 = f(t + h / 2, x3, v3);
    var x4 = x + v3 * h, v4 = v + a3 * h, a4 = f(t + h, x4, v4);
    return [x + h * (v + 2 * v2 + 2 * v3 + v4) / 6, v + h * (a1 + 2 * a2 + 2 * a3 + a4) / 6];
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 400, WALL = 40, EQ = 360, Y = 200, S = 200, BW = 64, BH = 60, CX = 800, CY = 200;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "free";
    var onChange = function () { reset(true); };
    var mS = K.slider({ label: "Mass $m$", unit: "kg", min: 0.5, max: 5, step: 0.1, value: 1, onInput: onChange });
    var kS = K.slider({ label: "Spring $k$", unit: "N/m", min: 10, max: 200, step: 5, value: 100, onInput: onChange });
    var bS = K.slider({ label: "Damping $b$", unit: "kg/s", min: 0, max: 40, step: 0.1, value: 1, onInput: onChange, hint: "Drag force $-bv$ from the dashpot." });
    var x0S = K.slider({ label: "Pull $x_0$", unit: "m", min: -0.5, max: 0.5, step: 0.01, value: 0.4, onInput: onChange, hint: "Or drag the block." });
    var F0S = K.slider({ label: "Force amplitude $F_0$", unit: "N", min: 0, max: 20, step: 0.5, value: 5, onInput: onChange });
    var wdS = K.slider({ label: "Driving frequency $\\omega_d$", unit: "rad/s", min: 0.5, max: WD_MAX, step: 0.1, value: 8, onInput: onChange });
    var steady = true;
    var steadyChk = K.check("Start in the steady state", true, function (v) { steady = v; reset(true); });
    P.controls.innerHTML = "<h3>Mode</h3>";
    var modeSeg = K.seg([{ label: "Free, damped", value: "free" }, { label: "Driven", value: "driven" }], mode,
      function (v) { mode = v; showMode(); reset(); }, "Mode");
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h("<h3>Oscillator</h3>"));
    [mS, kS, bS].forEach(function (s) { P.controls.appendChild(s.el); });
    var critBtn = K.h('<button class="btn btn-sm" type="button">Set b = 2√(km)</button>');
    critBtn.addEventListener("click", function () { bS.set(Math.round(2 * Math.sqrt(kS.get() * mS.get()) * 10) / 10); reset(true); });
    var wBtn = K.h('<button class="btn btn-sm" type="button">Set ω_d = ω₀</button>');
    wBtn.addEventListener("click", function () { wdS.set(Math.round(Math.sqrt(kS.get() / mS.get()) * 10) / 10); reset(true); });
    var r1 = K.h('<div class="row"></div>'); r1.appendChild(critBtn); r1.appendChild(wBtn);
    P.controls.appendChild(r1);
    var freeBox = K.h("<div><h3>Release</h3></div>"); freeBox.appendChild(x0S.el);
    var drvBox = K.h("<div><h3>Driving force $F_0\\cos\\omega_d t$</h3></div>");
    drvBox.querySelector("h3").innerHTML = K.md(drvBox.querySelector("h3").innerHTML);
    [F0S, wdS].forEach(function (s) { drvBox.appendChild(s.el); });
    drvBox.appendChild(steadyChk);
    drvBox.appendChild(K.h('<p class="control-hint">Untick it to watch the transient die away first.</p>'));
    P.controls.appendChild(freeBox); P.controls.appendChild(drvBox);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>displacement</span><span class="c-vel"><i></i>velocity</span>' +
      '<span class="c-app"><i></i>spring, driving force</span><span class="c-fric"><i></i>damping force</span></div>'));
    function showMode() { freeBox.hidden = mode !== "free"; drvBox.hidden = mode !== "driven"; wBtn.hidden = mode !== "driven"; }
    showMode();

    function params() {
      var p = { mode: mode, m: mS.get(), k: kS.get(), b: bS.get(), x0: x0S.get(), F0: F0S.get(), wd: wdS.get(), steady: steady };
      p.w0 = Math.sqrt(p.k / p.m); p.gamma = p.b / (2 * p.m); p.bc = 2 * Math.sqrt(p.k * p.m);
      p.regime = Math.abs(p.b - p.bc) <= 1e-9 * p.bc ? "critical" : p.b < p.bc ? "under" : "over";
      p.wdamp = p.regime === "under" ? Math.sqrt(p.w0 * p.w0 - p.gamma * p.gamma) : 0;
      p.A = amp(p, p.wd); p.delta = Math.atan2(p.b * p.wd / p.m, p.w0 * p.w0 - p.wd * p.wd);
      var wp2 = p.w0 * p.w0 - p.b * p.b / (2 * p.m * p.m);
      p.wpeak = wp2 > 0 ? Math.sqrt(wp2) : 0;
      p.Apeak = p.wpeak > 0 ? (p.F0 / p.m) / ((p.b / p.m) * Math.sqrt(p.w0 * p.w0 - p.b * p.b / (4 * p.m * p.m))) : p.F0 / p.k;
      return p;
    }
    function amp(p, w) { return (p.F0 / p.m) / Math.sqrt(Math.pow(p.w0 * p.w0 - w * w, 2) + Math.pow(p.b * w / p.m, 2)); }
    // exact free motion from rest at x0
    function freeX(p, t) {
      var g = p.gamma, w0 = p.w0, x0 = p.x0;
      if (p.regime === "under") return Math.exp(-g * t) * (x0 * Math.cos(p.wdamp * t) + g * x0 / p.wdamp * Math.sin(p.wdamp * t));
      if (p.regime === "critical") return x0 * (1 + w0 * t) * Math.exp(-w0 * t);
      var s = Math.sqrt(g * g - w0 * w0), ra = -g + s, rb = -g - s;
      return (-rb * x0 * Math.exp(ra * t) + ra * x0 * Math.exp(rb * t)) / (ra - rb);
    }

    /* ---------- state + physics ---------- */
    var st, rec, runs = [], p0, dragging = false, win = 10;
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    function reset(keep) {
      var wasRunning = keep === true && sim.running;
      sim.pause(); sim.resetClock();
      p0 = params();
      var p = p0, x = 0, v = 0;
      if (p.mode === "free") x = p.x0;
      else if (p.steady && isFinite(p.A)) { x = p.A * Math.cos(p.delta); v = p.A * p.wd * Math.sin(p.delta); }
      st = { t: 0, x: x, v: v, crossT: null, T: null, crossings: 0, peaks: [], gammaMeas: null, settled: null,
        wEnd: p.mode === "driven" ? 2 * Math.PI / p.wd : Infinity, wStart: 0, ic: 0, is: 0, Ameas: null, dMeas: null, isSteady: false, logged: false };
      st.f = function (t, xx, vv) { return (-p.k * xx - p.b * vv + (p.mode === "driven" ? p.F0 * Math.cos(p.wd * t) : 0)) / p.m; };
      win = p.mode === "driven" ? 20 : Math.min(20, Math.max(4, Math.ceil(8 * 2 * Math.PI / p.w0)));
      rec = { t: [0], x: [x], v: [v] };
      P.time.textContent = "t = 0.00 s";
      if (transportUI) transportUI.render();
      theory(); update(true);
      if (wasRunning) { sim.play(); transportUI.render(); }
    }

    // one sub-step, plus the measurements that need sub-step timing
    function sub(h) {
      var p = p0, x1 = st.x, v1 = st.v, t1 = st.t;
      var r = rk4(st.f, st.t, st.x, st.v, h);
      st.x = r[0]; st.v = r[1]; st.t += h;
      if (p.mode === "free") {
        if ((x1 < 0 && st.x >= 0) || (x1 > 0 && st.x <= 0)) {
          st.crossings++;
          if (x1 < 0) {
            var tc = t1 + h * (-x1) / (st.x - x1);
            if (st.crossT !== null) st.T = tc - st.crossT;
            st.crossT = tc;
          }
        }
        if (v1 > 0 && st.v <= 0) {                                   // a peak: v = 0 between the samples
          var tau = h * v1 / (v1 - st.v), xp = x1 + v1 * tau / 2;    // constant-acceleration interpolation
          st.peaks.push([t1 + tau, xp]);
          var n = st.peaks.length;
          if (n >= 2 && xp > 0 && st.peaks[n - 2][1] > 0) st.gammaMeas = Math.log(st.peaks[n - 2][1] / xp) / (st.peaks[n - 1][0] - st.peaks[n - 2][0]);
          if (n >= 3 && xp / st.peaks[n - 2][1] < 0.9) tries.mark("under");
        }
        if (st.settled === null && Math.abs(st.x) < 0.01 * Math.abs(p.x0) && Math.abs(st.v) < 0.05 * p.w0 * Math.abs(p.x0)) {
          st.settled = st.t;
          if (st.crossings === 0 && Math.abs(p.b - p.bc) <= 0.05 * p.bc && Math.abs(p.x0) > 0.02) tries.mark("critical");
        }
      } else {
        // Fourier components over exactly one driving period: x = A cos(ω_d t − δ)
        var c1 = Math.cos(p.wd * t1), s1 = Math.sin(p.wd * t1), c2 = Math.cos(p.wd * st.t), s2 = Math.sin(p.wd * st.t);
        st.ic += 0.5 * h * (x1 * c1 + st.x * c2); st.is += 0.5 * h * (x1 * s1 + st.x * s2);
      }
    }
    sim.on("before", function () {
      if (dragging) return;
      var p = p0, tEnd = (sim.steps + 1) * K.DT, h = K.DT / SUB;
      while (st.t < tEnd - 1e-12) {
        var hh = Math.min(h, tEnd - st.t);
        if (p.mode === "driven" && st.t + hh > st.wEnd) hh = st.wEnd - st.t;
        sub(hh);
        if (p.mode === "driven" && st.t >= st.wEnd - 1e-12) closeWindow();
      }
      st.t = tEnd;
    });
    function closeWindow() {
      var p = p0, Tp = 2 * Math.PI / p.wd, Xc = 2 * st.ic / Tp, Xs = 2 * st.is / Tp, A = Math.hypot(Xc, Xs);
      var prev = st.Ameas;
      st.Ameas = A; st.dMeas = ((Math.atan2(Xs, Xc) / K.DEG) + 360) % 360;
      if (st.dMeas > 270) st.dMeas -= 360;
      st.isSteady = prev !== null && Math.abs(A - prev) <= 1e-4 * A;
      st.ic = 0; st.is = 0; st.wStart = st.wEnd; st.wEnd += Tp;
      if (st.isSteady) {
        if (!st.logged) { runs.push({ m: p.m, k: p.k, b: p.b, F0: p.F0, wd: p.wd, A: A, d: st.dMeas }); st.logged = true; if (runs.length > 60) runs.shift(); }
        if (p.b > 0 && A >= 0.97 * p.Apeak) tries.mark("resonance");
        if (Math.abs(st.dMeas - 90) <= 3) tries.mark("phase");
      }
    }
    sim.on("step", function (t) {
      if (t <= win + 1e-9) { rec.t.push(t); rec.x.push(st.x); rec.v.push(st.v); }
      update(false);
    });

    /* ---------- drawing ---------- */
    function blockX() { return EQ + K.clamp(st.x, -XDRAW, XDRAW) * S; }
    function coil(ctx, x1, x2, y, n, wdt) {
      var len = x2 - x1, lead = Math.min(12, len * 0.1), body = len - 2 * lead;
      ctx.strokeStyle = th.app; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 + lead, y);
      for (var i = 0; i < 2 * n; i++) ctx.lineTo(x1 + lead + body * (i + 0.5) / (2 * n), y + (i % 2 ? -wdt : wdt));
      ctx.lineTo(x2 - lead, y); ctx.lineTo(x2, y); ctx.stroke();
    }
    sim.on("under", function (ctx) {
      var bx = blockX(), face = bx - BW / 2;
      ctx.fillStyle = th.bank; ctx.fillRect(WALL - 24, Y - 80, 24, 160);
      ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = 2; ctx.strokeRect(WALL - 24, Y - 80, 24, 160);
      ctx.fillStyle = th.ground; ctx.fillRect(WALL - 24, Y + BH / 2, 660, H - Y - BH / 2);
      ctx.fillStyle = th["ground-top"]; ctx.fillRect(WALL - 24, Y + BH / 2, 660, 2);
      coil(ctx, WALL, face, Y - 14, 9, 9);
      // dashpot: a cylinder on the wall and a piston on the block
      var cyl = 300, head = face - 110;
      ctx.strokeStyle = th.fric; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(WALL, Y + 14); ctx.lineTo(WALL + 20, Y + 14); ctx.stroke();
      ctx.fillStyle = K.alpha(th.fric, 0.12); ctx.fillRect(WALL + 20, Y + 4, cyl, 20);
      ctx.beginPath(); ctx.moveTo(WALL + 20 + cyl, Y + 4); ctx.lineTo(WALL + 20, Y + 4); ctx.lineTo(WALL + 20, Y + 24); ctx.lineTo(WALL + 20 + cyl, Y + 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(head, Y + 14); ctx.lineTo(face, Y + 14); ctx.stroke();
      ctx.fillStyle = th.fric; ctx.fillRect(head - 3, Y + 6, 6, 16);
      // equilibrium mark
      ctx.strokeStyle = th.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(EQ, Y + BH / 2 + 4); ctx.lineTo(EQ, Y + BH / 2 + 22); ctx.stroke();
      K.label(ctx, "x = 0", EQ, Y + BH / 2 + 38, th.muted);
      var len = S * 0.1;
      ctx.beginPath(); ctx.moveTo(24, H - 22); ctx.lineTo(24, H - 16); ctx.lineTo(24 + len, H - 16); ctx.lineTo(24 + len, H - 22); ctx.stroke();
      K.label(ctx, "10 cm", 32 + len, H - 10, th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
    });
    sim.on("over", function (ctx) {
      var p = p0, bx = blockX();
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.fillRect(bx - BW / 2, Y - BH / 2, BW, BH); ctx.strokeRect(bx - BW / 2, Y - BH / 2, BW, BH);
      K.label(ctx, p.m + " kg", bx, Y + 6, th.ink);
      if (Math.abs(st.x) > XDRAW) K.label(ctx, "off the scale: x = " + K.fmt(st.x, 2) + " m", bx, Y - BH / 2 - 70, th.bad, { bg: true });
      var fk = 6;                                                     // px per N
      var Fd = -p.b * st.v;
      if (Math.abs(Fd) > 0.05) K.arrow(ctx, bx, Y + 14, bx + K.clamp(Fd * fk, -150, 150), Y + 14, th.fric, { label: "−bv", lx: Fd < 0 ? -40 : 6, ly: 14 });
      if (p.mode === "driven") {
        var F = p.F0 * Math.cos(p.wd * st.t);
        K.arrow(ctx, bx, Y - BH / 2 - 14, bx + F * fk, Y - BH / 2 - 14, th.app, { label: "F " + K.fmt(F, 1) + " N", lx: F < 0 ? -84 : 6 });
      }
      if (Math.abs(st.v) > 0.01) K.arrow(ctx, bx, Y - BH / 2 - 40, bx + K.clamp(st.v * 60, -150, 150), Y - BH / 2 - 40, th.vel, { label: "v " + K.fmt(st.v, 2), lx: st.v < 0 ? -78 : 6 });
      if (!sim.running && sim.steps === 0 && p.mode === "free") K.label(ctx, "drag me", bx, Y - BH / 2 - 60, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      if (p.mode === "free") drawPortrait(ctx); else drawPhasors(ctx);
    });
    // free: the state (x, v/ω0) spirals in to the origin
    function drawPortrait(ctx) {
      var p = p0, R = 140, sc = R / Math.max(Math.abs(p.x0), 0.05);
      axes(ctx, R, "x", "v/ω₀");
      ctx.strokeStyle = K.alpha(th.disp, 0.8); ctx.lineWidth = 2; ctx.beginPath();
      rec.x.forEach(function (x, i) { var X = CX + x * sc, Yp = CY - rec.v[i] / p.w0 * sc; if (i) ctx.lineTo(X, Yp); else ctx.moveTo(X, Yp); });
      ctx.lineTo(CX + st.x * sc, CY - st.v / p.w0 * sc); ctx.stroke();
      ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(CX + st.x * sc, CY - st.v / p.w0 * sc, 5, 0, Math.PI * 2); ctx.fill();
      K.label(ctx, p.regime === "under" ? "underdamped: spirals in" : p.regime === "critical" ? "critical: straight in, no overshoot" : "overdamped: creeps in", CX, CY - R - 14, th.ink, { bg: true });
    }
    // driven: force phasor and displacement phasor, δ apart
    function drawPhasors(ctx) {
      var p = p0, R = 130, ang = p.wd * st.t, d = st.isSteady ? st.dMeas * K.DEG : p.delta;
      axes(ctx, R, "", "");
      ctx.strokeStyle = th.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.stroke();
      var Ax = isFinite(p.Apeak) && p.Apeak > 0 && isFinite(p.A) ? R * Math.min(1, p.A / p.Apeak) : R;
      var fx = CX + R * Math.cos(ang), fy = CY - R * Math.sin(ang), xx = CX + Ax * Math.cos(ang - d), xy = CY - Ax * Math.sin(ang - d);
      K.arrow(ctx, CX, CY, fx, fy, th.app, { width: 2.5, label: "F" });
      K.arrow(ctx, CX, CY, xx, xy, th.disp, { width: 2.5, label: "x" });
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.2; ctx.beginPath();
      if (d >= 0) ctx.arc(CX, CY, 34, -ang, -(ang - d)); else ctx.arc(CX, CY, 34, -(ang - d), -ang);
      ctx.stroke();
      K.label(ctx, "x lags F by δ = " + K.fmt((st.isSteady ? st.dMeas : p.delta / K.DEG), 1) + "°" + (st.isSteady ? "" : " (formula)"), CX, CY - R - 18, th.ink, { bg: true });
      K.label(ctx, "lengths: F₀ and A ÷ A_max", CX, CY + R + 30, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
    }
    function axes(ctx, R, lx, ly) {
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(CX - R - 10, CY); ctx.lineTo(CX + R + 10, CY); ctx.moveTo(CX, CY - R - 10); ctx.lineTo(CX, CY + R + 10); ctx.stroke();
      if (lx) K.label(ctx, lx, CX + R + 20, CY + 6, th.muted);
      if (ly) K.label(ctx, ly, CX + 26, CY - R + 4, th.muted);
    }

    /* ---------- drag the block (free mode) ---------- */
    sim.pointer({
      down: function (pt) {
        if (p0.mode !== "free") return false;
        var bx = blockX();
        if (Math.abs(pt.px - bx) > BW / 2 + 14 || Math.abs(pt.py - Y) > BH / 2 + 14) return false;
        sim.pause(); transportUI.render(); dragging = true; return true;
      },
      drag: function (pt) {
        if (!dragging) return;
        var x = K.clamp(Math.round((pt.px - EQ) / S * 100) / 100, -0.5, 0.5);
        x0S.set(x); st.x = x; st.v = 0;
      },
      up: function () { if (!dragging) return; dragging = false; reset(); sim.play(); transportUI.render(); }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap g1cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">A vs ω_d</b> · the resonance curve for your $m$, $k$, $b$, $F_0$; dots: your steady runs</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap g3cap"></p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var g1cap = P.graphs.querySelector(".g1cap"), g3cap = P.graphs.querySelector(".g3cap");
    var cv = P.graphs.querySelectorAll("canvas");
    var gx = new K.Graph(cv[0], { yLabel: "x (m)", xMax: 10, color: th.disp });
    var gA = new K.Graph(cv[1], { yLabel: "A (m)", xLabel: "ω_d (rad/s)", xMax: WD_MAX, yMin: 0, color: th.disp });
    var g3 = new K.Graph(cv[2], { yLabel: "E (J)", xMax: 10, yMin: 0, color: th.ink });

    function theory() {
      var p = p0, xs = [], up = [], dn = [], as = [], ds = [], es = [];
      gx.clear(); gx.o.xMax = win; g3.clear();
      var C = p.regime === "under" ? Math.abs(p.x0) * p.w0 / p.wdamp : 0;
      for (var t = 0; t <= win + 1e-9; t += win / 600) {
        if (p.mode === "free") {
          xs.push([t, freeX(p, t)]);
          if (C) { up.push([t, C * Math.exp(-p.gamma * t)]); dn.push([t, -C * Math.exp(-p.gamma * t)]); }
          es.push([t, 0.5 * p.k * p.x0 * p.x0 * Math.exp(-p.b * t / p.m)]);
        } else if (isFinite(p.A)) xs.push([t, p.A * Math.cos(p.wd * t - p.delta)]);
      }
      var amax = 0;
      for (var w = 0.05; w <= WD_MAX + 1e-9; w += 0.05) {
        var a = amp(p, w); if (!isFinite(a)) continue;
        as.push([w, a]); amax = Math.max(amax, a);
        ds.push([w, Math.atan2(p.b * w / p.m, p.w0 * p.w0 - w * w) / K.DEG]);
      }
      // b = 0 has an infinite peak: cap the curve so the rest of it stays readable
      var cap = Math.max(5 * p.F0 / p.k, isFinite(p.Apeak) ? p.Apeak * 1.05 : 0, 0.05);
      gA.series = {};
      gA.set("theory", { points: as.map(function (q) { return [q[0], Math.min(q[1], cap)]; }), color: th.disp, dash: [5, 5], width: 1.5 });
      gx.set("theory", { points: xs, color: th.disp, dash: [5, 5], width: 1.5 });
      if (up.length) { gx.set("env+", { points: up, color: K.alpha(th.fric, 0.7), dash: [3, 4], width: 1.2 }); gx.set("env-", { points: dn, color: K.alpha(th.fric, 0.7), dash: [3, 4], width: 1.2 }); }
      if (p.mode === "free") {
        g3.o = { yLabel: "E (J)", xMax: win, yMin: 0, color: th.ink };
        g3.set("theory", { points: es, color: th.ink, dash: [5, 5], width: 1.5 });
        g1cap.innerHTML = K.md("<b class=\"c-disp\">x–t</b> · dashed: exact solution; red: envelope $\\pm A e^{-bt/2m}$");
        g3cap.innerHTML = K.md("<b>Energy vs t</b> · dashed: $E_0e^{-bt/m}$, the light-damping rule (energy falls twice as fast as amplitude)");
      } else {
        g3.o = { yLabel: "δ (°)", xLabel: "ω_d (rad/s)", xMax: WD_MAX, yMin: 0, yMax: 180, color: th.ink };
        g3.set("theory", { points: ds, color: th.ink, dash: [5, 5], width: 1.5 });
        g1cap.innerHTML = K.md("<b class=\"c-disp\">x–t</b> · dashed: steady state $A\\cos(\\omega_d t - \\delta)$");
        g3cap.innerHTML = K.md("<b>Phase lag δ vs ω_d</b> · 90° exactly at $\\omega_0$; dots: measured");
      }
      void amax;
    }
    var drawGraphs = K.throttle(function () {
      var p = p0;
      gx.set("sim", { points: rec.t.map(function (t, i) { return [t, rec.x[i]]; }), color: th.disp, width: 2.5, dot: true });
      var mine = runs.filter(function (r) { return r.m === p.m && r.k === p.k && r.b === p.b && r.F0 === p.F0; });
      gA.extra = function (ctx, X, Y2) {
        dots(ctx, X, Y2, mine.map(function (r) { return [r.wd, r.A]; }), th.disp);
        if (p.mode === "driven" && isFinite(p.A)) ring(ctx, X(p.wd), Y2(p.A));
        if (p.wpeak > 0) { ctx.strokeStyle = K.alpha(th.muted, 0.6); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(X(p.w0), Y2(0)); ctx.lineTo(X(p.w0), 12); ctx.stroke(); ctx.setLineDash([]); }
      };
      if (p.mode === "free") {
        g3.set("sim", { points: rec.t.map(function (t, i) { return [t, 0.5 * p.m * rec.v[i] * rec.v[i] + 0.5 * p.k * rec.x[i] * rec.x[i]]; }), color: th.ink, width: 2.5, dot: true });
        g3.extra = null;
      } else {
        g3.extra = function (ctx, X, Y2) {
          dots(ctx, X, Y2, mine.map(function (r) { return [r.wd, r.d]; }), th.ink);
          if (st.isSteady) ring(ctx, X(p.wd), Y2(st.dMeas));
        };
      }
      [gx, gA, g3].forEach(function (g) { g.dirty = true; g.draw(); });
    }, 50);
    function dots(ctx, X, Y2, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y2(q[1]), 4.5, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLab = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "r1", label: "" }, { id: "r2", label: "" }, { id: "r3", label: "" }, { id: "r4", label: "" }, { id: "r5", label: "" }, { id: "r6", label: "" }
    ]);
    var rLabels = P.readouts.querySelectorAll(".readout > span");
    function rl(i, text) { rLabels[i].textContent = text; }
    var slowMaths = K.throttle(renderMaths, 100);
    function renderMaths() {
      var p = p0, f3 = function (v) { return K.fmt(v, 3); };
      K.tex(eqEls[0], "\\omega_0 = \\sqrt{\\tfrac{k}{m}} = \\sqrt{\\tfrac{" + p.k + "}{" + p.m + "}} = \\mathbf{" + f3(p.w0) + "}\\ \\text{rad/s},\\quad \\gamma = \\tfrac{b}{2m} = \\tfrac{" + p.b + "}{2(" + p.m + ")} = \\mathbf{" + f3(p.gamma) + "}\\ \\text{s}^{-1}");
      eqLab[0].textContent = "Natural frequency and decay rate";
      if (p.mode === "free") {
        eqLab[1].textContent = "Critical damping"; eqLab[2].textContent = "Damped frequency"; eqLab[3].textContent = "Envelope";
        K.tex(eqEls[1], "b_c = 2\\sqrt{km} = 2\\sqrt{" + p.k + "\\times" + p.m + "} = \\mathbf{" + K.fmt(p.bc, 2) + "}\\ \\text{kg/s}\\ \\Rightarrow\\ \\text{" + (p.regime === "under" ? "underdamped" : p.regime === "critical" ? "critically damped" : "overdamped") + "}");
        K.tex(eqEls[2], p.regime === "under"
          ? "\\omega' = \\sqrt{\\omega_0^2 - \\gamma^2} = \\mathbf{" + f3(p.wdamp) + "}\\ \\text{rad/s},\\quad T' = \\tfrac{2\\pi}{\\omega'} = \\mathbf{" + f3(2 * Math.PI / p.wdamp) + "}\\ \\text{s}"
          : "\\gamma \\ge \\omega_0:\\ \\text{no oscillation, } x \\text{ never crosses } 0");
        K.tex(eqEls[3], "A(t) = A_0e^{-\\gamma t},\\quad t_{1/2} = \\tfrac{\\ln 2}{\\gamma} = \\mathbf{" + (p.gamma > 0 ? K.fmt(Math.LN2 / p.gamma, 3) + "}\\ \\text{s}" : "\\infty}"));
        rl(0, "regime"); setR("r1", p.regime, "b = " + p.b + ", b_c = " + K.fmt(p.bc, 2) + " kg/s");
        rl(1, "damped period T′"); setR("r2", st.T ? f3(st.T) + " s" : "—", p.regime === "under" ? "measured · formula " + f3(2 * Math.PI / p.wdamp) + " s" : "no period");
        rl(2, "decay rate from peaks"); setR("r3", st.gammaMeas !== null ? K.fmt(st.gammaMeas, 4) + " s⁻¹" : "—", "formula b/2m = " + K.fmt(p.gamma, 4));
        rl(3, "peak ratio"); var n = st.peaks.length;
        setR("r4", n >= 2 && st.peaks[n - 2][1] > 0 ? K.fmt(st.peaks[n - 1][1] / st.peaks[n - 2][1], 4) : "—", p.regime === "under" ? "formula e^(−γT′) = " + K.fmt(Math.exp(-p.gamma * 2 * Math.PI / p.wdamp), 4) : "");
        rl(4, "overshoots"); setR("r5", String(st.crossings), "times it crossed x = 0");
        rl(5, "back to rest (1%)"); setR("r6", st.settled !== null ? K.fmt(st.settled, 2) + " s" : "—", "");
      } else {
        eqLab[1].textContent = "Steady-state amplitude"; eqLab[2].textContent = "Phase lag"; eqLab[3].textContent = "Where the peak is";
        K.tex(eqEls[1], "A = \\frac{F_0/m}{\\sqrt{(\\omega_0^2 - \\omega_d^2)^2 + (b\\omega_d/m)^2}} = \\frac{" + K.fmt(p.F0 / p.m, 2) + "}{\\sqrt{(" + K.fmt(p.w0 * p.w0, 1) + " - " + K.fmt(p.wd * p.wd, 2) + ")^2 + (" + K.fmt(p.b * p.wd / p.m, 2) + ")^2}} = \\mathbf{" + (isFinite(p.A) ? K.fmt(p.A, 4) : "\\infty") + "}\\ \\text{m}");
        K.tex(eqEls[2], "\\tan\\delta = \\frac{b\\omega_d/m}{\\omega_0^2 - \\omega_d^2} = \\frac{" + K.fmt(p.b * p.wd / p.m, 2) + "}{" + K.fmt(p.w0 * p.w0 - p.wd * p.wd, 2) + "}\\ \\Rightarrow\\ \\delta = \\mathbf{" + K.fmt(p.delta / K.DEG, 1) + "^\\circ}");
        K.tex(eqEls[3], p.wpeak > 0
          ? "\\omega_{\\text{peak}} = \\sqrt{\\omega_0^2 - \\tfrac{b^2}{2m^2}} = \\mathbf{" + f3(p.wpeak) + "}\\ \\text{rad/s},\\quad A_{\\max} = \\mathbf{" + (isFinite(p.Apeak) ? K.fmt(p.Apeak, 4) : "\\infty") + "}\\ \\text{m}"
          : "b^2 \\ge 2km:\\ \\text{no peak, } A \\text{ is largest at } \\omega_d \\to 0");
        rl(0, "steady amplitude"); setR("r1", st.Ameas !== null ? K.fmt(st.Ameas, 4) + " m" : "—", (st.isSteady ? "measured" : "settling…") + " · formula " + (isFinite(p.A) ? K.fmt(p.A, 4) : "∞"));
        rl(1, "phase lag δ"); setR("r2", st.dMeas !== null ? K.fmt(st.dMeas, 1) + "°" : "—", "formula " + K.fmt(p.delta / K.DEG, 1) + "°");
        rl(2, "A ÷ A_max"); setR("r3", st.Ameas !== null && isFinite(p.Apeak) ? K.fmt(st.Ameas / p.Apeak, 3) : "—", "1 at the peak");
        rl(3, "static stretch F₀/k"); setR("r4", K.fmt(p.F0 / p.k, 4) + " m", "A at ω_d → 0");
        rl(4, "ω_d ÷ ω₀"); setR("r5", K.fmt(p.wd / p.w0, 3), "");
        rl(5, "displacement now"); setR("r6", K.fmt(st.x, 4) + " m", "");
      }
      P.hud.innerHTML = "<span>ω₀ = " + K.fmt(p.w0, 2) + " rad/s</span><span>b_c = " + K.fmt(p.bc, 1) + " kg/s</span>" + (p.mode === "driven" ? "<span>ω_d = " + K.fmt(p.wd, 1) + " rad/s</span>" : "");
    }
    function update(force) { drawGraphs(); if (force) renderMaths(); else slowMaths(); }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A dashpot adds a drag force $-bv$, so $m\\ddot x = -kx - b\\dot x$. With light damping the motion is still a cosine, but inside an <b>exponential envelope</b> $A_0e^{-\\gamma t}$ with $\\gamma = b/2m$, and it swings a little slower: $\\omega' = \\sqrt{\\omega_0^2 - \\gamma^2}$. Energy goes as amplitude squared, so it falls as $e^{-bt/m}$.</p>" +
      "<p>When $\\gamma = \\omega_0$, that is $b = 2\\sqrt{km}$, it's <b>critically damped</b>: back to rest fastest with no overshoot. More damping is <i>overdamped</i> and slower.</p>" +
      "<p>Drive it with $F_0\\cos\\omega_d t$ and, once the transient has died, it moves at $\\omega_d$ with amplitude $A = \\dfrac{F_0/m}{\\sqrt{(\\omega_0^2 - \\omega_d^2)^2 + (b\\omega_d/m)^2}}$, lagging the force by $\\delta$. That curve is the <b>resonance curve</b>: tall and sharp for small $b$, flat for large $b$.</p>" +
      '<div class="trap"><b>JEE trap: the amplitude peak is not at ω₀.</b> With damping, maximum amplitude is at $\\sqrt{\\omega_0^2 - b^2/2m^2}$, slightly below $\\omega_0$, and the free damped frequency $\\sqrt{\\omega_0^2 - b^2/4m^2}$ is different again. Only the 90° phase lag (and the peak in velocity amplitude) sits exactly at $\\omega_0$.</div>');
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === v)); }); }
    function apply(s) {
      mode = s.mode; setSeg(modeSeg, mode); showMode();
      mS.set(s.m); kS.set(s.k); bS.set(s.b);
      if (s.x0 != null) x0S.set(s.x0);
      if (s.F0 != null) F0S.set(s.F0);
      if (s.wd != null) wdS.set(s.wd);
      if (s.steady != null) { steady = s.steady; steadyChk.querySelector("input").checked = steady; }
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "critical damping", setup: { mode: "free", m: 1, k: 100, b: 20, x0: 0.4 }, watch: "Release it: does it cross x = 0? Then try b = 15 and b = 30",
        q: "A 1 kg block on a 100 N/m spring has a damper. What damping constant $b$ makes it critically damped?",
        options: ["10 kg/s", "20 kg/s", "100 kg/s", "200 kg/s"], answer: 1,
        explain: "Critical damping is $\\gamma = b/2m = \\omega_0$, so $b = 2m\\omega_0 = 2\\sqrt{km} = 2\\sqrt{100} = 20$ kg/s. 10 kg/s is $\\sqrt{km}$, missing the 2." },
      { level: "medium", tag: "amplitude half-life", setup: { mode: "free", m: 1, k: 100, b: 0.4, x0: 0.4 }, watch: "Release it and find when the peaks drop below 0.2 m",
        q: "A 1 kg block on a 100 N/m spring is damped with $b = 0.4$ kg/s and released from 0.4 m. How long until its amplitude has halved?",
        options: ["1.73 s", "3.47 s", "5.00 s", "6.93 s"], answer: 1,
        hints: ["The amplitude falls as $e^{-bt/2m}$.", "Set $e^{-bt/2m} = \\tfrac12$ and solve: $t = 2m\\ln 2/b$."],
        explain: "$\\gamma = b/2m = 0.2$ s⁻¹, so $t_{1/2} = \\ln 2/\\gamma = 0.693/0.2 = 3.47$ s. 1.73 s is when the <i>energy</i> halves ($e^{-bt/m}$), and 5.00 s is $1/\\gamma$, when it's down to $1/e$." },
      { level: "hard", tag: "peak of the resonance curve", setup: { mode: "driven", m: 1, k: 100, b: 4, F0: 5, wd: 9.6, steady: false }, watch: "Release and wait for the amplitude to settle, then nudge ω_d either side of 9.6",
        q: "A 1 kg block on a 100 N/m spring, damping $b = 4$ kg/s, is driven by $F = 5\\cos\\omega_d t$ N. At what $\\omega_d$ is the steady-state amplitude largest, and how large is it?",
        options: ["9.59 rad/s and 0.128 m", "10.0 rad/s and 0.125 m", "9.80 rad/s and 0.128 m", "9.59 rad/s and 0.250 m"], answer: 0,
        hints: ["Maximise $A$ by minimising $(\\omega_0^2 - \\omega_d^2)^2 + (b\\omega_d/m)^2$ over $\\omega_d^2$.", "That gives $\\omega_d^2 = \\omega_0^2 - b^2/2m^2$. Put it back into $A$."],
        explain: "$\\omega_{\\text{peak}}^2 = 100 - 16/2 = 92$, so $\\omega_{\\text{peak}} = 9.59$ rad/s. There $A = \\dfrac{F_0/m}{(b/m)\\sqrt{\\omega_0^2 - b^2/4m^2}} = \\dfrac{5}{4\\sqrt{96}} = 0.128$ m. Driving at exactly $\\omega_0 = 10$ gives $F_0/b\\omega_0 = 0.125$ m, a little less; 9.80 rad/s is the free damped frequency, a different thing." }
    ], apply, P);

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_resonance = { apply: apply, state: function () { return st; }, params: function () { return p0; }, runs: runs,
        xAt: function (t) { return rec.x[Math.round(t / K.DT)]; } };
    }

    return function destroy() { sim.destroy(); [gx, gA, g3].forEach(function (g) { g.destroy(); }); };
  }
})();
