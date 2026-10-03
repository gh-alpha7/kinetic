/* Gravitation, lab 3: how g changes with height and depth, and a ball dropped down a tunnel through the planet. */
(function () {
  "use strict";
  var PLANETS = [{ label: "Earth", value: "earth", g: 9.8, R: 6371 }, { label: "Mars", value: "mars", g: 3.71, R: 3390 }, { label: "Moon", value: "moon", g: 1.62, R: 1737 }];
  var W = 1000, H = 560, CX = 300, CY = 280, RP = 200, RMAX = 3.4;      // stage; planet centre and radius in px
  var TIMES = [{ label: "1 s = 1 min", value: 60 }, { label: "2 min", value: 120 }, { label: "5 min", value: 300 }];

  var lab = {
    id: "gvariation", chapter: "gravitation", title: "g with height and depth", short: "g(h), g(d), the gravity tunnel",
    lede: "Drag a probe from the centre of the Earth out into space and watch $g$ rise, peak at the surface, then fade. Then drop a ball down a tunnel through the planet: it comes back every 84 minutes.",
    tries: [
      { id: "half", title: "Find where g is half its surface value, above the ground",
        text: "Drag the probe out until $g = g_0/2$.",
        why: "$\\dfrac{g_0}{(1 + h/R)^2} = \\dfrac{g_0}{2}$ gives $1 + h/R = \\sqrt2$, so $h = 0.414R = 2639$ km for Earth. The shortcut $1 - 2h/R$ would say $R/4$: way off this high up." },
      { id: "centre", title: "Weigh something at the centre of the Earth",
        text: "Drag the probe right to the middle.",
        why: "Inside a uniform planet only the mass closer to the centre than you pulls you overall; the shell outside cancels. That inner mass shrinks as $r^3$, so $g = g_0 r/R$, which is zero at the centre." },
      { id: "tunnel", title: "Drop a ball through the planet",
        text: "Let the ball fall down the tunnel and come all the way back.",
        why: "Inside, the pull is $mg_0 r/R$ toward the centre: a restoring force proportional to displacement, so it's SHM with $\\omega = \\sqrt{g_0/R}$ and $T = 2\\pi\\sqrt{R/g_0} = 84.4$ min for Earth." },
      { id: "chord", title: "Get the same period from a different tunnel",
        text: "Change the tunnel's offset or the release point, run it again and compare the periods.",
        why: "Along any straight chord the component of the pull is $mg_0 x/R$, with $x$ measured from the chord's middle. Same $\\omega$, so the same 84 minutes, however long the tunnel and wherever you let go." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- controls ---------- */
    var planet = PLANETS[0], ts = 120;
    var rS = K.slider({ label: "Probe distance from centre $r/R$", min: 0, max: RMAX, step: 0.001, value: 1.5, onInput: probeMoved,
      hint: "Or drag the probe on the stage. Below 1 is underground." });
    var bS = K.slider({ label: "Tunnel offset from centre", unit: "× R", min: 0, max: 0.9, step: 0.05, value: 0, onInput: reset });
    var aS = K.slider({ label: "Release point", unit: "of the way out", min: 0.1, max: 1, step: 0.05, value: 1, onInput: reset,
      hint: "1 = drop from the surface. Or drag the ball." });
    P.controls.innerHTML = "<h3>Planet</h3>";
    var planetSeg = K.seg(PLANETS, planet.value, function (v) { planet = PLANETS.filter(function (q) { return q.value === v; })[0]; reset(); }, "Planet");
    P.controls.appendChild(planetSeg);
    P.controls.appendChild(K.h("<h3>Probe</h3>"));
    P.controls.appendChild(rS.el);
    var quick = K.h('<div class="row"></div>');
    [["Centre", 0], ["Depth R/2", 0.5], ["Surface", 1], ["h = R", 2]].forEach(function (q) {
      var b = K.h('<button class="btn btn-sm" type="button">' + q[0] + "</button>");
      b.addEventListener("click", function () { rS.set(q[1]); probeMoved(); }); quick.appendChild(b);
    });
    P.controls.appendChild(quick);
    P.controls.appendChild(K.h("<h3>Tunnel</h3>"));
    [bS, aS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Time</h3>"));
    P.controls.appendChild(K.seg(TIMES, ts, function (v) { ts = v; }, "Time scale"));
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>gravity g</span><span class="c-disp"><i></i>position</span><span class="c-vel"><i></i>velocity</span>' +
      '<span class="c-acc"><i></i>ball</span></div>'));

    function params() { return { g: planet.g, R: planet.R * 1000, name: planet.label, r: rS.get(), b: bS.get(), A: aS.get() }; }
    // g at r (in units of R) for a uniform planet: shell theorem inside, inverse square outside
    function gAt(g, r) { return r < 1 ? g * r : g / (r * r); }
    function tunnelTheory(p) {
      var w = Math.sqrt(p.g / p.R), L = Math.sqrt(1 - p.b * p.b) * p.R;   // half the chord (m)
      return { w: w, T: 2 * Math.PI / w, L: L, x0: p.A * L, vmax: w * p.A * L };
    }

    /* ---------- the ball in the tunnel ---------- */
    var st = null, runs = [];
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params(), tt = tunnelTheory(p);
      st = { p: p, tt: tt, x: tt.x0, v: 0, a: -tt.w * tt.w * tt.x0, t: 0, turns: [], rec: { t: [0], x: [tt.x0 / 1e3], v: [0] }, done: false };
      setTime(0);
      update(true);
    }
    // velocity Verlet along the chord: a = −(g/R) x
    function advance(s, dt) {
      var n = 20, h = dt / n, w2 = s.tt.w * s.tt.w;
      for (var i = 0; i < n; i++) {
        var v1 = s.v;
        s.v += 0.5 * h * s.a; s.x += h * s.v; s.a = -w2 * s.x; s.v += 0.5 * h * s.a;
        s.t += h;
        if (s.t > h * 1.5 && ((v1 < 0 && s.v >= 0) || (v1 > 0 && s.v <= 0))) {
          s.turns.push(s.t - h + h * v1 / (v1 - s.v));                    // where v crossed zero in this step
          turned(s);
        }
      }
    }
    function turned(s) {
      if (s.turns.length === 1) K.flash(P.note, "Other end after " + K.fmt(s.turns[0] / 60, 1) + " min", 2500);
      if (s.turns.length === 2) {
        var T = s.turns[1];
        K.flash(P.note, "Back where it started: T = " + K.fmt(T / 60, 1) + " min", 3000);
        tries.mark("tunnel");
        var p = s.p;
        runs.forEach(function (q) {
          if (q.name === p.name && (q.b !== p.b || q.A !== p.A) && Math.abs(q.T - T) / T < 0.005) tries.mark("chord");
        });
        runs.push({ name: p.name, b: p.b, A: p.A, T: T });
        if (runs.length > 20) runs.shift();
      }
    }
    sim.on("step", function () {
      if (!st) return;
      advance(st, K.DT * ts);
      st.rec.t.push(st.t / 60); st.rec.x.push(st.x / 1e3); st.rec.v.push(st.v / 1e3);
      if (st.rec.t.length > 3000) Object.keys(st.rec).forEach(function (k) { st.rec[k] = st.rec[k].filter(function (_, i) { return i % 2 === 0; }); });
      setTime(st.t);
      update(false);
    });
    function setTime(t) { P.time.textContent = "t = " + K.fmt(t / 60, 1) + " min"; }

    function probeMoved() {
      var p = params(), g = gAt(p.g, p.r);
      if (p.r < 0.01) tries.mark("centre");
      if (p.r > 1 && Math.abs(g / p.g - 0.5) < 0.005) tries.mark("half");
      update(true);
    }

    /* ---------- dragging ---------- */
    var drag = null;
    function ballPos() { var p = st.p, tx = CX - p.b * RP; return { x: tx, y: CY - st.x / p.R * RP }; }
    sim.pointer({
      down: function (pt) {
        var pr = { x: CX + rS.get() * RP, y: CY }, bp = ballPos();
        if (Math.hypot(pt.px - pr.x, pt.py - pr.y) < sim.u(26)) { drag = "probe"; return true; }
        if (!sim.running && Math.hypot(pt.px - bp.x, pt.py - bp.y) < sim.u(26)) { drag = "ball"; return true; }
        return false;
      },
      drag: function (pt) {
        if (drag === "probe") { rS.set(Math.round(K.clamp((pt.px - CX) / RP, 0, RMAX) * 1000) / 1000); probeMoved(); }
        else if (drag === "ball") {
          var L = Math.sqrt(1 - st.p.b * st.p.b) * RP;
          aS.set(K.clamp(Math.round(Math.abs(CY - pt.py) / L * 20) / 20, 0.1, 1)); reset();
        }
      },
      up: function () { drag = null; }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      var p = st.p, u = sim.u(1);
      // distance marks along the probe line
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = u;
      ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX + RMAX * RP, CY); ctx.stroke();
      ctx.fillStyle = th.muted; ctx.font = "600 " + 11 * u + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var k = 0.5; k <= RMAX; k += 0.5) { ctx.fillRect(CX + k * RP - 0.5, CY - 4, 1, 8); if (k >= 1.5 || k === 0.5) ctx.fillText(k + "R", CX + k * RP, CY + 8); }
      // planet cross-section, shaded darker where the inner mass is
      ctx.fillStyle = th.ground; ctx.beginPath(); ctx.arc(CX, CY, RP, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = 2 * u; ctx.stroke();
      var r = rS.get();
      if (r < 1) {
        ctx.fillStyle = K.alpha(th.grav, 0.22); ctx.beginPath(); ctx.arc(CX, CY, r * RP, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = K.alpha(th.grav, 0.7); ctx.setLineDash([4 * u, 4 * u]); ctx.lineWidth = 1.5 * u; ctx.stroke(); ctx.setLineDash([]);
        if (r > 0.25) K.label(ctx, "only this mass pulls", CX + 30 * u, CY + r * RP - 6 * u, th.grav, { s: u * 0.9, bg: true });
      }
      K.label(ctx, p.name + "  R = " + planet.R + " km", CX, CY + RP + 24 * u, th.muted, { s: u });
      // the tunnel
      var tx = CX - p.b * RP, L = Math.sqrt(1 - p.b * p.b) * RP;
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(tx - 7 * u, CY - L, 14 * u, 2 * L);
      ctx.strokeStyle = th.muted; ctx.lineWidth = u;
      ctx.beginPath(); ctx.moveTo(tx - 7 * u, CY - L); ctx.lineTo(tx - 7 * u, CY + L); ctx.moveTo(tx + 7 * u, CY - L); ctx.lineTo(tx + 7 * u, CY + L); ctx.stroke();
      if (p.b > 0) {
        ctx.setLineDash([3 * u, 4 * u]);
        ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(tx, CY); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, p.b + "R", (CX + tx) / 2, CY - 4 * u, th.muted, { s: u * 0.85 });
      }
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(CX, CY, 3 * u, 0, Math.PI * 2); ctx.fill();
    });
    sim.on("over", function (ctx) {
      var p = st.p, u = sim.u(1), r = rS.get(), g = gAt(p.g, r), px = CX + r * RP;
      // probe and its g arrow (toward the centre)
      var len = 12 + 9 * g / p.g * 7;
      if (g > 1e-6) K.arrow(ctx, px, CY - 20 * u, px - len * u, CY - 20 * u, th.grav, { s: u, label: "g = " + K.fmt(g, 2) + " m/s²", lx: -len - 40, ly: -14 });
      else K.label(ctx, "g = 0", px, CY - 22 * u, th.grav, { s: u, bg: true });
      ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(px, CY, 8 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(px - 2.5 * u, CY - 2.5 * u, 3 * u, 0, Math.PI * 2); ctx.fill();
      var hh = (r - 1) * planet.R;
      K.label(ctx, r >= 1 ? "h = " + K.fmt(hh, 0) + " km" : "d = " + K.fmt(-hh, 0) + " km", px, CY + 44 * u, th.disp, { s: u, bg: true });
      // the ball, with its velocity and pull along the tunnel
      var bp = ballPos(), k = st.tt.w * st.tt.w;
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(bp.x, bp.y, 8 * u, 0, Math.PI * 2); ctx.fill();
      if (Math.abs(st.v) > 5) K.arrow(ctx, bp.x + 16 * u, bp.y, bp.x + 16 * u, bp.y - st.v / 1000 * 9 * u, th.vel, { s: u, label: K.fmt(Math.abs(st.v) / 1000, 2) + " km/s", lx: 4 });
      var acc = -k * st.x;
      if (Math.abs(acc) > 0.05) K.arrow(ctx, bp.x - 16 * u, bp.y, bp.x - 16 * u, bp.y - acc * 7 * u, th.grav, { s: u, label: K.fmt(Math.abs(acc), 2), lx: -44 });
      if (!sim.running && st.t === 0) K.label(ctx, "drag the probe →", px + 12 * u, CY - 40 * u, th.muted, { s: u, align: "left" });
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-grav">g vs r</b> · straight line inside, $1/r^2$ outside; dashed is the $1 - 2h/R$ shortcut; dot is your probe</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">x–t in the tunnel</b> · dashed is $x_0\\cos\\omega t$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v–t in the tunnel</b> · fastest at the middle; dashed is $-\\omega x_0\\sin\\omega t$</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gg = new K.Graph(cv[0], { yLabel: "g (m/s²)", xLabel: "r / R", xMax: RMAX, yMin: 0, color: th.grav });
    var gx = new K.Graph(cv[1], { yLabel: "x (km)", xLabel: "t (min)", xMax: 90, xAuto: true, color: th.disp });
    var gv = new K.Graph(cv[2], { yLabel: "v (km/s)", xLabel: "t (min)", xMax: 90, xAuto: true, color: th.vel });

    function update(force) {
      var p = st.p, tt = st.tt, R = st.rec;
      var exact = [], approx = [];
      for (var i = 0; i <= 340; i++) {
        var r = i / 100;
        exact.push([r, gAt(p.g, r)]);
        if (r >= 1 && 1 - 2 * (r - 1) >= 0) approx.push([r, p.g * (1 - 2 * (r - 1))]);
      }
      gg.set("exact", { points: exact, color: th.grav, width: 2.5 });
      gg.set("approx", { points: approx, color: th.muted, dash: [5, 5], width: 1.5 });
      gg.extra = function (ctx, X, Y) {
        var pr = rS.get(); ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(X(pr), Y(gAt(p.g, pr)), 5, 0, Math.PI * 2); ctx.fill();
      };
      var Tm = tt.T / 60, tEnd = Math.max(R.t[R.t.length - 1], Tm * 1.05), fx = [], fv = [];
      for (var j = 0; j <= 160; j++) {
        var tm = tEnd * j / 160, ph = tt.w * tm * 60;
        fx.push([tm, tt.x0 * Math.cos(ph) / 1e3]); fv.push([tm, -tt.w * tt.x0 * Math.sin(ph) / 1e3]);
      }
      gx.o.xMax = gv.o.xMax = tEnd;
      gx.set("f", { points: fx, color: th.disp, dash: [5, 5], width: 1.5 });
      gv.set("f", { points: fv, color: th.vel, dash: [5, 5], width: 1.5 });
      gx.set("sim", { points: R.t.map(function (t, i) { return [t, R.x[i]]; }), color: th.disp, width: 2.5, dot: true });
      gv.set("sim", { points: R.t.map(function (t, i) { return [t, R.v[i]]; }), color: th.vel, width: 2.5, dot: true });
      [gg, gx, gv].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Above the surface, height h", "Below the surface, depth d (uniform planet)", "Tunnel: restoring force ∝ x, so SHM", "Speed through the middle"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "g", label: "g at the probe", cls: "c-grav" }, { id: "ap", label: "1 − 2h/R shortcut", cls: "" },
      { id: "wt", label: "a 60 kg student weighs", cls: "c-grav" }, { id: "half", label: "time to the other end", cls: "c-disp" },
      { id: "T", label: "tunnel period", cls: "c-disp" }, { id: "vm", label: "top speed", cls: "c-vel" }
    ]);
    var slowMaths = K.throttle(renderMaths, 100);
    function renderMaths() {
      var p = params(), tt = st.tt, sp = st.p, r = p.r, g = gAt(p.g, r), Rk = planet.R;
      var h = Math.max(0, r - 1) * Rk, d = Math.max(0, 1 - r) * Rk;
      K.tex(eqEls[0], "g_h = \\frac{g_0}{(1 + h/R)^2} = \\frac{" + p.g + "}{(1 + " + K.fmt(h, 0) + "/" + Rk + ")^2} = \\mathbf{" + K.fmt(p.g / Math.pow(1 + h / Rk, 2), 2) + "}\\ \\text{m/s}^2" +
        "\\quad \\approx g_0\\left(1 - \\frac{2h}{R}\\right) = " + K.fmt(p.g * (1 - 2 * h / Rk), 2));
      K.tex(eqEls[1], "g_d = g_0\\left(1 - \\frac{d}{R}\\right) = " + p.g + "\\left(1 - \\frac{" + K.fmt(d, 0) + "}{" + Rk + "}\\right) = \\mathbf{" + K.fmt(p.g * (1 - d / Rk), 2) + "}\\ \\text{m/s}^2");
      K.tex(eqEls[2], "a = -\\frac{g_0}{R}x \\Rightarrow T = 2\\pi\\sqrt{\\frac{R}{g_0}} = 2\\pi\\sqrt{\\frac{" + K.fmt(sp.R, 0) + "}{" + sp.g + "}} = \\mathbf{" + K.fmt(tt.T / 60, 1) + "}\\ \\text{min}");
      K.tex(eqEls[3], "v_{max} = \\omega x_0 = (" + K.fmt(tt.w * 1e3, 4) + "\\times10^{-3})(" + K.fmt(tt.x0 / 1e3, 0) + "\\ \\text{km}) = \\mathbf{" + K.fmt(tt.vmax / 1e3, 2) + "}\\ \\text{km/s}");
      setR("g", K.fmt(g, 2) + " m/s²", r >= 1 ? "h = " + K.fmt(h, 0) + " km" : "d = " + K.fmt(d, 0) + " km");
      setR("ap", r >= 1 ? K.fmt(p.g * (1 - 2 * h / Rk), 2) + " m/s²" : "—", r >= 1 ? (g > 0 ? "off by " + K.fmt(Math.abs(p.g * (1 - 2 * h / Rk) - g) / g * 100, 1) + "%" : "") : "not for depth");
      setR("wt", K.fmt(60 * g, 0) + " N", "on the surface " + K.fmt(60 * p.g, 0) + " N");
      setR("half", st.turns.length ? K.fmt(st.turns[0] / 60, 1) + " min" : "—", "formula " + K.fmt(tt.T / 120, 1) + " min");
      setR("T", st.turns.length > 1 ? K.fmt(st.turns[1] / 60, 1) + " min" : "—", "formula " + K.fmt(tt.T / 60, 1) + " min");
      var vmax = st.rec.v.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0);
      setR("vm", st.turns.length ? K.fmt(vmax, 2) + " km/s" : "—", "formula " + K.fmt(tt.vmax / 1e3, 2) + " km/s");
      P.hud.innerHTML = "<span>g₀ = " + p.g + " m/s²</span><span>g at probe = " + K.fmt(g / p.g * 100, 1) + "% of g₀</span>";
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Outside the planet, $g = \\dfrac{GM}{r^2}$: with $r = R + h$ that's $g_h = \\dfrac{g_0}{(1 + h/R)^2}$. For small heights it's close to $g_0(1 - 2h/R)$.</p>" +
      "<p>Inside a uniform planet, the shell of rock above you pulls equally in all directions and cancels. Only the mass inside radius $r$ counts, and it grows as $r^3$, so $g = \\dfrac{G M r^3/R^3}{r^2} = g_0\\dfrac{r}{R}$, or $g_d = g_0(1 - d/R)$. That's exact, not an approximation, and $g$ is greatest at the surface.</p>" +
      "<p>Because the pull inside is proportional to distance from the centre, a ball in a frictionless tunnel does SHM with $T = 2\\pi\\sqrt{R/g_0}$: 84.4 min for Earth, the same as a satellite skimming the surface.</p>" +
      '<div class="trap"><b>JEE trap: $1 - 2h/R$ is only for $h \\ll R$.</b> Use it and you\'d find $g = g_0/2$ at $h = R/4$, but the true height is $0.414R$. When $h$ is a decent fraction of $R$, always use $g_0/(1 + h/R)^2$. And don\'t mix the two: going down is $1 - d/R$ (one power), going up is about $1 - 2h/R$ (two).</div>');
    function setSeg(v) { planetSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === v)); }); }
    function apply(s) {
      planet = PLANETS.filter(function (q) { return q.value === (s.planet || "earth"); })[0]; setSeg(planet.value);
      if (s.r != null) rS.set(s.r);
      bS.set(s.b || 0); aS.set(s.A || 1);
      reset(); probeMoved();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "g below the surface", setup: { r: 0.75 }, watch: "Read g at the probe, a quarter of the way down",
        q: "What is $g$ at a depth of $R/4$ inside the Earth? Treat the Earth as uniform, $g_0 = 9.8$ m/s².",
        options: ["4.90 m/s²", "6.27 m/s²", "7.35 m/s²", "9.80 m/s²"], answer: 2,
        explain: "$g_d = g_0(1 - d/R) = 9.8 \\times \\tfrac34 = 7.35$ m/s². 6.27 m/s² is what $g_0/(1 + 1/4)^2$ gives (the height formula), and 4.90 m/s² comes from $1 - 2d/R$." },
      { level: "medium", tag: "height vs depth", setup: { r: 1.414 }, watch: "Compare g here with g at depth R/2 (the Depth R/2 button)",
        q: "At what height above the Earth's surface is $g$ the same as at a depth of $R/2$? ($R = 6371$ km)",
        options: ["1593 km", "2639 km", "3186 km", "6371 km"], answer: 1,
        hints: ["At depth $R/2$, $g = g_0(1 - \\tfrac12) = g_0/2$.", "Solve $\\dfrac{g_0}{(1 + h/R)^2} = \\dfrac{g_0}{2}$ exactly. The $1 - 2h/R$ shortcut fails this high up."],
        explain: "$(1 + h/R)^2 = 2$, so $h = (\\sqrt2 - 1)R = 0.414 \\times 6371 = 2639$ km. The shortcut gives $R/4 = 1593$ km and $h = d$ gives 3186 km. The lab shows 4.90 m/s² at both places." },
      { level: "hard", tag: "chord tunnel", setup: { r: 1.5, b: 0.5, A: 1 }, watch: "Press Play and read the time to the other end",
        q: "A straight, frictionless tunnel is dug between two points on the Earth's surface; its closest point to the centre is $R/2$ away. A ball released at one end slides to the other end in how long? ($R = 6371$ km, $g_0 = 9.8$ m/s²)",
        options: ["21.1 min", "42.2 min", "48.7 min", "84.4 min"], answer: 1,
        hints: ["At distance $r$ from the centre the pull is $mg_0 r/R$. Take its component along the tunnel, with $x$ measured from the tunnel's middle.", "The component is $mg_0 x/R$: SHM with $\\omega = \\sqrt{g_0/R}$, the same for every chord. End to end is half a period."],
        explain: "Along the chord $a = -\\dfrac{g_0}{R}x$, so $T = 2\\pi\\sqrt{R/g_0} = 84.4$ min, and end to end is $T/2 = 42.2$ min, whatever the chord. 48.7 min ($42.2/\\cos 30°$) wrongly scales $g$ by the chord's tilt; 84.4 min is a full round trip." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Drop the ball", onReset: reset });
    sim.on("step", function () { setTime(st.t); });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_gvariation = { apply: apply, sim: sim, probe: function (r) { rS.set(r); probeMoved(); },
        state: function () { var p = params(); return { st: st, p: p, g: gAt(p.g, p.r), tt: st.tt }; } };
    }
    return function destroy() { sim.destroy(); [gg, gx, gv].forEach(function (g) { g.destroy(); }); };
  }
})();
