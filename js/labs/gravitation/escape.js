/* Gravitation, lab 2: escape velocity and energy. Fire a probe straight up, or park a satellite in orbit, and keep the energy books. */
(function () {
  "use strict";
  var G = 6.674e-11, ME = 5.972e24, RE = 6.371e6;
  var W = 1000, H = 560, AX = 60, AY = 110;          // stage; where r = 0 sits on the launch axis (px)
  var TIMES = [{ label: "1 s = 2 min", value: 120 }, { label: "10 min", value: 600 }, { label: "1 h", value: 3600 }];

  var lab = {
    id: "escape", chapter: "gravitation", title: "Escape velocity & energy", short: "bound or free, binding energy",
    lede: "Fire a probe straight up and watch the energy books: kinetic plus potential stays fixed, and its sign alone decides whether the probe ever comes back.",
    tries: [
      { id: "escape", title: "Escape for good",
        text: "Launch fast enough that the total energy is zero or more.",
        why: "Potential energy $-GMm/r$ climbs to zero far away. If $E = \\tfrac12 mv^2 - GMm/R \\ge 0$, there is always some kinetic energy left, so the probe never stops. $E = 0$ gives $v_{esc} = \\sqrt{2GM/R}$." },
      { id: "trap", title: "Beat the constant-g formula",
        text: "Launch so the probe climbs at least 20% higher than $v^2/2g$ predicts.",
        why: "$v^2/2g$ assumes gravity stays at its surface value. It weakens as $1/r^2$, so a fast probe coasts much higher. The formula only works while $h \\ll R$." },
      { id: "mass", title: "Show the probe's mass doesn't matter",
        text: "Launch twice with the same speed and planet but different masses, and compare the heights.",
        why: "Every term in $\\tfrac12 mv^2 - GMm/r$ has an $m$, so it cancels. Escape speed is a property of the planet ($M$ and $R$), not of what you throw." },
      { id: "orbit", title: "Check $E = -KE$ for a satellite",
        text: "Switch to Orbit and let the satellite go once round.",
        why: "In a circular orbit $KE = GMm/2r$ and $U = -GMm/r$, so $E = -GMm/2r = -KE = U/2$. The binding energy, the energy needed to free it, is $GMm/2r$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "launch", ts = 600;
    var MS = K.slider({ label: "Planet mass $M$", unit: "× M⊕", min: 0.1, max: 10, step: 0.1, value: 1, onInput: reset });
    var RS = K.slider({ label: "Planet radius $R$", unit: "× R⊕", min: 0.25, max: 4, step: 0.05, value: 1, onInput: reset });
    var vS = K.slider({ label: "Launch speed $v_0$", unit: "km/s", min: 0.5, max: 25, step: 0.01, value: 8, onInput: reset });
    var hS = K.slider({ label: "Orbit height $h$", unit: "km", min: 200, max: 40000, step: 1, value: 6371, onInput: reset });
    var mS = K.slider({ label: "Probe mass $m$", unit: "kg", min: 100, max: 5000, step: 100, value: 1000, onInput: reset,
      hint: "Changes the energies, not the motion." });
    P.controls.innerHTML = "";
    var modeSeg = K.seg([{ label: "Launch straight up", value: "launch" }, { label: "Satellite in orbit", value: "orbit" }], "launch",
      function (v) { mode = v; showMode(); reset(); }, "Mode");
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h("<h3>Planet</h3>"));
    [MS, RS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Probe</h3>"));
    var launchBox = K.h("<div></div>"), orbitBox = K.h("<div></div>");
    launchBox.appendChild(vS.el);
    var quick = K.h('<div class="row"></div>');
    [["½ v_esc", function () { vS.set(Math.round(vesc(params()) / 2 * 100) / 100); reset(); }],
     ["v_esc", function () { vS.set(Math.ceil(vesc(params()) * 100) / 100); reset(); }],
     ["Earth", function () { MS.set(1); RS.set(1); reset(); }]].forEach(function (q) {
      var b = K.h('<button class="btn btn-sm" type="button">' + q[0] + "</button>");
      b.addEventListener("click", q[1]); quick.appendChild(b);
    });
    launchBox.appendChild(quick);
    orbitBox.appendChild(hS.el);
    P.controls.appendChild(launchBox); P.controls.appendChild(orbitBox);
    P.controls.appendChild(mS.el);
    P.controls.appendChild(K.h("<h3>Time</h3>"));
    var timeSeg = K.seg(TIMES, ts, function (v) { ts = v; }, "Time scale");
    P.controls.appendChild(timeSeg);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-vel"><i></i>kinetic energy, velocity</span><span class="c-grav"><i></i>potential energy, gravity</span>' +
      '<span class="c-disp"><i></i>height</span></div>'));
    function showMode() { launchBox.hidden = mode !== "launch"; orbitBox.hidden = mode !== "orbit"; mS.el.querySelector("label").innerHTML = K.md(mode === "orbit" ? "Satellite mass $m$" : "Probe mass $m$"); }
    showMode();

    function params() {
      var M = MS.get() * ME, R = RS.get() * RE;
      return { M: M, R: R, GM: G * M, v: vS.get() * 1000, h: hS.get() * 1000, m: mS.get(), Mx: MS.get(), Rx: RS.get() };
    }
    function vesc(p) { return Math.sqrt(2 * p.GM / p.R) / 1000; }                         // km/s
    // launch theory: energy conservation, and the constant-g guess
    function theory(p) {
      var E = 0.5 * p.v * p.v - p.GM / p.R, g = p.GM / (p.R * p.R);
      var rmax = E < 0 ? p.GM / -E : Infinity;
      return { E: E, g: g, bound: E < 0, rmax: rmax, hmax: rmax - p.R, hg: p.v * p.v / (2 * g) };
    }
    function orbitTheory(p) {
      var r = p.R + p.h, v = Math.sqrt(p.GM / r);
      return { r: r, v: v, T: 2 * Math.PI * r / v, KE: p.GM * p.m / (2 * r), U: -p.GM * p.m / r, E: -p.GM * p.m / (2 * r),
        dE: p.GM * p.m * (1 / p.R - 1 / (2 * r)) };
    }

    /* ---------- the probe ---------- */
    var st = null, runs = [];
    function viewR(p) {
      var t = theory(p);
      if (mode === "orbit") return p.R + p.h;
      return t.bound ? K.clamp(t.rmax * 1.12, 1.5 * p.R, 40 * p.R) : 6 * p.R;
    }

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params();
      st = { p: p, t: 0, done: null, peak: null, laps: [], theta: 0, rec: { t: [0], h: [0], v: [0], ke: [], u: [], e: [] } };
      if (mode === "launch") {
        st.r = p.R; st.v = p.v; st.a = -p.GM / (p.R * p.R);
        st.rec.v = [p.v / 1000];
      } else {
        var o = orbitTheory(p);
        st.x = o.r; st.y = 0; st.vx = 0; st.vy = o.v; accel2(st);
        st.rec.h = [p.h / 1e3]; st.rec.v = [o.v / 1000];
      }
      st.view = viewR(p);
      energies(st);
      setTime(0);
      update(true);
    }
    function accel2(s) { var r = Math.hypot(s.x, s.y), k = -s.p.GM / (r * r * r); s.ax = k * s.x; s.ay = k * s.y; }
    function energies(s) {
      var p = s.p, r = mode === "launch" ? s.r : Math.hypot(s.x, s.y), v2 = mode === "launch" ? s.v * s.v : s.vx * s.vx + s.vy * s.vy;
      s.KE = 0.5 * p.m * v2; s.U = -p.GM * p.m / r; s.E = s.KE + s.U;
      s.rec.ke.push(s.KE / 1e9); s.rec.u.push(s.U / 1e9); s.rec.e.push(s.E / 1e9);
    }

    // velocity Verlet, the step shrinking with the local orbital time sqrt(r³/GM)
    function advance(s, dtTot) {
      var p = s.p, left = dtTot, guard = 0;
      while (left > 1e-9 && guard++ < 20000) {
        if (mode === "launch") {
          var h = Math.min(left, 0.002 * Math.sqrt(s.r * s.r * s.r / p.GM)), r1 = s.r, v1 = s.v, a1 = s.a;
          s.v += 0.5 * h * s.a; s.r += h * s.v;
          s.a = -p.GM / (s.r * s.r);
          s.v += 0.5 * h * s.a;
          s.t += h; left -= h;
          if (v1 > 0 && s.v <= 0 && !s.peak) {
            // the top lies inside this little step: finish it off with that step's own deceleration
            s.peak = { r: r1 + v1 * v1 / (2 * -a1), t: s.t - h + v1 / -a1 };
            s.peak.h = s.peak.r - p.R;
            peakReached(s);
          }
          if (s.r <= p.R && s.v < 0) {
            var back = (p.R - s.r) / s.v;            // undo the overshoot into the ground
            s.v = -Math.sqrt(Math.max(0, s.v * s.v - 2 * p.GM * (1 / s.r - 1 / p.R)));   // same energy, at r = R
            s.t += back; s.r = p.R; s.a = -p.GM / (p.R * p.R); s.done = "landed"; return;
          }
        } else {
          var r = Math.hypot(s.x, s.y), hh = Math.min(left, 0.002 * Math.sqrt(r * r * r / p.GM)), x1 = s.x, y1 = s.y, t1 = s.t;
          s.vx += 0.5 * hh * s.ax; s.vy += 0.5 * hh * s.ay;
          s.x += hh * s.vx; s.y += hh * s.vy;
          accel2(s);
          s.vx += 0.5 * hh * s.ax; s.vy += 0.5 * hh * s.ay;
          s.t += hh; left -= hh;
          var th0 = s.theta;
          s.theta += Math.atan2(x1 * s.y - y1 * s.x, x1 * s.x + y1 * s.y);
          var goal = 2 * Math.PI * (s.laps.length + 1);
          if (s.theta >= goal) {
            var tc = t1 + hh * (goal - th0) / (s.theta - th0);
            s.laps.push(tc - (s.laps.length ? s.lapAt : 0)); s.lapAt = tc;
            K.flash(P.note, "One lap: T = " + fmtT(s.laps[s.laps.length - 1]));
            tries.mark("orbit");
          }
        }
      }
    }

    function peakReached(s) {
      var p = s.p, t = theory(p);
      K.flash(P.note, "Top: h = " + K.fmt(s.peak.h / 1e3, 0) + " km  (v²/2g says " + K.fmt(t.hg / 1e3, 0) + " km)", 3000);
      if (s.peak.h >= 1.2 * t.hg) tries.mark("trap");
      runs.push({ Mx: p.Mx, Rx: p.Rx, v: p.v, m: p.m, h: s.peak.h });
      if (runs.length > 20) runs.shift();
      runs.forEach(function (q) {
        if (q.Mx === p.Mx && q.Rx === p.Rx && q.v === p.v && q.m !== p.m && Math.abs(q.h - s.peak.h) <= 1e-3 * s.peak.h) tries.mark("mass");
      });
    }

    sim.on("step", function () {
      if (!st || st.done) return;
      advance(st, K.DT * ts);
      var p = st.p;
      if (mode === "launch") {
        st.rec.t.push(st.t / 3600); st.rec.h.push((st.r - p.R) / 1e3); st.rec.v.push(st.v / 1000);
        if (!st.done && st.r > p.R + (st.view - p.R) * 1.0 && st.v > 0) st.done = theory(p).bound ? "off" : "escaped";
      } else {
        st.rec.t.push(st.t / 3600); st.rec.h.push((Math.hypot(st.x, st.y) - p.R) / 1e3); st.rec.v.push(Math.hypot(st.vx, st.vy) / 1000);
      }
      energies(st);
      if (st.rec.t.length > 3000) Object.keys(st.rec).forEach(function (k) { st.rec[k] = st.rec[k].filter(function (_, i) { return i % 2 === 0; }); });
      if (st.done) {
        sim.pause(); transportUI.render();
        if (st.done === "escaped") { K.flash(P.note, "Escaped: E ≥ 0, it never comes back", 3000); tries.mark("escape"); }
        else if (st.done === "off") K.flash(P.note, "Off the stage, but E < 0: it turns round at " + K.fmt(theory(p).hmax / 1e3, 0) + " km", 3000);
        else K.flash(P.note, "Landed after " + fmtT(st.t), 3000);
      }
      setTime(st.t);
      update(!!st.done);
    });
    function fmtT(s) {
      if (s < 3600) return K.fmt(s / 60, 1) + " min";
      var hrs = Math.floor(s / 3600);
      return hrs + " h " + K.fmt((s - hrs * 3600) / 60, 0) + " min";
    }
    function setTime(t) { P.time.textContent = "t = " + fmtT(t); }

    /* ---------- drawing ---------- */
    var EY0 = 330, EK = 200;                   // energy diagram: zero line, px per GMm/R
    function eY(eps) { return EY0 - eps * EK; }
    sim.on("under", function (ctx) {
      if (mode === "launch") drawLaunch(ctx); else drawOrbit(ctx);
    });
    function drawLaunch(ctx) {
      var p = st.p, s = (W - AX - 30) / st.view, u = sim.u(1), t = theory(p);
      var RX = function (r) { return AX + r * s; };
      // top band: the planet and the launch line
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 200); ctx.clip();
      ctx.fillStyle = th.ground; ctx.beginPath(); ctx.arc(AX, AY, p.R * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = 2 * u; ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = u;
      ctx.beginPath(); ctx.moveTo(RX(p.R), AY); ctx.lineTo(W - 10, AY); ctx.stroke();
      ctx.fillStyle = th.muted; ctx.font = "600 " + 11 * u + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      var span = (st.view - p.R) / p.R, stepR = [0.25, 0.5, 1, 2, 5, 10].filter(function (q) { return span / q <= 6; })[0] || 10;
      for (var k = 1; k * stepR * p.R <= st.view + 1; k++) {
        var rr = p.R + k * stepR * p.R; if (rr > st.view) break;
        ctx.fillRect(RX(rr) - 0.5, AY - 4, 1, 8);
        ctx.fillText((k === 1 ? "h = " : "") + (k * stepR) + "R", RX(rr), AY + 8);
      }
      K.label(ctx, (p.Mx === 1 && p.Rx === 1 ? "Earth" : "planet") + "  M = " + p.Mx + " M⊕, R = " + p.Rx + " R⊕", 14, 190, th.muted, { s: u, align: "left" });
      if (t.bound && t.rmax < st.view) {
        ctx.strokeStyle = th.disp; ctx.setLineDash([4 * u, 4 * u]);
        ctx.beginPath(); ctx.moveTo(RX(t.rmax), AY - 40); ctx.lineTo(RX(t.rmax), eY(-p.R / t.rmax)); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "top: " + K.fmt(t.hmax / 1e3, 0) + " km", RX(t.rmax), AY - 42, th.disp, { s: u, bg: true });
      }
      var rg = p.R + t.hg;
      if (rg < st.view) {
        ctx.strokeStyle = th.muted; ctx.setLineDash([2 * u, 4 * u]);
        ctx.beginPath(); ctx.moveTo(RX(rg), AY - 16); ctx.lineTo(RX(rg), AY + 26); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "v²/2g", RX(rg), AY - 18, th.muted, { s: u * 0.9 });
      }
      // bottom band: the energy well, per GMm/R
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = u;
      ctx.beginPath(); ctx.moveTo(AX, eY(0)); ctx.lineTo(W - 10, eY(0)); ctx.stroke();
      K.label(ctx, "E = 0", W - 14, eY(0) - 2, th.muted, { s: u, align: "right" });
      ctx.strokeStyle = th.grav; ctx.lineWidth = 2.5 * u; ctx.beginPath();
      for (var i = 0; i <= 200; i++) { var r = p.R + (st.view - p.R) * i / 200, y = eY(-p.R / r); if (i) ctx.lineTo(RX(r), y); else ctx.moveTo(RX(r), y); }
      ctx.stroke();
      K.label(ctx, "U(r) = −GMm/r", RX(p.R) + 8 * u, eY(-1) + 18 * u, th.grav, { s: u, align: "left" });
      var eps = st.p ? t.E / (p.GM / p.R) : 0, ey = K.clamp(eY(eps), 205, H - 4);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2 * u; ctx.setLineDash([6 * u, 4 * u]);
      ctx.beginPath(); ctx.moveTo(RX(p.R), ey); ctx.lineTo(t.bound ? Math.min(RX(t.rmax), W - 10) : W - 10, ey); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "total E = " + K.fmt(t.E * p.m / 1e9, 2) + " GJ " + (t.bound ? "(< 0: bound)" : "(≥ 0: free)"), RX(p.R) + 8 * u, ey - 4 * u, th.ink, { s: u, align: "left", bg: true });
      // KE is the gap between the E line and the well at the probe
      var rp = st.r, xp = RX(rp);
      if (xp < W) {
        var yu = eY(-p.R / rp);
        ctx.strokeStyle = th.vel; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(xp, yu); ctx.lineTo(xp, ey); ctx.stroke();
        if (Math.abs(ey - yu) > 20) K.label(ctx, "KE", xp + 8 * u, (yu + ey) / 2 + 8 * u, th.vel, { s: u, align: "left" });
      }
    }
    function drawOrbit(ctx) {
      var p = st.p, o = orbitTheory(p), cx = 300, cy = 295, s = 215 / o.r, u = sim.u(1);
      ctx.strokeStyle = th["grid-strong"]; ctx.setLineDash([4 * u, 5 * u]); ctx.lineWidth = u;
      ctx.beginPath(); ctx.arc(cx, cy, o.r * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = th.ground; ctx.beginPath(); ctx.arc(cx, cy, p.R * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = 2 * u; ctx.stroke();
      K.label(ctx, "h = " + K.fmt(p.h / 1e3, 0) + " km", cx, cy - o.r * s - 8 * u, th.muted, { s: u, bg: true });
      // energy bars, all in GJ, against GMm/R
      var unit = p.GM * p.m / p.R, bx = 640, by = 300, bk = 200 / unit;
      var bars = [["KE", st.KE, th.vel], ["U", st.U, th.grav], ["E", st.E, th.ink], ["to free it", -st.E, th.acc]];
      ctx.strokeStyle = th["grid-strong"]; ctx.beginPath(); ctx.moveTo(bx - 20, by); ctx.lineTo(bx + 340, by); ctx.stroke();
      bars.forEach(function (b, i) {
        var x = bx + i * 85, hgt = b[1] * bk;
        ctx.fillStyle = K.alpha(b[2], i === 3 ? 0.35 : 0.8); ctx.fillRect(x, by - Math.max(0, hgt), 50, Math.abs(hgt));
        K.label(ctx, K.fmt(b[1] / 1e9, 2) + " GJ", x + 25, hgt > 0 ? by - hgt - 4 * u : by - hgt + 18 * u, b[2], { s: u * 0.9 });
        K.label(ctx, b[0], x + 25, by + (hgt > 0 ? 20 : -6) * u, th.muted, { s: u * 0.9 });
      });
      K.label(ctx, "E = −KE = U/2", bx + 160, 70, th.ink, { s: u });
      void cy;
    }
    sim.on("over", function (ctx) {
      var p = st.p, u = sim.u(1);
      if (mode === "launch") {
        var s = (W - AX - 30) / st.view, x = AX + st.r * s;
        if (x > W + 10) return;
        ctx.fillStyle = th.acc; ctx.beginPath(); ctx.moveTo(x + 9 * u, AY); ctx.lineTo(x - 7 * u, AY - 6 * u); ctx.lineTo(x - 7 * u, AY + 6 * u); ctx.closePath(); ctx.fill();
        if (Math.abs(st.v) > 1) K.arrow(ctx, x, AY - 22 * u, x + st.v / 1000 * 6 * u, AY - 22 * u, th.vel, { s: u, label: "v " + K.fmt(st.v / 1000, 2) + " km/s", lx: st.v > 0 ? 6 : -110 });
        var gl = 30 * Math.pow(p.R / st.r, 2) * Math.sqrt(p.GM / (p.R * p.R) / 9.82);
        K.arrow(ctx, x, AY + 22 * u, x - Math.max(gl, 4) * u, AY + 22 * u, th.grav, { s: u, label: "g " + K.fmt(p.GM / (st.r * st.r), 2), lx: -90, ly: 0 });
        if (!sim.running && st.t === 0) K.label(ctx, "press Launch", x + 14 * u, AY - 40 * u, th.muted, { s: u, align: "left" });
      } else {
        var o = orbitTheory(p), cx = 300, cy = 295, sc = 215 / o.r, sx = cx + st.x * sc, sy = cy - st.y * sc;
        K.arrow(ctx, sx, sy, sx + st.vx / 1000 * 12 * u, sy - st.vy / 1000 * 12 * u, th.vel, { s: u, label: "v " + K.fmt(Math.hypot(st.vx, st.vy) / 1000, 2) });
        var r = Math.hypot(st.x, st.y);
        K.arrow(ctx, sx, sy, sx - st.x / r * 40 * u, sy + st.y / r * 40 * u, th.grav, { s: u });
        ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(sx, sy, 7 * u, 0, Math.PI * 2); ctx.fill();
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">h–t</b> · dashed is the constant-g parabola: it gives up too early</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v–t</b> · slows less and less as gravity weakens; dashed is $v = v_0 - gt$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">energy vs t</b> · KE (green) and U (purple) trade; total E stays flat</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gh = new K.Graph(cv[0], { yLabel: "h (km)", xLabel: "t (h)", xMax: 1, xAuto: true, yMin: 0, color: th.disp });
    var gv = new K.Graph(cv[1], { yLabel: "v (km/s)", xLabel: "t (h)", xMax: 1, xAuto: true, color: th.vel });
    var ge = new K.Graph(cv[2], { yLabel: "E (GJ)", xLabel: "t (h)", xMax: 1, xAuto: true, color: th.grav });

    var caps = P.graphs.querySelectorAll(".graph-cap"), capMode = null;
    var CAPS = {
      launch: ['<b class="c-disp">h–t</b> · dashed is the constant-g parabola: it gives up too early', '<b class="c-vel">v–t</b> · slows less and less as gravity weakens; dashed is $v = v_0 - gt$',
        '<b class="c-grav">energy vs t</b> · KE (green) and U (purple) trade; total E stays flat'],
      orbit: ['<b class="c-disp">h–t</b> · a circular orbit keeps its height', '<b class="c-vel">v–t</b> · steady at $\\sqrt{GM/r}$ (dashed)',
        '<b class="c-grav">energy vs t</b> · KE = −E, U = 2E, all constant']
    };
    function update(force) {
      var R = st.rec, p = st.p, z = function (a) { return R.t.map(function (t, i) { return [t, a[i]]; }); };
      if (capMode !== mode) { capMode = mode; CAPS[mode].forEach(function (c, i) { caps[i].innerHTML = K.md(c); }); }
      var tEnd = Math.max(R.t[R.t.length - 1], 0.25);
      if (mode === "launch") {
        var t = theory(p), g = t.g, tg = 2 * p.v / g, hp = [], vp = [];
        for (var i = 0; i <= 80; i++) { var tt = Math.min(tg, tEnd * 3600) * i / 80; hp.push([tt / 3600, (p.v * tt - 0.5 * g * tt * tt) / 1e3]); vp.push([tt / 3600, (p.v - g * tt) / 1000]); }
        gh.set("f", { points: hp, color: th.disp, dash: [5, 5], width: 1.5 });
        gv.set("f", { points: vp, color: th.vel, dash: [5, 5], width: 1.5 });
      } else {
        var o = orbitTheory(p);
        gh.set("f", { points: [[0, p.h / 1e3], [tEnd, p.h / 1e3]], color: th.disp, dash: [5, 5], width: 1.5 });
        gv.set("f", { points: [[0, o.v / 1000], [tEnd, o.v / 1000]], color: th.vel, dash: [5, 5], width: 1.5 });
      }
      gh.set("sim", { points: z(R.h), color: th.disp, width: 2.5, dot: true });
      gv.set("sim", { points: z(R.v), color: th.vel, width: 2.5, dot: true });
      var tE = R.t.slice(0, R.ke.length);
      ge.set("ke", { points: tE.map(function (t, i) { return [t, R.ke[i]]; }), color: th.vel, width: 2 });
      ge.set("u", { points: tE.map(function (t, i) { return [t, R.u[i]]; }), color: th.grav, width: 2 });
      ge.set("e", { points: tE.map(function (t, i) { return [t, R.e[i]]; }), color: th.ink, width: 2.5, dot: true });
      ge.set("ef", { points: [[0, R.e[0]], [tEnd, R.e[0]]], color: th.muted, dash: [5, 5], width: 1.5 });
      [gh, gv, ge].forEach(function (gr) { gr.dirty = true; gr.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'.repeat(4);
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label");
    var readIds = [
      { id: "a", label: "" }, { id: "b", label: "" }, { id: "c", label: "" }, { id: "d", label: "" }, { id: "e", label: "" }, { id: "f", label: "" }
    ];
    var setR = null, readMode = null;
    var slowMaths = K.throttle(renderMaths, 100);
    function sci(v, d) {
      var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
      if (+m.toFixed(d) >= 10) { m /= 10; e++; }
      return m.toFixed(d) + "\\times10^{" + e + "}";
    }
    function GJ(v) { return K.fmt(v / 1e9, 2) + " GJ"; }
    function nb(v, d) { var s = K.fmt(v, d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      var p = st.p, GMs = "(6.674\\times10^{-11})(" + sci(p.M, 3) + ")";
      if (readMode !== mode) {
        readMode = mode;
        var labels = mode === "launch"
          ? [["a", "escape speed", "c-vel"], ["b", "highest point", "c-disp"], ["c", "constant-g guess", ""], ["d", "total energy E", "c-grav"], ["e", "speed now", "c-vel"], ["f", "flight", ""]]
          : [["a", "orbital speed", "c-vel"], ["b", "period", ""], ["c", "kinetic energy", "c-vel"], ["d", "potential energy", "c-grav"], ["e", "total E (binding = −E)", "c-grav"], ["f", "energy from the ground", "c-acc"]];
        setR = K.readout(P.readouts, labels.map(function (l) { return { id: l[0], label: l[1], cls: l[2] }; }));
        void readIds;
      }
      if (mode === "launch") {
        var t = theory(p), ve = vesc(p);
        ["Escape speed: E = 0 at the surface", "Total energy decides bound or free", "Energy conservation to the top", "Constant-g guess (only if h ≪ R)"].forEach(function (l, i) { eqLabels[i].textContent = l; });
        K.tex(eqEls[0], "v_{esc} = \\sqrt{\\frac{2GM}{R}} = \\sqrt{\\frac{2" + GMs + "}{" + sci(p.R, 3) + "}} = \\mathbf{" + K.fmt(ve, 2) + "}\\ \\text{km/s}");
        K.tex(eqEls[1], "E = \\tfrac12 mv_0^2 - \\frac{GMm}{R} = " + K.fmt(0.5 * p.m * p.v * p.v / 1e9, 2) + " - " + K.fmt(p.GM * p.m / p.R / 1e9, 2) + " = \\mathbf{" + K.fmt(t.E * p.m / 1e9, 2) + "}\\ \\text{GJ}" + (t.bound ? " < 0:\\ \\text{it returns}" : " \\ge 0:\\ \\text{escapes}"));
        K.tex(eqEls[2], t.bound
          ? "-\\frac{GMm}{R+h} = E \\Rightarrow h = \\frac{R}{v_{esc}^2/v_0^2 - 1} = \\frac{" + K.fmt(p.R / 1e3, 0) + "}{(" + K.fmt(ve, 2) + "/" + K.fmt(p.v / 1000, 2) + ")^2 - 1} = \\mathbf{" + K.fmt(t.hmax / 1e3, 0) + "}\\ \\text{km}"
          : "v_0 \\ge v_{esc}:\\ h \\to \\infty");
        K.tex(eqEls[3], "h = \\frac{v_0^2}{2g} = \\frac{(" + K.fmt(p.v, 0) + ")^2}{2(" + K.fmt(t.g, 2) + ")} = \\mathbf{" + K.fmt(t.hg / 1e3, 0) + "}\\ \\text{km}" +
          (t.bound ? "\\quad(" + K.fmt((t.hg / t.hmax - 1) * 100, 0) + "\\%\\ \\text{off})" : "\\quad(\\text{wrong: it escapes})"));
        setR("a", K.fmt(ve, 2) + " km/s", "√(2GM/R)");
        setR("b", st.peak ? K.fmt(st.peak.h / 1e3, 0) + " km" : "—", t.bound ? "energy says " + K.fmt(t.hmax / 1e3, 0) + " km" : "never stops");
        setR("c", K.fmt(t.hg / 1e3, 0) + " km", "v²/2g, too low");
        setR("d", GJ(st.E), "at launch " + GJ(t.E * p.m));
        setR("e", K.fmt(st.v / 1000, 2) + " km/s");
        setR("f", fmtT(st.t), st.done === "landed" ? "landed" : st.done === "escaped" ? "escaped" : st.peak ? "falling back" : "climbing");
      } else {
        var o = orbitTheory(p), rNow = Math.hypot(st.x, st.y), vNow = Math.hypot(st.vx, st.vy);
        ["Orbital speed and period", "Kinetic and potential energy", "Total energy: binding energy is −E", "Energy to put it there from the ground"].forEach(function (l, i) { eqLabels[i].textContent = l; });
        K.tex(eqEls[0], "v_o = \\sqrt{\\frac{GM}{R+h}} = \\sqrt{\\frac{" + GMs + "}{" + sci(o.r, 3) + "}} = \\mathbf{" + K.fmt(o.v / 1000, 2) + "}\\ \\text{km/s},\\ T = \\frac{2\\pi r}{v_o} = \\mathbf{" + K.fmt(o.T / 60, 1) + "}\\ \\text{min}");
        K.tex(eqEls[1], "KE = \\frac{GMm}{2r} = \\mathbf{" + K.fmt(o.KE / 1e9, 2) + "}\\ \\text{GJ},\\quad U = -\\frac{GMm}{r} = \\mathbf{" + K.fmt(o.U / 1e9, 2) + "}\\ \\text{GJ}");
        K.tex(eqEls[2], "E = KE + U = -\\frac{GMm}{2r} = \\mathbf{" + K.fmt(o.E / 1e9, 2) + "}\\ \\text{GJ}");
        K.tex(eqEls[3], "\\Delta E = E - \\left(-\\frac{GMm}{R}\\right) = " + nb(o.E / 1e9, 2) + " + " + K.fmt(p.GM * p.m / p.R / 1e9, 2) + " = \\mathbf{" + K.fmt(o.dE / 1e9, 2) + "}\\ \\text{GJ}");
        setR("a", K.fmt(vNow / 1000, 2) + " km/s", "formula " + K.fmt(o.v / 1000, 2));
        setR("b", st.laps.length ? K.fmt(st.laps[st.laps.length - 1] / 60, 1) + " min" : "—", "formula " + K.fmt(o.T / 60, 1) + " min");
        setR("c", GJ(st.KE), "GMm/2r " + GJ(o.KE));
        setR("d", GJ(st.U), "−GMm/r " + GJ(o.U));
        setR("e", GJ(st.E), "binding " + GJ(-st.E));
        setR("f", GJ(st.E + p.GM * p.m / p.R), "formula " + GJ(o.dE));
        void rNow;
      }
      P.hud.innerHTML = mode === "launch" ? "<span>v_esc = " + K.fmt(vesc(p), 2) + " km/s</span><span>" + (theory(p).bound ? "E < 0: bound" : "E ≥ 0: free") + "</span>"
        : "<span>circular orbit, r = " + K.fmt((p.R + p.h) / 1e3, 0) + " km</span>";
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Far from the planet, gravity's pull fades as $1/r^2$, so the potential energy is $U = -\\dfrac{GMm}{r}$: very negative at the surface, rising to zero at infinity. Add the kinetic energy and the <b>total $E$ never changes</b> on the way up.</p>" +
      "<p>The sign of $E$ is the whole story. If $E < 0$ the probe runs out of kinetic energy where $U = E$ and falls back. If $E \\ge 0$ it never does. Setting $E = 0$ at the surface gives the <b>escape speed</b> $v_{esc} = \\sqrt{2GM/R} = \\sqrt{2gR}$, 11.2 km/s for Earth, whatever the probe's mass or direction.</p>" +
      "<p>A satellite in a circular orbit has $KE = \\dfrac{GMm}{2r}$ and $E = -\\dfrac{GMm}{2r}$: you must add $\\dfrac{GMm}{2r}$ (its binding energy) to set it free.</p>" +
      '<div class="trap"><b>JEE trap: $h = v^2/2g$ is only for small heights.</b> It assumes $g$ stays 9.8 m/s² all the way up. For a launch at a good fraction of $v_{esc}$, use energy conservation with $-GMm/r$: at half the escape speed the probe climbs $R/3$, not $R/4$.</div>');
    function setSeg(seg, v) { seg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    function apply(s) {
      mode = s.mode; setSeg(modeSeg, mode); showMode();
      MS.set(s.M); RS.set(s.R); if (s.v != null) vS.set(s.v); if (s.h != null) hS.set(s.h); if (s.m != null) mS.set(s.m);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "escape speed", setup: { mode: "launch", M: 2, R: 2, v: 11.19, m: 1000 }, watch: "Read the escape speed, then launch at it",
        q: "Planet X has twice Earth's mass and twice Earth's radius. Earth's escape speed is 11.2 km/s. What is planet X's?",
        options: ["5.6 km/s", "11.2 km/s", "15.8 km/s", "22.4 km/s"], answer: 1,
        explain: "$v_{esc} = \\sqrt{2GM/R}$ depends on $M/R$, which is unchanged, so it's still 11.2 km/s. Surface gravity $GM/R^2$ is halved, though: the probe gets out with less pull but has the same well to climb." },
      { level: "medium", tag: "height from energy", setup: { mode: "launch", M: 1, R: 1, v: 5.59, m: 1000 }, watch: "Compare the dashed v²/2g mark with where it really stops",
        q: "A probe is fired straight up from Earth at half the escape speed. Ignoring air, how high does it rise? ($R = 6371$ km)",
        options: ["1593 km ($R/4$)", "2124 km ($R/3$)", "3186 km ($R/2$)", "6371 km ($R$)"], answer: 1,
        hints: ["Don't use $v^2/2g$: gravity weakens on the way up. Write $\\tfrac12 mv^2 - \\dfrac{GMm}{R} = -\\dfrac{GMm}{R+h}$.", "With $v^2 = \\tfrac14 v_{esc}^2 = \\dfrac{GM}{2R}$, the equation becomes $\\dfrac{1}{R+h} = \\dfrac{3}{4R}$."],
        explain: "$\\dfrac{GM}{4R} - \\dfrac{GM}{R} = -\\dfrac{GM}{R+h}$ gives $R + h = \\tfrac43 R$, so $h = R/3 = 2124$ km. The constant-g formula gives $R/4 = 1593$ km, 25% too low. The lab's 5.59 km/s is a hair under half of 11.19, so it shows 2121 km." },
      { level: "hard", tag: "satellite energy", setup: { mode: "orbit", M: 1, R: 1, h: 6371, m: 500 }, watch: "Read 'energy from the ground' and check it against your answer",
        q: "How much energy must be given to a 500 kg satellite at rest on Earth's surface to put it in a circular orbit at height $h = R$? ($GM/R = 6.26\\times10^7$ J/kg, ignore Earth's spin.)",
        options: ["15.6 GJ", "23.5 GJ", "31.3 GJ", "7.8 GJ"], answer: 1,
        hints: ["Start: $E_1 = -GMm/R$ (at rest on the ground). End: $E_2 = -GMm/2r$ with $r = 2R$.", "$\\Delta E = GMm\\left(\\dfrac1R - \\dfrac1{4R}\\right) = \\tfrac34\\dfrac{GMm}{R}$."],
        explain: "$\\Delta E = \\tfrac34 \\times 500 \\times 6.26\\times10^7 = 2.35\\times10^{10}$ J $= 23.5$ GJ. 15.6 GJ only lifts it to $2R$ and forgets the orbital speed; 31.3 GJ would free it completely; 7.8 GJ is just its kinetic energy in orbit." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Launch", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    sim.on("step", function () { setTime(st.t); });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_escape = { apply: apply, sim: sim, state: function () { return { st: st, p: params(), t: theory(params()), o: orbitTheory(params()), vesc: vesc(params()), mode: mode }; } };
    }
    return function destroy() { sim.destroy(); [gh, gv, ge].forEach(function (gr) { gr.destroy(); }); };
  }
})();
