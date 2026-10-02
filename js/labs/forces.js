/* Laws of motion, lab 1: push a block across a floor. Exact Coulomb friction on top of matter.js contact. */
(function () {
  "use strict";
  var G = 9.8, SIZE = 1.4, F_MAX = 100;

  var lab = {
    id: "forces", chapter: "laws", title: "Forces & friction", short: "free-body diagrams, static vs kinetic",
    lede: "Push a block across the floor and watch every force on it. Static friction quietly matches your push, until it can't, and the block snaps free.",
    tries: [
      { id: "static", title: "Push without moving it",
        text: "Apply a real force, but keep the block still for 2 seconds.",
        why: "Static friction isn't a fixed number. It grows to match your push exactly, up to a maximum of $\\mu_s N$. Below that, $f = F\\cos\\phi$, not $\\mu_s N$." },
      { id: "breakaway", title: "Find the breakaway force",
        text: "Use <i>Ramp F up</i> and watch the friction–force graph at the moment it starts to slide.",
        why: "It breaks free at $F\\cos\\phi = \\mu_s N$. Friction then drops to $\\mu_k N$, which is smaller, so the block lurches forward. That's the step in the graph." },
      { id: "angle", title: "Start it moving with less force by pulling upward",
        text: "Tilt the force above the horizontal and get it sliding with less than the flat-pull breakaway force.",
        why: "Pulling up lifts some weight off the floor, so $N = mg - F\\sin\\phi$ and friction shrink. The least force is at $\\tan\\phi = \\mu_s$: $F_{min} = \\mu_s mg/\\sqrt{1 + \\mu_s^2}$." },
      { id: "newton1", title: "Keep it sliding at constant velocity",
        text: "Get it moving, then balance the forces so it neither speeds up nor slows down for 2 s.",
        why: "Newton's first law: zero net force means constant velocity, not zero velocity. Here $F\\cos\\phi = \\mu_k N$, and it just keeps going." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 320, ppm = 55, origin = { x: 200, y: 250 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: G, gridStep: 1, gridMajor: 5, yLabels: false });
    sim.zoom = 1; sim.panX = 0;

    /* ---------- controls ---------- */
    var mS = K.slider({ label: "Mass $m$", unit: "kg", min: 1, max: 10, step: 0.5, value: 4 });
    var fS = K.slider({ label: "Applied force $F$", unit: "N", min: 0, max: F_MAX, step: 1, value: 10, onInput: function () { ramp = false; } });
    var phiS = K.slider({ label: "Force angle $\\phi$ (above horizontal)", unit: "°", min: 0, max: 60, step: 1, value: 0 });
    var msS = K.slider({ label: "Static friction $\\mu_s$", min: 0, max: 1, step: 0.05, value: 0.5, onInput: function (v) { if (mkS.get() > v) mkS.set(v); } });
    var mkS = K.slider({ label: "Kinetic friction $\\mu_k$", min: 0, max: 1, step: 0.05, value: 0.4, onInput: function (v) { if (msS.get() < v) msS.set(v); },
      hint: "Always $\\mu_k \\le \\mu_s$: it's easier to keep something sliding than to start it." });
    P.controls.innerHTML = "<h3>The block and the push</h3>";
    [mS, fS, phiS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>The floor</h3>"));
    [msS, mkS].forEach(function (s) { P.controls.appendChild(s.el); });
    var row = K.h('<div class="row"></div>');
    var rampBtn = K.h('<button class="btn btn-sm btn-primary" type="button">Ramp F up from 0</button>');
    rampBtn.addEventListener("click", function () { reset(); fS.set(0); rampF = 0; ramp = true; sim.play(); transportUI.render(); });
    row.appendChild(rampBtn);
    P.controls.appendChild(K.h("<h3>Experiment</h3>"));
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>weight</span><span class="c-normal"><i></i>normal</span><span class="c-app"><i></i>applied</span>' +
      '<span class="c-fric"><i></i>friction</span><span class="c-vel"><i></i>velocity</span><span class="c-acc"><i></i>acceleration</span></div>'));

    // while ramping, F comes from rampF (the slider snaps to whole newtons, so it only displays it)
    function params() { return { m: mS.get(), F: ramp ? rampF : fS.get(), phi: phiS.get() * K.DEG, mus: msS.get(), muk: mkS.get() }; }
    // force needed to start it sliding at this angle: F cos(phi) = mu_s (mg - F sin(phi))
    function breakaway(p) { return p.mus * p.m * G / (Math.cos(p.phi) + p.mus * Math.sin(p.phi)); }

    /* ---------- world ---------- */
    sim.add(Matter.Bodies.rectangle(sim.px(1500, -1).x, sim.px(1500, -1).y, 3200 * ppm, 2 * ppm,
      { isStatic: true, friction: 0, frictionStatic: 0, plugin: { k: { hidden: true } } }));
    var block = null, st, rec, ramp = false, rampF = 0;

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      ramp = false;
      if (block) sim.remove(block);
      var c = sim.px(0, SIZE / 2);
      block = sim.add(Matter.Bodies.rectangle(c.x, c.y, SIZE * ppm, SIZE * ppm, {
        friction: 0, frictionStatic: 0, frictionAir: 0, restitution: 0, inertia: Infinity, plugin: { k: { draw: drawBlock } }
      }));
      st = { isStatic: true, f: 0, N: 0, v: 0, a: 0, staticFor: 0, steadyFor: 0, broke: null };
      rec = { t: [], F: [], f: [], v: [], a: [] };
      sim.panX = 0; panTarget = 0;
      P.time.textContent = "t = 0.00 s";
      atRest(); theory(); update(true);
    }

    // the forces on a block sitting still, so the diagram is complete before you press Push
    function atRest() {
      if (!st || sim.running) return;
      var p = params(), Fx = p.F * Math.cos(p.phi), N = Math.max(0, p.m * G - p.F * Math.sin(p.phi));
      st.N = N;
      if (st.isStatic) { st.f = Math.abs(Fx) <= p.mus * N ? -Fx : -Math.sign(Fx) * p.muk * N; st.net = 0; }
    }

    function vx() { return Matter.Body.getVelocity(block).x * 60 / ppm; }

    sim.on("before", function () {
      var p = params();
      if (ramp) { rampF = Math.min(F_MAX, rampF + 4 * K.DT); fS.set(Math.round(rampF)); p = params(); }   // +4 N every second
      var Fx = p.F * Math.cos(p.phi), Fy = p.F * Math.sin(p.phi);
      var N = Math.max(0, p.m * G - Fy), v = vx(), f, net;
      if (st.isStatic) {
        if (Math.abs(Fx) <= p.mus * N + 1e-9) {
          f = -Fx; net = 0;                                    // static friction matches the push exactly
          Matter.Body.setVelocity(block, { x: 0, y: block.velocity.y });
        } else {
          st.isStatic = false;
          st.broke = { t: sim.time, F: p.F, phi: p.phi };
          f = -Math.sign(Fx) * p.muk * N; net = Fx + f;
          onBreakaway(p);
        }
      } else {
        var dir = Math.abs(v) > 1e-6 ? Math.sign(v) : Math.sign(Fx);
        f = -dir * p.muk * N; net = Fx + f;
        // slowing through zero this step? then it sticks, if the push can't beat static friction
        if (Math.abs(v) > 1e-6 && Math.sign(v + net / p.m * K.DT) !== Math.sign(v) && Math.abs(Fx) <= p.mus * N) {
          st.isStatic = true; f = -Fx; net = 0;
          Matter.Body.setVelocity(block, { x: 0, y: block.velocity.y });
        }
      }
      st.f = f; st.N = N; st.net = net;
      sim.push(block, net / p.m, Fy / p.m);                    // gravity and the floor's push come from the engine
    });

    sim.on("step", function (t) {
      var p = params(), v = vx();
      st.a = rec.v.length ? (v - rec.v[rec.v.length - 1]) / K.DT : 0;
      st.v = v;
      rec.t.push(t); rec.F.push(p.F); rec.f.push(Math.abs(st.f)); rec.v.push(v); rec.a.push(st.a);
      // experiments
      st.staticFor = st.isStatic && Math.abs(st.f) > 0.5 ? st.staticFor + K.DT : 0;
      if (st.staticFor >= 2) tries.mark("static");
      st.steadyFor = !st.isStatic && Math.abs(v) > 0.3 && Math.abs(st.a) < 0.02 ? st.steadyFor + K.DT : 0;
      if (st.steadyFor >= 2) tries.mark("newton1");
      // follow the block
      panTarget = block.position.x - W * 0.4;
      if (t >= 40) { sim.pause(); transportUI.render(); K.flash(P.note, "40 s: reset to start again"); }
      update(false);
    });

    function onBreakaway(p) {
      K.flash(P.note, "Breakaway at F = " + K.fmt(p.F, 1) + " N: friction drops from μs·N to μk·N");
      tries.mark("breakaway");
      var flat = p.mus * p.m * G;
      if (p.phi >= 10 * K.DEG && p.F < flat - 0.5) tries.mark("angle");
    }

    /* ---------- drawing ---------- */
    var panTarget = 0;
    sim.on("under", function (ctx) {
      sim.panX += (panTarget - sim.panX) * 0.15;
      sim.drawGround(ctx);
    });
    sim.on("over", function (ctx) {
      if (!block) return;
      var p = params(), b = block.position, half = SIZE * ppm / 2, kpn = 1.6;
      var Fx = p.F * Math.cos(p.phi), Fy = p.F * Math.sin(p.phi);
      // weight and normal from the centre, applied force from the leading face, friction along the floor
      sim.force(ctx, b.x - sim.u(8), b.y, 0, -p.m * G, th.grav, "mg " + K.fmt(p.m * G, 1) + " N", kpn, { lx: -86, ly: 10 });
      if (st.N > 0.05) sim.force(ctx, b.x - sim.u(8), b.y, 0, st.N, th.normal, "N " + K.fmt(st.N, 1) + " N", kpn, { lx: -82, ly: -6 });
      if (p.F > 0.05) sim.force(ctx, b.x + half, b.y, Fx, Fy, th.app, "F " + K.fmt(p.F, 0) + " N", kpn, { ly: -8 });
      if (Math.abs(st.f) > 0.05) sim.force(ctx, b.x, b.y + half - sim.u(3), st.f, 0, th.fric, "f " + K.fmt(Math.abs(st.f), 1) + " N" + (st.isStatic ? " (static)" : ""), kpn, { ly: 12, lx: st.f < 0 ? -10 : 6 });
      var top = { x: b.x, y: b.y - half - sim.u(26) };
      if (Math.abs(st.v) > 0.02) K.arrow(ctx, top.x, top.y, top.x + st.v * sim.u(14), top.y, th.vel, { s: sim.u(1), label: "v " + K.fmt(st.v, 1) });
      if (!st.isStatic && Math.abs(st.net) > 0.05) K.arrow(ctx, top.x, top.y - sim.u(18), top.x + st.net / p.m * sim.u(14), top.y - sim.u(18), th.acc, { s: sim.u(1), label: "a " + K.fmt(st.net / p.m, 2) });
    });
    function drawBlock(ctx, b) {
      var s = SIZE * ppm, x = b.position.x - s / 2, y = b.position.y - s / 2;
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.rect(x, y, s, s); ctx.fill(); ctx.stroke();
      K.label(ctx, mS.get() + " kg", b.position.x + s / 2 - sim.u(6), b.position.y - s / 2 + sim.u(20), th.ink, { s: sim.u(1), align: "right" });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-fric">friction vs applied force</b> · rises with your push, then steps down</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v–t</b> · flat while stuck, then a straight line</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">a vs applied force</b> · zero until breakaway</p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gf = new K.Graph(cv[0], { yLabel: "f (N)", xLabel: "F (N)", xMax: 40, yMin: 0, color: th.fric });
    var gv = new K.Graph(cv[1], { yLabel: "v (m/s)", xMax: 5, xAuto: true, color: th.vel });
    var ga = new K.Graph(cv[2], { yLabel: "a (m/s²)", xLabel: "F (N)", xMax: 40, yMin: 0, color: th.acc });

    function theory() {
      var p = params(), Fb = breakaway(p);
      var xMax = Math.min(F_MAX, Math.max(20, Math.ceil(Math.max(Fb * 2, p.F * 1.15) / 10) * 10));
      gf.o.xMax = ga.o.xMax = xMax;
      var fpts = [], apts = [];
      for (var F = 0; F <= xMax + 1e-9; F += xMax / 200) {
        var Fx = F * Math.cos(p.phi), N = Math.max(0, p.m * G - F * Math.sin(p.phi)), moving = Fx > p.mus * N;
        fpts.push([F, moving ? p.muk * N : Fx]);
        apts.push([F, moving ? (Fx - p.muk * N) / p.m : 0]);
      }
      gf.set("theory", { points: fpts, color: th.fric, dash: [5, 5], width: 1.5 });
      ga.set("theory", { points: apts, color: th.acc, dash: [5, 5], width: 1.5 });
    }
    ["input"].forEach(function (ev) {
      [mS, fS, phiS, msS, mkS].forEach(function (s) { s.input.addEventListener(ev, function () { atRest(); theory(); update(true); }); });
    });

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      gf.set("sim", { points: rec.F.map(function (F, i) { return [F, rec.f[i]]; }), color: th.fric, width: 2.5, dot: true });
      gv.set("sim", { points: rec.t.map(function (t, i) { return [t, rec.v[i]]; }), color: th.vel, width: 2.5, dot: true });
      ga.set("sim", { points: rec.F.map(function (F, i) { return [F, Math.max(0, rec.a[i])]; }).filter(function (q, i) { return i > 0; }), color: th.acc, width: 2.5, dot: true });
      [gf, gv, ga].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Up–down balance gives the normal force", "Friction: static or kinetic?", "Newton's second law, along the floor", "Force needed to start it"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "F", label: "applied force", cls: "c-app" }, { id: "N", label: "normal force", cls: "c-normal" },
      { id: "f", label: "friction", cls: "c-fric" }, { id: "max", label: "max static friction", cls: "c-fric" },
      { id: "a", label: "acceleration", cls: "c-acc" }, { id: "v", label: "velocity", cls: "c-vel" }
    ]);
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function renderMaths() {
      var p = params(), deg = Math.round(p.phi / K.DEG), Fx = p.F * Math.cos(p.phi), N = Math.max(0, p.m * G - p.F * Math.sin(p.phi));
      var moving = !st.isStatic, f = moving ? p.muk * N : Math.min(Math.abs(Fx), p.mus * N);
      K.tex(eqEls[0], "N + F\\sin\\phi = mg \\;\\Rightarrow\\; N = " + B(p.m) + B(G) + " - " + B(p.F, 0) + "\\sin" + deg + "^\\circ = \\mathbf{" + K.fmt(N, 1) + "}\\ \\text{N}");
      K.tex(eqEls[1], moving
        ? "\\text{sliding: } f = \\mu_k N = " + B(p.muk, 2) + B(N) + " = \\mathbf{" + K.fmt(p.muk * N, 1) + "}\\ \\text{N}"
        : "\\text{stuck: } f = F\\cos\\phi = " + K.fmt(Fx, 1) + "\\ \\text{N} \\;\\le\\; \\mu_s N = " + K.fmt(p.mus * N, 1) + "\\ \\text{N}");
      K.tex(eqEls[2], "a = \\frac{F\\cos\\phi - f}{m} = \\frac{" + K.fmt(Fx, 1) + " - " + K.fmt(moving ? f : Math.abs(Fx), 1) + "}{" + K.fmt(p.m, 1) + "} = \\mathbf{" + K.fmt(moving ? (Fx - f) / p.m : 0, 2) + "}\\ \\text{m/s}^2");
      K.tex(eqEls[3], "F_{start} = \\frac{\\mu_s mg}{\\cos\\phi + \\mu_s\\sin\\phi} = \\mathbf{" + K.fmt(breakaway(p), 1) + "}\\ \\text{N}" +
        (p.phi > 0 ? "\\quad(\\text{flat pull: } " + K.fmt(p.mus * p.m * G, 1) + "\\ \\text{N})" : ""));
      setR("F", K.fmt(p.F, 1) + " N", "at " + deg + "°");
      setR("N", K.fmt(N, 1) + " N", N < p.m * G - 0.05 ? "less than mg = " + K.fmt(p.m * G, 1) : "= mg");
      setR("f", K.fmt(Math.abs(st.f), 1) + " N", st.isStatic ? "static: matches the push" : "kinetic: μk N");
      setR("max", K.fmt(p.mus * N, 1) + " N", "μs N");
      setR("a", K.fmt(st.isStatic ? 0 : st.a, 2) + " m/s²", "measured, Δv / Δt");
      setR("v", K.fmt(st.v, 2) + " m/s");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Draw every force on the block (its <b>free-body diagram</b>) and Newton's second law does the rest: the net force along the floor equals $ma$, and up–down the forces balance.</p>" +
      "<p><b class=\"c-fric\">Friction</b> has two personalities. While the block is stuck, <b>static</b> friction is exactly as big as it needs to be to stop it moving, up to a limit of $\\mu_s N$. Once it slides, <b>kinetic</b> friction is a steady $\\mu_k N$, a bit less. That's why things lurch when they break free.</p>" +
      "<p>Friction depends on the <b class=\"c-normal\">normal force</b>, not the weight. Pull upward at an angle and $N = mg - F\\sin\\phi$ drops, and friction drops with it.</p>" +
      '<div class="trap"><b>JEE trap: static friction is not always $\\mu_s N$.</b> $\\mu_s N$ is only the <i>maximum</i>. If you push with less than that, friction equals your push and nothing moves. Always check whether the body slides before writing $f = \\mu N$.</div>');
    function apply(s) { ramp = false; mS.set(s.m); fS.set(s.F); phiS.set(s.phi); msS.set(s.mus); mkS.set(s.muk); reset(); }
    K.practice(P.quiz, [
      { level: "easy", tag: "static friction", setup: { m: 5, F: 20, phi: 0, mus: 0.5, muk: 0.4 }, watch: "Predict the friction force, then press Push",
        q: "A 5 kg block rests on a floor with $\\mu_s = 0.5$ and $\\mu_k = 0.4$ ($g = 9.8$). A horizontal force of 20 N is applied. What is the friction force?",
        options: ["20 N", "24.5 N", "19.6 N", "0 N"], answer: 0,
        explain: "Maximum static friction is $\\mu_s mg = 0.5 \\times 5 \\times 9.8 = 24.5$ N. The 20 N push is less than that, so the block doesn't move, and static friction is just 20 N: enough to balance the push, no more." },
      { level: "medium", tag: "does it slide?", setup: { m: 4, F: 30, phi: 0, mus: 0.5, muk: 0.4 }, watch: "Predict the acceleration, then press Push",
        q: "A 4 kg block ($\\mu_s = 0.5$, $\\mu_k = 0.4$, $g = 9.8$) is pushed horizontally with 30 N. What is its acceleration?",
        options: ["3.58 m/s²", "7.50 m/s²", "2.65 m/s²", "0 m/s²"], answer: 0,
        hints: ["First check: is 30 N more than the maximum static friction $\\mu_s mg$?", "Once it slides, friction is $\\mu_k mg$, whatever the push."],
        explain: "Maximum static friction is $0.5 \\times 4 \\times 9.8 = 19.6$ N, less than 30 N, so it slides. Kinetic friction is $0.4 \\times 39.2 = 15.68$ N, so $a = (30 - 15.68)/4 = 3.58$ m/s². 2.65 m/s² is the trap: it uses $\\mu_s$ for a sliding block." },
      { level: "hard", tag: "the best angle to pull", setup: { m: 10, F: 0, phi: 27, mus: 0.5, muk: 0.4 }, watch: "Press Ramp F up from 0, read the breakaway force, then try other angles to beat it",
        q: "A 10 kg crate sits on a floor with $\\mu_s = 0.5$ ($g = 9.8$). You pull it with a rope at angle $\\phi$ above the horizontal. Which angle needs the least force to start it moving, and what is that force?",
        options: ["0°, 49.0 N", "26.6°, 43.8 N", "45°, 46.2 N", "63.4°, 54.8 N"], answer: 1,
        hints: ["At breakaway, $F\\cos\\phi = \\mu_s(mg - F\\sin\\phi)$, so $F = \\dfrac{\\mu_s mg}{\\cos\\phi + \\mu_s\\sin\\phi}$.", "$F$ is smallest when $\\cos\\phi + \\mu_s\\sin\\phi$ is largest. Differentiate: that happens at $\\tan\\phi = \\mu_s$."],
        explain: "$\\tan\\phi = 0.5$ gives $\\phi = 26.6°$, and $F_{min} = \\dfrac{\\mu_s mg}{\\sqrt{1 + \\mu_s^2}} = \\dfrac{49}{1.118} = 43.8$ N. Pulling up lightens the crate (smaller $N$, so less friction), but tilt too far and too little of the pull is horizontal. At 0° it takes 49 N, at 45° 46.2 N." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Push", onReset: reset });
    reset();

    return function destroy() { sim.destroy(); [gf, gv, ga].forEach(function (g) { g.destroy(); }); };
  }
})();
