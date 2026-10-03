/* Dual nature, lab 2: matter waves. A particle gun with a voltage you set gives λ = h/p, and a Davisson–Germer
   setup scatters electrons off a nickel crystal to show the diffraction peak those waves predict. */
(function () {
  "use strict";
  var H_PL = 6.626e-34, E_CH = 1.602e-19, HC = 1240;                   // J s, C, eV nm
  var PARTICLES = {
    e: { id: "e", name: "electron", sym: "e⁻", m: 9.109e-31, q: 1, color: "normal" },
    p: { id: "p", name: "proton", sym: "p", m: 1.673e-27, q: 1, color: "acc" },
    a: { id: "a", name: "alpha", sym: "α", m: 6.645e-27, q: 2, color: "grav" }
  };
  var D_S = 0.2179;                       // nm: spacing of atom rows on the nickel surface (the "grating")
  var D_B = D_S * Math.sin(25 * Math.PI / 180);   // nm: spacing of the Bragg planes that reflect at θ = 65° (0.0921 nm)
  var GAP = 0.02;                         // m: cathode to anode in the gun
  var VMAX = 1000, PX_NM = 300;           // stage scale for the gun's wave: 300 px per nm

  var lab = {
    id: "debroglie", chapter: "dual", title: "Matter waves", short: "λ = h/p, Davisson–Germer",
    lede: "Accelerate an electron through a few volts and it behaves like a wave with a wavelength the size of an atom. Fire it at a crystal and it diffracts, just as de Broglie said it would.",
    tries: [
      { id: "dg", title: "Repeat Davisson and Germer",
        text: "In crystal mode, scan the detector at 54 V and find the peak at 50°.",
        why: "At 54 V, $\\lambda = 1.227/\\sqrt{54} = 0.167$ nm. Rows of nickel atoms $0.218$ nm apart send waves out in step where $d\\sin\\phi = \\lambda$, which is $\\phi = 50°$. Particles alone would give no peak at all." },
      { id: "shift", title: "Move the peak",
        text: "Scan at two voltages at least 10 V apart and compare where the peak lands.",
        why: "Higher $V$ means more momentum and a shorter $\\lambda$, so $\\sin\\phi = \\lambda/d$ is smaller and the peak swings towards the incoming beam. A wave property, plain to see." },
      { id: "tenth", title: "Make a 0.100 nm electron",
        text: "In gun mode, fire an electron whose wavelength reads 0.100 nm.",
        why: "Invert $\\lambda = 1.227/\\sqrt V$: $V = (1.227/0.100)^2 \\approx 150$ V. A handy rule: $V \\approx 150/\\lambda^2$ with $\\lambda$ in ångström." },
      { id: "heavy", title: "Fire something heavier",
        text: "Switch to a proton or an alpha particle and fire it.",
        why: "$\\lambda = h/\\sqrt{2mK}$. A proton is 1836 times heavier than an electron, so at the same energy its wavelength is $\\sqrt{1836} \\approx 43$ times shorter: far too small to diffract off a crystal." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function texSci(x, d) {
    var e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e);
    if (Math.abs(+m.toFixed(d)) >= 10) { m /= 10; e++; }
    return m.toFixed(d) + "\\times10^{" + e + "}";
  }
  function txtSci(x, d) { var s = texSci(x, d).split("\\times10^"); return s[0] + "×10" + s[1].replace(/[{}]/g, "").split("").map(function (c) { return { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }[c]; }).join(""); }
  function fmtLam(x) { var s = x.toPrecision(3); return /e/.test(s) ? Number(s).toExponential(2) : s; }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 460;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });

    /* ---------- state + physics ---------- */
    var st = { mode: "gun", particle: PARTICLES.e, V: 100, compare: "V", phi: 50 };
    // kinetic energy in eV: through V volts a charge q·e gains q·V eV; "same KE" gives every particle V eV
    function KE(pt) { return st.compare === "K" ? st.V : pt.q * st.V; }
    function lamOf(pt, K_eV) { return H_PL / Math.sqrt(2 * pt.m * K_eV * E_CH) * 1e9; }   // nm
    function solve() {
      var pt = st.particle, Ke = KE(pt), p = Math.sqrt(2 * pt.m * Ke * E_CH), lam = H_PL / p * 1e9;
      var lamE = lamOf(PARTICLES.e, st.V), sinPk = lamE / D_S;
      return { K: Ke, p: p, lam: lam, v: p / pt.m, lamPhoton: HC / Ke, lamE: lamE,
        peak: sinPk <= 1 ? Math.asin(sinPk) * 180 / Math.PI : null };
    }
    // detector counts (relative) for electrons of V volts at scattering angle phi (deg):
    // a smooth background plus diffraction orders where d_s sinφ = nλ. The bump is strongest when the planes
    // below the surface also satisfy Bragg's 2d sinθ = λ (θ = 90° − φ/2): that happens at 54 V.
    function counts(phi, V) {
      var lam = lamOf(PARTICLES.e, V), s = Math.sin(phi * Math.PI / 180), I = 0.25 + 0.25 * Math.cos(phi * Math.PI / 180);
      for (var n = 1; n <= 4; n++) {
        if (n * lam > D_S * 1.05) break;
        var sp = Math.min(1, n * lam / D_S), pk = Math.asin(sp);
        var mis = 2 * D_B * Math.cos(pk / 2) / (n * lam) - 1;
        var A = (0.5 + 0.5 * Math.exp(-Math.pow(mis / 0.08, 2))) / n;
        I += A * Math.exp(-Math.pow((D_S * s / (n * lam) - 1) / 0.05, 2));
      }
      return I;
    }

    /* ---------- controls ---------- */
    var vS = K.slider({ label: "Accelerating voltage $V$", unit: "V", min: 1, max: VMAX, step: 1, value: st.V,
      onInput: function (v) { st.V = v; changed(); }, hint: "You can also drag the dial on the power supply (it's logarithmic)." });
    var phS = K.slider({ label: "Detector angle $\\phi$", unit: "°", min: 0, max: 90, step: 0.5, value: st.phi,
      onInput: function (v) { st.phi = v; scanState = null; update(true); }, hint: "Or drag the detector round its arc." });
    P.controls.innerHTML = "<h3>Experiment</h3>";
    var modeSeg = K.seg([{ label: "Particle gun", value: "gun" }, { label: "Davisson–Germer", value: "dg" }], st.mode, function (v) { setMode(v); reset(); }, "Mode");
    P.controls.appendChild(modeSeg);
    var gunBox = K.h("<div><h3>Particle</h3></div>");
    var partSeg = K.seg([{ label: "electron", value: "e" }, { label: "proton", value: "p" }, { label: "alpha", value: "a" }], "e", function (v) { st.particle = PARTICLES[v]; reset(); }, "Particle");
    var cmpSeg = K.seg([{ label: "same V", value: "V" }, { label: "same KE", value: "K" }], "V", function (v) { st.compare = v; reset(); }, "Compare at");
    gunBox.appendChild(partSeg);
    gunBox.appendChild(K.h('<p class="control-hint">Compare the three particles at</p>'));
    gunBox.appendChild(cmpSeg);
    P.controls.appendChild(K.h("<h3>Voltage</h3>"));
    P.controls.appendChild(vS.el);
    P.controls.appendChild(gunBox);
    var dgBox = K.h("<div><h3>Detector</h3></div>");
    dgBox.appendChild(phS.el);
    var show = { bragg: true, polar: true };
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Bragg planes", true, function (v) { show.bragg = v; }));
    row.appendChild(K.check("Polar plot", true, function (v) { show.polar = v; }));
    dgBox.appendChild(row);
    dgBox.hidden = true;
    P.controls.appendChild(dgBox);
    var presets = K.h('<div class="row"></div>');
    [{ label: "1 V", V: 1 }, { label: "54 V", V: 54 }, { label: "100 V", V: 100 }, { label: "150 V", V: 150 }, { label: "1 kV", V: 1000 }].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p.label + "</button>");
      b.addEventListener("click", function () { st.V = p.V; vS.set(p.V); changed(); });
      presets.appendChild(b);
    });
    P.controls.appendChild(K.h("<h3>Presets</h3>"));
    P.controls.appendChild(presets);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-normal"><i></i>electron</span><span class="c-acc"><i></i>proton</span>' +
      '<span class="c-grav"><i></i>alpha</span><span class="c-ten"><i></i>photon, same energy</span><span class="c-disp"><i></i>matter wave</span></div>'));

    function setMode(m) {
      st.mode = m;
      modeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === m)); });
      gunBox.hidden = m !== "gun"; dgBox.hidden = m !== "dg";
      if (m === "dg") { st.particle = PARTICLES.e; partSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === "e")); }); }
    }

    /* ---------- world ---------- */
    var shot = null, last = null, fires = [], scanState = null, lastScan = null, scans = [], dgTrace = [], sprinkles = [];

    function changed() {
      shot = null; scanState = null;
      if (st.mode === "dg") dgTrace.push([st.V, counts(st.phi, st.V)]);
      theory(); update(true);
    }
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      shot = null; scanState = null; sprinkles = [];
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }

    // fire one particle: integrate its motion across the gun gap, then let it drift across the stage
    function fire() {
      var pt = st.particle, Ke = KE(pt), Veff = Ke / pt.q, a = pt.q * E_CH * Veff / GAP / pt.m;
      var tEst = Math.sqrt(2 * GAP / a);
      shot = { pt: pt, compare: st.compare, V: st.V, K: Ke, x: 0, v: 0, a: a, dt: tEst / 1200, phase: "gun", drift: 0, vExit: null };
      sim.resetClock();
    }
    function stepShot() {
      var s = shot;
      if (s.phase === "gun") {
        for (var i = 0; i < 30 && s.phase === "gun"; i++) {
          var xn = s.x + s.v * s.dt + 0.5 * s.a * s.dt * s.dt;
          if (xn >= GAP) {
            // the last part of a constant-acceleration step: v² = v₀² + 2a(GAP − x)
            s.vExit = Math.sqrt(s.v * s.v + 2 * s.a * (GAP - s.x)); s.x = GAP; s.phase = "drift";
            var lam = H_PL / (s.pt.m * s.vExit) * 1e9;
            last = { particle: s.pt.id, compare: s.compare, V: s.V, K: s.K, v: s.vExit, p: s.pt.m * s.vExit, lam: lam };
            fires.push(last); if (fires.length > 40) fires.shift();
            K.flash(P.note, s.pt.name + ": v = " + texless(s.vExit) + ", λ = " + fmtLam(lam) + " nm", 3500);
            if (s.pt.id !== "e") tries.mark("heavy");
            if (s.pt.id === "e" && Math.abs(lam - 0.1) <= 0.0005) tries.mark("tenth");
          } else { s.x = xn; s.v += s.a * s.dt; }
        }
      } else {
        s.drift += K.DT * 520;
        if (s.drift > 760) { shot = null; sim.pause(); transportUI.render(); update(true); }
      }
    }
    function texless(v) { return v >= 1e6 ? (v / 1e6).toFixed(2) + "×10⁶ m/s" : (v / 1e3).toFixed(1) + " km/s"; }

    // scan: swing the detector from 0° to 90°, recording counts every 0.05°
    function startScan() { scanState = { phi: 0, pts: [], V: st.V }; st.phi = 0; phS.set(0); sim.resetClock(); }
    function stepScan() {
      var s = scanState;
      for (var i = 0; i < 5; i++) {
        s.pts.push([s.phi, counts(s.phi, s.V)]);
        if (s.phi >= 90 - 1e-9) { finishScan(); return; }
        s.phi = Math.min(90, Math.round((s.phi + 0.05) * 100) / 100);
      }
      st.phi = s.phi; phS.set(s.phi);
    }
    function finishScan() {
      var s = scanState, pts = s.pts, best = -1;
      // the highest interior local maximum, refined with a parabola through its neighbours
      for (var i = 1; i < pts.length - 1; i++) {
        if (pts[i][1] > pts[i - 1][1] && pts[i][1] >= pts[i + 1][1] && (best < 0 || pts[i][1] > pts[best][1])) best = i;
      }
      var res = { V: s.V, pts: pts, peak: null, lam: null };
      if (best > 0) {
        var y0 = pts[best - 1][1], y1 = pts[best][1], y2 = pts[best + 1][1], den = y0 - 2 * y1 + y2;
        var off = den !== 0 ? 0.5 * (y0 - y2) / den : 0;
        res.peak = pts[best][0] + off * 0.05;
        res.lam = D_S * Math.sin(res.peak * Math.PI / 180);
        st.phi = Math.round(res.peak * 2) / 2; phS.set(st.phi);
      }
      lastScan = res; scans.push(res); if (scans.length > 20) scans.shift();
      scanState = null; sim.pause(); transportUI.render();
      K.flash(P.note, res.peak == null ? "No peak: λ is longer than the row spacing, so sin φ = λ/d has no answer" :
        "Peak at φ = " + res.peak.toFixed(1) + "°, so λ = d sin φ = " + res.lam.toFixed(3) + " nm", 4000);
      if (res.peak != null) {
        if (Math.abs(res.V - 54) <= 1 && Math.abs(res.peak - 50) <= 1) tries.mark("dg");
        scans.forEach(function (q) {
          if (q !== res && q.peak != null && Math.abs(q.V - res.V) >= 10 && (q.V - res.V) * (q.peak - res.peak) < 0) tries.mark("shift");
        });
      }
      update(true);
    }

    sim.on("step", function () {
      if (st.mode === "gun" && shot) stepShot();
      if (st.mode === "dg") {
        if (scanState) stepScan();
        // electrons raining onto the crystal and scattering, sampled from the count pattern
        var V = scanState ? scanState.V : st.V;
        for (var j = 0; j < 3; j++) {
          var ang = (Math.random() * 2 - 1) * 90;
          if (Math.random() * 1.6 < counts(Math.abs(ang), V)) sprinkles.push({ ang: ang, r: -180, life: 0 });
        }
        sprinkles = sprinkles.filter(function (sp) { sp.r += K.DT * 420; return sp.r < 250; });
      }
      update(false);
    });

    /* ---------- direct manipulation ---------- */
    var DIAL = { x0: 70, x1: 380, y: 250 }, O = { x: 500, y: 360 }, R_DET = 240, dragging = null;
    function dialX(V) { return DIAL.x0 + Math.log10(V) / 3 * (DIAL.x1 - DIAL.x0); }
    var handlers = {
      down: function (p) {
        if (st.mode === "gun" && Math.abs(p.py - DIAL.y) < 16 && p.px > DIAL.x0 - 12 && p.px < DIAL.x1 + 12) dragging = "V";
        else if (st.mode === "dg") {
          var dx = p.px - O.x, dy = O.y - p.py, r = Math.hypot(dx, dy);
          if (Math.abs(r - R_DET) < 40 && dy > -10) dragging = "phi"; else return false;
        } else return false;
        handlers.drag(p); return true;
      },
      drag: function (p) {
        if (dragging === "V") {
          var u = K.clamp((p.px - DIAL.x0) / (DIAL.x1 - DIAL.x0), 0, 1);
          st.V = Math.max(1, Math.round(Math.pow(10, 3 * u))); vS.set(st.V); changed();
        } else if (dragging === "phi") {
          var ang = Math.atan2(Math.abs(p.px - O.x), Math.max(O.y - p.py, 0)) * 180 / Math.PI;
          scanState = null; st.phi = K.clamp(Math.round(ang * 2) / 2, 0, 90); phS.set(st.phi); update(true);
        }
      },
      up: function () { dragging = null; }
    };
    sim.pointer(handlers);

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) { if (st.mode === "gun") drawGun(ctx); else drawDG(ctx); });
    function font(w, s) { return w + " " + s + "px 'JetBrains Mono', monospace"; }

    function drawGun(ctx) {
      var s = solve(), pt = st.particle, col = th[pt.color], by = 130;
      // gun: cathode, anode with a hole, supply
      ctx.fillStyle = th.muted; ctx.fillRect(56, by - 40, 10, 80);
      ctx.fillStyle = th.body; ctx.fillRect(156, by - 40, 8, 32); ctx.fillRect(156, by + 8, 8, 32);
      ctx.strokeStyle = th.line; ctx.lineWidth = 2; ctx.strokeRect(40, by - 56, 140, 112);
      K.label(ctx, "particle gun", 110, by - 62, th.muted, { font: font(600, 11) });
      K.label(ctx, (st.compare === "K" ? KE(pt) / pt.q : st.V).toFixed(st.compare === "K" && pt.q === 2 ? 1 : 0) + " V", 110, by + 76, th.app, { font: font(700, 12) });
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(61, by + 40); ctx.lineTo(61, by + 60); ctx.lineTo(90, by + 60); ctx.moveTo(130, by + 60); ctx.lineTo(160, by + 60); ctx.lineTo(160, by + 40); ctx.stroke();
      // beam line
      ctx.strokeStyle = K.alpha(th.muted, 0.5); ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(165, by); ctx.lineTo(960, by); ctx.stroke(); ctx.setLineDash([]);
      // the particle and its wave packet, drawn to scale (300 px per nm)
      if (shot) {
        var x = shot.phase === "gun" ? 66 + 90 * shot.x / GAP : 166 + shot.drift;
        if (shot.phase === "drift") {
          var lamPx = last.lam * PX_NM;
          ctx.strokeStyle = th.disp; ctx.lineWidth = 2;
          if (lamPx >= 3) {
            ctx.beginPath();
            for (var dx = -110; dx <= 110; dx += 1) {
              var env = Math.exp(-dx * dx / (2 * 45 * 45)), y = by - 26 * env * Math.cos(2 * Math.PI * dx / lamPx);
              if (dx === -110) ctx.moveTo(x + dx, y); else ctx.lineTo(x + dx, y);
            }
            ctx.stroke();
          } else {
            ctx.fillStyle = K.alpha(th.disp, 0.35); ctx.fillRect(x - 60, by - 3, 120, 6);
            K.label(ctx, "λ too short to draw at this scale", x, by - 12, th.disp, { font: font(600, 11) });
          }
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, by, pt.id === "e" ? 5 : 8, 0, Math.PI * 2); ctx.fill();
      } else {
        K.label(ctx, "press Fire", 560, by - 10, th.muted, { font: font(600, 12) });
      }
      // scale bar
      ctx.fillStyle = th.ink; ctx.fillRect(760, 200, 0.1 * PX_NM, 3);
      ctx.fillRect(760, 194, 2, 15); ctx.fillRect(760 + 0.1 * PX_NM - 2, 194, 2, 15);
      ctx.font = font(600, 11); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = th.muted;
      ctx.fillText("0.1 nm (wave to scale)", 760 + 0.1 * PX_NM + 8, 201);
      // voltage dial (log)
      ctx.fillStyle = th.line; ctx.fillRect(DIAL.x0, DIAL.y - 2, DIAL.x1 - DIAL.x0, 4);
      ctx.font = font(600, 10); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = th.muted;
      [1, 10, 100, 1000].forEach(function (v) { var xx = dialX(v); ctx.fillRect(xx - 1, DIAL.y - 7, 2, 14); ctx.fillText(v + " V", xx, DIAL.y + 9); });
      ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(dialX(st.V), DIAL.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = th.muted; ctx.fillText("← drag V", DIAL.x1 + 18, DIAL.y);
      drawRuler(ctx, s);
    }
    // a log ruler of wavelengths: where each particle and the photon of the same energy sit
    function drawRuler(ctx, s) {
      var x0 = 90, x1 = 930, y = 360, lo = -6, hi = 3;
      function X(l) { return x0 + (Math.log10(l) - lo) / (hi - lo) * (x1 - x0); }
      ctx.fillStyle = th.muted; ctx.font = font(700, 11); ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText("wavelength, log scale (nm)", x0, y - 62);
      [[1e-6, 1e-5, "nucleus"], [0.1, 0.5, "atom"], [400, 700, "visible"]].forEach(function (b) {
        ctx.fillStyle = K.alpha(th.muted, 0.15); ctx.fillRect(X(b[0]), y - 8, Math.max(X(b[1]) - X(b[0]), 4), 16);
        ctx.fillStyle = th.muted; ctx.font = font(600, 10); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(b[2], (X(b[0]) + X(b[1])) / 2, y + 26);
      });
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.font = font(600, 10); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = th.muted;
      for (var e = lo; e <= hi; e++) { var xx = X(Math.pow(10, e)); ctx.fillRect(xx - 0.5, y - 5, 1, 10); ctx.fillText("10" + (e < 0 ? "⁻" : "") + "⁰¹²³⁴⁵⁶⁷⁸⁹"[Math.abs(e)], xx, y + 8); }
      var rows = ["e", "p", "a"].map(function (id) { var pt = PARTICLES[id]; return { pt: pt, lam: lamOf(pt, KE(pt)) }; });
      rows.forEach(function (r, i) {
        var xx = X(r.lam), cur = r.pt === st.particle, c = th[r.pt.color], yy = y - 14 - i * 14;
        ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xx, y - 2); ctx.lineTo(xx - 6, y - 12); ctx.lineTo(xx + 6, y - 12); ctx.closePath();
        if (cur) ctx.fill(); else ctx.stroke();
        K.label(ctx, r.pt.sym + " " + fmtLam(r.lam), xx, yy - 2 - (i ? 6 : 0), c, { font: font(cur ? 800 : 600, 11) });
      });
      var xp = X(s.lamPhoton);
      ctx.fillStyle = th.ten; ctx.beginPath(); ctx.moveTo(xp, y + 2); ctx.lineTo(xp - 6, y + 12); ctx.lineTo(xp + 6, y + 12); ctx.closePath(); ctx.fill();
      K.label(ctx, "photon " + fmtLam(s.lamPhoton), xp, y + 60, th.ten, { font: font(700, 11) });
      K.label(ctx, st.compare === "K" ? "all with KE = " + st.V + " eV" : "all through " + st.V + " V (alpha has charge 2e)", (x0 + x1) / 2, y + 84, th.muted, { font: font(600, 11) });
    }

    function drawDG(ctx) {
      var s = solve(), V = scanState ? scanState.V : st.V;
      // crystal: rows of nickel atoms
      ctx.fillStyle = K.alpha(th.muted, 0.12); ctx.fillRect(300, O.y, 400, H - O.y);
      ctx.fillStyle = th.muted;
      for (var r = 0; r < 4; r++) for (var c = -7; c <= 7; c++) {
        ctx.beginPath(); ctx.arc(O.x + c * 26 + (r % 2) * 13, O.y + 10 + r * 22, 6, 0, Math.PI * 2); ctx.fill();
      }
      K.label(ctx, "nickel crystal", 760, O.y + 46, th.muted, { font: font(600, 11), align: "left" });
      // gun overhead
      ctx.fillStyle = th["surface-2"]; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
      ctx.fillRect(O.x - 22, 22, 44, 70); ctx.strokeRect(O.x - 22, 22, 44, 70);
      K.label(ctx, "electron gun, " + V + " V", O.x + 30, 50, th.app, { font: font(700, 12), align: "left" });
      ctx.strokeStyle = th.normal; ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(O.x, 92); ctx.lineTo(O.x, O.y); ctx.stroke(); ctx.globalAlpha = 1;
      // polar plot of counts
      var maxI = 0, a;
      for (a = 0; a <= 90; a += 0.5) maxI = Math.max(maxI, counts(a, V));
      if (show.polar) {
        ctx.beginPath();
        for (a = -90; a <= 90; a += 0.5) {
          var rr = 190 * counts(Math.abs(a), V) / maxI, px = O.x + rr * Math.sin(a * Math.PI / 180), py = O.y - rr * Math.cos(a * Math.PI / 180);
          if (a === -90) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fillStyle = K.alpha(th.disp, 0.12); ctx.fill(); ctx.strokeStyle = th.disp; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // scattered electrons
      ctx.fillStyle = th.normal;
      sprinkles.forEach(function (sp) {
        var x, y;
        if (sp.r < 0) { x = O.x; y = O.y + sp.r; } else { x = O.x + sp.r * Math.sin(sp.ang * Math.PI / 180); y = O.y - sp.r * Math.cos(sp.ang * Math.PI / 180); }
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      });
      // detector arc and detector
      ctx.strokeStyle = th.line; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(O.x, O.y, R_DET, -Math.PI / 2, 0); ctx.stroke(); ctx.setLineDash([]);
      var dr = st.phi * Math.PI / 180, dx = O.x + R_DET * Math.sin(dr), dy = O.y - R_DET * Math.cos(dr);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(dr);
      ctx.fillStyle = th.acc; ctx.fillRect(-14, -22, 28, 22); ctx.restore();
      K.label(ctx, "detector φ = " + st.phi.toFixed(1) + "°", dx + 22, dy - 12, th.acc, { font: font(700, 12), align: "left", bg: true });
      K.label(ctx, "counts " + counts(st.phi, V).toFixed(2), dx + 22, dy + 8, th.ink, { font: font(600, 11), align: "left" });
      // Bragg geometry: planes at θ = 90° − φ/2 to the beam, normal along the bisector
      if (show.bragg) {
        var half = (st.phi / 2) * Math.PI / 180, nx = Math.sin(half), ny = -Math.cos(half);
        ctx.save(); ctx.beginPath(); ctx.rect(300, O.y, 400, H - O.y); ctx.clip();
        ctx.strokeStyle = K.alpha(th.app, 0.7); ctx.lineWidth = 1.2;
        for (var k = 0; k < 7; k++) {
          var cx = O.x - nx * k * 16, cy = O.y - ny * k * 16;
          ctx.beginPath(); ctx.moveTo(cx - ny * 300, cy + nx * 300); ctx.lineTo(cx + ny * 300, cy - nx * 300); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = th.app; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(O.x + nx * 120, O.y + ny * 120); ctx.stroke(); ctx.setLineDash([]);
        K.label(ctx, "θ = " + (90 - st.phi / 2).toFixed(1) + "°", O.x - 120, O.y - 14, th.app, { font: font(700, 11), bg: true });
        K.label(ctx, "Bragg planes, d = " + D_B.toFixed(4) + " nm", 300, O.y - 40, th.app, { font: font(600, 11), align: "left" });
      }
      if (s.peak == null) K.label(ctx, "λ = " + s.lamE.toFixed(3) + " nm > d: no first-order peak", 140, 140, th.bad, { font: font(700, 12), align: "left" });
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">λ vs V</b> · dashed $h/\\sqrt{2mK}$ for your particle; dots are your shots and scans</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">counts vs φ</b> · solid = scan; the line marks $d\\sin\\phi = \\lambda$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">counts at your φ vs V</b> · at 50° it peaks at 54 V</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gl = new K.Graph(cv[0], { yLabel: "λ (nm)", xLabel: "V (V)", xMax: 200, yMin: 0, color: th.disp });
    var gc = new K.Graph(cv[1], { yLabel: "counts", xLabel: "φ (°)", xMax: 90, yMin: 0, color: th.acc });
    var gv = new K.Graph(cv[2], { yLabel: "counts", xLabel: "V (V)", xMax: 150, yMin: 0, color: th.acc });

    function theory() {
      var pt = st.particle, pts = [], cp = [], vp = [], V0 = scanState ? scanState.V : st.V;
      gl.o.xMax = st.V <= 180 ? 200 : 1000;
      var vMinPlot = gl.o.xMax / 40;
      for (var v = vMinPlot; v <= gl.o.xMax + 1e-9; v += gl.o.xMax / 200) pts.push([v, lamOf(pt, st.compare === "K" ? v : pt.q * v)]);
      gl.set("theory", { points: pts, color: th[pt.color], dash: [5, 5], width: 1.5 });
      for (var a = 0; a <= 90; a += 0.25) cp.push([a, counts(a, V0)]);
      gc.set("theory", { points: cp, color: th.acc, dash: [5, 5], width: 1.5 });
      for (var vv = 20; vv <= 150; vv += 0.5) vp.push([vv, counts(st.phi, vv)]);
      gv.set("theory", { points: vp, color: th.acc, dash: [5, 5], width: 1.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100), slowGraphs = K.throttle(drawGraphs, 60);
    function update(force) { if (force) { theory(); drawGraphs(); renderMaths(); } else { slowGraphs(); slowMaths(); } }
    function drawGraphs() {
      var s = solve(), pt = st.particle;
      var mine = fires.filter(function (f) { return f.particle === pt.id && f.compare === st.compare; }).map(function (f) { return [f.V, f.lam]; });
      if (pt.id === "e") scans.forEach(function (q) { if (q.peak != null) mine.push([q.V, q.lam]); });
      gl.extra = function (ctx, X, Y) { dots(ctx, X, Y, mine, th[pt.color]); ring(ctx, X(st.V), Y(s.lam)); };
      var sc = scanState || lastScan;
      gc.set("sim", { points: sc ? sc.pts : [], color: th.acc, width: 2.5 });
      var pkV = scanState ? scanState.V : st.V, sp = lamOf(PARTICLES.e, pkV) / D_S;
      gc.extra = function (ctx, X, Y) {
        if (sp <= 1) {
          var xx = X(Math.asin(sp) * 180 / Math.PI);
          ctx.strokeStyle = th.disp; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(xx, 10); ctx.lineTo(xx, Y(0)); ctx.stroke(); ctx.setLineDash([]);
        }
        ring(ctx, X(st.phi), Y(counts(st.phi, pkV)));
      };
      gv.set("sim", { points: dgTrace.filter(function (q) { return q[0] <= 150; }).slice().sort(function (a, b) { return a[0] - b[0]; }), color: th.acc, width: 2.5 });
      gv.extra = function (ctx, X, Y) { if (st.V <= 150) ring(ctx, X(st.V), Y(counts(st.phi, st.V))); };
      [gl, gc, gv].forEach(function (g) { g.dirty = true; g.draw(); });
    }
    function dots(ctx, X, Y, pts, color) { ctx.fillStyle = color; pts.forEach(function (q) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4.5, 0, Math.PI * 2); ctx.fill(); }); }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Momentum from the energy it gained", "de Broglie wavelength", "A photon with the same energy (hc = 1240 eV nm)", "Davisson–Germer: where the peak sits"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "K", label: "kinetic energy", cls: "c-vel" }, { id: "v", label: "speed", cls: "c-vel" }, { id: "p", label: "momentum p" },
      { id: "lam", label: "λ = h/p", cls: "c-disp" }, { id: "ph", label: "photon, same energy", cls: "c-ten" }, { id: "ratio", label: "λ ratios" },
      { id: "peak", label: "diffraction peak", cls: "c-acc" }, { id: "dglam", label: "λ from the crystal", cls: "c-disp" }
    ]);
    function renderMaths() {
      var s = solve(), pt = st.particle, mStr = texSci(pt.m, 3);
      K.tex(eqEls[0], "p = \\sqrt{2mK} = \\sqrt{2(" + mStr + ")(" + K.fmt(s.K, s.K % 1 ? 1 : 0) + "\\times1.602\\times10^{-19})} = \\mathbf{" + texSci(s.p, 3) + "}\\ \\text{kg m/s}");
      K.tex(eqEls[1], "\\lambda = \\frac{h}{p} = \\frac{6.626\\times10^{-34}}{" + texSci(s.p, 3) + "} = \\mathbf{" + fmtLam(s.lam) + "}\\ \\text{nm}" +
        (pt.id === "e" ? "\\quad\\Big(\\approx\\frac{1.227}{\\sqrt{" + st.V + "}} = " + fmtLam(1.227 / Math.sqrt(st.V)) + "\\Big)" : ""));
      K.tex(eqEls[2], "\\lambda_{ph} = \\frac{1240}{E} = \\frac{1240}{" + K.fmt(s.K, s.K % 1 ? 1 : 0) + "} = \\mathbf{" + fmtLam(s.lamPhoton) + "}\\ \\text{nm} \\;(" + Math.round(s.lamPhoton / s.lam).toLocaleString("en") + "\\times \\text{longer})");
      if (s.peak != null) K.tex(eqEls[3], "d\\sin\\phi = \\lambda \\Rightarrow \\phi = \\sin^{-1}\\frac{" + s.lamE.toFixed(3) + "}{" + D_S.toFixed(3) + "} = \\mathbf{" + s.peak.toFixed(1) + "°};\\ 2d'\\sin\\theta = 2(" + D_B.toFixed(4) + ")\\sin" + (90 - s.peak / 2).toFixed(1) + "° = " + (2 * D_B * Math.cos(s.peak * Math.PI / 360)).toFixed(3) + "\\ (\\lambda = " + s.lamE.toFixed(3) + ")");
      else K.tex(eqEls[3], "\\sin\\phi = \\frac{\\lambda}{d} = \\frac{" + s.lamE.toFixed(3) + "}{" + D_S.toFixed(3) + "} \\gt 1\\;\\Rightarrow\\;\\text{no peak: raise } V");
      var mine = last && last.particle === pt.id && last.V === st.V && last.compare === st.compare ? last : null;
      setR("K", K.fmt(s.K, s.K % 1 ? 1 : 0) + " eV", txtSci(s.K * E_CH, 2) + " J");
      setR("v", mine ? texless(mine.v) : texless(s.v), mine ? "from the simulated gun · formula " + texless(s.v) : "formula √(2K/m)");
      setR("p", txtSci(s.p, 3) + " kg m/s");
      setR("lam", fmtLam(mine ? mine.lam : s.lam) + " nm", mine ? "h/(mv) from the shot · formula " + fmtLam(s.lam) : "formula");
      setR("ph", fmtLam(s.lamPhoton) + " nm", "1240/E");
      var le = lamOf(PARTICLES.e, KE(PARTICLES.e)), lp = lamOf(PARTICLES.p, KE(PARTICLES.p)), la = lamOf(PARTICLES.a, KE(PARTICLES.a));
      setR("ratio", "λe/λp = " + (le / lp).toFixed(1) + ", λp/λα = " + (lp / la).toFixed(2), st.compare === "K" ? "same KE" : "same V");
      var ls = lastScan && lastScan.V === st.V ? lastScan : null;
      setR("peak", ls && ls.peak != null ? ls.peak.toFixed(1) + "°" : "—", ls ? "scanned · formula " + (s.peak != null ? s.peak.toFixed(1) + "°" : "none") : "scan in crystal mode (formula " + (s.peak != null ? s.peak.toFixed(1) + "°" : "none") + ")");
      setR("dglam", ls && ls.lam ? ls.lam.toFixed(3) + " nm" : "—", ls && ls.lam ? "d sin φ · h/p gives " + s.lamE.toFixed(3) : "electrons at " + st.V + " V");
      P.hud.innerHTML = "<span>" + (st.mode === "gun" ? pt.name : "electrons on nickel") + "</span><span>V = " + st.V + " V</span><span>λ = " + fmtLam(st.mode === "gun" ? s.lam : s.lamE) + " nm</span>";
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Photons carry momentum $p = h/\\lambda$. De Broglie turned it round: <b>anything with momentum has a wavelength</b>, $\\lambda = h/p$. For a charge $q$ accelerated from rest through $V$, $K = qV$ and $p = \\sqrt{2mK}$, so $\\lambda = h/\\sqrt{2mqV}$. For an electron that's $\\lambda \\approx 1.227/\\sqrt V$ nm (with $h = 6.626\\times10^{-34}$ J s, $m_e = 9.109\\times10^{-31}$ kg, $e = 1.602\\times10^{-19}$ C).</p>" +
      "<p>A few tens of volts give $\\lambda \\sim 0.1$ nm, the spacing of atoms in a crystal, so a crystal acts as a diffraction grating. Davisson and Germer fired 54 V electrons at nickel and found a strong peak at $50°$. The surface rows ($d = 0.218$ nm) put it where $d\\sin\\phi = \\lambda$; seen as reflection from planes inside ($d' = 0.092$ nm here, 0.091 nm in NCERT, which ignores the electrons speeding up as they enter the metal), it's Bragg's $2d'\\sin\\theta = \\lambda$ with $\\theta = 90° - \\phi/2 = 65°$. Both give $0.167$ nm, de Broglie's value.</p>" +
      '<div class="trap"><b>JEE trap: same V is not same KE.</b> Through the same voltage an alpha particle gains $2eV$ because its charge is $2e$, so $\\lambda_p/\\lambda_\\alpha = \\sqrt{m_\\alpha q_\\alpha/m_p q_p} = \\sqrt{4 \\times 2} = 2\\sqrt2$. At the same KE it is only $\\sqrt{m_\\alpha/m_p} = 2$. And a photon of the same energy has a far longer wavelength: $\\lambda = hc/E$, not $h/\\sqrt{2mE}$.</div>');
    function apply(s) {
      setMode(s.mode);
      st.particle = PARTICLES[s.particle || "e"];
      partSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === st.particle.id)); });
      st.compare = s.compare || "V";
      cmpSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === st.compare)); });
      st.V = s.V; vS.set(s.V);
      if (s.phi != null) { st.phi = s.phi; phS.set(s.phi); }
      dgTrace = [];
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "λ of an electron", setup: { mode: "gun", particle: "e", V: 100, compare: "V" }, watch: "Predict λ, then press Fire",
        q: "An electron is accelerated from rest through 100 V. What is its de Broglie wavelength?",
        options: ["0.123 nm", "1.23 nm", "0.0123 nm", "12.4 nm"], answer: 0,
        explain: "$\\lambda = 1.227/\\sqrt{100} = 0.123$ nm (1.23 Å). 12.4 nm is the wavelength of a <i>photon</i> of energy 100 eV: $1240/100$. Same energy, very different wavelength." },
      { level: "medium", tag: "proton vs alpha", setup: { mode: "gun", particle: "p", V: 100, compare: "V" }, watch: "Fire a proton, then an alpha, and compare λ",
        q: "A proton and an alpha particle are accelerated from rest through the same potential difference. What is $\\lambda_p/\\lambda_\\alpha$? (Take $m_\\alpha \\approx 4m_p$.)",
        options: ["$2\\sqrt2$", "$2$", "$\\sqrt2$", "$\\frac{1}{2\\sqrt2}$"], answer: 0,
        hints: ["$\\lambda = h/\\sqrt{2mqV}$. What are $m$ and $q$ for each?", "The alpha has 4 times the mass <i>and</i> twice the charge."],
        explain: "$\\lambda \\propto 1/\\sqrt{mq}$, so $\\lambda_p/\\lambda_\\alpha = \\sqrt{(4m_p)(2e)/(m_p e)} = \\sqrt8 = 2\\sqrt2 \\approx 2.83$. The lab shows 2.82 because a real alpha is a little lighter than $4m_p$ (that's its binding energy). Answer 2 forgets the charge." },
      { level: "hard", tag: "Davisson–Germer", setup: { mode: "dg", particle: "e", V: 54, phi: 50 }, watch: "Scan at 54 V, then raise V until the peak sits at 30°",
        q: "In the lab, 54 V electrons give a first-order diffraction peak at $\\phi = 50°$ from the nickel surface rows ($d\\sin\\phi = \\lambda$). At what accelerating voltage will the first-order peak appear at $\\phi = 30°$?",
        options: ["23 V", "83 V", "127 V", "150 V"], answer: 2,
        hints: ["$\\sin\\phi = \\lambda/d$ and $\\lambda \\propto 1/\\sqrt V$, so $\\sin\\phi \\propto 1/\\sqrt V$.", "$V_2 = V_1 (\\sin\\phi_1/\\sin\\phi_2)^2$."],
        explain: "$\\sin\\phi \\propto \\lambda \\propto V^{-1/2}$, so $V_2 = 54\\,(\\sin 50°/\\sin 30°)^2 = 54 \\times (0.766/0.5)^2 = 127$ V. Check: $\\lambda = 1.227/\\sqrt{127} = 0.109$ nm $= 0.218 \\sin 30°$. 83 V forgets the square; 150 V uses the angles instead of their sines." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Fire / scan", onReset: reset, onPlay: function () {
      if (st.mode === "gun") { if (!shot) fire(); } else if (!scanState) startScan();
    } });
    reset();

    if (location.hostname === "localhost") {
      window.__lab_debroglie = {
        apply: apply,
        fire: function () { setMode("gun"); fire(); sim.play(); transportUI.render(); }, flying: function () { return !!shot; },
        scan: function () { startScan(); sim.play(); transportUI.render(); }, scanning: function () { return !!scanState; },
        setV: function (v) { st.V = v; vS.set(v); changed(); }, countsAt: counts,
        state: function () { return { s: solve(), st: st, last: last, lastScan: lastScan, d: D_B, ds: D_S }; }
      };
    }

    return function destroy() { sim.destroy(); [gl, gc, gv].forEach(function (g) { g.destroy(); }); if (window.__lab_debroglie) delete window.__lab_debroglie; };
  }
})();
