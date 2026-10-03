/* EMI & AC, lab 1: a rod sliding on rails in a magnetic field, and a bar magnet pushed through a coil.
   The rod is stepped with the exact solution of m dv/dt = F - B²l²v/R; the coil uses the on-axis flux of a dipole. */
(function () {
  "use strict";
  var T_MAX = 20, X0 = 2, X_MIN = 0.4;        // rod: run length (s), start and end-stop positions (m)
  var A = 0.1;                                // coil radius (m)
  var X_START = -Math.sqrt(24) * A;           // magnet start: the flux there is exactly 1/125 of the centre value
  var CX = 520, CY = 140, SC = 600;           // coil scene: centre (px) and px per metre

  var lab = {
    id: "faraday", chapter: "emi", title: "Faraday's & Lenz's laws", short: "motional emf, Lenz, magnetic braking",
    lede: "Kick a metal rod along two rails in a magnetic field and it slows down with nothing touching it. Then push a magnet through a coil and watch the meter swing one way, then the other. Both are one law: $\\varepsilon = -N\\,d\\Phi/dt$.",
    tries: [
      { id: "brake", title: "Let magnetic braking stop the rod",
        text: "With no push ($F = 0$), kick the rod and let it run until it has lost 95% of its speed.",
        why: "The braking force $B^2l^2v/R$ shrinks as the rod slows, so $v$ falls exponentially: $v = v_0e^{-t/\\tau}$. Every joule of kinetic energy it loses turns up as heat in $R$." },
      { id: "terminal", title: "Reach terminal velocity",
        text: "Set a steady push $F$ and get the rod within 1% of the speed where the braking force balances it.",
        why: "It stops speeding up when $B^2l^2v/R = F$, so $v_t = FR/B^2l^2$. From then on all the work you do becomes heat: $Fv_t = I^2R$." },
      { id: "clockwise", title: "Make the current flow clockwise",
        text: "The default current runs anticlockwise. Make it go the other way.",
        why: "Lenz: the current always opposes the change in flux. Flip the field, or move the rod towards the resistor so the area shrinks, and the current reverses. The braking force still points against the motion." },
      { id: "flip", title: "See the emf change sign",
        text: "Push the magnet right through the coil and watch the emf go both ways.",
        why: "On the way in the flux grows, on the way out it falls, so $d\\Phi/dt$ and the emf flip sign. Right at the centre the flux is at its peak and the emf is momentarily zero." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 330, ppm = 110, origin = { x: 70, y: 255 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 0.5, gridMajor: 1, yLabels: false });
    sim.zoom = 1; sim.panX = 0;
    var mode = "rod";

    /* ---------- controls ---------- */
    var BS = K.slider({ label: "Field $B$", unit: "T", min: 0.1, max: 2, step: 0.1, value: 1, onInput: reset });
    var lS = K.slider({ label: "Rail separation $l$", unit: "m", min: 0.5, max: 2, step: 0.1, value: 1, onInput: reset });
    var RS = K.slider({ label: "Resistance $R$", unit: "Ω", min: 0.5, max: 5, step: 0.5, value: 2, onInput: reset });
    var mS = K.slider({ label: "Rod mass $m$", unit: "kg", min: 0.1, max: 2, step: 0.1, value: 0.5, onInput: reset });
    var vS = K.slider({ label: "Kick speed $v_0$", unit: "m/s", min: -8, max: 8, step: 0.5, value: 4, onInput: reset,
      hint: "Negative sends it towards the resistor. Or drag the rod and flick it." });
    var FS = K.slider({ label: "Steady push $F$", unit: "N", min: 0, max: 5, step: 0.1, value: 0, onInput: reset });
    var NS = K.slider({ label: "Turns $N$", min: 50, max: 500, step: 50, value: 200, onInput: reset });
    var PS = K.slider({ label: "Flux per turn at the centre $\\Phi_{max}$", unit: "mWb", min: 0.5, max: 5, step: 0.5, value: 2.5, onInput: reset });
    var RcS = K.slider({ label: "Circuit resistance $R$", unit: "Ω", min: 5, max: 50, step: 5, value: 10, onInput: reset });
    var uS = K.slider({ label: "Push speed $u$", unit: "m/s", min: 0.05, max: 0.5, step: 0.05, value: 0.2, onInput: reset,
      hint: "Or drag the magnet yourself, as fast or slow as you like." });
    var dir = -1, pol = 1, end = "through";    // dir: B out of the page (+1) or into it (-1); pol: N pole facing the coil

    P.controls.innerHTML = "<h3>Experiment</h3>";
    P.controls.appendChild(K.seg([{ label: "Sliding rod", value: "rod" }, { label: "Magnet & coil", value: "coil" }], "rod",
      function (v) { setMode(v); }, "Experiment"));
    var rodBox = K.h("<div></div>"), coilBox = K.h("<div></div>");
    rodBox.appendChild(K.h("<h3>Field and circuit</h3>"));
    [BS, lS, RS].forEach(function (s) { rodBox.appendChild(s.el); });
    var dirSeg = K.seg([{ label: "B into page ⊗", value: -1 }, { label: "B out of page ⊙", value: 1 }], -1, function (v) { dir = v; reset(); }, "Field direction");
    rodBox.appendChild(dirSeg);
    rodBox.appendChild(K.h("<h3>The rod</h3>"));
    [mS, vS, FS].forEach(function (s) { rodBox.appendChild(s.el); });
    coilBox.appendChild(K.h("<h3>Coil and magnet</h3>"));
    [NS, PS, RcS, uS].forEach(function (s) { coilBox.appendChild(s.el); });
    var polSeg = K.seg([{ label: "N pole leading", value: 1 }, { label: "S pole leading", value: -1 }], 1, function (v) { pol = v; reset(); }, "Magnet");
    var endSeg = K.seg([{ label: "Right through", value: "through" }, { label: "Stop at the centre", value: "centre" }], "through", function (v) { end = v; reset(); }, "Push");
    coilBox.appendChild(polSeg); coilBox.appendChild(endSeg);
    coilBox.hidden = true;
    P.controls.appendChild(rodBox); P.controls.appendChild(coilBox);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>field, flux</span><span class="c-acc"><i></i>emf</span><span class="c-ten"><i></i>current</span>' +
      '<span class="c-vel"><i></i>velocity</span><span class="c-fric"><i></i>braking force, heat</span><span class="c-app"><i></i>your push</span></div>'));

    function rodP() { return { B: BS.get(), l: lS.get(), R: RS.get(), m: mS.get(), v0: vS.get(), F: FS.get() }; }
    function coilP() { return { N: NS.get(), phi: PS.get() * 1e-3, R: RcS.get(), u: uS.get() }; }
    function kOf(p) { return p.B * p.B * p.l * p.l / p.R; }          // braking force per unit speed (N per m/s)
    // flux through one turn (Wb) with the magnet's centre at x, and its slope dΦ/dx
    function flux(x, p) { return pol * p.phi * Math.pow(1 + x * x / (A * A), -1.5); }
    function dflux(x, p) { return pol * p.phi * (-3 * x / (A * A)) * Math.pow(1 + x * x / (A * A), -2.5); }
    function endX() { return end === "centre" ? 0 : -X_START; }

    /* ---------- state ---------- */
    var rod, cs, rec, drag = { on: false, x: 0 }, panTarget = 0, dotPhase = 0;
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      drag.on = false;
      P.time.textContent = "t = 0.00 s";
      [g1, g2, g3].forEach(function (g) { g.o.xMax = 5; });
      if (mode === "rod") {
        var p = rodP(), k = kOf(p);
        rod = { x: X0, v: p.v0, v0: p.v0, heat: 0, work: 0, q: 0, ref: { t: 0, v: p.v0 }, dragged: false, done: false,
          gap: Math.abs(p.v0 - p.F / k), I: 0 };
        rod.I = p.B * p.l * rod.v / p.R;
        rec = { t: [0], v: [rod.v], I: [rod.I], H: [0], E: [0] };
        sim.panX = 0; panTarget = 0;
      } else {
        var c = coilP();
        cs = { x: X_START, v: 0, Q: 0, emf: 0, emfF: 0, phi0: flux(X_START, c), max: 0, min: 0, auto: false, done: false, crossed: false };
        rec = { t: [0], phi: [cs.phi0], emf: [0], emfF: [0], Q: [0] };
        sim.panX = 0; panTarget = 0;
      }
      theory(); update(true);
    }

    function setMode(m) {
      mode = m;
      P.controls.querySelectorAll(".seg")[0].querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === m)); });
      rodBox.hidden = m !== "rod"; coilBox.hidden = m !== "coil";
      sim.opts.grid = m === "rod";
      tOpts.playLabel = m === "rod" ? "Kick" : "Push magnet";
      buildPanels();
      reset();
    }

    /* ---------- physics ---------- */
    sim.on("before", function () { if (mode === "rod") stepRod(); else stepCoil(); });

    function stepRod() {
      var p = rodP(), k = kOf(p), dt = K.DT, v = rod.v, dx, heat;
      if (drag.on) {
        // the rod follows your hand; you supply whatever force that takes
        var xNew = Math.max(X_MIN, rod.x + (drag.x - rod.x) * 0.35), vNew = (xNew - rod.x) / dt;
        dx = xNew - rod.x;
        var vm = 0.5 * (v + vNew);
        heat = k * vm * vm * dt;
        rod.work += heat + 0.5 * p.m * (vNew * vNew - v * v);
        rod.v = vNew;
      } else {
        // exact step of m dv/dt = F - k v: v relaxes to v_t with time constant tau = m/k
        var tau = p.m / k, vt = p.F / k, d = v - vt, e = Math.exp(-dt / tau);
        dx = vt * dt + d * tau * (1 - e);
        heat = k * (vt * vt * dt + 2 * vt * d * tau * (1 - e) + d * d * tau / 2 * (1 - e * e));    // ∫ k v² dt over the step
        rod.work += p.F * dx;
        rod.v = vt + d * e;
        if (rod.x + dx < X_MIN) {                                // end stop by the resistor
          dx = X_MIN - rod.x; rod.v = 0; rod.done = true;
          K.flash(P.note, "Hit the end stop");
        }
      }
      rod.x += dx; rod.heat += heat;
      rod.q += p.B * p.l * dx / p.R;                             // ∫ I dt = Bl Δx / R
      rod.I = p.B * p.l * rod.v / p.R;
    }

    function stepCoil() {
      var c = coilP(), xOld = cs.x, xNew = xOld, stop = endX();
      if (drag.on) xNew = xOld + (drag.x - xOld) * 0.35;
      else if (cs.auto) xNew = Math.min(stop, xOld + c.u * K.DT);
      var f0 = flux(xOld, c), f1 = flux(xNew, c);
      cs.v = (xNew - xOld) / K.DT; cs.x = xNew;
      cs.emf = -c.N * (f1 - f0) / K.DT;                            // what a meter averages over the step: -N ΔΦ/Δt
      cs.emfF = -c.N * dflux(0.5 * (xOld + xNew), c) * cs.v;     // the formula -N (dΦ/dx) v
      cs.Q += cs.emf / c.R * K.DT;
      cs.max = Math.max(cs.max, cs.emf); cs.min = Math.min(cs.min, cs.emf);
      if (xOld < 0 && xNew >= 0) cs.crossed = true;
      if (cs.auto && !drag.on && xNew >= stop - 1e-12) cs.reached = true;
    }

    sim.on("step", function (t) {
      var stop = null;
      if (mode === "rod") {
        var p = rodP(), k = kOf(p), vt = p.F / k;
        rec.t.push(t); rec.v.push(rod.v); rec.I.push(rod.I); rec.H.push(rod.heat);
        rec.E.push(rod.work - 0.5 * p.m * (rod.v * rod.v - rod.v0 * rod.v0));
        if (!rod.dragged && p.F === 0 && Math.abs(rod.v0) >= 1 && Math.abs(rod.v) <= 0.05 * Math.abs(rod.v0)) tries.mark("brake");
        if (!rod.dragged && p.F > 0 && rod.gap > 0.1 * vt && Math.abs(rod.v - vt) <= 0.01 * vt) tries.mark("terminal");
        if (-dir * rod.I < -0.05) tries.mark("clockwise");
        panTarget = Math.max(0, sim.px(rod.x, 0).x - W * 0.6);
        if (rod.done) stop = "";
        else if (!drag.on && p.F === 0 && Math.abs(rod.v) < 1e-3) stop = "The rod has stopped: all its kinetic energy is now heat in R";
        else if (t >= T_MAX - 1e-9 || rod.x > 150) stop = "That's the end of the run. Reset to go again";
      } else {
        rec.t.push(t); rec.phi.push(flux(cs.x, coilP())); rec.emf.push(cs.emf); rec.emfF.push(cs.emfF); rec.Q.push(cs.Q);
        if (cs.crossed && cs.max > 0.01 && cs.min < -0.01) tries.mark("flip");
        if (cs.reached) { cs.reached = false; cs.auto = false; stop = "Charge through the circuit: " + K.fmt(Math.abs(cs.Q) * 1e3, 1) + " mC"; }
        else if (t >= 60) stop = "That's a minute. Reset to go again";
      }
      if (stop !== null) {
        sim.pause(); transportUI.render();
        if (mode === "rod") rod.done = true; else cs.done = true;
        if (stop) K.flash(P.note, stop, 3500);
      }
      update(stop !== null);
    });

    /* ---------- direct manipulation ---------- */
    sim.pointer({
      down: function (pt) {
        if (mode === "rod") {
          var l = lS.get();
          if (Math.abs(pt.m.x - rod.x) > 0.35 || pt.m.y < -0.4 || pt.m.y > l + 0.4) return false;
          if (rod.done) reset();
          rod.dragged = true;
        } else {
          if (Math.abs(pt.px - (CX + cs.x * SC)) > 60 || Math.abs(pt.py - CY) > 34) return false;
          if (cs.done) { var keep = cs.x; reset(); cs.x = keep; cs.phi0 = flux(keep, coilP()); rec.phi[0] = cs.phi0; }
          cs.auto = false;
        }
        drag.on = true; drag.x = mode === "rod" ? pt.m.x : cs.x;
        if (!sim.running) { sim.play(); transportUI.render(); }
        return true;
      },
      drag: function (pt) {
        drag.x = mode === "rod" ? Math.max(X_MIN, pt.m.x) : K.clamp((pt.px - CX) / SC, -0.55, 0.55);
      },
      up: function () {
        drag.on = false;
        if (mode === "rod") { rod.ref = { t: sim.time, v: rod.v }; theory(); }
      },
      hover: function (pt) {
        var near = mode === "rod" ? rod && Math.abs(pt.m.x - rod.x) < 0.35 && pt.m.y > -0.4 && pt.m.y < lS.get() + 0.4
          : cs && Math.abs(pt.px - (CX + cs.x * SC)) < 60 && Math.abs(pt.py - CY) < 34;
        P.canvas.style.cursor = near ? "grab" : "";
      }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      if (mode === "rod") {
        sim.panX += (panTarget - sim.panX) * 0.15;
        drawRodScene(ctx);
      } else { sim.panX = 0; drawCoilScene(ctx); }
    });
    sim.on("over", function (ctx) { if (mode === "rod") drawRodOver(ctx); else drawCoilOver(ctx); });

    function drawRodScene(ctx) {
      var p = rodP(), v = sim.view(), l = p.l;
      // the field: a symbol every 0.5 m
      ctx.fillStyle = K.alpha(th.grav, 0.06);
      var top = sim.px(0, l + 0.45).y, bot = sim.px(0, -0.45).y;
      ctx.fillRect(Math.max(v.x0, sim.px(0, 0).x - 40), top, v.x1, bot - top);
      ctx.strokeStyle = K.alpha(th.grav, 0.55); ctx.fillStyle = K.alpha(th.grav, 0.55); ctx.lineWidth = 1.5;
      var xs = Math.floor((v.x0 - origin.x) / ppm / 0.5) * 0.5;
      for (var xm = Math.max(-0.25, xs); xm <= (v.x1 - origin.x) / ppm; xm += 0.5) {
        for (var ym = -0.25; ym <= l + 0.3; ym += 0.5) {
          var q = sim.px(xm + 0.25, ym);
          if (dir < 0) {
            ctx.beginPath(); ctx.moveTo(q.x - 4, q.y - 4); ctx.lineTo(q.x + 4, q.y + 4); ctx.moveTo(q.x + 4, q.y - 4); ctx.lineTo(q.x - 4, q.y + 4); ctx.stroke();
          } else { ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      // rails and the resistor
      var a = sim.px(0, 0), b = sim.px(0, l);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 4; ctx.lineCap = "round";
      [0, l].forEach(function (ym) { var r = sim.px(0, ym); ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(v.x1 + 10, r.y); ctx.stroke(); });
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - (a.y - b.y) * 0.25);
      var n = 6, z0 = a.y - (a.y - b.y) * 0.25, zl = (a.y - b.y) * 0.5 / n;
      for (var i = 0; i < n; i++) ctx.lineTo(a.x + (i % 2 ? -9 : 9), z0 - zl * (i + 0.5));
      ctx.lineTo(a.x, z0 - zl * n); ctx.lineTo(b.x, b.y); ctx.stroke();
      K.label(ctx, "R = " + K.fmt(p.R, 1) + " Ω", a.x + 16, (a.y + b.y) / 2 + 6, th.ink, { align: "left", bg: true });
      // end stop
      var s = sim.px(X_MIN - 0.12, 0);
      ctx.fillStyle = th.muted; ctx.fillRect(s.x - 3, s.y - 10, 6, 20); ctx.fillRect(s.x - 3, sim.px(0, l).y - 10, 6, 20);
    }

    function loopPoint(sPos, x, l) {
      // anticlockwise round the circuit: bottom rail, up the rod, top rail, down through R
      if (sPos < x) return sim.px(sPos, 0);
      if (sPos < x + l) return sim.px(x, sPos - x);
      if (sPos < 2 * x + l) return sim.px(x - (sPos - x - l), l);
      return sim.px(0, l - (sPos - 2 * x - l));
    }

    function drawRodOver(ctx) {
      var p = rodP(), l = p.l, x = rod.x, Iccw = -dir * rod.I, per = 2 * (x + l);
      // current: dots flowing round the circuit
      dotPhase = (dotPhase + K.clamp(Iccw * 1.5, -4, 4) / 60 + per * 100) % per;
      if (Math.abs(Iccw) > 1e-3) {
        ctx.fillStyle = th.ten;
        for (var sPos = dotPhase % 0.4; sPos < per; sPos += 0.4) {
          var q = loopPoint(sPos, x, l);
          ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      // the rod
      var r0 = sim.px(x, -0.18), r1 = sim.px(x, l + 0.18);
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.fillRect(r0.x - 6, r1.y, 12, r0.y - r1.y); ctx.strokeRect(r0.x - 6, r1.y, 12, r0.y - r1.y);
      // induced field in the loop (Lenz), drawn where you can see it
      var vw = sim.view(), cxm = (Math.max(0, (vw.x0 - origin.x) / ppm) + x) / 2;
      if (Math.abs(Iccw) > 0.01 && x - cxm > 0.4) {
        var c = sim.px(cxm, l * 0.72), up = Iccw > 0;                 // anticlockwise current makes a field out of the page
        ctx.strokeStyle = th.grav; ctx.fillStyle = th.grav; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, Math.PI * 2); ctx.stroke();
        if (up) { ctx.beginPath(); ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(c.x - 6, c.y - 6); ctx.lineTo(c.x + 6, c.y + 6); ctx.moveTo(c.x + 6, c.y - 6); ctx.lineTo(c.x - 6, c.y + 6); ctx.stroke(); }
        K.label(ctx, "induced B", c.x, c.y - 16, th.grav, { bg: true });
        K.label(ctx, Iccw > 0 ? "I anticlockwise ↺" : "I clockwise ↻", c.x, sim.px(0, -0.12).y + 22, th.ten, { bg: true });
      }
      // arrows: velocity above, braking force and push at the rod's middle
      var mid = sim.px(x, l / 2), topY = sim.px(x, l + 0.18).y - 18, kF = kOf(p) * rod.v;
      if (Math.abs(rod.v) > 0.02) K.arrow(ctx, mid.x, topY, mid.x + rod.v * 16, topY, th.vel, { label: "v " + K.fmt(rod.v, 2) + " m/s", lx: rod.v > 0 ? 6 : -120 });
      if (Math.abs(kF) > 0.02) K.arrow(ctx, mid.x, mid.y + 12, mid.x - kF * 30, mid.y + 12, th.fric, { label: "F_B " + K.fmt(Math.abs(kF), 2) + " N", lx: kF > 0 ? -110 : 6 });
      if (p.F > 0 && !drag.on) K.arrow(ctx, mid.x, mid.y - 12, mid.x + p.F * 30, mid.y - 12, th.app, { label: "F " + K.fmt(p.F, 1) + " N" });
      if (drag.on) K.label(ctx, "your hand", mid.x, sim.px(x, -0.18).y + 22, th.app, { bg: true });
      // emf across the rod
      var e = p.B * p.l * rod.v;
      K.label(ctx, "ε = " + K.fmt(Math.abs(e), 2) + " V", mid.x + 12, sim.px(x, -0.18).y + 40, th.acc, { align: "left", bg: true });
    }

    function drawCoilScene(ctx) {
      var c = coilP(), f = flux(cs.x, c) / c.phi;                  // -1 .. 1
      // shading inside the coil shows the flux through it
      ctx.fillStyle = K.alpha(th.grav, 0.08 + 0.3 * Math.abs(f));
      ctx.beginPath(); ctx.ellipse(CX, CY, 32, A * SC - 2, 0, 0, Math.PI * 2); ctx.fill();
      // back halves of the turns
      ctx.strokeStyle = K.alpha(th.ten, 0.45); ctx.lineWidth = 3;
      for (var i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(CX - 24 + i * 8, CY, 9, A * SC, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke(); }
      // the axis
      ctx.strokeStyle = th.grid; ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, CY); ctx.lineTo(W - 40, CY); ctx.stroke(); ctx.setLineDash([]);
      // leads down to the meter
      var gy = 280;
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(CX - 24, CY + A * SC); ctx.lineTo(CX - 24, gy - 40); ctx.lineTo(CX - 60, gy - 40); ctx.lineTo(CX - 60, gy); ctx.lineTo(CX - 40, gy);
      ctx.moveTo(CX + 24, CY + A * SC); ctx.lineTo(CX + 24, gy - 40); ctx.lineTo(CX + 60, gy - 40); ctx.lineTo(CX + 60, gy); ctx.lineTo(CX + 40, gy); ctx.stroke();
      // centre-zero galvanometer
      var I = cs.emf / c.R, Ipk = 0.8587 * c.N * c.phi * c.u / A / c.R * 1.3, ang = K.clamp(I / Ipk, -1, 1) * 55 * K.DEG;
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(CX, gy, 38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = th.muted; ctx.lineWidth = 1;
      for (var k = -2; k <= 2; k++) { var a = (k * 27.5 - 90) * K.DEG; ctx.beginPath(); ctx.moveTo(CX + 26 * Math.cos(a), gy + 26 * Math.sin(a)); ctx.lineTo(CX + 32 * Math.cos(a), gy + 32 * Math.sin(a)); ctx.stroke(); }
      ctx.strokeStyle = th.fric; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(CX, gy + 10); ctx.lineTo(CX + 30 * Math.sin(ang), gy + 10 - 36 * Math.cos(ang)); ctx.stroke();
      K.label(ctx, "G", CX, gy + 30, th.muted);
      K.label(ctx, "I = " + K.fmt(I * 1e3, 1) + " mA", CX + 50, gy + 8, th.ten, { align: "left", bg: true });
      K.label(ctx, "R = " + K.fmt(c.R, 0) + " Ω", CX - 50, gy + 8, th.muted, { align: "right" });
      // start and stop marks
      [X_START, endX()].forEach(function (xm, j) {
        var px = CX + xm * SC;
        ctx.strokeStyle = th["grid-strong"]; ctx.beginPath(); ctx.moveTo(px, CY + 44); ctx.lineTo(px, CY + 54); ctx.stroke();
        K.label(ctx, j ? "stop" : "start", px, CY + 68, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      });
    }

    function drawCoilOver(ctx) {
      var c = coilP(), mx = CX + cs.x * SC, hw = 48, hh = 20;
      // the magnet: N red, S blue; the leading pole faces the coil (to the right)
      var right = pol > 0 ? "N" : "S", left = pol > 0 ? "S" : "N";
      ctx.fillStyle = right === "N" ? th.fric : th.disp; ctx.fillRect(mx, CY - hh, hw, 2 * hh);
      ctx.fillStyle = left === "N" ? th.fric : th.disp; ctx.fillRect(mx - hw, CY - hh, hw, 2 * hh);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.strokeRect(mx - hw, CY - hh, 2 * hw, 2 * hh);
      K.label(ctx, right, mx + hw / 2, CY + 9, "#fff", { font: "800 16px 'JetBrains Mono', monospace" });
      K.label(ctx, left, mx - hw / 2, CY + 9, "#fff", { font: "800 16px 'JetBrains Mono', monospace" });
      if (Math.abs(cs.v) > 1e-3) K.arrow(ctx, mx, CY - hh - 14, mx + K.clamp(cs.v, -1.5, 1.5) * 220, CY - hh - 14, th.vel, { label: "v " + K.fmt(cs.v, 2) + " m/s", lx: cs.v > 0 ? 6 : -110 });
      // front halves of the turns, over the magnet
      ctx.strokeStyle = th.ten; ctx.lineWidth = 3;
      for (var i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(CX - 24 + i * 8, CY, 9, A * SC, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
      // flux arrow through the coil
      var f = flux(cs.x, c);
      if (Math.abs(f) > 0.02 * c.phi) K.arrow(ctx, CX - 20 * Math.sign(f), CY + 40, CX + 22 * Math.sign(f), CY + 40, th.grav, { label: "Φ", lx: f > 0 ? 6 : -18 });
      // Lenz: the coil becomes a magnet that opposes the change
      if (Math.abs(cs.emf) > 1e-4) {
        var leftFace = cs.emf < 0 ? "N" : "S", rightFace = leftFace === "N" ? "S" : "N";
        K.label(ctx, leftFace, CX - 44, CY - A * SC - 6, leftFace === "N" ? th.fric : th.disp, { bg: true, font: "800 14px 'JetBrains Mono', monospace" });
        K.label(ctx, rightFace, CX + 44, CY - A * SC - 6, rightFace === "N" ? th.fric : th.disp, { bg: true, font: "800 14px 'JetBrains Mono', monospace" });
        // current on the front of the coil: down for positive emf, up for negative
        var yA = cs.emf > 0 ? CY - 30 : CY + 30;
        K.arrow(ctx, CX + 34, yA, CX + 34, yA + (cs.emf > 0 ? 60 : -60), th.ten, { label: "I", lx: 6 });
      }
      K.label(ctx, "ε = " + K.fmt(cs.emf, 3) + " V", CX + 130, CY - A * SC + 6, th.acc, { align: "left", bg: true });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>';
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".graph-cap");
    var g1 = new K.Graph(cv[0], { yLabel: "v (m/s)", xMax: 5, xAuto: true, color: th.vel });
    var g2 = new K.Graph(cv[1], { yLabel: "I (A)", xMax: 5, xAuto: true, color: th.ten });
    var g3 = new K.Graph(cv[2], { yLabel: "E (J)", xMax: 5, xAuto: true, yMin: 0, color: th.fric });

    function theory() {
      [g1, g2, g3].forEach(function (g) { g.clear(); });
      if (mode === "rod") {
        g1.o.yMin = g1.o.yMax = g2.o.yMin = g2.o.yMax = g3.o.yMax = undefined; g3.o.yMin = 0;
        var p = rodP(), k = kOf(p), tau = p.m / k, vt = p.F / k, r = rod.ref, vp = [], ip = [];
        if (rod.dragged && drag.on) return;
        for (var t = r.t; t <= Math.min(T_MAX, r.t + Math.max(6 * tau, 5)) + 1e-9; t += Math.max(0.02, tau / 40)) {
          var v = vt + (r.v - vt) * Math.exp(-(t - r.t) / tau);
          vp.push([t, v]); ip.push([t, p.B * p.l * v / p.R]);
        }
        g1.set("theory", { points: vp, color: th.vel, dash: [5, 5], width: 1.5 });
        g2.set("theory", { points: ip, color: th.ten, dash: [5, 5], width: 1.5 });
      } else {
        var c = coilP(), Qf = -c.N * (flux(endX(), c) - cs.phi0) / c.R * 1e3;
        g3.set("theory", { points: [[0, Qf], [60, Qf]], color: th.ten, dash: [5, 5], width: 1.5 });
        // fix the scales to the pass you're about to make, so small early values still read sensibly
        var pk = 0.8587 * c.N * c.phi * c.u / A;
        g1.o.yMin = Math.min(0, pol * c.phi * 1e3); g1.o.yMax = Math.max(0, pol * c.phi * 1e3);
        g2.o.yMin = -pk; g2.o.yMax = pk;
        g3.o.yMin = Math.min(0, Qf); g3.o.yMax = Math.max(0, Qf);
      }
    }

    function series(arr, scale) { return rec.t.map(function (t, i) { return [t, arr[i] * (scale || 1)]; }); }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      if (mode === "rod") {
        g1.set("sim", { points: series(rec.v), color: th.vel, width: 2.5, dot: true });
        g2.set("sim", { points: series(rec.I), color: th.ten, width: 2.5, dot: true });
        g3.set("E", { points: series(rec.E), color: th.disp, dash: [5, 5], width: 1.5 });
        g3.set("sim", { points: series(rec.H), color: th.fric, width: 2.5, dot: true, fill: K.alpha(th.fric, 0.12) });
      } else {
        g1.set("sim", { points: series(rec.phi, 1e3), color: th.grav, width: 2.5, dot: true });
        g2.set("theory", { points: series(rec.emfF), color: th.acc, dash: [5, 5], width: 1.5 });
        g2.set("sim", { points: series(rec.emf), color: th.acc, width: 2.5, dot: true });
        g3.set("sim", { points: series(rec.Q, 1e3), color: th.ten, width: 2.5, dot: true });
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    var eqEls, setR;
    function buildPanels() {
      var rodMode = mode === "rod";
      var labels = rodMode
        ? ["Motional emf: the rod sweeps out area", "Current, and the force it feels in the field", "Newton's 2nd law: the speed relaxes exponentially", "Energy: heat = work done + kinetic energy lost"]
        : ["Flux through one turn, magnet on the axis", "Faraday's law", "Ohm's law for the coil circuit", "Charge depends only on the change in flux"];
      P.eqs.innerHTML = labels.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = K.readout(P.readouts, rodMode ? [
        { id: "v", label: "speed v", cls: "c-vel" }, { id: "emf", label: "emf Blv", cls: "c-acc" }, { id: "I", label: "current", cls: "c-ten" },
        { id: "FB", label: "braking force", cls: "c-fric" }, { id: "tau", label: "time constant τ" }, { id: "H", label: "heat in R", cls: "c-fric" },
        { id: "q", label: "charge through R", cls: "c-ten" }, { id: "d", label: "distance moved", cls: "c-disp" }
      ] : [
        { id: "x", label: "magnet position x", cls: "c-disp" }, { id: "phi", label: "flux per turn Φ", cls: "c-grav" }, { id: "emf", label: "emf", cls: "c-acc" },
        { id: "I", label: "current", cls: "c-ten" }, { id: "Q", label: "charge so far", cls: "c-ten" }, { id: "face", label: "near face of the coil" }
      ]);
      if (rodMode) {
        caps[0].innerHTML = '<b class="c-vel">v–t</b> · exponential decay towards ' + K.md("$v_t = FR/B^2l^2$");
        caps[1].innerHTML = '<b class="c-ten">I–t</b> · ' + K.md("$I = Blv/R$") + ", so it follows the speed";
        caps[2].innerHTML = '<b class="c-fric">heat in R</b> (solid) vs <b class="c-disp">work − ΔKE</b> (dashed) · they match';
        g1.o.yLabel = "v (m/s)"; g1.o.color = th.vel; g2.o.yLabel = "I (A)"; g2.o.color = th.ten; g3.o.yLabel = "E (J)"; g3.o.color = th.fric; g3.o.yMin = 0;
      } else {
        caps[0].innerHTML = '<b class="c-grav">Φ–t</b> · flux through one turn, peaks as the magnet passes the centre';
        caps[1].innerHTML = '<b class="c-acc">ε–t</b> · ' + K.md("$-N\\,\\Delta\\Phi/\\Delta t$") + " (solid) vs " + K.md("$-N\\,\\frac{d\\Phi}{dx}v$") + " (dashed)";
        caps[2].innerHTML = '<b class="c-ten">charge Q–t</b> · ends at ' + K.md("$N\\Delta\\Phi/R$") + " (dashed), however fast you push";
        g1.o.yLabel = "Φ (mWb)"; g1.o.color = th.grav; g2.o.yLabel = "ε (V)"; g2.o.color = th.acc; g3.o.yLabel = "Q (mC)"; g3.o.color = th.ten; g3.o.yMin = undefined;
      }
    }

    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function renderMaths() {
      if (mode === "rod") {
        var p = rodP(), k = kOf(p), tau = p.m / k, vt = p.F / k, v = rod.v, e = p.B * p.l * v, I = e / p.R, t = sim.time;
        var keLost = 0.5 * p.m * (rod.v0 * rod.v0 - v * v), Iccw = -dir * I;
        var vf = vt + (rod.ref.v - vt) * Math.exp(-(t - rod.ref.t) / tau);
        K.tex(eqEls[0], "\\varepsilon = Blv = " + B(p.B) + B(p.l) + B(v, 2) + " = \\mathbf{" + K.fmt(e, 2) + "}\\ \\text{V}");
        K.tex(eqEls[1], "I = \\frac{\\varepsilon}{R} = \\mathbf{" + K.fmt(I, 2) + "}\\ \\text{A},\\quad F_B = \\frac{B^2l^2v}{R} = \\frac{" + B(p.B) + "^2" + B(p.l) + "^2" + B(v, 2) + "}{" + K.fmt(p.R, 1) + "} = \\mathbf{" + K.fmt(Math.abs(k * v), 2) + "}\\ \\text{N}");
        K.tex(eqEls[2], "\\tau = \\frac{mR}{B^2l^2} = " + K.fmt(tau, 2) + "\\ \\text{s},\\ v_t = \\frac{FR}{B^2l^2} = " + K.fmt(vt, 2) + "\\;\\Rightarrow\\; v = v_t + (v_0 - v_t)e^{-t/\\tau} = \\mathbf{" + (drag.on ? "\\text{(hand)}" : K.fmt(vf, 2)) + "}\\ \\text{m/s}");
        K.tex(eqEls[3], "H = W_F + \\tfrac12 m(v_0^2 - v^2) = " + K.fmt(rod.work, 2) + " + " + B(keLost, 2) + " = \\mathbf{" + K.fmt(rod.work + keLost, 2) + "}\\ \\text{J}");
        setR("v", K.fmt(v, 2) + " m/s", drag.on ? "your hand" : "formula " + K.fmt(vf, 2));
        setR("emf", K.fmt(Math.abs(e), 2) + " V");
        setR("I", K.fmt(Math.abs(I), 2) + " A", Math.abs(I) < 1e-3 ? "" : Iccw > 0 ? "anticlockwise" : "clockwise");
        setR("FB", K.fmt(Math.abs(k * v), 2) + " N", "against the motion");
        setR("tau", K.fmt(tau, 2) + " s", "mR/B²l²");
        setR("H", K.fmt(rod.heat, 2) + " J", "work + KE lost = " + K.fmt(rod.work + keLost, 2));
        setR("q", K.fmt(Math.abs(rod.q), 2) + " C", "Bl·d/R");
        setR("d", K.fmt(rod.x - X0, 2) + " m", p.F === 0 && !rod.dragged ? "formula v₀τ = " + K.fmt(rod.v0 * tau, 2) : "");
        P.hud.innerHTML = '<span class="c-acc">ε = ' + K.fmt(Math.abs(e), 2) + ' V</span><span class="c-ten">I = ' + K.fmt(Math.abs(I), 2) + " A</span>" +
          '<span class="c-fric">heat ' + K.fmt(rod.heat, 2) + " J</span>";
      } else {
        var c = coilP(), x = cs.x, phi = flux(x, c), u2 = 1 + x * x / (A * A), dQ = -c.N * (phi - cs.phi0) / c.R;
        K.tex(eqEls[0], "\\Phi = \\frac{\\Phi_{max}}{(1 + x^2/a^2)^{3/2}} = \\frac{" + K.fmt(pol * c.phi * 1e3, 1) + "}{(1 + " + B(x * 100, 1) + "^2/" + K.fmt(A * 100, 0) + "^2)^{3/2}} = \\mathbf{" + K.fmt(phi * 1e3, 3) + "}\\ \\text{mWb}");
        K.tex(eqEls[1], "\\varepsilon = -N\\frac{d\\Phi}{dt} = -N\\frac{d\\Phi}{dx}v = \\frac{3N\\Phi_{max}xv}{a^2(1 + x^2/a^2)^{5/2}} = \\mathbf{" + K.fmt(3 * c.N * pol * c.phi * x * cs.v / (A * A) / Math.pow(u2, 2.5), 3) + "}\\ \\text{V}");
        K.tex(eqEls[2], "I = \\frac{\\varepsilon}{R} = \\frac{" + K.fmt(cs.emf, 3) + "}{" + K.fmt(c.R, 0) + "} = \\mathbf{" + K.fmt(cs.emf / c.R * 1e3, 2) + "}\\ \\text{mA}");
        K.tex(eqEls[3], "Q = \\frac{N|\\Delta\\Phi|}{R} = \\frac{" + c.N + "\\times" + K.fmt(Math.abs(phi - cs.phi0) * 1e3, 3) + "\\times10^{-3}}{" + K.fmt(c.R, 0) + "} = \\mathbf{" + K.fmt(Math.abs(dQ) * 1e3, 1) + "}\\ \\text{mC}");
        setR("x", K.fmt(x * 100, 1) + " cm", "from the coil's centre");
        setR("phi", K.fmt(phi * 1e3, 3) + " mWb", "NΦ = " + K.fmt(c.N * phi * 1e3, 1) + " mWb");
        setR("emf", K.fmt(cs.emf, 3) + " V", "formula " + K.fmt(cs.emfF, 3));
        setR("I", K.fmt(cs.emf / c.R * 1e3, 2) + " mA");
        setR("Q", K.fmt(Math.abs(cs.Q) * 1e3, 1) + " mC", "N|ΔΦ|/R = " + K.fmt(Math.abs(dQ) * 1e3, 1));
        var lf = cs.emf < 0 ? "N" : "S", near = x < 0 ? lf : (lf === "N" ? "S" : "N");
        var magPole = (x < 0) === (pol > 0) ? "N" : "S";        // the magnet's pole nearest the coil
        setR("face", Math.abs(cs.emf) < 1e-4 ? "—" : near, Math.abs(cs.emf) < 1e-4 ? "no current" : near === magPole ? "repels the magnet" : "attracts the magnet");
        P.hud.innerHTML = '<span class="c-grav">Φ = ' + K.fmt(phi * 1e3, 2) + ' mWb</span><span class="c-acc">ε = ' + K.fmt(cs.emf, 3) + " V</span>";
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p><b class=\"c-grav\">Magnetic flux</b> $\\Phi = BA\\cos\\theta$ counts how much field passes through a loop. Change it by any means (move a rod so the loop grows, push a magnet in) and an <b class=\"c-acc\">emf</b> appears: $\\varepsilon = -N\\,d\\Phi/dt$. That's Faraday's law.</p>" +
      "<p>For the rod the area grows at $lv$ every second, so $\\varepsilon = Blv$. The <b class=\"c-ten\">current</b> $I = Blv/R$ then sits in the field and feels a force $BIl = B^2l^2v/R$, always against the motion. That is <b>Lenz's law</b> (the minus sign): the induced current fights the change that made it. If it helped instead, you'd get energy for free.</p>" +
      "<p>The energy books balance exactly: the kinetic energy lost plus any work you do comes out as heat $I^2R$. And the charge that flows is $Q = N\\Delta\\Phi/R$, set by how much the flux changes, not how fast.</p>" +
      '<div class="trap"><b>JEE trap: magnetic braking is not a constant deceleration.</b> The force is proportional to $v$, so $v = v_0e^{-t/\\tau}$ with $\\tau = mR/B^2l^2$. The rod never quite stops, yet it only goes a finite distance $v_0\\tau$. Using $v_0^2/2a$ with the starting deceleration gives half the right answer.</div>');

    function apply(s) {
      if (s.mode !== mode) setMode(s.mode);
      if (s.mode === "rod") {
        BS.set(s.B); lS.set(s.l); RS.set(s.R); mS.set(s.m); vS.set(s.v0); FS.set(s.F);
        dir = s.dir || -1;
        dirSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.value === dir)); });
      } else {
        NS.set(s.N); PS.set(s.phi); RcS.set(s.R); uS.set(s.u);
        pol = s.pol || 1; end = s.end || "through";
        polSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.value === pol)); });
        endSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === end)); });
      }
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "motional emf", setup: { mode: "rod", B: 0.4, l: 0.5, R: 1, m: 0.5, v0: 5, F: 0.2 }, watch: "Predict the emf, then press Kick: the push keeps it at 5 m/s",
        q: "A rod 0.5 m long slides at a steady 5 m/s on rails in a 0.4 T field perpendicular to the rails. What emf is induced across it?",
        options: ["1.0 V", "2.0 V", "0.2 V", "10 V"], answer: 0,
        explain: "$\\varepsilon = Blv = 0.4 \\times 0.5 \\times 5 = 1.0$ V. With $R = 1\\ \\Omega$ that's a current of 1 A, and holding the speed steady takes a push of $B^2l^2v/R = 0.2$ N, which is what the lab applies." },
      { level: "medium", tag: "charge from flux change", setup: { mode: "coil", N: 200, phi: 2.5, R: 10, u: 0.2, pol: 1, end: "centre" }, watch: "Predict Q, then push. Reset, change the speed and push again: compare the charge",
        q: "A magnet is pushed into a 200-turn coil (circuit resistance 10 Ω). The flux through each turn rises from 0.02 mWb to 2.50 mWb. How much charge flows round the circuit?",
        options: ["49.6 mC", "0.248 mC", "99.2 mC", "It depends on how fast you push"], answer: 0,
        hints: ["Current is $I = \\varepsilon/R$, so the charge is $Q = \\int I\\,dt = \\frac{1}{R}\\int \\varepsilon\\,dt$.", "$\\int \\varepsilon\\,dt = N\\int \\frac{d\\Phi}{dt}dt = N\\Delta\\Phi$. The time cancels."],
        explain: "$Q = N\\Delta\\Phi/R = 200 \\times 2.48 \\times 10^{-3}/10 = 0.0496$ C $= 49.6$ mC. Push faster and the current is bigger but flows for less time: the product stays the same. Forgetting $N$ gives 0.248 mC." },
      { level: "hard", tag: "magnetic braking", setup: { mode: "rod", B: 1, l: 0.5, R: 0.5, m: 0.2, v0: 6, F: 0 }, watch: "Predict both, then Kick and read the distance and charge when it stops",
        q: "A 0.2 kg rod on smooth horizontal rails 0.5 m apart, joined by a 0.5 Ω resistor, sits in a vertical 1 T field. It is given a speed of 6 m/s and left alone. How far does it slide, and how much charge passes through the resistor?",
        options: ["2.4 m and 2.4 C", "1.2 m and 1.2 C", "2.4 m and 4.8 C", "It never stops, so the distance is infinite"], answer: 0,
        hints: ["Write $m\\,dv/dt = -B^2l^2v/R$, then use $dv/dt = v\\,dv/dx$ to get $m\\,dv = -(B^2l^2/R)\\,dx$.", "Integrate from $v_0$ to 0 for the distance. For the charge, use $Q = \\Delta\\Phi/R = Bl\\,d/R$, or the impulse $\\int BIl\\,dt = mv_0$."],
        explain: "$m\\,dv = -(B^2l^2/R)\\,dx$ gives $d = mv_0R/B^2l^2 = 0.2 \\times 6 \\times 0.5/0.25 = 2.4$ m. The flux swept is $Bl\\,d = 1.2$ Wb, so $Q = 1.2/0.5 = 2.4$ C (check: $BlQ = mv_0 = 1.2$ N s). The speed decays forever, but the distance converges. Using a constant deceleration $v_0/\\tau$ gives the 1.2 m trap." }
    ], apply, P);

    var transportUI = null, tOpts = { playLabel: "Kick", onReset: reset, onPlay: function () {
      if (mode === "rod") { if (rod.done) reset(); }
      else { if (cs.done || cs.x >= endX() - 1e-9) reset(); cs.auto = true; }
    } };
    transportUI = K.transport(P, sim, tOpts);
    buildPanels();
    reset();

    if (location.hostname === "localhost") {
      window.__lab_faraday = { apply: apply, setMode: setMode, rod: function () { return rod; }, coil: function () { return cs; },
        flux: function (x) { return flux(x, coilP()); }, drag: drag, mark: tries };
    }

    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); };
  }
})();
