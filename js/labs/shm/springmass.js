/* SHM, lab 1: a block on a spring. Pull it, let go, and watch x = A cos(ωt + φ) next to its reference circle. */
(function () {
  "use strict";
  var G = 9.8, SUB = 20, XMAX = 0.5;

  var lab = {
    id: "springmass", chapter: "shm", title: "Spring–mass SHM", short: "x = A cos(ωt + φ), ω = √(k/m)",
    lede: "Grab the block, pull it and let go. A restoring force $F = -kx$ is all it takes: the block swings in step with a point going round a circle, and its energy sloshes between kinetic and spring without ever leaking away.",
    tries: [
      { id: "amp", title: "Show the period doesn't care about amplitude",
        text: "Time a full swing, then pull at least twice as far (same $m$ and springs) and time it again.",
        why: "$T = 2\\pi\\sqrt{m/k}$ has no $A$ in it. A bigger pull means a bigger force, so the block goes faster and covers the extra distance in exactly the same time." },
      { id: "vert", title: "Hang it up and compare",
        text: "Measure a period lying flat, then switch to vertical with the same mass and springs and measure again.",
        why: "Gravity is constant, so it only moves the equilibrium down by $mg/k$. About that new centre the net force is still $-kx$, so $\\omega = \\sqrt{k/m}$ is unchanged." },
      { id: "combo", title: "Make the series period twice the parallel one",
        text: "Measure a period with two springs in series, then the same two springs in parallel, same mass.",
        why: "With equal springs $k$, series gives $k/2$ and parallel gives $2k$: a factor of 4 in stiffness, so $\\sqrt4 = 2$ in period. It only works when the two springs are equal." },
      { id: "energy", title: "Pause where KE equals PE",
        text: "Pause the swing at a moment when kinetic and potential energy are equal (within 4%).",
        why: "$\\tfrac12 kx^2 = \\tfrac12(\\tfrac12 kA^2)$ gives $x = A/\\sqrt2 \\approx 0.71A$. Not halfway: the block spends its time near the ends, where it's slow." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  // one RK4 step of x'' = f(t, x, v)
  function rk4(f, t, x, v, h) {
    var a1 = f(t, x, v);
    var x2 = x + v * h / 2, v2 = v + a1 * h / 2, a2 = f(t + h / 2, x2, v2);
    var x3 = x + v2 * h / 2, v3 = v + a2 * h / 2, a3 = f(t + h / 2, x3, v3);
    var x4 = x + v3 * h, v4 = v + a3 * h, a4 = f(t + h, x4, v4);
    return [x + h * (v + 2 * v2 + 2 * v3 + v4) / 6, v + h * (a1 + 2 * a2 + 2 * a3 + a4) / 6];
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 440;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "horiz", combo = "one";
    var mS = K.slider({ label: "Mass $m$", unit: "kg", min: 0.25, max: 4, step: 0.25, value: 1, onInput: reset });
    var k1S = K.slider({ label: "Spring $k_1$", unit: "N/m", min: 10, max: 100, step: 5, value: 40, onInput: reset });
    var k2S = K.slider({ label: "Spring $k_2$", unit: "N/m", min: 10, max: 100, step: 5, value: 40, onInput: reset });
    var x0S = K.slider({ label: "Pull $x_0$ (from equilibrium)", unit: "m", min: -XMAX, max: XMAX, step: 0.01, value: 0.2,
      onInput: function (v) { start.x0 = v; reset(); }, hint: "Or drag the block. Right (or up) is positive." });
    var v0S = K.slider({ label: "Kick $v_0$", unit: "m/s", min: -2, max: 2, step: 0.1, value: 0,
      onInput: function (v) { start.v0 = v; reset(); }, hint: "A kick at release gives a phase $\\varphi \\ne 0$." });
    var start = { x0: 0.2, v0: 0 };
    P.controls.innerHTML = "<h3>Set-up</h3>";
    var modeSeg = K.seg([{ label: "Horizontal", value: "horiz" }, { label: "Vertical", value: "vert" }], mode,
      function (v) { mode = v; natBtn.hidden = v !== "vert"; reset(); }, "Orientation");
    P.controls.appendChild(modeSeg);
    var comboSeg = K.seg([{ label: "One spring", value: "one" }, { label: "Series", value: "series" }, { label: "Parallel", value: "parallel" }], combo,
      function (v) { combo = v; k2S.el.hidden = v === "one"; reset(); }, "Springs");
    P.controls.appendChild(K.h("<h3>Springs</h3>"));
    P.controls.appendChild(comboSeg);
    [mS, k1S, k2S].forEach(function (s) { P.controls.appendChild(s.el); });
    k2S.el.hidden = true;
    P.controls.appendChild(K.h("<h3>Release</h3>"));
    [x0S, v0S].forEach(function (s) { P.controls.appendChild(s.el); });
    var natBtn = K.h('<button class="btn btn-sm" type="button">Release from natural length</button>');
    natBtn.hidden = true;
    natBtn.addEventListener("click", function () { fromNatural(); reset(); });
    var row = K.h('<div class="row"></div>');
    row.appendChild(natBtn);
    P.controls.appendChild(row);
    var show = { vec: true, circle: true };
    var toggles = K.h('<div class="row"></div>');
    toggles.appendChild(K.check("Vectors", true, function (v) { show.vec = v; }));
    toggles.appendChild(K.check("Reference circle", true, function (v) { show.circle = v; }));
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    P.controls.appendChild(toggles);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>displacement</span><span class="c-vel"><i></i>velocity</span>' +
      '<span class="c-acc"><i></i>acceleration</span><span class="c-app"><i></i>spring force, PE</span></div>'));

    function keff(p) { return p.combo === "one" ? p.k1 : p.combo === "series" ? p.k1 * p.k2 / (p.k1 + p.k2) : p.k1 + p.k2; }
    function params() {
      var p = { mode: mode, combo: combo, m: mS.get(), k1: k1S.get(), k2: combo === "one" ? 0 : k2S.get(), x0: start.x0, v0: start.v0 };
      p.k = keff(p); p.w = Math.sqrt(p.k / p.m); p.T = 2 * Math.PI / p.w;
      p.d = p.mode === "vert" ? p.m * G / p.k : 0;                      // equilibrium stretch
      p.A = Math.hypot(p.x0, p.v0 / p.w); p.phi = Math.atan2(-p.v0 / p.w, p.x0);
      return p;
    }
    // released from rest with the spring unstretched: x0 = +mg/k exactly (above the new equilibrium)
    function fromNatural() { var p = params(); start.x0 = p.m * G / p.k; start.v0 = 0; x0S.set(start.x0); v0S.set(0); }
    function formulaX(p, t) { return p.A * Math.cos(p.w * t + p.phi); }

    /* ---------- state + physics ---------- */
    // s: block position from the spring's natural-length point (y up / x right). x = s - s_eq.
    var st, rec, runs = [], p0, dragging = false, win = 10;
    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    function accel(p) {
      return p.mode === "vert" ? function (t, s) { return -p.k * s / p.m - G; } : function (t, s) { return -p.k * s / p.m; };
    }
    function reset(keep) {
      var wasRunning = sim.running && keep === true;
      sim.pause(); sim.resetClock();
      p0 = params();
      var seq = -p0.d;
      st = { t: 0, s: seq + p0.x0, v: p0.v0, seq: seq, crossT: null, T: null, periods: 0, maxStretch: 0, f: accel(p0), run: null };
      st.maxStretch = stretch();
      win = Math.min(20, Math.max(4, Math.ceil(4 * p0.T)));
      rec = { t: [0], x: [p0.x0], v: [p0.v0], a: [-p0.k * p0.x0 / p0.m] };
      P.time.textContent = "t = 0.00 s";
      if (transportUI) transportUI.render();
      theory(); update(true);
      if (wasRunning) { sim.play(); transportUI.render(); }
    }

    sim.on("before", function () {
      if (dragging) return;
      var p = p0, h = K.DT / SUB;
      for (var i = 0; i < SUB; i++) {
        var xPrev = st.s - st.seq, tPrev = st.t;
        var r = rk4(st.f, st.t, st.s, st.v, h);
        st.s = r[0]; st.v = r[1]; st.t += h;
        var x = st.s - st.seq;
        st.maxStretch = Math.max(st.maxStretch, stretch());
        if (xPrev < 0 && x >= 0) {                                   // upward zero crossing: one full period since the last one
          var tc = tPrev + h * (-xPrev) / (x - xPrev);
          if (st.crossT !== null) { st.T = tc - st.crossT; st.periods++; logRun(p); }
          st.crossT = tc;
        }
      }
      st.t = (sim.steps + 1) * K.DT;
    });
    sim.on("step", function (t) {
      var x = st.s - st.seq;
      if (t <= win + 1e-9) {
        rec.t.push(t); rec.x.push(x); rec.v.push(st.v); rec.a.push(-p0.k * x / p0.m);
      }
      update(false);
    });

    function logRun(p) {
      if (!st.run) { st.run = { mode: p.mode, combo: p.combo, m: p.m, k1: p.k1, k2: p.k2, k: p.k, A: p.A, T: st.T }; runs.push(st.run); if (runs.length > 30) runs.shift(); }
      st.run.T = st.T;
      var r = st.run, same = function (a, b) { return Math.abs(a - b) < 1e-9; };
      runs.forEach(function (o) {
        if (o === r) return;
        if (o.mode === r.mode && o.combo === r.combo && same(o.m, r.m) && same(o.k, r.k) &&
            Math.max(o.A, r.A) >= 2 * Math.min(o.A, r.A) && Math.min(o.A, r.A) > 0.005 && Math.abs(o.T / r.T - 1) < 0.01) tries.mark("amp");
        if (o.mode !== r.mode && same(o.m, r.m) && same(o.k, r.k) && Math.abs(o.T / r.T - 1) < 0.01) tries.mark("vert");
        if (same(o.m, r.m) && same(o.k1, r.k1) && same(o.k2, r.k2) && o.combo !== r.combo && o.combo !== "one" && r.combo !== "one") {
          var ser = o.combo === "series" ? o : r, par = o.combo === "series" ? r : o;
          if (Math.abs(ser.T / par.T - 2) < 0.04) tries.mark("combo");
        }
      });
    }
    // how far the spring is stretched beyond its natural length (the block is right of / below the spring)
    function stretch() { return p0.mode === "horiz" ? st.s : -st.s; }
    function energies() {
      var x = st.s - st.seq, KE = 0.5 * p0.m * st.v * st.v, PE = 0.5 * p0.k * x * x;
      return { KE: KE, PE: PE, E: KE + PE, Espring: 0.5 * p0.k * st.s * st.s };
    }

    /* ---------- layout (px) ---------- */
    // Fixed spots on the stage; metres are scaled by S so the whole swing always fits.
    function layout() {
      var p = p0, A = Math.max(p.A, 0.08);
      if (p.mode === "horiz") {
        var S = Math.min(320, 165 / A);
        return { S: S, wall: 60, eq: 330, y: 230, cx: 770, cy: 230 };
      }
      var top = 62, L0 = 0.3, S2 = Math.min(320, 300 / (L0 + p.d + A + 0.05));
      var nat = top + L0 * S2;
      return { S: S2, top: top, nat: nat, eq: nat + p.d * S2, x: 330, cx: 770 };
    }
    function blockPos(L, x) {
      return p0.mode === "horiz" ? { x: L.eq + x * L.S, y: L.y } : { x: L.x, y: L.eq - x * L.S };
    }
    var BW = 64, BH = 54;

    /* ---------- drawing ---------- */
    function coil(ctx, x1, y1, x2, y2, n, wdt, color) {
      var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, lead = Math.min(12, len * 0.1);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + ux * lead, y1 + uy * lead);
      var body = len - 2 * lead;
      for (var i = 0; i < 2 * n; i++) {
        var f = (i + 0.5) / (2 * n), side = i % 2 ? -1 : 1;
        ctx.lineTo(x1 + ux * (lead + body * f) - uy * side * wdt, y1 + uy * (lead + body * f) + ux * side * wdt);
      }
      ctx.lineTo(x2 - ux * lead, y2 - uy * lead); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // springs from anchor a to block face b; series puts a joint where the tension is equal in both
    function springs(ctx, a, b) {
      var p = p0, col = th.app;
      if (p.combo === "one") { coil(ctx, a.x, a.y, b.x, b.y, 9, 11, col); return; }
      if (p.combo === "parallel") {
        var off = 16, ox = p.mode === "horiz" ? 0 : off, oy = p.mode === "horiz" ? off : 0;
        coil(ctx, a.x - ox, a.y - oy, b.x - ox, b.y - oy, 8, 7, col);
        coil(ctx, a.x + ox, a.y + oy, b.x + ox, b.y + oy, 8, 7, K.alpha(col, 0.7));
        ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(b.x - ox * 1.4, b.y - oy * 1.4); ctx.lineTo(b.x + ox * 1.4, b.y + oy * 1.4); ctx.stroke();
        return;
      }
      // series: equal force F in both, spring i stretches F/k_i; natural lengths drawn equal
      var L = layout(), ext = stretch(), F = p.k * ext;
      var total = Math.hypot(b.x - a.x, b.y - a.y), nat0 = (total - ext * L.S) / 2;
      var l1 = nat0 + (F / p.k1) * L.S, f = K.clamp(l1 / total, 0.1, 0.9);
      var j = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      coil(ctx, a.x, a.y, j.x, j.y, 6, 10, col);
      coil(ctx, j.x, j.y, b.x, b.y, 6, 10, K.alpha(col, 0.7));
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(j.x, j.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    function hatch(ctx, x, y, w, hgt) {
      ctx.fillStyle = th.bank || th.ground; ctx.fillRect(x, y, w, hgt);
      ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, hgt);
    }

    sim.on("under", function (ctx) {
      var p = p0, L = layout(), x = st.s - st.seq, b = blockPos(L, x);
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      if (p.mode === "horiz") {
        hatch(ctx, L.wall - 24, L.y - 90, 24, 128);
        ctx.fillStyle = th.ground; ctx.fillRect(L.wall - 24, L.y + BH / 2, W, H - L.y - BH / 2);
        ctx.fillStyle = th["ground-top"]; ctx.fillRect(L.wall - 24, L.y + BH / 2, W, 2);
        // equilibrium and amplitude marks
        mark(ctx, L.eq, L.y + BH / 2 + 4, L.eq, L.y + BH / 2 + 26, th.muted, "x = 0");
        [-1, 1].forEach(function (sg) { mark(ctx, L.eq + sg * p.A * L.S, L.y + BH / 2 + 4, L.eq + sg * p.A * L.S, L.y + BH / 2 + 18, th.disp, sg > 0 ? "+A" : "−A"); });
        springs(ctx, { x: L.wall, y: L.y }, { x: b.x - BW / 2, y: b.y });
      } else {
        hatch(ctx, L.x - 90, L.top - 26, 180, 26);
        dashH(ctx, L.x - 170, L.x + 120, L.nat, th.muted, "natural length", "right");
        dashH(ctx, L.x - 170, L.x + 120, L.eq, th.disp, "equilibrium (x = 0)", "right");
        if (p.d * L.S > 14) {
          var ax = L.x - 150;
          K.arrow(ctx, ax, L.nat, ax, L.eq, th.grav, { width: 2, head: 7 });
          K.label(ctx, "d = mg/k", ax - 6, (L.nat + L.eq) / 2 + 6, th.grav, { align: "right" });
        }
        springs(ctx, { x: L.x, y: L.top }, { x: b.x, y: b.y - BH / 2 });
      }
      scaleBar(ctx, L);
    });
    function mark(ctx, x1, y1, x2, y2, c, text) {
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      K.label(ctx, text, x2, y2 + 16, c);
    }
    function dashH(ctx, x1, x2, y, c, text, side) {
      ctx.save(); ctx.strokeStyle = c; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
      K.label(ctx, text, side === "right" ? x2 + 6 : x1 - 6, y + 6, c, { align: side === "right" ? "left" : "right", font: "600 11px 'JetBrains Mono', monospace" });
    }
    function scaleBar(ctx, L) {
      var len = L.S * 0.1, x = 24, y = H - 18;
      ctx.strokeStyle = th.muted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.lineTo(x + len, y - 5); ctx.stroke();
      K.label(ctx, "10 cm", x + len + 8, y + 6, th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
    }

    sim.on("over", function (ctx) {
      var p = p0, L = layout(), x = st.s - st.seq, b = blockPos(L, x), a = -p.k * x / p.m;
      // block
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.fillRect(b.x - BW / 2, b.y - BH / 2, BW, BH); ctx.strokeRect(b.x - BW / 2, b.y - BH / 2, BW, BH);
      K.label(ctx, p.m + " kg", b.x, b.y + 6, th.ink);
      if (!sim.running && !dragging && sim.steps === 0) K.label(ctx, "drag me", b.x, b.y - BH / 2 - 8, th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      // vectors: lengths relative to their peaks, so the 90° and 180° shifts are easy to see
      if (show.vec && p.A > 1e-6) {
        var horiz = p.mode === "horiz", vk = 70 / (p.A * p.w), ak = 70 / (p.A * p.w * p.w);
        if (horiz) {
          K.arrow(ctx, b.x, b.y - BH / 2 - 16, b.x + st.v * vk, b.y - BH / 2 - 16, th.vel, { label: "v " + K.fmt(st.v, 2), lx: st.v >= 0 ? 6 : -78 });
          K.arrow(ctx, b.x, b.y - BH / 2 - 40, b.x + a * ak, b.y - BH / 2 - 40, th.acc, { label: "a " + K.fmt(a, 2), lx: a >= 0 ? 6 : -78 });
        } else {
          K.arrow(ctx, b.x - BW / 2 - 18, b.y, b.x - BW / 2 - 18, b.y - st.v * vk, th.vel, { label: "v " + K.fmt(st.v, 2), lx: -70 });
          K.arrow(ctx, b.x - BW / 2 - 44, b.y, b.x - BW / 2 - 44, b.y - a * ak, th.acc, { label: "a " + K.fmt(a, 2), lx: -70 });
        }
      }
      if (show.circle && p.A > 1e-6) drawCircle(ctx, L, b, x);
    });

    function drawCircle(ctx, L, b, x) {
      var p = p0, R = p.A * L.S, ang = p.w * st.t + p.phi, cy = p.mode === "horiz" ? L.cy : L.eq, cx = L.cx;
      // in a pause after dragging the phase is the formula's, so use the actual state instead
      var tipX, tipY;
      var vNorm = -st.v / (p.w), c = x / p.A, s = vNorm / p.A;   // cos and sin of the phase from the state
      if (p.mode === "horiz") { tipX = cx + R * c; tipY = cy - R * s; } else { tipX = cx - R * s; tipY = cy - R * c; }
      void ang;
      ctx.strokeStyle = th.line; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - R - 10, cy); ctx.lineTo(cx + R + 10, cy); ctx.moveTo(cx, cy - R - 10); ctx.lineTo(cx, cy + R + 10); ctx.stroke();
      // phasor
      K.arrow(ctx, cx, cy, tipX, tipY, th.disp, { width: 2.5, head: 9 });
      ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(tipX, tipY, 6, 0, Math.PI * 2); ctx.fill();
      // its shadow is the block
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = K.alpha(th.disp, 0.6); ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (p.mode === "horiz") { ctx.moveTo(tipX, tipY); ctx.lineTo(tipX, cy); }
      else { ctx.moveTo(tipX, tipY); ctx.lineTo(b.x + BW / 2, tipY); }
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = th.disp;
      if (p.mode === "horiz") { ctx.beginPath(); ctx.arc(tipX, cy, 4, 0, Math.PI * 2); ctx.fill(); }
      var phase = Math.atan2(s, c);
      var top = p.mode === "horiz" ? cy - R - 18 : cy - R - 18;
      K.label(ctx, "ωt + φ = " + K.fmt(((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 2) + " rad", cx, Math.max(18, top), th.ink, { bg: true });
      K.label(ctx, "radius A = " + K.fmt(p.A, 3) + " m, turning at ω", cx, Math.min(H - 4, cy + R + 32), th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
    }

    /* ---------- drag the block ---------- */
    sim.pointer({
      down: function (pt) {
        var L = layout(), b = blockPos(L, st.s - st.seq);
        if (Math.abs(pt.px - b.x) > BW / 2 + 14 || Math.abs(pt.py - b.y) > BH / 2 + 14) return false;
        sim.pause(); transportUI.render(); dragging = true;
        return true;
      },
      drag: function (pt) {
        if (!dragging) return;
        var L = layout();
        var x = p0.mode === "horiz" ? (pt.px - L.eq) / L.S : (L.eq - pt.py) / L.S;
        x = K.clamp(Math.round(x * 100) / 100, -XMAX, XMAX);
        st.s = st.seq + x; st.v = 0;
        x0S.set(x); v0S.set(0);
      },
      up: function () {
        if (!dragging) return;
        dragging = false;
        start.x0 = x0S.get(); start.v0 = 0;
        reset(); sim.play(); transportUI.render();
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">x–t</b> · a cosine: $A\\cos(\\omega t + \\varphi)$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">x</b>, <b class="c-vel">v</b>, <b class="c-acc">a</b> · each divided by its peak: v is a quarter cycle ahead of x, a is opposite to x</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">KE</b> + <b class="c-app">PE</b> = <b>total</b> · flat at $\\tfrac12 kA^2$ (dashed)</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gx = new K.Graph(cv[0], { yLabel: "x (m)", xMax: 10, color: th.disp });
    var gn = new K.Graph(cv[1], { yLabel: "÷ peak", xMax: 10, yMin: -1, yMax: 1, color: th.ink });
    var ge = new K.Graph(cv[2], { yLabel: "E (J)", xMax: 10, yMin: 0, color: th.ink });

    function theory() {
      var p = p0, xs = [], es = [];
      [gx, gn, ge].forEach(function (g) { g.clear(); g.o.xMax = win; });
      for (var t = 0; t <= win + 1e-9; t += win / 400) { xs.push([t, formulaX(p, t)]); es.push([t, 0.5 * p.k * p.A * p.A]); }
      gx.set("theory", { points: xs, color: th.disp, dash: [5, 5], width: 1.5 });
      ge.set("theory", { points: es, color: th.ink, dash: [5, 5], width: 1.5 });
    }
    var drawGraphs = K.throttle(function () {
      var p = p0, n = rec.t.length, vm = p.A * p.w || 1, am = p.A * p.w * p.w || 1, A = p.A || 1;
      var X = [], NX = [], NV = [], NA = [], KE = [], PE = [], TE = [];
      for (var i = 0; i < n; i++) {
        var t = rec.t[i], ke = 0.5 * p.m * rec.v[i] * rec.v[i], pe = 0.5 * p.k * rec.x[i] * rec.x[i];
        X.push([t, rec.x[i]]); NX.push([t, rec.x[i] / A]); NV.push([t, rec.v[i] / vm]); NA.push([t, rec.a[i] / am]);
        KE.push([t, ke]); PE.push([t, pe]); TE.push([t, ke + pe]);
      }
      gx.set("sim", { points: X, color: th.disp, width: 2.5, dot: true });
      gn.set("x", { points: NX, color: th.disp, width: 2 }); gn.set("v", { points: NV, color: th.vel, width: 2 }); gn.set("a", { points: NA, color: th.acc, width: 2, dot: true });
      ge.set("ke", { points: KE, color: th.vel, width: 2, fill: K.alpha(th.vel, 0.12) }); ge.set("pe", { points: PE, color: th.app, width: 2 });
      ge.set("tot", { points: TE, color: th.ink, width: 2.5, dot: true });
      [gx, gn, ge].forEach(function (g) { g.dirty = true; g.draw(); });
    }, 50);

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Effective spring constant", "Angular frequency and period", "Position now", "Energy is conserved"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "T", label: "period T" }, { id: "x", label: "displacement x", cls: "c-disp" }, { id: "v", label: "velocity v", cls: "c-vel" },
      { id: "a", label: "acceleration a", cls: "c-acc" }, { id: "E", label: "total energy" }, { id: "st", label: "spring stretch", cls: "c-app" }
    ]);
    var slowMaths = K.throttle(renderMaths, 100);
    function B(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      var p = p0, t = st.t, x = st.s - st.seq, e = energies();
      if (p.combo === "one") K.tex(eqEls[0], "k = k_1 = \\mathbf{" + K.fmt(p.k, 1) + "}\\ \\text{N/m}");
      else if (p.combo === "series") K.tex(eqEls[0], "\\frac1k = \\frac1{k_1} + \\frac1{k_2} \\Rightarrow k = \\frac{" + p.k1 + "\\times" + p.k2 + "}{" + p.k1 + " + " + p.k2 + "} = \\mathbf{" + K.fmt(p.k, 2) + "}\\ \\text{N/m}");
      else K.tex(eqEls[0], "k = k_1 + k_2 = " + p.k1 + " + " + p.k2 + " = \\mathbf{" + K.fmt(p.k, 1) + "}\\ \\text{N/m}");
      K.tex(eqEls[1], "\\omega = \\sqrt{\\tfrac{k}{m}} = \\sqrt{\\tfrac{" + K.fmt(p.k, 2) + "}{" + p.m + "}} = \\mathbf{" + K.fmt(p.w, 3) + "}\\ \\text{rad/s},\\quad T = \\tfrac{2\\pi}{\\omega} = \\mathbf{" + K.fmt(p.T, 3) + "}\\ \\text{s}");
      K.tex(eqEls[2], "x = A\\cos(\\omega t + \\varphi) = " + K.fmt(p.A, 3) + "\\cos(" + K.fmt(p.w, 3) + "\\times" + K.fmt(t, 2) + " + " + B(p.phi, 2) + ") = \\mathbf{" + K.fmt(formulaX(p, t), 3) + "}\\ \\text{m}");
      if (p.mode === "vert") {
        eqLabels[3].textContent = "Shifted equilibrium, same energy rule";
        K.tex(eqEls[3], "d = \\tfrac{mg}{k} = \\tfrac{" + p.m + "(9.8)}{" + K.fmt(p.k, 2) + "} = \\mathbf{" + K.fmt(p.d, 3) + "}\\ \\text{m},\\quad \\tfrac12mv^2 + \\tfrac12kx^2 = \\mathbf{" + K.fmt(e.E, 3) + "} = \\tfrac12kA^2 = \\mathbf{" + K.fmt(0.5 * p.k * p.A * p.A, 3) + "}\\ \\text{J}");
      } else {
        eqLabels[3].textContent = "Energy is conserved";
        K.tex(eqEls[3], "\\tfrac12mv^2 + \\tfrac12kx^2 = " + K.fmt(e.KE, 3) + " + " + K.fmt(e.PE, 3) + " = \\mathbf{" + K.fmt(e.E, 3) + "} = \\tfrac12kA^2 = \\mathbf{" + K.fmt(0.5 * p.k * p.A * p.A, 3) + "}\\ \\text{J}");
      }
      setR("T", st.T ? K.fmt(st.T, 3) + " s" : "—", "measured · formula " + K.fmt(p.T, 3) + " s");
      setR("x", K.fmt(x, 3) + " m", "A = " + K.fmt(p.A, 3) + " m");
      setR("v", K.fmt(st.v, 3) + " m/s", "|v| = ω√(A² − x²) = " + K.fmt(p.w * Math.sqrt(Math.max(0, p.A * p.A - x * x)), 3));
      setR("a", K.fmt(-p.k * x / p.m, 3) + " m/s²", "= −ω²x, max ω²A = " + K.fmt(p.w * p.w * p.A, 2));
      setR("E", K.fmt(e.E, 4) + " J", "KE " + K.fmt(e.KE, 3) + " + PE " + K.fmt(e.PE, 3));
      setR("st", K.fmt(stretch(), 3) + " m", p.mode === "vert" ? "max " + K.fmt(st.maxStretch, 3) + " · formula d + A = " + K.fmt(p.d + p.A, 3) : "= x when lying flat");
      P.hud.innerHTML = "<span>ω = " + K.fmt(p.w, 2) + " rad/s</span><span>T = " + K.fmt(p.T, 3) + " s</span><span>k = " + K.fmt(p.k, 1) + " N/m</span>" +
        (p.mode === "vert" ? "<span>d = mg/k = " + K.fmt(p.d, 3) + " m</span>" : "");
    }
    function update(force) { drawGraphs(); if (force) renderMaths(); else slowMaths(); }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>SHM is what you get whenever the <b class=\"c-app\">restoring force</b> is proportional to the displacement: $F = -kx$. Newton's second law turns that into $a = -\\tfrac{k}{m}x = -\\omega^2 x$, and the only functions whose second derivative is minus themselves are sines and cosines. So $x = A\\cos(\\omega t + \\varphi)$ with $\\omega = \\sqrt{k/m}$.</p>" +
      "<p>The <b class=\"c-disp\">reference circle</b> is the picture to remember: a point going round a circle of radius $A$ at angular speed $\\omega$ casts a shadow that moves exactly like the block. $\\varphi$ is just where on the circle it starts. Differentiate and $v$ leads $x$ by 90°, while $a$ is always opposite to $x$.</p>" +
      "<p>Energy swaps between $\\tfrac12mv^2$ and $\\tfrac12kx^2$, with the total fixed at $\\tfrac12kA^2$. Springs combine like capacitors: in parallel $k = k_1 + k_2$, in series $1/k = 1/k_1 + 1/k_2$.</p>" +
      '<div class="trap"><b>JEE trap: a vertical spring has the same ω.</b> Gravity just moves the centre down by $mg/k$; measure $x$ from there and it\'s $-kx$ again. ' +
      "But the spring's own stretch is $d + x$, so the spring's PE alone is not $\\tfrac12kx^2$, and released from the natural length the block falls a full $2mg/k$.</div>");
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === v)); }); }
    function apply(s) {
      mode = s.mode; combo = s.combo;
      setSeg(modeSeg, mode); setSeg(comboSeg, combo);
      k2S.el.hidden = combo === "one"; natBtn.hidden = mode !== "vert";
      mS.set(s.m); k1S.set(s.k1); if (s.k2) k2S.set(s.k2);
      start.x0 = s.x0 || 0; start.v0 = s.v0 || 0; x0S.set(start.x0); v0S.set(start.v0);
      if (s.natural) fromNatural();
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "period of a spring", setup: { mode: "horiz", combo: "one", m: 1, k1: 100, x0: 0.2 }, watch: "Predict T, then press Play and read the measured period",
        q: "A 1 kg block on a smooth floor is attached to a spring of stiffness 100 N/m. What is the period of its oscillation?",
        options: ["0.10 s", "0.31 s", "0.63 s", "6.28 s"], answer: 2,
        explain: "$\\omega = \\sqrt{k/m} = \\sqrt{100/1} = 10$ rad/s, so $T = 2\\pi/\\omega = 0.628$ s. 0.10 s is $1/\\omega$ (forgetting the $2\\pi$), and 6.28 s comes from using $\\sqrt{k/m}$ upside down." },
      { level: "medium", tag: "series vs parallel", setup: { mode: "horiz", combo: "series", m: 1, k1: 40, k2: 40, x0: 0.2 }, watch: "Measure T in series, then switch to Parallel and measure again",
        q: "Two identical springs of 40 N/m hold a 1 kg block, first in series, then in parallel. What is $T_{\\text{series}} : T_{\\text{parallel}}$?",
        options: ["1 : 2", "√2 : 1", "2 : 1", "4 : 1"], answer: 2,
        hints: ["Series: $1/k = 1/40 + 1/40$, so $k = 20$ N/m. Parallel: $k = 80$ N/m.", "$T \\propto 1/\\sqrt{k}$, so the ratio is $\\sqrt{80/20}$."],
        explain: "Series gives $k = 20$ N/m, parallel $k = 80$ N/m. $T \\propto 1/\\sqrt k$, so $T_s/T_p = \\sqrt{80/20} = 2$. In the lab: 1.405 s against 0.702 s. 4 : 1 is the ratio of the stiffnesses, not the periods." },
      { level: "hard", tag: "vertical release", setup: { mode: "vert", combo: "one", m: 1, k1: 100, natural: true }, watch: "Press Play and read the spring stretch: max, and the period",
        q: "A 1 kg block hangs from a light spring ($k = 100$ N/m, $g = 9.8$). It is held with the spring unstretched and released from rest. What is the maximum extension of the spring, and the period?",
        options: ["0.098 m, 0.63 s", "0.196 m, 0.63 s", "0.196 m, 1.26 s", "0.098 m, 0.31 s"], answer: 1,
        hints: ["Find the equilibrium first: $kd = mg$. That's the centre of the motion, not its bottom.", "It starts at rest a distance $d$ above the centre, so the amplitude is $d$. The lowest point is $d$ below the centre."],
        explain: "The new equilibrium is $d = mg/k = 0.098$ m below the natural length. Released at rest from the natural length, the block is $d$ above the centre, so $A = d$ and the lowest point is $2d = 0.196$ m of stretch. Gravity doesn't change $\\omega$: $T = 2\\pi\\sqrt{1/100} = 0.628$ s. 0.098 m is the equilibrium stretch, where the block is fastest, not where it stops." }
    ], apply, P);

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset });
    // pausing on the right moment is one of the experiments
    P.playBtn.addEventListener("click", function () {
      if (sim.running || sim.steps === 0) return;
      var e = energies();
      if (e.E > 1e-6 && Math.abs(e.KE - e.PE) < 0.04 * e.E) { tries.mark("energy"); K.flash(P.note, "KE = PE: x = " + K.fmt(st.s - st.seq, 3) + " m, A/√2 = " + K.fmt(p0.A / Math.SQRT2, 3) + " m"); }
    });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_springmass = { apply: apply, reset: reset, params: function () { return p0; }, state: function () { return st; },
        energies: energies, runs: runs, setStart: function (x0, v0) { start.x0 = x0; start.v0 = v0; x0S.set(x0); v0S.set(v0); reset(); } };
    }

    return function destroy() { sim.destroy(); [gx, gn, ge].forEach(function (g) { g.destroy(); }); };
  }
})();
