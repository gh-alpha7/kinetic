/* Rotational motion, lab 2: a wheel spun up by a falling mass, and a spinning platform whose masses slide in. */
(function () {
  "use strict";
  var G = 9.8, DROP = 2, BOX = 0.3, COLLAR = 0.05, RP = 1;     // drop height (m), box size (m), collar radius (m), platform radius (m)
  var SHAPES = { ring: "Ring", disc: "Disc", rod: "Rod + collars" };

  var lab = {
    id: "inertia", chapter: "rotation", title: "Moment of inertia", short: "τ = Iα, I = Σmr², L = Iω",
    lede: "Hang a mass from a string wound round a wheel and let it fall. How fast it falls depends on where the wheel keeps its mass, not just how much there is. Then spin a platform and pull its masses in.",
    tries: [
      { id: "shape", title: "Race a ring against a disc",
        text: "Drop the same mass with a ring, then a disc, keeping $M$, $R$ and $r$ the same.",
        why: "All of a ring's mass sits at the rim, so $I = MR^2$, twice the disc's $\\tfrac12 MR^2$. More $I$ means more of the falling mass's pull goes into spinning the wheel, so it falls slower." },
      { id: "collars", title: "Slow it down without adding mass",
        text: "With the rod, run it once, slide the collars outward, and run it again.",
        why: "Same mass, bigger $I$: each collar adds $m d^2$ (parallel-axis theorem, plus its own small $\\tfrac12 m a^2$). Distance from the axis counts squared." },
      { id: "light", title: "Make the wheel almost not matter",
        text: "Get the hanging mass to fall with $a \\ge 0.9g$.",
        why: "$a = \\dfrac{g\\,m}{m + I/r^2}$: the wheel acts like an extra mass $I/r^2$ on the string. Make it small (light wheel, big spool) next to $m$ and the mass nearly falls freely." },
      { id: "skater", title: "Spin up like a skater",
        text: "On the platform, pull the masses in until $\\omega$ at least doubles.",
        why: "No outside torque, so $L = I\\omega$ stays fixed: halve $I$ and $\\omega$ doubles. Kinetic energy $L^2/2I$ goes <i>up</i>; the extra comes from the work done pulling the masses in." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 140, origin = { x: 100, y: 500 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: G, gridStep: 0.1, gridMajor: 1, yLabels: false, labels: false });
    var AX = { x: 3, y: 3 }, SP = { x: 3.4, y: 1.85 };         // wheel axle, platform centre (m)

    /* ---------- controls ---------- */
    var mode = "wheel", shape = "disc";
    var MS = K.slider({ label: "Wheel mass $M$", unit: "kg", min: 0.5, max: 10, step: 0.5, value: 4, onInput: changed });
    var RS = K.slider({ label: "Wheel radius $R$", unit: "m", min: 0.1, max: 0.5, step: 0.05, value: 0.4, onInput: function (v) { if (rS.get() > v) rS.set(v); if (dS.get() > v) dS.set(v); changed(); } });
    var rS = K.slider({ label: "Spool radius $r$ (string)", unit: "m", min: 0.05, max: 0.5, step: 0.05, value: 0.2, onInput: function (v) { if (v > RS.get()) rS.set(RS.get()); changed(); } });
    var mS = K.slider({ label: "Hanging mass $m$", unit: "kg", min: 0.1, max: 5, step: 0.1, value: 0.5, onInput: changed });
    var cS = K.slider({ label: "Each collar's mass $m_c$", unit: "kg", min: 0, max: 2, step: 0.1, value: 1, onInput: changed });
    var dS = K.slider({ label: "Collar distance $d$", unit: "m", min: 0.05, max: 0.5, step: 0.05, value: 0.15, onInput: function (v) { if (v > RS.get()) dS.set(RS.get()); changed(); },
      hint: "Or drag a collar along the rod." });
    var MpS = K.slider({ label: "Platform mass $M_p$ (disc, radius 1 m)", unit: "kg", min: 0, max: 10, step: 0.5, value: 2, onInput: changed });
    var pmS = K.slider({ label: "Each sliding mass $m$", unit: "kg", min: 0.5, max: 5, step: 0.5, value: 1, onInput: changed });
    var r1S = K.slider({ label: "Start radius $r_1$", unit: "m", min: 0.1, max: 1, step: 0.05, value: 0.8, onInput: changed });
    var r2S = K.slider({ label: "Pulled-in radius $r_2$", unit: "m", min: 0.1, max: 1, step: 0.05, value: 0.2, onInput: changed,
      hint: "The masses move from $r_1$ to $r_2$ after 1 s. Drag one while it spins to move them yourself." });
    var w0S = K.slider({ label: "Starting spin $\\omega_0$", unit: "rad/s", min: 0.5, max: 5, step: 0.5, value: 2, onInput: changed });

    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Falling mass", value: "wheel" }, { label: "Spinning platform", value: "spin" }], mode, function (v) { mode = v; layout(); changed(); }, "Mode");
    P.controls.appendChild(modeSeg);
    var wheelBox = K.h("<div><h3>The wheel</h3></div>"), spinBox = K.h("<div><h3>The platform</h3></div>"), rodBox = K.h("<div></div>");
    var shapeSeg = K.seg(Object.keys(SHAPES).map(function (k) { return { label: SHAPES[k], value: k }; }), shape, function (v) { shape = v; layout(); changed(); }, "Shape");
    wheelBox.appendChild(shapeSeg);
    [MS, RS, rS, mS].forEach(function (s) { wheelBox.appendChild(s.el); });
    [cS, dS].forEach(function (s) { rodBox.appendChild(s.el); });
    wheelBox.appendChild(rodBox);
    [MpS, pmS, r1S, r2S, w0S].forEach(function (s) { spinBox.appendChild(s.el); });
    P.controls.appendChild(wheelBox); P.controls.appendChild(spinBox);
    var legend = K.h('<div class="legend"></div>');
    P.controls.appendChild(legend);
    function layout() {
      wheelBox.hidden = mode !== "wheel"; spinBox.hidden = mode !== "spin"; rodBox.hidden = shape !== "rod";
      legend.innerHTML = mode === "wheel"
        ? '<span class="c-grav"><i></i>weight</span><span class="c-ten"><i></i>tension</span><span class="c-vel"><i></i>½mv²</span><span class="c-acc"><i></i>½Iω²</span>'
        : '<span class="c-vel"><i></i>ω</span><span class="c-app"><i></i>L = Iω</span><span class="c-acc"><i></i>kinetic energy</span>';
      if (gw) captions();
    }

    function params() {
      return { shape: shape, M: MS.get(), R: RS.get(), r: Math.min(rS.get(), RS.get()), m: mS.get(), mc: cS.get(), d: Math.min(dS.get(), RS.get()),
        Mp: MpS.get(), pm: pmS.get(), r1: r1S.get(), r2: r2S.get(), w0: w0S.get() };
    }
    function inertiaOf(p) {
      if (p.shape === "ring") return p.M * p.R * p.R;
      if (p.shape === "disc") return 0.5 * p.M * p.R * p.R;
      return p.M * p.R * p.R / 3 + 2 * (0.5 * p.mc * COLLAR * COLLAR + p.mc * p.d * p.d);   // rod of length 2R, plus parallel-axis collars
    }
    function solveWheel(p) {
      var I = inertiaOf(p), a = G * p.m / (p.m + I / (p.r * p.r));
      return { I: I, a: a, alpha: a / p.r, T: p.m * (G - a), tEnd: Math.sqrt(2 * DROP / a) };
    }
    function Ip(p, r) { return 0.5 * p.Mp * RP * RP + 2 * p.pm * r * r; }

    /* ---------- the models ---------- */
    var st, rec, runs = [];
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render(); playLabel();
      var p = params();
      if (mode === "wheel") st = { p: p, s: solveWheel(p), y: 0, v: 0, phi: 0, aMeas: null, done: false };
      else {
        var I1 = Ip(p, p.r1);
        st = { p: p, r: p.r1, w: p.w0, phi: 0, L0: I1 * p.w0, KE0: 0.5 * I1 * p.w0 * p.w0, manual: null, wMax: p.w0, done: false };
      }
      rec = { t: [0], a: [0], b: [0], c: [0], d: [0] };
      if (mode === "spin") { rec.a[0] = st.w; rec.b[0] = st.L0; rec.c[0] = st.KE0; rec.d[0] = p.r1; }
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }
    function changed() { reset(); }

    // where the platform masses are meant to be: r1 for 1 s, then a smooth slide to r2 over 1.5 s
    function rAuto(p, t) {
      if (t <= 1) return p.r1;
      var u = Math.min(1, (t - 1) / 1.5);
      return p.r1 + (p.r2 - p.r1) * u * u * (3 - 2 * u);
    }

    sim.on("before", function () {
      if (st.done) return;
      if (mode === "wheel") {
        // (m + I/r^2) a = m g, stepped exactly: constant a, so the motion is s = at^2/2
        var a = st.s.a, vPrev = st.v;
        st.y += st.v * K.DT + 0.5 * a * K.DT * K.DT; st.v += a * K.DT;
        st.phi = st.y / st.p.r;                                    // the string unwinds without slipping
        st.aMeas = (st.v - vPrev) / K.DT;
      } else {
        // no outside torque: I dω/dt = -(dI/dt) ω, integrated with RK4 along the path r(t)
        var p = st.p, rA = st.r, rB = st.manual !== null ? st.manual : rAuto(p, sim.time + K.DT), n = 20, h = K.DT / n, rdot = (rB - rA) / K.DT;
        var f = function (tau, w) { var r = rA + rdot * tau; return -4 * p.pm * r * rdot * w / Ip(p, r); };
        for (var k = 0; k < n; k++) {
          var t0 = k * h, w0 = st.w;
          var k1 = f(t0, w0), k2 = f(t0 + h / 2, w0 + h / 2 * k1), k3 = f(t0 + h / 2, w0 + h / 2 * k2), k4 = f(t0 + h, w0 + h * k3);
          st.w += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
          st.phi += st.w * h;
        }
        st.r = rB;
        st.wMax = Math.max(st.wMax, st.w);
      }
    });

    sim.on("step", function (t) {
      var p = st.p;
      if (mode === "wheel") {
        var I = st.s.I, w = st.v / p.r;
        rec.t.push(t); rec.a.push(w); rec.b.push(p.m * G * st.y); rec.c.push(0.5 * p.m * st.v * st.v); rec.d.push(0.5 * I * w * w);
        if (st.y >= DROP - 1e-9) finishWheel();
      } else {
        var Inow = Ip(p, st.r);
        rec.t.push(t); rec.a.push(st.w); rec.b.push(Inow * st.w); rec.c.push(0.5 * Inow * st.w * st.w); rec.d.push(st.r);
        if (st.wMax >= 2 * p.w0 - 1e-9 && Math.abs(Inow * st.w - st.L0) < 1e-3 * st.L0) tries.mark("skater");
        if (t >= 6 - 1e-9) { st.done = true; sim.pause(); transportUI.render(); K.flash(P.note, "ω went from " + K.fmt(p.w0, 2) + " to " + K.fmt(st.w, 2) + " rad/s; L stayed " + K.fmt(st.L0, 2)); }
      }
      update(st.done);
    });

    function finishWheel() {
      var p = st.p, s = st.s;
      st.done = true; sim.pause(); transportUI.render();
      var run = { shape: p.shape, M: p.M, R: p.R, r: p.r, m: p.m, mc: p.mc, d: p.d, a: st.aMeas, t: sim.time };
      K.flash(P.note, "Fell " + DROP + " m in " + K.fmt(sim.time, 2) + " s: a = " + K.fmt(st.aMeas, 3) + " m/s², T = " + K.fmt(p.m * (G - st.aMeas), 2) + " N");
      runs.forEach(function (q) {
        var same = q.M === run.M && q.R === run.R && q.r === run.r && q.m === run.m;
        if (same && ((q.shape === "ring" && run.shape === "disc") || (q.shape === "disc" && run.shape === "ring"))) tries.mark("shape");
        if (same && q.shape === "rod" && run.shape === "rod" && q.mc === run.mc && q.mc > 0 && run.d > q.d && run.a < q.a) tries.mark("collars");
      });
      if (st.aMeas >= 0.9 * G) tries.mark("light");
      runs.push(run); if (runs.length > 60) runs.shift();
      void s;
    }

    /* ---------- direct manipulation: drag collars, or drag the platform masses ---------- */
    var dragging = false;
    sim.pointer({
      down: function (pt) {
        if (mode === "wheel") {
          if (shape !== "rod") return false;
          var p = params(), ca = Math.cos(st.phi), sa = Math.sin(st.phi), hit = false;
          [-1, 1].forEach(function (sg) { var cx = AX.x + sg * p.d * ca, cy = AX.y - sg * p.d * sa; if (Math.hypot(pt.m.x - cx, pt.m.y - cy) < 0.12) hit = true; });
          if (!hit) return false;
          if (st.y > 0) reset();
        } else {
          var q = st.p, hitS = false;
          [0, Math.PI].forEach(function (o) { var x = SP.x + st.r * Math.cos(st.phi + o), y = SP.y + st.r * Math.sin(st.phi + o); if (Math.hypot(pt.m.x - x, pt.m.y - y) < 0.18) hitS = true; });
          if (!hitS) return false;
          void q;
        }
        dragging = true; P.canvas.style.cursor = "grabbing";
        return true;
      },
      drag: function (pt) {
        if (mode === "wheel") {
          var ca = Math.cos(st.phi), sa = Math.sin(st.phi), along = Math.abs((pt.m.x - AX.x) * ca - (pt.m.y - AX.y) * sa);
          dS.set(K.clamp(Math.round(along * 20) / 20, 0.05, RS.get())); reset();
        } else {
          var r = K.clamp(Math.round(Math.hypot(pt.m.x - SP.x, pt.m.y - SP.y) * 20) / 20, 0.1, 1);
          if (sim.running) st.manual = r; else if (sim.steps === 0) { r1S.set(r); reset(); } else st.manual = r;
        }
      },
      up: function () { dragging = false; P.canvas.style.cursor = ""; }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      if (mode === "wheel") drawWheel(ctx); else drawPlatform(ctx);
    });
    function drawWheel(ctx) {
      sim.drawGround(ctx);
      var p = st.p, c = sim.px(AX.x, AX.y), R = p.R * ppm, r = p.r * ppm;
      // bracket
      ctx.fillStyle = th["ground-top"]; ctx.fillRect(c.x - sim.u(70), sim.px(0, 3.62).y, sim.u(140), sim.u(10));
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(3);
      ctx.beginPath(); ctx.moveTo(c.x, sim.px(0, 3.62).y); ctx.lineTo(c.x, c.y); ctx.stroke();
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(st.phi);        // canvas +angle is clockwise on screen
      ctx.lineWidth = sim.u(2); ctx.strokeStyle = th.ink;
      if (p.shape === "ring") {
        ctx.strokeStyle = th.body; ctx.lineWidth = Math.max(sim.u(6), 0.05 * ppm);
        ctx.beginPath(); ctx.arc(0, 0, R - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1.5);
        for (var k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * Math.cos(k * Math.PI / 2), R * Math.sin(k * Math.PI / 2)); ctx.stroke(); }
      } else if (p.shape === "disc") {
        ctx.fillStyle = th.body; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = th.surface; ctx.fillRect(r, -sim.u(3), R - r - sim.u(4), sim.u(6));
      } else {
        var hw = 0.03 * ppm;
        ctx.fillStyle = th.body; ctx.fillRect(-R, -hw, 2 * R, 2 * hw); ctx.strokeRect(-R, -hw, 2 * R, 2 * hw);
        if (p.mc > 0) [-1, 1].forEach(function (sg) {
          var cs = 0.1 * ppm;
          ctx.fillStyle = dragging ? th.surface : th["surface-2"]; ctx.fillRect(sg * p.d * ppm - cs / 2, -cs / 2, cs, cs); ctx.strokeRect(sg * p.d * ppm - cs / 2, -cs / 2, cs, cs);
        });
      }
      ctx.fillStyle = th.bank; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = th.ink; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(c.x, c.y, sim.u(4), 0, Math.PI * 2); ctx.fill();
      // string and the hanging mass
      var by = 2.2 - st.y, top = sim.px(AX.x + p.r, by + BOX / 2), b0 = sim.px(AX.x + p.r - BOX / 2, by + BOX / 2);
      ctx.strokeStyle = th.ten; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(c.x + r, c.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink;
      ctx.fillRect(b0.x, b0.y, BOX * ppm, BOX * ppm); ctx.strokeRect(b0.x, b0.y, BOX * ppm, BOX * ppm);
      K.label(ctx, p.m + " kg", top.x + BOX * ppm / 2 + sim.u(6), top.y + BOX * ppm + sim.u(14), th.ink, { s: sim.u(0.9), align: "left" });
      // floor mark for the drop
      var fl = sim.px(AX.x + p.r, 0.2 - BOX / 2);
      ctx.strokeStyle = th.muted; ctx.setLineDash([sim.u(4), sim.u(4)]); ctx.lineWidth = sim.u(1);
      ctx.beginPath(); ctx.moveTo(fl.x - sim.u(60), fl.y); ctx.lineTo(fl.x + sim.u(60), fl.y); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "falls " + DROP + " m", fl.x + sim.u(64), fl.y + sim.u(6), th.muted, { s: sim.u(0.85), align: "left" });
      K.label(ctx, SHAPES[p.shape] + " · I = " + K.fmt(st.s.I, 3) + " kg·m²", c.x - R - sim.u(14), c.y + sim.u(6), th.ink, { s: sim.u(1), align: "right", bg: true });
    }
    function drawPlatform(ctx) {
      var p = st.p, c = sim.px(SP.x, SP.y), Rp = RP * ppm;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-st.phi);   // world angle is anticlockwise
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.globalAlpha = p.Mp > 0 ? 1 : 0.35;
      ctx.beginPath(); ctx.arc(0, 0, Rp, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(4);
      ctx.beginPath(); ctx.moveTo(-Rp + sim.u(6), 0); ctx.lineTo(Rp - sim.u(6), 0); ctx.stroke();       // the rail
      ctx.lineWidth = sim.u(1.5);
      ctx.beginPath(); ctx.moveTo(0, -Rp); ctx.lineTo(0, -Rp * 0.6); ctx.stroke();                        // a mark to see the spin
      [1, -1].forEach(function (sg) {
        var x = sg * st.r * ppm, rad = (0.06 + 0.012 * p.pm) * ppm;
        ctx.fillStyle = th.body; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
        ctx.beginPath(); ctx.arc(x, 0, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.restore();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(c.x, c.y, sim.u(4), 0, Math.PI * 2); ctx.fill();
      // spin arrow sized by ω
      var arc = Math.min(Math.PI * 1.6, 0.25 * st.w), rr = Rp + sim.u(18);
      if (arc > 0.05) {
        ctx.save(); ctx.strokeStyle = th.vel; ctx.lineWidth = sim.u(3);
        ctx.beginPath(); ctx.arc(c.x, c.y, rr, -Math.PI / 2, -Math.PI / 2 - arc, true); ctx.stroke(); ctx.restore();
        var a1 = -Math.PI / 2 - arc, ex = c.x + rr * Math.cos(a1), ey = c.y + rr * Math.sin(a1), tx = Math.sin(a1), ty = -Math.cos(a1);
        K.arrow(ctx, ex - tx * sim.u(10), ey - ty * sim.u(10), ex + tx * sim.u(4), ey + ty * sim.u(4), th.vel, { s: sim.u(1), width: 3, head: 11 });
      }
      K.label(ctx, "ω " + K.fmt(st.w, 2) + " rad/s", c.x, c.y - rr - sim.u(8), th.vel, { s: sim.u(1), bg: true });
      K.label(ctx, "top view · r = " + K.fmt(st.r, 2) + " m", c.x + Rp + sim.u(40), c.y + sim.u(6), th.ink, { s: sim.u(1), align: "left", bg: true });
      K.label(ctx, "I = " + K.fmt(Ip(p, st.r), 3) + " kg·m²", c.x + Rp + sim.u(40), c.y + sim.u(30), th.ink, { s: sim.u(1), align: "left", bg: true });
      K.label(ctx, "L = Iω = " + K.fmt(Ip(p, st.r) * st.w, 3), c.x + Rp + sim.u(40), c.y + sim.u(54), th.app, { s: sim.u(1), align: "left", bg: true });
    }
    sim.on("over", function (ctx) {
      if (mode !== "wheel") return;
      var p = st.p, s = st.s, c = sim.px(AX.x, AX.y), kpn = 2, by = 2.2 - st.y;
      var mc = sim.px(AX.x + p.r, by), topY = sim.px(0, by + BOX / 2).y;
      sim.force(ctx, mc.x, mc.y, 0, -p.m * G, th.grav, "mg " + K.fmt(p.m * G, 2) + " N", kpn, { lx: 6, ly: 10 });
      sim.force(ctx, mc.x, topY, 0, s.T, th.ten, "T " + K.fmt(s.T, 2) + " N", kpn, { lx: 6 });
      sim.force(ctx, c.x + p.r * ppm, c.y, 0, -s.T, th.ten, "T on wheel", kpn, { lx: 6, ly: 10 });
      if (st.v > 0.02) K.arrow(ctx, mc.x - sim.u(44), mc.y, mc.x - sim.u(44), mc.y + st.v * sim.u(30), th.vel, { s: sim.u(1), label: "v " + K.fmt(st.v, 2), lx: -60 });
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML = [0, 1, 2].map(function () { return '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>'; }).join("");
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".graph-cap");
    var gw = new K.Graph(cv[0], { yLabel: "ω (rad/s)", xMax: 1, xAuto: true, yMin: 0, color: th.vel });
    var g2 = new K.Graph(cv[1], { yLabel: "a (m/s²)", xLabel: "m (kg)", xMax: 5, yMin: 0, color: th.acc });
    var g3 = new K.Graph(cv[2], { yLabel: "E (J)", xMax: 1, xAuto: true, yMin: 0, color: th.acc });
    function captions() {
      var c = mode === "wheel" ? [
        '<b class="c-vel">ω–t</b> · a straight line: constant torque, constant α',
        '<b class="c-acc">a vs hanging mass</b> · $g\\,m/(m + I/r^2)$ for your wheel; dots are your runs',
        '<b class="c-grav">energy</b> · $mgh$ lost (dashed) shared between <b class="c-vel">½mv²</b> and <b class="c-acc">½Iω²</b>'
      ] : [
        '<b class="c-vel">ω–t</b> · jumps as the masses come in; dashed is $L_0/I$',
        '<b class="c-app">L–t</b> · flat: no outside torque, so $I\\omega$ never changes',
        '<b class="c-acc">kinetic energy</b> · rises as $I$ falls: $L^2/2I$ (dashed)'
      ];
      caps.forEach(function (el, i) { el.innerHTML = K.md(c[i]); });
      gw.o.yLabel = "ω (rad/s)";
      g2.o.yLabel = mode === "wheel" ? "a (m/s²)" : "L (kg·m²/s)"; g2.o.xLabel = mode === "wheel" ? "m (kg)" : "t (s)"; g2.o.xAuto = mode !== "wheel"; g2.o.xMax = mode === "wheel" ? 5 : 1;
      g2.o.color = mode === "wheel" ? th.acc : th.app;
      g3.o.yLabel = "E (J)";
    }

    function theory() {
      var p = params();
      [gw, g2, g3].forEach(function (g) { g.clear(); });
      if (mode === "wheel") {
        var pts = [];
        for (var m = 0.1; m <= 5 + 1e-9; m += 0.05) { var q = Object.assign({}, p, { m: m }); pts.push([m, solveWheel(q).a]); }
        g2.set("theory", { points: pts, color: th.acc, dash: [5, 5], width: 1.5 });
      }
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = st.p, pts = function (arr) { return rec.t.map(function (t, i) { return [t, arr[i]]; }); };
      if (mode === "wheel") {
        var s = st.s, tEnd = rec.t[rec.t.length - 1];
        gw.set("theory", { points: [[0, 0], [tEnd, s.alpha * tEnd]], color: th.vel, dash: [5, 5], width: 1.5 });
        gw.set("sim", { points: pts(rec.a), color: th.vel, width: 2.5, dot: true });
        var mine = runs.filter(function (r) { return r.shape === p.shape && r.M === p.M && r.R === p.R && r.r === p.r && (p.shape !== "rod" || (r.mc === p.mc && r.d === p.d)); });
        g2.extra = function (ctx, X, Y) {
          ctx.fillStyle = th.acc; mine.forEach(function (r) { ctx.beginPath(); ctx.arc(X(r.m), Y(r.a), 4.5, 0, Math.PI * 2); ctx.fill(); });
          ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(p.m), Y(s.a), 6, 0, Math.PI * 2); ctx.stroke();
        };
        g3.set("total", { points: pts(rec.b), color: th.grav, dash: [5, 5], width: 1.5 });
        g3.set("trans", { points: pts(rec.c), color: th.vel, width: 2.5, dot: true });
        g3.set("rot", { points: pts(rec.d), color: th.acc, width: 2.5, dot: true });
      } else {
        g2.extra = null;
        gw.set("theory", { points: rec.t.map(function (t, i) { return [t, st.L0 / Ip(p, rec.d[i])]; }), color: th.vel, dash: [5, 5], width: 1.5 });
        gw.set("sim", { points: pts(rec.a), color: th.vel, width: 2.5, dot: true });
        g2.set("theory", { points: [[0, st.L0], [Math.max(1, rec.t[rec.t.length - 1]), st.L0]], color: th.app, dash: [5, 5], width: 1.5 });
        g2.set("sim", { points: pts(rec.b), color: th.app, width: 2.5, dot: true });
        g3.set("theory", { points: rec.t.map(function (t, i) { return [t, st.L0 * st.L0 / (2 * Ip(p, rec.d[i]))]; }), color: th.acc, dash: [5, 5], width: 1.5 });
        g3.set("sim", { points: pts(rec.c), color: th.acc, width: 2.5, dot: true });
      }
      [gw, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqLabels = P.eqs.querySelectorAll(".eq-label"), eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "I", label: "moment of inertia" }, { id: "x1", label: "", cls: "c-acc" }, { id: "x2", label: "", cls: "c-ten" },
      { id: "x3", label: "", cls: "c-vel" }, { id: "x4", label: "", cls: "c-acc" }, { id: "x5", label: "" }
    ]);
    var roLabels = P.readouts.querySelectorAll(".readout > span");
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 2 : d) + ")"; }
    function renderMaths() {
      var p = st.p;
      if (mode === "wheel") {
        var s = st.s, w = st.v / p.r, Itex;
        if (p.shape === "ring") Itex = "I = MR^2 = " + B(p.M, 1) + B(p.R) + "^2";
        else if (p.shape === "disc") Itex = "I = \\tfrac12 MR^2 = \\tfrac12" + B(p.M, 1) + B(p.R) + "^2";
        else Itex = "I = \\tfrac13 MR^2 + 2\\left(\\tfrac12 m_c a^2 + m_c d^2\\right) = \\tfrac13" + B(p.M, 1) + B(p.R) + "^2 + 2\\left(\\tfrac12" + B(p.mc, 1) + B(COLLAR) + "^2 + " + B(p.mc, 1) + B(p.d) + "^2\\right)";
        ["Moment of inertia of your wheel" + (p.shape === "rod" ? " (rod of length 2R; collars by the parallel-axis theorem)" : ""),
          "Newton's 2nd law for the mass, τ = Iα for the wheel, and the string links them", "Solve for the acceleration", "Tension, and where the energy goes"].forEach(function (l, i) { eqLabels[i].textContent = l; });
        K.tex(eqEls[0], Itex + " = \\mathbf{" + K.fmt(s.I, 4) + "}\\ \\text{kg·m}^2");
        K.tex(eqEls[1], "mg - T = ma,\\quad Tr = I\\alpha,\\quad a = \\alpha r");
        K.tex(eqEls[2], "a = \\frac{g\\,m}{m + I/r^2} = \\frac{(9.8)" + B(p.m, 1) + "}{" + K.fmt(p.m, 1) + " + " + K.fmt(s.I / (p.r * p.r), 3) + "} = \\mathbf{" + K.fmt(s.a, 3) + "}\\ \\text{m/s}^2,\\quad \\alpha = \\frac ar = \\mathbf{" + K.fmt(s.alpha, 2) + "}\\ \\text{rad/s}^2");
        K.tex(eqEls[3], "T = m(g - a) = \\mathbf{" + K.fmt(s.T, 2) + "}\\ \\text{N};\\quad mgh = \\tfrac12 mv^2 + \\tfrac12 I\\omega^2:\\ " +
          K.fmt(p.m * G * st.y, 2) + " = " + K.fmt(0.5 * p.m * st.v * st.v, 2) + " + " + K.fmt(0.5 * s.I * w * w, 2) + "\\ \\text{J}");
        ["moment of inertia", "acceleration", "tension", "ω now", "rotational share of KE", "fall time for 2 m"].forEach(function (l, i) { roLabels[i].textContent = l; });
        var meas = st.aMeas !== null;
        setR("I", K.fmt(s.I, 4) + " kg·m²", SHAPES[p.shape]);
        setR("x1", K.fmt(meas ? st.aMeas : s.a, 3) + " m/s²", meas ? "measured · formula " + K.fmt(s.a, 3) : "formula");
        setR("x2", K.fmt(meas ? p.m * (G - st.aMeas) : s.T, 2) + " N", meas ? "from m(g − a) · formula " + K.fmt(s.T, 2) : "formula · mg = " + K.fmt(p.m * G, 2));
        setR("x3", K.fmt(w, 2) + " rad/s", "v = " + K.fmt(st.v, 2) + " m/s");
        setR("x4", K.fmt(100 * (s.I / (p.r * p.r)) / (p.m + s.I / (p.r * p.r)), 1) + " %", "(I/r²) / (m + I/r²)");
        setR("x5", K.fmt(st.done ? sim.time : s.tEnd, 2) + " s", st.done ? "measured · formula " + K.fmt(s.tEnd, 2) : "formula √(2h/a)");
      } else {
        var I = Ip(p, st.r), wF = st.L0 / I, KE = 0.5 * I * st.w * st.w;
        ["Moment of inertia: platform plus the two masses", "No outside torque, so L is fixed at its starting value", "So the spin follows I", "Kinetic energy is not conserved"].forEach(function (l, i) { eqLabels[i].textContent = l; });
        K.tex(eqEls[0], "I = \\tfrac12 M_pR_p^2 + 2mr^2 = \\tfrac12" + B(p.Mp, 1) + "(1)^2 + 2" + B(p.pm, 1) + B(st.r) + "^2 = \\mathbf{" + K.fmt(I, 3) + "}\\ \\text{kg·m}^2");
        K.tex(eqEls[1], "L = I_1\\omega_0 = " + K.fmt(Ip(p, p.r1), 3) + " \\times " + K.fmt(p.w0, 1) + " = \\mathbf{" + K.fmt(st.L0, 3) + "}\\ \\text{kg·m}^2/\\text{s}");
        K.tex(eqEls[2], "\\omega = \\frac{L}{I} = \\frac{" + K.fmt(st.L0, 3) + "}{" + K.fmt(I, 3) + "} = \\mathbf{" + K.fmt(wF, 3) + "}\\ \\text{rad/s}");
        K.tex(eqEls[3], "KE = \\frac{L^2}{2I} = \\mathbf{" + K.fmt(st.L0 * st.L0 / (2 * I), 3) + "}\\ \\text{J},\\quad W_{pull} = \\Delta KE = \\mathbf{" + K.fmt(st.L0 * st.L0 / (2 * I) - st.KE0, 3) + "}\\ \\text{J}");
        ["moment of inertia", "ω", "angular momentum", "radius r", "kinetic energy", "work done pulling"].forEach(function (l, i) { roLabels[i].textContent = l; });
        setR("I", K.fmt(I, 3) + " kg·m²");
        setR("x1", K.fmt(st.w, 3) + " rad/s", "simulated · L/I = " + K.fmt(wF, 3));
        setR("x2", K.fmt(I * st.w, 3) + " kg·m²/s", "simulated · start " + K.fmt(st.L0, 3));
        setR("x3", K.fmt(st.r, 2) + " m", st.manual !== null ? "you're holding them" : "");
        setR("x4", K.fmt(KE, 3) + " J", "start " + K.fmt(st.KE0, 3));
        setR("x5", K.fmt(KE - st.KE0, 3) + " J", "ΔKE");
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Mass resists being accelerated; <b>moment of inertia</b> resists being spun up. $I = \\Sigma m r^2$ adds every bit of mass times its distance from the axis <i>squared</i>, so where the mass sits matters more than how much there is: ring $MR^2$, disc $\\tfrac12 MR^2$, rod about its middle $\\tfrac1{12}ML^2$.</p>" +
      "<p>The rotational second law is $\\tau = I\\alpha$. With a string wound on a spool, the falling mass and the wheel share one string: $mg - T = ma$, $Tr = I\\alpha$, $a = \\alpha r$. Solve and the wheel behaves like an extra mass $I/r^2$ riding on the string.</p>" +
      "<p>Move the axis a distance $d$ from the centre of mass and $I = I_{cm} + Md^2$: the <b>parallel-axis theorem</b>. With no outside torque, <b class=\"c-app\">$L = I\\omega$</b> is conserved, so shrinking $I$ spins you up.</p>" +
      '<div class="trap"><b>JEE trap: angular momentum is conserved, kinetic energy is not.</b> When the masses are pulled in, $\\omega$ rises by $I_1/I_2$ but $KE = L^2/2I$ rises too, by the same factor. Whoever pulls does positive work. Writing $\\tfrac12 I_1\\omega_1^2 = \\tfrac12 I_2\\omega_2^2$ is wrong.</div>');
    function apply(s) {
      mode = s.mode;
      modeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === mode)); });
      if (s.shape) { shape = s.shape; shapeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === shape)); }); }
      if (s.R != null) { RS.set(s.R); MS.set(s.M); rS.set(s.r); mS.set(s.m); }
      if (s.mc != null) { cS.set(s.mc); dS.set(s.d); }
      if (s.Mp != null) { MpS.set(s.Mp); pmS.set(s.pm); r1S.set(s.r1); r2S.set(s.r2); w0S.set(s.w0); }
      layout(); reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "I of a disc", setup: { mode: "wheel", shape: "disc", M: 4, R: 0.4, r: 0.2, m: 0.5 }, watch: "Read I off the readouts, then press Release",
        q: "The wheel is a uniform solid disc of mass 4 kg and radius 0.4 m. What is its moment of inertia about the axle?",
        options: ["0.32 kg·m²", "0.64 kg·m²", "0.16 kg·m²", "0.80 kg·m²"], answer: 0,
        explain: "For a disc about its axis $I = \\tfrac12 MR^2 = \\tfrac12 (4)(0.4)^2 = 0.32$ kg·m². 0.64 is a ring ($MR^2$); 0.80 forgets to square the radius." },
      { level: "medium", tag: "string on a spool", setup: { mode: "wheel", shape: "ring", M: 2, R: 0.5, r: 0.25, m: 1 }, watch: "Predict a and T, then press Release",
        q: "A ring (2 kg, radius 0.5 m) turns freely on an axle. A string wound on a light spool of radius 0.25 m fixed to it carries a 1 kg mass. What are the mass's acceleration and the tension ($g = 9.8$)?",
        options: ["1.09 m/s², 8.71 N", "3.27 m/s², 6.53 N", "1.96 m/s², 7.84 N", "9.8 m/s², 0 N"], answer: 0,
        hints: ["Three equations: $mg - T = ma$, $Tr = I\\alpha$, and $a = \\alpha r$ with $r$ the spool's radius.", "Eliminate $T$ and $\\alpha$: $a = \\dfrac{g\\,m}{m + I/r^2}$, with $I = MR^2 = 0.5$ kg·m²."],
        explain: "$I/r^2 = 0.5/0.0625 = 8$ kg, so $a = \\dfrac{9.8 \\times 1}{1 + 8} = 1.09$ m/s² and $T = m(g - a) = 8.71$ N. 3.27 m/s² uses the rim radius instead of the spool's; 1.96 m/s² treats the ring as a disc." },
      { level: "hard", tag: "pulling the masses in", setup: { mode: "spin", Mp: 4, pm: 1, r1: 0.8, r2: 0.2, w0: 2 }, watch: "Press Spin and watch ω, L and KE as the masses slide in",
        q: "A horizontal platform (a uniform 4 kg disc of radius 1 m) spins freely at 2 rad/s with two 1 kg masses on it, each 0.8 m from the axis. The masses are pulled in to 0.2 m. What is the final angular speed, and how much work was done pulling them in?",
        options: ["3.15 rad/s, 3.78 J", "2.51 rad/s, 0 J", "3.15 rad/s, 0 J", "32 rad/s, 38.4 J"], answer: 0,
        hints: ["$I = \\tfrac12 M_pR_p^2 + 2mr^2$: 3.28 kg·m² before, 2.08 kg·m² after. No outside torque, so $I_1\\omega_1 = I_2\\omega_2$.", "The work done is the change in kinetic energy, $\\tfrac12 I_2\\omega_2^2 - \\tfrac12 I_1\\omega_1^2$."],
        explain: "$\\omega_2 = \\dfrac{3.28 \\times 2}{2.08} = 3.15$ rad/s. KE goes from $\\tfrac12(3.28)(2)^2 = 6.56$ J to $\\dfrac{(6.56)^2}{2 \\times 2.08} = 10.34$ J, so the pull does 3.78 J of work. 2.51 rad/s comes from wrongly conserving KE; 32 rad/s forgets the platform." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    function playLabel() { if (transportUI && !sim.running) P.playBtn.lastChild.textContent = mode === "wheel" ? "Release" : "Spin"; }
    [P.playBtn, P.resetBtn].forEach(function (b) { b.addEventListener("click", function () { setTimeout(playLabel, 0); }); });
    sim.on("step", function () { if (st.done) playLabel(); });
    layout(); reset();
    if (location.hostname === "localhost") window.__lab_inertia = { apply: apply, state: function () { return st; }, params: params, solveWheel: solveWheel, Ip: Ip };

    return function destroy() { sim.destroy(); [gw, g2, g3].forEach(function (g) { g.destroy(); }); };
  }
})();
