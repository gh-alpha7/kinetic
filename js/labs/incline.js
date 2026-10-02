/* Laws of motion, lab 2: a block on an inclined plane, with exact friction along the slope. */
(function () {
  "use strict";
  var G = 9.8, L = 10, S = 1.25, BOTTOM = { x: 13, y: 0 };

  var lab = {
    id: "incline", chapter: "laws", title: "Inclined plane", short: "components, angle of repose",
    lede: "Tilt a ramp and let the block go. Gravity splits into a part that pulls it down the slope and a part that presses it into the ramp, and friction fights the first one.",
    tries: [
      { id: "repose", title: "Find the steepest angle where it still sticks",
        text: "Raise the angle as far as you can while the block stays put.",
        why: "It slips once $mg\\sin\\theta > \\mu_s mg\\cos\\theta$, i.e. at $\\tan\\theta = \\mu_s$: the angle of repose. The mass cancels out." },
      { id: "mass", title: "Show the acceleration doesn't depend on mass",
        text: "Slide two different masses down the same slope and compare.",
        why: "Both the pull $mg\\sin\\theta$ and friction $\\mu_k mg\\cos\\theta$ scale with $m$, so $a = g(\\sin\\theta - \\mu_k\\cos\\theta)$ has no $m$ in it." },
      { id: "up", title: "Flick it up the slope and watch it come back",
        text: "Give it a start speed up the ramp on a slope steep enough to slide back.",
        why: "Going up, gravity and friction both point down the slope: it slows at $g(\\sin\\theta + \\mu_k\\cos\\theta)$. Coming down, friction flips, so it speeds up only at $g(\\sin\\theta - \\mu_k\\cos\\theta)$. Up is quicker than down." },
      { id: "smooth", title: "Measure the acceleration on a smooth ramp",
        text: "Set both friction coefficients to zero and let it slide.",
        why: "With no friction only $mg\\sin\\theta$ acts along the slope: $a = g\\sin\\theta$. At 30° that's exactly $g/2$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 50, origin = { x: 40, y: 475 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: G, gridStep: 1, gridMajor: 5 });

    /* ---------- controls ---------- */
    var tS = K.slider({ label: "Ramp angle $\\theta$", unit: "°", min: 0, max: 60, step: 1, value: 25, onInput: reset });
    var mS = K.slider({ label: "Mass $m$", unit: "kg", min: 1, max: 10, step: 0.5, value: 2, onInput: reset });
    var uS = K.slider({ label: "Start speed up the slope $u$", unit: "m/s", min: 0, max: 10, step: 0.5, value: 0, onInput: reset });
    var msS = K.slider({ label: "Static friction $\\mu_s$", min: 0, max: 1, step: 0.05, value: 0.4, onInput: function (v) { if (mkS.get() > v) mkS.set(v); reset(); } });
    var mkS = K.slider({ label: "Kinetic friction $\\mu_k$", min: 0, max: 1, step: 0.05, value: 0.3, onInput: function (v) { if (msS.get() < v) msS.set(v); reset(); } });
    var showComp = true;
    P.controls.innerHTML = "<h3>Ramp and block</h3>";
    [tS, mS, uS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Surface</h3>"));
    [msS, mkS].forEach(function (s) { P.controls.appendChild(s.el); });
    var row = K.h('<div class="row"></div>');
    var rBtn = K.h('<button class="btn btn-sm" type="button">θ = angle of repose</button>');
    rBtn.addEventListener("click", function () { tS.set(Math.floor(Math.atan(msS.get()) / K.DEG)); reset(); K.flash(P.note, "tan θ just below μs: it should only just hold"); });
    var sBtn = K.h('<button class="btn btn-sm" type="button">Make it smooth</button>');
    sBtn.addEventListener("click", function () { msS.set(0); mkS.set(0); reset(); });
    row.appendChild(rBtn); row.appendChild(sBtn);
    P.controls.appendChild(row);
    P.controls.appendChild(K.check("Split gravity into components", true, function (v) { showComp = v; }));
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>weight</span><span class="c-normal"><i></i>normal</span><span class="c-fric"><i></i>friction</span>' +
      '<span class="c-vel"><i></i>velocity</span><span class="c-acc"><i></i>acceleration</span></div>'));

    function params() { return { th: tS.get() * K.DEG, deg: tS.get(), m: mS.get(), u: uS.get(), mus: msS.get(), muk: mkS.get() }; }
    function geom(p) {
      var c = Math.cos(p.th), s = Math.sin(p.th);
      return { A: { x: BOTTOM.x - L * c, y: L * s }, B: BOTTOM, d: { x: c, y: -s }, n: { x: s, y: c } };  // d: down the slope, n: out of it
    }

    /* ---------- world ---------- */
    sim.add(Matter.Bodies.rectangle(sim.px(20, -1).x, sim.px(20, -1).y, 80 * ppm, 2 * ppm, { isStatic: true, friction: 0, plugin: { k: { hidden: true } } }));
    var plank = null, block = null, st, rec, runs = [];

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      if (plank) sim.remove(plank);
      if (block) sim.remove(block);
      var p = params(), g = geom(p), T = 0.4;
      var mid = { x: (g.A.x + g.B.x) / 2 - g.n.x * T / 2, y: (g.A.y + g.B.y) / 2 - g.n.y * T / 2 }, mp = sim.px(mid.x, mid.y);
      plank = sim.add(Matter.Bodies.rectangle(mp.x, mp.y, L * ppm, T * ppm, { isStatic: true, angle: p.th, friction: 0, frictionStatic: 0, plugin: { k: { hidden: true } } }));
      // start near the top to slide down, or near the bottom when it's flicked up the slope
      var d0 = p.u > 0 ? L - 1.6 : 1.4, bc ={ x: g.A.x + g.d.x * d0 + g.n.x * S / 2, y: g.A.y + g.d.y * d0 + g.n.y * S / 2 }, bp = sim.px(bc.x, bc.y);
      block = sim.add(Matter.Bodies.rectangle(bp.x, bp.y, S * ppm, S * ppm, {
        angle: p.th, inertia: Infinity, friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, plugin: { k: { draw: drawBlock } }
      }));
      if (p.u > 0) sim.setVel(block, -p.u * g.d.x, -p.u * g.d.y, 0, 0);
      // friction already acting on the block before it's released: static mg sin(theta) up the slope, or kinetic
      var f0 = p.u > 0 ? 0 : Math.tan(p.th) <= p.mus ? -p.m * G * Math.sin(p.th) : -p.muk * p.m * G * Math.cos(p.th);
      st = { isStatic: p.u === 0, v: -p.u, a: 0, f: f0, s: d0, reversed: false, heldFor: 0, slideA: [], done: false, startS: d0 };
      rec = { t: [0], v: [-p.u] };
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }

    function along() {   // speed and position along the slope, down positive
      var p = params(), g = geom(p), v = Matter.Body.getVelocity(block), k = 60 / ppm;
      var pos = sim.posM(block);
      return { v: v.x * k * g.d.x + (-v.y * k) * g.d.y, s: (pos.x - g.A.x) * g.d.x + (pos.y - g.A.y) * g.d.y };
    }

    sim.on("before", function () {
      if (!block) return;
      var p = params(), g = geom(p), gs = G * Math.sin(p.th), gc = G * Math.cos(p.th), v = along().v, fa;   // fa: friction accel along d
      var holds = Math.tan(p.th) <= p.mus + 1e-9;
      if (st.isStatic) {
        if (holds) { fa = -gs; Matter.Body.setVelocity(block, { x: 0, y: 0 }); }
        else { st.isStatic = false; fa = -p.muk * gc; }
      } else {
        var dir = Math.abs(v) > 1e-6 ? Math.sign(v) : 1;
        fa = -dir * p.muk * gc;
        var next = v + (gs + fa) * K.DT;
        if (Math.abs(v) > 1e-6 && Math.sign(next) !== Math.sign(v)) {
          if (dir < 0) st.reversed = true;                     // it was going up and is about to turn back
          if (holds) { st.isStatic = true; fa = -gs; Matter.Body.setVelocity(block, { x: 0, y: 0 }); }
        }
      }
      st.f = p.m * fa;                                            // signed along d (negative = up the slope)
      sim.push(block, fa * g.d.x, fa * g.d.y);
    });

    sim.on("step", function (t) {
      var p = params(), q = along(), prev = rec.v[rec.v.length - 1];
      st.a = (q.v - prev) / K.DT; st.v = q.v; st.s = q.s;
      rec.t.push(t); rec.v.push(q.v);
      if (!st.isStatic && rec.t.length > 4 && q.v > 0 && prev > 0) st.slideA.push(st.a);   // skip the step that spans a turnaround
      if (st.reversed && q.v > 0.05) tries.mark("up");
      st.heldFor = st.isStatic ? st.heldFor + K.DT : 0;
      if (st.heldFor >= 1.5 && p.u === 0) { finish("held"); return; }
      if (q.s >= L - S * 0.6 || q.s <= 0.2 || t > 20) finish(q.s >= L - S * 0.6 ? "bottom" : q.s <= 0.2 ? "top" : "time");
      update(false);
    });

    function finish(why) {
      if (st.done) return;
      st.done = true;
      sim.pause(); transportUI.render();
      var p = params(), aDown = st.slideA.length ? st.slideA.reduce(function (a, b) { return a + b; }, 0) / st.slideA.length : null;
      var run = { deg: p.deg, m: p.m, mus: p.mus, muk: p.muk, u: p.u, held: why === "held", a: why === "held" ? 0 : aDown, f: why === "held" ? p.m * G * Math.sin(p.th) : p.muk * p.m * G * Math.cos(p.th) };
      runs.push(run); if (runs.length > 30) runs.shift();
      st.result = run;
      if (why === "held") {
        K.flash(P.note, "It holds: tan " + p.deg + "° = " + K.fmt(Math.tan(p.th), 3) + " ≤ μs = " + p.mus);
        if (p.deg >= 5 && p.deg >= Math.atan(p.mus) / K.DEG - 2) tries.mark("repose");
      } else if (aDown != null) {
        K.flash(P.note, "Slid down at a = " + K.fmt(aDown, 2) + " m/s²");
        if (p.mus === 0 && p.muk === 0 && Math.abs(aDown - G * Math.sin(p.th)) <= 0.01 * G * Math.sin(p.th) + 1e-3 && p.deg > 0) tries.mark("smooth");
        runs.forEach(function (r) {
          if (r === run || r.held || r.u || run.u || r.a == null) return;
          if (r.deg === run.deg && r.muk === run.muk && r.mus === run.mus && r.m !== run.m && Math.abs(r.a - run.a) < 0.02) tries.mark("mass");
        });
      } else K.flash(P.note, why === "top" ? "Off the top of the ramp" : "Stopped");
      update(true);
    }

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      var p = params(), g = geom(p), A = sim.px(g.A.x, g.A.y), B = sim.px(g.B.x, g.B.y), C = sim.px(g.A.x, 0);
      sim.drawGround(ctx);
      ctx.fillStyle = th.bank; ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      // angle mark at the bottom
      if (p.deg > 0) {
        ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5);
        ctx.beginPath(); ctx.arc(B.x, B.y, sim.u(46), Math.PI, Math.PI + p.th); ctx.stroke();
        K.label(ctx, "θ = " + p.deg + "°", B.x - sim.u(78), B.y - sim.u(6), th.ink, { s: sim.u(1) });
      }
    });
    sim.on("over", function (ctx) {
      if (!block) return;
      var p = params(), g = geom(p), b = block.position, kpn = 90 / (p.m * G);   // weight always ~90 px, whatever the mass
      var mg = p.m * G, N = mg * Math.cos(p.th), along = mg * Math.sin(p.th);
      if (showComp && p.deg > 0) {
        sim.force(ctx, b.x, b.y, along * g.d.x, along * g.d.y, K.alpha(th.grav, 0.7), "mg sinθ", kpn, { dash: [5, 4], width: 2 });
        sim.force(ctx, b.x, b.y, -N * g.n.x, -N * g.n.y, K.alpha(th.grav, 0.7), "mg cosθ", kpn, { dash: [5, 4], width: 2, lx: 8, ly: 4 });
      }
      sim.force(ctx, b.x, b.y, 0, -mg, th.grav, "mg", kpn, { lx: -30, ly: 8 });
      sim.force(ctx, b.x, b.y, N * g.n.x, N * g.n.y, th.normal, "N", kpn);
      if (Math.abs(st.f) > 0.01) {
        var base = { x: b.x - g.n.x * S * ppm * 0.45, y: b.y + g.n.y * S * ppm * 0.45 };
        sim.force(ctx, base.x, base.y, st.f * g.d.x, st.f * g.d.y, th.fric, "f" + (st.isStatic && Math.tan(p.th) <= p.mus ? " (static)" : ""), kpn, { ly: -10 });
      }
      var top = { x: b.x + g.n.x * sim.u(46), y: b.y - g.n.y * sim.u(46) }, kv = sim.u(14);
      if (Math.abs(st.v) > 0.02) K.arrow(ctx, top.x, top.y, top.x + st.v * g.d.x * kv, top.y - st.v * g.d.y * kv, th.vel, { s: sim.u(1), label: "v" });
    });
    function drawBlock(ctx, b) {
      ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
      var s = S * ppm;
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">a vs θ</b> · zero until the angle of repose, then $g(\\sin\\theta - \\mu_k\\cos\\theta)$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-fric">friction vs θ</b> · static grows as $mg\\sin\\theta$, then drops to kinetic</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v–t (down the slope +)</b> · this run</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var ga = new K.Graph(cv[0], { yLabel: "a (m/s²)", xLabel: "θ (°)", xMax: 60, yMin: 0, color: th.acc });
    var gf = new K.Graph(cv[1], { yLabel: "f (N)", xLabel: "θ (°)", xMax: 60, yMin: 0, color: th.fric });
    var gv = new K.Graph(cv[2], { yLabel: "v (m/s)", xMax: 2, xAuto: true, color: th.vel });

    function theory() {
      var p = params(), ap = [], fp = [];
      for (var d = 0; d <= 60; d += 0.5) {
        var r = d * K.DEG, slides = Math.tan(r) > p.mus;
        ap.push([d, slides ? G * (Math.sin(r) - p.muk * Math.cos(r)) : 0]);
        fp.push([d, slides ? p.muk * p.m * G * Math.cos(r) : p.m * G * Math.sin(r)]);
      }
      ga.set("theory", { points: ap, color: th.acc, dash: [5, 5], width: 1.5 });
      gf.set("theory", { points: fp, color: th.fric, dash: [5, 5], width: 1.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params(), mine = runs.filter(function (r) { return r.mus === p.mus && r.muk === p.muk && !r.u; });
      ga.extra = gf.extra = null;
      ga.set("runs", { points: [], color: th.acc });
      ga.extra = function (ctx, X, Y) { dots(ctx, X, Y, mine.filter(function (r) { return r.a != null; }).map(function (r) { return [r.deg, r.a]; }), th.acc); };
      gf.extra = function (ctx, X, Y) { dots(ctx, X, Y, mine.filter(function (r) { return r.m === p.m; }).map(function (r) { return [r.deg, r.f]; }), th.fric); };
      gv.set("sim", { points: rec.t.map(function (t, i) { return [t, rec.v[i]]; }), color: th.vel, width: 2.5, dot: true });
      [ga, gf, gv].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function dots(ctx, X, Y, pts, color) {
      ctx.fillStyle = color;
      pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4.5, 0, Math.PI * 2); ctx.fill(); });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Into the slope: forces balance", "Does it slide?", "Down the slope: Newton's second law", "Going up vs coming down"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "rep", label: "angle of repose" }, { id: "N", label: "normal force", cls: "c-normal" }, { id: "f", label: "friction", cls: "c-fric" },
      { id: "a", label: "acceleration", cls: "c-acc" }, { id: "v", label: "velocity", cls: "c-vel" }, { id: "s", label: "distance down", cls: "c-disp" }
    ]);
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function renderMaths() {
      var p = params(), sn = Math.sin(p.th), cs = Math.cos(p.th), N = p.m * G * cs, slides = Math.tan(p.th) > p.mus;
      K.tex(eqEls[0], "N = mg\\cos\\theta = " + B(p.m) + B(G) + "\\cos" + p.deg + "^\\circ = \\mathbf{" + K.fmt(N, 1) + "}\\ \\text{N}");
      K.tex(eqEls[1], "\\tan" + p.deg + "^\\circ = " + K.fmt(Math.tan(p.th), 3) + (slides ? " > " : " \\le ") + "\\mu_s = " + K.fmt(p.mus, 2) + "\\;\\Rightarrow\\; \\text{" + (slides ? "it slides" : "it holds") + "}");
      K.tex(eqEls[2], slides
        ? "a = g(\\sin\\theta - \\mu_k\\cos\\theta) = 9.8\\,(" + K.fmt(sn, 3) + " - " + K.fmt(p.muk, 2) + "\\times" + K.fmt(cs, 3) + ") = \\mathbf{" + K.fmt(G * (sn - p.muk * cs), 2) + "}\\ \\text{m/s}^2"
        : "f = mg\\sin\\theta = " + K.fmt(p.m * G * sn, 1) + "\\ \\text{N} \\le \\mu_s N = " + K.fmt(p.mus * N, 1) + "\\ \\text{N},\\ a = 0");
      K.tex(eqEls[3], "a_{up} = g(\\sin\\theta + \\mu_k\\cos\\theta) = " + K.fmt(G * (sn + p.muk * cs), 2) + " \\quad a_{down} = " + K.fmt(Math.max(0, G * (sn - p.muk * cs)), 2) + "\\ \\text{m/s}^2");
      setR("rep", K.fmt(Math.atan(p.mus) / K.DEG, 1) + "°", "tan⁻¹ μs, for any mass");
      setR("N", K.fmt(N, 1) + " N", "mg cos θ, less than mg");
      setR("f", K.fmt(Math.abs(st.f), 1) + " N", st.isStatic && !slides ? "static, holds it" : "kinetic, μk N");
      var res = st.result && st.result.a != null && !st.result.held ? st.result.a : null;
      setR("a", res != null ? K.fmt(res, 2) + " m/s²" : K.fmt(st.isStatic ? 0 : st.a, 2) + " m/s²", "formula " + K.fmt(slides ? G * (sn - p.muk * cs) : 0, 2));
      setR("v", K.fmt(st.v, 2) + " m/s", "+ is down the slope");
      setR("s", K.fmt(st.s - st.startS, 2) + " m");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>On a slope, tilt your axes to match it. Gravity $mg$ then has two parts: <b class=\"c-grav\">$mg\\sin\\theta$ down the slope</b> and <b class=\"c-grav\">$mg\\cos\\theta$ into it</b>. The ramp pushes back with <b class=\"c-normal\">$N = mg\\cos\\theta$</b>, which is less than the weight.</p>" +
      "<p>Along the slope it's a tug of war: $mg\\sin\\theta$ against <b class=\"c-fric\">friction</b>. While $\\tan\\theta \\le \\mu_s$, static friction wins and the block stays put. Past that it slides with $a = g(\\sin\\theta - \\mu_k\\cos\\theta)$, the same for every mass.</p>" +
      '<div class="trap"><b>JEE trap: friction flips direction with the motion.</b> Sliding up, friction points down the slope, adding to gravity: $a = g(\\sin\\theta + \\mu_k\\cos\\theta)$. Sliding down, it points up: $a = g(\\sin\\theta - \\mu_k\\cos\\theta)$. Use the wrong one and every later step is off.</div>');
    function apply(s) { tS.set(s.th); mS.set(s.m); uS.set(s.u); msS.set(s.mus); mkS.set(s.muk); reset(); }
    K.practice(P.quiz, [
      { level: "easy", tag: "smooth incline", setup: { th: 30, m: 2, u: 0, mus: 0, muk: 0 }, watch: "Predict a, then press Release",
        q: "A block slides down a smooth (frictionless) incline at 30° ($g = 9.8$). What is its acceleration?",
        options: ["9.80 m/s²", "8.49 m/s²", "4.90 m/s²", "2.45 m/s²"], answer: 2,
        explain: "Only $mg\\sin\\theta$ acts along a smooth slope, so $a = g\\sin 30° = 4.9$ m/s², exactly half of $g$. 8.49 m/s² is $g\\cos 30°$, the component pressing into the ramp." },
      { level: "medium", tag: "sliding with friction", setup: { th: 30, m: 2, u: 0, mus: 0.3, muk: 0.2 }, watch: "Predict a, then press Release",
        q: "A block is released on a 30° incline with $\\mu_s = 0.3$ and $\\mu_k = 0.2$ ($g = 9.8$). What is its acceleration?",
        options: ["4.90 m/s²", "3.20 m/s²", "6.60 m/s²", "0 m/s² (it stays put)"], answer: 1,
        hints: ["Check first: does it slide at all? Compare $\\tan 30°$ with $\\mu_s$.", "Along the slope: $ma = mg\\sin\\theta - \\mu_k mg\\cos\\theta$."],
        explain: "$\\tan 30° = 0.577 > 0.3$, so it slides. Then $a = 9.8(0.5 - 0.2 \\times 0.866) = 3.20$ m/s². 6.60 m/s² is what you'd get with friction pointing the wrong way. (With $g = 10$ the textbook answer is 3.27 m/s².)" },
      { level: "hard", tag: "up and back down", setup: { th: 37, m: 2, u: 8, mus: 0.25, muk: 0.25 }, watch: "Predict the return speed, then press Release and watch the v–t graph",
        q: "A block is flicked up a 37° incline at 8 m/s; $\\mu_s = \\mu_k = 0.25$ ($g = 9.8$). How fast is it moving when it slides back down to where it started?",
        options: ["8.0 m/s", "5.7 m/s", "4.1 m/s", "0 m/s: it stays at the top"], answer: 1,
        hints: ["Going up, gravity and friction both pull down the slope: $a = g(\\sin\\theta + \\mu\\cos\\theta)$. Find how far it climbs with $v^2 = u^2 - 2as$.", "Check it doesn't stick at the top ($\\tan 37°$ vs $\\mu_s$). Coming down, friction flips: $a = g(\\sin\\theta - \\mu\\cos\\theta)$ over the same distance."],
        explain: "Up: $a = 9.8(0.602 + 0.25 \\times 0.799) = 7.86$ m/s², so it climbs $8^2/(2 \\times 7.86) = 4.07$ m. Since $\\tan 37° = 0.75 > 0.25$ it slides back, with $a = 9.8(0.602 - 0.25 \\times 0.799) = 3.94$ m/s². Over 4.07 m: $v = \\sqrt{2 \\times 3.94 \\times 4.07} \\approx 5.7$ m/s. It comes back slower than it left, because friction acted on the way up and down." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    reset();

    return function destroy() { sim.destroy(); [ga, gf, gv].forEach(function (g) { g.destroy(); }); };
  }
})();
