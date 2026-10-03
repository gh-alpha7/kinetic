/* Rotational motion, lab 3: rolling without slipping. Race shapes down a slope; friction spins them up, unless it can't. */
(function () {
  "use strict";
  var G = 9.8, LS = 5, BX = 5;                // slope length (m), x of the slope's foot (m)
  var BODIES = {
    solid: { name: "Solid sphere", short: "sphere", beta: 2 / 5, frac: "\\tfrac25", color: "app" },
    disc: { name: "Disc", short: "disc", beta: 1 / 2, frac: "\\tfrac12", color: "disp" },
    hollow: { name: "Hollow sphere", short: "shell", beta: 2 / 3, frac: "\\tfrac23", color: "normal" },
    ring: { name: "Ring", short: "ring", beta: 1, frac: "1", color: "ten" },
    block: { name: "Sliding block", short: "block", beta: 0, frac: "0", color: "muted" }
  };
  var ORDER = ["block", "solid", "disc", "hollow", "ring"];

  var lab = {
    id: "rolling", chapter: "rotation", title: "Rolling without slipping", short: "a = g sinθ/(1 + I/mr²), friction that does no work",
    lede: "Let a ring, a disc, two spheres and a frictionless block go together down the same slope. The winner isn't the heaviest or the biggest: it's the one that wastes the least energy on spinning.",
    tries: [
      { id: "race", title: "Run the full race",
        text: "Race all five down the slope and note the finishing order.",
        why: "$a = g\\sin\\theta/(1 + \\beta)$ with $\\beta = I/mr^2$: block (0), solid sphere ($\\tfrac25$), disc ($\\tfrac12$), hollow sphere ($\\tfrac23$), ring (1). The block has nothing to spin, so all its energy goes into speed." },
      { id: "mass", title: "Show that mass and size don't matter",
        text: "Roll the same shape twice at the same angle, changing only its mass or radius.",
        why: "Both $m$ and $r$ cancel in $I/mr^2$: every solid sphere, marble or bowling ball, rolls down with $a = \\tfrac57 g\\sin\\theta$. Only the shape counts." },
      { id: "slip", title: "Make it skid",
        text: "Make the rolling body slip: lower $\\mu$ or steepen the slope until friction can't keep up.",
        why: "Rolling needs $f = mg\\sin\\theta\\,\\frac{\\beta}{1+\\beta}$, but friction can't exceed $\\mu mg\\cos\\theta$. Past $\\tan\\theta > \\mu(1+\\beta)/\\beta$ it slides: $a = g(\\sin\\theta - \\mu\\cos\\theta)$, the spin lags, and friction now turns energy into heat." },
      { id: "edge", title: "Find the minimum friction",
        text: "Get it to roll with $\\mu$ no more than 0.02 above the minimum it needs.",
        why: "$\\mu_{min} = \\frac{\\beta}{1+\\beta}\\tan\\theta$. The ring needs the most ($\\tfrac12\\tan\\theta$): more of its job is spinning, so friction has to supply more torque." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 100, origin = { x: 70, y: 490 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: G, gridStep: 0.5, gridMajor: 5, yLabels: false, labels: false });

    /* ---------- controls ---------- */
    var main = "solid", race = true, show = { forces: true };
    var thS = K.slider({ label: "Slope angle $\\theta$", unit: "°", min: 5, max: 60, step: 1, value: 30, onInput: reset, hint: "Or drag the top of the slope." });
    var muS = K.slider({ label: "Friction $\\mu$ (static = kinetic)", min: 0, max: 1, step: 0.01, value: 0.5, onInput: reset });
    var mS = K.slider({ label: "Mass $m$", unit: "kg", min: 1, max: 10, step: 0.5, value: 2, onInput: reset });
    var rS = K.slider({ label: "Radius $r$", unit: "m", min: 0.1, max: 0.4, step: 0.05, value: 0.25, onInput: reset });
    P.controls.innerHTML = "<h3>Your body</h3>";
    var bodySeg = K.seg(ORDER.map(function (k) { return { label: BODIES[k].name, value: k }; }), main, function (v) { main = v; reset(); }, "Body");
    P.controls.appendChild(bodySeg);
    [mS, rS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>The slope</h3>"));
    [thS, muS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h('<p class="control-hint">The block is always frictionless: it slides, it can\'t roll.</p>'));
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Race the others", true, function (v) { race = v; reset(); }));
    row.appendChild(K.check("Forces", true, function (v) { show.forces = v; }));
    P.controls.appendChild(row);
    P.controls.appendChild(K.h('<div class="legend">' + ORDER.map(function (k) { return '<span class="c-' + BODIES[k].color + '"><i></i>' + BODIES[k].short + "</span>"; }).join("") +
      '<span class="c-grav"><i></i>weight</span><span class="c-normal"><i></i>normal</span><span class="c-fric"><i></i>friction</span><span class="c-vel"><i></i>velocity</span></div>'));
    function col(k) { return th[BODIES[k].color]; }

    function params() { return { th: thS.get() * K.DEG, deg: thS.get(), mu: muS.get(), m: mS.get(), r: rS.get() }; }
    // a body's motion on this slope: rolls if friction can supply the torque it needs, else slips
    function solve(k, p) {
      var b = BODIES[k].beta, s = Math.sin(p.th), c = Math.cos(p.th), N = p.m * G * c;
      if (b === 0) return { beta: 0, a: G * s, alpha: 0, f: 0, N: N, fNeed: 0, fMax: 0, slip: false, block: true, muMin: 0 };
      var fNeed = p.m * G * s * b / (1 + b), fMax = p.mu * N, muMin = Math.tan(p.th) * b / (1 + b);
      if (fNeed <= fMax + 1e-9) { var a = G * s / (1 + b); return { beta: b, a: a, alpha: a / p.r, f: fNeed, N: N, fNeed: fNeed, fMax: fMax, slip: false, muMin: muMin }; }
      return { beta: b, a: G * (s - p.mu * c), alpha: p.mu * G * c / (b * p.r), f: fMax, N: N, fNeed: fNeed, fMax: fMax, slip: true, muMin: muMin };
    }

    /* ---------- the race: each body steps with its own constant a and α ---------- */
    var racers, st, rec, runs = [];
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params(), keys = race ? ORDER.slice() : [main];
      if (keys.indexOf(main) > 0) { keys.splice(keys.indexOf(main), 1); keys.push(main); }   // draw yours on top
      racers = keys.map(function (k) { return { k: k, sol: solve(k, p), s: 0, v: 0, phi: 0, w: 0, done: false, t: null, vEnd: null, aMeas: null }; });
      st = { p: p, main: racers.filter(function (q) { return q.k === main; })[0], done: false, order: [] };
      rec = { t: [0], v: {}, tr: [0], rot: [0], heat: [0], pe: [0] };
      racers.forEach(function (q) { rec.v[q.k] = [0]; });
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }

    sim.on("before", function () {
      racers.forEach(function (q) {
        if (q.done) return;
        var a = q.sol.a, al = q.sol.alpha, dt = K.DT, v0 = q.v;
        q.sPrev = q.s; q.vPrev = q.v; q.phiPrev = q.phi; q.wPrev = q.w;
        q.s += q.v * dt + 0.5 * a * dt * dt; q.v += a * dt;
        q.phi += q.w * dt + 0.5 * al * dt * dt; q.w += al * dt;
        q.aMeas = (q.v - v0) / dt;
      });
    });
    sim.on("step", function (t) {
      var p = st.p;
      racers.forEach(function (q) {
        if (q.done || q.s < LS) return;
        // back up to the exact moment it crossed the line: s_prev + v_prev tau + a tau^2/2 = LS
        var a = q.sol.a, al = q.sol.alpha, tau = (-q.vPrev + Math.sqrt(q.vPrev * q.vPrev + 2 * a * (LS - q.sPrev))) / a, tc = t - K.DT + tau;
        q.v = q.vPrev + a * tau; q.phi = q.phiPrev + q.wPrev * tau + 0.5 * al * tau * tau; q.w = q.wPrev + al * tau; q.s = LS;
        q.done = true; q.t = tc; q.vEnd = q.v; st.order.push(q.k);
      });
      var M = st.main, I = M.sol.beta * p.m * p.r * p.r;
      rec.t.push(t);
      racers.forEach(function (q) { rec.v[q.k].push(q.v); });
      rec.tr.push(0.5 * p.m * M.v * M.v); rec.rot.push(0.5 * I * M.w * M.w);
      rec.heat.push(M.sol.f * (M.s - p.r * M.phi) * (M.sol.slip ? 1 : 0)); rec.pe.push(p.m * G * M.s * Math.sin(p.th));
      if (racers.every(function (q) { return q.done; })) finish();
      update(st.done);
    });

    function finish() {
      if (st.done) return;
      st.done = true; sim.pause(); transportUI.render();
      var p = st.p, M = st.main;
      K.flash(P.note, racers.length > 1 ? "Order: " + st.order.map(function (k) { return BODIES[k].short; }).join(", ") : BODIES[main].name + ": " + K.fmt(M.t, 2) + " s");
      if (racers.length === ORDER.length) tries.mark("race");
      var run = { k: main, deg: p.deg, mu: p.mu, m: p.m, r: p.r, a: M.aMeas, t: M.t, slip: M.sol.slip };
      if (M.sol.slip) tries.mark("slip");
      if (!M.sol.slip && M.sol.beta > 0 && p.mu - M.sol.muMin <= 0.02 + 1e-9) tries.mark("edge");
      runs.forEach(function (q) {
        if (q.k === run.k && q.deg === run.deg && !q.slip && !run.slip && (q.m !== run.m || q.r !== run.r) && Math.abs(q.t - run.t) < 0.01) tries.mark("mass");
      });
      runs.push(run); if (runs.length > 80) runs.shift();
    }

    /* ---------- geometry ---------- */
    function top(p) { return { x: BX - LS * Math.cos(p.th), y: LS * Math.sin(p.th) }; }
    function centre(q, p) {   // contact point s along the slope, then out along the normal by r
      var T = top(p), c = Math.cos(p.th), s = Math.sin(p.th), r = p.r;
      return { x: T.x + q.s * c + r * s, y: T.y - q.s * s + r * c, cx: T.x + q.s * c, cy: T.y - q.s * s };
    }

    /* ---------- drag the top of the slope to change its angle ---------- */
    var dragging = false;
    sim.pointer({
      down: function (pt) {
        var T = top(params());
        if (Math.hypot(pt.m.x - T.x, pt.m.y - T.y) > 0.5) return false;
        dragging = true; P.canvas.style.cursor = "grabbing"; return true;
      },
      drag: function (pt) {
        var a = Math.atan2(Math.max(0.01, pt.m.y), Math.max(0.01, BX - pt.m.x)) / K.DEG;
        thS.set(K.clamp(Math.round(a), 5, 60)); reset();
      },
      up: function () { dragging = false; P.canvas.style.cursor = ""; },
      hover: function (pt) { var T = top(params()); P.canvas.style.cursor = Math.hypot(pt.m.x - T.x, pt.m.y - T.y) < 0.5 ? "grab" : ""; }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      sim.drawGround(ctx);
      var p = st.p, T = top(p), a = sim.px(T.x, T.y), b = sim.px(BX, 0), c = sim.px(T.x, 0);
      ctx.fillStyle = th.bank; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5);
      ctx.beginPath(); ctx.arc(b.x, b.y, sim.u(36), Math.PI, Math.PI + p.th, false); ctx.stroke();
      K.label(ctx, p.deg + "°", b.x - sim.u(48), b.y - sim.u(4), th.ink, { s: sim.u(1), align: "right" });
      ctx.fillStyle = dragging ? th.app : th.ink; ctx.beginPath(); ctx.arc(a.x, a.y, sim.u(6), 0, Math.PI * 2); ctx.fill();
      var inside = T.x < 0.9;
      K.label(ctx, "h = " + K.fmt(T.y, 2) + " m", c.x + (inside ? 1 : -1) * sim.u(8), (a.y + c.y) / 2 + (inside ? sim.u(40) : 0), th.muted, { s: sim.u(0.9), align: inside ? "left" : "right" });
      // finish line
      ctx.strokeStyle = th.good; ctx.lineWidth = sim.u(3);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.sin(p.th) * sim.u(60), b.y - Math.cos(p.th) * sim.u(60)); ctx.stroke();
      racers.forEach(function (q, i) { drawBody(ctx, q, p, q.k !== main, i); });
    });
    function drawBody(ctx, q, p, ghost, i) {
      var c = centre(q, p), cp = sim.px(c.x, c.y), R = p.r * ppm, color = col(q.k);
      ctx.save(); ctx.globalAlpha = ghost ? 0.5 : 1;
      ctx.translate(cp.x, cp.y);
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
      if (q.k === "block") {
        ctx.rotate(p.th); ctx.fillStyle = color;
        ctx.fillRect(-R, -R, 2 * R, 2 * R); ctx.strokeRect(-R, -R, 2 * R, 2 * R);
      } else {
        ctx.rotate(q.phi);
        if (q.k === "ring" || q.k === "hollow") {
          ctx.fillStyle = K.alpha(color, q.k === "hollow" ? 0.25 : 0.08);
          ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = color; ctx.lineWidth = Math.max(sim.u(3), R * (q.k === "ring" ? 0.22 : 0.12));
          ctx.beginPath(); ctx.arc(0, 0, R - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (q.k === "solid") { ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.3, R * 0.35, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R); ctx.stroke();                 // spin marker
      }
      ctx.restore();
      if (ghost && q.s > 0.4) K.label(ctx, BODIES[q.k].short, cp.x, cp.y - R - sim.u(4 + 13 * (i % 3)), color, { s: sim.u(0.85) });
    }
    sim.on("over", function (ctx) {
      var p = st.p, M = st.main, sol = M.sol, c = centre(M, p), cp = sim.px(c.x, c.y), con = sim.px(c.cx, c.cy);
      var kpn = 70 / (p.m * G), sn = Math.sin(p.th), cs = Math.cos(p.th);
      if (show.forces) {
        sim.force(ctx, cp.x, cp.y, 0, -p.m * G, th.grav, "mg " + K.fmt(p.m * G, 1) + " N", kpn, { lx: 6, ly: 12 });
        sim.force(ctx, con.x, con.y, sol.N * sn, sol.N * cs, th.normal, "N " + K.fmt(sol.N, 1), kpn, { lx: 8 });
        if (sol.f > 0.01) sim.force(ctx, con.x, con.y, -sol.f * cs, sol.f * sn, th.fric, "f " + K.fmt(sol.f, 1) + (sol.slip ? " (sliding)" : " (static)"), kpn, { lx: -130, ly: -12 });
      }
      if (M.v > 0.02) {
        var len = Math.min(M.v, 8) * sim.u(14), ox = cp.x, oy = cp.y - p.r * ppm - sim.u(16);
        K.arrow(ctx, ox, oy, ox + len * cs, oy + len * sn, th.vel, { s: sim.u(1), label: "v " + K.fmt(M.v, 2) });
      }
      if (sol.slip && M.v > 0.05) K.label(ctx, "slipping: ωr = " + K.fmt(M.w * p.r, 2) + " < v", cp.x, cp.y + p.r * ppm + sim.u(30), th.fric, { s: sim.u(1), bg: true });
      // finishing times
      var y = 20;
      racers.slice().sort(function (a, b) { return (a.t || 99) - (b.t || 99); }).forEach(function (q) {
        if (!q.done) return;
        K.label(ctx, BODIES[q.k].short + " " + K.fmt(q.t, 2) + " s", sim.view().x1 - sim.u(14), sim.u(y + 16), col(q.k), { s: sim.u(1), align: "right", bg: true });
        y += 22;
      });
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v–t</b> · one straight line per body; steeper wins. Dashed: $g\\sin\\theta\\,t/(1+\\beta)$ for yours</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">a vs slope angle</b> · for your body and $\\mu$; the kink is where it starts to slip. Dots are your runs</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">energy</b> · $mgh$ lost (dashed) = <b class="c-vel">½mv²</b> + <b class="c-acc">½Iω²</b> + <b class="c-fric">heat</b> (only when slipping)</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (cp) { cp.innerHTML = K.md(cp.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gv = new K.Graph(cv[0], { yLabel: "v (m/s)", xMax: 1, xAuto: true, yMin: 0, color: th.vel });
    var ga = new K.Graph(cv[1], { yLabel: "a (m/s²)", xLabel: "θ (°)", xMax: 60, yMin: 0, color: th.acc });
    var ge = new K.Graph(cv[2], { yLabel: "E (J)", xMax: 1, xAuto: true, yMin: 0, color: th.grav });

    function theory() {
      var p = params(), pts = [];
      for (var d = 0; d <= 60 + 1e-9; d += 0.5) pts.push([d, Math.max(0, solve(main, Object.assign({}, p, { th: d * K.DEG })).a)]);
      ga.set("theory", { points: pts, color: th.acc, dash: [5, 5], width: 1.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = st.p, M = st.main, tEnd = rec.t[rec.t.length - 1];
      gv.clear();
      racers.forEach(function (q) {
        gv.set(q.k, { points: rec.t.map(function (t, i) { return [t, rec.v[q.k][i]]; }), color: col(q.k), width: q.k === main ? 2.5 : 1.5, dot: q.k === main });
      });
      var tLine = M.done ? M.t : tEnd;
      gv.set("theory", { points: [[0, 0], [tLine, M.sol.a * tLine]], color: col(main), dash: [5, 5], width: 1.5 });
      var mine = runs.filter(function (r) { return r.k === main && r.mu === p.mu; });
      ga.extra = function (ctx, X, Y) {
        ctx.fillStyle = th.acc; mine.forEach(function (r) { ctx.beginPath(); ctx.arc(X(r.deg), Y(r.a), 4.5, 0, Math.PI * 2); ctx.fill(); });
        ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(p.deg), Y(M.sol.a), 6, 0, Math.PI * 2); ctx.stroke();
      };
      var pts = function (arr) { return rec.t.map(function (t, i) { return [t, arr[i]]; }); };
      ge.set("pe", { points: pts(rec.pe), color: th.grav, dash: [5, 5], width: 1.5 });
      ge.set("tr", { points: pts(rec.tr), color: th.vel, width: 2.5, dot: true });
      ge.set("rot", { points: pts(rec.rot), color: th.acc, width: 2.5, dot: true });
      ge.set("heat", { points: M.sol.slip ? pts(rec.heat) : [], color: th.fric, width: 2.5, dot: true });
      [gv, ga, ge].forEach(function (g) { g.dirty = true; g.draw(); });
      P.hud.innerHTML = "<span>" + BODIES[main].name + " · I/mr² = " + K.fmt(M.sol.beta, 3) + "</span><span>" +
        (M.sol.block ? "frictionless: slides" : M.sol.slip ? "slips: μ < μmin = " + K.fmt(M.sol.muMin, 3) : "rolls: μmin = " + K.fmt(M.sol.muMin, 3)) + "</span>";
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Along the slope, and τ = Iα about the centre", "Your body's acceleration", "Friction it needs, and what the slope can give", "Energy at the bottom of the 5 m slope"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "a", label: "acceleration", cls: "c-acc" }, { id: "f", label: "friction", cls: "c-fric" }, { id: "mu", label: "minimum μ to roll", cls: "c-fric" },
      { id: "v", label: "speed now", cls: "c-vel" }, { id: "rot", label: "rotational share of KE", cls: "c-acc" }, { id: "t", label: "time to the bottom" }
    ]);
    function B(v, d) { return "(" + K.fmt(v, d === undefined ? 2 : d) + ")"; }
    function renderMaths() {
      var p = st.p, M = st.main, s = M.sol, b = BODIES[main], h = LS * Math.sin(p.th);
      var sn = K.fmt(Math.sin(p.th), 3), cs = K.fmt(Math.cos(p.th), 3);
      if (s.block) {
        K.tex(eqEls[0], "mg\\sin\\theta = ma \\quad(\\text{no friction, nothing to spin})");
        K.tex(eqEls[1], "a = g\\sin\\theta = (9.8)(" + sn + ") = \\mathbf{" + K.fmt(s.a, 2) + "}\\ \\text{m/s}^2");
        K.tex(eqEls[2], "f = 0, \\quad \\beta = I/mr^2 = 0");
      } else {
        K.tex(eqEls[0], "mg\\sin\\theta - f = ma,\\quad f r = I\\alpha,\\quad I = " + b.frac + " mr^2");
        K.tex(eqEls[1], s.slip
          ? "\\text{slips: } a = g(\\sin\\theta - \\mu\\cos\\theta) = (9.8)(" + sn + " - " + K.fmt(p.mu, 2) + " \\times " + cs + ") = \\mathbf{" + K.fmt(s.a, 2) + "}\\ \\text{m/s}^2,\\ \\alpha = \\frac{\\mu g\\cos\\theta}{\\beta r} = \\mathbf{" + K.fmt(s.alpha, 2) + "}\\ \\text{rad/s}^2"
          : "a = \\alpha r \\Rightarrow a = \\frac{g\\sin\\theta}{1 + I/mr^2} = \\frac{(9.8)(" + sn + ")}{1 + " + K.fmt(s.beta, 3) + "} = \\mathbf{" + K.fmt(s.a, 2) + "}\\ \\text{m/s}^2");
        K.tex(eqEls[2], "f_{need} = mg\\sin\\theta\\,\\frac{\\beta}{1+\\beta} = \\mathbf{" + K.fmt(s.fNeed, 2) + "}\\ \\text{N}\\ " + (s.slip ? ">" : "\\le") + "\\ \\mu mg\\cos\\theta = " + K.fmt(s.fMax, 2) +
          "\\ \\text{N};\\quad \\mu_{min} = \\frac{\\beta\\tan\\theta}{1+\\beta} = \\mathbf{" + K.fmt(s.muMin, 3) + "}");
      }
      var vEnd = Math.sqrt(2 * s.a * LS);
      K.tex(eqEls[3], s.slip
        ? "v = \\sqrt{2aL} = \\mathbf{" + K.fmt(vEnd, 2) + "}\\ \\text{m/s};\\ \\text{heat} = f\\,(L - r\\varphi) = \\mathbf{" + K.fmt(s.f * (LS - p.r * s.alpha * LS / s.a), 2) + "}\\ \\text{J}"
        : "mgh = \\tfrac12 mv^2(1 + \\beta) \\Rightarrow v = \\sqrt{\\frac{2gh}{1+\\beta}} = \\sqrt{\\frac{2(9.8)" + B(h) + "}{" + K.fmt(1 + s.beta, 3) + "}} = \\mathbf{" + K.fmt(vEnd, 2) + "}\\ \\text{m/s}");
      var meas = M.aMeas !== null;
      setR("a", K.fmt(meas ? M.aMeas : s.a, 2) + " m/s²", meas ? "measured · formula " + K.fmt(s.a, 2) : "formula");
      setR("f", K.fmt(s.f, 2) + " N", s.block ? "frictionless" : s.slip ? "kinetic, μN (it slips)" : "static, needed " + K.fmt(s.fNeed, 2) + " of max " + K.fmt(s.fMax, 2));
      setR("mu", s.block ? "—" : K.fmt(s.muMin, 3), s.block ? "" : "you have " + K.fmt(p.mu, 2));
      setR("v", K.fmt(M.v, 2) + " m/s", M.done ? "at the bottom · formula " + K.fmt(vEnd, 2) : "ωr = " + K.fmt(M.w * p.r, 2));
      var KEt = 0.5 * p.m * M.v * M.v, KEr = 0.5 * s.beta * p.m * p.r * p.r * M.w * M.w;
      setR("rot", (KEt + KEr > 1e-9 ? K.fmt(100 * KEr / (KEt + KEr), 1) : K.fmt(s.slip ? 0 : 100 * s.beta / (1 + s.beta), 1)) + " %", s.slip ? "less than rolling's " + K.fmt(100 * s.beta / (1 + s.beta), 1) + " %" : "β/(1+β) = " + K.fmt(100 * s.beta / (1 + s.beta), 1) + " %");
      setR("t", K.fmt(M.done ? M.t : Math.sqrt(2 * LS / s.a), 2) + " s", M.done ? "measured · formula " + K.fmt(Math.sqrt(2 * LS / s.a), 2) : "formula √(2L/a)");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A body that rolls without slipping has its contact point momentarily at rest, so its speed and spin are locked together: $v = \\omega r$, $a = \\alpha r$. Going downhill, gravity has to pay for both, the speeding up <i>and</i> the spinning up.</p>" +
      "<p>Write $mg\\sin\\theta - f = ma$ along the slope and $fr = I\\alpha$ about the centre. With $\\beta = I/mr^2$ they give $a = \\dfrac{g\\sin\\theta}{1+\\beta}$ and $f = mg\\sin\\theta\\,\\dfrac{\\beta}{1+\\beta}$. Mass and radius cancel; only the shape is left.</p>" +
      "<p>The friction is <b>static</b>: it acts at a point that isn't moving, so it does no work and mechanical energy is conserved, $mgh = \\tfrac12 mv^2(1+\\beta)$. If $\\mu mg\\cos\\theta$ can't supply it, the body skids, friction becomes kinetic, and some energy turns into heat.</p>" +
      '<div class="trap"><b>JEE trap: friction on a rolling body is not $\\mu N$.</b> While it rolls, friction is just what $fr = I\\alpha$ needs, $mg\\sin\\theta\\,\\beta/(1+\\beta)$, usually much less than $\\mu N$. And it does no work, so energy conservation still holds. Only once it slips is $f = \\mu_k N$.</div>');
    function apply(s) {
      main = s.body;
      bodySeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === main)); });
      thS.set(s.th); muS.set(s.mu); mS.set(s.m); rS.set(s.r);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "rolling acceleration", setup: { body: "solid", th: 30, mu: 0.5, m: 2, r: 0.25 }, watch: "Predict a, then press Release",
        q: "A solid sphere rolls without slipping down a 30° slope ($g = 9.8$). What is its acceleration?",
        options: ["3.50 m/s²", "4.90 m/s²", "2.45 m/s²", "3.27 m/s²"], answer: 0,
        explain: "$a = \\dfrac{g\\sin\\theta}{1 + 2/5} = \\dfrac{4.9}{1.4} = 3.50$ m/s². 4.90 m/s² ignores the spin (a sliding block); 2.45 m/s² is a ring and 3.27 m/s² a disc." },
      { level: "medium", tag: "energy split", setup: { body: "disc", th: 30, mu: 0.5, m: 2, r: 0.25 }, watch: "Predict v at the bottom, then press Release and watch the energy graph",
        q: "A disc rolls without slipping from rest down a 5 m slope at 30° ($g = 9.8$). What is its speed at the bottom, and what fraction of its kinetic energy is rotational?",
        options: ["5.72 m/s, 1/3", "7.00 m/s, 0", "5.72 m/s, 1/2", "4.95 m/s, 1/2"], answer: 0,
        hints: ["It drops $h = 5\\sin 30° = 2.5$ m, and rolling friction does no work.", "$mgh = \\tfrac12 mv^2 + \\tfrac12\\left(\\tfrac12 mr^2\\right)\\left(\\tfrac vr\\right)^2 = \\tfrac34 mv^2$."],
        explain: "$v = \\sqrt{4gh/3} = \\sqrt{4(9.8)(2.5)/3} = 5.72$ m/s. Rotational KE is $\\tfrac14 mv^2$ out of $\\tfrac34 mv^2$: one third. 7.00 m/s is $\\sqrt{2gh}$, the frictionless block; 4.95 m/s with half is the ring." },
      { level: "hard", tag: "too little friction", setup: { body: "disc", th: 45, mu: 0.2, m: 2, r: 0.25 }, watch: "Press Release: does it roll? Then raise μ until it just does",
        q: "A uniform disc is released on a 45° slope. What is the least coefficient of friction that lets it roll without slipping, and what is its acceleration if $\\mu = 0.2$ ($g = 9.8$)?",
        options: ["0.33 and 5.54 m/s²", "0.33 and 4.62 m/s²", "1.00 and 5.54 m/s²", "0.67 and 6.93 m/s²"], answer: 0,
        hints: ["Rolling needs $f = mg\\sin\\theta\\,\\frac{\\beta}{1+\\beta}$ with $\\beta = \\tfrac12$; it must not exceed $\\mu mg\\cos\\theta$.", "At $\\mu = 0.2$ it slips, so friction is kinetic: $ma = mg\\sin\\theta - \\mu mg\\cos\\theta$."],
        explain: "$\\mu_{min} = \\tfrac13\\tan 45° = 0.33$. With $\\mu = 0.2$ it skids, so $a = 9.8(\\sin 45° - 0.2\\cos 45°) = 5.54$ m/s², more than the rolling value 4.62 m/s² (which assumes it still rolls). 1.00 is the block's angle of repose condition, $\\tan\\theta$." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Release", onReset: reset, onPlay: function () { if (st.done) reset(); } });
    reset();
    if (location.hostname === "localhost") window.__lab_rolling = { apply: apply, state: function () { return st; }, racers: function () { return racers; }, solve: solve, params: params };

    return function destroy() { sim.destroy(); [gv, ga, ge].forEach(function (g) { g.destroy(); }); };
  }
})();
