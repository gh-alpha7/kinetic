/* Electrostatics, lab 1: Coulomb's law and superposition. Drag point charges around; every pair pushes or pulls along the line joining them. */
(function () {
  "use strict";
  // Charges in μC, distances in m. F = k q1 q2 / r² with k = 9×10⁹ N m²/C² gives F = 9 q1 q2 / r² in mN.
  var FK = 9;
  var R_MIN = 0.12;                       // m: closer than this and the charges "touch"
  var SNAP = 0.05;                        // m: dragged charges snap to this grid

  var PRESETS = {
    pair: { charges: [{ x: 1.5, y: 1.6, q: 4 }, { x: 3.5, y: 1.6, q: -2 }], sel: 1, wire: false },
    line: { charges: [{ x: 1, y: 1.6, q: 4 }, { x: 4, y: 1.6, q: 1 }, { x: 2.2, y: 1.6, q: 1, free: true }], sel: 2, wire: true },
    triangle: { charges: [{ x: 2, y: 0.8, q: 3 }, { x: 4, y: 0.8, q: 3 }, { x: 3, y: 0.8 + Math.sqrt(3), q: -2, free: true }], sel: 2, wire: false },
    outside: { charges: [{ x: 1.5, y: 1.6, q: 4 }, { x: 3, y: 1.6, q: -1 }, { x: 5, y: 1.6, q: 1, free: true }], sel: 2, wire: true }
  };

  var lab = {
    id: "coulomb", chapter: "electrostatics", title: "Coulomb's law & superposition", short: "F = kq₁q₂/r², forces add as arrows",
    lede: "Drag charges around and watch every pair push or pull along the line joining them. Then find the one spot where a third charge feels nothing at all, and test whether it stays there.",
    tries: [
      { id: "inverse", title: "Double the distance, quarter the force",
        text: "Drag charge 1 or 2 so their separation doubles (say 1 m to 2 m) and compare $F_{12}$.",
        why: "$F \\propto 1/r^2$, so twice as far means a quarter of the force, and three times as far means a ninth. The F–r graph shows your dots sitting on that curve." },
      { id: "null", title: "Find the point of zero net force",
        text: "Place a third charge where the pushes and pulls from the other two cancel exactly.",
        why: "Two charges cancel where $\\dfrac{|q_1|}{r_1^2} = \\dfrac{|q_2|}{r_2^2}$. The third charge's own size and sign drop out, so every test charge balances at the same spot." },
      { id: "stable", title: "Make the balanced charge oscillate",
        text: "With like charges 1 and 2, put a free charge of the same sign on the wire just off the balance point and release it.",
        why: "Nudge it towards either charge and that charge pushes it back harder, so it oscillates. Along the line it's a spring with $k_{eff} = 2kq_3\\left(\\dfrac{q_1}{a^3} + \\dfrac{q_2}{b^3}\\right)$." },
      { id: "unstable", title: "Watch an equilibrium fall apart",
        text: "Flip the free charge's sign (or let it leave the wire) near the balance point and release it.",
        why: "A negative charge between two positives is still balanced, but nudge it and the nearer charge pulls harder, so it runs away. Off the wire even the positive one escapes sideways: no arrangement of fixed charges holds a charge stably in every direction (Earnshaw)." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 540, ppm = 150, origin = { x: 60, y: 500 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 0.1, gridMajor: 1, yLabels: false });
    var X_MIN = -0.3, X_MAX = (W - origin.x) / ppm - 0.1, Y_MIN = -0.2, Y_MAX = origin.y / ppm - 0.1;

    /* ---------- state ---------- */
    var charges = [], sel = -1, wire = true, home = null, run = null, samples = [], uid = 0;
    function posColor(q) { return q >= 0 ? th.fric : th.disp; }

    /* ---------- controls ---------- */
    var qS = K.slider({ label: "Selected charge $q$", unit: "μC", min: -10, max: 10, step: 0.5, value: 1,
      onInput: function (v) { if (charges[sel]) { charges[sel].q = v; edited(); } } });
    var mS = K.slider({ label: "Mass of free charges $m$", unit: "g", min: 1, max: 50, step: 1, value: 10, onInput: function () { edited(); } });
    P.controls.innerHTML = "<h3>Start from</h3>";
    var presetSeg = K.seg([{ label: "Two charges", value: "pair" }, { label: "Balance on a line", value: "line" },
      { label: "Triangle", value: "triangle" }, { label: "Outside", value: "outside" }], "line", function (v) { load(PRESETS[v]); }, "Preset");
    P.controls.appendChild(presetSeg);
    P.controls.appendChild(K.h("<h3>Selected charge</h3>"));
    P.controls.appendChild(qS.el);
    var pinBox = K.check("Pinned in place", true, function (v) { if (charges[sel]) { charges[sel].free = !v; edited(); } });
    var row = K.h('<div class="row"></div>');
    row.appendChild(pinBox);
    P.controls.appendChild(row);
    var btns = K.h('<div class="row"></div>');
    [["+ Positive", 2], ["+ Negative", -2], ["Remove", 0]].forEach(function (b) {
      var el = K.h('<button class="btn btn-sm" type="button">' + b[0] + "</button>");
      el.addEventListener("click", function () { if (b[1]) addCharge(b[1]); else removeSel(); });
      btns.appendChild(el);
    });
    P.controls.appendChild(btns);
    P.controls.appendChild(K.h("<h3>Released charges</h3>"));
    P.controls.appendChild(mS.el);
    var wireBox = K.check("On a smooth horizontal wire", true, function (v) { wire = v; edited(); });
    var row2 = K.h('<div class="row"></div>');
    row2.appendChild(wireBox);
    P.controls.appendChild(row2);
    P.controls.appendChild(K.h('<p class="control-hint">Drag a charge to move it, tap to select it. Unpinned charges move when you press Release.</p>'));
    P.controls.appendChild(K.h('<div class="legend"><span class="c-fric"><i></i>positive charge</span><span class="c-disp"><i></i>negative charge</span>' +
      '<span class="c-app"><i></i>force (net: thick)</span><span class="c-vel"><i></i>velocity</span></div>'));

    function load(pre) {
      sim.pause(); if (transportUI) transportUI.render();
      charges = pre.charges.map(function (c) { return { x: c.x, y: c.y, q: c.q, free: !!c.free, vx: 0, vy: 0, id: ++uid }; });
      sel = pre.sel; wire = pre.wire !== false;
      wireBox.querySelector("input").checked = wire;
      if (pre.m) mS.set(pre.m);
      home = null; run = null; samples = [];
      syncSel(); edited();
    }
    function syncSel() {
      var c = charges[sel];
      if (c) { qS.set(c.q); pinBox.querySelector("input").checked = !c.free; }
      qS.input.disabled = !c; pinBox.querySelector("input").disabled = !c;
    }
    function addCharge(q) {
      // drop it somewhere empty near the middle
      var spot = { x: 3, y: 2.6 };
      for (var k = 0; k < 40 && charges.some(function (c) { return Math.hypot(c.x - spot.x, c.y - spot.y) < 0.4; }); k++) spot = { x: 0.8 + (k * 0.55) % 5, y: 2.6 - Math.floor(k * 0.55 / 5) * 0.5 };
      charges.push({ x: spot.x, y: spot.y, q: q, free: false, vx: 0, vy: 0, id: ++uid });
      sel = charges.length - 1; stopRun(); syncSel(); edited();
    }
    function removeSel() {
      if (!charges[sel] || charges.length <= 1) return;
      charges.splice(sel, 1); sel = Math.min(sel, charges.length - 1); stopRun(); syncSel(); edited();
    }
    function stopRun() { sim.pause(); if (transportUI) transportUI.render(); run = null; home = null; charges.forEach(function (c) { c.vx = c.vy = 0; }); }

    /* ---------- physics ---------- */
    // force on charge a from charge b (mN), a position override lets us probe along the wire
    function pairF(a, b, ax, ay) {
      var dx = (ax === undefined ? a.x : ax) - b.x, dy = (ay === undefined ? a.y : ay) - b.y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
      var f = FK * a.q * b.q / r2;
      return { x: f * dx / r, y: f * dy / r, f: f, mag: Math.abs(f), r: r };
    }
    function netF(c, x, y) {
      var F = { x: 0, y: 0, max: 0 };
      charges.forEach(function (o) {
        if (o === c) return;
        var f = pairF(c, o, x, y); F.x += f.x; F.y += f.y; F.max = Math.max(F.max, f.mag);
      });
      F.mag = Math.hypot(F.x, F.y);
      return F;
    }
    // equilibrium along the horizontal line through c: the root of Fx nearest to c (null if none within 1.5 m)
    function equilibrium(c) {
      var fx = function (x) { return netF(c, x, c.y).x; };
      var ok = function (x) { return charges.every(function (o) { return o === c || Math.hypot(x - o.x, c.y - o.y) > 0.02; }); };
      var best = null, h = 0.005;
      [1, -1].forEach(function (dir) {
        var x0 = c.x, f0 = ok(x0) ? fx(x0) : NaN;
        for (var s = h; s <= 1.5 + 1e-9; s += h) {
          var x1 = c.x + dir * s;
          if (!ok(x1)) { x0 = x1; f0 = NaN; continue; }    // never bracket across a charge: that's an asymptote
          var f1 = fx(x1);
          if (isFinite(f0) && f0 * f1 <= 0) {
            var lo = x0, hi = x1, flo = f0;
            for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2, fm = fx(mid); if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } }
            var root = (lo + hi) / 2;
            if (Math.abs(fx(root)) < 1e-6 * netF(c, root, c.y).max && (best === null || Math.abs(root - c.x) < Math.abs(best - c.x))) best = root;
            return;
          }
          x0 = x1; f0 = f1;
        }
      });
      if (best === null) return null;
      var d = 1e-4, kAlong = -(fx(best + d) - fx(best - d)) / (2 * d) / 1000;      // N/m
      var fy = function (y) { return netF(c, best, y).y; };
      var kAcross = -(fy(c.y + d) - fy(c.y - d)) / (2 * d) / 1000;
      return { x: best, k: kAlong, kAcross: kAcross };
    }

    // two-charge null point on the line through charges 1 and 2 (the classic formula)
    function nullPoint() {
      if (charges.length < 2) return null;
      var a = charges[0], b = charges[1], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (!a.q || !b.q || d < 1e-9) return null;
      var ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, s;
      if (a.q * b.q > 0) s = d / (1 + Math.sqrt(b.q / a.q));                 // between them
      else {
        if (Math.abs(Math.abs(a.q) - Math.abs(b.q)) < 1e-9) return { none: true, d: d };
        var big = Math.abs(a.q) > Math.abs(b.q), ratio = Math.sqrt(Math.abs(big ? a.q / b.q : b.q / a.q));
        var out = d / (ratio - 1);                                           // beyond the smaller one
        s = big ? d + out : -out;
      }
      return { x: a.x + ux * s, y: a.y + uy * s, s: s, d: d, between: a.q * b.q > 0 };
    }

    // RK4 on every free charge together (fixed ones stay put), many substeps per frame
    function deriv(st) {
      var m = mS.get() / 1000;
      return st.map(function (s, i) {
        var c = s.c, F = { x: 0, y: 0 };
        charges.forEach(function (o) {
          if (o === c) return;
          var j = run.free.indexOf(o), ox = j === -1 ? o.x : st[j].x, oy = j === -1 ? o.y : st[j].y;
          var dx = s.x - ox, dy = s.y - oy, r2 = dx * dx + dy * dy, r = Math.sqrt(r2), f = FK * c.q * o.q / r2;
          F.x += f * dx / r; F.y += f * dy / r;
        });
        var ax = F.x / 1000 / m, ay = wire ? 0 : F.y / 1000 / m;
        void i;
        return { dx: s.vx, dy: wire ? 0 : s.vy, dvx: ax, dvy: ay };
      });
    }
    function rk4(h) {
      var s0 = run.free.map(function (c) { return { c: c, x: c.x, y: c.y, vx: c.vx, vy: wire ? 0 : c.vy }; });
      function add(s, k, f) { return s.map(function (q, i) { return { c: q.c, x: q.x + k[i].dx * f, y: q.y + k[i].dy * f, vx: q.vx + k[i].dvx * f, vy: q.vy + k[i].dvy * f }; }); }
      var k1 = deriv(s0), k2 = deriv(add(s0, k1, h / 2)), k3 = deriv(add(s0, k2, h / 2)), k4 = deriv(add(s0, k3, h));
      s0.forEach(function (q, i) {
        q.c.x = q.x + h / 6 * (k1[i].dx + 2 * k2[i].dx + 2 * k3[i].dx + k4[i].dx);
        q.c.y = q.y + h / 6 * (k1[i].dy + 2 * k2[i].dy + 2 * k3[i].dy + k4[i].dy);
        q.c.vx = q.vx + h / 6 * (k1[i].dvx + 2 * k2[i].dvx + 2 * k3[i].dvx + k4[i].dvx);
        q.c.vy = q.vy + h / 6 * (k1[i].dvy + 2 * k2[i].dvy + 2 * k3[i].dvy + k4[i].dvy);
      });
    }

    function startRun() {
      var free = charges.filter(function (c) { return c.free; });
      if (!free.length) return false;
      home = charges.map(function (c) { return { x: c.x, y: c.y, q: c.q, free: c.free, id: c.id }; });
      var lead = charges[sel] && charges[sel].free ? charges[sel] : free[0];
      var eq = equilibrium(lead);
      run = { free: free, lead: lead, x0: lead.x, eq: eq, t: [0], x: [lead.x], turns: [], prevVx: 0, done: false, why: null, maxDev: 0 };
      return true;
    }
    sim.on("before", function () {
      if (!run) { if (!startRun()) { sim.pause(); transportUI.render(); K.flash(P.note, "Unpin a charge first: select it and untick Pinned"); return; } }
      if (run.done) return;
      var N = 40, h = K.DT / N;
      for (var i = 0; i < N && !run.done; i++) {
        var vPrev = run.lead.vx;
        rk4(h);
        var tNow = sim.time + (i + 1) * h;
        if (vPrev * run.lead.vx < 0) {                         // a turning point, found to within a substep
          var frac = vPrev / (vPrev - run.lead.vx);
          run.turns.push(tNow - h + frac * h);
        }
        run.free.forEach(function (c) {
          charges.forEach(function (o) { if (o !== c && Math.hypot(c.x - o.x, c.y - o.y) < R_MIN) run.why = run.why || "touch"; });
          if (c.x < X_MIN || c.x > X_MAX || c.y < Y_MIN || c.y > Y_MAX) run.why = run.why || "away";
        });
        if (run.why) finish();
      }
    });
    sim.on("step", function (t) {
      if (!run) return;
      run.t.push(t); run.x.push(run.lead.x);
      if (run.eq) run.maxDev = Math.max(run.maxDev, Math.abs(run.lead.x - run.eq.x));
      if (run.turns.length >= 3 && run.eq && run.eq.k > 0) tries.mark("stable");
      if (run.eq && (run.eq.k < 0 || !wire) && Math.abs(run.x0 - run.eq.x) < 0.2 && Math.hypot(run.lead.x - run.x0, run.lead.y - home[charges.indexOf(run.lead)].y) > 0.4) tries.mark("unstable");
      if (t >= 30 && !run.done) { run.why = "time"; finish(); }
      update();
    });
    function finish() {
      if (run.done) return;
      run.done = true; sim.pause(); transportUI.render();
      K.flash(P.note, run.why === "touch" ? "The charges touched" : run.why === "away" ? "It flew off the stage" : "30 s: press Reset to run it again");
      update(true);
    }
    function period() {
      var tt = run ? run.turns : [];
      if (tt.length < 3) return null;
      return (tt[tt.length - 1] - tt[0]) / ((tt.length - 1) / 2);
    }

    function reset() {
      sim.pause(); sim.resetClock(); P.time.textContent = "t = 0.00 s";
      if (home) home.forEach(function (h, i) { if (charges[i]) { charges[i].x = h.x; charges[i].y = h.y; } });
      charges.forEach(function (c) { c.vx = c.vy = 0; });
      run = null; home = null;
      edited();
    }

    // anything the student changes by hand
    function edited() {
      if (run && sim.running) return update();
      var p = pairInfo();
      if (p) {
        var last = samples[samples.length - 1];
        if (!last || Math.abs(last.r - p.r) > 1e-9 || last.qq !== p.qq) samples.push({ r: p.r, F: p.F, qq: p.qq });
        if (samples.length > 200) samples.shift();
        var same = samples.filter(function (s) { return s.qq === p.qq; });
        if (same.some(function (a) { return same.some(function (b) { return Math.abs(b.r / a.r - 2) < 0.02 && Math.abs(b.F / a.F - 0.25) < 0.01; }); })) tries.mark("inverse");
      }
      charges.forEach(function (c) {
        var F = netF(c);
        if (charges.length >= 3 && c.q && F.max > 0 && F.mag < 0.01 * F.max) { tries.mark("null"); K.flash(P.note, "Balanced: net force on this charge is zero"); }
      });
      if (!drag) rescale();
      update(true);
    }
    function pairInfo() {
      if (charges.length < 2) return null;
      var f = pairF(charges[0], charges[1]);
      return { r: f.r, F: f.mag, f: f.f, qq: charges[0].q * charges[1].q };
    }

    /* ---------- dragging ---------- */
    var drag = null;
    sim.pointer({
      down: function (pt) {
        var best = -1, bd = Math.max(0.16, sim.u(18) / ppm);
        charges.forEach(function (c, i) { var d = Math.hypot(pt.m.x - c.x, pt.m.y - c.y); if (d < bd) { bd = d; best = i; } });
        if (best === -1) return false;
        if (run) reset();
        sel = best; syncSel();
        drag = { i: best, dx: charges[best].x - pt.m.x, dy: charges[best].y - pt.m.y };
        update(true);
        return true;
      },
      drag: function (pt) {
        if (!drag) return;
        var c = charges[drag.i];
        var nx = K.clamp(Math.round((pt.m.x + drag.dx) / SNAP) * SNAP, 0, X_MAX - 0.1);
        var ny = K.clamp(Math.round((pt.m.y + drag.dy) / SNAP) * SNAP, 0.1, Y_MAX - 0.1);
        if (charges.some(function (o) { return o !== c && Math.hypot(nx - o.x, ny - o.y) < R_MIN + 0.05; })) return;
        c.x = +nx.toFixed(4); c.y = +ny.toFixed(4);
        edited();
      },
      up: function () { drag = null; rescale(); }
    });

    /* ---------- drawing ---------- */
    // arrow scale: the biggest pair force on screen is 110 px. It is frozen while you drag, so you see forces grow and shrink.
    var arrowRef = 1;
    function rescale() {
      var m = 0;
      charges.forEach(function (a, i) { charges.forEach(function (b, j) { if (j > i) m = Math.max(m, pairF(a, b).mag); }); });
      arrowRef = m || 1;
    }
    function fScale() { return 110 / arrowRef; }
    function forceArrow(ctx, c, fx, fy, color, text, width, dash) {
      var k = fScale(), len = Math.hypot(fx, fy) * k, cap = 220;
      if (len > cap) { fx *= cap / len; fy *= cap / len; }
      var p = sim.px(c.x, c.y);
      K.arrow(ctx, p.x, p.y, p.x + fx * k * sim.u(1), p.y - fy * k * sim.u(1), color, { s: sim.u(1), width: width, label: text, dash: dash });
    }
    sim.on("under", function (ctx) {
      var v = sim.view();
      if (wire && charges.some(function (c) { return c.free; })) {
        ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = sim.u(3);
        charges.filter(function (c) { return c.free; }).forEach(function (c) {
          var y = (home && home[charges.indexOf(c)] ? sim.px(0, home[charges.indexOf(c)].y) : sim.px(0, c.y)).y;
          ctx.beginPath(); ctx.moveTo(v.x0, y); ctx.lineTo(v.x1, y); ctx.stroke();
        });
      }
      // the line through charges 1 and 2, and the point where a third charge balances
      if (charges.length >= 2) {
        var a = sim.px(charges[0].x, charges[0].y), b = sim.px(charges[1].x, charges[1].y);
        ctx.strokeStyle = K.alpha(th.muted, 0.5); ctx.lineWidth = sim.u(1); ctx.setLineDash([sim.u(4), sim.u(5)]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        var np = nullPoint();
        if (np && !np.none && np.x > X_MIN && np.x < X_MAX + 1) {
          var q = sim.px(np.x, np.y), s = sim.u(7);
          ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5);
          ctx.beginPath(); ctx.arc(q.x, q.y, s, 0, Math.PI * 2); ctx.moveTo(q.x - s, q.y - s); ctx.lineTo(q.x + s, q.y + s); ctx.moveTo(q.x + s, q.y - s); ctx.lineTo(q.x - s, q.y + s); ctx.stroke();
          K.label(ctx, "F = 0 for a third charge", q.x, q.y - sim.u(12), th.muted, { s: sim.u(0.85) });
        }
      }
    });
    sim.on("over", function (ctx) {
      var showPairs = charges.length <= 4;
      charges.forEach(function (c, i) {
        if (showPairs && charges.length > 2) charges.forEach(function (o, j) {
          if (o === c) return;
          var f = pairF(c, o);
          forceArrow(ctx, c, f.x, f.y, K.alpha(th.app, 0.45), i === sel ? "F" + sub(i + 1) + sub(j + 1) : "", 2, [5, 4]);
        });
        var F = netF(c);
        forceArrow(ctx, c, F.x, F.y, th.app, i === sel ? K.fmt(F.mag, 2) + " mN" : "", 3.5);
      });
      charges.forEach(function (c, i) {
        var p = sim.px(c.x, c.y), r = sim.u(14);
        if (i === sel) { ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2); ctx.beginPath(); ctx.arc(p.x, p.y, r + sim.u(5), 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = c.q ? posColor(c.q) : th.muted;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = sim.u(2.5);
        ctx.beginPath(); ctx.moveTo(p.x - r * 0.5, p.y); ctx.lineTo(p.x + r * 0.5, p.y);
        if (c.q > 0) { ctx.moveTo(p.x, p.y - r * 0.5); ctx.lineTo(p.x, p.y + r * 0.5); }
        ctx.stroke();
        if (!c.free) { ctx.fillStyle = th.ink; ctx.fillRect(p.x - sim.u(3), p.y + r + sim.u(2), sim.u(6), sim.u(6)); }
        K.label(ctx, "q" + sub(i + 1) + " " + (c.q > 0 ? "+" : "") + K.fmt(c.q, 1) + " μC" + (c.free ? " · free" : ""), p.x, p.y + r + sim.u(24), th.ink, { s: sim.u(0.85), bg: true });
        if (run && c.free && Math.abs(c.vx) + Math.abs(c.vy) > 0.02) K.arrow(ctx, p.x, p.y, p.x + c.vx * sim.u(40), p.y - c.vy * sim.u(40), th.vel, { s: sim.u(1), width: 2 });
      });
    });
    function sub(n) { return String(n).split("").map(function (d) { return "₀₁₂₃₄₅₆₇₈₉"[+d]; }).join(""); }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">F₁₂ vs r</b> · dots are where you dragged; dashed is $kq_1q_2/r^2$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">Fₓ on the selected charge vs x</b> · along its horizontal line; it crosses zero at the balance point</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">x–t of the released charge</b> · dashed: small-oscillation (or runaway) prediction</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gF = new K.Graph(cv[0], { yLabel: "F (mN)", xLabel: "r (m)", xMax: 5, yMin: 0, color: th.app });
    var gX = new K.Graph(cv[1], { yLabel: "Fx (mN)", xLabel: "x (m)", xMax: 6, color: th.app });
    var gT = new K.Graph(cv[2], { yLabel: "x (m)", xMax: 4, xAuto: true, color: th.disp });

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = pairInfo();
      if (p) {
        var pts = [];
        for (var r = 0.5; r <= 5 + 1e-9; r += 0.05) pts.push([r, FK * Math.abs(p.qq) / (r * r)]);
        gF.set("theory", { points: pts, color: th.app, dash: [5, 5], width: 1.5 });
        var mine = samples.filter(function (s) { return s.qq === p.qq; });
        gF.extra = function (ctx, X, Y) {
          ctx.fillStyle = th.app;
          mine.forEach(function (s) { if (s.r <= 5) { ctx.beginPath(); ctx.arc(X(s.r), Y(s.F), 3.5, 0, Math.PI * 2); ctx.fill(); } });
          if (p.r <= 5) ring(ctx, X(p.r), Y(p.F));
        };
      } else gF.clear();
      var c = charges[sel];
      if (c) {
        var cap = 9 * Math.abs(c.q || 1) * charges.reduce(function (m, o) { return o === c ? m : Math.max(m, Math.abs(o.q)); }, 0.5) / 0.25, fx = [];
        var yLine = home && home[sel] ? home[sel].y : c.y;
        for (var x = 0; x <= 6 + 1e-9; x += 0.01) fx.push([x, K.clamp(netF(c, x, yLine).x, -cap, cap)]);
        gX.set("theory", { points: fx, color: th.app, dash: [5, 5], width: 1.5 });
        var Fc = netF(c);
        gX.extra = function (ctx, X, Y) { if (c.x >= 0 && c.x <= 6) ring(ctx, X(c.x), Y(K.clamp(Fc.x, -cap, cap))); };
      } else gX.clear();
      if (run) {
        gT.set("sim", { points: run.t.map(function (t, i) { return [t, run.x[i]]; }), color: th.disp, width: 2.5, dot: true });
        var eq = run.eq, th2 = [];
        if (eq && Math.abs(eq.k) > 1e-12 && wire) {
          var w = Math.sqrt(Math.abs(eq.k) / (mS.get() / 1000)), A = run.x0 - eq.x, tEnd = Math.max(run.t[run.t.length - 1], 4);
          for (var t = 0; t <= tEnd + 1e-9; t += tEnd / 200) {
            var xx = eq.x + A * (eq.k > 0 ? Math.cos(w * t) : Math.cosh(w * t));
            if (xx < X_MIN - 1 || xx > X_MAX + 1) break;
            th2.push([t, xx]);
          }
          gT.set("theory", { points: th2, color: th.disp, dash: [5, 5], width: 1.5 });
        } else delete gT.series.theory;
      } else gT.clear();
      [gF, gX, gT].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Coulomb's law for charges 1 and 2", "Superposition on the selected charge", "Where a third charge balances (charges 1 and 2)", "Is the balance stable? (along the wire)"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "r", label: "r₁₂" }, { id: "F", label: "F₁₂", cls: "c-app" }, { id: "Fr2", label: "F₁₂ × r²", cls: "c-app" },
      { id: "net", label: "net force on selected", cls: "c-app" }, { id: "eq", label: "balance point (on its line)" },
      { id: "T", label: "period of oscillation", cls: "c-disp" }, { id: "v", label: "speed now", cls: "c-vel" }
    ]);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function qtex(q) { return n(q, 1) + "\\times10^{-6}"; }
    function renderMaths() {
      var p = pairInfo(), c = charges[sel];
      if (p) {
        K.tex(eqEls[0], "F_{12} = \\frac{k|q_1q_2|}{r^2} = \\frac{(9\\times10^9)|" + qtex(charges[0].q) + "\\cdot " + qtex(charges[1].q) + "|}{(" + K.fmt(p.r, 2) + ")^2} = \\mathbf{" + K.fmt(p.F, 2) + "}\\ \\text{mN}\\ (" + (p.f >= 0 ? "\\text{repel}" : "\\text{attract}") + ")");
      } else K.tex(eqEls[0], "\\text{Add a second charge}");
      if (c) {
        var F = netF(c), parts = charges.map(function (o, j) { return o === c ? null : "\\vec F_{" + (sel + 1) + (j + 1) + "}"; }).filter(Boolean);
        K.tex(eqEls[1], "\\vec F_{" + (sel + 1) + "} = " + (parts.join(" + ") || "0") + " = (" + n(F.x) + ",\\ " + n(F.y) + ")\\ \\text{mN},\\ |\\vec F| = \\mathbf{" + K.fmt(F.mag, 2) + "}\\ \\text{mN}");
      }
      var np = nullPoint();
      if (!np) K.tex(eqEls[2], "\\text{Needs two charges}");
      else if (np.none) K.tex(eqEls[2], "|q_1| = |q_2|,\\ \\text{opposite signs: no balance point anywhere}");
      else if (np.between) K.tex(eqEls[2], "\\frac{q_1}{x^2} = \\frac{q_2}{(d-x)^2} \\Rightarrow x = \\frac{d}{1+\\sqrt{q_2/q_1}} = \\frac{" + K.fmt(np.d, 2) + "}{1+\\sqrt{" + K.fmt(charges[1].q / charges[0].q, 2) + "}} = \\mathbf{" + K.fmt(np.s, 2) + "}\\ \\text{m from } q_1");
      else K.tex(eqEls[2], "\\text{unlike signs: outside, beyond the smaller: } x = \\frac{d}{\\sqrt{|q_{big}/q_{small}|} - 1}\\ \\Rightarrow\\ \\mathbf{" + K.fmt(np.s, 2) + "}\\ \\text{m from } q_1");
      var eq = c && charges.length >= 2 ? (run && run.eq && run.lead === c ? run.eq : equilibrium(c)) : null, m = mS.get() / 1000;
      if (eq && charges.length === 3 && sel === 2 && Math.abs(charges[0].y - c.y) < 1e-9 && Math.abs(charges[1].y - c.y) < 1e-9 && np && np.between) {
        var a = Math.abs(eq.x - charges[0].x), b = Math.abs(eq.x - charges[1].x);
        K.tex(eqEls[3], "k_{eff} = 2kq_3\\left(\\frac{q_1}{a^3}+\\frac{q_2}{b^3}\\right) = 2(9\\times10^{9})(" + qtex(c.q) + ")\\left(\\frac{" + qtex(charges[0].q) + "}{" + K.fmt(a, 2) + "^3}+\\frac{" + qtex(charges[1].q) + "}{" + K.fmt(b, 2) + "^3}\\right) = " + n(eq.k, 4) + "\\ \\text{N/m}" +
          (eq.k > 0 ? ",\\ T = 2\\pi\\sqrt{m/k} = \\mathbf{" + K.fmt(2 * Math.PI * Math.sqrt(m / eq.k), 2) + "}\\ \\text{s}" : "\\ \\Rightarrow\\ \\mathbf{unstable}"));
      } else if (eq) {
        K.tex(eqEls[3], "k_{eff} = -\\frac{dF_x}{dx} = " + n(eq.k, 4) + "\\ \\text{N/m}\\ " + (eq.k > 0 ? "\\Rightarrow T = 2\\pi\\sqrt{m/k} = \\mathbf{" + K.fmt(2 * Math.PI * Math.sqrt(m / eq.k), 2) + "}\\ \\text{s}" : "\\Rightarrow \\mathbf{unstable}"));
      } else K.tex(eqEls[3], "\\text{No balance point within 1.5 m of the selected charge on its line}");

      setR("r", p ? K.fmt(p.r, 2) + " m" : "—");
      setR("F", p ? K.fmt(p.F, 2) + " mN" : "—", p ? (p.f >= 0 ? "repulsive" : "attractive") : "");
      setR("Fr2", p ? K.fmt(p.F * p.r * p.r, 2) + " mN·m²" : "—", p ? "k|q₁q₂| = " + K.fmt(FK * Math.abs(p.qq), 2) + ", whatever r" : "");
      if (c) { var Fn = netF(c); setR("net", K.fmt(Fn.mag, 2) + " mN", Fn.mag > 1e-9 ? "at " + K.fmt(Math.atan2(Fn.y, Fn.x) / K.DEG, 0) + "° to +x" : "balanced"); }
      setR("eq", eq ? "x = " + K.fmt(eq.x, 2) + " m" : "—", eq ? (eq.k > 0 ? "stable along the line" : "unstable along the line") + (eq.kAcross > 0 ? ", stable across" : ", unstable across") : "");
      var Tm = period();
      setR("T", Tm ? K.fmt(Tm, 2) + " s" : "—", eq && eq.k > 0 ? "formula " + K.fmt(2 * Math.PI * Math.sqrt(m / eq.k), 2) + " s" : "");
      setR("v", run ? K.fmt(Math.hypot(run.lead.vx, run.lead.vy), 3) + " m/s" : "0 m/s");
      P.hud.innerHTML = p ? "<span>r₁₂ = " + K.fmt(p.r, 2) + " m</span><span>F₁₂ = " + K.fmt(p.F, 2) + " mN</span>" : "";
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Two point charges push (like signs) or pull (unlike signs) along the line joining them, with $F = \\dfrac{k|q_1q_2|}{r^2}$, $k = \\dfrac{1}{4\\pi\\varepsilon_0} = 9\\times10^9$ N m²/C². Double $r$ and $F$ drops to a quarter.</p>" +
      "<p>With more charges, each pair acts as if the others weren't there. The net force is the <b>vector sum</b> of the pair forces: the dashed arrows add, tip to tail, to the thick one.</p>" +
      "<p>A third charge balances where the two pulls cancel. For like charges that's between them, nearer the smaller one; for unlike charges it's outside, beyond the smaller one.</p>" +
      '<div class="trap"><b>JEE trap: balanced is not the same as stable.</b> The balance point doesn\'t depend on the third charge at all, but stability does. A charge like the other two is stable along the line and unstable across it; an opposite charge is the reverse. Free in every direction, it is never stable.</div>');
    function apply(s) {
      P.controls.querySelectorAll(".seg button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      load(s);
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "Coulomb's law", setup: { charges: [{ x: 1.5, y: 1.6, q: 5 }, { x: 3, y: 1.6, q: -5 }], sel: 1, wire: false }, watch: "Read F₁₂ off the stage, then drag to double r",
        q: "Charges of $+5\\ \\mu$C and $-5\\ \\mu$C are 1.5 m apart. What force does each feel? ($k = 9\\times10^9$ N m²/C²)",
        options: ["0.10 N, attractive", "0.10 N, repulsive", "0.15 N, attractive", "0.067 N, attractive"], answer: 0,
        explain: "$F = \\dfrac{9\\times10^9 \\times (5\\times10^{-6})^2}{1.5^2} = \\dfrac{0.225}{2.25} = 0.10$ N = 100 mN. Unlike charges attract. Forgetting to square $r$ gives 0.15 N." },
      { level: "medium", tag: "balance point", setup: { charges: [{ x: 1, y: 1.6, q: 4 }, { x: 4, y: 1.6, q: 1 }, { x: 2.2, y: 1.6, q: 1, free: true }], sel: 2, wire: true }, watch: "Drag q₃ along the line until its net force is zero",
        q: "Charges $+4\\ \\mu$C and $+1\\ \\mu$C are fixed 3 m apart. Where should a third charge go so that it feels no net force?",
        options: ["2 m from the 4 μC charge, between them", "1 m from the 4 μC charge, between them", "At the midpoint, 1.5 m from each", "3 m beyond the 1 μC charge"], answer: 0,
        hints: ["Between like charges the pushes are opposite, so look between them.", "Set $\\dfrac{4}{x^2} = \\dfrac{1}{(3-x)^2}$ and take the square root of both sides."],
        explain: "$\\dfrac{2}{x} = \\dfrac{1}{3 - x}$ gives $x = 2$ m from the $4\\ \\mu$C charge, 1 m from the smaller one. The third charge's value cancels, so any charge balances there." },
      { level: "hard", tag: "stability and oscillation", setup: { charges: [{ x: 1, y: 1.6, q: 4 }, { x: 4, y: 1.6, q: 1 }, { x: 3.05, y: 1.6, q: 1, free: true }], sel: 2, wire: true, m: 10 }, watch: "Press Release and time the oscillation",
        q: "In the last question, a bead of mass 10 g with charge $+1\\ \\mu$C sits at the balance point on a smooth wire along the line. It's nudged slightly along the wire. What happens?",
        options: ["It oscillates with period ≈ 3.8 s", "It oscillates with period ≈ 5.4 s", "It oscillates with period ≈ 6.6 s", "It runs away: the balance is unstable"], answer: 0,
        hints: ["Move it a small $x$ towards the $1\\ \\mu$C charge. Expand $\\dfrac{1}{(b - x)^2} \\approx \\dfrac{1}{b^2}\\left(1 + \\dfrac{2x}{b}\\right)$, and similarly for the other charge.", "The restoring force is $k_{eff}x$ with $k_{eff} = 2kq_3\\left(\\dfrac{q_1}{a^3} + \\dfrac{q_2}{b^3}\\right)$, $a = 2$ m, $b = 1$ m."],
        explain: "$k_{eff} = 2(9\\times10^9)(10^{-6})\\left(\\dfrac{4\\times10^{-6}}{8} + \\dfrac{10^{-6}}{1}\\right) = 0.027$ N/m, so $\\omega = \\sqrt{0.027/0.01} = 1.64$ rad/s and $T = 2\\pi/\\omega = 3.82$ s. Dropping the factor 2 gives 5.4 s; keeping only the far charge gives 6.6 s." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset, onPlay: function () { if (run && run.done) reset(); } });
    load(PRESETS.line);

    if (location.hostname === "localhost") {
      window.__lab_coulomb = {
        apply: apply, load: function (k) { load(PRESETS[k]); }, charges: function () { return charges; },
        select: function (i) { sel = i; syncSel(); }, move: function (i, x, y) { charges[i].x = x; charges[i].y = y; edited(); },
        setQ: function (i, q) { charges[i].q = q; syncSel(); edited(); }, setFree: function (i, f) { charges[i].free = f; edited(); },
        setWire: function (w) { wire = w; wireBox.querySelector("input").checked = w; edited(); },
        state: function () { var c = charges[sel]; return { pair: pairInfo(), net: c ? netF(c) : null, eq: c ? equilibrium(c) : null, nullPoint: nullPoint(), period: period(), run: run }; }
      };
    }
    return function destroy() { sim.destroy(); [gF, gX, gT].forEach(function (g) { g.destroy(); }); if (window.__lab_coulomb) delete window.__lab_coulomb; };
  }
})();
