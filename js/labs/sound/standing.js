/* Waves & sound, lab 2: standing waves. A driven string fixed at both ends, and air columns open at both ends or closed at one. */
(function () {
  "use strict";
  var GL = 0.12;            // damping: amplitude lost per length, γL (sets how sharp the resonances are)
  var A_DRIVE = 0.05;       // the string vibrator's own amplitude (m)
  var SLOW = 0.6;           // pipes are shown in slow motion: one cycle every 1/SLOW s on screen
  var NX = 101;

  var lab = {
    id: "standing", chapter: "sound", title: "Standing waves", short: "harmonics, nodes, organ pipes",
    lede: "Drive a string or an air column and sweep the frequency. Almost nothing happens, until the waves going each way line up: then it rings, with nodes that never move.",
    tries: [
      { id: "third", title: "Find the third harmonic of the string",
        text: "Sweep the driving frequency until the string rings in three loops.",
        why: "Three loops means $L = 3\\lambda/2$, so $f_3 = 3v/2L$: exactly three times the fundamental. Only frequencies that fit whole half-wavelengths between the two fixed ends can build up." },
      { id: "open", title: "Find $f_1$ and $f_2$ of an open pipe",
        text: "Switch to the open–open pipe and find its two lowest resonances.",
        why: "Both ends are displacement antinodes, so the pipe holds $n$ half-wavelengths: $f_n = nv/2L$. Every harmonic is there, so $f_2 = 2f_1$." },
      { id: "closed", title: "Find the two lowest resonances of a closed pipe",
        text: "Switch to closed–open and find its first two resonances. Compare their ratio with the open pipe's.",
        why: "A closed end is a displacement node and the open end an antinode, so the pipe holds an odd number of quarter-wavelengths: $f = (2n-1)v/4L$. The ratio is 1 : 3. There is no $2f_1$." },
      { id: "melde", title: "Make the string resonate without touching $f$",
        text: "Leave the driving frequency alone and change only $T$, $\\mu$ or $L$ until the string rings.",
        why: "Resonance needs $f = nv/2L$ with $v = \\sqrt{T/\\mu}$. Changing the string moves the harmonics onto your fixed $f$. Melde's experiment does exactly this: $n \\propto 1/\\sqrt{T}$ at fixed $f$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- complex numbers, just enough ---------- */
  function C(re, im) { return { re: re, im: im }; }
  function csin(a, b) { return C(Math.sin(a) * Math.cosh(b), Math.cos(a) * Math.sinh(b)); }      // sin(a + ib)
  function ccos(a, b) { return C(Math.cos(a) * Math.cosh(b), -Math.sin(a) * Math.sinh(b)); }     // cos(a + ib)
  function cdiv(p, q) { var d = q.re * q.re + q.im * q.im; return C((p.re * q.re + p.im * q.im) / d, (p.im * q.re - p.re * q.im) / d); }
  function cabs(z) { return Math.hypot(z.re, z.im); }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 320, X0 = 80, X1 = 920, CY = 150, SY = 170;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 50, origin: { x: X0, y: CY }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "string", lastChange = null, sweep = false, sweepF = null, showTwo = true;
    var LS = K.slider({ label: "String length $L$", unit: "m", min: 2, max: 10, step: 0.5, value: 4, onInput: function () { changed("string"); } });
    var TS = K.slider({ label: "Tension $T$", unit: "N", min: 1, max: 16, step: 0.5, value: 4, onInput: function () { changed("string"); } });
    var muS = K.slider({ label: "Linear density $\\mu$", unit: "kg/m", min: 0.05, max: 1, step: 0.05, value: 0.25, onInput: function () { changed("string"); } });
    var fS = K.slider({ label: "Driving frequency $f$", unit: "Hz", min: 0.05, max: 3, step: 0.005, value: 0.9, digits: 3, onInput: function () { changed("f"); },
      hint: "Sweep it slowly. Watch the amplitude, and the resonance curve below." });
    var pLS = K.slider({ label: "Pipe length $L$", unit: "m", min: 0.1, max: 2, step: 0.01, value: 0.5, onInput: function () { changed("pipe"); } });
    var vS = K.slider({ label: "Speed of sound $v$", unit: "m/s", min: 300, max: 360, step: 2, value: 340, onInput: function () { changed("pipe"); } });
    var pfS = K.slider({ label: "Driving frequency $f$", unit: "Hz", min: 20, max: 2000, step: 1, value: 300, onInput: function () { changed("f"); },
      hint: "A loudspeaker at the end. The animation is slowed right down so you can see the air move." });
    function segSet(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    var modeSeg = K.seg([{ label: "String", value: "string" }, { label: "Pipe: open–open", value: "open" }, { label: "Pipe: closed–open", value: "closed" }], "string",
      function (v) { setMode(v); }, "What vibrates");
    P.controls.innerHTML = "<h3>What vibrates</h3>";
    P.controls.appendChild(modeSeg);
    var strBox = K.h("<div><h3>The string</h3></div>"), pipeBox = K.h("<div><h3>The air column</h3></div>");
    [LS, TS, muS, fS].forEach(function (s) { strBox.appendChild(s.el); });
    [pLS, vS, pfS].forEach(function (s) { pipeBox.appendChild(s.el); });
    P.controls.appendChild(strBox); P.controls.appendChild(pipeBox);
    P.controls.appendChild(K.h("<h3>Find the resonances</h3>"));
    var row = K.h('<div class="row"></div>');
    var sweepChk = K.check("Auto-sweep f upwards while playing", false, function (v) { sweep = v; sweepF = null; });
    row.appendChild(sweepChk);
    var twoChk = K.check("The two travelling waves", true, function (v) { showTwo = v; });
    row.appendChild(twoChk);
    P.controls.appendChild(row);
    var jump = K.h('<div class="row"></div>');
    [["◀ previous harmonic", -1], ["next harmonic ▶", 1]].forEach(function (b) {
      var el = K.h('<button class="btn btn-sm" type="button">' + b[0] + "</button>");
      el.addEventListener("click", function () {
        var p = params(), h = nearest(p).h, step = mode === "closed" ? 2 : 1, nh = Math.max(1, h + b[1] * step);
        var fn = mode === "closed" ? nh * p.v / (4 * p.L) : nh * p.v / (2 * p.L);
        var s = mode === "string" ? fS : pfS;
        // land a little below it, so you still have to find the peak yourself
        s.set(K.clamp(fn * 0.95, +s.input.min, +s.input.max)); changed("f");
        K.flash(P.note, "Near harmonic " + nh + ": now nudge f up to find the peak");
      });
      jump.appendChild(el);
    });
    P.controls.appendChild(jump);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>displacement</span><span class="c-acc"><i></i>pressure (pipes)</span>' +
      '<span class="c-app"><i></i>wave going →</span><span class="c-ten"><i></i>wave going ←</span></div>'));

    function setMode(v) {
      mode = v; segSet(modeSeg, v);
      strBox.hidden = v !== "string"; pipeBox.hidden = v === "string";
      twoChk.hidden = v !== "string";
      visited = {}; found[v] = found[v] || {};
      buildPanels(); configGraphs(); changed(null);
    }

    function params() {
      if (mode === "string") {
        var T = TS.get(), mu = muS.get();
        return { L: LS.get(), T: T, mu: mu, v: Math.sqrt(T / mu), f: fS.get(), fMax: 3 };
      }
      return { L: pLS.get(), v: vS.get(), f: pfS.get(), fMax: 2000 };
    }
    function f1(p) { return mode === "closed" ? p.v / (4 * p.L) : p.v / (2 * p.L); }
    // the nearest resonance: n counts resonances, h is the harmonic number (h = 2n − 1 for a closed pipe)
    function nearest(p, f) {
      f = f === undefined ? p.f : f;
      var b = f1(p), n = mode === "closed" ? Math.max(1, Math.round((f / b + 1) / 2)) : Math.max(1, Math.round(f / b));
      var h = mode === "closed" ? 2 * n - 1 : n;
      return { n: n, h: h, f: h * b, lam: mode === "closed" ? 4 * p.L / h : 2 * p.L / h };
    }

    /* ---------- the driven, lightly damped steady state (exact) ---------- */
    // k = ω/v − iγ. String: driver at x = 0, fixed at L: y = a sin k(L−x) / sin kL.
    // Open pipe (source at x = 0, open at L): p ∝ sin k(L−x) / sin kL, s ∝ cos k(L−x) / sin kL.
    // Closed pipe (speaker in the closed end, open at L): s ∝ cos k(L−x) / cos kL, p ∝ sin k(L−x) / cos kL.
    function field(p, f, x) {
      var kr = 2 * Math.PI * f / p.v, ki = GL / p.L, u = p.L - x;
      var sinU = csin(kr * u, -ki * u), cosU = ccos(kr * u, -ki * u);
      if (mode === "string") { var d = cdiv(sinU, csin(kr * p.L, -GL)); return { s: C(d.re * A_DRIVE, d.im * A_DRIVE), kr: kr }; }
      var norm = Math.sinh(GL);       // pipes in relative units: 1 = the height of a resonance peak
      var den = mode === "open" ? csin(kr * p.L, -GL) : ccos(kr * p.L, -GL);
      var s = cdiv(cosU, den), pr = cdiv(sinU, den);
      return { s: C(s.re * norm, s.im * norm), p: C(pr.re * norm, pr.im * norm), kr: kr };
    }
    function amp(p, f) { var m = 0; for (var i = 0; i < NX; i++) m = Math.max(m, cabs(field(p, f, p.L * i / (NX - 1)).s)); return m; }
    function phase(p, t) { return 2 * Math.PI * (mode === "string" ? p.f : SLOW) * t; }
    function val(z, th) { return z.re * Math.cos(th) - z.im * Math.sin(th); }    // Re[z e^{iθ}]

    /* ---------- state ---------- */
    var visited = {}, found = { string: {} }, env, penv, mid, ringing = null, transportUI = null;
    function clearEnv() { env = []; penv = []; for (var i = 0; i < NX; i++) { env.push(0); penv.push(0); } }
    function record(p) {
      var a = amp(p, p.f);
      visited[p.f.toFixed(3)] = [p.f, a];
      return a;
    }
    function changed(what) {
      if (what === "f") sweepF = null;
      if (what) lastChange = what;
      if (what === "string" || what === "pipe") { visited = {}; if (what === "pipe") found[mode] = {}; }
      clearEnv();
      var p = params();
      record(p); detect(p); theory(); update(true);
    }
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      visited = {}; mid = { t: [], y: [] };
      sweep = false; sweepChk.querySelector("input").checked = false;
      P.time.textContent = "t = 0.00 s";
      changed(null);
    }
    // is it ringing? within 70 % of the peak at the nearest harmonic
    function detect(p) {
      var nr = nearest(p), ratio = amp(p, p.f) / amp(p, nr.f);
      ringing = ratio >= 0.7 ? nr : null;
      if (!ringing) return;
      found[mode] = found[mode] || {};
      if (!found[mode][nr.h]) K.flash(P.note, "Resonance! Harmonic " + nr.h + " at " + K.fmt(nr.f, mode === "string" ? 3 : 1) + " Hz");
      found[mode][nr.h] = true;
      if (mode === "string" && nr.h === 3) tries.mark("third");
      if (mode === "string" && lastChange === "string") tries.mark("melde");
      if (mode === "open" && found.open[1] && found.open[2]) tries.mark("open");
      if (mode === "closed" && found.closed[1] && found.closed[3]) tries.mark("closed");
    }

    sim.on("step", function (t) {
      var p = params();
      if (sweep) {
        var s = mode === "string" ? fS : pfS, rate = mode === "string" ? 0.04 : 25;
        if (sweepF === null) sweepF = p.f;
        sweepF += rate * K.DT;
        var nf = sweepF;
        if (nf >= +s.input.max) { sweep = false; sweepChk.querySelector("input").checked = false; nf = +s.input.max; }
        s.set(Math.round(nf / +s.input.step) * +s.input.step);
        p = params(); record(p); detect(p); clearEnv();
      }
      var th0 = phase(p, t);
      for (var i = 0; i < NX; i++) {
        var F = field(p, p.f, p.L * i / (NX - 1));
        env[i] = Math.max(env[i], Math.abs(val(F.s, th0)));
        if (F.p) penv[i] = Math.max(penv[i], Math.abs(val(F.p, th0)));
      }
      if (mode === "string") {
        mid.t.push(t); mid.y.push(val(field(p, p.f, p.L / 2).s, th0));
        if (mid.t.length > 600) { mid.t.shift(); mid.y.shift(); }
      }
      update(false);
    });

    /* ---------- drawing ---------- */
    function xp(p, x) { return X0 + x / p.L * (X1 - X0); }
    sim.on("under", function (ctx) {
      var p = params();
      ctx.fillStyle = th.muted; ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      var step = p.L <= 0.6 ? 0.1 : p.L <= 2 ? 0.25 : 1;
      for (var x = 0; x <= p.L + 1e-9; x += step) {
        ctx.fillRect(xp(p, x) - 0.75, H - 30, 1.5, 6);
        ctx.fillText(K.fmt(x, step < 1 ? 2 : 0) + " m", xp(p, x), H - 22);
      }
      if (mode === "string") {
        ctx.strokeStyle = th["grid-strong"]; ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X0, CY); ctx.lineTo(X1, CY); ctx.stroke(); ctx.setLineDash([]);
        // vibrator at the left, clamp at the right
        var dy = val(field(p, p.f, 0).s, phase(p, sim.time)) * SY;
        ctx.fillStyle = th.body; ctx.fillRect(X0 - 46, CY - 40, 30, 80);
        ctx.fillStyle = th.ink; ctx.fillRect(X0 - 16, CY - dy - 4, 16, 8);
        K.label(ctx, "vibrator", X0 - 31, CY - 46, th.muted);
        ctx.fillStyle = th.ground; ctx.fillRect(X1, CY - 90, 16, 180);
        K.label(ctx, "fixed", X1 + 8, CY - 96, th.muted);
      } else {
        // the tube
        ctx.fillStyle = K.alpha(th.disp, 0.06); ctx.fillRect(X0, CY - 60, X1 - X0, 120);
        ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(X0, CY - 60); ctx.lineTo(X1, CY - 60); ctx.moveTo(X0, CY + 60); ctx.lineTo(X1, CY + 60); ctx.stroke();
        if (mode === "closed") { ctx.fillStyle = th.ink; ctx.fillRect(X0 - 10, CY - 64, 10, 128); K.label(ctx, "closed", X0 - 5, CY - 68, th.muted); }
        else K.label(ctx, "open", X0, CY - 68, th.muted);
        K.label(ctx, "open", X1, CY - 68, th.muted);
        // the source
        ctx.fillStyle = th.body; ctx.beginPath(); ctx.moveTo(X0 - (mode === "closed" ? 40 : 30), CY - 22); ctx.lineTo(X0 - (mode === "closed" ? 12 : 4), CY - 36);
        ctx.lineTo(X0 - (mode === "closed" ? 12 : 4), CY + 36); ctx.lineTo(X0 - (mode === "closed" ? 40 : 30), CY + 22); ctx.closePath(); ctx.fill();
      }
    });

    sim.on("over", function (ctx) {
      var p = params(), ph = phase(p, sim.time), i, x, F;
      if (mode === "string") {
        if (showTwo) {
          // the standing wave split into two equal waves going opposite ways: (|C|/2)[sin(k(L−x) + ωt + c) + sin(k(L−x) − ωt − c)]
          var Cc = cdiv(C(A_DRIVE, 0), csin(2 * Math.PI * p.f / p.v * p.L, -GL));
          var c = Math.atan2(Cc.im, Cc.re), half = cabs(Cc) / 2, kr = 2 * Math.PI * p.f / p.v;
          [[1, th.app], [-1, th.ten]].forEach(function (w) {
            ctx.strokeStyle = K.alpha(w[1], 0.85); ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
            ctx.beginPath();
            for (i = 0; i <= 300; i++) {
              x = p.L * i / 300;
              var yy = half * Math.sin(kr * (p.L - x) + w[0] * (ph + c));
              if (i) ctx.lineTo(xp(p, x), CY - yy * SY); else ctx.moveTo(xp(p, x), CY - yy * SY);
            }
            ctx.stroke(); ctx.setLineDash([]);
          });
        }
        ctx.strokeStyle = th.disp; ctx.lineWidth = 3; ctx.lineJoin = "round";
        ctx.beginPath();
        for (i = 0; i <= 300; i++) {
          x = p.L * i / 300; F = field(p, p.f, x);
          var y = CY - val(F.s, ph) * SY;
          if (i) ctx.lineTo(xp(p, x), y); else ctx.moveTo(xp(p, x), y);
        }
        ctx.stroke();
      } else {
        // air: rows of particles pushed along the tube by s(x, t)
        var cols = 56, rows = 7, gap = (X1 - X0) / cols;
        ctx.fillStyle = th.body;
        for (i = 0; i <= cols; i++) {
          x = p.L * i / cols; F = field(p, p.f, x);
          var dx = K.clamp(val(F.s, ph), -1.2, 1.2) * gap * 0.9;
          for (var r = 0; r < rows; r++) {
            ctx.beginPath(); ctx.arc(X0 + i * gap + dx, CY - 48 + r * 16, 2.6, 0, Math.PI * 2); ctx.fill();
          }
        }
        // displacement and pressure along the tube, right now
        [["s", th.disp], ["p", th.acc]].forEach(function (q) {
          ctx.strokeStyle = q[1]; ctx.lineWidth = 2.5; ctx.beginPath();
          for (var j = 0; j <= 200; j++) {
            var xx = p.L * j / 200, v = K.clamp(val(field(p, p.f, xx)[q[0]], ph), -1.3, 1.3);
            if (j) ctx.lineTo(xp(p, xx), CY - v * 42); else ctx.moveTo(xp(p, xx), CY - v * 42);
          }
          ctx.stroke();
        });
      }
      // nodes and antinodes of the displacement, when it's ringing
      if (ringing) {
        var h = ringing.h, nodes = [], antis = [], q2;
        if (mode === "string") for (q2 = 0; q2 <= h; q2++) { nodes.push(q2 * p.L / h); if (q2 < h) antis.push((q2 + 0.5) * p.L / h); }
        else if (mode === "open") for (q2 = 0; q2 <= h; q2++) { antis.push(q2 * p.L / h); if (q2 < h) nodes.push((q2 + 0.5) * p.L / h); }
        else for (q2 = 0; q2 <= h; q2++) { var xx2 = q2 * p.L / h; if (q2 % 2 === 0) nodes.push(xx2); else antis.push(xx2); }
        var ly = mode === "string" ? CY + 104 : CY + 84;
        nodes.forEach(function (xx) { K.label(ctx, "N", xp(p, xx), ly, th.disp, { bg: true }); });
        antis.forEach(function (xx) { K.label(ctx, "A", xp(p, xx), ly, th.muted, { bg: true }); });
        K.label(ctx, "harmonic " + h + " · " + K.fmt(ringing.f, mode === "string" ? 3 : 1) + " Hz" + (mode === "string" ? "" : " · N, A are for displacement; pressure is the other way round"), W / 2, 22, th.ink, { bg: true });
      } else K.label(ctx, "not resonating: sweep f", W / 2, 22, th.muted, { bg: true });
      if (mode !== "string") K.label(ctx, "slow motion", W - 12, H - 36, th.muted, { align: "right" });
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>';
    var caps = P.graphs.querySelectorAll(".graph-cap"), cv = P.graphs.querySelectorAll("canvas");
    var gR = new K.Graph(cv[0], { yLabel: "amplitude", xLabel: "f (Hz)", xMax: 3, yMin: 0, color: th.disp });
    var gE = new K.Graph(cv[1], { yLabel: "|y| (m)", xLabel: "x (m)", xMax: 4, yMin: 0, color: th.disp });
    var g3 = new K.Graph(cv[2], { yLabel: "y (m)", xMax: 10, color: th.disp });
    gR.extra = function (ctx, X, Y) {
      var p = params(), b = f1(p), h;
      ctx.save(); ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (h = 1; h * b <= p.fMax; h += mode === "closed" ? 2 : 1) {
        ctx.strokeStyle = K.alpha(th.muted, 0.5); ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(X(h * b), Y(0)); ctx.lineTo(X(h * b), 12); ctx.stroke();
        ctx.fillStyle = th.muted; ctx.fillText(String(h), X(h * b), 2);
      }
      ctx.setLineDash([]); ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(p.f), Y(0)); ctx.lineTo(X(p.f), 12); ctx.stroke();
      ctx.fillStyle = th.disp;
      Object.keys(visited).forEach(function (k) { var q = visited[k]; ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 2.5, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    };
    function configGraphs() {
      var str = mode === "string";
      caps[0].innerHTML = '<b class="c-disp">resonance curve</b> · dots = what you measured, dashed = formula, numbered lines = ' + (str || mode === "open" ? "f<sub>n</sub> = nv/2L" : "f = (2n−1)v/4L, odd only");
      caps[1].innerHTML = '<b class="c-disp">displacement amplitude along the ' + (str ? "string" : "pipe") + "</b> · zeros are nodes";
      caps[2].innerHTML = str ? '<b class="c-disp">y–t at the midpoint</b> · flat when the middle is a node (even n)' : '<b class="c-acc">pressure amplitude along the pipe</b> · its nodes sit at the displacement antinodes';
      gR.o.yLabel = str ? "amplitude (m)" : "amplitude (rel.)";
      gE.o.yLabel = str ? "|y| (m)" : "|s| (rel.)";
      g3.o.yLabel = str ? "y (m)" : "|p| (rel.)"; g3.o.xLabel = str ? "t (s), last 10 s" : "x (m)";
      g3.o.yMin = str ? undefined : 0;
      g3.clear();
    }

    function theory() {
      var p = params(), pts = [], e = [], pe = [], i;
      var lo = mode === "string" ? 0.02 : 20, nPts = mode === "string" ? 1200 : 1980;
      for (i = 0; i <= nPts; i++) { var f = lo + (p.fMax - lo) * i / nPts; pts.push([f, amp(p, f)]); }
      gR.o.xMax = p.fMax;
      gR.set("theory", { points: pts, color: th.disp, dash: [4, 4], width: 1.2 });
      for (i = 0; i < NX; i++) {
        var x = p.L * i / (NX - 1), F = field(p, p.f, x);
        e.push([x, cabs(F.s)]); if (F.p) pe.push([x, cabs(F.p)]);
      }
      gE.o.xMax = p.L;
      gE.set("theory", { points: e, color: th.disp, dash: [5, 5], width: 1.5 });
      if (mode !== "string") { g3.o.xMax = p.L; g3.set("theory", { points: pe, color: th.acc, dash: [5, 5], width: 1.5 }); }
    }

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params(), xs = function (i) { return p.L * i / (NX - 1); };
      var pts = Object.keys(visited).map(function (k) { return visited[k]; }).sort(function (a, b) { return a[0] - b[0]; });
      gR.set("sim", { points: pts, color: th.disp, width: 2 });
      gE.set("sim", { points: env.map(function (v, i) { return [xs(i), v]; }), color: th.disp, width: 2.5 });
      if (mode === "string") {
        var t0 = mid.t.length ? mid.t[0] : 0;
        g3.set("sim", { points: mid.t.map(function (t, i) { return [t - t0, mid.y[i]]; }), color: th.disp, width: 2.5, dot: true });
        var th0 = [], z = field(p, p.f, p.L / 2).s;
        for (var j = 0; j <= 400; j++) { var tt = 10 * j / 400; th0.push([tt, val(z, 2 * Math.PI * p.f * (tt + t0))]); }
        g3.set("theory", { points: th0, color: th.disp, dash: [5, 5], width: 1.5 });
      } else g3.set("sim", { points: penv.map(function (v, i) { return [xs(i), v]; }), color: th.acc, width: 2.5 });
      [gR, gE, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    // the biggest amplitude you've measured near the nearest harmonic
    function bestFound(p) {
      var nr = nearest(p), half = f1(p) * (mode === "closed" ? 1 : 0.5), best = null;
      Object.keys(visited).forEach(function (k) {
        var q = visited[k];
        if (Math.abs(q[0] - nr.f) < half && (!best || q[1] > best[1])) best = q;
      });
      // only a real peak counts: something lower measured on both sides of it
      if (!best) return null;
      var below = false, above = false;
      Object.keys(visited).forEach(function (k) { var q = visited[k]; if (Math.abs(q[0] - nr.f) < half) { if (q[0] < best[0]) below = true; if (q[0] > best[0]) above = true; } });
      return below && above ? best[0] : null;
    }

    /* ---------- maths + readouts ---------- */
    var eqEls, setR;
    function buildPanels() {
      var labels = mode === "string"
        ? ["Wave speed on the string", "Harmonics: whole loops between the fixed ends", "The nearest one", "A standing wave is two travelling waves"]
        : ["Open at both ends: every harmonic", "Closed at one end: odd harmonics only", "The nearest one", "Displacement and pressure swap nodes"];
      P.eqs.innerHTML = labels.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = K.readout(P.readouts, [
        { id: "f", label: "driving frequency" }, { id: "fn", label: "nearest resonance (formula)" },
        { id: "best", label: "peak you've found near it" }, { id: "a", label: "amplitude now", cls: "c-disp" },
        { id: "lam", label: "wavelength of that mode" }, { id: "nodes", label: "displacement nodes" }
      ]);
    }
    function renderMaths() {
      var p = params(), nr = nearest(p), b = f1(p), d = mode === "string" ? 3 : 1, bf = bestFound(p), a = amp(p, p.f);
      if (mode === "string") {
        K.tex(eqEls[0], "v = \\sqrt{\\frac{T}{\\mu}} = \\sqrt{\\frac{" + K.fmt(p.T, 1) + "}{" + K.fmt(p.mu, 2) + "}} = \\mathbf{" + K.fmt(p.v, 2) + "}\\ \\text{m/s}");
        K.tex(eqEls[1], "f_n = \\frac{nv}{2L} = n\\times\\frac{" + K.fmt(p.v, 2) + "}{2\\times" + K.fmt(p.L, 1) + "} = n \\times \\mathbf{" + K.fmt(b, 3) + "}\\ \\text{Hz}:\\;\\; " +
          [1, 2, 3, 4].map(function (n) { return K.fmt(n * b, 3); }).join(",\\ ") + ",\\ \\dots");
        K.tex(eqEls[3], "y = A\\sin kx\\cos\\omega t = \\tfrac{A}{2}\\sin(kx - \\omega t) + \\tfrac{A}{2}\\sin(kx + \\omega t),\\;\\; k = \\frac{2\\pi f}{v} = \\mathbf{" + K.fmt(2 * Math.PI * p.f / p.v, 3) + "}\\ \\text{rad/m}");
      } else {
        var bo = p.v / (2 * p.L), bc = p.v / (4 * p.L);
        K.tex(eqEls[0], "f_n = \\frac{nv}{2L} = n\\times\\frac{" + p.v + "}{2\\times" + K.fmt(p.L, 2) + "}:\\;\\; " + [1, 2, 3, 4].map(function (n) { return K.fmt(n * bo, 1); }).join(",\\ ") + "\\ \\text{Hz}" + (mode === "open" ? "\\;\\checkmark" : ""));
        K.tex(eqEls[1], "f = \\frac{(2n-1)v}{4L} = (2n-1)\\times\\frac{" + p.v + "}{4\\times" + K.fmt(p.L, 2) + "}:\\;\\; " + [1, 3, 5, 7].map(function (n) { return K.fmt(n * bc, 1); }).join(",\\ ") + "\\ \\text{Hz}" + (mode === "closed" ? "\\;\\checkmark" : ""));
        K.tex(eqEls[3], mode === "open" ? "s \\propto \\cos kx,\\;\\; \\Delta p \\propto \\sin kx:\\;\\; \\text{open ends are displacement antinodes and pressure nodes}"
          : "s \\propto \\sin kx,\\;\\; \\Delta p \\propto \\cos kx:\\;\\; \\text{closed end: displacement node, pressure antinode}");
      }
      K.tex(eqEls[2], "\\text{harmonic } " + nr.h + ":\\; f = \\mathbf{" + K.fmt(nr.f, d) + "}\\ \\text{Hz},\\;\\; \\lambda = " + (mode === "closed" ? "\\frac{4L}{" + nr.h + "}" : "\\frac{2L}{" + nr.h + "}") + " = \\mathbf{" + K.fmt(nr.lam, 2) + "}\\ \\text{m};\\;\\; \\text{you drive at } " + K.fmt(p.f, d) + "\\ \\text{Hz}" + (ringing ? "\\ \\text{(resonance)}" : ""));
      setR("f", K.fmt(p.f, d) + " Hz");
      setR("fn", K.fmt(nr.f, d) + " Hz", "harmonic " + nr.h);
      setR("best", bf !== null ? K.fmt(bf, d) + " Hz" : "—", bf !== null ? "formula " + K.fmt(nr.f, d) + " Hz" : "sweep across the peak");
      setR("a", mode === "string" ? K.fmt(a * 100, 1) + " cm" : K.fmt(a * 100, 0) + " %", mode === "string" ? "driver moves only " + K.fmt(A_DRIVE * 100, 0) + " cm" : "of the resonance peak");
      setR("lam", K.fmt(nr.lam, 2) + " m", mode === "closed" ? "4L/(2n−1)" : "2L/n");
      var nn = mode === "string" ? nr.h + 1 : mode === "open" ? nr.h : (nr.h + 1) / 2;
      setR("nodes", ringing ? String(nn) : "—", ringing ? (mode === "string" ? "including both ends" : mode === "open" ? "none at the open ends" : "one at the closed end") : "not ringing");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A wave hits the end and comes back. The outgoing and returning waves overlap: $\\tfrac{A}{2}\\sin(kx - \\omega t) + \\tfrac{A}{2}\\sin(kx + \\omega t) = A\\sin kx\\cos\\omega t$. Nothing travels any more. Every point just oscillates, with an amplitude $|A\\sin kx|$ fixed by where it is: <b>nodes</b> never move, <b>antinodes</b> swing the most.</p>" +
      "<p>It only builds up when the pattern fits the ends. A string fixed at both ends needs a node at each end, so $L = n\\lambda/2$ and $f_n = nv/2L$. An open pipe needs a displacement antinode at each end: the same $f_n = nv/2L$. A pipe closed at one end needs a node there and an antinode at the open end: $L = (2n-1)\\lambda/4$, so only odd harmonics.</p>" +
      "<p>Drive at any other frequency and the reflections arrive out of step and cancel. That's why the resonance curve is a row of sharp spikes.</p>" +
      '<div class="trap"><b>JEE trap: overtones ≠ harmonics in a closed pipe.</b> Its first overtone is the <i>third</i> harmonic, $3v/4L$, and the second overtone is the fifth. For an open pipe or a string, the first overtone is the second harmonic. Real pipes also behave slightly longer: add the end correction, $L + 0.6r$ per open end.</div>');
    function apply(s) {
      setMode(s.mode);
      if (s.mode === "string") { LS.set(s.L); TS.set(s.T); muS.set(s.mu); fS.set(s.f); }
      else { pLS.set(s.pL); vS.set(s.v); pfS.set(s.pf); }
      lastChange = null;
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "string harmonics", setup: { mode: "string", L: 5, T: 9, mu: 0.25, f: 1.8 }, watch: "Is it ringing in three loops? Press Play",
        q: "A 5 m string with $\\mu$ = 0.25 kg/m is stretched with a tension of 9 N between two fixed ends. What is the frequency of its third harmonic?",
        options: ["1.8 Hz", "0.6 Hz", "1.2 Hz", "0.9 Hz"], answer: 0,
        explain: "$v = \\sqrt{9/0.25} = 6$ m/s, $f_1 = v/2L = 6/10 = 0.6$ Hz, so $f_3 = 3 \\times 0.6 = 1.8$ Hz. 1.2 Hz is the second harmonic; 0.9 Hz uses the closed-pipe formula $3v/4L$." },
      { level: "medium", tag: "closed pipe from two resonances", setup: { mode: "closed", pL: 0.5, v: 340, pf: 510 }, watch: "This is a 0.50 m closed pipe at 510 Hz. Use 'next harmonic' to find the next resonance",
        q: "A pipe closed at one end resonates at 510 Hz and at 850 Hz, with no resonance in between. Taking $v$ = 340 m/s, how long is it?",
        options: ["0.25 m", "0.50 m", "1.00 m", "0.17 m"], answer: 1,
        hints: ["Successive resonances of a closed pipe are odd harmonics, so they differ by $2f_1$, not $f_1$.", "$2f_1 = 850 - 510 = 340$ Hz, then use $f_1 = v/4L$."],
        explain: "Neighbouring resonances are $(2n-1)f_1$ and $(2n+1)f_1$, so $850 - 510 = 2f_1$ and $f_1 = 170$ Hz. Then $L = v/4f_1 = 340/680 = 0.50$ m. Check: 510 and 850 Hz are the 3rd and 5th harmonics. Taking the gap as $f_1$ gives 0.25 m." },
      { level: "hard", tag: "closed pipe vs open pipe", setup: { mode: "closed", pL: 0.15, v: 340, pf: 567 }, watch: "The closed 15 cm pipe rings at 567 Hz. Switch to open–open, set L = 0.60 m and check that 567 Hz rings in its 2nd harmonic",
        q: "The fundamental of a closed organ pipe is equal to the first overtone of an open organ pipe 60 cm long. How long is the closed pipe?",
        options: ["15 cm", "30 cm", "10 cm", "120 cm"], answer: 0,
        hints: ["The open pipe's first overtone is its second harmonic: $2 \\times v/2L_o = v/L_o$.", "Set $v/4L_c = v/L_o$."],
        explain: "$\\dfrac{v}{4L_c} = \\dfrac{2v}{2L_o}$ gives $L_c = L_o/4 = 15$ cm. With $v$ = 340 m/s both are 567 Hz. 30 cm comes from using the open pipe's fundamental, 10 cm from its second overtone." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    clearEnv(); mid = { t: [], y: [] };
    setMode("string");
    transportUI = K.transport(P, sim, { onReset: reset });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_standing = {
        apply: apply, params: params, amp: function (f) { return amp(params(), f); },
        set: function (k, v) { ({ L: LS, T: TS, mu: muS, f: fS, pL: pLS, v: vS, pf: pfS })[k].set(v); changed(k === "f" || k === "pf" ? "f" : k === "pL" || k === "v" ? "pipe" : "string"); },
        mode: setMode, sweep: function (on) { sweep = on; sweepF = null; },
        state: function () {
          var p = params();
          return { mode: mode, f: p.f, f1: f1(p), nearest: nearest(p), ringing: ringing, best: bestFound(p), env: env.slice(), penv: penv.slice(), found: found, v: p.v };
        }
      };
    }

    return function destroy() { sim.destroy(); [gR, gE, g3].forEach(function (g) { g.destroy(); }); };
  }
})();
