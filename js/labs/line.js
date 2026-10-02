/* Lab 1: motion in a straight line. A cart on a 60 m track under constant acceleration. */
(function () {
  "use strict";
  var T_MAX = 12, TRACK = 60;

  var lab = {
    id: "line", chapter: "kinematics", title: "Motion in a straight line", short: "position, velocity, acceleration",
    lede: "Push a cart along a 60 m track. Set where it starts, how fast it's going and how hard it's accelerated, then watch $x$, $v$ and $a$ draw their own graphs.",
    tries: [
      { id: "turn", title: "Make the cart turn around",
        text: "Give it a forward velocity and a backward acceleration (or the other way round).",
        why: "At the turning point $v = 0$, but $a$ isn't zero: the cart is still being pushed back. The v–t line crosses the time axis there, and the x–t curve peaks." },
      { id: "uniform", title: "Draw a straight line on the x–t graph",
        text: "Make the cart move with a steady velocity for at least 2 seconds.",
        why: "With $a = 0$, $x$ grows by the same amount every second, so the x–t graph is a straight line with slope $v$, and the v–t graph is flat." },
      { id: "brake", title: "Brake to a stop at the 40 m mark",
        text: "Pick $u$ and $a$ so the cart comes to rest within 1 m of the 40 m mark. Hint: $v^2 = u^2 + 2as$.",
        why: "Stopping means $v = 0$, so $u^2 = -2as$. From $x_0 = 0$ that's $a = -u^2/80$: for example $u = 20$ m/s needs $a = -5$ m/s²." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 230, ppm = 15, origin = { x: 50, y: 140 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 1, gridMajor: 5, yLabels: false });
    var CART_W = 3, CART_H = 1.4;

    /* ---------- controls ---------- */
    var x0S = K.slider({ label: "Start position $x_0$", unit: "m", min: 0, max: TRACK, step: 1, value: 5, onInput: reset });
    var uS = K.slider({ label: "Initial velocity $u$", unit: "m/s", min: -20, max: 20, step: 1, value: 4, onInput: reset,
      hint: "Negative means moving left." });
    var aS = K.slider({ label: "Acceleration $a$", unit: "m/s²", min: -6, max: 6, step: 0.5, value: 1, onInput: reset,
      hint: "Opposite sign to $u$ means slowing down." });
    var show = { vec: true, tape: true, ghosts: true };
    P.controls.innerHTML = "<h3>Set up the motion</h3>";
    [x0S, uS, aS].forEach(function (s) { P.controls.appendChild(s.el); });
    var toggles = K.h('<div class="row"></div>');
    toggles.appendChild(K.check("Vectors", true, function (v) { show.vec = v; }));
    toggles.appendChild(K.check("Ticker tape", true, function (v) { show.tape = v; }));
    toggles.appendChild(K.check("Every second", true, function (v) { show.ghosts = v; }));
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    P.controls.appendChild(toggles);
    var presets = K.h('<div class="row"></div>');
    [
      { label: "Steady", x0: 5, u: 5, a: 0 },
      { label: "Speeding up", x0: 0, u: 0, a: 1 },
      { label: "Throw & return", x0: 10, u: 12, a: -3 },
      { label: "Hard brake", x0: 0, u: 20, a: -5 }
    ].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p.label + "</button>");
      b.addEventListener("click", function () { x0S.set(p.x0); uS.set(p.u); aS.set(p.a); reset(); });
      presets.appendChild(b);
    });
    P.controls.appendChild(K.h("<h3>Presets</h3>"));
    P.controls.appendChild(presets);

    /* ---------- world ---------- */
    var cart = null, rec, ticks, ghosts, turn, prevV, distance, ended;
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); updateCount(); });
    function updateCount() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    updateCount();

    function params() { return { x0: x0S.get(), u: uS.get(), a: aS.get() }; }

    function reset() {
      sim.pause(); sim.resetClock(); transportUI.render();
      if (cart) sim.remove(cart);
      var p = params(), c = sim.px(p.x0, CART_H / 2 + 0.35);
      cart = sim.add(Matter.Bodies.rectangle(c.x, c.y, CART_W * ppm, CART_H * ppm, {
        frictionAir: 0, friction: 0, frictionStatic: 0, inertia: Infinity, isSensor: true,
        plugin: { k: { draw: drawCart } }
      }));
      sim.setVel(cart, p.u, 0, p.a, 0);
      rec = { t: [0], x: [p.x0], v: [p.u] };
      ticks = [p.x0]; ghosts = []; turn = null; prevV = Math.sign(p.u); distance = 0; ended = false;
      P.time.textContent = "t = 0.00 s";
      theory();
      update(true);
    }

    sim.on("before", function () { if (cart) sim.push(cart, aS.get(), 0); });
    sim.on("step", function (t) {
      var p = params(), x = sim.posM(cart).x, v = sim.getVel(cart, p.a, 0).x;
      distance += Math.abs(x - rec.x[rec.x.length - 1]);
      rec.t.push(t); rec.x.push(x); rec.v.push(v);
      var n = sim.steps;
      if (n % 30 === 0) ticks.push(x);                 // a dot every 0.5 s
      if (n % 60 === 0) ghosts.push(x);                // a ghost cart every 1 s
      // Compare against the last non-zero velocity: v can land exactly on 0 at the turn.
      var sign = v > 1e-6 ? 1 : v < -1e-6 ? -1 : 0;
      if (sign) {
        if (!turn && prevV && sign !== prevV && p.a) {
          // back up to the exact turning moment: v = a(t - t_turn), x_turn = x - v^2 / 2a
          turn = { t: t - v / p.a, x: x - v * v / (2 * p.a) };
          K.flash(P.note, "Turned around at t = " + K.fmt(turn.t, 2) + " s, x = " + K.fmt(turn.x, 1) + " m");
          tries.mark("turn");
          if (Math.abs(turn.x - 40) <= 1) tries.mark("brake");
        }
        prevV = sign;
      }
      if (p.a === 0 && p.u !== 0 && t >= 2) tries.mark("uniform");
      // x is the cart's centre: stop once it passes an end while still heading outwards
      var out = (x < 0 && v < 0) || (x > TRACK && v > 0);
      if (out || t >= T_MAX - 1e-9) {
        sim.pause(); transportUI.render(); ended = true;
        K.flash(P.note, out ? "End of the track" : "That's " + T_MAX + " s. Reset to go again");
        // a cart that stops right at the mark without reversing still counts
        if (!turn && Math.abs(v) < 0.6 && Math.abs(x - 40) <= 1) tries.mark("brake");
      }
      update(ended);              // always show the final numbers when a run stops
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      // track + rails
      var g = sim.px(0, 0);
      sim.drawGround(ctx, g.y);
      ctx.fillStyle = th["grid-strong"];
      ctx.fillRect(sim.px(0, 0).x, g.y - 3, TRACK * ppm, 3);
      [0, TRACK].forEach(function (xm) {
        var b = sim.px(xm, 0);
        ctx.fillStyle = th.muted; ctx.fillRect(b.x - (xm ? 0 : 6), g.y - 24, 6, 24);
      });
      // ticker tape below the track
      if (show.tape && ticks) {
        var ty = g.y + 30;
        ctx.fillStyle = th.surface; ctx.fillRect(sim.px(0, 0).x, ty - 9, TRACK * ppm, 18);
        ctx.strokeStyle = th.line; ctx.strokeRect(sim.px(0, 0).x, ty - 9, TRACK * ppm, 18);
        ctx.fillStyle = th.disp;
        ticks.forEach(function (xm) { var p = sim.px(xm, 0); ctx.beginPath(); ctx.arc(p.x, ty, 3, 0, Math.PI * 2); ctx.fill(); });
        K.label(ctx, "ticker tape: a dot every 0.5 s", sim.px(0, 0).x + 4, ty + 27, th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
      }
      // a faint cart every whole second
      if (show.ghosts && ghosts) {
        ctx.save(); ctx.globalAlpha = 0.18;
        ghosts.forEach(function (xm, i) {
          drawCartAt(ctx, xm);
          K.label(ctx, (i + 1) + "s", sim.px(xm, 0).x, sim.px(0, CART_H + 0.5).y - 2, th.ink);
        });
        ctx.restore();
      }
      if (turn) {
        var tp = sim.px(turn.x, 0);
        ctx.strokeStyle = th.acc; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tp.x, 10); ctx.lineTo(tp.x, g.y); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "v = 0 here", tp.x, 24, th.acc, { bg: true });
      }
    });
    sim.on("over", function (ctx) {
      if (!cart || !show.vec) return;
      var p = params(), x = sim.posM(cart).x, v = sim.getVel(cart, p.a, 0).x;
      var top = sim.px(x, CART_H + 1.6);
      K.arrow(ctx, top.x, top.y, top.x + v * 6, top.y, th.vel, { label: "v = " + K.fmt(v, 1), lx: v >= 0 ? 6 : -70 });
      if (p.a) K.arrow(ctx, top.x, top.y - 22, top.x + p.a * 14, top.y - 22, th.acc, { label: "a = " + K.fmt(p.a, 1), lx: p.a >= 0 ? 6 : -70 });
    });

    function drawCartAt(ctx, xm) {
      var c = sim.px(xm, 0), w = CART_W * ppm, h = CART_H * ppm;
      ctx.fillStyle = th.disp;
      roundRect(ctx, c.x - w / 2, c.y - h - 10, w, h, 6); ctx.fill();
      ctx.fillStyle = th.body;
      [-w / 3, w / 3].forEach(function (dx) { ctx.beginPath(); ctx.arc(c.x + dx, c.y - 6, 6, 0, Math.PI * 2); ctx.fill(); });
    }
    function drawCart(ctx, b) {
      drawCartAt(ctx, sim.m(b.position.x, b.position.y).x);
      var c = sim.px(sim.m(b.position.x, 0).x, 0);
      ctx.fillStyle = th.surface; ctx.beginPath(); ctx.arc(c.x, c.y - CART_H * ppm / 2 - 10, 3, 0, Math.PI * 2); ctx.fill();
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">x–t</b> · slope is velocity</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v–t</b> · slope is acceleration, shaded area is displacement</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">a–t</b> · constant here, so it\'s flat</p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gx = new K.Graph(cv[0], { yLabel: "x (m)", xMax: T_MAX, yMin: 0, yMax: TRACK, color: th.disp });
    var gv = new K.Graph(cv[1], { yLabel: "v (m/s)", xMax: T_MAX, color: th.vel });
    var ga = new K.Graph(cv[2], { yLabel: "a (m/s²)", xMax: T_MAX, yMin: -1, yMax: 1, color: th.acc });

    function theory() {
      var p = params(), xs = [], vs = [], as = [];
      // predict only as far as the cart can go: stop where it would leave the track
      for (var t = 0; t <= T_MAX + 1e-9; t += 0.05) {
        var x = p.x0 + p.u * t + 0.5 * p.a * t * t, v = p.u + p.a * t;
        xs.push([t, x]); vs.push([t, v]); as.push([t, p.a]);
        if ((x < 0 && v < 0) || (x > TRACK && v > 0)) break;
      }
      gx.set("theory", { points: xs, color: th.disp, dash: [5, 5], width: 1.5 });
      gv.set("theory", { points: vs, color: th.vel, dash: [5, 5], width: 1.5 });
      ga.set("theory", { points: as, color: th.acc, dash: [5, 5], width: 1.5 });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["v = u + at", "s = ut + ½at²", "v² = u² + 2as"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "t", label: "time" },
      { id: "x", label: "position x", cls: "c-disp" },
      { id: "s", label: "displacement s", cls: "c-disp" },
      { id: "d", label: "distance", cls: "c-disp" },
      { id: "v", label: "velocity v", cls: "c-vel" },
      { id: "a", label: "acceleration a", cls: "c-acc" }
    ]);
    var slowUpdate = K.throttle(function () { renderMaths(); }, 100);

    function update(force) {
      var len = rec.t.length, t = rec.t[len - 1];
      gx.set("sim", { points: rec.t.map(function (tt, i) { return [tt, rec.x[i]]; }), color: th.disp, width: 2.5, dot: true });
      gv.set("sim", { points: rec.t.map(function (tt, i) { return [tt, rec.v[i]]; }), color: th.vel, width: 2.5, dot: true,
        fill: K.alpha(th.vel, 0.16) });
      ga.set("sim", { points: rec.t.map(function (tt) { return [tt, aS.get()]; }), color: th.acc, width: 2.5, dot: true });
      [gx, gv, ga].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowUpdate();
      void t;
    }

    function renderMaths() {
      var p = params(), len = rec.t.length, t = rec.t[len - 1], x = rec.x[len - 1], v = rec.v[len - 1], s = x - p.x0;
      // every number that gets multiplied sits in brackets, the way you'd write it in an exam
      var B = function (v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; };
      K.tex(eqEls[0], "v = u + at = " + K.fmt(p.u, 1) + " + " + B(p.a) + B(t, 2) + " = \\mathbf{" + K.fmt(p.u + p.a * t, 2) + "}\\ \\text{m/s}");
      K.tex(eqEls[1], "s = ut + \\tfrac12 at^2 = " + B(p.u) + B(t, 2) + " + \\tfrac12" + B(p.a) + B(t, 2) + "^2 = \\mathbf{" + K.fmt(p.u * t + 0.5 * p.a * t * t, 2) + "}\\ \\text{m}");
      K.tex(eqEls[2], B(v, 2) + "^2 = " + B(p.u) + "^2 + 2" + B(p.a) + B(s, 2) + "\\;\\Rightarrow\\; \\mathbf{" + K.fmt(v * v, 1) + "} = \\mathbf{" + K.fmt(p.u * p.u + 2 * p.a * s, 1) + "}");
      setR("t", K.fmt(t, 2) + " s");
      setR("x", K.fmt(x, 2) + " m");
      setR("s", K.fmt(s, 2) + " m", "where it is vs start");
      setR("d", K.fmt(distance, 2) + " m", turn ? "≠ |s|: it turned!" : "path length");
      setR("v", K.fmt(v, 2) + " m/s");
      setR("a", K.fmt(p.a, 1) + " m/s²");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Three quantities, three colours. <b class=\"c-disp\">Position</b> $x$ is where the cart is. " +
      "<b class=\"c-vel\">Velocity</b> $v$ is how fast $x$ changes: the <i>slope</i> of the x–t graph. " +
      "<b class=\"c-acc\">Acceleration</b> $a$ is how fast $v$ changes: the slope of the v–t graph.</p>" +
      "<p>Going the other way, the <b>area under the v–t graph is the displacement</b> (it's shaded green), and the area under a–t is the change in velocity.</p>" +
      "<p>With constant $a$, three equations tie it together: $v = u + at$, $s = ut + \\tfrac12at^2$ and $v^2 = u^2 + 2as$. The engine never uses them. It just steps time forward, and the numbers still agree.</p>" +
      '<div class="trap"><b>JEE trap: distance ≠ displacement.</b> When the cart turns around, displacement $s$ can shrink back to zero while distance keeps growing. ' +
      "For distance, split the motion at $v = 0$ and add the two pieces.</div>");
    K.quiz(P.quiz, {
      q: "A car moving at 20 m/s brakes with a uniform deceleration of 5 m/s². How far does it travel before it stops?",
      options: ["20 m", "40 m", "80 m", "100 m"], answer: 1,
      explain: "Use $v^2 = u^2 + 2as$ with $v = 0$: $0 = 20^2 + 2(-5)s$, so $s = 40$ m. Try it: set $x_0 = 0$, $u = 20$, $a = -5$ (the <i>Hard brake</i> preset) and watch it stop on the 40 m mark."
    });

    var transportUI = K.transport(P, sim, { onReset: reset, onPlay: function () { if (ended) reset(); } });
    reset();

    return function destroy() { sim.destroy(); [gx, gv, ga].forEach(function (g) { g.destroy(); }); };
  }
})();
