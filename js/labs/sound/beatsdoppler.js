/* Waves & sound, lab 3: beats from two close frequencies, and the Doppler effect with a moving source and observer. */
(function () {
  "use strict";
  var T_BEATS = 10, T_DOP = 12, SKIP = 100;   // run lengths (s); Doppler draws one wavefront in every SKIP crests

  var lab = {
    id: "beatsdoppler", chapter: "sound", title: "Beats & Doppler effect", short: "f_beat = |f₁ − f₂|, moving sources",
    lede: "Sound two tuning forks that are almost in tune and the note throbs. Then set a siren moving past a listener and watch its wavefronts bunch up in front and spread out behind.",
    tries: [
      { id: "four", title: "Make exactly 4 beats per second",
        text: "In Beats mode, tune $f_2$ until the counted beat frequency is 4.0 Hz.",
        why: "The two waves drift in and out of step $|f_1 - f_2|$ times a second, so you need $f_2 = f_1 \\pm 4$ Hz. There are always two answers: that's why the wax problems ask which way the beats change." },
      { id: "pass", title: "Hear the pitch drop as the source goes by",
        text: "In Doppler mode, let the moving source drive right past the observer.",
        why: "Approaching, the crests are squeezed: $f' = fv/(v - v_s) > f$. Receding, they're stretched: $f' = fv/(v + v_s) < f$. The drop happens the moment it passes, the familiar 'neee-owww'." },
      { id: "asym", title: "Moving source vs moving observer",
        text: "Measure $f'$ with only the source approaching, then with only the observer approaching at the same speed.",
        why: "They differ. A moving source changes the wavelength in the air; a moving observer only meets the crests faster. At 34 m/s with $f$ = 500 Hz: 555.6 Hz vs 550.0 Hz. Doppler for sound depends on motion relative to the air, not just relative to each other." },
      { id: "shock", title: "Break the sound barrier",
        text: "Make the source faster than sound ($|v_s| > v$).",
        why: "The source outruns its own wavefronts, which pile up on a cone of half-angle $\\theta$ with $\\sin\\theta = v/v_s$. Ahead of the cone there's silence; when the cone sweeps past you, you hear the boom." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 440, origin = { x: 0, y: 230 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: origin, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "beats", win = 1, sound = false;
    var f1S = K.slider({ label: "Fork 1: $f_1$", unit: "Hz", min: 200, max: 600, step: 0.5, value: 256, onInput: reset });
    var f2S = K.slider({ label: "Fork 2: $f_2$", unit: "Hz", min: 200, max: 600, step: 0.5, value: 260, onInput: reset });
    var rS = K.slider({ label: "Amplitude ratio $A_2/A_1$", min: 0.2, max: 1, step: 0.05, value: 1, onInput: reset,
      hint: "Below 1 the quiet moments are no longer silent." });
    var fS = K.slider({ label: "Source frequency $f$", unit: "Hz", min: 100, max: 1000, step: 10, value: 500, onInput: reset });
    var vS = K.slider({ label: "Speed of sound $v$", unit: "m/s", min: 300, max: 360, step: 2, value: 340, onInput: reset });
    var vsS = K.slider({ label: "Source velocity $v_S$", unit: "m/s", min: -700, max: 700, step: 2, value: 60, onInput: reset,
      hint: "Positive is to the right. Go past $v$ for a shock wave." });
    var voS = K.slider({ label: "Observer velocity $v_O$", unit: "m/s", min: -100, max: 100, step: 2, value: 0, onInput: reset,
      hint: "Positive is to the right. Drag S and O on the stage to place them." });
    function segSet(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    var modeSeg = K.seg([{ label: "Beats", value: "beats" }, { label: "Doppler effect", value: "doppler" }], "beats", function (v) { setMode(v); reset(); }, "Mode");
    var winSeg = K.seg([{ label: "0.05 s", value: 0.05 }, { label: "0.25 s", value: 0.25 }, { label: "1 s", value: 1 }, { label: "2 s", value: 2 }], 1,
      function (v) { win = v; }, "Time window");
    P.controls.innerHTML = "<h3>Mode</h3>";
    P.controls.appendChild(modeSeg);
    var beatBox = K.h("<div><h3>Two tuning forks</h3></div>"), dopBox = K.h("<div><h3>Source and observer</h3></div>");
    [f1S, f2S, rS].forEach(function (s) { beatBox.appendChild(s.el); });
    beatBox.appendChild(K.h("<h3>Time window on screen</h3>")); beatBox.appendChild(winSeg);
    [fS, vS, vsS, voS].forEach(function (s) { dopBox.appendChild(s.el); });
    P.controls.appendChild(beatBox); P.controls.appendChild(dopBox);
    P.controls.appendChild(K.h("<h3>Sound</h3>"));
    P.controls.appendChild(K.check("Play sound while running (off by default)", false, function (v) { sound = v; if (v) audioStart(); audioSync(); }));
    var legend = K.h('<div class="legend"></div>');
    P.controls.appendChild(legend);
    function setMode(v) {
      mode = v; segSet(modeSeg, v); beatBox.hidden = v !== "beats"; dopBox.hidden = v !== "doppler";
      legend.innerHTML = v === "beats"
        ? '<span class="c-app"><i></i>fork 1</span><span class="c-ten"><i></i>fork 2</span><span class="c-disp"><i></i>what you hear (sum)</span><span class="c-acc"><i></i>envelope</span>'
        : '<span class="c-app"><i></i>source S</span><span class="c-normal"><i></i>observer O</span><span class="c-disp"><i></i>wavefronts</span><span class="c-vel"><i></i>velocity</span><span class="c-fric"><i></i>shock cone</span>';
      buildPanels(); configGraphs();
    }

    function bp() { return { f1: f1S.get(), f2: f2S.get(), r: rS.get() }; }
    function dp() { return { f: fS.get(), v: vS.get(), vs: vsS.get(), vo: voS.get() }; }
    function ysum(p, t) { return Math.sin(2 * Math.PI * p.f1 * t) + p.r * Math.sin(2 * Math.PI * p.f2 * t); }
    function envF(p, t) { return Math.sqrt(1 + p.r * p.r + 2 * p.r * Math.cos(2 * Math.PI * (p.f1 - p.f2) * t)); }

    /* ---------- state ---------- */
    var B, D, ended = false, transportUI = null;
    var homeS = { x: 150, y: 0 }, homeO = { x: 700, y: 0 }, beatRuns = {}, dopRuns = {}, dopPts = {};
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      B = { m: 0, env: [], ex: null, peaks: [], eMax: 0, eMin: Infinity };
      D = { m: 0, fronts: [], arr: [], inst: [], formula: [], src: { x: homeS.x, y: homeS.y }, obs: { x: homeO.x, y: homeO.y }, before: null, side: null };
      ended = false;
      P.time.textContent = "t = 0.00 s";
      theory(); update(true); audioSync();
    }

    /* ---------- beats: measure the loud moments from the waveform ---------- */
    // Cut the signal into blocks one carrier period long; the biggest |y| in each block is the envelope.
    // Each stretch above A₁ is one loud beat; its centre (weighted by how loud) is the beat's time.
    function beatStep(t) {
      var p = bp(), Tb = 2 / (p.f1 + p.f2);
      while ((B.m + 1) * Tb <= t) {
        var t0 = B.m * Tb, e = 0;
        for (var j = 0; j < 64; j++) e = Math.max(e, Math.abs(ysum(p, t0 + Tb * j / 64)));
        var tc = t0 + Tb / 2;
        B.env.push([tc, e]); B.eMax = Math.max(B.eMax, e); B.eMin = Math.min(B.eMin, e);
        if (e > 1) { if (!B.ex) B.ex = { w: 0, tw: 0, first: B.m === 0 }; B.ex.w += e - 1; B.ex.tw += (e - 1) * tc; }
        else if (B.ex) { if (!B.ex.first) B.peaks.push(B.ex.tw / B.ex.w); B.ex = null; }
        B.m++;
      }
      var bf = beatMeas();
      if (bf !== null) {
        beatRuns[Math.abs(p.f1 - p.f2).toFixed(1)] = [Math.abs(p.f1 - p.f2), bf];
        if (Math.abs(bf - 4) < 0.05) tries.mark("four");
      }
    }
    function beatMeas() { var k = B.peaks; return k.length >= 2 ? (k.length - 1) / (k[k.length - 1] - k[0]) : null; }

    /* ---------- Doppler: emit wavefronts, count them arriving ---------- */
    function dopStep(t) {
      var p = dp(), t0 = t - K.DT, s0 = { x: D.src.x, y: D.src.y }, o0 = { x: D.obs.x, y: D.obs.y }, fd = p.f / SKIP;
      D.src.x += p.vs * K.DT; D.obs.x += p.vo * K.DT;
      while (D.m / fd <= t + 1e-12) {
        var te = D.m / fd, a = (te - t0) / K.DT;
        D.fronts.push({ te: te, x: s0.x + (D.src.x - s0.x) * a, y: D.src.y, hit: false });
        D.m++;
      }
      var fresh = [];
      D.fronts.forEach(function (w) {
        if (w.hit) return;
        var ts = Math.max(t0, w.te), os = { x: o0.x + p.vo * (ts - t0), y: o0.y };
        var d0 = Math.hypot(os.x - w.x, os.y - w.y) - p.v * (ts - w.te), d1 = Math.hypot(D.obs.x - w.x, D.obs.y - w.y) - p.v * (t - w.te);
        if (d0 > 0 && d1 <= 0) { w.hit = true; fresh.push({ t: ts + (t - ts) * d0 / (d0 - d1), side: D.obs.x >= w.x ? 1 : -1 }); }
      });
      fresh.sort(function (a, b) { return a.t - b.t; }).forEach(function (q) {
        var last = D.arr[D.arr.length - 1];
        if (last && last.side === q.side) D.inst.push([q.t, SKIP / (q.t - last.t)]);
        if (last && last.side !== q.side) { D.before = measured(); D.passed = true; }
        D.arr.push(q);
      });
      var fm = measured(), F = formula(p);
      if (F.f !== null) D.formula.push([t, F.f]);
      if (D.passed && D.before !== null && fm !== null && sideRun() >= 3 && D.before > p.f && fm < p.f) tries.mark("pass");
      // the asymmetry experiment: collinear, one of them still, approaching
      if (fm !== null && sideRun() >= 5 && Math.abs(D.src.y - D.obs.y) < 1 && fm > p.f) {
        if (p.vo === 0 && p.vs !== 0) dopRuns["s" + Math.abs(p.vs) + "@" + p.f] = fm;
        if (p.vs === 0 && p.vo !== 0) dopRuns["o" + Math.abs(p.vo) + "@" + p.f] = fm;
        var u = Math.abs(p.vs || p.vo);
        if (dopRuns["s" + u + "@" + p.f] && dopRuns["o" + u + "@" + p.f]) tries.mark("asym");
      }
      if (fm !== null && p.vo === 0 && Math.abs(D.src.y - D.obs.y) < 1 && sideRun() >= 4 && Math.abs(p.vs) < p.v) {
        var appr = (D.obs.x - D.src.x) * p.vs > 0;
        dopPts[(appr ? "a" : "r") + Math.abs(p.vs)] = [Math.abs(p.vs), fm / p.f];
      }
      if (Math.abs(p.vs) > p.v && t >= 1) tries.mark("shock");
    }
    function sideRun() {
      var a = D.arr, n = 0;
      for (var i = a.length - 1; i >= 0 && a[i].side === a[a.length - 1].side; i--) n++;
      return n;
    }
    // f' from the last few crests to arrive (every drawn crest stands for SKIP real ones)
    function measured() {
      var k = Math.min(6, sideRun()), a = D.arr;
      if (k < 3) return null;
      return SKIP * (k - 1) / (a[a.length - 1].t - a[a.length - k].t);
    }
    // the textbook formula, using the line from where the arriving crest was emitted to where O is now
    function formula(p) {
      var Dx = D.obs.x - D.src.x, Dy = D.obs.y - D.src.y, a = p.vs * p.vs - p.v * p.v, b = 2 * Dx * p.vs, c = Dx * Dx + Dy * Dy, taus = [];
      if (Math.abs(a) < 1e-9) { if (b < 0) taus.push(-c / b); }
      else {
        var disc = b * b - 4 * a * c;
        if (disc >= 0) [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].forEach(function (x) { if (x > 1e-9) taus.push(x); });
      }
      if (!taus.length) return { f: null, silent: true };
      var tau = Math.min.apply(null, taus), ex = D.src.x - p.vs * tau, nx = (D.obs.x - ex) / Math.hypot(D.obs.x - ex, Dy);
      var vsT = p.vs * nx, voT = -p.vo * nx;
      return { f: p.f * (p.v + voT) / (p.v - vsT), vsT: vsT, voT: voT, two: taus.length > 1 };
    }

    sim.on("step", function (t) {
      if (mode === "beats") beatStep(t); else dopStep(t);
      var out = mode === "doppler" && (D.src.x < -100 || D.src.x > W + 100 || D.obs.x < 0 || D.obs.x > W);
      if (t >= (mode === "beats" ? T_BEATS : T_DOP) - 1e-9 || out) {
        sim.pause(); transportUI.render(); ended = true; audioSync();
        K.flash(P.note, out ? "Out of the picture. Reset to go again" : "That's the end of the run. Reset to go again");
      }
      update(ended);
    });

    /* ---------- drawing ---------- */
    var TX0 = 140, TX1 = 980;
    sim.on("under", function (ctx) {
      if (mode === "beats") drawBeats(ctx); else drawDoppler(ctx);
      audioSync();
    });
    function trace(ctx, cy, amp, fn, color, width, ta, tb) {
      var n = Math.round(K.clamp(win * Math.max(f1S.get(), f2S.get()) * 12, 900, 8000));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var tt = ta + (tb - ta) * i / n, x = TX0 + (tt - ta) / win * (TX1 - TX0), y = cy - fn(tt) * amp;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    function drawBeats(ctx) {
      var p = bp(), t = sim.time, ta = Math.max(0, t - win), tb = t > 0 ? t : win;
      var rows = [[75, 28, function (x) { return Math.sin(2 * Math.PI * p.f1 * x); }, th.app, "fork 1: " + K.fmt(p.f1, 1) + " Hz"],
        [160, 28, function (x) { return p.r * Math.sin(2 * Math.PI * p.f2 * x); }, th.ten, "fork 2: " + K.fmt(p.f2, 1) + " Hz"],
        [315, 50, function (x) { return ysum(p, x); }, th.disp, "sum: what you hear"]];
      rows.forEach(function (r) {
        ctx.strokeStyle = th.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(TX0, r[0]); ctx.lineTo(TX1, r[0]); ctx.stroke();
        trace(ctx, r[0], r[1], r[2], r[3], r === rows[2] ? 1.6 : 1.2, ta, tb);
        K.label(ctx, r[4], TX0 - 10, r[0] - r[1] - 2, r[3], { align: "left" });
      });
      // the envelope ±√(A₁² + A₂² + 2A₁A₂cos 2πΔf t)
      ctx.setLineDash([6, 4]);
      [1, -1].forEach(function (sg) { trace(ctx, 315, 50 * sg, function (x) { return envF(p, x); }, th.acc, 2, ta, tb); });
      ctx.setLineDash([]);
      // loudness meter, pulsing at the beat frequency
      var e = envF(p, t), lv = e * e / Math.pow(1 + p.r, 2);
      ctx.fillStyle = th.surface; ctx.fillRect(30, 250, 26, 130);
      ctx.fillStyle = th.acc; ctx.fillRect(30, 380 - 130 * lv, 26, 130 * lv);
      ctx.strokeStyle = th.line; ctx.strokeRect(30, 250, 26, 130);
      K.label(ctx, "loudness", 43, 246, th.muted);
      // time axis of the window
      ctx.fillStyle = th.muted; ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      [0, 0.5, 1].forEach(function (q) { ctx.fillText(K.fmt(ta + q * win, win < 0.5 ? 3 : 2) + " s", TX0 + q * (TX1 - TX0), H - 30); });
      K.label(ctx, "beats every " + (p.f1 === p.f2 ? "∞" : K.fmt(1 / Math.abs(p.f1 - p.f2), 3)) + " s", TX1, 230, th.ink, { align: "right", bg: true });
    }
    function drawDoppler(ctx) {
      var p = dp(), t = sim.time, i;
      var road = sim.px(0, -40).y;
      ctx.fillStyle = th.ground; ctx.fillRect(0, road, W, H - road);
      ctx.fillStyle = th.muted; ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (i = 0; i <= W; i += 100) { ctx.fillRect(i - 0.5, road, 1, 6); ctx.fillText(i + " m", i, road + 8); }
      // wavefronts
      ctx.strokeStyle = K.alpha(th.disp, 0.55); ctx.lineWidth = 1.5;
      D.fronts.forEach(function (w) {
        var r = p.v * (t - w.te); if (r <= 0 || r > 1800) return;
        var c = sim.px(w.x, w.y); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      });
      // shock cone
      if (Math.abs(p.vs) > p.v && t > 0) {
        var ang = Math.asin(p.v / Math.abs(p.vs)), back = -Math.sign(p.vs), len = Math.abs(p.vs) * t * Math.cos(ang), s = sim.px(D.src.x, D.src.y);
        ctx.strokeStyle = th.fric; ctx.lineWidth = 2.5;
        [1, -1].forEach(function (sg) {
          ctx.beginPath(); ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + back * len * Math.cos(ang), s.y + sg * len * Math.sin(ang)); ctx.stroke();
        });
        K.label(ctx, "θ = " + K.fmt(ang / K.DEG, 1) + "°", s.x + back * 60, s.y - 30, th.fric, { bg: true });
      }
      K.label(ctx, "one wavefront drawn for every " + SKIP + " crests", W - 10, 22, th.muted, { align: "right" });
    }
    sim.on("over", function (ctx) {
      if (mode !== "doppler") return;
      var p = dp(), s = sim.px(D.src.x, D.src.y), o = sim.px(D.obs.x, D.obs.y), fm = measured(), F = formula(p);
      K.arrow(ctx, s.x, s.y - 26, s.x + p.vs * 0.3, s.y - 26, th.vel, { label: "v_S " + p.vs, lx: p.vs >= 0 ? 6 : -70 });
      if (p.vo) K.arrow(ctx, o.x, o.y - 30, o.x + p.vo * 0.6, o.y - 30, th.vel, { label: "v_O " + p.vo, lx: p.vo >= 0 ? 6 : -70 });
      ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(s.x, s.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.normal; ctx.beginPath(); ctx.arc(o.x, o.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 12px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("S", s.x, s.y); ctx.fillText("O", o.x, o.y);
      K.label(ctx, "hears " + (fm !== null ? K.fmt(fm, 1) + " Hz" : F.silent ? "nothing yet (outside the cone)" : "…"), o.x, o.y + 40, th.ink, { bg: true });
    });

    // drag S or O to place them
    var drag = null;
    sim.pointer({
      down: function (pt) {
        if (mode !== "doppler") return false;
        var s = sim.px(D.src.x, D.src.y), o = sim.px(D.obs.x, D.obs.y);
        if (Math.hypot(pt.px - s.x, pt.py - s.y) < 22) drag = "S"; else if (Math.hypot(pt.px - o.x, pt.py - o.y) < 22) drag = "O"; else return false;
      },
      drag: function (pt) {
        if (!drag) return;
        var q = { x: K.clamp(Math.round(pt.m.x), 0, W), y: K.clamp(Math.round(pt.m.y), -30, 200) };
        if (Math.abs(q.y) < 8) q.y = 0;                      // snap onto the same line
        if (drag === "S") { D.src = q; if (sim.time === 0) homeS = { x: q.x, y: q.y }; }
        else { D.obs = q; if (sim.time === 0) homeO = { x: q.x, y: q.y }; }
        D.arr = []; D.inst = []; D.passed = false;
        update(true);
      },
      up: function () { drag = null; },
      hover: function (pt) {
        if (mode !== "doppler") return;
        var s = sim.px(D.src.x, D.src.y), o = sim.px(D.obs.x, D.obs.y);
        P.canvas.style.cursor = Math.hypot(pt.px - s.x, pt.py - s.y) < 22 || Math.hypot(pt.px - o.x, pt.py - o.y) < 22 ? "grab" : "";
      }
    });

    /* ---------- sound (WebAudio, only after you tick the box) ---------- */
    var ac = null, osc = [], gains = [];
    function audioStart() {
      if (ac) return;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        for (var i = 0; i < 2; i++) {
          var o = ac.createOscillator(), g = ac.createGain();
          g.gain.value = 0; o.connect(g); g.connect(ac.destination); o.start();
          osc.push(o); gains.push(g);
        }
      } catch (e) { ac = null; }
    }
    function audioSync() {
      if (!ac) return;
      var on = sound && sim.running, now = ac.currentTime;
      if (mode === "beats") {
        var p = bp();
        osc[0].frequency.setTargetAtTime(p.f1, now, 0.01); osc[1].frequency.setTargetAtTime(p.f2, now, 0.01);
        gains[0].gain.setTargetAtTime(on ? 0.12 : 0, now, 0.02); gains[1].gain.setTargetAtTime(on ? 0.12 * p.r : 0, now, 0.02);
      } else {
        var fm = D ? measured() : null;
        if (fm !== null) osc[0].frequency.setTargetAtTime(fm, now, 0.02);
        gains[0].gain.setTargetAtTime(on && fm !== null ? 0.12 : 0, now, 0.02); gains[1].gain.setTargetAtTime(0, now, 0.02);
      }
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML = '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div><div class="graph"><canvas></canvas><p class="graph-cap"></p></div><div class="graph"><canvas></canvas><p class="graph-cap"></p></div>';
    var caps = P.graphs.querySelectorAll(".graph-cap"), cv = P.graphs.querySelectorAll("canvas");
    var g1 = new K.Graph(cv[0], { yLabel: "envelope", xMax: T_BEATS, yMin: 0, color: th.acc });
    var g2 = new K.Graph(cv[1], { yLabel: "beats", xMax: T_BEATS, yMin: 0, color: th.disp });
    var g3 = new K.Graph(cv[2], { yLabel: "f_beat (Hz)", xLabel: "|f₁ − f₂| (Hz)", xMax: 10, xAuto: true, yMin: 0, color: th.disp });
    g3.extra = function (ctx, X, Y) {
      var pts = mode === "beats" ? beatRuns : dopPts;
      ctx.fillStyle = th.disp;
      Object.keys(pts).forEach(function (k) { var q = pts[k]; ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4, 0, Math.PI * 2); ctx.fill(); });
    };
    function configGraphs() {
      var b = mode === "beats";
      caps[0].innerHTML = b ? '<b class="c-acc">loudness envelope vs t</b> · solid = measured from the wave, dashed = √(A₁² + A₂² + 2A₁A₂cos 2πΔf t)'
        : '<b class="c-disp">f\' heard vs t</b> · solid = counted crests, dashed = formula. Watch it drop as S passes O';
      caps[1].innerHTML = b ? '<b class="c-disp">loud beats counted vs t</b> · slope is the beat frequency, dashed = |f₁ − f₂| t'
        : '<b class="c-disp">crests received vs t</b> · slope is f\', dashed = formula';
      caps[2].innerHTML = b ? '<b class="c-disp">beat frequency vs |f₁ − f₂|</b> · dots = your runs, dashed = f<sub>beat</sub> = |f₁ − f₂|'
        : '<b class="c-disp">f\'/f vs source speed</b> (observer still) · dashed = v/(v − v<sub>S</sub>) approaching and v/(v + v<sub>S</sub>) receding; dots = your runs';
      g1.o.yLabel = b ? "envelope" : "f' (Hz)"; g1.o.xMax = b ? T_BEATS : T_DOP; g1.o.yMin = b ? 0 : undefined;
      g2.o.yLabel = b ? "beats" : "crests"; g2.o.xMax = b ? T_BEATS : T_DOP;
      g3.o.yLabel = b ? "f_beat (Hz)" : "f'/f"; g3.o.xLabel = b ? "|f₁ − f₂| (Hz)" : "|v_S| (m/s)"; g3.o.xMax = b ? 10 : 700; g3.o.xAuto = b;
      [g1, g2, g3].forEach(function (g) { g.clear(); });
    }
    function theory() {
      var i, a = [], c = [];
      if (mode === "beats") {
        var p = bp(), df = Math.abs(p.f1 - p.f2);
        for (i = 0; i <= 2000; i++) { var t = T_BEATS * i / 2000; a.push([t, envF(p, t)]); }
        g1.set("theory", { points: a, color: th.acc, dash: [5, 5], width: 1.5 });
        g2.set("theory", { points: [[0, 0], [T_BEATS, df * T_BEATS]], color: th.disp, dash: [5, 5], width: 1.5 });
        g3.set("theory", { points: [[0, 0], [Math.max(10, df), Math.max(10, df)]], color: th.disp, dash: [5, 5], width: 1.5 });
      } else {
        var q = dp();
        for (i = 0; i <= 350; i++) { var u = 700 * i / 350; if (u < q.v) { var y = q.v / (q.v - u); if (y <= 5) a.push([u, y]); } c.push([u, q.v / (q.v + u)]); }
        g3.set("theory", { points: a, color: th.disp, dash: [5, 5], width: 1.5 });
        g3.set("theory2", { points: c, color: th.disp, dash: [2, 4], width: 1.5 });
        g2.set("theory", { points: [], color: th.disp });
      }
    }

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      if (mode === "beats") {
        var step = Math.max(1, Math.floor(B.env.length / 1500)), pts = [];
        for (var i = 0; i < B.env.length; i += step) pts.push(B.env[i]);
        g1.set("sim", { points: pts, color: th.acc, width: 2, dot: true });
        var st = [[0, 0]];
        B.peaks.forEach(function (tp, k) { st.push([tp, k]); st.push([tp, k + 1]); });
        st.push([sim.time, B.peaks.length]);
        g2.set("sim", { points: st, color: th.disp, width: 2.5, dot: true });
      } else {
        g1.set("theory", { points: D.formula, color: th.disp, dash: [5, 5], width: 1.5 });
        g1.set("sim", { points: D.inst, color: th.disp, width: 2.5, dot: true });
        var cnt = D.arr.map(function (q, k) { return [q.t, (k + 1) * SKIP]; }), th2 = [], acc = 0, first = D.arr.length ? D.arr[0].t : null;
        if (first !== null) {
          th2.push([first, SKIP]); acc = SKIP;
          D.formula.forEach(function (q, k) { if (q[0] > first) { acc += q[1] * K.DT; th2.push([q[0], acc]); } void k; });
        }
        g2.set("sim", { points: cnt, color: th.disp, width: 2.5, dot: true });
        g2.set("theory", { points: th2, color: th.disp, dash: [5, 5], width: 1.5 });
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    var eqEls, setR;
    function buildPanels() {
      var labels = mode === "beats"
        ? ["Superposition of the two forks", "Beat frequency", "The note you hear", "Loudest vs quietest"]
        : ["Doppler: speeds count positive towards the other one", "With your numbers", "Wavelength in front of and behind the source", "Faster than sound?"];
      P.eqs.innerHTML = labels.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = K.readout(P.readouts, mode === "beats" ? [
        { id: "bf", label: "beat frequency (counted)", cls: "c-disp" }, { id: "n", label: "loud beats so far" }, { id: "bt", label: "time between beats" },
        { id: "tone", label: "the tone you hear" }, { id: "ratio", label: "I_max / I_min", cls: "c-acc" }, { id: "env", label: "envelope now", cls: "c-acc" }
      ] : [
        { id: "f", label: "heard f' (counting crests)", cls: "c-normal" }, { id: "vs", label: "source speed towards O", cls: "c-vel" },
        { id: "vo", label: "observer speed towards S", cls: "c-vel" }, { id: "mach", label: "Mach number |v_S|/v" },
        { id: "lam", label: "λ in front / behind S", cls: "c-disp" }, { id: "cone", label: "shock cone half-angle", cls: "c-fric" }
      ]);
    }
    function n(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      if (!B) return;
      if (mode === "beats") {
        var p = bp(), df = Math.abs(p.f1 - p.f2), bf = beatMeas(), t = sim.time;
        K.tex(eqEls[0], "y = A_1\\sin 2\\pi f_1 t + A_2\\sin 2\\pi f_2 t" + (p.r === 1 ? " = 2A\\cos\\big(\\pi(f_1 - f_2)t\\big)\\sin\\big(\\pi(f_1 + f_2)t\\big)" : ",\\;\\; A_2 = " + K.fmt(p.r, 2) + "A_1"));
        K.tex(eqEls[1], "f_{beat} = |f_1 - f_2| = |" + K.fmt(p.f1, 1) + " - " + K.fmt(p.f2, 1) + "| = \\mathbf{" + K.fmt(df, 1) + "}\\ \\text{Hz}\\;\\;(\\text{the cos has } " + K.fmt(df / 2, 2) + "\\text{ Hz, but it's loud at both } \\pm 1)");
        K.tex(eqEls[2], "f_{heard} = \\frac{f_1 + f_2}{2} = \\frac{" + K.fmt(p.f1, 1) + " + " + K.fmt(p.f2, 1) + "}{2} = \\mathbf{" + K.fmt((p.f1 + p.f2) / 2, 2) + "}\\ \\text{Hz}");
        K.tex(eqEls[3], "\\frac{I_{max}}{I_{min}} = \\left(\\frac{A_1 + A_2}{A_1 - A_2}\\right)^2 = \\left(\\frac{1 + " + K.fmt(p.r, 2) + "}{1 - " + K.fmt(p.r, 2) + "}\\right)^2 = \\mathbf{" + (p.r === 1 ? "\\infty" : K.fmt(Math.pow((1 + p.r) / (1 - p.r), 2), 2)) + "}");
        setR("bf", bf !== null ? K.fmt(bf, 2) + " Hz" : "—", bf !== null ? "|f₁ − f₂| = " + K.fmt(df, 2) + " Hz" : df === 0 ? "in unison: no beats" : "waiting for two beats");
        setR("n", String(B.peaks.length), "after t = 0");
        setR("bt", bf !== null ? K.fmt(1 / bf, 3) + " s" : "—", df ? "1/|f₁ − f₂| = " + K.fmt(1 / df, 3) + " s" : "");
        setR("tone", K.fmt((p.f1 + p.f2) / 2, 2) + " Hz", "the average");
        var meas = B.eMin < Infinity && B.peaks.length >= 1 ? Math.pow(B.eMax / Math.max(B.eMin, 1e-9), 2) : null;
        setR("ratio", meas !== null ? (p.r === 1 ? "very large" : K.fmt(meas, 2)) : "—", "formula " + (p.r === 1 ? "∞" : K.fmt(Math.pow((1 + p.r) / (1 - p.r), 2), 2)));
        setR("env", K.fmt(envF(p, t), 2) + " A₁", "between " + K.fmt(1 - p.r, 2) + " and " + K.fmt(1 + p.r, 2));
      } else {
        var q = dp(), F = formula(q), fm = measured(), M = Math.abs(q.vs) / q.v;
        K.tex(eqEls[0], "f' = f\\,\\frac{v + v_O}{v - v_S},\\;\\; v_O > 0 \\text{ if O moves towards S},\\; v_S > 0 \\text{ if S moves towards O}");
        K.tex(eqEls[1], F.f !== null
          ? "f' = " + q.f + "\\times\\frac{" + q.v + " + " + n(F.voT) + "}{" + q.v + " - " + n(F.vsT) + "} = \\mathbf{" + K.fmt(F.f, 1) + "}\\ \\text{Hz}"
          : "\\text{no crest reaches O yet: it's outside the cone}");
        K.tex(eqEls[2], "\\lambda_{front} = \\frac{v - |v_S|}{f} = \\mathbf{" + K.fmt((q.v - Math.abs(q.vs)) / q.f, 3) + "}\\ \\text{m},\\;\\; \\lambda_{behind} = \\frac{v + |v_S|}{f} = \\mathbf{" + K.fmt((q.v + Math.abs(q.vs)) / q.f, 3) + "}\\ \\text{m}");
        K.tex(eqEls[3], M > 1 ? "\\sin\\theta = \\frac{v}{v_S} = \\frac{" + q.v + "}{" + Math.abs(q.vs) + "} \\Rightarrow \\theta = \\mathbf{" + K.fmt(Math.asin(1 / M) / K.DEG, 1) + "^\\circ}" : "M = \\frac{|v_S|}{v} = " + K.fmt(M, 2) + " < 1:\\ \\text{no shock wave}");
        setR("f", fm !== null ? K.fmt(fm, 1) + " Hz" : "—", F.f !== null ? "formula " + K.fmt(F.f, 1) + " Hz" + (F.two ? " (and a second arrival)" : "") : "silent");
        setR("vs", F.f !== null ? K.fmt(F.vsT, 1) + " m/s" : "—", "negative = moving away");
        setR("vo", F.f !== null ? K.fmt(F.voT, 1) + " m/s" : "—", "negative = moving away");
        setR("mach", K.fmt(M, 2), M > 1 ? "supersonic" : "subsonic");
        setR("lam", M < 1 ? K.fmt((q.v - Math.abs(q.vs)) / q.f, 3) + " / " + K.fmt((q.v + Math.abs(q.vs)) / q.f, 3) + " m" : "—", "still air: " + K.fmt(q.v / q.f, 3) + " m");
        setR("cone", M > 1 ? K.fmt(Math.asin(1 / M) / K.DEG, 1) + "°" : "—", "sin θ = v/v_S");
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p><b>Beats.</b> Two waves of nearly the same frequency add up. Sometimes their crests line up (loud), sometimes a crest meets a trough (quiet). They drift through one full cycle of that every $1/|f_1 - f_2|$ seconds, so you hear $|f_1 - f_2|$ throbs a second, on a note at the average frequency.</p>" +
      "<p><b>Doppler.</b> A source moving through the air squeezes the wavelength in front of it to $(v - v_S)/f$ and stretches it behind. An observer moving through the air meets crests faster, at $(v + v_O)/\\lambda$. Put together: $f' = f\\,(v + v_O)/(v - v_S)$, with each speed counted positive <i>towards</i> the other. Faster than sound, the wavefronts pile up on a cone: a sonic boom.</p>" +
      '<div class="trap"><b>JEE trap: Doppler isn\'t symmetric, and the beat isn\'t half.</b> A source approaching at $u$ gives $fv/(v-u)$; an observer approaching at $u$ gives $f(v+u)/v$: different numbers, because what matters is motion relative to the air. And in $2A\\cos(\\pi\\Delta f\\,t)$ the cosine runs at $\\Delta f/2$, but loudness peaks at both $+1$ and $-1$, so the beat frequency is $\\Delta f$, not $\\Delta f/2$.</div>');
    function apply(s) {
      setMode(s.mode);
      if (s.mode === "beats") { f1S.set(s.f1); f2S.set(s.f2); rS.set(s.r); }
      else { fS.set(s.f); vS.set(s.v); vsS.set(s.vs); voS.set(s.vo); homeS = { x: s.xs, y: 0 }; homeO = { x: s.xo, y: 0 }; }
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "beats", setup: { mode: "beats", f1: 256, f2: 262, r: 1 }, watch: "Predict both, then press Play and count the throbs",
        q: "Tuning forks of 256 Hz and 262 Hz are sounded together. How many beats per second do you hear, and at what pitch?",
        options: ["6 beats/s, on a 259 Hz note", "6 beats/s, on a 256 Hz note", "3 beats/s, on a 259 Hz note", "518 beats/s, on a 6 Hz note"], answer: 0,
        explain: "The beat frequency is $|262 - 256| = 6$ Hz and the note is the average, 259 Hz. 3 Hz comes from reading the $\\cos(\\pi\\Delta f\\,t)$ term as the beat, but the sound is loud at both its peaks and its troughs." },
      { level: "medium", tag: "loading a fork with wax", setup: { mode: "beats", f1: 256, f2: 252, r: 1 }, watch: "This is f₂ = 252 Hz: 4 beats/s. Now lower f₂ a little (wax) and watch the beat count. Then try 260 Hz",
        q: "Fork A (256 Hz) gives 4 beats per second with fork B. Sticking wax on B, which lowers its frequency, raises the beats to 6 per second. What was B's frequency?",
        options: ["252 Hz", "260 Hz", "250 Hz", "262 Hz"], answer: 0,
        hints: ["4 beats/s means B is 252 Hz or 260 Hz.", "Wax lowers B. Which choice moves further from 256 Hz when it goes down?"],
        explain: "B is $256 \\pm 4$. If B were 260 Hz, lowering it would bring it towards 256 and the beats would drop. Only 252 Hz moves away: loaded to 250 Hz it gives 6 beats/s. 250 Hz is B after the wax, not before." },
      { level: "hard", tag: "source vs observer", setup: { mode: "doppler", f: 500, v: 340, vs: 34, vo: 0, xs: 150, xo: 700 }, watch: "Run it and read f'. Then set v_S = 0 and v_O = −34 m/s (towards S) and run again",
        q: "A 500 Hz siren and a listener are in still air ($v$ = 340 m/s). In case (i) the siren moves towards the stationary listener at 34 m/s. In case (ii) the listener moves towards the stationary siren at 34 m/s. By how much do the heard frequencies differ?",
        options: ["0 Hz: only the relative speed matters", "5.6 Hz", "50 Hz", "105.6 Hz"], answer: 1,
        hints: ["Case (i): $f' = fv/(v - v_S)$.", "Case (ii): $f' = f(v + v_O)/v$."],
        explain: "(i) $500 \\times 340/306 = 555.6$ Hz. (ii) $500 \\times 374/340 = 550.0$ Hz. The difference is 5.6 Hz. The source squeezes the wavelength in the air; the moving listener doesn't change it, only meets it faster. 50 Hz is just case (ii)'s shift; 105.6 Hz adds both shifts." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    setMode("beats");
    transportUI = K.transport(P, sim, { onReset: reset, onPlay: function () { if (ended) reset(); setTimeout(audioSync, 0); } });
    P.playBtn.addEventListener("click", function () { setTimeout(audioSync, 0); });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_beatsdoppler = {
        apply: apply,
        set: function (k, v) { ({ f1: f1S, f2: f2S, r: rS, f: fS, v: vS, vs: vsS, vo: voS })[k].set(v); reset(); },
        place: function (xs, xo, yo) { homeS = { x: xs, y: 0 }; homeO = { x: xo, y: yo || 0 }; reset(); },
        state: function () {
          return { mode: mode, t: sim.time, beat: B && beatMeas(), peaks: B && B.peaks.length, eMax: B && B.eMax, eMin: B && B.eMin,
            fMeas: D && measured(), formula: D && formula(dp()), arrivals: D && D.arr.length, src: D && D.src, obs: D && D.obs };
        }
      };
    }

    return function destroy() {
      sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); });
      if (ac) { try { ac.close(); } catch (e) { /* already closed */ } }
    };
  }
})();
