/* Rotational motion, lab 1: a beam on a movable pivot. Hang masses, find the balance, then let go and watch it tip. */
(function () {
  "use strict";
  var G = 9.8, L = 4, HP = 0.45, BEAM_T = 0.08;     // beam length (m), pivot height above the floor (m), beam thickness (m)
  var NAMES = ["A", "B", "C"];

  var lab = {
    id: "torque", chapter: "rotation", title: "Torque & equilibrium", short: "moments, balance, centre of gravity",
    lede: "Hang masses on a beam and slide the pivot. What tips it isn't the heavier weight but the bigger turning effect: force × lever arm. Balance it, then let go of an unbalanced one and watch the pivot go light.",
    tries: [
      { id: "balance", title: "Balance two unequal masses",
        text: "Hang two different masses on opposite sides of the pivot and make the released beam stay level for 2 s.",
        why: "Balance needs $\\Sigma\\tau = 0$ about the pivot: $m_1 g\\,d_1 = m_2 g\\,d_2$. The heavier mass just sits closer. Force alone decides nothing; force times lever arm does." },
      { id: "cg", title: "Let the beam's own weight do the balancing",
        text: "Give the beam some mass, hang just one mass, and balance it with the pivot away from the middle.",
        why: "A uniform beam's weight acts at its centre, so it has a lever arm too. Everything balances when the pivot sits right under the centre of gravity of the whole lot: $x_{cg} = \\Sigma m x / \\Sigma m$." },
      { id: "lighter", title: "Make the lighter side go down",
        text: "With a massless beam (or the pivot in the middle), hang two masses on opposite sides and make the lighter one's end hit the floor.",
        why: "Put the lighter mass far out: $m_1 g\\,d_1$ can beat $m_2 g\\,d_2$ even when $m_1 < m_2$. Seesaws care about torque, not weight." },
      { id: "reaction", title: "Feel the pivot go light",
        text: "Release an unbalanced beam and compare the pivot force with the total weight.",
        why: "Just after release the centre of gravity accelerates downward, so $\\Sigma F = M a_{cm}$ means $R < W$. Only a beam in equilibrium has $R = W$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 460, ppm = 160, origin = { x: 180, y: 420 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: G, gridStep: 0.1, gridMajor: 1, yLabels: false });

    /* ---------- controls ---------- */
    var pS = K.slider({ label: "Pivot position $x_p$", unit: "m", min: 0.5, max: 3.5, step: 0.1, value: 2, onInput: changed,
      hint: "Or drag the pivot. Positions are measured from the beam's left end." });
    var MS = K.slider({ label: "Beam mass $M$ (uniform, 4 m)", unit: "kg", min: 0, max: 10, step: 0.5, value: 2, onInput: changed });
    var mSl = [], xSl = [];
    [[4, 0.8], [3, 3.4], [0, 2.6]].forEach(function (d, i) {
      mSl.push(K.slider({ label: "Mass " + NAMES[i], unit: "kg", min: 0, max: 10, step: 0.5, value: d[0], onInput: changed }));
      xSl.push(K.slider({ label: "Position of " + NAMES[i], unit: "m", min: 0, max: L, step: 0.1, value: d[1], onInput: changed }));
    });
    var show = { forces: true, arms: true };
    P.controls.innerHTML = "<h3>Beam and pivot</h3>";
    [pS, MS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Masses <small>drag them along the beam · 0 kg removes one</small></h3>"));
    for (var i = 0; i < 3; i++) { P.controls.appendChild(mSl[i].el); P.controls.appendChild(xSl[i].el); }
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Forces", true, function (v) { show.forces = v; }));
    row.appendChild(K.check("Lever arms", true, function (v) { show.arms = v; }));
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>weight</span><span class="c-normal"><i></i>pivot / floor force</span><span class="c-app"><i></i>torque</span>' +
      '<span class="c-disp"><i></i>lever arm</span></div>'));

    function params() {
      return { xp: pS.get(), M: MS.get(), ms: mSl.map(function (s) { return s.get(); }), xs: xSl.map(function (s) { return s.get(); }) };
    }
    // everything about the beam that doesn't depend on time (anticlockwise torque is +)
    function solve(p) {
      var Mt = p.M, mom = p.M * L / 2, tau = p.M * G * (p.xp - L / 2), I = p.M * L * L / 12 + p.M * sq(L / 2 - p.xp);
      p.ms.forEach(function (m, i) { Mt += m; mom += m * p.xs[i]; tau += m * G * (p.xp - p.xs[i]); I += m * sq(p.xs[i] - p.xp); });
      var xcg = Mt > 0 ? mom / Mt : L / 2, d = xcg - p.xp, balanced = Math.abs(tau) < 1e-6;
      var alpha = I > 1e-12 && !balanced ? tau / I : 0;
      return {
        xp: p.xp, Mt: Mt, mom: mom, tau: balanced ? 0 : tau, I: I, xcg: xcg, d: d, balanced: balanced, alpha: alpha,
        R0: Mt * (G + alpha * d),                                       // pivot force just after release: Mt(g + a_cm)
        thL: Math.asin(Math.min(1, HP / p.xp)), thR: Math.asin(Math.min(1, HP / (L - p.xp)))   // tilts at which an end touches the floor
      };
    }
    function sq(v) { return v * v; }

    /* ---------- the model: rigid beam turning about a fixed pin ---------- */
    var st, rec, runs = [];
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      st = { s: solve(params()), th: 0, w: 0, released: false, landed: null, after: 0, balFor: 0, alphaMeas: null, R: null, N: 0, done: false };
      rec = { t: [], th: [], R: [] };
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }
    function changed() { reset(); }

    function accel(a) { return st.s.I > 1e-12 ? st.s.tau * Math.cos(a) / st.s.I : 0; }   // every lever arm shrinks by cos(theta)
    sim.on("before", function () {
      if (!st.released || st.landed) return;
      var n = 20, h = K.DT / n, s = st.s;
      for (var k = 0; k < n; k++) {                                       // RK4 substeps
        var t0 = st.th, w0 = st.w;
        var k1t = w0, k1w = accel(t0);
        var k2t = w0 + h / 2 * k1w, k2w = accel(t0 + h / 2 * k1t);
        var k3t = w0 + h / 2 * k2w, k3w = accel(t0 + h / 2 * k2t);
        var k4t = w0 + h * k3w, k4w = accel(t0 + h * k3t);
        st.th += h / 6 * (k1t + 2 * k2t + 2 * k3t + k4t);
        st.w += h / 6 * (k1w + 2 * k2w + 2 * k3w + k4w);
        if (st.th >= s.thL) { land("left", s.thL); break; }
        if (st.th <= -s.thR) { land("right", -s.thR); break; }
      }
    });
    function land(side, a) {
      st.th = a; st.w = 0; st.landed = side;
      var r = reaction();
      K.flash(P.note, "The " + side + " end lands: the floor takes " + K.fmt(r.N, 1) + " N, the pivot " + K.fmt(r.R, 1) + " N");
      var p = params(), on = onBeam(p);
      if (on.length === 2 && (p.M === 0 || Math.abs(p.xp - L / 2) < 1e-9)) {
        var a1 = on[0], b1 = on[1];
        if ((p.xs[a1] - p.xp) * (p.xs[b1] - p.xp) < 0 && p.ms[a1] !== p.ms[b1]) {
          var light = p.ms[a1] < p.ms[b1] ? a1 : b1;
          if ((side === "left") === (p.xs[light] < p.xp)) tries.mark("lighter");
        }
      }
    }
    function onBeam(p) { var out = []; p.ms.forEach(function (m, i) { if (m > 0) out.push(i); }); return out; }

    // the pin's vertical push: Newton's 2nd law for the whole beam, or statics once an end rests on the floor
    function reaction() {
      var s = st.s;
      if (st.landed) {
        var xe = st.landed === "left" ? 0 : L, N = s.Mt * G * s.d / (xe - s.xp);
        return { R: s.Mt * G - N, N: N };
      }
      var al = accel(st.th), ay = s.d * (al * Math.cos(st.th) - st.w * st.w * Math.sin(st.th));
      return { R: s.Mt * (G + ay), N: 0 };
    }

    sim.on("step", function (t) {
      if (!st.released) return;
      var s = st.s, p = params(), r = reaction();
      if (sim.steps === 1) {
        st.alphaMeas = st.w / K.DT;                                       // measured from the first step's change in omega
        runs.push({ key: key(p), xp: p.xp, tau: st.alphaMeas * s.I });
        if (runs.length > 60) runs.shift();
        if (!s.balanced && Math.abs(s.tau) > 0.5 && st.R < s.Mt * G - 0.5) tries.mark("reaction");
      }
      st.R = r.R; st.N = r.N;
      rec.t.push(t); rec.th.push(st.th / K.DEG); rec.R.push(r.R);
      if (s.balanced && s.Mt > 0) {
        st.balFor += K.DT;
        if (st.balFor >= 2) {
          var on = onBeam(p), left = on.filter(function (i) { return p.xs[i] < p.xp; }), right = on.filter(function (i) { return p.xs[i] > p.xp; });
          var unequal = on.some(function (i) { return p.ms[i] !== p.ms[on[0]]; });
          if (left.length && right.length && unequal) tries.mark("balance");
          if (p.M > 0 && on.length === 1 && Math.abs(p.xp - L / 2) > 0.05) tries.mark("cg");
        }
      }
      if (st.landed) st.after += K.DT;
      if (st.after >= 1 || t >= 6 - 1e-9) {
        st.done = true; sim.pause(); transportUI.render();
        if (s.balanced) K.flash(P.note, "Balanced: Στ = 0 and ΣF = 0, so it just stays level");
      }
      update(st.done);
    });
    function key(p) { return [p.M].concat(p.ms, p.xs).join(","); }

    /* ---------- dragging the masses and the pivot ---------- */
    var dragging = null;
    function at(sB) { var c = Math.cos(st.th), s = Math.sin(st.th), xp = params().xp; return { x: xp + (sB - xp) * c, y: HP + (sB - xp) * s }; }
    sim.pointer({
      down: function (pt) {
        var p = params(), best = null, bd = 0.3;
        p.ms.forEach(function (m, i) {
          if (m <= 0) return;
          var q = at(p.xs[i]), dd = Math.hypot(pt.m.x - q.x, (pt.m.y - q.y) * 0.8);
          if (dd < bd) { bd = dd; best = i; }
        });
        if (best === null && Math.abs(pt.m.x - p.xp) < 0.25 && pt.m.y < HP + 0.1 && pt.m.y > -0.1) best = "pivot";
        if (best === null) return false;
        dragging = best;
        if (st.released) reset();
        P.canvas.style.cursor = "grabbing";
        return true;
      },
      drag: function (pt) {
        var x = Math.round(pt.m.x * 10) / 10;
        if (dragging === "pivot") pS.set(K.clamp(x, 0.5, 3.5));
        else xSl[dragging].set(K.clamp(x, 0, L));
        reset();
      },
      up: function () { dragging = null; P.canvas.style.cursor = ""; },
      hover: function (pt) {
        var p = params(), near = Math.abs(pt.m.x - p.xp) < 0.25 && pt.m.y < HP + 0.1 && pt.m.y > -0.1;
        p.ms.forEach(function (m, i) { var q = at(p.xs[i]); if (m > 0 && Math.hypot(pt.m.x - q.x, pt.m.y - q.y) < 0.3) near = true; });
        P.canvas.style.cursor = near ? "grab" : "";
      }
    });

    /* ---------- drawing ---------- */
    function size(m) { return 0.14 + 0.025 * m; }
    sim.on("under", function (ctx) {
      sim.drawGround(ctx);
      var p = params(), c = sim.px(p.xp, HP);
      // holding props before release
      if (!st.released) {
        ctx.save(); ctx.setLineDash([sim.u(4), sim.u(4)]); ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1.5);
        [0.15, L - 0.15].forEach(function (sB) {
          var a = sim.px(sB - 0.06, HP - BEAM_T / 2), b = sim.px(sB + 0.06, 0);
          ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
        });
        ctx.restore();
        K.label(ctx, "held level: press Release", sim.px(L / 2, 0).x, sim.px(0, 0).y + sim.u(34), th.muted, { s: sim.u(1) });
      }
      // pivot stand
      var bl = sim.px(p.xp - 0.17, 0), br = sim.px(p.xp + 0.17, 0);
      ctx.fillStyle = th.bank; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      // the beam and its riders turn together
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-st.th);
      var x0 = -p.xp * ppm, x1 = (L - p.xp) * ppm, hb = BEAM_T * ppm;
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.fillRect(x0, -hb / 2, x1 - x0, hb); ctx.strokeRect(x0, -hb / 2, x1 - x0, hb);
      ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1);
      for (var sB = 0.5; sB < L; sB += 0.5) { var tx = (sB - p.xp) * ppm; ctx.beginPath(); ctx.moveTo(tx, -hb / 2); ctx.lineTo(tx, hb / 2 * (sB % 1 ? 0 : 1)); ctx.stroke(); }
      p.ms.forEach(function (m, i) {
        if (m <= 0) return;
        var w = 0.2 * ppm, hgt = size(m) * ppm, mx = (p.xs[i] - p.xp) * ppm;
        ctx.fillStyle = dragging === i ? th.surface : th.body; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
        ctx.fillRect(mx - w / 2, -hgt / 2, w, hgt); ctx.strokeRect(mx - w / 2, -hgt / 2, w, hgt);
        K.label(ctx, NAMES[i] + " " + m + " kg", mx, -hgt / 2 - sim.u(2), th.ink, { s: sim.u(0.9) });
      });
      ctx.restore();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(c.x, c.y, sim.u(4.5), 0, Math.PI * 2); ctx.fill();
    });

    sim.on("over", function (ctx) {
      var p = params(), s = st.s, kpn = 0.5, c = sim.px(p.xp, HP);
      if (show.arms) {
        var lvl = 0;
        p.ms.forEach(function (m, i) {
          if (m <= 0 || Math.abs(p.xs[i] - p.xp) < 1e-9) return;
          var q = at(p.xs[i]), yb = HP + 0.62 + 0.13 * lvl++, a = sim.px(p.xp, yb), b = sim.px(q.x, yb), top = sim.px(q.x, q.y);
          ctx.save(); ctx.strokeStyle = K.alpha(th.disp, 0.8); ctx.lineWidth = sim.u(1.5);
          ctx.setLineDash([sim.u(3), sim.u(4)]);
          ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(top.x, top.y); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, c.y); ctx.stroke();
          ctx.setLineDash([]); ctx.lineWidth = sim.u(2);
          ctx.beginPath(); ctx.moveTo(a.x, b.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.restore();
          K.label(ctx, NAMES[i] + ": " + K.fmt(Math.abs(q.x - p.xp), 2) + " m", (a.x + b.x) / 2, b.y - sim.u(2), th.disp, { s: sim.u(0.85), bg: true });
        });
      }
      if (show.forces) {
        if (p.M > 0) { var bc = at(L / 2), bp = sim.px(bc.x, bc.y); sim.force(ctx, bp.x, bp.y, 0, -p.M * G, th.grav, "Mg " + K.fmt(p.M * G, 1) + " N", kpn, { lx: 6, ly: 12 }); }
        p.ms.forEach(function (m, i) {
          if (m <= 0) return;
          var q = at(p.xs[i]), qp = sim.px(q.x, q.y);
          sim.force(ctx, qp.x, qp.y + size(m) * ppm / 2, 0, -m * G, th.grav, K.fmt(m * G, 1) + " N", kpn, { lx: 6, ly: 10 });
        });
        var R = st.released ? st.R : s.balanced ? s.Mt * G : null;
        if (R !== null && R > 0.05) sim.force(ctx, c.x, c.y, 0, R, th.normal, "R " + K.fmt(R, 1) + " N", kpn, { lx: -100, ly: 0 });
        if (st.landed && st.N > 0.05) {
          var e = at(st.landed === "left" ? 0 : L), ep = sim.px(e.x, 0);
          sim.force(ctx, ep.x, ep.y, 0, st.N, th.normal, "N " + K.fmt(st.N, 1) + " N", kpn, { lx: st.landed === "left" ? -96 : 6 });
        }
      }
      // centre of gravity
      if (s.Mt > 0) {
        var g = at(s.xcg), gp = sim.px(g.x, g.y), r = sim.u(7);
        ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5);
        ctx.beginPath(); ctx.arc(gp.x, gp.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = th.ink;
        ctx.beginPath(); ctx.moveTo(gp.x, gp.y); ctx.arc(gp.x, gp.y, r, -Math.PI / 2, 0); ctx.lineTo(gp.x, gp.y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(gp.x, gp.y); ctx.arc(gp.x, gp.y, r, Math.PI / 2, Math.PI); ctx.lineTo(gp.x, gp.y); ctx.fill();
        K.label(ctx, "CG", gp.x, gp.y + sim.u(24), th.ink, { s: sim.u(0.9) });
      }
      // net torque about the pivot, as a curved arrow
      var rr = 0.3 * ppm;
      if (!s.balanced) {
        var ccw = s.tau > 0, a0 = -Math.PI / 6, a1 = -5 * Math.PI / 6;
        if (!ccw) { var tmp = a0; a0 = a1; a1 = tmp; }
        ctx.save(); ctx.strokeStyle = th.app; ctx.lineWidth = sim.u(3); ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(c.x, c.y - sim.u(10), rr, a0, a1, ccw); ctx.stroke(); ctx.restore();
        var ex = c.x + rr * Math.cos(a1), ey = c.y - sim.u(10) + rr * Math.sin(a1), tx = ccw ? Math.sin(a1) : -Math.sin(a1), ty = ccw ? -Math.cos(a1) : Math.cos(a1);
        K.arrow(ctx, ex - tx * sim.u(10), ey - ty * sim.u(10), ex + tx * sim.u(4), ey + ty * sim.u(4), th.app, { s: sim.u(1), width: 3, head: 11 });
        K.label(ctx, "Στ " + K.fmt(Math.abs(s.tau), 2) + " N·m " + (ccw ? "↺" : "↻"), c.x, c.y - rr - sim.u(16), th.app, { s: sim.u(1), bg: true });
      } else if (s.Mt > 0) {
        K.label(ctx, "Στ = 0", c.x, c.y - rr - sim.u(16), th.good, { s: sim.u(1), bg: true });
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">τ vs pivot position</b> · zero where the pivot sits under the CG; dots are your releases, measured as $I\\alpha$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">tilt θ–t</b> · starts off as $\\tfrac12\\alpha t^2$ (dashed), then an end hits the floor. + is anticlockwise</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-normal">pivot force R–t</b> · below the total weight (grey) while the beam swings</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (cp) { cp.innerHTML = K.md(cp.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gt = new K.Graph(cv[0], { yLabel: "τ (N·m)", xLabel: "pivot x (m)", xMax: L, color: th.app });
    var gth = new K.Graph(cv[1], { yLabel: "θ (°)", xMax: 1, xAuto: true, color: th.disp });
    var gR = new K.Graph(cv[2], { yLabel: "R (N)", xMax: 1, xAuto: true, yMin: 0, color: th.normal });

    function theory() {
      var p = params(), pts = [];
      for (var xp = 0; xp <= L + 1e-9; xp += 0.05) pts.push([xp, solve({ xp: xp, M: p.M, ms: p.ms, xs: p.xs }).tau]);
      gt.set("theory", { points: pts, color: th.app, dash: [5, 5], width: 1.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params(), s = st.s, k = key(p), tEnd = rec.t.length ? rec.t[rec.t.length - 1] : 0;
      var mine = runs.filter(function (r) { return r.key === k; });
      gt.extra = function (ctx, X, Y) {
        ctx.fillStyle = th.app; mine.forEach(function (r) { ctx.beginPath(); ctx.arc(X(r.xp), Y(r.tau), 4.5, 0, Math.PI * 2); ctx.fill(); });
        ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(p.xp), Y(s.tau), 6, 0, Math.PI * 2); ctx.stroke();
      };
      var tLand = null;
      if (st.landed) for (var i = 0; i < rec.th.length; i++) if (Math.abs(rec.th[i] - st.th / K.DEG) < 1e-9) { tLand = rec.t[i]; break; }
      var dash = [], tMax = tLand !== null ? tLand : tEnd;
      for (var tt = 0; tt <= tMax + 1e-9; tt += Math.max(tMax / 60, 0.005)) dash.push([tt, 0.5 * s.alpha * tt * tt / K.DEG]);
      gth.set("theory", { points: st.released ? dash : [], color: th.disp, dash: [5, 5], width: 1.5 });
      gth.set("sim", { points: rec.t.map(function (t, j) { return [t, rec.th[j]]; }), color: th.disp, width: 2.5, dot: true });
      gR.set("weight", { points: [[0, s.Mt * G], [Math.max(1, tEnd), s.Mt * G]], color: K.alpha(th.muted, 0.7), dash: [5, 5], width: 1.5 });
      gR.set("sim", { points: rec.t.map(function (t, j) { return [t, rec.R[j]]; }), color: th.normal, width: 2.5, dot: true });
      [gt, gth, gR].forEach(function (g) { g.dirty = true; g.draw(); });
      var dir = s.balanced ? "balanced" : s.tau > 0 ? "tips left ↺" : "tips right ↻";
      P.hud.innerHTML = "<span>Στ = " + K.fmt(s.tau, 2) + " N·m · " + dir + "</span><span>x_cg = " + K.fmt(s.xcg, 2) + " m</span>";
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Torque of each weight about the pivot (anticlockwise +)", "Centre of gravity: it balances only if the pivot is under it",
      "In equilibrium, ΣF = 0 gives the pivot force", "Let go: τ = Iα, then ΣF = M a_cm for the pivot force"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "tau", label: "net torque", cls: "c-app" }, { id: "cg", label: "centre of gravity", cls: "c-ink" },
      { id: "W", label: "total weight", cls: "c-grav" }, { id: "R", label: "pivot force", cls: "c-normal" },
      { id: "I", label: "I about the pivot" }, { id: "al", label: "α just after release", cls: "c-acc" }, { id: "th", label: "tilt", cls: "c-disp" }
    ]);
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function renderMaths() {
      var p = params(), s = st.s, terms = [], num = [], den = [], iTerms = [];
      if (p.M > 0) { terms.push(B(p.M) + "(9.8)" + B(p.xp - L / 2)); num.push(B(p.M) + "(2)"); den.push(K.fmt(p.M, 1)); }
      p.ms.forEach(function (m, i) {
        if (m <= 0) return;
        terms.push(B(m) + "(9.8)" + B(p.xp - p.xs[i])); num.push(B(m) + B(p.xs[i])); den.push(K.fmt(m, 1));
        iTerms.push(B(m) + B(p.xs[i] - p.xp) + "^2");
      });
      var dirTex = s.balanced ? "\\;(\\text{balanced})" : s.tau > 0 ? "\\;(\\circlearrowleft)" : "\\;(\\circlearrowright)";
      K.tex(eqEls[0], "\\tau = \\sum m g\\,(x_p - x) = " + (terms.length ? terms.join(" + ") : "0") + " = \\mathbf{" + K.fmt(s.tau, 2) + "}\\ \\text{N·m}" + dirTex);
      K.tex(eqEls[1], s.Mt > 0
        ? "x_{cg} = \\frac{\\sum m x}{\\sum m} = \\frac{" + num.join(" + ") + "}{" + den.join(" + ") + "} = \\mathbf{" + K.fmt(s.xcg, 2) + "}\\ \\text{m}\\quad (x_p = " + K.fmt(p.xp, 1) + "\\ \\text{m})"
        : "x_{cg}: \\text{ nothing on the beam}");
      K.tex(eqEls[2], "\\Sigma\\tau = 0,\\ \\Sigma F = 0:\\quad R = (M + \\Sigma m)\\,g = " + B(s.Mt) + "(9.8) = \\mathbf{" + K.fmt(s.Mt * G, 1) + "}\\ \\text{N}" +
        (s.balanced ? "" : "\\;\\text{(only if balanced)}"));
      var iTex = "I = \\tfrac{1}{12}ML^2 + M(\\tfrac L2 - x_p)^2 + \\Sigma m(x - x_p)^2 = \\mathbf{" + K.fmt(s.I, 2) + "}\\ \\text{kg·m}^2";
      var aTex = "\\alpha = \\frac{\\tau}{I} = \\frac{" + K.fmt(s.tau, 2) + "}{" + K.fmt(s.I, 2) + "} = \\mathbf{" + K.fmt(s.alpha, 2) + "}\\ \\text{rad/s}^2,\\quad R = M_{tot}(g + \\alpha d) = \\mathbf{" + K.fmt(s.R0, 1) + "}\\ \\text{N}";
      K.tex(eqEls[3], "\\begin{gathered}" + iTex + "\\\\ " + aTex + "\\end{gathered}");
      var dirW = s.balanced ? "balanced" : s.tau > 0 ? "anticlockwise: left end down" : "clockwise: right end down";
      setR("tau", K.fmt(s.tau, 2) + " N·m", dirW + (st.alphaMeas !== null ? " · measured Iα " + K.fmt(st.alphaMeas * s.I, 2) : ""));
      setR("cg", s.Mt > 0 ? K.fmt(s.xcg, 2) + " m" : "—", "pivot at " + K.fmt(p.xp, 2) + " m");
      setR("W", K.fmt(s.Mt * G, 1) + " N");
      if (st.landed) setR("R", K.fmt(st.R, 1) + " N", "end resting on the floor, which takes " + K.fmt(st.N, 1) + " N");
      else if (st.released && !s.balanced) setR("R", K.fmt(st.R, 1) + " N", "swinging · just after release (formula) " + K.fmt(s.R0, 1));
      else if (s.balanced) setR("R", K.fmt(s.Mt * G, 1) + " N", "balanced: R = W");
      else setR("R", K.fmt(s.R0, 1) + " N", "formula, just after you let go");
      setR("I", K.fmt(s.I, 2) + " kg·m²");
      setR("al", K.fmt(Math.abs(s.alpha), 2) + " rad/s²", (st.alphaMeas !== null ? "measured " + K.fmt(Math.abs(st.alphaMeas), 2) + " · " : "") + "formula τ/I");
      setR("th", K.fmt(st.th / K.DEG, 1) + "°", st.landed ? st.landed + " end on the floor" : "");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A force turns things as well as pushing them. Its turning effect about a pivot is the <b class=\"c-app\">torque</b> $\\tau = F\\,d$, where the <b class=\"c-disp\">lever arm</b> $d$ is the perpendicular distance from the pivot to the force's line of action. A small weight far out can beat a big one close in.</p>" +
      "<p>A body is in <b>equilibrium</b> only when both add to zero: $\\Sigma F = 0$ (it doesn't accelerate) and $\\Sigma\\tau = 0$ about any point (it doesn't start turning). For weights on a beam, $\\Sigma\\tau = 0$ about the pivot means the pivot sits right under the <b>centre of gravity</b>, the one point where all the weight seems to act.</p>" +
      "<p>Let go of an unbalanced beam and $\\tau = I\\alpha$ takes over. The centre of gravity starts to fall, so the pivot no longer has to hold up the full weight.</p>" +
      '<div class="trap"><b>JEE trap: the pivot force is the weight only in equilibrium.</b> The instant a hinged rod is released, its centre accelerates downward and $R = M(g - a_{cm}) < Mg$. For a uniform rod hinged at one end and released horizontal, $\\alpha = 3g/2L$, $a_{cm} = 3g/4$ and the hinge holds up just $Mg/4$.</div>');
    function apply(s) {
      pS.set(s.xp); MS.set(s.M);
      for (var j = 0; j < 3; j++) { mSl[j].set(s.ms[j]); xSl[j].set(s.xs[j]); }
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "seesaw balance", setup: { xp: 2, M: 0, ms: [6, 4, 0], xs: [1, 3, 2] }, watch: "Drag the 4 kg mass until Στ = 0, then press Release",
        q: "A light beam is pivoted at its middle. A 6 kg mass hangs 1.0 m to the left of the pivot. How far to the right of the pivot must a 4 kg mass go to balance it?",
        options: ["1.5 m", "0.67 m", "1.0 m", "2.5 m"], answer: 0,
        explain: "Take torques about the pivot: $6g \\times 1.0 = 4g \\times d$, so $d = 1.5$ m. The lighter mass needs the longer lever arm. 0.67 m is the ratio upside down." },
      { level: "medium", tag: "beam's own weight", setup: { xp: 2, M: 4, ms: [6, 0, 0], xs: [0, 2, 2] }, watch: "Slide the pivot until Στ = 0, then read the pivot force",
        q: "A uniform 4 m beam of mass 4 kg has a 6 kg mass at its left end. Where must the pivot go for it to balance, and what force does the pivot then carry ($g = 9.8$)?",
        options: ["0.8 m from the loaded end, 98 N", "1.33 m from the loaded end, 98 N", "0.8 m from the loaded end, 58.8 N", "2.0 m from the loaded end, 98 N"], answer: 0,
        hints: ["The beam's weight acts at its middle, 2 m from the loaded end. Its lever arm is measured from the pivot, not from the end.", "Then use $\\Sigma F = 0$ for the pivot force: it holds up everything."],
        explain: "With the pivot at $x$: $6g \\cdot x = 4g\\,(2 - x)$, so $x = 0.8$ m (the centre of gravity, $\\frac{4 \\times 2}{10}$). Nothing accelerates, so $R = (4 + 6)(9.8) = 98$ N. 1.33 m measures the beam's lever arm from the end; 58.8 N forgets the beam's own weight." },
      { level: "hard", tag: "hinge force on release", setup: { xp: 1, M: 8, ms: [0, 0, 0], xs: [0, 2, 4] }, watch: "Press Release and read α and R in the first instant",
        q: "A uniform beam (8 kg, 4 m) is pivoted on a smooth pin 1 m from one end, held horizontal and released. Just after release, what are its angular acceleration and the force on the pin ($g = 9.8$)?",
        options: ["4.2 rad/s², 44.8 N", "7.35 rad/s², 78.4 N", "4.2 rad/s², 78.4 N", "1.84 rad/s², 63.7 N"], answer: 0,
        hints: ["About the pin, $I = \\tfrac{1}{12}ML^2 + Md^2$ with $d = 1$ m, and the only torque is $Mg\\,d$.", "The centre falls with $a_{cm} = \\alpha d$, so $Mg - R = M\\alpha d$."],
        explain: "$I = \\tfrac{1}{12}(8)(16) + 8(1)^2 = 18.67$ kg·m², so $\\alpha = \\dfrac{8 \\times 9.8 \\times 1}{18.67} = 4.2$ rad/s². Then $a_{cm} = 4.2$ m/s² and $R = 8(9.8 - 4.2) = 44.8$ N, well below $Mg = 78.4$ N. 7.35 rad/s² uses $I$ about the centre (forgets the parallel-axis term); 1.84 rad/s² uses $I$ about the end." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset, onPlay: function () {
      if (st.done) reset();
      if (!st.released) { st.released = true; st.R = st.s.R0; rec.t.push(0); rec.th.push(0); rec.R.push(st.s.R0); }
    } });
    reset();
    if (location.hostname === "localhost") window.__lab_torque = { apply: apply, state: function () { return st; }, params: params, solve: solve };

    return function destroy() { sim.destroy(); [gt, gth, gR].forEach(function (g) { g.destroy(); }); };
  }
})();
