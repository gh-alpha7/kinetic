/* Waves & sound, lab 1: a travelling wave on a long rope, and a single pulse that reflects off a fixed or a free end. */
(function () {
  "use strict";
  var L = 12, T_MAX = 10, PW = 0.6, PX0 = 2, N = 600;   // rope length (m), run length (s), pulse width and start (m), samples

  var lab = {
    id: "travelling", chapter: "sound", title: "Travelling waves", short: "v = √(T/μ), λ, f, k, ω",
    lede: "Shake one end of a long rope and a wave runs along it. The shape travels, but the rope itself only goes up and down. Mark one bit of rope and compare the two speeds.",
    tries: [
      { id: "outrun", title: "Make the rope outrun the wave",
        text: "Get the marked particle's top speed above the wave speed.",
        why: "The particle's top speed is $A\\omega$, set by how hard and how often you shake. The wave speed is $\\sqrt{T/\\mu}$, set by the rope alone. They're independent: a big $A$ and a high $f$ win." },
      { id: "lambda", title: "Crests 2 m apart at 1 Hz",
        text: "Keep $f$ = 1 Hz and change only the rope ($T$ or $\\mu$) until the measured $\\lambda$ is 2.00 m.",
        why: "$\\lambda = v/f$, so you need $v$ = 2 m/s, which means $T/\\mu = 4$: for example $T$ = 1 N with $\\mu$ = 0.25 kg/m. The source sets $f$, the rope sets $v$, and $\\lambda$ follows." },
      { id: "invert", title: "See a pulse come back upside down",
        text: "In Pulse mode with a fixed end, watch the echo pass the marked particle.",
        why: "The wall can't move, so it pulls the rope the other way: the reflected pulse is inverted, a phase change of $\\pi$. In the maths it's an upside-down image pulse coming from behind the wall." },
      { id: "free", title: "Make the free end jump to 2A",
        text: "Switch to a free end (a ring on a smooth rod) and send a pulse.",
        why: "At a free end the echo comes back the right way up. For an instant the incoming and reflected pulses sit on top of each other, so the end flicks up to $2A$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 300, ppm = 75, origin = { x: 50, y: 150 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, gridStep: 0.5, gridMajor: 2, labels: false });

    /* ---------- controls ---------- */
    var mode = "sine", endType = "fixed", dir = 1;
    var TS = K.slider({ label: "Tension $T$", unit: "N", min: 0.5, max: 16, step: 0.5, value: 4, onInput: reset });
    var muS = K.slider({ label: "Linear density $\\mu$", unit: "kg/m", min: 0.05, max: 1, step: 0.05, value: 0.25, onInput: reset,
      hint: "Mass per metre of rope. A heavier rope carries the wave more slowly." });
    var fS = K.slider({ label: "Frequency $f$", unit: "Hz", min: 0.25, max: 2, step: 0.05, value: 1, onInput: reset,
      hint: "How often your hand shakes. The source sets $f$." });
    var AS = K.slider({ label: "Amplitude $A$", unit: "m", min: 0.1, max: 0.8, step: 0.05, value: 0.5, onInput: reset });
    var phS = K.slider({ label: "Phase constant $\\phi$", unit: "°", min: 0, max: 345, step: 15, value: 0, onInput: reset });
    var xpS = K.slider({ label: "Marked particle at $x_p$", unit: "m", min: 0, max: L, step: 0.1, value: 6, onInput: reset,
      hint: "Or drag the red dot along the rope." });
    function segSet(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }
    var modeSeg = K.seg([{ label: "Sine wave", value: "sine" }, { label: "Pulse & reflection", value: "pulse" }], "sine",
      function (v) { setMode(v); reset(); }, "Mode");
    var endSeg = K.seg([{ label: "Fixed end", value: "fixed" }, { label: "Free end", value: "free" }], "fixed",
      function (v) { endType = v; reset(); }, "Far end");
    var dirSeg = K.seg([{ label: "Towards +x", value: 1 }, { label: "Towards −x", value: -1 }], 1,
      function (v) { dir = v; reset(); }, "Direction");
    P.controls.innerHTML = "<h3>What to send</h3>";
    P.controls.appendChild(modeSeg);
    P.controls.appendChild(K.h("<h3>The rope</h3>"));
    [TS, muS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Your hand</h3>"));
    var sineBox = K.h("<div></div>"), pulseBox = K.h("<div></div>");
    [fS, phS].forEach(function (s) { sineBox.appendChild(s.el); });
    sineBox.appendChild(dirSeg);
    pulseBox.appendChild(K.h("<h3>Far end</h3>")); pulseBox.appendChild(endSeg);
    P.controls.appendChild(AS.el); P.controls.appendChild(sineBox); P.controls.appendChild(pulseBox);
    P.controls.appendChild(K.h("<h3>Marked particle</h3>"));
    P.controls.appendChild(xpS.el);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>rope (displacement)</span><span class="c-vel"><i></i>particle velocity</span>' +
      '<span class="c-app"><i></i>wave velocity</span><span class="c-fric"><i></i>marked particle</span></div>'));
    function setMode(v) { mode = v; segSet(modeSeg, v); sineBox.hidden = v !== "sine"; pulseBox.hidden = v !== "pulse"; buildPanels(); }

    function params() {
      var T = TS.get(), mu = muS.get(), v = Math.sqrt(T / mu), f = fS.get();
      return { T: T, mu: mu, v: v, f: f, A: AS.get(), phi: phS.get() * K.DEG, lam: v / f, k: 2 * Math.PI * f / v, w: 2 * Math.PI * f, xp: xpS.get() };
    }

    /* ---------- the wave (exact solutions) ---------- */
    // sine: y = A sin(kx ∓ ωt + φ). pulse: a Gaussian g(x − vt) plus its image from behind the end,
    // inverted for a fixed end (so y(L) = 0) and upright for a free end (so ∂y/∂x = 0 at L).
    function g(p, s) { var d = (s - PX0) / PW; return p.A * Math.exp(-d * d); }
    function dg(p, s) { return -2 * (s - PX0) / (PW * PW) * g(p, s); }
    function img() { return endType === "fixed" ? -1 : 1; }
    function yAt(p, x, t) {
      if (mode === "sine") return p.A * Math.sin(p.k * x - dir * p.w * t + p.phi);
      return g(p, x - p.v * t) + img() * g(p, 2 * L - x - p.v * t);
    }
    function vpFormula(p, x, t) {
      if (mode === "sine") return -dir * p.A * p.w * Math.cos(p.k * x - dir * p.w * t + p.phi);
      return -p.v * (dg(p, x - p.v * t) + img() * dg(p, 2 * L - x - p.v * t));
    }
    // "measured" particle velocity: watch the particle over a very short interval
    function vpMeas(p, x, t) { var h = K.DT / 20; return (yAt(p, x, t + h) - yAt(p, x, t - h)) / (2 * h); }
    // crests on the rope right now, refined with a parabola through the three samples round each peak
    function crests(p, t) {
      var out = [], dx = L / N, y0 = yAt(p, 0, t), y1 = yAt(p, dx, t), y2;
      for (var i = 1; i < N; i++) {
        y2 = yAt(p, (i + 1) * dx, t);
        if (y1 > y0 && y1 >= y2 && y1 > 0.5 * p.A) {
          var den = y0 - 2 * y1 + y2;
          out.push((i + (den ? 0.5 * (y0 - y2) / den : 0)) * dx);
        }
        y0 = y1; y1 = y2;
      }
      return out;
    }
    // vertex of a Gaussian-shaped peak from three samples: ln|y| is exactly a parabola
    function peakFit(t1, a, b, c) {
      var la = Math.log(Math.abs(a)), lb = Math.log(Math.abs(b)), lc = Math.log(Math.abs(c)), den = la - 2 * lb + lc;
      var off = den ? 0.5 * (la - lc) / den : 0;
      return { t: t1 + off * K.DT, y: (b < 0 ? -1 : 1) * Math.exp(lb - 0.25 * (la - lc) * off) };
    }

    /* ---------- state ---------- */
    var rec, m, ended = false, tEnd = T_MAX, dragging = false, transportUI = null;
    function freshParticle(t) {
      var p = params();
      rec = { t: [t], y: [yAt(p, p.xp, t)], v: [vpMeas(p, p.xp, t)] };
      m.ups = []; m.vpMax = 0; m.peaks = []; m.echo = null;
    }
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      var p = params();
      m = { crest: null, dist: 0, time: 0, lam: null, endHist: [yAt(p, L, 0)], endPeak: 0 };
      freshParticle(0);
      ended = false;
      tEnd = mode === "sine" ? T_MAX : (2 * L - PX0 - 1) / p.v;     // stop as the echo gets back near your hand
      gy.o.xMax = gv.o.xMax = tEnd;
      gy.o.yMin = -p.A; gy.o.yMax = p.A; gs.o.yMin = -p.A; gs.o.yMax = p.A;
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }

    sim.on("step", function (t) {
      var p = params(), y = yAt(p, p.xp, t), vp = vpMeas(p, p.xp, t);
      var py = rec.y[rec.y.length - 1];
      rec.t.push(t); rec.y.push(y); rec.v.push(vp);
      m.vpMax = Math.max(m.vpMax, Math.abs(vp));
      if (mode === "sine") {
        // follow one crest along the rope
        var cs = crests(p, t);
        m.lam = cs.length >= 2 ? (cs[cs.length - 1] - cs[0]) / (cs.length - 1) : null;
        var best = null;
        cs.forEach(function (c) { if (m.crest !== null && (best === null || Math.abs(c - m.crest) < Math.abs(best - m.crest))) best = c; });
        if (best !== null && Math.abs(best - m.crest) < p.lam / 4) { m.dist += best - m.crest; m.time += K.DT; m.crest = best; }
        else m.crest = cs.length ? (dir > 0 ? cs[0] : cs[cs.length - 1]) : null;
        // the particle's period from its upward zero crossings
        if (py < 0 && y >= 0) m.ups.push(t - K.DT * y / (y - py));
        var vM = vMeas();
        if (vM && m.time >= 1 / p.f && m.vpMax > vM) tries.mark("outrun");
        if (p.f === 1 && m.lam !== null && m.time > 0.5 && Math.abs(m.lam - 2) < 0.02) tries.mark("lambda");
      } else {
        // peaks of the marked particle: the pulse going out, then its echo
        var n = rec.y.length, a = rec.y[n - 3], b = rec.y[n - 2], c = rec.y[n - 1];
        if (n >= 3 && Math.abs(b) > 0.3 * p.A && a * b > 0 && c * b > 0 && Math.abs(b) > Math.abs(a) && Math.abs(b) >= Math.abs(c)) {
          m.peaks.push(peakFit(rec.t[n - 2], a, b, c));
          if (m.peaks.length === 2) {
            m.echo = { dt: m.peaks[1].t - m.peaks[0].t, sign: m.peaks[1].y < 0 ? -1 : 1 };
            K.flash(P.note, "Echo after " + K.fmt(m.echo.dt, 2) + " s, " + (m.echo.sign < 0 ? "upside down" : "the right way up"));
            if (endType === "fixed" && m.echo.sign < 0) tries.mark("invert");
          }
        }
        // the far end's own displacement
        var e = m.endHist; e.push(yAt(p, L, t));
        var k = e.length;
        if (k >= 3 && Math.abs(e[k - 2]) > 0.3 * p.A && e[k - 2] > e[k - 3] && e[k - 2] >= e[k - 1]) {
          m.endPeak = Math.max(m.endPeak, peakFit(t - K.DT, e[k - 3], e[k - 2], e[k - 1]).y);
          if (endType === "free" && m.endPeak >= 1.95 * p.A) tries.mark("free");
        }
      }
      if (t >= tEnd - 1e-9) {
        sim.pause(); transportUI.render(); ended = true;
        K.flash(P.note, mode === "sine" ? "That's " + T_MAX + " s. Reset to go again" : "The echo is back at your hand");
      }
      update(ended);
    });
    function vMeas() { return m.time > 0.2 ? Math.abs(m.dist) / m.time : null; }
    function tMeas() { var u = m.ups; return u.length >= 2 ? (u[u.length - 1] - u[0]) / (u.length - 1) : null; }

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      var p = params(), t = sim.time, a = sim.px(0, 0), b = sim.px(L, 0);
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = sim.u(1.5); ctx.setLineDash([sim.u(5), sim.u(5)]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 60, a.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = th.muted; ctx.font = "600 " + sim.u(11) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var x = 0; x <= L; x++) {
        var q = sim.px(x, 0);
        ctx.fillRect(q.x - sim.u(0.75), H - 26, sim.u(1.5), sim.u(6));
        if (x % 2 === 0) ctx.fillText(x + " m", q.x, H - 18);
      }
      // your hand at x = 0: a slider on a vertical slot
      var hy = sim.px(0, yAt(p, 0, t)).y, top = sim.px(0, 0.9).y, bot = sim.px(0, -0.9).y;
      ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(3); ctx.beginPath(); ctx.moveTo(a.x - sim.u(14), top); ctx.lineTo(a.x - sim.u(14), bot); ctx.stroke();
      ctx.fillStyle = th.body; ctx.fillRect(a.x - sim.u(24), hy - sim.u(9), sim.u(20), sim.u(18));
      if (mode === "pulse") {
        if (endType === "fixed") {
          ctx.fillStyle = th.ground; ctx.fillRect(b.x, 20, sim.u(14), H - 60);
          ctx.strokeStyle = th["ground-top"]; ctx.lineWidth = sim.u(1.5);
          for (var yy = 24; yy < H - 44; yy += 14) { ctx.beginPath(); ctx.moveTo(b.x + sim.u(14), yy); ctx.lineTo(b.x + sim.u(4), yy + 10); ctx.stroke(); }
          K.label(ctx, "fixed end", b.x - 4, 34, th.muted, { align: "right" });
        } else {
          ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5); ctx.beginPath(); ctx.moveTo(b.x, 20); ctx.lineTo(b.x, H - 40); ctx.stroke();
          var ry = sim.px(L, yAt(p, L, t)).y;
          ctx.strokeStyle = th.ten; ctx.lineWidth = sim.u(3); ctx.beginPath(); ctx.ellipse(b.x, ry, sim.u(5), sim.u(9), 0, 0, Math.PI * 2); ctx.stroke();
          K.label(ctx, "free end (ring on a smooth rod)", b.x - 10, 34, th.muted, { align: "right" });
        }
      } else K.label(ctx, "the rope goes on: no echo", W - 10, 34, th.muted, { align: "right" });
    });

    sim.on("over", function (ctx) {
      var p = params(), t = sim.time, xEnd = mode === "sine" ? L + 1 : L, i;
      // the rope
      ctx.strokeStyle = th.disp; ctx.lineWidth = sim.u(3); ctx.lineJoin = "round";
      ctx.beginPath();
      for (i = 0; i <= 500; i++) {
        var x = xEnd * i / 500, q = sim.px(x, yAt(p, x, t));
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
      if (mode === "sine") {
        var cs = crests(p, t);
        // a wavelength bracket between two neighbouring crests
        if (cs.length >= 2) {
          var c0 = sim.px(cs[0], -p.A - 0.45), c1 = sim.px(cs[1], -p.A - 0.45);
          ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.2);
          ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y);
          ctx.moveTo(c0.x, c0.y - 5); ctx.lineTo(c0.x, c0.y + 5); ctx.moveTo(c1.x, c1.y - 5); ctx.lineTo(c1.x, c1.y + 5); ctx.stroke();
          K.label(ctx, "λ = " + K.fmt(m.lam || p.lam, 2) + " m", (c0.x + c1.x) / 2, c0.y + 20, th.ink, { bg: true });
        }
        // the crest being tracked: it moves at the wave speed
        if (m.crest !== null) {
          var cr = sim.px(m.crest, p.A);
          ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(cr.x, cr.y, sim.u(5), 0, Math.PI * 2); ctx.fill();
          K.arrow(ctx, cr.x, cr.y - sim.u(14), cr.x + dir * p.v * 12, cr.y - sim.u(14), th.app, { label: "v = " + K.fmt(p.v, 2) + " m/s", lx: dir > 0 ? 6 : -120 });
        }
      }
      // the marked particle and its velocity (always vertical)
      var y = yAt(p, p.xp, t), vp = vpMeas(p, p.xp, t), mp = sim.px(p.xp, y);
      ctx.strokeStyle = K.alpha(th.fric, 0.5); ctx.lineWidth = sim.u(1); ctx.setLineDash([sim.u(3), sim.u(4)]);
      ctx.beginPath(); ctx.moveTo(mp.x, sim.px(0, p.A).y); ctx.lineTo(mp.x, sim.px(0, -p.A).y); ctx.stroke(); ctx.setLineDash([]);
      K.arrow(ctx, mp.x, mp.y, mp.x, mp.y - vp * 14, th.vel, { label: "v_p = " + K.fmt(vp, 2), lx: 8 });
      ctx.fillStyle = th.fric; ctx.beginPath(); ctx.arc(mp.x, mp.y, sim.u(7), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.surface; ctx.beginPath(); ctx.arc(mp.x, mp.y, sim.u(2.5), 0, Math.PI * 2); ctx.fill();
    });

    // drag the marked particle along the rope
    sim.pointer({
      down: function (pt) {
        var p = params(), q = sim.px(p.xp, yAt(p, p.xp, sim.time));
        if (Math.abs(pt.px - q.x) < 24 && Math.abs(pt.py - q.y) < 50) { dragging = true; return; }
        return false;
      },
      drag: function (pt) {
        if (!dragging) return;
        xpS.set(K.clamp(Math.round(pt.m.x * 10) / 10, 0, L));
        freshParticle(sim.time); theory(); update(true);
      },
      up: function () { dragging = false; },
      hover: function (pt) {
        var p = params(), q = sim.px(p.xp, yAt(p, p.xp, sim.time));
        P.canvas.style.cursor = Math.abs(pt.px - q.x) < 24 && Math.abs(pt.py - q.y) < 50 ? "ew-resize" : "";
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">y–t of the marked particle</b> · it only moves up and down</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">v<sub>p</sub>–t of the marked particle</b> · peaks at ±Aω, a quarter cycle ahead of y</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">the rope now (y vs x)</b> · faint dashed = the rope at t = 0: the shape has slid along by vt</p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gy = new K.Graph(cv[0], { yLabel: "y (m)", xMax: T_MAX, yMin: -0.5, yMax: 0.5, color: th.disp });
    var gv = new K.Graph(cv[1], { yLabel: "v_p (m/s)", xMax: T_MAX, color: th.vel });
    var gs = new K.Graph(cv[2], { yLabel: "y (m)", xLabel: "x (m)", xMax: L, yMin: -0.5, yMax: 0.5, color: th.disp });

    function theory() {
      var p = params(), ys = [], vs = [], x0 = [];
      for (var i = 0; i <= 800; i++) {
        var t = tEnd * i / 800;
        ys.push([t, yAt(p, p.xp, t)]); vs.push([t, vpFormula(p, p.xp, t)]);
      }
      for (var j = 0; j <= 300; j++) { var x = L * j / 300; x0.push([x, yAt(p, x, 0)]); }
      gy.set("theory", { points: ys, color: th.disp, dash: [5, 5], width: 1.5 });
      gv.set("theory", { points: vs, color: th.vel, dash: [5, 5], width: 1.5 });
      gs.set("t0", { points: x0, color: K.alpha(th.muted, 0.7), dash: [4, 5], width: 1.5 });
    }

    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      var p = params(), t = sim.time, now = [];
      for (var j = 0; j <= 300; j++) { var x = L * j / 300; now.push([x, yAt(p, x, t)]); }
      gy.set("sim", { points: rec.t.map(function (tt, i) { return [tt, rec.y[i]]; }), color: th.disp, width: 2.5, dot: true });
      gv.set("sim", { points: rec.t.map(function (tt, i) { return [tt, rec.v[i]]; }), color: th.vel, width: 2.5, dot: true });
      gs.set("sim", { points: now, color: th.disp, width: 2.5 });
      [gy, gv, gs].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    var eqEls, setR;
    function buildPanels() {
      var labels = mode === "sine"
        ? ["Speed: set by the rope", "The source sets f; λ, k and ω follow", "The wave, with your numbers", "One particle: its velocity is not the wave's"]
        : ["Speed: set by the rope", "The pulse", "Reflection: an image pulse from behind the end", "Echo at the marked particle"];
      P.eqs.innerHTML = labels.map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      setR = K.readout(P.readouts, mode === "sine" ? [
        { id: "v", label: "wave speed (crest tracker)", cls: "c-app" }, { id: "lam", label: "wavelength (crest gap)", cls: "c-disp" },
        { id: "T", label: "period (marked particle)" }, { id: "y", label: "particle displacement y_p", cls: "c-disp" },
        { id: "vp", label: "particle velocity v_p", cls: "c-vel" }, { id: "vmax", label: "top particle speed", cls: "c-vel" }
      ] : [
        { id: "dt", label: "echo time Δt" }, { id: "v", label: "speed from the echo", cls: "c-app" },
        { id: "sign", label: "echo comes back" }, { id: "end", label: "far end's biggest displacement", cls: "c-disp" },
        { id: "y", label: "particle displacement y_p", cls: "c-disp" }, { id: "vp", label: "particle velocity v_p", cls: "c-vel" }
      ]);
    }
    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      if (!rec) return;
      var p = params(), t = sim.time, y = rec.y[rec.y.length - 1], vp = rec.v[rec.v.length - 1];
      K.tex(eqEls[0], "v = \\sqrt{\\frac{T}{\\mu}} = \\sqrt{\\frac{" + K.fmt(p.T, 1) + "}{" + K.fmt(p.mu, 2) + "}} = \\mathbf{" + K.fmt(p.v, 2) + "}\\ \\text{m/s}");
      if (mode === "sine") {
        var sg = dir > 0 ? "-" : "+";
        K.tex(eqEls[1], "\\lambda = \\frac{v}{f} = \\frac{" + K.fmt(p.v, 2) + "}{" + K.fmt(p.f, 2) + "} = \\mathbf{" + K.fmt(p.lam, 2) + "}\\ \\text{m},\\;\\; k = \\frac{2\\pi}{\\lambda} = \\mathbf{" + K.fmt(p.k, 3) + "}\\ \\text{rad/m},\\;\\; \\omega = 2\\pi f = \\mathbf{" + K.fmt(p.w, 3) + "}\\ \\text{rad/s}");
        K.tex(eqEls[2], "y = A\\sin(kx " + sg + " \\omega t + \\phi) = " + K.fmt(p.A, 2) + "\\sin(" + K.fmt(p.k, 3) + "x " + sg + " " + K.fmt(p.w, 3) + "t + " + K.fmt(p.phi, 3) + "),\\;\\; \\frac{\\omega}{k} = \\mathbf{" + K.fmt(p.w / p.k, 2) + "}\\ \\text{m/s}");
        K.tex(eqEls[3], "v_p = \\frac{\\partial y}{\\partial t} = " + (dir > 0 ? "-" : "+") + "A\\omega\\cos(kx_p " + sg + " \\omega t + \\phi) = \\mathbf{" + K.fmt(vpFormula(p, p.xp, t), 2) + "}\\ \\text{m/s},\\;\\; v_{p,max} = A\\omega = " + K.fmt(p.A, 2) + "\\times" + K.fmt(p.w, 3) + " = \\mathbf{" + K.fmt(p.A * p.w, 2) + "}\\ \\text{m/s}");
        var vM = vMeas(), Tm = tMeas();
        setR("v", vM ? K.fmt(vM, 2) + " m/s" : "—", "√(T/μ) = " + K.fmt(p.v, 2) + " m/s");
        setR("lam", m.lam !== null ? K.fmt(m.lam, 2) + " m" : "—", m.lam !== null ? "v/f = " + K.fmt(p.lam, 2) + " m" : "need two crests on the rope");
        setR("T", Tm ? K.fmt(Tm, 3) + " s" : "—", "1/f = " + K.fmt(1 / p.f, 3) + " s");
        setR("y", K.fmt(y, 3) + " m", "between ±A = ±" + K.fmt(p.A, 2) + " m");
        setR("vp", K.fmt(vp, 2) + " m/s", "formula " + K.fmt(vpFormula(p, p.xp, t), 2) + " m/s");
        setR("vmax", K.fmt(m.vpMax, 2) + " m/s", "Aω = " + K.fmt(p.A * p.w, 2) + " m/s");
      } else {
        K.tex(eqEls[1], "g(x - vt) = A\\,e^{-(x - vt - x_0)^2 / w^2},\\;\\; A = " + K.fmt(p.A, 2) + "\\ \\text{m},\\; x_0 = " + PX0 + "\\ \\text{m},\\; w = " + PW + "\\ \\text{m}");
        K.tex(eqEls[2], endType === "fixed"
          ? "y = g(x - vt) \\mathbf{-} g(2L - x - vt) \\;\\Rightarrow\\; y(L) = 0:\\ \\text{echo inverted}"
          : "y = g(x - vt) \\mathbf{+} g(2L - x - vt) \\;\\Rightarrow\\; y(L)_{max} = 2A = \\mathbf{" + K.fmt(2 * p.A, 2) + "}\\ \\text{m}");
        var dtF = 2 * (L - p.xp) / p.v;
        K.tex(eqEls[3], "\\Delta t = \\frac{2(L - x_p)}{v} = \\frac{2(" + L + " - " + K.fmt(p.xp, 1) + ")}{" + K.fmt(p.v, 2) + "} = \\mathbf{" + K.fmt(dtF, 2) + "}\\ \\text{s}");
        setR("dt", m.echo ? K.fmt(m.echo.dt, 2) + " s" : "—", "2(L − x_p)/v = " + K.fmt(dtF, 2) + " s");
        setR("v", m.echo ? K.fmt(2 * (L - p.xp) / m.echo.dt, 2) + " m/s" : "—", "√(T/μ) = " + K.fmt(p.v, 2) + " m/s");
        setR("sign", m.echo ? (m.echo.sign < 0 ? "upside down" : "right way up") : "—", endType === "fixed" ? "fixed end inverts" : "free end doesn't");
        setR("end", K.fmt(m.endPeak, 2) + " m", endType === "fixed" ? "fixed: always 0" : "free: 2A = " + K.fmt(2 * p.A, 2) + " m");
        setR("y", K.fmt(y, 3) + " m");
        setR("vp", K.fmt(vp, 2) + " m/s", "formula " + K.fmt(vpFormula(p, p.xp, t), 2) + " m/s");
      }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A wave is a <b>shape that travels</b>; the rope only moves up and down. Every particle repeats its neighbour's motion a moment later, so the pattern slides along at $v = \\sqrt{T/\\mu}$: tighter rope, faster wave; heavier rope, slower wave.</p>" +
      "<p>Your hand fixes the frequency $f$. The rope fixes the speed $v$. The wavelength is whatever fits: $\\lambda = v/f$. In $y = A\\sin(kx - \\omega t + \\phi)$, $k = 2\\pi/\\lambda$ and $\\omega = 2\\pi f$, so $v = \\omega/k$. A minus sign between $kx$ and $\\omega t$ means it travels towards $+x$.</p>" +
      "<p>At an end the wave reflects. A <b>fixed end</b> sends it back upside down (a phase change of $\\pi$); a <b>free end</b> sends it back the right way up, and the end itself swings to $2A$.</p>" +
      '<div class="trap"><b>JEE trap: particle velocity is not wave velocity.</b> The particle moves across the rope with $v_p = \\partial y/\\partial t$, at most $A\\omega$. The wave moves along it at $v = \\omega/k$. They are linked by the slope: $v_p = -v\\,\\partial y/\\partial x$, so the particle is fastest where the rope is steepest (at $y = 0$), not at the crest.</div>');
    function apply(s) {
      setMode(s.mode);
      if (s.end) { endType = s.end; segSet(endSeg, s.end); }
      dir = s.dir || 1; segSet(dirSeg, dir);
      TS.set(s.T); muS.set(s.mu); AS.set(s.A); xpS.set(s.xp);
      if (s.f) fS.set(s.f);
      phS.set(s.phi || 0);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "λ = v/f", setup: { mode: "sine", T: 9, mu: 0.25, f: 1.5, A: 0.4, phi: 0, xp: 6 }, watch: "Predict λ, then press Play and read the crest gap",
        q: "A rope with linear density 0.25 kg/m is pulled with a tension of 9 N. One end is shaken at 1.5 Hz. What is the wavelength of the wave?",
        options: ["4.0 m", "9.0 m", "24 m", "2.7 m"], answer: 0,
        explain: "$v = \\sqrt{T/\\mu} = \\sqrt{9/0.25} = 6$ m/s, so $\\lambda = v/f = 6/1.5 = 4.0$ m. Multiplying instead of dividing gives 9 m; forgetting the square root gives $36/1.5 = 24$ m." },
      { level: "medium", tag: "reflection at a fixed end", setup: { mode: "pulse", end: "fixed", T: 9, mu: 0.25, A: 0.5, xp: 6 }, watch: "Predict the echo time and which way up it comes back, then press Play",
        q: "A 12 m rope ($\\mu$ = 0.25 kg/m, $T$ = 9 N) is tied to a wall at its far end. A pulse is sent along it. How long after the pulse passes the midpoint does its echo pass the midpoint, and which way up is it?",
        options: ["2.0 s, upside down", "2.0 s, the same way up", "1.0 s, upside down", "0.33 s, upside down"], answer: 0,
        hints: ["The echo has to go from the midpoint to the wall and back again.", "A fixed end can't move, so it pulls the rope the opposite way."],
        explain: "$v = \\sqrt{9/0.25} = 6$ m/s. The round trip from the midpoint is $2 \\times 6 = 12$ m, so $\\Delta t = 12/6 = 2.0$ s. A fixed end inverts the pulse. 1.0 s forgets the return trip; 0.33 s uses $v = T/\\mu$." },
      { level: "hard", tag: "phase from one particle", setup: { mode: "sine", T: 4, mu: 0.25, f: 1, A: 0.5, phi: 60, xp: 1, dir: 1 }, watch: "Before pressing Play, read y_p and the sign of v_p at t = 0",
        q: "A wave $y = 0.5\\sin(kx - \\omega t + \\phi)$ m has $\\lambda$ = 4 m and $f$ = 1 Hz. At $t = 0$ the particle at $x = 1$ m is at $y = +0.25$ m and moving <b>up</b>. What is $\\phi$ (between 0° and 360°)?",
        options: ["30°", "60°", "150°", "300°"], answer: 1,
        hints: ["At $x = 1$ m, $kx = 2\\pi/4 = \\pi/2$. Don't drop it.", "$y = 0.5\\sin(90° + \\phi) = 0.5\\cos\\phi = 0.25$ gives $\\phi = 60°$ or $300°$. Now use $v_p = -A\\omega\\cos(kx - \\omega t + \\phi) > 0$."],
        explain: "$y = 0.5\\cos\\phi = 0.25$, so $\\phi = 60°$ or $300°$. Then $v_p = -A\\omega\\cos(90° + \\phi) = A\\omega\\sin\\phi$, which is positive only for $\\phi = 60°$: $v_p = 0.5 \\times 2\\pi \\times 0.866 = 2.72$ m/s upwards. 30° and 150° come from forgetting the $kx$ term; 300° has the particle moving down." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    setMode("sine");
    transportUI = K.transport(P, sim, { onReset: reset, onPlay: function () { if (ended) reset(); } });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_travelling = {
        apply: apply, params: params,
        state: function () {
          var p = params();
          return { mode: mode, end: endType, t: sim.time, v: p.v, lam: p.lam, vMeas: vMeas(), lamMeas: m.lam, Tmeas: tMeas(), y: rec.y[rec.y.length - 1],
            vp: rec.v[rec.v.length - 1], vpF: vpFormula(p, p.xp, sim.time), vpMax: m.vpMax, echo: m.echo, endPeak: m.endPeak, peaks: m.peaks };
        }
      };
    }

    return function destroy() { sim.destroy(); [gy, gv, gs].forEach(function (g) { g.destroy(); }); };
  }
})();
