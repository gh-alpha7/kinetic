/* Work, energy & power, lab 1: push a block along a floor with a force you choose. The work is the area under F–x,
   and it always adds up to the change in kinetic energy. The block's motion is integrated exactly (small sub-steps,
   with the force jumps and the stops found as events), so the theorem check is a real check. */
(function () {
  "use strict";
  var G = 9.8, SIZE = 1, XMAX = 10, L0 = 3.5, WALL = -4, NSUB = 50;
  var PROFILES = {
    hump: [0, 15, 30, 30, 15, 0],
    ramp: [0, 6, 12, 18, 24, 30],
    brake: [30, 30, 10, -10, -20, -20]
  };

  var lab = {
    id: "workenergy", chapter: "work", title: "Work & the work–energy theorem", short: "area under F–x, W = ΔKE, P = Fv",
    lede: "Push a block with a steady force, a spring or a force you draw yourself. Add up every force's work, area by area, and you get the change in kinetic energy. Every time.",
    tries: [
      { id: "theorem", title: "Check the theorem with friction on",
        text: "Run any push on a rough floor and compare the kinetic energy with $K_0 + W_F + W_f$.",
        why: "The work–energy theorem uses the <i>net</i> work: your force's work plus friction's (negative) work. Their sum is $\\Delta K$ to the last decimal, because it's just Newton's second law added up along the path." },
      { id: "stop", title: "Push, let go, and let friction stop it",
        text: "With a steady force and friction, wait until the block stops after the push ends.",
        why: "It starts and ends at rest, so $\\Delta K = 0$ and $W_F + W_f = 0$: every joule you put in, $Fd$, comes out as friction's $\\mu_k mg s$. So it slides a total $s = Fd/\\mu_k mg$." },
      { id: "negative", title: "Make a force do negative work",
        text: "Get the applied force pointing against the motion while the block moves (a spring past its natural length, or a profile that brakes).",
        why: "$W = \\int F\\,dx$ is negative when $F$ and $dx$ point opposite ways. The power $P = Fv$ goes negative, and the block slows down: the force is taking kinetic energy out." },
      { id: "spring", title: "Fire the spring on a smooth floor",
        text: "Stretch or squash the spring with $\\mu_k = 0$ and let go. Read the speed as the block passes $x = 0$.",
        why: "From $x_0$ to $0$ the spring does $\\tfrac12 k x_0^2$ of work, so $v_{max} = |x_0|\\sqrt{k/m}$ at the natural length, where the spring force (and the acceleration) is zero." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 300, ppm = 55, origin = { x: 330, y: 230 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 1, gridMajor: 5, yLabels: false });
    sim.zoom = 1; sim.panX = 0;

    /* ---------- controls ---------- */
    var mode = "const", profName = "hump", prof = PROFILES.hump.slice();
    var mS = K.slider({ label: "Mass $m$", unit: "kg", min: 1, max: 10, step: 0.5, value: 2, onInput: reset });
    var uS = K.slider({ label: "Starting speed $u$", unit: "m/s", min: 0, max: 6, step: 0.5, value: 0, onInput: reset });
    var muS = K.slider({ label: "Kinetic friction $\\mu_k$", min: 0, max: 0.8, step: 0.05, value: 0.2, onInput: reset,
      hint: "0 is a perfectly smooth floor. Static friction is taken as the same $\\mu$." });
    var fS = K.slider({ label: "Force $F$", unit: "N", min: -20, max: 60, step: 1, value: 20, onInput: reset });
    var dS = K.slider({ label: "Push distance $d$", unit: "m", min: 0.5, max: 10, step: 0.5, value: 4, onInput: reset,
      hint: "Or drag the flag on the floor." });
    var kS = K.slider({ label: "Spring constant $k$", unit: "N/m", min: 10, max: 200, step: 5, value: 50, onInput: reset });
    var x0S = K.slider({ label: "Start stretch $x_0$", unit: "m", min: -3, max: 3, step: 0.1, value: 2, onInput: reset,
      hint: "Negative means squashed. Or drag the block." });
    P.controls.innerHTML = "<h3>The force</h3>";
    var modeSeg = K.seg([{ label: "Constant F", value: "const" }, { label: "Spring −kx", value: "spring" }, { label: "Your own F(x)", value: "custom" }], "const",
      function (v) { mode = v; showGroups(); reset(); }, "Force");
    P.controls.appendChild(modeSeg);
    var gConst = K.h("<div></div>"), gSpring = K.h("<div></div>"), gCustom = K.h("<div></div>");
    [fS, dS].forEach(function (s) { gConst.appendChild(s.el); });
    [kS, x0S].forEach(function (s) { gSpring.appendChild(s.el); });
    var profSeg = K.seg([{ label: "Hump", value: "hump" }, { label: "Ramp up", value: "ramp" }, { label: "Push, then brake", value: "brake" }], "hump",
      function (v) { profName = v; prof = PROFILES[v].slice(); reset(); }, "Profile");
    gCustom.appendChild(profSeg);
    gCustom.appendChild(K.h('<p class="control-hint">' + K.md("Drag the dots on the F–x graph to draw your own force, from $x = 0$ to $10$ m. Beyond that, $F = 0$.") + "</p>"));
    [gConst, gSpring, gCustom].forEach(function (g) { P.controls.appendChild(g); });
    P.controls.appendChild(K.h("<h3>The block and the floor</h3>"));
    [mS, uS, muS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-app"><i></i>applied / spring force</span><span class="c-fric"><i></i>friction</span>' +
      '<span class="c-vel"><i></i>velocity, KE</span><span class="c-acc"><i></i>work done</span></div>'));
    function showGroups() { gConst.hidden = mode !== "const"; gSpring.hidden = mode !== "spring"; gCustom.hidden = mode !== "custom"; }
    showGroups();

    function params() { return { m: mS.get(), u: uS.get(), mu: muS.get(), F: fS.get(), d: dS.get(), k: kS.get(), x0: x0S.get() }; }
    var p = params();

    /* ---------- the force F(x) and its area ---------- */
    function profAt(x) {
      var i = Math.min(4, Math.floor(x / 2)), f = (x - 2 * i) / 2;
      return prof[i] + (prof[i + 1] - prof[i]) * f;
    }
    function force(x) {
      if (mode === "const") return x >= 0 && x < p.d ? p.F : 0;
      if (mode === "spring") return -p.k * x;
      return x >= 0 && x <= XMAX ? profAt(x) : 0;
    }
    // area under F–x from 0 to x (exact, so W_F from x_a to x_b is Fint(x_b) - Fint(x_a))
    function Fint(x) {
      if (mode === "const") return p.F * K.clamp(x, 0, p.d);
      if (mode === "spring") return -0.5 * p.k * x * x;
      var xc = K.clamp(x, 0, XMAX), s = 0;
      for (var i = 0; i < 5; i++) {
        var a = 2 * i, b = Math.min(a + 2, xc);
        if (b <= a) break;
        s += (prof[i] + profAt(b)) / 2 * (b - a);
      }
      return s;
    }
    // where F jumps (the block's motion is split exactly at these)
    function jumps() { return mode === "const" ? [0, p.d] : mode === "custom" ? [0, XMAX] : []; }

    /* ---------- motion ---------- */
    var st, rec, panTarget = 0;
    function startX() { return mode === "spring" ? p.x0 : 0; }
    function basePan() { return mode === "spring" ? 0 : 230; }

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      p = params();
      var x = startX();
      st = { x: x, v: p.u, x0: x, KE0: 0.5 * p.m * p.u * p.u, Wf: 0, dist: 0, stuck: false, stillFor: 0, negFor: 0, moved: false,
        turns: [], vmax: Math.abs(p.u), vAtZero: null, done: false, why: null };
      rec = { t: [0], KE: [st.KE0], WF: [0], Wf: [0], th: [st.KE0], P: [force(x) * p.u], Pf: [-p.mu * p.m * G * Math.abs(p.u)] };
      sim.panX = panTarget = basePan();
      P.time.textContent = "t = 0.00 s";
      update(true);
    }
    function WF() { return Fint(st.x) - Fint(st.x0); }
    function KE() { return 0.5 * p.m * st.v * st.v; }

    // advance the block by h seconds: velocity Verlet, split exactly where F jumps or the block stops
    function advance(h) {
      var t = h, guard = 0, fr = p.mu * p.m * G, bps = jumps();
      while (t > 1e-12 && guard++ < 12) {
        var Fx = force(st.x);
        if (st.v === 0) {
          if (Math.abs(Fx) <= fr + 1e-9) { st.stuck = true; return; }   // static friction holds it
          st.stuck = false;
        }
        var dir = st.v !== 0 ? Math.sign(st.v) : Math.sign(Fx);
        var a1 = (Fx - fr * dir) / p.m, tau = t, stops = false;
        if (st.v !== 0 && a1 * dir < 0) { var t0 = -st.v / a1; if (t0 <= tau) { tau = t0; stops = true; } }
        var xn = st.x + st.v * tau + 0.5 * a1 * tau * tau, hit = null;
        bps.forEach(function (b) {
          if ((st.x < b) !== (xn < b)) {
            // time to reach b at constant a1 (smallest positive root)
            var A = 0.5 * a1, Bq = st.v, C = st.x - b, r;
            if (Math.abs(A) < 1e-12) r = -C / Bq;
            else { var disc = Math.max(0, Bq * Bq - 4 * A * C), q = Math.sqrt(disc); var r1 = (-Bq - q) / (2 * A), r2 = (-Bq + q) / (2 * A); r = Math.min(r1 >= 0 ? r1 : Infinity, r2 >= 0 ? r2 : Infinity); }
            if (r < tau && (!hit || r < hit.r)) hit = { r: r, b: b };
          }
        });
        var xa = xn;   // where to read the end-of-step force: just before a jump, not after it
        if (hit) { tau = hit.r; stops = false; xn = hit.b + dir * 1e-12; xa = hit.b - dir * 1e-12; }
        var a2 = (force(xa) - fr * dir) / p.m;
        var vn = stops ? 0 : st.v + 0.5 * (a1 + a2) * tau;
        if (!stops && st.v !== 0 && Math.sign(vn) !== Math.sign(st.v)) vn = 0;
        st.Wf -= fr * Math.abs(xn - st.x);
        st.dist += Math.abs(xn - st.x);
        var was = st.v;
        st.x = xn; st.v = vn; t -= tau;
        if (vn === 0 && was !== 0) st.turns.push(st.x);
      }
    }

    sim.on("step", function (t) {
      if (st.done) return;
      var xPrev = st.x;
      for (var i = 0; i < NSUB; i++) advance(K.DT / NSUB);
      if (Math.abs(st.x - st.x0) > 0.01) st.moved = true;
      st.vmax = Math.max(st.vmax, Math.abs(st.v));
      var Fx = force(st.x), Pw = Fx * st.v;
      rec.t.push(t); rec.KE.push(KE()); rec.WF.push(WF()); rec.Wf.push(st.Wf); rec.th.push(st.KE0 + WF() + st.Wf);
      rec.P.push(Pw); rec.Pf.push(-p.mu * p.m * G * Math.abs(st.v));
      // experiments
      if (p.mu > 0 && st.Wf < -1 && Math.abs(WF()) > 1 && Math.abs(KE() - (st.KE0 + WF() + st.Wf)) < 0.01) tries.mark("theorem");
      st.negFor = Pw < -0.5 ? st.negFor + K.DT : 0;
      if (st.negFor >= 0.25) tries.mark("negative");
      if (mode === "spring" && p.mu === 0 && Math.abs(p.x0) >= 0.5 && st.vAtZero === null && (xPrev - 0) * (st.x - 0) <= 0 && st.moved) {
        st.vAtZero = Math.abs(st.v);
        K.flash(P.note, "At x = 0: v = " + K.fmt(st.vAtZero, 2) + " m/s, the fastest it goes");
        tries.mark("spring");
      }
      st.stillFor = st.stuck ? st.stillFor + K.DT : 0;
      if (st.stillFor >= 0.5 && st.moved) finish("stopped");
      else if (mode !== "spring" && st.x < -0.001) finish("back");
      else if (st.x > 60) finish("far");
      else if (t >= 40) finish("time");
      panTarget = mode === "spring" ? 0 : Math.max(basePan(), sim.px(st.x, 0).x - W * 0.45);
      update(false);
    });

    function finish(why) {
      st.done = true; st.why = why; sim.pause(); transportUI.render();
      if (why === "stopped") {
        K.flash(P.note, "Stopped after " + K.fmt(st.dist, 2) + " m: W_F + W_f = " + K.fmt(WF() + st.Wf, 2) + " J = ΔKE");
        if (mode === "const" && p.mu > 0 && st.x >= p.d && p.F > 0) tries.mark("stop");
      } else if (why === "back") K.flash(P.note, "It came back past the start: reset to try again");
      else if (why === "far") K.flash(P.note, "60 m: nothing left to stop it. Reset to go again");
      else K.flash(P.note, "40 s: reset to start again");
      update(true);
    }

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      sim.panX += (panTarget - sim.panX) * 0.15;
      if (Math.abs(panTarget - sim.panX) < 0.05) sim.panX = panTarget;
      sim.drawGround(ctx);
      var y0 = sim.px(0, 0).y;
      if (mode === "const") {
        var a = sim.px(0, 0), b = sim.px(p.d, 0);
        ctx.fillStyle = K.alpha(th.app, 0.16); ctx.fillRect(a.x, y0 - sim.u(6), b.x - a.x, sim.u(6));
        ctx.strokeStyle = th.app; ctx.lineWidth = sim.u(2);
        ctx.beginPath(); ctx.moveTo(b.x, y0); ctx.lineTo(b.x, y0 - 2.1 * ppm); ctx.stroke();
        ctx.fillStyle = th.app; ctx.beginPath(); ctx.moveTo(b.x, y0 - 2.1 * ppm); ctx.lineTo(b.x + sim.u(22), y0 - 2.1 * ppm + sim.u(8)); ctx.lineTo(b.x, y0 - 2.1 * ppm + sim.u(16)); ctx.fill();
        K.label(ctx, "push ends, d = " + K.fmt(p.d, 1) + " m", b.x + sim.u(6), y0 - 2.1 * ppm - sim.u(4), th.app, { s: sim.u(0.9), align: "left" });
        K.label(ctx, "start", a.x, y0 + sim.u(34), th.muted, { s: sim.u(0.9) });
      } else if (mode === "custom") {
        // the force field along the floor, every half metre
        for (var x = 0; x <= XMAX + 1e-9; x += 0.5) {
          var q = sim.px(x, 1.75), F = force(x);
          ctx.fillStyle = th.muted; ctx.beginPath(); ctx.arc(q.x, q.y, sim.u(1.5), 0, Math.PI * 2); ctx.fill();
          if (Math.abs(F) > 0.5) K.arrow(ctx, q.x, q.y, q.x + F * sim.u(0.9), q.y, K.alpha(th.app, 0.7), { s: sim.u(0.8), width: 2, head: 7 });
        }
        K.label(ctx, "F(x) along the floor", sim.px(0, 2.2).x, sim.px(0, 2.2).y, th.app, { s: sim.u(0.9), align: "left" });
        var e = sim.px(XMAX, 0);
        ctx.strokeStyle = th["grid-strong"]; ctx.setLineDash([sim.u(4), sim.u(4)]);
        ctx.beginPath(); ctx.moveTo(e.x, y0); ctx.lineTo(e.x, y0 - 2 * ppm); ctx.stroke(); ctx.setLineDash([]);
      } else {
        var w = sim.px(WALL, 0);
        ctx.fillStyle = th.bank; ctx.fillRect(w.x - sim.u(14), y0 - 1.8 * ppm, sim.u(14), 1.8 * ppm);
        var z = sim.px(0, 0);
        ctx.strokeStyle = th["grid-strong"]; ctx.setLineDash([sim.u(4), sim.u(4)]); ctx.lineWidth = sim.u(1.5);
        ctx.beginPath(); ctx.moveTo(z.x, y0); ctx.lineTo(z.x, y0 - 1.9 * ppm); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "x = 0 (natural length)", z.x, y0 - 1.9 * ppm - sim.u(2), th.muted, { s: sim.u(0.85) });
        drawSpring(ctx, w.x, sim.px(st.x - SIZE / 2, 0).x, sim.px(0, 0.5).y);
      }
    });
    function drawSpring(ctx, x1, x2, y) {
      var n = 14, amp = sim.u(9);
      ctx.strokeStyle = th.app; ctx.lineWidth = sim.u(2); ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x1, y);
      var lead = Math.min(sim.u(10), (x2 - x1) * 0.1);
      ctx.lineTo(x1 + lead, y);
      for (var i = 1; i < n; i++) ctx.lineTo(x1 + lead + (x2 - x1 - 2 * lead) * i / n, y + (i % 2 ? -amp : amp));
      ctx.lineTo(x2 - lead, y); ctx.lineTo(x2, y); ctx.stroke();
    }
    sim.on("over", function (ctx) {
      var c = sim.px(st.x, SIZE / 2), s = SIZE * ppm;
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s); ctx.strokeRect(c.x - s / 2, c.y - s / 2, s, s);
      K.label(ctx, K.fmt(p.m, 1) + " kg", c.x, c.y + sim.u(6), th.ink, { s: sim.u(0.9) });
      var Fx = force(st.x), big = mode === "spring" ? p.k * Math.max(Math.abs(p.x0), 0.5) : 60, kpn = Math.min(1.6, 110 / Math.max(big, 1));
      if (Math.abs(Fx) > 0.05) {
        var fromX = mode === "spring" ? c.x - s / 2 : (Fx > 0 ? c.x - s / 2 - Fx * sim.u(kpn) : c.x + s / 2 - Fx * sim.u(kpn));
        if (mode === "spring") sim.force(ctx, fromX, c.y - sim.u(10), Fx, 0, th.app, "F " + K.fmt(Fx, 1) + " N", kpn, { ly: -12, lx: Fx < 0 ? -80 : 6 });
        else sim.force(ctx, fromX, c.y, Fx, 0, th.app, "F " + K.fmt(Fx, 1) + " N", kpn, { ly: -12, lx: Fx > 0 ? -90 : 6 });
      }
      var fr = p.mu * p.m * G, fNow = st.v !== 0 ? -Math.sign(st.v) * fr : (st.stuck ? -Fx : 0);
      if (Math.abs(fNow) > 0.05) sim.force(ctx, c.x, c.y + s / 2 - sim.u(3), fNow, 0, th.fric, "f " + K.fmt(Math.abs(fNow), 1) + " N" + (st.stuck ? " (static)" : ""), kpn, { ly: 12, lx: fNow < 0 ? -10 : 6 });
      var top = { x: c.x, y: c.y - s / 2 - sim.u(22) };
      if (Math.abs(st.v) > 0.02) K.arrow(ctx, top.x, top.y, top.x + st.v * sim.u(14), top.y, th.vel, { s: sim.u(1), label: "v " + K.fmt(st.v, 2) + " m/s" });
      if (!sim.running && !st.moved) {
        var hint = mode === "spring" ? "drag the block to stretch the spring" : mode === "const" ? "drag the flag to change d" : "drag the dots on the F–x graph";
        K.label(ctx, hint, c.x, top.y - sim.u(16), th.muted, { s: sim.u(0.9) });
      }
    });

    // drag the flag (constant F) or the block (spring)
    var dragging = null;
    sim.pointer({
      down: function (pt) {
        if (sim.running) return false;
        if (mode === "const" && Math.abs(pt.m.x - p.d) < 0.5 && pt.m.y < 2.4) { dragging = "flag"; return true; }
        if (mode === "spring" && Math.abs(pt.m.x - st.x) < 0.7 && pt.m.y < 1.4) { dragging = "block"; return true; }
        return false;
      },
      drag: function (pt) {
        if (dragging === "flag") { dS.set(K.clamp(Math.round(pt.m.x * 2) / 2, 0.5, 10)); reset(); }
        if (dragging === "block") { x0S.set(K.clamp(Math.round(pt.m.x * 10) / 10, -3, 3)); reset(); }
      },
      up: function () { dragging = null; }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">F–x</b> · the shaded area is the work your force has done so far</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">KE vs t</b> · dashed is $K_0 + W_F + W_f$: they sit on top of each other</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">power vs t</b> · $P = Fv$ for your force, red for friction</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gF = new K.Graph(cv[0], { yLabel: "F (N)", xLabel: "x (m)", xMax: 10, color: th.app });
    var gE = new K.Graph(cv[1], { yLabel: "E (J)", xMax: 3, xAuto: true, color: th.vel });
    var gP = new K.Graph(cv[2], { yLabel: "P (W)", xMax: 3, xAuto: true, color: th.app });
    var gX = null, gY = null;   // the F–x graph's last mapping, for dragging the profile dots

    // plot coordinate: x, or the spring's length (so the axis starts at 0)
    function px_(x) { return mode === "spring" ? L0 + x : x; }
    function sampled(a, b) {
      var pts = [], n = 120, lo = Math.min(a, b), hi = Math.max(a, b), xs = [];
      for (var i = 0; i <= n; i++) xs.push(lo + (hi - lo) * i / n);
      jumps().forEach(function (j) { if (j > lo && j < hi) { xs.push(j - 1e-9); xs.push(j); } });
      xs.sort(function (u, v) { return u - v; });
      if (b < a) xs.reverse();
      xs.forEach(function (x) { pts.push([px_(x), force(x)]); });
      return pts;
    }
    function update(force_) {
      var xm;
      if (mode === "spring") { xm = 7.5; gF.o.xLabel = "spring length ℓ (m)"; gF.o.yMin = gF.o.yMax = undefined; }
      else if (mode === "custom") { xm = Math.max(12, Math.ceil(st.x + 1)); gF.o.xLabel = "x (m)"; gF.o.yMin = -42; gF.o.yMax = 42; }
      else { xm = Math.max(Math.ceil(p.d * 1.5 + 1), Math.ceil(st.x + 1)); gF.o.xLabel = "x (m)"; gF.o.yMin = gF.o.yMax = undefined; }
      gF.o.xMax = xm;
      var lo = mode === "spring" ? -L0 + 0.01 : 0, hi = mode === "spring" ? 7.5 - L0 : xm;
      gF.set("profile", { points: sampled(lo, hi), color: th.app, dash: [5, 5], width: 1.5 });
      gF.set("area", { points: sampled(st.x0, st.x), color: th.app, width: 2.5, fill: K.alpha(th.acc, WF() >= 0 ? 0.3 : 0.22) });
      gF.extra = function (ctx, X, Y) {
        gX = X; gY = Y;
        if (mode === "spring") {
          ctx.strokeStyle = K.alpha(th.muted, 0.6); ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(X(L0), Y(0) - 60); ctx.lineTo(X(L0), Y(0) + 60); ctx.stroke(); ctx.setLineDash([]);
        }
        if (mode === "custom") prof.forEach(function (F, i) {
          ctx.fillStyle = th.app; ctx.strokeStyle = th.surface; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(X(2 * i), Y(F), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });
        ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(X(px_(st.x)), Y(force(st.x)), 5, 0, Math.PI * 2); ctx.stroke();
      };
      var pts = function (arr) { return rec.t.map(function (t, i) { return [t, arr[i]]; }); };
      gE.set("WF", { points: pts(rec.WF), color: K.alpha(th.app, 0.8), width: 1.5 });
      gE.set("Wf", { points: pts(rec.Wf), color: K.alpha(th.fric, 0.8), width: 1.5 });
      gE.set("KE", { points: pts(rec.KE), color: th.vel, width: 2.5, dot: true });
      gE.set("theory", { points: pts(rec.th), color: th.ink, dash: [5, 5], width: 1.5 });
      gP.set("Pf", { points: pts(rec.Pf), color: th.fric, width: 1.5 });
      gP.set("P", { points: pts(rec.P), color: th.app, width: 2.5, dot: true });
      [gF, gE, gP].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force_) renderMaths(); else slowMaths();
    }

    // drag the custom profile's dots on the F–x graph
    var handle = -1;
    function graphPt(e) { var r = gF.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onDown(e) {
      if (mode !== "custom" || !gX) return;
      var q = graphPt(e), best = -1, bd = 18;
      prof.forEach(function (F, i) { var d = Math.hypot(gX(2 * i) - q.x, gY(F) - q.y); if (d < bd) { bd = d; best = i; } });
      if (best < 0) return;
      handle = best; e.preventDefault();
      try { gF.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event */ }
    }
    function onMove(e) {
      if (handle < 0) return;
      var q = graphPt(e), F = (q.y - gY(0)) / (gY(1) - gY(0));
      prof[handle] = K.clamp(Math.round(F), -40, 40);
      profSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      reset();
    }
    function onUp() { handle = -1; }
    gF.canvas.addEventListener("pointerdown", onDown);
    gF.canvas.addEventListener("pointermove", onMove);
    gF.canvas.addEventListener("pointerup", onUp);
    gF.canvas.addEventListener("pointercancel", onUp);
    gF.canvas.style.touchAction = "none";

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Work by your force = area under F–x", "Work by friction (always negative)", "Work–energy theorem: net work = ΔKE", "Power delivered by your force"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "x", label: "position x", cls: "c-disp" }, { id: "v", label: "speed", cls: "c-vel" },
      { id: "KE", label: "kinetic energy", cls: "c-vel" }, { id: "net", label: "K₀ + W_F + W_f", cls: "c-acc" },
      { id: "WF", label: "work by F", cls: "c-app" }, { id: "Wf", label: "work by friction", cls: "c-fric" },
      { id: "P", label: "power Fv", cls: "c-app" }, { id: "s", label: "distance slid", cls: "c-disp" }
    ]);
    var slowMaths = K.throttle(renderMaths, 100);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 || s.charAt(0) === "-" ? "(" + s + ")" : s; }
    function renderMaths() {
      var wF = WF(), ke = KE(), Fx = force(st.x);
      if (mode === "const") {
        var sp = K.clamp(st.x, 0, p.d) - K.clamp(st.x0, 0, p.d);
        K.tex(eqEls[0], "W_F = F\\,s_{push} = " + n(p.F, 0) + " \\times " + n(sp, 2) + " = \\mathbf{" + K.fmt(wF, 2) + "}\\ \\text{J}");
      } else if (mode === "spring") {
        K.tex(eqEls[0], "W_F = \\tfrac12 k\\,(x_0^2 - x^2) = \\tfrac12(" + p.k + ")\\left(" + n(p.x0, 1) + "^2 - " + n(st.x, 2) + "^2\\right) = \\mathbf{" + K.fmt(wF, 2) + "}\\ \\text{J}");
      } else {
        K.tex(eqEls[0], "W_F = \\int_0^{x} F\\,dx = \\text{area from } 0 \\text{ to } " + K.fmt(st.x, 2) + "\\ \\text{m} = \\mathbf{" + K.fmt(wF, 2) + "}\\ \\text{J}");
      }
      K.tex(eqEls[1], "W_f = -\\mu_k m g\\,s = -(" + K.fmt(p.mu, 2) + ")(" + K.fmt(p.m, 1) + ")(9.8)(" + K.fmt(st.dist, 2) + ") = \\mathbf{" + K.fmt(st.Wf, 2) + "}\\ \\text{J}");
      K.tex(eqEls[2], "\\tfrac12 m v^2 = \\tfrac12 m u^2 + W_F + W_f = " + K.fmt(st.KE0, 2) + " + " + n(wF, 2) + " + " + n(st.Wf, 2) + " = \\mathbf{" + K.fmt(st.KE0 + wF + st.Wf, 2) + "}\\ \\text{J}");
      K.tex(eqEls[3], "P = F v = " + n(Fx, 1) + " \\times " + n(st.v, 2) + " = \\mathbf{" + K.fmt(Fx * st.v, 1) + "}\\ \\text{W}");
      setR("x", K.fmt(st.x, 2) + " m", mode === "spring" ? "from natural length" : "from the start");
      setR("v", K.fmt(Math.abs(st.v), 2) + " m/s", "max " + K.fmt(st.vmax, 2));
      setR("KE", K.fmt(ke, 2) + " J", "simulated ½mv²");
      setR("net", K.fmt(st.KE0 + wF + st.Wf, 2) + " J", "theorem");
      setR("WF", K.fmt(wF, 2) + " J", "area under F–x");
      setR("Wf", K.fmt(st.Wf, 2) + " J", "−μk mg s");
      setR("P", K.fmt(Fx * st.v, 1) + " W", Fx * st.v < -0.05 ? "negative: taking energy out" : "");
      setR("s", K.fmt(st.dist, 2) + " m", st.turns.length ? "first turn at x = " + K.fmt(st.turns[0], 2) + " m" : "");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A force does <b class=\"c-acc\">work</b> when it moves something along its own direction: $W = F\\,s$ for a steady force, and $W = \\int F\\,dx$, the <b>area under the F–x graph</b>, when it changes. Area below the axis is negative work.</p>" +
      "<p>Add the work of <i>every</i> force and you get the change in kinetic energy: $W_{net} = \\tfrac12 mv^2 - \\tfrac12 mu^2$. That's the <b>work–energy theorem</b>, Newton's second law integrated over distance. Friction always does negative work here, $-\\mu_k mg\\,s$, where $s$ is the distance slid, not the displacement.</p>" +
      "<p><b>Power</b> is how fast work is done: $P = dW/dt = Fv$. A spring at its natural length pushes with zero force, so the block is fastest there.</p>" +
      '<div class="trap"><b>JEE trap: the theorem needs the net work.</b> $\\tfrac12 mv^2 = Fd$ only on a smooth floor. With friction, or any other force, include its work too. And friction\'s work uses the total path: a block that slides out and back has $W_f = -\\mu_k mg \\times$ (out + back), even if its displacement is zero.</div>');
    function apply(s) {
      mode = s.mode;
      modeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === mode)); });
      showGroups();
      mS.set(s.m); uS.set(s.u || 0); muS.set(s.mu);
      if (s.F != null) fS.set(s.F);
      if (s.d != null) dS.set(s.d);
      if (s.k != null) kS.set(s.k);
      if (s.x0 != null) x0S.set(s.x0);
      if (s.profile) { prof = PROFILES[s.profile].slice(); profSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === s.profile)); }); }
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "W = Fd", setup: { mode: "const", m: 4, u: 0, mu: 0, F: 20, d: 5 }, watch: "Predict the speed at the flag, then press Push",
        q: "A steady 20 N horizontal force pushes a 4 kg block from rest for 5 m along a smooth floor. How fast is it going when the push stops?",
        options: ["7.07 m/s", "5.00 m/s", "25.0 m/s", "10.0 m/s"], answer: 0,
        explain: "$W = Fd = 20 \\times 5 = 100$ J, and all of it becomes kinetic energy: $\\tfrac12(4)v^2 = 100$, so $v = \\sqrt{50} = 7.07$ m/s. 25 m/s comes from forgetting the square root." },
      { level: "medium", tag: "friction takes it all back", setup: { mode: "const", m: 5, u: 0, mu: 0.2, F: 30, d: 4 }, watch: "Predict the total distance, then press Push and wait for it to stop",
        q: "A 5 kg block at rest is pushed with a horizontal 30 N force for 4 m, then let go. The floor has $\\mu_k = 0.2$ ($g = 9.8$). How far does it slide in total, from the start, before it stops?",
        options: ["12.2 m", "8.2 m", "6.1 m", "4.0 m"], answer: 0,
        hints: ["It starts and ends at rest, so the net work is zero.", "Your force works only over 4 m; friction works over the whole distance $s$: $Fd - \\mu_k mg\\,s = 0$."],
        explain: "$\\Delta K = 0$, so $Fd = \\mu_k mg\\,s$: $s = \\dfrac{30 \\times 4}{0.2 \\times 5 \\times 9.8} = \\dfrac{120}{9.8} = 12.2$ m. 8.2 m is only the part after you let go." },
      { level: "hard", tag: "spring on a rough floor", setup: { mode: "spring", m: 2, u: 0, mu: 0.2, k: 50, x0: 1 }, watch: "Predict where it first turns round, then press Push and read the first turn",
        q: "A 2 kg block on a floor with $\\mu_k = \\mu_s = 0.2$ is tied to a spring ($k = 50$ N/m), pulled 1.0 m beyond the natural length and released from rest ($g = 9.8$). How far past the natural length (on the squashed side) does it get before it first stops?",
        options: ["0.84 m", "1.00 m", "0.92 m", "0.69 m"], answer: 0,
        hints: ["At the turning point $v = 0$ again, so the spring's work equals friction's: $\\tfrac12 k(x_0^2 - x_1^2) = \\mu_k mg(x_0 + x_1)$.", "Divide by $(x_0 + x_1)$: $\\tfrac12 k(x_0 - x_1) = \\mu_k mg$."],
        explain: "$x_0 - x_1 = 2\\mu_k mg/k = 2(0.2)(2)(9.8)/50 = 0.157$ m, so $x_1 = 1.00 - 0.157 = 0.84$ m. Each half-swing loses the same $2\\mu_k mg/k$ of amplitude. 0.92 m forgets the factor 2; 0.69 m loses it twice." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Push", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    reset();
    if (location.hostname === "localhost") window.__lab_workenergy = { apply: apply, st: function () { return st; }, WF: WF, KE: KE, p: function () { return p; } };

    return function destroy() {
      sim.destroy(); [gF, gE, gP].forEach(function (g) { g.destroy(); });
      if (window.__lab_workenergy) delete window.__lab_workenergy;
    };
  }
})();
