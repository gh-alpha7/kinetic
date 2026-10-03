/* SHM, lab 2: pendulums. A simple pendulum you pull to any angle, planets, a lift, and a swinging rod. */
(function () {
  "use strict";
  var SUB = 20, TH_MAX = 170;
  var PLANETS = [{ label: "Moon", value: 1.62 }, { label: "Mars", value: 3.71 }, { label: "Earth", value: 9.8 }, { label: "Jupiter", value: 24.8 }];

  var lab = {
    id: "pendulum", chapter: "shm", title: "Pendulums", short: "T = 2π√(L/g), and when it isn't",
    lede: "Drag the bob out and let it go. For small swings the period is $2\\pi\\sqrt{L/g}$ and nothing else matters. Pull it out to 90° and watch the formula start to lie, then take it to the Moon, ride it in a lift, or swap it for a swinging rod.",
    tries: [
      { id: "amp", title: "Show small swings all take the same time",
        text: "Time two swings of 15° or less, one at least twice as wide as the other, same length and $g$.",
        why: "For small $\\theta$, $\\sin\\theta \\approx \\theta$, so the restoring torque is proportional to $\\theta$: that's SHM, and SHM's period doesn't depend on amplitude. Galileo noticed this in a cathedral." },
      { id: "big", title: "Make the period 10% longer than 2π√(L/g)",
        text: "Pull the bob out far enough that the measured period is at least 1.1 times the small-angle formula.",
        why: "At large angles $\\sin\\theta < \\theta$, so the restoring force is weaker than SHM assumes and the bob takes longer. It needs about 70°; at 90° the period is 18% longer." },
      { id: "lift", title: "Change the period by 20% without touching the pendulum",
        text: "Accelerate the lift and measure a period at least 20% different from the one at rest.",
        why: "In a lift accelerating up at $a$, everything inside feels $g_{\\text{eff}} = g + a$. Accelerating up shortens $T$; accelerating down lengthens it, and in free fall ($a = -g$) it stops swinging altogether." },
      { id: "rod", title: "Find the pivot that makes the rod swing fastest",
        text: "In rod mode, measure periods at three or more pivot points (same rod) and find the shortest.",
        why: "$T = 2\\pi\\sqrt{(L^2/12 + d^2)/(gd)}$ is smallest when $d = L/\\sqrt{12} \\approx 0.29L$. Pivot at the centre ($d \\to 0$) and it never swings back; pivot at the end and the extra inertia slows it." }
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
  // arithmetic–geometric mean: the exact period is T0 / AGM(1, cos(θ0/2))
  function agm(a, b) { for (var i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) { var a2 = (a + b) / 2; b = Math.sqrt(a * b); a = a2; } return (a + b) / 2; }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 440, PIV = { x: 500, y: 215 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "simple", g = 9.8, sign = 1;
    var LS = K.slider({ label: "Length $L$", unit: "m", min: 0.2, max: 3, step: 0.01, value: 1, onInput: function (v) { dS.input.max = v / 2; if (dS.get() > v / 2) dS.set(v / 2); reset(); } });
    var thS = K.slider({ label: "Release angle $\\theta_0$", unit: "°", min: 1, max: TH_MAX, step: 1, value: 20, onInput: reset, hint: "Or drag the bob." });
    var dS = K.slider({ label: "Pivot to centre $d$", unit: "m", min: 0.02, max: 0.5, step: 0.01, value: 0.5, onInput: reset, hint: "$d = L/2$ is a pivot at the end." });
    var liftS = K.slider({ label: "Lift acceleration $a$", unit: "m/s²", min: -9.8, max: 15, step: 0.1, value: 0, onInput: reset,
      hint: "Up is positive. $-9.8$ is free fall on Earth." });
    P.controls.innerHTML = "<h3>Pendulum</h3>";
    var modeSeg = K.seg([{ label: "Simple (bob on a string)", value: "simple" }, { label: "Rod (physical)", value: "rod" }], mode,
      function (v) { mode = v; dS.el.hidden = v !== "rod"; reset(); }, "Pendulum");
    P.controls.appendChild(modeSeg);
    [LS, dS, thS].forEach(function (s) { P.controls.appendChild(s.el); });
    dS.el.hidden = true;
    P.controls.appendChild(K.h("<h3>Gravity</h3>"));
    var gSeg = K.seg(PLANETS, g, function (v) { g = v; reset(); }, "Planet");
    P.controls.appendChild(gSeg);
    P.controls.appendChild(liftS.el);
    var show = { twin: true, vec: true };
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Small-angle twin", true, function (v) { show.twin = v; }));
    row.appendChild(K.check("Forces", true, function (v) { show.vec = v; }));
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>angle θ</span><span class="c-vel"><i></i>velocity</span>' +
      '<span class="c-grav"><i></i>weight, g_eff</span><span class="c-ten"><i></i>tension</span><span class="c-acc"><i></i>lift acceleration</span></div>'));

    function params() {
      var p = { mode: mode, L: LS.get(), d: Math.min(dS.get(), LS.get() / 2), th0: thS.get() * sign, g: g, lift: liftS.get() };
      p.geff = p.g + p.lift;
      p.Leq = p.mode === "simple" ? p.L : (p.L * p.L / 12 + p.d * p.d) / p.d;     // I/(md): the simple pendulum with the same period
      p.T0 = p.geff > 0 ? 2 * Math.PI * Math.sqrt(p.Leq / p.geff) : Infinity;
      p.Tex = p.T0 / agm(1, Math.cos(Math.abs(p.th0) * K.DEG / 2));
      return p;
    }

    /* ---------- state + physics ---------- */
    var st, rec, runs = [], p0, dragging = false, win = 10;
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();
    function energy(q, w) { return 0.5 * p0.Leq * w * w + p0.geff * (1 - Math.cos(q)); }   // energy ÷ (m L_eq): constant for the true equation

    function reset() {
      sim.pause(); sim.resetClock();
      p0 = params();
      var q0 = p0.th0 * K.DEG;
      st = { t: 0, q: q0, w: 0, crossT: null, T: null, run: null, E0: energy(q0, 0), drift: 0 };
      st.f = function (t, q) { return -p0.geff / p0.Leq * Math.sin(q); };
      win = Math.min(20, Math.max(4, Math.ceil(4 * (isFinite(p0.Tex) ? p0.Tex : 5))));
      rec = { t: [0], q: [p0.th0] };
      P.time.textContent = "t = 0.00 s";
      if (transportUI) transportUI.render();
      theory(); update(true);
      if (p0.geff <= 0) K.flash(P.note, p0.geff === 0 ? "Free fall: no weight to pull it back, so it won't swing" : "g_eff points up: the bob now 'hangs' above the pivot", 3500);
    }

    sim.on("before", function () {
      if (dragging) return;
      var h = K.DT / SUB;
      for (var i = 0; i < SUB; i++) {
        var qPrev = st.q, tPrev = st.t;
        var r = rk4(st.f, st.t, st.q, st.w, h);
        st.q = r[0]; st.w = r[1]; st.t += h;
        if (qPrev < 0 && st.q >= 0) {                               // upward zero crossing of θ
          var tc = tPrev + h * (-qPrev) / (st.q - qPrev);
          if (st.crossT !== null) { st.T = tc - st.crossT; logRun(); }
          st.crossT = tc;
        }
      }
      st.drift = Math.max(st.drift, Math.abs(energy(st.q, st.w) - st.E0) / Math.max(st.E0, 1e-9));
      st.t = (sim.steps + 1) * K.DT;
    });
    sim.on("step", function (t) {
      if (t <= win + 1e-9) { rec.t.push(t); rec.q.push(st.q / K.DEG); }
      update(false);
    });

    function logRun() {
      var p = p0;
      if (!st.run) { st.run = { mode: p.mode, L: p.L, d: p.d, g: p.g, lift: p.lift, geff: p.geff, th0: Math.abs(p.th0), T: st.T, T0: p.T0 }; runs.push(st.run); if (runs.length > 40) runs.shift(); }
      st.run.T = st.T;
      var r = st.run, same = function (a, b) { return Math.abs(a - b) < 1e-9; };
      if (r.T >= 1.1 * r.T0) tries.mark("big");
      if (r.lift !== 0) {
        var still = 2 * Math.PI * Math.sqrt(p.Leq / p.g) / agm(1, Math.cos(r.th0 * K.DEG / 2));
        if (Math.abs(r.T / p.Tex - 1) < 0.01 && Math.abs(r.T / still - 1) >= 0.2) tries.mark("lift");
      }
      var rods = [];
      runs.forEach(function (o) {
        if (o !== r && o.mode === "simple" && r.mode === "simple" && same(o.L, r.L) && same(o.geff, r.geff) && o.th0 <= 15 && r.th0 <= 15 &&
            Math.max(o.th0, r.th0) >= 2 * Math.min(o.th0, r.th0) && Math.abs(o.T / r.T - 1) < 0.01) tries.mark("amp");
        if (o.mode === "rod" && r.mode === "rod" && same(o.L, r.L) && same(o.geff, r.geff)) rods.push(o);
      });
      var ds = {};
      rods.forEach(function (o) { ds[o.d.toFixed(3)] = true; });
      if (Object.keys(ds).length >= 3) {
        var best = rods.reduce(function (a, b) { return b.T < a.T ? b : a; });
        if (Math.abs(best.d - r.L / Math.sqrt(12)) <= 0.03 * r.L) tries.mark("rod");
      }
    }

    /* ---------- drawing ---------- */
    function scale() { return 190 / Math.max(p0.mode === "simple" ? p0.L : p0.d + p0.L / 2, 1); }
    function at(q, r) { var S = scale(); return { x: PIV.x + r * S * Math.sin(q), y: PIV.y + r * S * Math.cos(q) }; }
    function bobR() { return 14; }

    sim.on("under", function (ctx) {
      var p = p0;
      // the lift cabin, when it accelerates
      if (p.lift !== 0) {
        ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = 3;
        ctx.strokeRect(PIV.x - 250, 12, 500, H - 24);
        K.arrow(ctx, PIV.x + 290, H / 2 + (p.lift > 0 ? 40 : -40), PIV.x + 290, H / 2 + (p.lift > 0 ? -40 : 40), th.acc, { label: "a = " + K.fmt(Math.abs(p.lift), 1) + " m/s² " + (p.lift > 0 ? "up" : "down"), lx: -40, ly: p.lift > 0 ? -14 : 14 });
      }
      // g_eff arrow
      var ga = Math.min(90, Math.abs(p.geff) * 4.5);
      if (ga > 2) K.arrow(ctx, 80, 150, 80, 150 + (p.geff > 0 ? ga : -ga), th.grav, { label: "g_eff = " + K.fmt(p.geff, 2) });
      else K.label(ctx, "g_eff = 0", 80, 160, th.grav);
      K.label(ctx, PLANETS.filter(function (q) { return q.value === p.g; })[0].label + ", g = " + p.g + " m/s²", 80, 120, th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
      // vertical reference and the release angle
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PIV.x, PIV.y); ctx.lineTo(PIV.x, PIV.y + 200); ctx.stroke(); ctx.restore();
      var q0 = p.th0 * K.DEG, R = (p.mode === "simple" ? p.L : p.d) * scale();
      ctx.strokeStyle = K.alpha(th.disp, 0.35); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(PIV.x, PIV.y, R, Math.PI / 2 - Math.abs(q0), Math.PI / 2 + Math.abs(q0)); ctx.stroke();
      // the small-angle twin: θ0 cos(ω0 t)
      if (show.twin && p.mode === "simple" && isFinite(p.T0) && Math.abs(p.th0) <= 120) {
        var qt = q0 * Math.cos(2 * Math.PI / p.T0 * st.t), b = at(qt, p.L);
        ctx.save(); ctx.globalAlpha = 0.35; ctx.setLineDash([5, 5]); ctx.strokeStyle = th.muted; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(PIV.x, PIV.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]); ctx.strokeStyle = th.muted; ctx.beginPath(); ctx.arc(b.x, b.y, bobR(), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        K.label(ctx, "dashed twin: θ₀ cos ω₀t, the small-angle answer", 80, H - 14, th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
      }
    });

    sim.on("over", function (ctx) {
      var p = p0, q = st.q;
      if (p.mode === "simple") {
        var b = at(q, p.L);
        ctx.strokeStyle = th.ten; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(PIV.x, PIV.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(b.x, b.y, bobR(), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(b.x - 4, b.y - 4, 4, 0, Math.PI * 2); ctx.fill();
        if (show.vec) {
          var k = 5;                                         // px per m/s² (per kg)
          K.arrow(ctx, b.x, b.y, b.x, b.y + p.geff * k, th.grav, { label: "mg", width: 2.5 });
          var tan = -p.geff * Math.sin(q);                   // component along the arc
          K.arrow(ctx, b.x, b.y, b.x + tan * k * Math.cos(q), b.y - tan * k * Math.sin(q), K.alpha(th.grav, 0.6), { label: "mg sinθ", width: 2, dash: [4, 3], lx: tan * Math.cos(q) < 0 ? -78 : 6 });
          var v = st.w * p.L;
          if (Math.abs(v) > 0.02) K.arrow(ctx, b.x, b.y, b.x + v * 30 * Math.cos(q), b.y - v * 30 * Math.sin(q), th.vel, { label: "v " + K.fmt(Math.abs(v), 2), lx: v * Math.cos(q) < 0 ? -64 : 6, ly: -12 });
        }
      } else {
        var S = scale(), e1 = at(q, p.d - p.L / 2), e2 = at(q, p.d + p.L / 2), c = at(q, p.d);
        ctx.strokeStyle = th.body; ctx.lineWidth = 14; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke(); ctx.lineCap = "butt";
        ctx.fillStyle = th.grav; ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.fill();
        K.label(ctx, "centre", c.x + 12, c.y + 6, th.grav, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
        if (show.vec) K.arrow(ctx, c.x, c.y, c.x, c.y + p.geff * 5, th.grav, { label: "mg", width: 2.5 });
        void S;
      }
      // pivot
      ctx.fillStyle = th["ground-top"]; ctx.fillRect(PIV.x - 40, PIV.y - 12, 80, 6);
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(PIV.x, PIV.y, 4, 0, Math.PI * 2); ctx.fill();
      K.label(ctx, "θ = " + K.fmt(q / K.DEG, 1) + "°", PIV.x, PIV.y - 18, th.disp, { bg: true });
      if (!sim.running && sim.steps === 0 && !dragging) {
        var tip = at(q, p.mode === "simple" ? p.L : p.d + p.L / 2);
        K.label(ctx, "drag me", tip.x, tip.y + 34, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      }
    });

    /* ---------- drag the bob (or the rod's end) ---------- */
    sim.pointer({
      down: function (pt) {
        var tip = at(st.q, p0.mode === "simple" ? p0.L : p0.d + p0.L / 2);
        if (Math.hypot(pt.px - tip.x, pt.py - tip.y) > 34) return false;
        sim.pause(); transportUI.render(); dragging = true; return true;
      },
      drag: function (pt) {
        if (!dragging) return;
        var q = Math.atan2(pt.px - PIV.x, pt.py - PIV.y) / K.DEG;
        q = K.clamp(Math.round(q), -TH_MAX, TH_MAX);
        if (Math.abs(q) < 1) q = q < 0 ? -1 : 1;
        sign = q < 0 ? -1 : 1; thS.set(Math.abs(q));
        st.q = q * K.DEG; st.w = 0;
      },
      up: function () { if (!dragging) return; dragging = false; reset(); sim.play(); transportUI.render(); }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">θ–t</b> · dashed is the small-angle cosine $\\theta_0\\cos\\omega_0 t$: it pulls ahead at big angles</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b>T vs θ₀</b> · dashed: exact; flat line: $2\\pi\\sqrt{L/g}$; dots: your runs</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap g3cap"></p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var g3cap = P.graphs.querySelector(".g3cap");
    var cv = P.graphs.querySelectorAll("canvas");
    var gq = new K.Graph(cv[0], { yLabel: "θ (°)", xMax: 10, color: th.disp });
    var gT = new K.Graph(cv[1], { yLabel: "T (s)", xLabel: "θ₀ (°)", xMax: TH_MAX, yMin: 0, color: th.ink });
    var gL = new K.Graph(cv[2], { yLabel: "T (s)", xLabel: "L (m)", xMax: 3, yMin: 0, color: th.ink });

    function theory() {
      var p = p0, qs = [], tex = [], tflat = [], tl = [];
      gq.clear(); gq.o.xMax = win;
      if (isFinite(p.T0)) {
        for (var t = 0; t <= win + 1e-9; t += win / 400) qs.push([t, p.th0 * Math.cos(2 * Math.PI / p.T0 * t)]);
        for (var a = 1; a <= TH_MAX; a += 1) { tex.push([a, p.T0 / agm(1, Math.cos(a * K.DEG / 2))]); tflat.push([a, p.T0]); }
        if (p.mode === "simple") {
          for (var L = 0.05; L <= 3 + 1e-9; L += 0.05) tl.push([L, 2 * Math.PI * Math.sqrt(L / p.geff)]);
        } else {
          for (var d = 0.01; d <= p.L / 2 + 1e-9; d += p.L / 200) tl.push([d, 2 * Math.PI * Math.sqrt((p.L * p.L / 12 + d * d) / (d * p.geff))]);
        }
      }
      gq.set("theory", { points: qs, color: th.disp, dash: [5, 5], width: 1.5 });
      gT.set("exact", { points: tex, color: th.ink, dash: [5, 5], width: 1.5 });
      gT.set("flat", { points: tflat, color: K.alpha(th.muted, 0.7), width: 1.2 });
      gL.o.xMax = p.mode === "simple" ? 3 : p.L / 2;
      gL.o.xLabel = p.mode === "simple" ? "L (m)" : "d (m)";
      gL.o.yMax = p.mode === "simple" ? undefined : 3 * p.T0;
      gL.series = {};
      gL.set("theory", { points: tl.filter(function (q) { return p.mode === "simple" || q[1] < 4 * p.T0; }), color: th.ink, dash: [5, 5], width: 1.5 });
      g3cap.innerHTML = K.md(p.mode === "simple" ? "<b>T vs L</b> · $T \\propto \\sqrt L$ for your $g_{\\text{eff}}$; dots: your small-angle runs"
        : "<b>T vs pivot d</b> · minimum at $d = L/\\sqrt{12}$ = " + K.fmt(p.L / Math.sqrt(12), 3) + " m; dots: your runs");
    }
    var drawGraphs = K.throttle(function () {
      var p = p0;
      gq.set("sim", { points: rec.t.map(function (t, i) { return [t, rec.q[i]]; }), color: th.disp, width: 2.5, dot: true });
      var mineT = runs.filter(function (r) { return r.mode === p.mode && Math.abs(r.L - p.L) < 1e-9 && Math.abs(r.geff - p.geff) < 1e-9 && (p.mode === "simple" || Math.abs(r.d - p.d) < 1e-9); });
      var mineL = runs.filter(function (r) { return r.mode === p.mode && Math.abs(r.geff - p.geff) < 1e-9 && (p.mode === "simple" ? r.th0 <= 15 : Math.abs(r.L - p.L) < 1e-9); });
      gT.extra = function (ctx, X, Y) { dots(ctx, X, Y, mineT.map(function (r) { return [r.th0, r.T]; }), th.disp); if (st.T) ring(ctx, X(Math.abs(p.th0)), Y(st.T)); };
      gL.extra = function (ctx, X, Y) { dots(ctx, X, Y, mineL.map(function (r) { return [p.mode === "simple" ? r.L : r.d, r.T]; }), th.disp); };
      [gq, gT, gL].forEach(function (gr) { gr.dirty = true; gr.draw(); });
    }, 50);
    function dots(ctx, X, Y, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4.5, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Effective gravity", "Small-angle period", "Exact period at your angle", "Equation of motion, now"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "T", label: "period T" }, { id: "T0", label: "2π√(L/g)" }, { id: "ratio", label: "T ÷ small-angle T" },
      { id: "q", label: "angle θ", cls: "c-disp" }, { id: "w", label: "angular speed", cls: "c-vel" }, { id: "g", label: "g_eff", cls: "c-grav" }
    ]);
    var slowMaths = K.throttle(renderMaths, 100);
    function B(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      var p = p0, a0 = Math.abs(p.th0) * K.DEG;
      K.tex(eqEls[0], "g_{\\text{eff}} = g + a = " + p.g + " + " + B(p.lift, 1) + " = \\mathbf{" + K.fmt(p.geff, 2) + "}\\ \\text{m/s}^2");
      if (p.mode === "simple") K.tex(eqEls[1], "T_0 = 2\\pi\\sqrt{\\tfrac{L}{g_{\\text{eff}}}} = 2\\pi\\sqrt{\\tfrac{" + p.L + "}{" + K.fmt(p.geff, 2) + "}} = \\mathbf{" + K.fmt(p.T0, 3) + "}\\ \\text{s}");
      else K.tex(eqEls[1], "T_0 = 2\\pi\\sqrt{\\tfrac{I}{mg_{\\text{eff}}d}},\\ \\tfrac{I}{m} = \\tfrac{L^2}{12} + d^2 = " + K.fmt(p.L * p.L / 12 + p.d * p.d, 4) + "\\ \\Rightarrow\\ T_0 = \\mathbf{" + K.fmt(p.T0, 3) + "}\\ \\text{s}");
      K.tex(eqEls[2], "T = \\frac{T_0}{\\text{AGM}(1, \\cos\\frac{\\theta_0}{2})} = \\mathbf{" + K.fmt(p.Tex, 3) + "}\\ \\text{s} \\approx T_0\\left(1 + \\tfrac{\\theta_0^2}{16}\\right) = " + K.fmt(p.T0 * (1 + a0 * a0 / 16), 3) + "\\ \\text{s}");
      K.tex(eqEls[3], "\\ddot\\theta = -\\frac{g_{\\text{eff}}}{" + (p.mode === "simple" ? "L" : "L_{\\text{eq}}") + "}\\sin\\theta = -\\frac{" + K.fmt(p.geff, 2) + "}{" + K.fmt(p.Leq, 3) + "}\\sin" + B(st.q / K.DEG, 1) + "^\\circ = \\mathbf{" + K.fmt(-p.geff / p.Leq * Math.sin(st.q), 2) + "}\\ \\text{rad/s}^2");
      setR("T", st.T ? K.fmt(st.T, 3) + " s" : "—", "measured · exact " + K.fmt(p.Tex, 3) + " s");
      setR("T0", K.fmt(p.T0, 3) + " s", p.mode === "simple" ? "small-angle formula" : "2π√(I/mgd)");
      setR("ratio", st.T ? K.fmt(st.T / p.T0, 4) : K.fmt(p.Tex / p.T0, 4), st.T ? "measured" : "exact, before you run it");
      setR("q", K.fmt(st.q / K.DEG, 1) + "°", "released at " + K.fmt(p.th0, 0) + "°");
      setR("w", K.fmt(st.w, 3) + " rad/s");
      setR("g", K.fmt(p.geff, 2) + " m/s²", p.lift ? "lift adds " + K.fmt(p.lift, 1) : "lift at rest");
      P.hud.innerHTML = "<span>T₀ = " + K.fmt(p.T0, 3) + " s</span><span>exact T = " + K.fmt(p.Tex, 3) + " s</span>" + (p.mode === "rod" ? "<span>L_eq = I/md = " + K.fmt(p.Leq, 3) + " m</span>" : "");
    }
    function update(force) { drawGraphs(); if (force) renderMaths(); else slowMaths(); }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Pull the bob aside and the component of its weight along the arc, $mg\\sin\\theta$, pulls it back. Newton's law along the arc gives $\\ddot\\theta = -\\tfrac{g}{L}\\sin\\theta$. For small angles $\\sin\\theta \\approx \\theta$ and that's SHM with $\\omega = \\sqrt{g/L}$, so $T = 2\\pi\\sqrt{L/g}$: no mass, no amplitude.</p>" +
      "<p>At big angles $\\sin\\theta < \\theta$, the pull back is weaker than SHM's, and the swing takes longer. The lab integrates the true equation, and its period matches the exact result $T_0/\\text{AGM}(1, \\cos\\tfrac{\\theta_0}{2})$, which is $T_0(1 + \\theta_0^2/16 + \\dots)$.</p>" +
      "<p>Anything that changes the felt gravity changes $T$ through $g_{\\text{eff}}$: other planets, or a lift accelerating at $a$ ($g_{\\text{eff}} = g + a$, up positive). A rigid body swinging on a pivot is a <b>physical pendulum</b>: $T = 2\\pi\\sqrt{I/mgd}$, with $I$ about the pivot and $d$ the distance to the centre of mass.</p>" +
      '<div class="trap"><b>JEE trap: velocity doesn\'t change g_eff, acceleration does.</b> A lift moving up or down at steady speed leaves the period alone. Only its acceleration counts, and a lift accelerating <i>down</i> at $a$ makes $T = 2\\pi\\sqrt{L/(g - a)}$ longer.</div>');
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function apply(s) {
      mode = s.mode; g = s.g || 9.8; sign = 1;
      setSeg(modeSeg, mode); setSeg(gSeg, g); dS.el.hidden = mode !== "rod";
      LS.set(s.L); dS.input.max = s.L / 2; if (s.d) dS.set(s.d); else if (dS.get() > s.L / 2) dS.set(s.L / 2);
      thS.set(s.th0); liftS.set(s.lift || 0);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "pendulum on the Moon", setup: { mode: "simple", L: 1, th0: 5, g: 1.62, lift: 0 }, watch: "Predict T, then press Release and read the measured period",
        q: "What is the period of a 1 m simple pendulum on the Moon, where $g = 1.62$ m/s²?",
        options: ["2.01 s", "3.88 s", "4.94 s", "7.97 s"], answer: 2,
        explain: "$T = 2\\pi\\sqrt{L/g} = 2\\pi\\sqrt{1/1.62} = 4.94$ s, about $\\sqrt6 \\approx 2.5$ times Earth's 2.01 s. 3.88 s forgets the square root; 7.97 s puts $g$ on top." },
      { level: "medium", tag: "pendulum in a lift", setup: { mode: "simple", L: 0.99, th0: 5, g: 9.8, lift: 4.9 }, watch: "Measure T with the lift accelerating, then set a = 0 and compare",
        q: "A pendulum has a period of 2.0 s in a lift at rest. The lift then accelerates upward at 4.9 m/s². What is the new period?",
        options: ["1.63 s", "1.41 s", "2.00 s", "2.45 s"], answer: 0,
        hints: ["Inside the lift, the bob feels $g_{\\text{eff}} = g + a$.", "$T \\propto 1/\\sqrt{g_{\\text{eff}}}$, so $T' = T\\sqrt{g/(g + a)}$."],
        explain: "$g_{\\text{eff}} = 9.8 + 4.9 = 14.7$ m/s² $= 1.5g$, so $T' = 2.0/\\sqrt{1.5} = 1.63$ s. 2.45 s is what you get accelerating downward; 1.41 s would need $g_{\\text{eff}} = 2g$." },
      { level: "hard", tag: "physical pendulum", setup: { mode: "rod", L: 1.2, d: 0.35, th0: 5, g: 9.8, lift: 0 }, watch: "Release at d = 0.35 m, then try other pivots: is it the shortest?",
        q: "A uniform rod of length 1.2 m swings in a vertical plane about a horizontal axis a distance $d$ from its centre ($g = 9.8$). For what $d$ is the period smallest, and what is that period?",
        options: ["0.35 m and 1.67 s", "0.60 m and 1.80 s", "0.35 m and 1.18 s", "0.17 m and 1.87 s"], answer: 0,
        hints: ["$I = m(L^2/12 + d^2)$ about the pivot, so $T = 2\\pi\\sqrt{(L^2/12 + d^2)/(gd)}$.", "Minimise $L^2/12d + d$: its derivative vanishes at $d^2 = L^2/12$."],
        explain: "$f(d) = L^2/(12d) + d$ is smallest at $d = L/\\sqrt{12} = 0.346$ m, where $f = 2d$. Then $T = 2\\pi\\sqrt{2d/g} = 2\\pi\\sqrt{0.693/9.8} = 1.67$ s. Pivoting at the end ($d = 0.6$ m) gives 1.80 s; 1.18 s forgets the factor 2." }
    ], apply, P);

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_pendulum = { apply: apply, state: function () { return st; }, params: function () { return p0; }, runs: runs,
        exactT: function () { return p0.Tex; }, smallT: function () { return p0.T0; }, energyDrift: function () { return st.drift; } };
    }

    return function destroy() { sim.destroy(); [gq, gT, gL].forEach(function (gr) { gr.destroy(); }); };
  }
})();
