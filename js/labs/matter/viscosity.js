/* Properties of matter, lab 3: a ball sinking through a viscous liquid (Stokes' law, terminal velocity) and capillary rise. */
(function () {
  "use strict";
  var G = 9.8, COL = 1.0;                       // the column of liquid is 1 m deep
  var BALL_LIQS = {
    motor: { label: "Motor oil", rho: 880, eta: 0.29 }, castor: { label: "Castor oil", rho: 960, eta: 0.98 },
    glyc: { label: "Glycerine", rho: 1260, eta: 1.5 }, honey: { label: "Honey", rho: 1420, eta: 7.0 }
  };
  var MATS = { steel: { label: "Steel", rho: 7800 }, lead: { label: "Lead", rho: 11300 }, alu: { label: "Aluminium", rho: 2700 },
    glass: { label: "Glass", rho: 2500 }, plastic: { label: "Plastic", rho: 900 } };
  // T: surface tension (N/m), theta: contact angle with glass (°)
  var CAP_LIQS = { water: { label: "Water", T: 0.072, theta: 0, rho: 1000 }, ethanol: { label: "Ethanol", T: 0.022, theta: 0, rho: 789 },
    hg: { label: "Mercury", T: 0.465, theta: 140, rho: 13600 } };

  var lab = {
    id: "viscosity", chapter: "matter", title: "Viscosity & surface tension", short: "Stokes' law, terminal velocity, capillary rise",
    lede: "Drop a ball into thick oil and it soon stops speeding up: drag and buoyancy catch up with its weight. Then dip a thin glass tube in water and watch the liquid climb it by itself.",
    tries: [
      { id: "rsq", title: "Double the radius",
        text: "Time a ball between the marks, then use a ball of twice the radius (same metal, same liquid).",
        why: "$v_t = \\dfrac{2r^2(\\rho - \\sigma)g}{9\\eta}$ goes as $r^2$: twice the radius falls 4× as fast. Weight grows as $r^3$ but drag only as $r$." },
      { id: "above", title: "Arrive too fast",
        text: "Drop the ball from high enough that it hits the liquid faster than its terminal velocity.",
        why: "Now drag is bigger than weight minus buoyancy, so the net force points up and the ball slows down, towards the same $v_t$ from above. Terminal velocity doesn't care how you start." },
      { id: "depress", title: "Make the liquid go down the tube",
        text: "Dip the tube in mercury.",
        why: "Mercury meets glass at about 140°, so $\\cos\\theta < 0$ and $h = \\dfrac{2T\\cos\\theta}{r\\rho g}$ is negative: the meniscus bulges up and the level inside sits below the outside." },
      { id: "short", title: "Use a tube that's too short",
        text: "Make the tube stick out less than the height water would rise in it.",
        why: "The water stops at the top: no fountain. The meniscus just flattens until $R = \\dfrac{2T}{\\rho g \\ell}$, so the pull $2\\pi rT\\cos\\theta'$ matches the shorter column." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 540;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 380, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var mode = "ball", bliq = "castor", mat = "steel", cliq = "water", warp = 1;
    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Falling ball", value: "ball" }, { label: "Capillary rise", value: "cap" }], mode, function (v) { setMode(v); }, "Experiment");
    P.controls.appendChild(modeSeg);
    var ballBox = K.h("<div><h3>Liquid</h3></div>");
    var bliqSeg = K.seg(Object.keys(BALL_LIQS).map(function (k) { return { label: BALL_LIQS[k].label, value: k }; }), bliq, function (v) { bliq = v; reset(); }, "Liquid");
    ballBox.appendChild(bliqSeg);
    ballBox.appendChild(K.h('<p class="control-hint" data-liq></p>'));
    ballBox.appendChild(K.h("<h3>Ball</h3>"));
    var matSeg = K.seg(Object.keys(MATS).map(function (k) { return { label: MATS[k].label, value: k }; }), mat, function (v) { mat = v; reset(); }, "Ball material");
    ballBox.appendChild(matSeg);
    var rS = K.slider({ label: "Ball radius $r$", unit: "mm", min: 0.5, max: 6, step: 0.5, value: 3, onInput: reset });
    var hS = K.slider({ label: "Drop height above the surface", unit: "m", min: 0, max: 0.3, step: 0.01, value: 0, onInput: reset,
      hint: "A ball lighter than the liquid starts at the bottom instead." });
    ballBox.appendChild(rS.el); ballBox.appendChild(hS.el);
    ballBox.appendChild(K.check("Time-lapse ×5", false, function (v) { warp = v ? 5 : 1; }));
    P.controls.appendChild(ballBox);
    var capBox = K.h("<div><h3>Liquid</h3></div>");
    var cliqSeg = K.seg(Object.keys(CAP_LIQS).map(function (k) { return { label: CAP_LIQS[k].label, value: k }; }), cliq, function (v) { cliq = v; reset(); }, "Liquid");
    capBox.appendChild(cliqSeg);
    capBox.appendChild(K.h('<p class="control-hint" data-cliq></p>'));
    capBox.appendChild(K.h("<h3>Tube</h3>"));
    var rcS = K.slider({ label: "Tube radius $r$", unit: "mm", min: 0.1, max: 2, step: 0.05, value: 0.5, onInput: reset });
    var lS = K.slider({ label: "Tube length above the surface $\\ell$", unit: "mm", min: 5, max: 150, step: 1, value: 100, onInput: function () { cap.ell = lS.get() / 1000; kick(); },
      hint: "Or drag the top of the tube up and down." });
    capBox.appendChild(rcS.el); capBox.appendChild(lS.el);
    P.controls.appendChild(capBox);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>weight</span><span class="c-normal"><i></i>buoyancy</span><span class="c-fric"><i></i>viscous drag</span>' +
      '<span class="c-vel"><i></i>velocity</span><span class="c-ten"><i></i>surface tension</span></div>'));
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }

    /* ---------- ball physics ---------- */
    function bp() {
      var L = BALL_LIQS[bliq], r = rS.get() / 1000, rho = MATS[mat].rho;
      var tau = 2 * r * r * rho / (9 * L.eta);
      return { r: r, rho: rho, sig: L.rho, eta: L.eta, tau: tau, vt: 2 * r * r * (rho - L.rho) * G / (9 * L.eta), m: 4 / 3 * Math.PI * r * r * r * rho };
    }
    var ball, runs = [];
    // acceleration in the liquid: g(1 − σ/ρ) − v/τ (6πηr/m = 1/τ)
    function accL(p, v) { return G * (1 - p.sig / p.rho) - v / p.tau; }
    function advance(dt) {
      var p = bp(), n = Math.min(20000, Math.max(1, Math.ceil(dt / (p.tau / 20)))), h = dt / n;
      for (var i = 0; i < n; i++) {
        var t0 = ball.tm, step = h;
        if (ball.y < 0) {                                 // still falling through air: exact free fall, split at the surface
          var tc = (-ball.v + Math.sqrt(ball.v * ball.v - 2 * G * ball.y)) / G;
          if (tc > step) { ball.y += ball.v * step + 0.5 * G * step * step; ball.v += G * step; ball.tm += step; continue; }
          ball.v += G * tc; ball.y = 0; ball.tm += tc; step -= tc;
          ball.te = ball.tm; ball.u = ball.v;
        }
        // RK4 in the liquid
        var v = ball.v, y = ball.y;
        var k1v = accL(p, v), k1y = v;
        var k2v = accL(p, v + k1v * step / 2), k2y = v + k1v * step / 2;
        var k3v = accL(p, v + k2v * step / 2), k3y = v + k2v * step / 2;
        var k4v = accL(p, v + k3v * step), k4y = v + k3v * step;
        ball.v = v + step / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
        ball.y = y + step / 6 * (k1y + 2 * k2y + 2 * k3y + k4y);
        ball.tm = t0 + h;
        if (ball.te != null && ball.tm - ball.te <= 6 * p.tau && ball.fine.length < 600) ball.fine.push([(ball.tm - ball.te) * 1000, ball.v * 100]);
        // timing marks every 0.2 m
        [0.2, 0.4, 0.6, 0.8].forEach(function (mk) {
          if (ball.marks[mk] == null && (y - mk) * (ball.y - mk) <= 0 && y !== ball.y) ball.marks[mk] = ball.tm - h + h * (mk - y) / (ball.y - y);
        });
        if (Math.abs(ball.v) > 1.1 * Math.abs(p.vt) && ball.te != null && p.vt > 0 && ball.u > 1.1 * p.vt) ball.wasFast = true;
        if (ball.wasFast && Math.abs(ball.v - p.vt) < 0.02 * p.vt) tries.mark("above");
        if ((p.vt >= 0 && ball.y >= COL - p.r) || (p.vt < 0 && ball.y <= p.r) || ball.tm > 400) { ball.y = K.clamp(ball.y, p.r, COL - p.r); ball.done = true; break; }
      }
    }
    // the exact solution, for the dashed curves
    function vExact(t) {
      var p = bp(), te = p.vt < 0 ? 0 : Math.sqrt(2 * hS.get() / G), u = p.vt < 0 ? 0 : G * te;
      if (t < te) return G * t;
      return p.vt + (u - p.vt) * Math.exp(-(t - te) / p.tau);
    }
    function vFromMarks() {
      var m = ball.marks;
      return m[0.2] != null && m[0.8] != null ? 0.6 / (m[0.8] - m[0.2]) * (bp().vt < 0 ? -1 : 1) : null;
    }
    function finishBall() {
      sim.pause(); transportUI.render();
      var vm = vFromMarks(), p = bp();
      if (vm != null) {
        runs.push({ liq: bliq, mat: mat, r: rS.get(), vt: vm });
        if (runs.length > 60) runs.shift();
        var last = runs[runs.length - 1];
        if (runs.some(function (q) { return q !== last && q.liq === last.liq && q.mat === last.mat && (Math.abs(last.r - 2 * q.r) < 1e-9 || Math.abs(q.r - 2 * last.r) < 1e-9) &&
          Math.abs(Math.max(q.vt / last.vt, last.vt / q.vt) - 4) < 0.08; })) tries.mark("rsq");
      }
      K.flash(P.note, (p.vt < 0 ? "It rose to the top" : "It reached the bottom") + (vm != null ? ": timed between the marks, v = " + K.fmt(vm * 100, 2) + " cm/s" : ""), 4000);
      update(true);
    }

    /* ---------- capillary physics ---------- */
    var cap, TAU_C = 0.4;
    function cp() {
      var L = CAP_LIQS[cliq], r = rcS.get() / 1000, c = Math.cos(L.theta * K.DEG);
      return { r: r, T: L.T, theta: L.theta, cos: c, rho: L.rho, heq: 2 * L.T * c / (r * L.rho * G) };
    }
    function capTarget() { var p = cp(); return p.heq > 0 ? Math.min(p.heq, cap.ell) : p.heq; }
    function kick() { if (cap && mode === "cap") { cap.settled = false; if (cap.started && !sim.running) { sim.play(); transportUI.render(); } update(true); } }
    function stepCap(dt) {
      var target = capTarget();
      cap.h = target + (cap.h - target) * Math.exp(-dt / TAU_C);       // relaxes to where the pull balances the column
      cap.rec.push([cap.tm, cap.h * 1000, columnW(cap.h) * 1e6]);
      if (cap.rec.length > 2000) cap.rec.shift();
      if (Math.abs(cap.h - target) < 1e-8 && !cap.settled) {
        cap.h = target; cap.settled = true;
        var p = cp();
        cap.runs.push([rcS.get(), cap.h * 1000, cliq]);
        if (p.theta > 90) tries.mark("depress");
        if (p.heq > cap.ell + 1e-12) tries.mark("short");
        sim.pause(); transportUI.render();
        K.flash(P.note, p.heq > cap.ell ? "It stops at the top of the tube: the meniscus flattens instead" :
          (cap.h < 0 ? "It settles " + K.fmt(-cap.h * 1000, 2) + " mm below the outside level" : "It settles " + K.fmt(cap.h * 1000, 2) + " mm above the outside level"), 4000);
      }
    }
    function columnW(h) { var p = cp(); return p.rho * G * Math.PI * p.r * p.r * h; }

    /* ---------- reset + modes ---------- */
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      P.time.textContent = "t = 0.00 s";
      var p = bp();
      ball = { y: p.vt < 0 ? COL - p.r : -hS.get(), v: 0, tm: 0, te: p.vt < 0 ? 0 : (hS.get() === 0 ? 0 : null), u: 0, fine: [], rec: [[0, 0]], marks: {}, done: false, wasFast: false };
      if (ball.te === 0) ball.fine.push([0, 0]);
      var keep = cap ? cap.runs : [];
      cap = { h: 0, tm: 0, ell: lS.get() / 1000, rec: [[0, 0, 0]], runs: keep, settled: false, started: false };
      var L = BALL_LIQS[bliq], C = CAP_LIQS[cliq];
      ballBox.querySelector("[data-liq]").innerHTML = K.md("$\\sigma$ = " + L.rho + " kg/m³, $\\eta$ = " + L.eta + " Pa·s. Ball $\\rho$ = " + MATS[mat].rho + " kg/m³.");
      capBox.querySelector("[data-cliq]").innerHTML = K.md("$T$ = " + C.T + " N/m, contact angle " + C.theta + "°, $\\rho$ = " + C.rho + " kg/m³.");
      theory(); update(true);
    }
    function setMode(v) {
      mode = v; setSeg(modeSeg, v);
      ballBox.hidden = v !== "ball"; capBox.hidden = v !== "cap";
      transportUI.label = v === "ball" ? "Drop" : "Dip the tube";
      buildPanels(); reset();
    }
    sim.on("step", function () {
      if (mode === "ball") {
        if (ball.done) return;
        advance(K.DT * warp);
        ball.rec.push([ball.tm, ball.v * 100]);
        if (ball.done) finishBall();
      } else {
        cap.tm += K.DT;
        stepCap(K.DT);
      }
      P.time.textContent = "t = " + K.fmt(mode === "ball" ? ball.tm : cap.tm, 2) + " s";
      update(false);
    });

    /* ---------- drag the tube ---------- */
    var CS = 360, CPX = 2000;          // capillary: outside surface (px), px per metre of height (2 px per mm)
    var BS = 130, BPX = 380;           // ball column: surface (px), px per metre
    var dragTube = null;
    sim.pointer({
      down: function (pt) {
        if (mode !== "cap") return false;
        var top = CS - cap.ell * CPX;
        if (Math.abs(pt.px - 500) < 40 && Math.abs(pt.py - top) < 30) { dragTube = { off: pt.py - top }; return true; }
        return false;
      },
      drag: function (pt) {
        if (!dragTube) return;
        var ell = K.clamp(Math.round((CS - (pt.py - dragTube.off)) / CPX * 1000), 5, 150);
        lS.set(ell); cap.ell = ell / 1000; kick();
      },
      up: function () { dragTube = null; }
    });

    /* ---------- drawing ---------- */
    function liqCol(a) {
      if (mode === "cap") return cliq === "hg" ? K.alpha("#9aa3ad", a) : cliq === "ethanol" ? K.alpha("#9ec9e8", a) : K.alpha("#4a90d9", a);
      return { motor: K.alpha("#b8860b", a), castor: K.alpha("#d9b84a", a), glyc: K.alpha("#9cc7e4", a), honey: K.alpha("#d98a1e", a) }[bliq];
    }
    sim.on("under", function (ctx) { if (mode === "ball") drawBall(ctx, sim.u(1)); else drawCap(ctx, sim.u(1)); });
    function drawBall(ctx, u) {
      var p = bp(), x0 = 420, x1 = 580, bot = BS + COL * BPX;
      ctx.fillStyle = liqCol(0.45); ctx.fillRect(x0, BS, x1 - x0, bot - BS);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(x0, BS - 40); ctx.lineTo(x0, bot); ctx.lineTo(x1, bot); ctx.lineTo(x1, BS - 40); ctx.stroke();
      ctx.font = "600 " + 10 * u + "px 'JetBrains Mono', monospace"; ctx.textBaseline = "middle";
      [0.2, 0.4, 0.6, 0.8].forEach(function (mk) {
        var y = BS + mk * BPX;
        ctx.strokeStyle = th.muted; ctx.lineWidth = u; ctx.beginPath(); ctx.moveTo(x0 - 12, y); ctx.lineTo(x1 + 12, y); ctx.stroke();
        ctx.fillStyle = th.muted; ctx.textAlign = "right"; ctx.fillText(K.fmt(mk, 1) + " m", x0 - 16, y);
        ctx.textAlign = "left"; ctx.fillStyle = th.ink;
        if (ball.marks[mk] != null) ctx.fillText("t = " + K.fmt(ball.marks[mk], 2) + " s", x1 + 16, y);
      });
      K.label(ctx, BALL_LIQS[bliq].label, (x0 + x1) / 2, bot - 6, th.muted, { s: u * 0.9 });
      var vm = vFromMarks();
      if (vm != null) K.label(ctx, "0.6 m ÷ " + K.fmt(0.6 / Math.abs(vm), 2) + " s = " + K.fmt(Math.abs(vm) * 100, 2) + " cm/s", x1 + 16, BS + 0.5 * BPX + 6, th.vel, { s: u, align: "left", bg: true });
      // the ball (drawn bigger than life so you can see it)
      var R = 4 + rS.get() * 1.6, by = BS + ball.y * BPX, bx = 500;
      ctx.fillStyle = mat === "plastic" ? "#e8e2d0" : mat === "lead" ? "#5b6170" : mat === "glass" ? "#bfe3e0" : "#9aa3ad";
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // forces on the ball, to one scale
      var Wt = p.m * G, Bf = ball.y > 0 ? 4 / 3 * Math.PI * Math.pow(p.r, 3) * p.sig * G : 0, Fd = ball.y > 0 ? 6 * Math.PI * p.eta * p.r * ball.v : 0, kpn = 70 / Wt;
      sim.force(ctx, bx - 14, by, 0, -Wt, th.grav, "W", kpn, { lx: -22, ly: 10 });
      if (Bf > 0) sim.force(ctx, bx - 4, by - R, 0, Bf, th.normal, "B", kpn, { lx: -18 });
      if (Math.abs(Fd) > Wt * 0.01) sim.force(ctx, bx + 8, by - (Fd > 0 ? R : -R), 0, -Fd, th.fric, "6πηrv", kpn, { lx: 6 });
      if (Math.abs(ball.v) > 1e-4) K.arrow(ctx, bx + 48, by, bx + 48, by + K.clamp(ball.v / Math.max(Math.abs(p.vt), 1e-6), -1.5, 1.5) * 50, th.vel, { s: u, label: "v " + K.fmt(ball.v * 100, 2) + " cm/s" });
      K.label(ctx, "ball not to scale", 120, 520, th.muted, { s: u * 0.8, align: "left" });
      // terminal velocity reference
      K.label(ctx, "v_t = " + K.fmt(p.vt * 100, 2) + " cm/s", 120, 60, th.vel, { s: u, align: "left" });
      K.label(ctx, "τ = " + K.fmt(p.tau * 1000, 2) + " ms", 120, 82, th.muted, { s: u * 0.9, align: "left" });
    }
    function drawCap(ctx, u) {
      var p = cp(), bot = 500, x0 = 200, x1 = 800, hw = 5 + rcS.get() * 8, top = CS - cap.ell * CPX, tb = CS + 120;
      ctx.fillStyle = liqCol(0.4); ctx.fillRect(x0, CS, x1 - x0, bot - CS);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(x0, CS - 40); ctx.lineTo(x0, bot); ctx.lineTo(x1, bot); ctx.lineTo(x1, CS - 40); ctx.stroke();
      // liquid inside the tube, up to the meniscus
      var hy = CS - cap.h * CPX;
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(500 - hw, Math.min(hy, CS) - 4, 2 * hw, tb - Math.min(hy, CS) + 4);
      ctx.fillStyle = liqCol(0.55); ctx.fillRect(500 - hw, hy, 2 * hw, tb - hy);
      // meniscus: concave for θ < 90°, convex for mercury; flatter when the tube is too short
      var cosE = cap.h > 0 && Math.abs(cap.h - cap.ell) < 1e-9 && p.heq > cap.ell ? p.cos * cap.ell / p.heq : p.cos;
      var sag = hw * cosE * 0.9;
      ctx.fillStyle = liqCol(0.55); ctx.beginPath(); ctx.moveTo(500 - hw, hy); ctx.quadraticCurveTo(500, hy + sag * 2, 500 + hw, hy);
      ctx.lineTo(500 + hw, hy + Math.abs(sag) * 2 + 2); ctx.lineTo(500 - hw, hy + Math.abs(sag) * 2 + 2); ctx.closePath();
      if (sag > 0) { ctx.fillStyle = th["canvas-bg"]; ctx.beginPath(); ctx.moveTo(500 - hw, hy); ctx.quadraticCurveTo(500, hy + sag * 2, 500 + hw, hy); ctx.closePath(); }
      ctx.fill();
      ctx.strokeStyle = liqCol(1); ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(500 - hw, hy); ctx.quadraticCurveTo(500, hy + sag * 2, 500 + hw, hy); ctx.stroke();
      // the tube walls
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5 * u;
      ctx.beginPath(); ctx.moveTo(500 - hw - 3, top); ctx.lineTo(500 - hw - 3, tb); ctx.moveTo(500 + hw + 3, top); ctx.lineTo(500 + hw + 3, tb); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.fillRect(500 - hw - 8, top - 4, 2 * hw + 16, 4);
      K.label(ctx, "drag ↕", 500, top - 8, th.muted, { s: u * 0.8 });
      // height marker
      ctx.strokeStyle = K.alpha(th.disp, 0.6); ctx.setLineDash([4, 4]); ctx.lineWidth = u;
      ctx.beginPath(); ctx.moveTo(500 + hw + 6, CS); ctx.lineTo(640, CS); ctx.moveTo(500 + hw + 6, hy); ctx.lineTo(640, hy); ctx.stroke(); ctx.setLineDash([]);
      if (Math.abs(cap.h) > 0.0005) K.arrow(ctx, 630, CS, 630, hy, th.disp, { s: u, width: 2, label: "h = " + K.fmt(cap.h * 1000, 2) + " mm" });
      // pull of surface tension round the rim vs the column's weight
      if (Math.abs(cap.h) > 0.0005) {
        var Fp = columnW(cap.h);
        K.arrow(ctx, 500 - hw - 16, hy + 26, 500 - hw - 16, hy + 26 - Math.sign(Fp) * 26, th.ten, { s: u, label: "2πrT cosθ", lx: -96 });
        K.arrow(ctx, 500 + hw + 16, (hy + CS) / 2, 500 + hw + 16, (hy + CS) / 2 + Math.sign(Fp) * 26, th.grav, { s: u, label: Fp > 0 ? "column weight" : "ρgh from outside", lx: 6 });
      }
      K.label(ctx, CAP_LIQS[cliq].label + " · tube radius " + K.fmt(rcS.get(), 2) + " mm (drawn wider)", x0 + 8, bot - 6, th.muted, { s: u * 0.85, align: "left" });
      if (p.heq > 0 && p.heq <= 0.16) {
        var ye = CS - p.heq * CPX;
        ctx.strokeStyle = K.alpha(th.ten, 0.6); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(500 - hw - 40, ye); ctx.lineTo(500 - hw - 6, ye); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    /* ---------- graphs ---------- */
    var CAPS = {
      ball: ['<b class="c-vel">v–t</b> · levels off at the terminal velocity', '<b class="c-vel">the first 6τ, in ms</b> · $v = v_t + (u - v_t)e^{-t/\\tau}$', '<b class="c-vel">terminal velocity vs radius</b> · a parabola: $v_t \\propto r^2$; dots are your timed runs'],
      cap: ['<b class="c-disp">h–t</b> · the column climbs until the forces balance', '<b class="c-disp">h vs tube radius</b> · Jurin\'s law $h \\propto 1/r$; dots are your runs', '<b class="c-ten">forces (µN)</b> · column weight rises to meet the pull $2\\pi rT\\cos\\theta$']
    };
    P.graphs.innerHTML = [0, 1, 2].map(function () { return '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>'; }).join("");
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".graph-cap");
    var g1 = new K.Graph(cv[0], { yLabel: "", xMax: 1 }), g2 = new K.Graph(cv[1], { yLabel: "", xMax: 1 }), g3 = new K.Graph(cv[2], { yLabel: "", xMax: 1 });
    function opts(g, o) { g.o = o; g.clear(); g.extra = null; }
    function dots(ctx, X, Y, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }
    function theory() {
      CAPS[mode].forEach(function (c, i) { caps[i].innerHTML = K.md(c); });
      if (mode === "ball") {
        var p = bp(), tEnd = Math.min(120, Math.sqrt(2 * hS.get() / G) + Math.abs(COL / (p.vt || 1e-6)) * 1.05 + 5 * p.tau), vp = [], fp = [];
        opts(g1, { yLabel: "v (cm/s)", xMax: Math.max(1, tEnd), color: th.vel });
        for (var i = 0; i <= 300; i++) { var t = tEnd * i / 300; vp.push([t, vExact(t) * 100]); }
        g1.set("theory", { points: vp, color: th.vel, dash: [5, 5], width: 1.5 });
        var u = p.vt < 0 ? 0 : Math.sqrt(2 * G * hS.get());
        opts(g2, { yLabel: "v (cm/s)", xLabel: "t after entry (ms)", xMax: 6 * p.tau * 1000, color: th.vel });
        for (var j = 0; j <= 120; j++) { var s = 6 * p.tau * j / 120; fp.push([s * 1000, (p.vt + (u - p.vt) * Math.exp(-s / p.tau)) * 100]); }
        g2.set("theory", { points: fp, color: th.vel, dash: [5, 5], width: 1.5 });
        g2.set("vt", { points: [[0, p.vt * 100], [6 * p.tau * 1000, p.vt * 100]], color: K.alpha(th.muted, 0.6), width: 1 });
        opts(g3, { yLabel: "v_t (cm/s)", xLabel: "r (mm)", xMax: 6, color: th.vel });
        var rp = [];
        for (var r = 0; r <= 6.001; r += 0.1) rp.push([r, 2 * Math.pow(r / 1000, 2) * (p.rho - p.sig) * G / (9 * p.eta) * 100]);
        g3.set("theory", { points: rp, color: th.vel, dash: [5, 5], width: 1.5 });
      } else {
        var c = cp(), tgt = capTarget();
        opts(g1, { yLabel: "h (mm)", xMax: 4, xAuto: true, color: th.disp });
        g1.set("theory", { points: [[0, tgt * 1000], [4, tgt * 1000]], color: th.disp, dash: [5, 5], width: 1.5 });
        opts(g2, { yLabel: "h (mm)", xLabel: "r (mm)", xMax: 2, color: th.disp });
        var hp = [];
        for (var rr = 0.1; rr <= 2.0001; rr += 0.025) hp.push([rr, 2 * c.T * c.cos / (rr / 1000 * c.rho * G) * 1000]);
        g2.set("theory", { points: hp, color: th.disp, dash: [5, 5], width: 1.5 });
        opts(g3, { yLabel: "F (µN)", xMax: 4, xAuto: true, color: th.ten });
        var pull = 2 * Math.PI * c.r * c.T * c.cos * 1e6;
        g3.set("theory", { points: [[0, pull], [4, pull]], color: th.ten, dash: [5, 5], width: 1.5 });
      }
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      if (mode === "ball") {
        var p = bp();
        g1.set("sim", { points: ball.rec, color: th.vel, width: 2.5, dot: true });
        g2.set("sim", { points: ball.fine, color: th.vel, width: 2.5, dot: true });
        var mine = runs.filter(function (q) { return q.liq === bliq && q.mat === mat; });
        g3.extra = function (ctx, X, Y) { dots(ctx, X, Y, mine.map(function (q) { return [q.r, q.vt * 100]; }), th.vel); ring(ctx, X(rS.get()), Y(p.vt * 100)); };
      } else {
        var tE = Math.max(4, cap.tm), tg = capTarget() * 1000, pl = 2 * Math.PI * cp().r * cp().T * cp().cos * 1e6;
        g1.set("theory", { points: [[0, tg], [tE, tg]], color: th.disp, dash: [5, 5], width: 1.5 });
        g3.set("theory", { points: [[0, pl], [tE, pl]], color: th.ten, dash: [5, 5], width: 1.5 });
        g1.set("sim", { points: cap.rec.map(function (q) { return [q[0], q[1]]; }), color: th.disp, width: 2.5, dot: true });
        g3.set("sim", { points: cap.rec.map(function (q) { return [q[0], q[2]]; }), color: th.grav, width: 2.5, dot: true });
        var my = cap.runs.filter(function (q) { return q[2] === cliq; });
        g2.extra = function (ctx, X, Y) { dots(ctx, X, Y, my, th.disp); ring(ctx, X(rcS.get()), Y(cap.h * 1000)); };
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    var LABELS = {
      ball: ["Three forces on the ball", "Terminal velocity: the forces balance", "How quickly it gets there", "Is Stokes' law fair here?"],
      cap: ["Surface tension pulls up round the rim", "...and holds up the column", "Jurin's law: h × r is fixed", "If the tube is too short"]
    };
    var READ = {
      ball: [{ id: "v", label: "velocity now", cls: "c-vel" }, { id: "vt", label: "terminal velocity v_t", cls: "c-vel" }, { id: "vm", label: "timed between marks", cls: "c-vel" },
        { id: "tau", label: "time constant τ" }, { id: "F", label: "drag now", cls: "c-fric" }, { id: "Re", label: "Reynolds number" }],
      cap: [{ id: "h", label: "height h", cls: "c-disp" }, { id: "heq", label: "Jurin height", cls: "c-disp" }, { id: "pull", label: "max pull 2πrT cosθ", cls: "c-ten" },
        { id: "W", label: "column weight", cls: "c-grav" }, { id: "R", label: "meniscus radius R" }, { id: "th", label: "contact angle" }]
    };
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label"), setR = null;
    function buildPanels() { LABELS[mode].forEach(function (l, i) { eqLabels[i].textContent = l; eqEls[i]._tex = null; }); setR = K.readout(P.readouts, READ[mode]); }
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 1 : d) + ")"; }
    function renderMaths() {
      if (mode === "ball") {
        var p = bp(), inL = ball.y > 0, Wt = p.m * G, Bf = 4 / 3 * Math.PI * Math.pow(p.r, 3) * p.sig * G, Fd = inL ? 6 * Math.PI * p.eta * p.r * ball.v : 0;
        var Re = p.sig * Math.abs(p.vt) * 2 * p.r / p.eta;
        K.tex(eqEls[0], "W = \\tfrac43\\pi r^3\\rho g = \\mathbf{" + K.fmt(Wt * 1000, 3) + "},\\ B = \\tfrac43\\pi r^3\\sigma g = \\mathbf{" + K.fmt(Bf * 1000, 3) + "},\\ F = 6\\pi\\eta r v = \\mathbf{" + K.fmt(Fd * 1000, 3) + "}\\ \\text{mN}");
        K.tex(eqEls[1], "v_t = \\frac{2r^2(\\rho - \\sigma)g}{9\\eta} = \\frac{2" + B(p.r * 1000, 1) + "^2\\times10^{-6}" + B(p.rho - p.sig, 0) + B(G) + "}{9" + B(p.eta, 2) + "} = \\mathbf{" + K.fmt(p.vt * 100, 2) + "}\\ \\text{cm/s}");
        K.tex(eqEls[2], "\\tau = \\frac{2r^2\\rho}{9\\eta} = \\mathbf{" + K.fmt(p.tau * 1000, 2) + "}\\ \\text{ms},\\quad v = v_t + (u - v_t)e^{-t/\\tau}");
        K.tex(eqEls[3], "Re = \\frac{\\sigma v_t (2r)}{\\eta} = \\mathbf{" + K.fmt(Re, 2) + "}\\;" + (Re < 1 ? "\\lt 1:\\ \\text{smooth flow, Stokes holds}" : "\\gt 1:\\ \\text{only roughly}"));
        setR("v", K.fmt(ball.v * 100, 2) + " cm/s", inL ? "in the liquid" : ball.y < 0 ? "falling through air" : "");
        setR("vt", K.fmt(p.vt * 100, 2) + " cm/s", "2r²(ρ − σ)g / 9η");
        var vm = vFromMarks();
        setR("vm", vm == null ? "—" : K.fmt(vm * 100, 2) + " cm/s", "0.6 m between the 0.2 and 0.8 m marks");
        setR("tau", K.fmt(p.tau * 1000, 2) + " ms", "5τ to get within 1 %");
        setR("F", K.fmt(Fd * 1000, 3) + " mN", "W − B = " + K.fmt((Wt - Bf) * 1000, 3) + " mN");
        setR("Re", K.fmt(Re, 2), Re < 1 ? "Stokes' law holds" : "Stokes' law is only rough");
      } else {
        var c = cp(), pull = 2 * Math.PI * c.r * c.T * c.cos, short = c.heq > cap.ell, R = short ? 2 * c.T / (c.rho * G * cap.ell) : c.r / Math.abs(c.cos);
        K.tex(eqEls[0], "F = 2\\pi r T\\cos\\theta = 2\\pi" + B(c.r * 1000, 2) + "\\times10^{-3}" + B(c.T, 3) + "\\cos" + c.theta + "^\\circ = \\mathbf{" + K.fmt(pull * 1e6, 1) + "}\\ \\mu\\text{N}");
        K.tex(eqEls[1], "\\pi r^2 h\\rho g = F \\Rightarrow h = \\frac{2T\\cos\\theta}{r\\rho g} = \\frac{2" + B(c.T, 3) + B(c.cos, 3) + "}{" + B(c.r * 1000, 2) + "\\times10^{-3}" + B(c.rho, 0) + B(G) + "} = \\mathbf{" + K.fmt(c.heq * 1000, 2) + "}\\ \\text{mm}");
        K.tex(eqEls[2], "h\\,r = \\frac{2T\\cos\\theta}{\\rho g} = \\mathbf{" + K.fmt(c.heq * c.r * 1e6, 2) + "}\\ \\text{mm}^2\\ \\text{for any tube}");
        K.tex(eqEls[3], short ? "\\ell = " + K.fmt(cap.ell * 1000, 0) + "\\ \\text{mm} \\lt h:\\ \\text{it stops at the top, } R = \\frac{2T}{\\rho g\\ell} = \\mathbf{" + K.fmt(R * 1000, 2) + "}\\ \\text{mm}"
          : "\\ell = " + K.fmt(cap.ell * 1000, 0) + "\\ \\text{mm}" + (c.heq > 0 ? " \\gt h" : "") + ":\\ \\text{the tube is tall enough}");
        setR("h", K.fmt(cap.h * 1000, 2) + " mm", cap.h < 0 ? "below the outside level" : "above the outside level");
        setR("heq", K.fmt(c.heq * 1000, 2) + " mm", "2T cosθ / rρg");
        setR("pull", K.fmt(pull * 1e6, 1) + " µN"); setR("W", K.fmt(columnW(cap.h) * 1e6, 1) + " µN", "πr²hρg");
        setR("R", K.fmt(R * 1000, 2) + " mm", short ? "flattened: 2T/ρgℓ" : "r / cosθ");
        setR("th", (short && cap.settled ? K.fmt(Math.acos(Math.min(1, c.cos * cap.ell / c.heq)) / K.DEG, 1) : c.theta) + "°", short && cap.settled ? "adjusted at the rim" : "liquid on glass");
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A liquid resists layers sliding past each other: that's <b>viscosity</b> $\\eta$. A small sphere moving slowly through it feels <b class=\"c-fric\">Stokes' drag $F = 6\\pi\\eta r v$</b>, growing with speed. So a dropped ball speeds up only until weight = buoyancy + drag; after that it falls at the steady <b class=\"c-vel\">terminal velocity</b> $v_t = \\dfrac{2r^2(\\rho - \\sigma)g}{9\\eta}$.</p>" +
      "<p>A liquid surface acts like a stretched skin with <b class=\"c-ten\">surface tension</b> $T$ (force per length). Where it meets a glass tube at contact angle $\\theta$ it pulls along the rim with $2\\pi r T\\cos\\theta$, and lifts a column until its weight $\\pi r^2 h\\rho g$ matches: $h = \\dfrac{2T\\cos\\theta}{r\\rho g}$. Thinner tube, higher rise.</p>" +
      '<div class="trap"><b>JEE trap: a short capillary never overflows.</b> If the tube is shorter than $h$, the liquid reaches the top and stops; the meniscus radius grows so that $hR$ stays $2T/\\rho g$. And for $v_t$, remember the buoyancy: it\'s $(\\rho - \\sigma)$, not $\\rho$.</div>');
    function apply(s) {
      if (s.mode === "ball") { bliq = s.liq; setSeg(bliqSeg, bliq); mat = s.mat; setSeg(matSeg, mat); rS.set(s.r); hS.set(s.h0 || 0); }
      else { cliq = s.liq; setSeg(cliqSeg, cliq); rcS.set(s.r); lS.set(s.ell); }
      setMode(s.mode);
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "capillary rise", setup: { mode: "cap", liq: "water", r: 0.5, ell: 100 }, watch: "Predict h, then press Dip the tube",
        q: "How high does water rise in a clean glass capillary of radius 0.5 mm? ($T = 0.072$ N/m, contact angle 0°, $g = 9.8$)",
        options: ["14.7 mm", "29.4 mm", "58.8 mm", "2.94 mm"], answer: 1,
        explain: "$h = \\dfrac{2T\\cos\\theta}{r\\rho g} = \\dfrac{2 \\times 0.072 \\times 1}{5 \\times 10^{-4} \\times 1000 \\times 9.8} = 0.0294$ m $= 29.4$ mm. Dropping the 2 gives 14.7 mm; using the diameter in place of the radius halves it too." },
      { level: "medium", tag: "terminal velocity", setup: { mode: "ball", liq: "glyc", mat: "steel", r: 2, h0: 0 }, watch: "Predict v_t, then press Drop and read the timed speed",
        q: "A steel ball of radius 2 mm ($\\rho = 7800$ kg/m³) is dropped into glycerine ($\\sigma = 1260$ kg/m³, $\\eta = 1.5$ Pa·s). What is its terminal velocity ($g = 9.8$)?",
        options: ["3.80 cm/s", "4.53 cm/s", "15.2 cm/s", "1.90 cm/s"], answer: 0,
        hints: ["At terminal velocity weight = buoyancy + drag: $\\tfrac43\\pi r^3\\rho g = \\tfrac43\\pi r^3\\sigma g + 6\\pi\\eta r v_t$.", "Solve for $v_t$ and keep the $(\\rho - \\sigma)$: the liquid pushes up too."],
        explain: "$v_t = \\dfrac{2r^2(\\rho - \\sigma)g}{9\\eta} = \\dfrac{2(2 \\times 10^{-3})^2(6540)(9.8)}{9 \\times 1.5} = 0.0380$ m/s. Forgetting buoyancy (using $\\rho$ alone) gives 4.53 cm/s; using the diameter as $r$ gives 4× too much, 15.2 cm/s." },
      { level: "hard", tag: "tube too short", setup: { mode: "cap", liq: "water", r: 0.5, ell: 20 }, watch: "Predict, then press Dip the tube and read R",
        q: "Water would rise 29.4 mm in a capillary of radius 0.5 mm ($T = 0.072$ N/m, $g = 9.8$). The tube sticks out only 20 mm above the water. What happens?",
        options: ["Water overflows from the top like a small fountain", "It rises to the top (20 mm) and the meniscus radius becomes 0.73 mm", "It rises to the top and the meniscus radius stays 0.50 mm", "It rises only to 13.6 mm, the rest of the way being blocked"], answer: 1,
        hints: ["Overflowing would give free energy for ever. Surface tension can only hold a column, not pump one.", "At the top, the column's weight $\\pi r^2\\ell\\rho g$ must equal $2\\pi rT\\cos\\theta'$, and the meniscus radius is $R = r/\\cos\\theta'$."],
        explain: "It stops at the top. Balance: $2\\pi r T\\cos\\theta' = \\pi r^2 \\ell \\rho g$, so $R = \\dfrac{r}{\\cos\\theta'} = \\dfrac{2T}{\\rho g \\ell} = \\dfrac{0.144}{1000 \\times 9.8 \\times 0.02} = 7.35 \\times 10^{-4}$ m $= 0.73$ mm, and the contact angle at the rim opens to $\\cos^{-1}(0.5/0.735) = 47°$. Note $h R$ is the same $2T/\\rho g$ in both cases." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = K.transport(P, sim, { playLabel: "Drop", onReset: reset,
      onPlay: function () {
        if (mode === "ball" && ball.done) reset();
        if (mode === "cap") { if (cap.settled && Math.abs(cap.h - capTarget()) < 1e-9) reset(); cap.started = true; }
      } });
    var baseRender = transportUI.render;
    transportUI.render = function () { baseRender(); if (!sim.running && transportUI.label) P.playBtn.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>' + transportUI.label; };
    P.playBtn.addEventListener("click", function () { transportUI.render(); });
    setMode("ball"); transportUI.render();

    if (location.hostname === "localhost") {
      window.__lab_viscosity = {
        apply: apply, ball: function () { return ball; }, cap: function () { return cap; }, bp: bp, cp: cp, vFromMarks: vFromMarks, vExact: vExact, runs: function () { return runs; },
        dragTubeTo: function (ell) {   // ell in mm
          var r = P.canvas.getBoundingClientRect(), top = CS - cap.ell * CPX, ev = function (type, y) { P.canvas.dispatchEvent(new PointerEvent(type, { clientX: r.left + 500 * sim.scale, clientY: r.top + y * sim.scale, pointerId: 3, bubbles: true })); };
          ev("pointerdown", top); var y1 = CS - ell / 1000 * CPX; ev("pointermove", (top + y1) / 2); ev("pointermove", y1); ev("pointerup", y1);
        }
      };
    }

    return function destroy() { sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); }); if (window.__lab_viscosity) delete window.__lab_viscosity; };
  }
})();
