/* Laws of motion, lab 3: connected bodies. An Atwood machine and a block on a table pulled by a hanging mass. */
(function () {
  "use strict";
  var G = 9.8;

  var lab = {
    id: "pulleys", chapter: "laws", title: "Pulleys & tension", short: "connected bodies, Atwood machine",
    lede: "Hang two masses from one string. Write Newton's second law for each body separately, add them, and the string's tension falls out, never quite what you'd guess.",
    tries: [
      { id: "balance", title: "Balance the Atwood machine",
        text: "Make the two masses stay still.",
        why: "Equal masses mean zero net force on the system, so $a = 0$ and $T = mg$ on each side. Nudge it and it would drift at constant speed: balanced isn't the same as stopped." },
      { id: "tension", title: "Show the tension isn't the heavy block's weight",
        text: "Run the Atwood machine with unequal masses and compare $T$ with $m_1 g$ and $m_2 g$.",
        why: "If $T$ were $m_2 g$ the heavy block couldn't accelerate. It always sits in between: $m_1 g < T < m_2 g$, with $T = \\frac{2m_1m_2}{m_1+m_2}g$." },
      { id: "stuck", title: "Make the table block refuse to move",
        text: "On the table, hang a mass that can't overcome static friction.",
        why: "It holds while $m_2 g \\le \\mu_s m_1 g$. Then the tension is simply $m_2 g$, and static friction on the table matches it." },
      { id: "freefall", title: "Get close to free fall",
        text: "Make one Atwood mass at least 10× the other.",
        why: "As the light mass $\\to 0$, $a \\to g$ and $T \\to 2m_{light}g \\to 0$: the heavy block basically falls freely, dragging a feather." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 50, origin = { x: 100, y: 470 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: G, gridStep: 1, gridMajor: 5, yLabels: false });

    /* ---------- controls ---------- */
    var mode = "atwood";
    var m1S = K.slider({ label: "Mass $m_1$", unit: "kg", min: 0.5, max: 10, step: 0.5, value: 3, onInput: reset });
    var m2S = K.slider({ label: "Mass $m_2$", unit: "kg", min: 0.5, max: 10, step: 0.5, value: 5, onInput: reset });
    var msS = K.slider({ label: "Table $\\mu_s$", min: 0, max: 1, step: 0.05, value: 0.5, onInput: function (v) { if (mkS.get() > v) mkS.set(v); reset(); } });
    var mkS = K.slider({ label: "Table $\\mu_k$", min: 0, max: 1, step: 0.05, value: 0.3, onInput: function (v) { if (msS.get() < v) msS.set(v); reset(); } });
    P.controls.innerHTML = "<h3>Setup</h3>";
    P.controls.appendChild(K.seg([{ label: "Atwood machine", value: "atwood" }, { label: "Block on a table", value: "table" }], "atwood",
      function (v) { mode = v; m2S.set(v === "table" ? 2 : 5); friction.hidden = v !== "table"; reset(); }, "Setup"));
    P.controls.appendChild(K.h("<h3>Masses</h3>"));
    [m1S, m2S].forEach(function (s) { P.controls.appendChild(s.el); });
    var friction = K.h("<div><h3>Table friction</h3></div>");
    [msS, mkS].forEach(function (s) { friction.appendChild(s.el); });
    friction.hidden = true;
    P.controls.appendChild(friction);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>weight</span><span class="c-ten"><i></i>tension</span><span class="c-normal"><i></i>normal</span>' +
      '<span class="c-fric"><i></i>friction</span><span class="c-vel"><i></i>velocity</span></div>'));

    function params() { return { m1: m1S.get(), m2: m2S.get(), mus: msS.get(), muk: mkS.get() }; }
    // a: acceleration of the system (m2 falling is +), T: tension, stuck: table static friction holds
    function solve(p) {
      if (mode === "atwood") return { a: (p.m2 - p.m1) * G / (p.m1 + p.m2), T: 2 * p.m1 * p.m2 * G / (p.m1 + p.m2), stuck: false };
      if (p.m2 * G <= p.mus * p.m1 * G + 1e-9) return { a: 0, T: p.m2 * G, stuck: true, f: p.m2 * G };
      var a = (p.m2 - p.muk * p.m1) * G / (p.m1 + p.m2);
      return { a: a, T: p.m1 * (a + p.muk * G), stuck: false, f: p.muk * p.m1 * G };
    }

    /* ---------- world ---------- */
    var B1 = 1.2, B2 = 1.05;           // block sizes (m)
    var ATW = { pulley: { x: 8, y: 8.6 }, r: 0.9, y0: 4.2 };
    var TAB = { top: 5, edge: 12, pulley: { x: 12.3, y: 5.3 }, r: 0.3, x0: 3.5, hang0: 3.4 };
    var bodies = [], b1 = null, b2 = null, st, rec, runs = [];

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      bodies.forEach(function (b) { sim.remove(b); }); bodies = [];
      var p = params(), s = solve(p), opts = { frictionAir: 0, friction: 0, frictionStatic: 0, inertia: Infinity, isSensor: true };
      function add(b) { bodies.push(sim.add(b)); return b; }
      if (mode === "atwood") {
        var l = sim.px(ATW.pulley.x - ATW.r, ATW.y0), r = sim.px(ATW.pulley.x + ATW.r, ATW.y0);
        b1 = add(Matter.Bodies.rectangle(l.x, l.y, B1 * ppm, B1 * ppm, Object.assign({ plugin: { k: { draw: drawBox("m₁") } } }, opts)));
        b2 = add(Matter.Bodies.rectangle(r.x, r.y, B2 * ppm, B2 * ppm, Object.assign({ plugin: { k: { draw: drawBox("m₂") } } }, opts)));
        // start half a step behind so the motion matches the formulas exactly
        sim.setVel(b1, 0, 0, 0, s.a); sim.setVel(b2, 0, 0, 0, -s.a);
      } else {
        var tc = sim.px(TAB.edge / 2, TAB.top - 0.25);
        add(Matter.Bodies.rectangle(tc.x, tc.y, TAB.edge * ppm, 0.5 * ppm, { isStatic: true, friction: 0, plugin: { k: { hidden: true } } }));
        var c1 = sim.px(TAB.x0, TAB.top + B1 / 2), c2 = sim.px(TAB.pulley.x + TAB.r, TAB.hang0);
        b1 = add(Matter.Bodies.rectangle(c1.x, c1.y, B1 * ppm, B1 * ppm, Object.assign({}, opts, { isSensor: false, plugin: { k: { draw: drawBox("m₁") } } })));
        b2 = add(Matter.Bodies.rectangle(c2.x, c2.y, B2 * ppm, B2 * ppm, Object.assign({ plugin: { k: { draw: drawBox("m₂") } } }, opts)));
        if (!s.stuck) { sim.setVel(b1, 0, 0, s.a, 0); sim.setVel(b2, 0, 0, 0, -s.a); }
      }
      st = { s: s, v: 0, a: 0, heldFor: 0, aSum: 0, aN: 0, done: false, result: null };
      rec = { t: [0], v: [0] };
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }

    sim.on("before", function () {
      if (!b1) return;
      var p = params(), s = st.s;
      if (mode === "atwood") {
        sim.push(b1, 0, s.T / p.m1);                                  // string pulls each block up; gravity comes from the engine
        sim.push(b2, 0, s.T / p.m2);
      } else if (s.stuck) {
        Matter.Body.setVelocity(b1, { x: 0, y: b1.velocity.y });
        Matter.Body.setVelocity(b2, { x: 0, y: 0 });
        sim.push(b2, 0, G);                                           // tension m2 g holds it up
      } else {
        sim.push(b1, (s.T - s.f) / p.m1, 0);                          // tension minus kinetic friction
        sim.push(b2, 0, s.T / p.m2);
      }
    });

    // m2's downward speed (screen y points down), undoing the half-step start offset
    function speed() { return Matter.Body.getVelocity(b2).y * 60 / ppm + 0.5 * st.s.a * K.DT; }

    sim.on("step", function (t) {
      var p = params(), v = speed();
      st.a = (v - rec.v[rec.v.length - 1]) / K.DT; st.v = v;
      rec.t.push(t); rec.v.push(v);
      if (rec.t.length > 2) { st.aSum += st.a; st.aN++; }
      st.heldFor = Math.abs(st.s.a) < 1e-9 ? st.heldFor + K.DT : 0;
      var y1 = sim.posM(b1).y, y2 = sim.posM(b2).y, x1 = sim.posM(b1).x, why = null;
      if (st.heldFor >= 2) why = "held";
      else if (mode === "atwood") {
        if (y1 - B1 / 2 <= 0 || y2 - B2 / 2 <= 0) why = "floor";
        else if (y1 + B1 / 2 >= ATW.pulley.y - ATW.r - 0.3 || y2 + B2 / 2 >= ATW.pulley.y - ATW.r - 0.3) why = "pulley";
      } else {
        if (x1 + B1 / 2 >= TAB.edge - 0.2) why = "pulley";
        else if (y2 - B2 / 2 <= 0) why = "floor";
      }
      if (why) finish(why);
      update(!!why);
    });

    function finish(why) {
      if (st.done) return;
      st.done = true; sim.pause(); transportUI.render();
      var p = params(), aMeas = st.aN ? st.aSum / st.aN : 0;
      st.result = { a: aMeas, T: p.m2 * (G - aMeas) };                // tension from Newton's 2nd law on m2, using the measured a
      runs.push({ mode: mode, m1: p.m1, m2: p.m2, mus: p.mus, muk: p.muk, a: aMeas, T: st.result.T });
      if (runs.length > 40) runs.shift();
      K.flash(P.note, why === "held" ? "It doesn't move" : "a = " + K.fmt(aMeas, 2) + " m/s², T = " + K.fmt(st.result.T, 1) + " N");
      if (mode === "atwood") {
        if (why === "held" && p.m1 === p.m2) tries.mark("balance");
        if (p.m1 !== p.m2 && why !== "held") tries.mark("tension");
        if (Math.max(p.m1, p.m2) / Math.min(p.m1, p.m2) >= 10 && Math.abs(aMeas) >= 0.8 * G) tries.mark("freefall");
      } else if (why === "held" && st.s.stuck) tries.mark("stuck");
    }

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      sim.drawGround(ctx);
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      if (mode === "atwood") {
        var pc = sim.px(ATW.pulley.x, ATW.pulley.y), beam = sim.px(ATW.pulley.x, ATW.pulley.y + 1.2);
        ctx.fillStyle = th["ground-top"]; ctx.fillRect(beam.x - sim.u(90), beam.y - sim.u(8), sim.u(180), sim.u(10));
        ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(pc.x, pc.y); ctx.stroke();
        drawPulley(ctx, pc, ATW.r);
      } else {
        var t0 = sim.px(0, TAB.top), t1 = sim.px(TAB.edge, 0);
        ctx.fillStyle = th.bank; ctx.fillRect(t0.x, t0.y, t1.x - t0.x, sim.u(14));
        ctx.fillRect(t1.x - sim.u(16), t0.y, sim.u(10), t1.y - t0.y);
        ctx.fillRect(t0.x + sim.u(10), t0.y, sim.u(10), t1.y - t0.y);
        drawPulley(ctx, sim.px(TAB.pulley.x, TAB.pulley.y), TAB.r);
      }
      drawString(ctx);
    });
    function drawPulley(ctx, c, r) {
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5);
      ctx.beginPath(); ctx.arc(c.x, c.y, r * ppm, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(c.x, c.y, sim.u(3), 0, Math.PI * 2); ctx.fill();
    }
    function drawString(ctx) {
      if (!b1) return;
      ctx.strokeStyle = th.ten; ctx.lineWidth = sim.u(2);
      ctx.beginPath();
      if (mode === "atwood") {
        var pc = sim.px(ATW.pulley.x, ATW.pulley.y), R = ATW.r * ppm;
        ctx.moveTo(b1.position.x, b1.position.y - B1 * ppm / 2); ctx.lineTo(pc.x - R, pc.y);
        ctx.arc(pc.x, pc.y, R, Math.PI, 0);
        ctx.lineTo(b2.position.x, b2.position.y - B2 * ppm / 2);
      } else {
        var q = sim.px(TAB.pulley.x, TAB.pulley.y), r = TAB.r * ppm;
        ctx.moveTo(b1.position.x + B1 * ppm / 2, b1.position.y); ctx.lineTo(q.x, q.y - r);
        ctx.arc(q.x, q.y, r, -Math.PI / 2, 0);
        ctx.lineTo(b2.position.x, b2.position.y - B2 * ppm / 2);
      }
      ctx.stroke();
    }
    sim.on("over", function (ctx) {
      if (!b1) return;
      var p = params(), s = st.s, kpn = 1.1;
      if (mode === "atwood") {
        [[b1, p.m1, -1], [b2, p.m2, 1]].forEach(function (q) {
          var b = q[0].position, side = q[2];
          sim.force(ctx, b.x, b.y, 0, -q[1] * G, th.grav, (side < 0 ? "m₁g " : "m₂g ") + K.fmt(q[1] * G, 1) + " N", kpn, { lx: side < 0 ? -112 : 6, ly: 10 });
          sim.force(ctx, b.x + side * sim.u(0), b.y - B1 * ppm / 2, 0, s.T, th.ten, "T " + K.fmt(s.T, 1), kpn, { lx: side < 0 ? -70 : 6 });
        });
      } else {
        var a = b1.position, c = b2.position;
        sim.force(ctx, a.x, a.y, 0, -p.m1 * G, th.grav, "m₁g", kpn, { ly: 10, lx: -40 });
        sim.force(ctx, a.x, a.y, 0, p.m1 * G, th.normal, "N", kpn, { lx: -24 });
        sim.force(ctx, a.x + B1 * ppm / 2, a.y, s.T, 0, th.ten, "T " + K.fmt(s.T, 1), kpn, { ly: -10 });
        var fr = s.stuck ? s.T : s.f;
        if (fr > 0.01) sim.force(ctx, a.x, a.y + B1 * ppm / 2 - sim.u(3), -fr, 0, th.fric, "f " + K.fmt(fr, 1) + (s.stuck ? " (static)" : ""), kpn, { ly: 12, lx: -110 });
        sim.force(ctx, c.x, c.y, 0, -p.m2 * G, th.grav, "m₂g", kpn, { ly: 10 });
        sim.force(ctx, c.x, c.y - B2 * ppm / 2, 0, s.T, th.ten, "T", kpn);
      }
      if (Math.abs(st.v) > 0.02) {
        var ref = b2.position;
        K.arrow(ctx, ref.x + sim.u(44), ref.y, ref.x + sim.u(44), ref.y + st.v * sim.u(16), th.vel, { s: sim.u(1), label: "v " + K.fmt(Math.abs(st.v), 1) });
      }
    });
    function drawBox(name) {
      return function (ctx, b) {
        var s = (b === b1 ? B1 : B2) * ppm, x = b.position.x - s / 2, y = b.position.y - s / 2;
        ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
        ctx.fillRect(x, y, s, s); ctx.strokeRect(x, y, s, s);
        var p = params();
        K.label(ctx, name, b.position.x, b.position.y + sim.u(2), th.ink, { s: sim.u(1) });
        K.label(ctx, (b === b1 ? p.m1 : p.m2) + " kg", b.position.x, b.position.y + sim.u(16), th.muted, { s: sim.u(0.85) });
      };
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v–t</b> · both blocks share one speed: the string doesn\'t stretch</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">a vs m₂</b> · for your $m_1$; dots are your runs</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-ten">T vs m₂</b> · always below $m_2 g$ (grey) while $m_2$ falls</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gv = new K.Graph(cv[0], { yLabel: "v (m/s)", xMax: 1, xAuto: true, color: th.vel });
    var ga = new K.Graph(cv[1], { yLabel: "a (m/s²)", xLabel: "m₂ (kg)", xMax: 10, color: th.acc });
    var gt = new K.Graph(cv[2], { yLabel: "T (N)", xLabel: "m₂ (kg)", xMax: 10, yMin: 0, color: th.ten });

    function theory() {
      var p = params(), ap = [], tp = [], wp = [];
      for (var m2 = 0.5; m2 <= 10 + 1e-9; m2 += 0.05) {
        var s = solve({ m1: p.m1, m2: m2, mus: p.mus, muk: p.muk });
        ap.push([m2, s.a]); tp.push([m2, s.T]); wp.push([m2, m2 * G]);
      }
      ga.set("theory", { points: ap, color: th.acc, dash: [5, 5], width: 1.5 });
      gt.set("weight", { points: wp, color: K.alpha(th.muted, 0.6), width: 1.2 });
      gt.set("theory", { points: tp, color: th.ten, dash: [5, 5], width: 1.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params(), mine = runs.filter(function (r) { return r.mode === mode && r.m1 === p.m1 && (mode === "atwood" || (r.mus === p.mus && r.muk === p.muk)); });
      gv.set("sim", { points: rec.t.map(function (t, i) { return [t, rec.v[i]]; }), color: th.vel, width: 2.5, dot: true });
      ga.extra = function (ctx, X, Y) { dots(ctx, X, Y, mine.map(function (r) { return [r.m2, r.a]; }), th.acc); ring(ctx, X(p.m2), Y(st.s.a)); };
      gt.extra = function (ctx, X, Y) { dots(ctx, X, Y, mine.map(function (r) { return [r.m2, r.T]; }), th.ten); ring(ctx, X(p.m2), Y(st.s.T)); };
      [gv, ga, gt].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function dots(ctx, X, Y, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4.5, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Newton's 2nd law for m₁", "Newton's 2nd law for m₂", "Add them: the tension cancels", "Back-substitute for the tension"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "a", label: "acceleration", cls: "c-acc" }, { id: "T", label: "tension", cls: "c-ten" }, { id: "w1", label: "m₁g", cls: "c-grav" },
      { id: "w2", label: "m₂g", cls: "c-grav" }, { id: "v", label: "speed now", cls: "c-vel" }, { id: "f", label: "table friction", cls: "c-fric" }
    ]);
    function renderMaths() {
      var p = params(), s = st.s;
      if (mode === "atwood") {
        K.tex(eqEls[0], "T - m_1 g = m_1 a \\quad(\\uparrow)");
        K.tex(eqEls[1], "m_2 g - T = m_2 a \\quad(\\downarrow)");
        K.tex(eqEls[2], "a = \\frac{(m_2 - m_1)g}{m_1 + m_2} = \\frac{(" + p.m2 + " - " + p.m1 + ")(9.8)}{" + p.m1 + " + " + p.m2 + "} = \\mathbf{" + K.fmt(s.a, 2) + "}\\ \\text{m/s}^2");
        K.tex(eqEls[3], "T = \\frac{2m_1m_2 g}{m_1 + m_2} = \\frac{2(" + p.m1 + ")(" + p.m2 + ")(9.8)}{" + K.fmt(p.m1 + p.m2, 1) + "} = \\mathbf{" + K.fmt(s.T, 1) + "}\\ \\text{N}");
      } else {
        K.tex(eqEls[0], "T - f = m_1 a, \\quad f = " + (s.stuck ? "T \\text{ (static, it holds)}" : "\\mu_k m_1 g = " + K.fmt(s.f, 1) + "\\ \\text{N}"));
        K.tex(eqEls[1], "m_2 g - T = m_2 a \\quad(\\downarrow)");
        K.tex(eqEls[2], s.stuck
          ? "m_2 g = " + K.fmt(p.m2 * G, 1) + " \\le \\mu_s m_1 g = " + K.fmt(p.mus * p.m1 * G, 1) + "\\;\\Rightarrow\\; a = 0"
          : "a = \\frac{(m_2 - \\mu_k m_1)g}{m_1 + m_2} = \\frac{(" + p.m2 + " - " + K.fmt(p.muk * p.m1, 2) + ")(9.8)}{" + K.fmt(p.m1 + p.m2, 1) + "} = \\mathbf{" + K.fmt(s.a, 2) + "}\\ \\text{m/s}^2");
        K.tex(eqEls[3], s.stuck ? "T = m_2 g = \\mathbf{" + K.fmt(s.T, 1) + "}\\ \\text{N}" : "T = m_1(a + \\mu_k g) = \\mathbf{" + K.fmt(s.T, 1) + "}\\ \\text{N}");
      }
      var r = st.result;
      setR("a", r ? K.fmt(r.a, 2) + " m/s²" : K.fmt(s.a, 2) + " m/s²", r ? "measured · formula " + K.fmt(s.a, 2) : "formula");
      setR("T", r ? K.fmt(r.T, 1) + " N" : K.fmt(s.T, 1) + " N", r ? "from m₂(g − a) · formula " + K.fmt(s.T, 1) : "formula");
      setR("w1", K.fmt(p.m1 * G, 1) + " N"); setR("w2", K.fmt(p.m2 * G, 1) + " N");
      setR("v", K.fmt(Math.abs(st.v), 2) + " m/s");
      setR("f", mode === "table" ? K.fmt(s.stuck ? s.T : s.f, 1) + " N" : "—", mode === "table" ? (s.stuck ? "static" : "kinetic") : "no table");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>With connected bodies, <b>draw a free-body diagram for each block on its own</b> and write Newton's second law for each. The string ties them together: same speed, same $|a|$, and one <b class=\"c-ten\">tension $T$</b> all along it (for a light string over a smooth pulley).</p>" +
      "<p>Add the equations and $T$ cancels, leaving $a$. Put $a$ back into either one and you get $T$. That's the whole method, and it scales to any number of blocks.</p>" +
      "<p>On the table, check first whether it moves at all: if $m_2 g \\le \\mu_s m_1 g$, static friction holds and $T = m_2 g$.</p>" +
      '<div class="trap"><b>JEE trap: tension is not the hanging weight.</b> If the hanging block accelerates downward, $T < m_2 g$; that\'s the only way it can speed up. $T = m_2 g$ only when nothing accelerates.</div>');
    K.quiz(P.quiz, {
      q: "In an Atwood machine, masses of 3 kg and 5 kg hang over a light, frictionless pulley. Taking $g = 10$ m/s², what is the tension in the string?",
      options: ["30 N", "37.5 N", "40 N", "50 N"], answer: 1,
      explain: "$T = \\dfrac{2m_1m_2g}{m_1 + m_2} = \\dfrac{2 \\times 3 \\times 5 \\times 10}{8} = 37.5$ N. It lies between $m_1g = 30$ N and $m_2g = 50$ N, as it must. Here (with g = 9.8) set $m_1 = 3$, $m_2 = 5$ and you'll get 36.75 N."
    });

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    reset();

    return function destroy() { sim.destroy(); [gv, ga, gt].forEach(function (g) { g.destroy(); }); };
  }
})();
