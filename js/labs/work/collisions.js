/* Work, energy & power, lab 3: collisions. Two carts on a smooth track meet through a soft bumper that
   loads stiffly and unloads more stiffly still (k₂ = k₁/e²), so they come apart at e times the closing speed.
   The bumper's motion is solved exactly, and the textbook results come out of it. A 2D billiards mode shows
   a glancing hit, where the impulse acts along the line of centres. */
(function () {
  "use strict";
  var TRACK = 18, T_LOAD = 0.06, BR = 0.5, TABLE_H = 5.6;

  var lab = {
    id: "collisions", chapter: "work", title: "Collisions & momentum", short: "p conserved, e, KE lost, 2D",
    lede: "Crash two carts together: bouncy, squashy or sticky. Momentum always survives the crash. Kinetic energy only sometimes does, and the coefficient of restitution decides how much.",
    tries: [
      { id: "swap", title: "Make the carts swap velocities",
        text: "Two equal masses, a perfectly elastic bumper ($e = 1$), any speeds.",
        why: "Equal masses and $e = 1$ give $v_1 = u_2$ and $v_2 = u_1$: they simply trade velocities. It's why the middle balls of a Newton's cradle stay still." },
      { id: "stick", title: "Make them stick together",
        text: "Set $e = 0$ and crash them.",
        why: "Perfectly inelastic: they leave together at $v_{cm} = \\frac{m_1u_1 + m_2u_2}{m_1 + m_2}$. That loses the most kinetic energy momentum allows, $\\tfrac12\\mu u_{rel}^2$, but not all of it." },
      { id: "stop", title: "Bring a moving cart to a dead stop",
        text: "Pick masses, speeds and $e$ so that a cart that was moving ends up at rest.",
        why: "A cart stops when it hands all its momentum over. With a target at rest that needs $m_1 = e\\,m_2$; for equal masses, a perfectly elastic hit." },
      { id: "ninety", title: "Glancing shot: paths at 90°",
        text: "In billiards mode, equal masses and $e = 1$, hit the target off-centre.",
        why: "Momentum gives $\\vec u = \\vec v_1 + \\vec v_2$ and energy gives $u^2 = v_1^2 + v_2^2$. That's Pythagoras: the two velocities form a right angle, whatever the aim." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 360, ppm = 54, origin = { x: 14, y: 320 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 1, gridMajor: 5, yLabels: false });
    var C1 = th.acc, C2 = th.normal;

    /* ---------- controls ---------- */
    var mode = "1d", cmFrame = false;
    var m1S = K.slider({ label: "Mass $m_1$", unit: "kg", min: 0.5, max: 10, step: 0.5, value: 2, onInput: reset });
    var m2S = K.slider({ label: "Mass $m_2$", unit: "kg", min: 0.5, max: 10, step: 0.5, value: 2, onInput: reset });
    var u1S = K.slider({ label: "Velocity $u_1$", unit: "m/s", min: -6, max: 6, step: 0.5, value: 4, onInput: reset, hint: "Or drag a cart's velocity arrow. Negative means moving left." });
    var u2S = K.slider({ label: "Velocity $u_2$", unit: "m/s", min: -6, max: 6, step: 0.5, value: 0, onInput: reset });
    var eS = K.slider({ label: "Coefficient of restitution $e$", min: 0, max: 1, step: 0.05, value: 1, onInput: reset,
      hint: "1 is perfectly elastic, 0 is perfectly inelastic (they stick)." });
    var bS = K.slider({ label: "Aim offset $b$", unit: "m", min: -0.95, max: 0.95, step: 0.05, value: 0.5, onInput: reset,
      hint: "Distance between the cue ball's path and the target's centre (ball radius 0.5 m). Or drag the cue ball." });
    P.controls.innerHTML = "<h3>Setup</h3>";
    var modeSeg = K.seg([{ label: "Carts on a track (1D)", value: "1d" }, { label: "Billiards (2D)", value: "2d" }], "1d",
      function (v) { mode = v; showGroups(); reset(); }, "Mode");
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h("<h3>Masses</h3>"));
    [m1S, m2S].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Velocities</h3>"));
    P.controls.appendChild(u1S.el);
    var g1d = K.h("<div></div>"), g2d = K.h("<div></div>");
    g1d.appendChild(u2S.el);
    var cmRow = K.h('<div class="row"></div>');
    cmRow.appendChild(K.check("Ride with the centre of mass", false, function (v) { cmFrame = v; }));
    g1d.appendChild(cmRow);
    g2d.appendChild(bS.el);
    P.controls.appendChild(g1d); P.controls.appendChild(g2d);
    P.controls.appendChild(K.h("<h3>The bump</h3>"));
    P.controls.appendChild(eS.el);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-acc"><i></i>body 1</span><span class="c-normal"><i></i>body 2</span><span class="c-disp"><i></i>momentum</span>' +
      '<span class="c-vel"><i></i>velocity, KE</span><span class="c-app"><i></i>contact force</span></div>'));
    function showGroups() { g1d.hidden = mode !== "1d"; g2d.hidden = mode !== "2d"; }
    showGroups();

    function params() { return { m1: m1S.get(), m2: m2S.get(), u1: u1S.get(), u2: mode === "1d" ? u2S.get() : 0, e: eS.get(), b: bS.get() }; }
    var p = params();
    function widthOf(m) { return 0.8 + 0.06 * m; }

    /* ---------- textbook answers ---------- */
    function formula1d(q) {
      var M = q.m1 + q.m2, P0 = q.m1 * q.u1 + q.m2 * q.u2, ur = q.u1 - q.u2;
      var v1 = (P0 - q.m2 * q.e * ur) / M, v2 = (P0 + q.m1 * q.e * ur) / M;
      var mu = q.m1 * q.m2 / M;
      return { v1: v1, v2: v2, vcm: P0 / M, P: P0, KE0: 0.5 * q.m1 * q.u1 * q.u1 + 0.5 * q.m2 * q.u2 * q.u2,
        KE1: 0.5 * q.m1 * v1 * v1 + 0.5 * q.m2 * v2 * v2, lost: 0.5 * mu * (1 - q.e * q.e) * ur * ur, J: mu * (1 + q.e) * ur, mu: mu };
    }
    // 2D: target at rest, impulse along the line of centres at angle phi below/above the cue's path
    function formula2d(q) {
      var phi = Math.asin(K.clamp(q.b / (2 * BR), -1, 1)), nx = Math.cos(phi), ny = Math.sin(phi);   // the cue sits b below the target, so n tilts up
      var mu = q.m1 * q.m2 / (q.m1 + q.m2), J = (1 + q.e) * mu * q.u1 * nx;
      var v1 = { x: q.u1 - J / q.m1 * nx, y: -J / q.m1 * ny }, v2 = { x: J / q.m2 * nx, y: J / q.m2 * ny };
      var s1 = Math.hypot(v1.x, v1.y), sep = s1 < 1e-9 ? NaN : Math.acos(K.clamp((v1.x * v2.x + v1.y * v2.y) / (s1 * Math.hypot(v2.x, v2.y)), -1, 1)) / K.DEG;
      return { phi: phi, J: J, v1: v1, v2: v2, sep: sep, KE0: 0.5 * q.m1 * q.u1 * q.u1,
        KE1: 0.5 * q.m1 * (v1.x * v1.x + v1.y * v1.y) + 0.5 * q.m2 * (v2.x * v2.x + v2.y * v2.y) };
    }

    /* ---------- 1D: the bumper, solved exactly ---------- */
    // overlap d: loading d = (w/W) sin(W t); unloading d = d0 + (dmax - d0) cos(W t / e), d0 = dmax (1 - e^2)
    var st, rec, runs = [];
    function plan1d() {
      var w1 = widthOf(p.m1), w2 = widthOf(p.m2), x1 = 4, x2 = 11, M = p.m1 + p.m2;
      var gap = x2 - w2 / 2 - (x1 + w1 / 2), w = p.u1 - p.u2, mu = p.m1 * p.m2 / M, Om = Math.PI / (2 * T_LOAD);
      return { w1: w1, w2: w2, x1: x1, x2: x2, M: M, xcm0: (p.m1 * x1 + p.m2 * x2) / M, vcm: (p.m1 * p.u1 + p.m2 * p.u2) / M,
        r0: x2 - x1, rc: (w1 + w2) / 2, w: w, mu: mu, Om: Om, k1: mu * Om * Om,
        tc: w > 0 ? gap / w : Infinity, dmax: w > 0 ? w / Om : 0 };
    }
    // overlap, its rate and the contact force at time t
    function contact(pl, t) {
      var tau = t - pl.tc, T1 = Math.PI / (2 * pl.Om);
      if (tau <= 0) return { d: 0, dd: 0, F: 0, phase: 0, E: 0 };
      if (tau <= T1) return { d: pl.dmax * Math.sin(pl.Om * tau), dd: pl.w * Math.cos(pl.Om * tau), F: pl.k1 * pl.dmax * Math.sin(pl.Om * tau), phase: 1, E: 0.5 * pl.k1 * Math.pow(pl.dmax * Math.sin(pl.Om * tau), 2) };
      if (p.e === 0) return { d: pl.dmax, dd: 0, F: 0, phase: 3, E: 0 };   // latched together
      var O2 = pl.Om / p.e, T2 = Math.PI / (2 * O2), d0 = pl.dmax * (1 - p.e * p.e), k2 = pl.k1 / (p.e * p.e), t2 = tau - T1;
      if (t2 <= T2) { var dx = (pl.dmax - d0) * Math.cos(O2 * t2); return { d: d0 + dx, dd: -(pl.dmax - d0) * O2 * Math.sin(O2 * t2), F: k2 * dx, phase: 2, E: 0.5 * k2 * dx * dx }; }
      return { d: d0, dd: -p.e * pl.w, F: 0, phase: 3, E: 0, after: t2 - T2 };
    }
    function state1d(t) {
      var pl = st.pl, c = contact(pl, t), xcm = pl.xcm0 + pl.vcm * t, r, rd;
      if (c.phase === 0) { r = pl.r0 - pl.w * t; rd = -pl.w; }
      else if (c.phase === 3 && c.after !== undefined) { r = pl.rc - c.d + p.e * pl.w * c.after; rd = p.e * pl.w; }
      else { r = pl.rc - c.d; rd = -c.dd; }
      return { x1: xcm - p.m2 / pl.M * r, x2: xcm + p.m1 / pl.M * r, v1: pl.vcm - p.m2 / pl.M * rd, v2: pl.vcm + p.m1 / pl.M * rd, F: c.F, Es: c.E, phase: c.phase, xcm: xcm };
    }

    /* ---------- 2D: event-driven billiards ---------- */
    function start2d() {
      return { b1: { x: 3, y: TABLE_H / 2 - p.b, vx: p.u1, vy: 0 }, b2: { x: 8, y: TABLE_H / 2, vx: 0, vy: 0 }, hit: false, path1: [], path2: [] };
    }
    function step2d(h, t0) {
      var a = st.b2d.b1, b = st.b2d.b2;
      if (!st.b2d.hit) {
        // when does the gap close to 2R within this step? (relative motion is a straight line)
        var rx = b.x - a.x, ry = b.y - a.y, vx = b.vx - a.vx, vy = b.vy - a.vy;
        var A = vx * vx + vy * vy, B = 2 * (rx * vx + ry * vy), C = rx * rx + ry * ry - 4 * BR * BR, disc = B * B - 4 * A * C;
        if (A > 0 && disc >= 0) {
          var tc = (-B - Math.sqrt(disc)) / (2 * A);
          if (tc >= 0 && tc <= h) {
            [a, b].forEach(function (q) { q.x += q.vx * tc; q.y += q.vy * tc; });
            var nx = b.x - a.x, ny = b.y - a.y, nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
            var un = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny, J = (1 + p.e) * p.m1 * p.m2 / (p.m1 + p.m2) * un;
            a.vx -= J / p.m1 * nx; a.vy -= J / p.m1 * ny; b.vx += J / p.m2 * nx; b.vy += J / p.m2 * ny;
            st.b2d.hit = true; st.J = J; st.tHit = t0 + tc;
            [a, b].forEach(function (q) { q.x += q.vx * (h - tc); q.y += q.vy * (h - tc); });
            onCollided();
            return;
          }
        }
      }
      [a, b].forEach(function (q) { q.x += q.vx * h; q.y += q.vy * h; });
    }

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      p = params();
      st = { done: false, collided: false, separated: false, result: null, J: 0 };
      if (mode === "1d") { st.pl = plan1d(); st.s = state1d(0); }
      else st.b2d = start2d();
      rec = { t: [0], p1: [], p2: [], px: [], py: [], KE: [], F: [0] };
      record();
      P.time.textContent = "t = 0.00 s";
      update(true);
    }
    function moms() {
      if (mode === "1d") return { p1: p.m1 * st.s.v1, p2: p.m2 * st.s.v2, KE: 0.5 * p.m1 * st.s.v1 * st.s.v1 + 0.5 * p.m2 * st.s.v2 * st.s.v2 };
      var a = st.b2d.b1, b = st.b2d.b2;
      return { p1: p.m1 * a.vx, p2: p.m2 * b.vx, px: p.m1 * a.vx + p.m2 * b.vx, py: p.m1 * a.vy + p.m2 * b.vy,
        KE: 0.5 * p.m1 * (a.vx * a.vx + a.vy * a.vy) + 0.5 * p.m2 * (b.vx * b.vx + b.vy * b.vy) };
    }
    function record() {
      var q = moms();
      rec.p1.push(q.p1); rec.p2.push(q.p2); rec.KE.push(q.KE);
      rec.px.push(mode === "1d" ? q.p1 + q.p2 : q.px); rec.py.push(mode === "1d" ? 0 : q.py);
      if (rec.F.length < rec.p1.length) rec.F.push(mode === "1d" ? st.s.F : 0);
    }

    sim.on("step", function (t) {
      if (st.done) return;
      if (mode === "1d") {
        var prev = st.s;
        st.s = state1d(t);
        if (st.s.phase > 0 && !st.collided) st.collided = true;
        // impulse: the bumper's force integrated over this step (Simpson's rule, 40 slices)
        for (var k = 0, sum = 0; k <= 40; k++) sum += (k === 0 || k === 40 ? 1 : k % 2 ? 4 : 2) * contact(st.pl, t - K.DT + k * K.DT / 40).F;
        st.J += sum * K.DT / 40 / 3;
        if (st.s.phase === 3 && !st.separated) { st.separated = true; onCollided(); }
        rec.t.push(t); rec.F.push(st.s.F); record();
        var pl = st.pl;
        if (st.s.x1 - pl.w1 / 2 <= 0 || st.s.x2 + pl.w2 / 2 >= TRACK || st.s.x1 + pl.w1 / 2 >= TRACK || st.s.x2 - pl.w2 / 2 <= 0) finish("end");
        else if (!isFinite(pl.tc) && t > 1) { finish("miss"); }
        else if (t > 15) finish("time");
        void prev;
      } else {
        for (var i = 0; i < 20; i++) step2d(K.DT / 20, t - K.DT + i * K.DT / 20);
        var a = st.b2d.b1, b = st.b2d.b2;
        if (sim.steps % 3 === 0) { st.b2d.path1.push([a.x, a.y]); st.b2d.path2.push([b.x, b.y]); }
        rec.t.push(t); rec.F.push(0); record();
        var out = function (q) { return q.x < BR || q.x > TRACK - BR || q.y < 0.3 + BR || q.y > 0.3 + TABLE_H - BR; };
        if (out(a) || out(b)) finish("edge");
        else if (t > 10) finish("time");
      }
      update(false);
    });

    function onCollided() {
      if (mode === "1d") {
        var s = st.s, f = formula1d(p);
        st.result = { v1: s.v1, v2: s.v2, KE: 0.5 * p.m1 * s.v1 * s.v1 + 0.5 * p.m2 * s.v2 * s.v2, J: st.J };
        if (p.m1 === p.m2 && p.e === 1 && Math.abs(s.v1 - p.u2) < 0.01 && Math.abs(s.v2 - p.u1) < 0.01) tries.mark("swap");
        if (p.e === 0) tries.mark("stick");
        if ((Math.abs(p.u1) > 0.5 && Math.abs(s.v1) < 0.01) || (Math.abs(p.u2) > 0.5 && Math.abs(s.v2) < 0.01)) tries.mark("stop");
        K.flash(P.note, "After: v₁ = " + K.fmt(s.v1, 2) + ", v₂ = " + K.fmt(s.v2, 2) + " m/s · KE lost " + K.fmt(f.KE0 - st.result.KE, 2) + " J");
      } else {
        var a = st.b2d.b1, b = st.b2d.b2, s1 = Math.hypot(a.vx, a.vy), s2 = Math.hypot(b.vx, b.vy);
        var sep = s1 < 1e-9 || s2 < 1e-9 ? NaN : Math.acos(K.clamp((a.vx * b.vx + a.vy * b.vy) / (s1 * s2), -1, 1)) / K.DEG;
        st.result = { v1: { x: a.vx, y: a.vy }, v2: { x: b.vx, y: b.vy }, sep: sep };
        runs.push({ b: p.b, sep: sep, m1: p.m1, m2: p.m2, e: p.e });
        if (runs.length > 30) runs.shift();
        if (p.m1 === p.m2 && p.e === 1 && Math.abs(p.b) >= 0.1 && Math.abs(sep - 90) < 0.5) tries.mark("ninety");
        K.flash(P.note, isFinite(sep) ? "The paths split by " + K.fmt(sep, 1) + "°" : "Head-on: the cue ball stops dead");
      }
    }

    function finish(why) {
      if (st.done) return;
      st.done = true; sim.pause(); transportUI.render();
      if (why === "miss") K.flash(P.note, "They never meet: cart 1 has to be catching up with cart 2");
      else if (why === "end" && !st.collided) K.flash(P.note, "End of the track before they met");
      update(true);
    }

    /* ---------- drawing ---------- */
    function shift() { return mode === "1d" && cmFrame ? st.s.xcm - st.pl.xcm0 : 0; }
    sim.on("under", function (ctx) {
      sim.drawGround(ctx);
      if (mode === "2d") {
        var a = sim.px(0, 0.3 + TABLE_H), b = sim.px(TRACK, 0.3);
        ctx.fillStyle = K.alpha(th.vel, 0.12); ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.strokeStyle = th.bank; ctx.lineWidth = sim.u(6); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        var pth = function (pts, col) {
          if (pts.length < 2) return;
          ctx.strokeStyle = K.alpha(col, 0.55); ctx.lineWidth = sim.u(2); ctx.setLineDash([sim.u(4), sim.u(4)]);
          ctx.beginPath(); pts.forEach(function (q, i) { var r = sim.px(q[0], q[1]); if (i) ctx.lineTo(r.x, r.y); else ctx.moveTo(r.x, r.y); }); ctx.stroke(); ctx.setLineDash([]);
        };
        pth(st.b2d.path1, C1); pth(st.b2d.path2, C2);
        // the cue's line and the target's centre line, to show the offset b
        var y1 = sim.px(0, TABLE_H / 2 - p.b).y, y2 = sim.px(0, TABLE_H / 2).y;
        ctx.strokeStyle = K.alpha(th.muted, 0.5); ctx.lineWidth = sim.u(1);
        ctx.beginPath(); ctx.moveTo(sim.px(1, 0).x, y1); ctx.lineTo(sim.px(8, 0).x, y1); ctx.moveTo(sim.px(1, 0).x, y2); ctx.lineTo(sim.px(8, 0).x, y2); ctx.stroke();
        if (Math.abs(p.b) > 0.05) K.label(ctx, "b = " + K.fmt(p.b, 2) + " m", sim.px(1.2, 0).x, Math.min(y1, y2) - sim.u(3), th.muted, { s: sim.u(0.85), align: "left" });
      } else {
        var t0 = sim.px(0, 0), t1 = sim.px(TRACK, 0);
        ctx.fillStyle = th.bank; ctx.fillRect(t0.x, t0.y - sim.u(4), t1.x - t0.x, sim.u(4));
      }
    });
    sim.on("over", function (ctx) {
      if (mode === "1d") {
        var s = st.s, pl = st.pl, sh = shift();
        drawCart(ctx, s.x1 - sh, pl.w1, C1, "m₁ " + K.fmt(p.m1, 1) + " kg", s.v1, true);
        drawCart(ctx, s.x2 - sh, pl.w2, C2, "m₂ " + K.fmt(p.m2, 1) + " kg", s.v2, false);
        // centre of mass marker
        var cm = sim.px(s.xcm - sh, 0);
        ctx.fillStyle = th.ink; ctx.beginPath(); ctx.moveTo(cm.x, cm.y - sim.u(2)); ctx.lineTo(cm.x - sim.u(7), cm.y + sim.u(11)); ctx.lineTo(cm.x + sim.u(7), cm.y + sim.u(11)); ctx.fill();
        K.label(ctx, "CM  v = " + K.fmt(pl.vcm, 2), cm.x, cm.y + sim.u(28), th.ink, { s: sim.u(0.85) });
        if (s.F > 0.5) {
          var mid = sim.px((s.x1 + pl.w1 / 2 + s.x2 - pl.w2 / 2) / 2 - sh, 0.9);
          K.label(ctx, "F = " + K.fmt(s.F, 0) + " N", mid.x, mid.y - sim.u(10), th.app, { s: sim.u(1), bg: true });
        }
        if (cmFrame) K.label(ctx, "seen from the centre of mass: total momentum is zero", sim.px(TRACK / 2, 0).x, sim.px(0, 3.6).y, th.muted, { s: sim.u(0.9) });
      } else {
        var a = st.b2d.b1, b = st.b2d.b2;
        drawBall(ctx, b, C2, "2"); drawBall(ctx, a, C1, "1");
        if (!sim.running && !st.b2d.hit && sim.steps === 0) K.label(ctx, "drag the cue ball up or down to aim", sim.px(a.x, a.y).x, sim.px(a.x, a.y + 0.9).y, th.muted, { s: sim.u(0.9) });
      }
    });
    function drawCart(ctx, x, w, col, name, v, left) {
      var hgt = 0.7, c = sim.px(x, hgt / 2 + 0.18), wp = w * ppm, hp = hgt * ppm;
      ctx.fillStyle = K.alpha(col, 0.25); ctx.strokeStyle = col; ctx.lineWidth = sim.u(2.5);
      ctx.fillRect(c.x - wp / 2, c.y - hp / 2, wp, hp); ctx.strokeRect(c.x - wp / 2, c.y - hp / 2, wp, hp);
      ctx.fillStyle = th.ink;
      [-0.3, 0.3].forEach(function (k) { ctx.beginPath(); ctx.arc(c.x + k * wp, c.y + hp / 2 + sim.u(4), sim.u(5), 0, Math.PI * 2); ctx.fill(); });
      K.label(ctx, name, c.x, c.y + sim.u(6), th.ink, { s: sim.u(0.8) });
      if (Math.abs(v) > 0.02) K.arrow(ctx, c.x, c.y - hp / 2 - sim.u(14), c.x + v * sim.u(14), c.y - hp / 2 - sim.u(14), th.vel, { s: sim.u(1), label: K.fmt(v, 2) + " m/s", lx: v < 0 ? -70 : 6, ly: -10 });
      void left;
    }
    function drawBall(ctx, q, col, name) {
      var c = sim.px(q.x, q.y), r = BR * ppm;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
      K.label(ctx, name, c.x, c.y + sim.u(7), "#fff", { s: sim.u(1) });
      var sp = Math.hypot(q.vx, q.vy);
      if (sp > 0.02) K.arrow(ctx, c.x, c.y, c.x + q.vx * sim.u(16), c.y - q.vy * sim.u(16), th.vel, { s: sim.u(1), label: K.fmt(sp, 2) + " m/s" });
    }

    // drag a cart sideways to set its velocity (1D), or the cue ball up/down to aim (2D)
    var drag = null;
    sim.pointer({
      down: function (pt) {
        if (sim.running || sim.steps > 0) return false;
        if (mode === "1d") {
          var s = st.s, y = pt.m.y;
          if (y > 2.2) return false;
          if (Math.abs(pt.m.x - s.x1) < st.pl.w1 / 2 + 0.6) { drag = 1; return true; }
          if (Math.abs(pt.m.x - s.x2) < st.pl.w2 / 2 + 0.6) { drag = 2; return true; }
          return false;
        }
        var a = st.b2d.b1;
        if (Math.hypot(pt.m.x - a.x, pt.m.y - a.y) < BR + 0.4) { drag = "cue"; return true; }
        return false;
      },
      drag: function (pt) {
        if (drag === 1 || drag === 2) {
          var xc = drag === 1 ? st.s.x1 : st.s.x2, v = K.clamp(Math.round((pt.m.x - xc) * ppm / 14 * 2) / 2, -6, 6);
          (drag === 1 ? u1S : u2S).set(v); reset();
        } else if (drag === "cue") { bS.set(K.clamp(Math.round((TABLE_H / 2 - pt.m.y) * 20) / 20, -0.95, 0.95)); reset(); }
      },
      up: function () { drag = null; }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">momentum vs t</b> · each body\'s changes; the total (black) doesn\'t</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">kinetic energy vs t</b> · dips in the bump; dashed is the textbook before and after</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>';
    var caps = P.graphs.querySelectorAll(".graph-cap");
    var cv = P.graphs.querySelectorAll("canvas");
    var gp = new K.Graph(cv[0], { yLabel: "p (kg m/s)", xMax: 2, xAuto: true, color: th.disp });
    var gk = new K.Graph(cv[1], { yLabel: "KE (J)", xMax: 2, xAuto: true, yMin: 0, color: th.vel });
    var g3 = new K.Graph(cv[2], { yLabel: "F (N)", xMax: 2, xAuto: true, yMin: 0, color: th.app });

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var pts = function (arr) { return rec.t.map(function (t, i) { return [t, arr[i]]; }); };
      var tEnd = Math.max(2, rec.t[rec.t.length - 1]);
      if (mode === "1d") {
        var f = formula1d(p), tc = st.pl.tc + T_LOAD;
        gp.set("p1", { points: pts(rec.p1), color: C1, width: 2 });
        gp.set("p2", { points: pts(rec.p2), color: C2, width: 2 });
        delete gp.series.py;
        gp.set("tot", { points: pts(rec.px), color: th.ink, width: 2.5, dot: true });
        gp.set("theory", { points: [[0, f.P], [tEnd, f.P]], color: th.disp, dash: [5, 5], width: 1.5 });
        var kd = isFinite(tc) && tc < tEnd ? [[0, f.KE0], [tc, f.KE0], [tc, f.KE1], [tEnd, f.KE1]] : [[0, f.KE0], [tEnd, f.KE0]];
        gk.set("theory", { points: kd, color: th.vel, dash: [5, 5], width: 1.5 });
        gk.set("sim", { points: pts(rec.KE), color: th.vel, width: 2.5, dot: true });
        caps[0].innerHTML = '<b class="c-disp">momentum vs t</b> · each body\'s changes; the total (black) doesn\'t';
        g3.o.xLabel = "t (s)"; g3.o.xAuto = true; g3.o.yLabel = "F (N)"; g3.o.xMax = 2; g3.o.yMin = 0;
        caps[2].innerHTML = K.md('<b class="c-app">contact force vs t</b> · the area is the impulse, $J = \\Delta p_2$');
        g3.series = {};
        g3.set("F", { points: pts(rec.F), color: th.app, width: 2.5, fill: K.alpha(th.app, 0.25) });
        g3.extra = null;
      } else {
        var f2 = formula2d(p), tc2 = st.tHit || ((8 - 3 - Math.sqrt(4 * BR * BR - p.b * p.b)) / Math.max(p.u1, 1e-9));
        gp.set("p1", { points: pts(rec.px), color: th.disp, width: 2.5, dot: true });
        gp.set("p2", { points: pts(rec.py), color: K.alpha(th.disp, 0.55), width: 2.5 });
        delete gp.series.tot;
        gp.set("theory", { points: [[0, p.m1 * p.u1], [tEnd, p.m1 * p.u1]], color: th.disp, dash: [5, 5], width: 1.5 });
        var kd2 = tc2 > 0 && tc2 < tEnd ? [[0, f2.KE0], [tc2, f2.KE0], [tc2, f2.KE1], [tEnd, f2.KE1]] : [[0, f2.KE0], [tEnd, f2.KE0]];
        gk.set("theory", { points: kd2, color: th.vel, dash: [5, 5], width: 1.5 });
        gk.set("sim", { points: pts(rec.KE), color: th.vel, width: 2.5, dot: true });
        caps[2].innerHTML = K.md('<b class="c-vel">angle between the paths vs $|b|$</b> · for your masses and $e$; dots are your shots');
        caps[0].innerHTML = '<b class="c-disp">total pₓ and p_y vs t</b> · both stay put through the hit (dashed: m₁u₁)';
        g3.series = {}; g3.o.xLabel = "|b| (m)"; g3.o.xAuto = false; g3.o.xMax = 1; g3.o.yLabel = "angle (°)"; g3.o.yMin = 0;
        var curve = [];
        for (var bb = 0.02; bb <= 0.98; bb += 0.02) { var fs = formula2d({ m1: p.m1, m2: p.m2, u1: Math.max(p.u1, 1), e: p.e, b: bb }); if (isFinite(fs.sep)) curve.push([bb, fs.sep]); }
        g3.set("theory", { points: curve, color: th.vel, dash: [5, 5], width: 1.5 });
        var mine = runs.filter(function (r) { return r.m1 === p.m1 && r.m2 === p.m2 && r.e === p.e && isFinite(r.sep); });
        g3.extra = function (ctx, X, Y) {
          ctx.fillStyle = th.vel;
          mine.forEach(function (r) { ctx.beginPath(); ctx.arc(X(Math.abs(r.b)), Y(r.sep), 4.5, 0, Math.PI * 2); ctx.fill(); });
          if (isFinite(f2.sep)) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(Math.abs(p.b)), Y(f2.sep), 6, 0, Math.PI * 2); ctx.stroke(); }
        };
      }
      gp.o.yLabel = mode === "1d" ? "p (kg m/s)" : "pₓ, p_y (kg m/s)";
      [gp, gk, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqLabels = P.eqs.querySelectorAll(".eq-label"), eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "v1", label: "v₁ after", cls: "c-acc" }, { id: "v2", label: "v₂ after", cls: "c-normal" },
      { id: "p", label: "total momentum", cls: "c-disp" }, { id: "lost", label: "KE lost", cls: "c-fric" },
      { id: "cm", label: "centre of mass v", cls: "" }, { id: "J", label: "impulse on body 2", cls: "c-app" }
    ]);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 1 : d); return v < 0 || s.charAt(0) === "-" ? "(" + s + ")" : s; }
    function renderMaths() {
      var r = st.result;
      if (mode === "1d") {
        var f = formula1d(p), M = p.m1 + p.m2;
        ["Momentum is conserved", "Restitution: separation = e × approach", "Solve the two together", "Kinetic energy lost"].forEach(function (l, i) { eqLabels[i].textContent = l; });
        K.tex(eqEls[0], "m_1u_1 + m_2u_2 = " + n(p.m1) + n(p.u1) + " + " + n(p.m2) + n(p.u2) + " = \\mathbf{" + K.fmt(f.P, 2) + "}\\ \\text{kg m/s} = m_1v_1 + m_2v_2");
        K.tex(eqEls[1], "v_2 - v_1 = e(u_1 - u_2) = " + n(p.e, 2) + n(p.u1 - p.u2) + " = \\mathbf{" + K.fmt(p.e * (p.u1 - p.u2), 2) + "}\\ \\text{m/s}");
        K.tex(eqEls[2], "v_1 = \\frac{m_1u_1 + m_2u_2 - m_2e(u_1 - u_2)}{m_1 + m_2} = \\mathbf{" + K.fmt(f.v1, 2) + "},\\ \\ v_2 = v_1 + e(u_1 - u_2) = \\mathbf{" + K.fmt(f.v2, 2) + "}\\ \\text{m/s}");
        K.tex(eqEls[3], "\\Delta K = \\tfrac12\\frac{m_1m_2}{m_1 + m_2}(1 - e^2)(u_1 - u_2)^2 = \\tfrac12(" + K.fmt(f.mu, 2) + ")(" + K.fmt(1 - p.e * p.e, 2) + ")" + n(p.u1 - p.u2) + "^2 = \\mathbf{" + K.fmt(f.lost, 2) + "}\\ \\text{J}");
        var hit = isFinite(st.pl.tc);
        setR("v1", r ? K.fmt(r.v1, 2) + " m/s" : "—", "formula " + (hit ? K.fmt(f.v1, 2) : "no hit"));
        setR("v2", r ? K.fmt(r.v2, 2) + " m/s" : "—", "formula " + (hit ? K.fmt(f.v2, 2) : "no hit"));
        var q = moms();
        setR("p", K.fmt(q.p1 + q.p2, 2) + " kg m/s", "before " + K.fmt(f.P, 2));
        setR("lost", r ? K.fmt(f.KE0 - r.KE, 2) + " J" : "—", "formula " + K.fmt(hit ? f.lost : 0, 2) + " J");
        setR("cm", K.fmt(f.vcm, 2) + " m/s", "never changes");
        setR("J", K.fmt(st.J, 2) + " N s", "formula μ(1 + e)u_rel = " + K.fmt(hit ? f.J : 0, 2));
        void M;
      } else {
        var g = formula2d(p), ph = g.phi / K.DEG;
        ["Line of centres at contact", "Impulse along the line of centres", "Momentum, both directions", "Angle between the paths"].forEach(function (l, i) { eqLabels[i].textContent = l; });
        K.tex(eqEls[0], "\\sin\\phi = \\frac{b}{2r} = \\frac{" + K.fmt(p.b, 2) + "}{1.0} \\Rightarrow \\phi = \\mathbf{" + K.fmt(ph, 1) + "^\\circ}");
        K.tex(eqEls[1], "J = (1 + e)\\frac{m_1m_2}{m_1 + m_2}u_1\\cos\\phi = (" + K.fmt(1 + p.e, 2) + ")(" + K.fmt(p.m1 * p.m2 / (p.m1 + p.m2), 2) + ")(" + K.fmt(p.u1, 1) + ")\\cos" + K.fmt(ph, 1) + "^\\circ = \\mathbf{" + K.fmt(g.J, 2) + "}\\ \\text{N s}");
        K.tex(eqEls[2], "p_x = m_1u_1 = \\mathbf{" + K.fmt(p.m1 * p.u1, 2) + "},\\quad p_y = 0 = m_1v_{1y} + m_2v_{2y}");
        K.tex(eqEls[3], "\\theta_1 + \\theta_2 = \\mathbf{" + K.fmt(g.sep, 1) + "^\\circ}" + (p.m1 === p.m2 && p.e === 1 && Math.abs(p.b) > 1e-9 ? "\\ \\ (\\text{equal masses, elastic: always } 90^\\circ)" : ""));
        var q2 = moms(), sp = function (v) { return K.fmt(Math.hypot(v.x, v.y), 2) + " m/s at " + K.fmt(Math.atan2(v.y, v.x) / K.DEG, 1) + "°"; };
        setR("v1", r ? sp(r.v1) : "—", "formula " + sp(g.v1));
        setR("v2", r ? sp(r.v2) : "—", "formula " + sp(g.v2));
        setR("p", "(" + K.fmt(q2.px, 2) + ", " + K.fmt(q2.py, 2) + ")", "before (" + K.fmt(p.m1 * p.u1, 2) + ", 0)");
        setR("lost", r ? K.fmt(g.KE0 - q2.KE, 2) + " J" : "—", "formula " + K.fmt(g.KE0 - g.KE1, 2) + " J");
        setR("cm", K.fmt(p.m1 * p.u1 / (p.m1 + p.m2), 2) + " m/s", "along x, never changes");
        setR("J", r ? K.fmt(st.J, 2) + " N s" : "—", "angle " + (r ? K.fmt(r.sep, 1) : "—") + "° · formula " + K.fmt(g.sep, 1) + "°");
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>In a collision the bodies push on each other equally and oppositely for the same short time, so the <b class=\"c-disp\">impulses</b> cancel: <b>total momentum is conserved</b>, whatever the bodies are made of. The contact force's F–t area is the impulse, $J = \\Delta p$.</p>" +
      "<p>Kinetic energy is another story. The <b>coefficient of restitution</b> $e = \\dfrac{v_2 - v_1}{u_1 - u_2}$ says how fast they separate compared with how fast they closed. $e = 1$ keeps all the kinetic energy; $e \lt 1$ loses $\\tfrac12\\mu(1 - e^2)u_{rel}^2$, with $\\mu = \\frac{m_1m_2}{m_1 + m_2}$.</p>" +
      "<p>The <b>centre of mass</b> sails through at $v_{cm}$, untouched. Ride along with it and the collision is symmetric: they approach, stop together, and leave $e$ times as fast.</p>" +
      '<div class="trap"><b>JEE trap: perfectly inelastic doesn\'t mean all the kinetic energy is lost.</b> $e = 0$ only kills the motion <i>relative to the centre of mass</i>. The $\\tfrac12 (m_1 + m_2) v_{cm}^2$ that belongs to the centre of mass can\'t be lost, because momentum has to be conserved.</div>');
    function apply(s) {
      mode = s.mode;
      modeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === mode)); });
      showGroups();
      m1S.set(s.m1); m2S.set(s.m2); u1S.set(s.u1); u2S.set(s.u2 || 0); eS.set(s.e);
      if (s.b != null) bS.set(s.b);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "they stick", setup: { mode: "1d", m1: 2, u1: 6, m2: 4, u2: 0, e: 0 }, watch: "Predict the final speed, then press Crash",
        q: "A 2 kg cart moving at 6 m/s runs into a 4 kg cart at rest, and they couple together. How fast do they move off?",
        options: ["2 m/s", "3 m/s", "6 m/s", "4 m/s"], answer: 0,
        explain: "Momentum: $2 \\times 6 = (2 + 4)v$, so $v = 2$ m/s. 3 m/s is what you'd get by averaging the speeds; momentum weighs them by mass." },
      { level: "medium", tag: "elastic, unequal masses", setup: { mode: "1d", m1: 1, u1: 4, m2: 3, u2: 0, e: 1 }, watch: "Predict v₁ after, then press Crash",
        q: "A 1 kg cart at 4 m/s hits a 3 kg cart at rest in a perfectly elastic collision. What is the 1 kg cart's velocity afterwards?",
        options: ["2 m/s backwards", "1 m/s forwards", "0", "4 m/s backwards"], answer: 0,
        hints: ["Use momentum and $v_2 - v_1 = e(u_1 - u_2)$ with $e = 1$: two linear equations, no squares needed.", "$v_1 + 3v_2 = 4$ and $v_2 - v_1 = 4$."],
        explain: "Adding gives $4v_2 = 8$, so $v_2 = 2$ m/s and $v_1 = -2$ m/s: it bounces back at 2 m/s. Check: KE before 8 J, after $2 + 6 = 8$ J. 1 m/s forwards is the stick-together answer." },
      { level: "hard", tag: "head-on, e = 0.5", setup: { mode: "1d", m1: 2, u1: 5, m2: 3, u2: -1, e: 0.5 }, watch: "Predict the KE lost, then press Crash",
        q: "A 2 kg cart moving right at 5 m/s collides head-on with a 3 kg cart moving left at 1 m/s. The coefficient of restitution is 0.5. How much kinetic energy is lost?",
        options: ["16.2 J", "21.6 J", "10.8 J", "5.4 J"], answer: 0,
        hints: ["The closing speed is $u_1 - u_2 = 5 - (-1) = 6$ m/s: mind the sign.", "$\\Delta K = \\tfrac12\\mu(1 - e^2)u_{rel}^2$ with $\\mu = \\frac{m_1m_2}{m_1 + m_2} = 1.2$ kg. Or find $v_1$ and $v_2$ and compare."],
        explain: "$\\Delta K = \\tfrac12(1.2)(1 - 0.25)(6)^2 = 16.2$ J. Directly: $v_{cm} = 1.4$ m/s, $v_1 = -0.4$ m/s, $v_2 = 2.6$ m/s, so KE goes from 26.5 J to 10.3 J. 21.6 J would be $e = 0$, 10.8 J uses $(1 - e)$, and 5.4 J uses $e^2$." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Crash", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    reset();
    if (location.hostname === "localhost") window.__lab_collisions = { apply: apply, st: function () { return st; }, formula1d: formula1d, formula2d: formula2d, moms: moms };

    return function destroy() {
      sim.destroy(); [gp, gk, g3].forEach(function (g) { g.destroy(); });
      if (window.__lab_collisions) delete window.__lab_collisions;
    };
  }
})();
