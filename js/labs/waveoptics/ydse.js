/* Wave optics lab 1: Young's double slit. Two coherent slits, a screen, and the stripes they paint on it. */
(function () {
  "use strict";
  var VIEW = 10;                 // mm: the screen shows y from -VIEW to +VIEW
  var D_MIN = 0.5, D_MAX = 2;    // m

  var lab = {
    id: "ydse", chapter: "waveoptics", title: "Young's double slit", short: "fringes, path difference, β = λD/d",
    lede: "Shine one laser through two narrow slits and the screen fills with stripes. Drag the point $P$ along the screen to see the path difference behind each stripe, then slide a thin film over one slit and watch the whole pattern move.",
    tries: [
      { id: "order3", title: "Stand on the 3rd bright fringe",
        text: "Drag $P$ until the waves from the two slits differ by exactly three wavelengths.",
        why: "A bright fringe is wherever the path difference is a whole number of wavelengths, $\\Delta = n\\lambda$. The 3rd one sits at $y = 3\\beta$ from the centre, because each fringe adds one more $\\lambda$ of path." },
      { id: "width2", title: "Make the fringes exactly 2 mm wide",
        text: "Use $\\lambda$, $d$ and $D$ (sliders or drag the slits and the screen) to get $\\beta = 2.000$ mm.",
        why: "$\\beta = \\lambda D / d$: a longer wavelength or a farther screen spreads the fringes, wider slit spacing squeezes them. 500 nm, 2 m and 0.5 mm works; so does 600 nm, 1 m and 0.3 mm." },
      { id: "shift4", title: "Shift the pattern by exactly 4 fringes",
        text: "Put a film over $S_1$ so the central bright fringe moves up to where the 4th bright fringe used to be.",
        why: "The film adds $(\\mu - 1)t$ of extra optical path to the light from $S_1$, so the zero-path-difference point slides towards $S_1$ by $(\\mu-1)t/\\lambda$ fringes. With $\\mu = 1.5$ and 600 nm light you need $t = 4.8\\ \\mu$m." },
      { id: "ratio9", title: "Make $I_{max} : I_{min} = 9 : 1$",
        text: "Dim slit $S_2$ until the bright fringes are exactly nine times the dark ones.",
        why: "Amplitudes add, not intensities: $I_{max}/I_{min} = \\left(\\frac{\\sqrt{I_1}+\\sqrt{I_2}}{\\sqrt{I_1}-\\sqrt{I_2}}\\right)^2$. A ratio of 9 needs $\\sqrt{I_1}/\\sqrt{I_2} = 2$, so $I_2 = I_1/4$." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  // wavelength (nm) -> [r, g, b], a standard visible-spectrum approximation
  function wlRGB(nm) {
    var r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
    else r = 1;
    var f = nm < 420 ? 0.6 + 0.4 * (nm - 380) / 40 : nm > 680 ? 0.6 + 0.4 * (780 - nm) / 100 : 1;
    return [r, g, b].map(function (c) { return Math.round(255 * Math.pow(Math.max(0, c * f), 0.8)); });
  }
  function wlName(nm) {
    return nm < 450 ? "violet" : nm < 490 ? "blue" : nm < 560 ? "green" : nm < 590 ? "yellow" : nm < 625 ? "orange" : "red";
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, CY = 250, PXMM = 22;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });
    var LASER_X = 100, SLIT_X = 240, SLIT_PX = 120;     // slit spacing drawn at 120 px per mm (not to scale)

    /* ---------- controls ---------- */
    var lamS = K.slider({ label: "Wavelength $\\lambda$", unit: "nm", min: 400, max: 700, step: 10, value: 600, onInput: changed });
    var swatch = K.h('<div class="legend"><span><i></i><em></em></span></div>');
    var dS = K.slider({ label: "Slit separation $d$", unit: "mm", min: 0.2, max: 1, step: 0.05, value: 0.5, digits: 2, onInput: changed,
      hint: "Or drag a slit up and down on the stage." });
    var DS = K.slider({ label: "Screen distance $D$", unit: "m", min: D_MIN, max: D_MAX, step: 0.1, value: 1, onInput: changed,
      hint: "Or drag the handle on top of the screen." });
    var tS = K.slider({ label: "Film thickness $t$ (over $S_1$)", unit: "μm", min: 0, max: 20, step: 0.05, value: 0, digits: 2, onInput: changed,
      hint: "0 means no film." });
    var muS = K.slider({ label: "Film refractive index $\\mu$", min: 1, max: 2, step: 0.05, value: 1.5, digits: 2, onInput: changed });
    var rS = K.slider({ label: "Slit $S_2$ brightness $I_2 / I_1$", min: 0, max: 1, step: 0.05, value: 1, digits: 2, onInput: changed,
      hint: "Below 1, the dark fringes stop being dark." });
    var show = { waves: true, paths: true };
    P.controls.innerHTML = "<h3>Light</h3>";
    P.controls.appendChild(lamS.el); P.controls.appendChild(swatch);
    P.controls.appendChild(K.h("<h3>Geometry</h3>"));
    [dS, DS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Film and slit brightness</h3>"));
    [tS, muS, rS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Wavefronts", true, function (v) { show.waves = v; }));
    row.appendChild(K.check("Paths to P", true, function (v) { show.paths = v; }));
    P.controls.appendChild(row);
    var presets = K.h('<div class="row"></div>');
    [
      { label: "Classic", lam: 600, d: 0.5, D: 1, t: 0, mu: 1.5, r: 1 },
      { label: "Add a film", lam: 600, d: 0.5, D: 1, t: 6, mu: 1.5, r: 1 },
      { label: "Dim one slit", lam: 600, d: 0.5, D: 1, t: 0, mu: 1.5, r: 0.25 },
      { label: "Blue, far screen", lam: 450, d: 0.3, D: 2, t: 0, mu: 1.5, r: 1 }
    ].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p.label + "</button>");
      b.addEventListener("click", function () { apply(p); });
      presets.appendChild(b);
    });
    P.controls.appendChild(K.h("<h3>Presets</h3>"));
    P.controls.appendChild(presets);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>path from S₁</span><span class="c-acc"><i></i>path from S₂</span>' +
      '<span class="c-grav"><i></i>film</span></div>'));

    function params() { return { lam: lamS.get(), d: dS.get(), D: DS.get(), t: tS.get(), mu: muS.get(), r: rS.get() }; }
    var yP = 1.8;                  // mm: the point P on the screen

    /* ---------- the physics ---------- */
    // Exact geometry: S1 at +d/2 (top), S2 at -d/2, P at (D, y). r2 - r1 = (r2² - r1²)/(r1 + r2) = 2yd/(r1 + r2),
    // which stays accurate even though both paths are about a metre long. The film adds (μ-1)t to S1's path.
    function film(p) { return (p.mu - 1) * p.t * 1e-6; }
    function delta(p, y) {
      var d = p.d * 1e-3, Y = y * 1e-3, r1 = Math.hypot(p.D, Y - d / 2), r2 = Math.hypot(p.D, Y + d / 2);
      return 2 * Y * d / (r1 + r2) - film(p);
    }
    function intensity(p, y) {            // in units of I0 = I1
      var phi = 2 * Math.PI * delta(p, y) / (p.lam * 1e-9);
      return 1 + p.r + 2 * Math.sqrt(p.r) * Math.cos(phi);
    }
    function formulaI(p, y) {             // textbook small-angle version
      var phi = 2 * Math.PI * (y * p.d / p.D * 1e-6 - film(p)) / (p.lam * 1e-9);
      return 1 + p.r + 2 * Math.sqrt(p.r) * Math.cos(phi);
    }
    // where on the screen the path difference is exactly mλ (Δ grows steadily with y, so bisect)
    function brightAt(p, m) {
      var target = m * p.lam * 1e-9, lo = -400, hi = 400;
      for (var i = 0; i < 70; i++) { var mid = (lo + hi) / 2; if (delta(p, mid) < target) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    }
    function measureBeta(p) {
      var m0 = Math.round(-film(p) / (p.lam * 1e-9));     // the order that lands nearest y = 0
      return brightAt(p, m0 + 1) - brightAt(p, m0);
    }
    function compute() {
      var p = params(), lam = p.lam * 1e-9, s = Math.sqrt(p.r);
      var S = { p: p };
      S.beta = measureBeta(p);
      S.betaF = lam * p.D / (p.d * 1e-3) * 1e3;
      S.y0 = brightAt(p, 0);
      S.y0F = film(p) * p.D / (p.d * 1e-3) * 1e3;
      S.shiftN = film(p) / lam;
      S.dP = delta(p, yP);
      S.nP = S.dP / lam;
      S.IP = intensity(p, yP);
      S.IPF = formulaI(p, yP);
      S.Imax = (1 + s) * (1 + s); S.Imin = (1 - s) * (1 - s);
      S.ratio = S.Imin > 1e-12 ? S.Imax / S.Imin : Infinity;
      S.V = (S.Imax - S.Imin) / (S.Imax + S.Imin);
      return S;
    }

    /* ---------- the stage ---------- */
    function screenX(D) { return 440 + (D - D_MIN) / (D_MAX - D_MIN) * 380; }
    function yPx(ymm) { return CY - ymm * PXMM; }
    var pattern = [], S = null;        // cached screen brightness, one value per pixel row
    function buildPattern() {
      var p = params();
      pattern = [];
      for (var row = CY - VIEW * PXMM; row <= CY + VIEW * PXMM; row++) pattern.push(intensity(p, (CY - row) / PXMM));
    }
    function colour(a) { var c = wlRGB(lamS.get()); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
    // strokes in the wavelength colour, darkened on a light canvas so yellow stays visible
    function inkColour(a) {
      var c = wlRGB(lamS.get()), bg = th["canvas-bg"] || "#fff", light = /^#?[ef]/i.test(bg.replace("#", ""));
      if (light) c = c.map(function (v) { return Math.round(v * 0.62); });
      return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
    }

    sim.on("under", function (ctx) {
      var p = params(), sx = screenX(p.D), half = p.d * SLIT_PX / 2, lamPx = 14 + (p.lam - 400) / 300 * 16;
      var phase = sim.time % 1;        // the wave moves one wavelength per (slowed-down) second
      // laser
      ctx.fillStyle = th.body; ctx.fillRect(LASER_X - 70, CY - 18, 70, 36);
      ctx.fillStyle = colour(1); ctx.fillRect(LASER_X - 6, CY - 6, 6, 12);
      K.label(ctx, "laser", LASER_X - 35, CY - 22, th.muted);
      // plane wavefronts arriving at the slits
      if (show.waves) {
        ctx.strokeStyle = inkColour(0.55); ctx.lineWidth = 2;
        for (var n = 0; n < 20; n++) {
          var x = SLIT_X + (phase - n) * lamPx;
          if (x < LASER_X) break;
          if (x > SLIT_X) continue;
          ctx.beginPath(); ctx.moveTo(x, CY - half - 30); ctx.lineTo(x, CY + half + 30); ctx.stroke();
        }
        // circular wavelets from each slit; S1's start late by the film's extra optical path
        var lag = film(p) / (p.lam * 1e-9);
        ctx.save();
        ctx.beginPath(); ctx.rect(SLIT_X, 0, sx - SLIT_X, H); ctx.clip();
        [[CY - half, lag], [CY + half, 0]].forEach(function (s, i) {
          var off = ((phase - s[1]) % 1 + 1) % 1, rMax = Math.hypot(sx - SLIT_X, H);
          ctx.lineWidth = 1.6;
          for (var k = 0; (k + off) * lamPx < rMax; k++) {
            var r = (k + off) * lamPx, a = Math.max(0, 0.5 * (1 - r / rMax));
            if (i === 1) a *= Math.sqrt(p.r);
            ctx.strokeStyle = inkColour(a);
            ctx.beginPath(); ctx.arc(SLIT_X, s[0], r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
          }
        });
        ctx.restore();
      }
      // barrier with two slits
      ctx.fillStyle = th.body;
      var gap = 5;
      ctx.fillRect(SLIT_X - 4, 20, 8, CY - half - gap - 20);
      ctx.fillRect(SLIT_X - 4, CY - half + gap, 8, 2 * half - 2 * gap);
      ctx.fillRect(SLIT_X - 4, CY + half + gap, 8, H - 40 - (CY + half + gap));
      if (p.t > 0) {
        ctx.fillStyle = K.alpha(th.grav, 0.55);
        var fw = 4 + p.t * 0.6;
        ctx.fillRect(SLIT_X + 5, CY - half - 9, fw, 18);
        K.label(ctx, "film", SLIT_X + 8 + fw, CY - half - 10, th.grav, { align: "left", font: "700 11px 'JetBrains Mono', monospace" });
      }
      K.label(ctx, "S₁", SLIT_X - 12, CY - half + 6, th.ink, { align: "right" });
      K.label(ctx, "S₂", SLIT_X - 12, CY + half + 6, th.ink, { align: "right" });
      // d dimension
      ctx.strokeStyle = th.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(SLIT_X - 34, CY - half); ctx.lineTo(SLIT_X - 34, CY + half); ctx.stroke();
      K.label(ctx, "d", SLIT_X - 44, CY + 6, th.muted);
      // screen and its time-averaged pattern
      var top = yPx(VIEW), Imax = Math.max(1e-9, (1 + Math.sqrt(p.r)) * (1 + Math.sqrt(p.r)));
      ctx.fillStyle = "#0b0d12"; ctx.fillRect(sx - 7, top, 14, 2 * VIEW * PXMM);
      pattern.forEach(function (I, i) { ctx.fillStyle = colour(K.clamp(I / Imax, 0, 1)); ctx.fillRect(sx - 6, top + i, 12, 1); });
      ctx.fillStyle = th.muted; ctx.fillRect(sx - 7, top - 22, 14, 14);
      K.label(ctx, "⇔ drag", sx, top - 24, th.muted, { font: "600 10px 'JetBrains Mono', monospace" });
      // intensity curve beside the screen
      var gx0 = sx + 14, gw = 110;
      ctx.strokeStyle = th.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx0, top); ctx.lineTo(gx0, top + 2 * VIEW * PXMM); ctx.stroke();
      ctx.strokeStyle = inkColour(0.95); ctx.lineWidth = 2;
      ctx.beginPath();
      pattern.forEach(function (I, i) { var x = gx0 + I / 4 * gw; if (i) ctx.lineTo(x, top + i); else ctx.moveTo(x, top + i); });
      ctx.stroke();
      K.label(ctx, "I", gx0 + gw, top - 4, th.muted);
      // mm marks on the screen
      ctx.fillStyle = th.muted; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var mm = -VIEW; mm <= VIEW; mm += 5) { ctx.fillRect(sx - 12, yPx(mm), 5, 1); ctx.fillText(mm + "", sx - 14, yPx(mm)); }
      // D dimension
      var dy = H - 22;
      K.arrow(ctx, (SLIT_X + sx) / 2, dy, SLIT_X + 2, dy, th.muted, { width: 1.2, head: 7 });
      K.arrow(ctx, (SLIT_X + sx) / 2, dy, sx - 2, dy, th.muted, { width: 1.2, head: 7 });
      K.label(ctx, "D = " + K.fmt(p.D, 1) + " m", (SLIT_X + sx) / 2, dy - 4, th.muted, { bg: true });
      K.label(ctx, "schematic: d ≪ D, slit gap drawn ×" + Math.round(SLIT_PX / PXMM) + " for clarity · screen in mm", 12, H - 2, th.muted,
        { align: "left", font: "600 10px 'JetBrains Mono', monospace" });
    });

    sim.on("over", function (ctx) {
      var p = params(), sx = screenX(p.D), half = p.d * SLIT_PX / 2, py = yPx(yP);
      if (!S) return;
      // central bright fringe marker
      if (Math.abs(S.y0) <= VIEW) {
        ctx.fillStyle = th.ink;
        ctx.beginPath(); ctx.moveTo(sx - 18, yPx(S.y0)); ctx.lineTo(sx - 26, yPx(S.y0) - 5); ctx.lineTo(sx - 26, yPx(S.y0) + 5); ctx.fill();
      }
      if (show.paths) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = th.disp; ctx.beginPath(); ctx.moveTo(SLIT_X, CY - half); ctx.lineTo(sx, py); ctx.stroke();
        ctx.strokeStyle = th.acc; ctx.beginPath(); ctx.moveTo(SLIT_X, CY + half); ctx.lineTo(sx, py); ctx.stroke();
        // the foot of the perpendicular from S1 onto S2P: the leftover bit is d sinθ
        var ux = sx - SLIT_X, uy = py - (CY + half), L = Math.hypot(ux, uy); ux /= L; uy /= L;
        var proj = (0) * ux + (-2 * half) * uy, fx = SLIT_X + ux * proj, fy = CY + half + uy * proj;
        ctx.strokeStyle = th.muted; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(SLIT_X, CY - half); ctx.lineTo(fx, fy); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = th.acc; ctx.lineWidth = 5; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(SLIT_X, CY + half); ctx.lineTo(fx, fy); ctx.stroke(); ctx.globalAlpha = 1;
        K.label(ctx, "d sinθ", (SLIT_X + fx) / 2 + 6, (CY + half + fy) / 2 + 18, th.acc, { align: "left", font: "700 11px 'JetBrains Mono', monospace" });
      }
      // P itself
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(sx, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.surface; ctx.beginPath(); ctx.arc(sx, py, 2.5, 0, Math.PI * 2); ctx.fill();
      var kind = brightness(S);
      K.label(ctx, "P: Δ = " + K.fmt(S.nP, 2) + " λ, " + kind, sx - 16, py - 8, th.ink, { align: "right", bg: true });
    });
    function brightness(S) {
      var f = S.nP - Math.round(S.nP);
      return Math.abs(f) < 0.05 ? "bright" : Math.abs(Math.abs(f) - 0.5) < 0.05 ? "dark" : "in between";
    }

    /* ---------- direct manipulation: P, the screen, the slits ---------- */
    var dragging = null;
    sim.pointer({
      down: function (pt) {
        var p = params(), sx = screenX(p.D), top = yPx(VIEW);
        if (Math.abs(pt.px - sx) < 26 && pt.py < top - 4 && pt.py > top - 40) dragging = "screen";
        else if (Math.abs(pt.px - sx) < 40 && pt.py >= top - 4 && pt.py <= yPx(-VIEW) + 4) dragging = "P";
        else if (Math.abs(pt.px - SLIT_X) < 22) dragging = "slit";
        else return false;
        move(pt);
        return true;
      },
      drag: function (pt) { move(pt); },
      up: function () { dragging = null; },
      hover: function (pt) {
        var p = params(), sx = screenX(p.D);
        P.canvas.style.cursor = Math.abs(pt.px - sx) < 40 || Math.abs(pt.px - SLIT_X) < 22 ? "grab" : "";
      }
    });
    function move(pt) {
      if (dragging === "P") { yP = Math.round(K.clamp((CY - pt.py) / PXMM, -VIEW, VIEW) * 100) / 100; refresh(); }
      else if (dragging === "screen") {
        var D = D_MIN + (pt.px - 440) / 380 * (D_MAX - D_MIN);
        DS.set(K.clamp(Math.round(D * 10) / 10, D_MIN, D_MAX)); changed();
      } else if (dragging === "slit") {
        var d = 2 * Math.abs(pt.py - CY) / SLIT_PX;
        dS.set(K.clamp(Math.round(d * 20) / 20, 0.2, 1)); changed();
      }
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">I across the screen</b> · exact geometry (solid) vs $I_1 + I_2 + 2\\sqrt{I_1I_2}\\cos\\phi$ (dashed); ▼ marks P</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">fringe width β vs d</b> · measured off the pattern (solid) vs $\\lambda D/d$ (dashed); dot = your d</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">the two waves arriving at P</b> · faint = each slit, bold = their sum, dashed = $\\pm\\sqrt{I}$ (press Play)</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gI = new K.Graph(cv[0], { yLabel: "I / I₀", xLabel: "y (mm)", xMax: 2 * VIEW, yMin: 0, yMax: 4, color: th.disp });
    var gB = new K.Graph(cv[1], { yLabel: "β (mm)", xLabel: "d (mm)", xMax: 1, yMin: 0, color: th.disp });
    var gE = new K.Graph(cv[2], { yLabel: "E at P", xLabel: "t (s, slowed)", xMax: 3, yMin: -2.2, yMax: 2.2, color: th.acc });
    // the I–y graph runs from -VIEW to +VIEW, but K.Graph's axis starts at 0: relabel it, and mark P
    gI.extra = function (ctx, X, Y) {
      ctx.clearRect(0, gI.h - 26 + 3, gI.w, 26);
      ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.fillStyle = th.muted; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var v = -VIEW; v <= VIEW; v += 5) ctx.fillText(String(v), X(v + VIEW), gI.h - 26 + 5);
      ctx.fillStyle = th.ink;
      var x = X(yP + VIEW);
      ctx.beginPath(); ctx.moveTo(x, Y(4.25)); ctx.lineTo(x - 5, Y(4.25) - 8); ctx.lineTo(x + 5, Y(4.25) - 8); ctx.fill();
    };

    function updateGraphs() {
      var p = params(), sim1 = [], f1 = [];
      for (var i = 0; i <= 400; i++) {
        var y = -VIEW + 2 * VIEW * i / 400;
        sim1.push([y + VIEW, intensity(p, y)]); f1.push([y + VIEW, formulaI(p, y)]);
      }
      gI.set("sim", { points: sim1, color: th.disp, width: 2.5 });
      gI.set("theory", { points: f1, color: th.ink, dash: [5, 5], width: 1.5 });
      var bs = [], bf = [];
      for (var d = 0.2; d <= 1.0001; d += 0.05) {
        var q = { lam: p.lam, d: d, D: p.D, t: p.t, mu: p.mu, r: p.r };
        bs.push([d, measureBeta(q)]); bf.push([d, p.lam * 1e-9 * p.D / (d * 1e-3) * 1e3]);
      }
      gB.set("sim", { points: bs, color: th.disp, width: 2.5 });
      gB.set("theory", { points: bf, color: th.ink, dash: [5, 5], width: 1.5 });
      gB.set("now", { points: [[p.d, S.beta]], color: th.acc, width: 0, dot: true });
      [gI, gB].forEach(function (g) { g.dirty = true; g.draw(); });
      updateField();
    }
    // instantaneous fields at P (one cycle per slowed-down second): E1 = √I1 cos ωt, E2 = √I2 cos(ωt - φ)
    function updateField() {
      var p = params(), phi = 2 * Math.PI * S.nP, w = 2 * Math.PI, e1 = [], e2 = [], es = [], up = [], dn = [], A = Math.sqrt(Math.max(0, S.IP));
      for (var i = 0; i <= 150; i++) {
        var tau = 3 * i / 150, t = tau + sim.time;
        var a = Math.cos(w * t), b = Math.sqrt(p.r) * Math.cos(w * t - phi);
        e1.push([tau, a]); e2.push([tau, b]); es.push([tau, a + b]); up.push([tau, A]); dn.push([tau, -A]);
      }
      gE.set("e1", { points: e1, color: K.alpha(th.disp, 0.45), width: 1.5 });
      gE.set("e2", { points: e2, color: K.alpha(th.acc, 0.45), width: 1.5 });
      gE.set("sum", { points: es, color: th.acc, width: 2.5 });
      gE.set("up", { points: up, color: th.ink, dash: [5, 5], width: 1.2 });
      gE.set("dn", { points: dn, color: th.ink, dash: [5, 5], width: 1.2 });
      gE.dirty = true; gE.draw();
    }
    sim.on("step", function () { updateField(); });

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Path difference at P", "Intensity at P", "Fringe width", "Film shift and contrast"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "beta", label: "fringe width β", cls: "c-disp" }, { id: "y0", label: "central bright fringe y₀", cls: "c-disp" },
      { id: "shift", label: "fringes shifted by the film", cls: "c-grav" }, { id: "dP", label: "path difference at P", cls: "c-acc" },
      { id: "IP", label: "intensity at P" }, { id: "ratio", label: "I_max : I_min" }
    ]);
    function n(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function renderMaths() {
      var p = params(), filmUm = (p.mu - 1) * p.t;
      K.tex(eqEls[0], "\\Delta = \\frac{yd}{D} - (\\mu-1)t = \\frac{" + n(yP, 2) + "\\text{ mm}\\times" + K.fmt(p.d, 2) + "\\text{ mm}}{" + K.fmt(p.D, 1) + "\\text{ m}} - (" +
        K.fmt(p.mu - 1, 2) + ")(" + K.fmt(p.t, 2) + "\\ \\mu\\text{m}) = \\mathbf{" + K.fmt(S.dP * 1e6, 3) + "}\\ \\mu\\text{m} = \\mathbf{" + K.fmt(S.nP, 2) + "}\\,\\lambda");
      var Itex = p.r === 1
        ? "I = 4I_0\\cos^2\\tfrac{\\phi}{2} = 4\\cos^2(" + K.fmt(S.nP * 180, 1) + "^\\circ)\\,I_0 = \\mathbf{" + K.fmt(S.IPF, 2) + "}\\,I_0"
        : "I = I_1 + I_2 + 2\\sqrt{I_1I_2}\\cos\\phi = \\left(1 + " + K.fmt(p.r, 2) + " + 2\\sqrt{" + K.fmt(p.r, 2) + "}\\cos(" + K.fmt(S.nP * 360, 1) + "^\\circ)\\right)I_0 = \\mathbf{" + K.fmt(S.IPF, 2) + "}\\,I_0";
      K.tex(eqEls[1], "\\phi = \\frac{2\\pi\\Delta}{\\lambda},\\quad " + Itex);
      K.tex(eqEls[2], "\\beta = \\frac{\\lambda D}{d} = \\frac{(" + p.lam + "\\times10^{-9})(" + K.fmt(p.D, 1) + ")}{" + K.fmt(p.d, 2) + "\\times10^{-3}}\\text{ m} = \\mathbf{" + K.fmt(S.betaF, 3) + "}\\ \\text{mm}");
      var c = p.r === 1 ? "I_{min} = 0" : p.r === 0 ? "\\text{one slit: no fringes}"
        : "\\frac{I_{max}}{I_{min}} = \\left(\\frac{1 + " + K.fmt(Math.sqrt(p.r), 3) + "}{1 - " + K.fmt(Math.sqrt(p.r), 3) + "}\\right)^2 = \\mathbf{" + K.fmt(S.ratio, 2) + "}";
      K.tex(eqEls[3], "y_0 = \\frac{(\\mu-1)tD}{d} = \\frac{" + K.fmt(filmUm, 3) + "\\ \\mu\\text{m}\\times" + K.fmt(p.D, 1) + "}{" + K.fmt(p.d, 2) + "\\text{ mm}} = \\mathbf{" + K.fmt(S.y0F, 2) + "}\\text{ mm}\\qquad " + c);
      setR("beta", K.fmt(S.beta, 3) + " mm", "formula λD/d = " + K.fmt(S.betaF, 3) + " mm");
      setR("y0", K.fmt(S.y0, 2) + " mm" + (Math.abs(S.y0) > VIEW ? " (off screen)" : ""), "formula (μ−1)tD/d = " + K.fmt(S.y0F, 2) + " mm");
      setR("shift", K.fmt(S.shiftN, 2), "(μ−1)t / λ, towards S₁");
      setR("dP", K.fmt(S.dP * 1e6, 3) + " μm", "= " + K.fmt(S.nP, 2) + " λ: " + brightness(S));
      setR("IP", K.fmt(S.IP, 2) + " I₀", "= " + K.fmt(S.IP / S.Imax, 3) + " of I_max");
      setR("ratio", isFinite(S.ratio) ? K.fmt(S.ratio, 2) + " : 1" : "∞ (I_min = 0)", "visibility " + K.fmt(S.V, 2));
    }

    function swatchUpdate() {
      var nm = lamS.get(), c = wlRGB(nm);
      swatch.querySelector("span").style.color = "rgb(" + c.join(",") + ")";
      swatch.querySelector("em").textContent = nm + " nm looks " + wlName(nm);
    }
    function refresh() { S = compute(); renderMaths(); gI.dirty = true; gI.draw(); updateField(); checkTries(); }
    function changed() { S = compute(); buildPattern(); swatchUpdate(); renderMaths(); updateGraphs(); checkTries(); }

    function checkTries() {
      var p = params();
      if (Math.abs(Math.abs(S.nP) - 3) < 0.05) tries.mark("order3");
      if (Math.abs(S.beta - 2) < 0.0005) tries.mark("width2");
      if (p.t > 0 && Math.abs(S.shiftN - 4) < 0.02) tries.mark("shift4");
      if (p.r > 0 && Math.abs(S.ratio - 9) < 0.05) tries.mark("ratio9");
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>Each slit sends out its own wave, and both started from the same laser, so they stay <b>in step</b> (coherent). At a point $P$ on the screen they meet after travelling different distances. " +
      "If the difference $\\Delta$ is a whole number of wavelengths, crest meets crest: <b>bright</b>. If it's a half-odd number, crest meets trough: <b>dark</b>.</p>" +
      "<p>For a small angle, $\\Delta = d\\sin\\theta \\approx yd/D$, so the bright fringes sit at $y = n\\lambda D/d$, evenly spaced by $\\beta = \\lambda D/d$. " +
      "With equal slits, $I = 4I_0\\cos^2(\\phi/2)$ with $\\phi = 2\\pi\\Delta/\\lambda$: four times one slit at the bright fringes, nothing at the dark ones. Energy isn't lost, just moved.</p>" +
      "<p>A film of index $\\mu$ and thickness $t$ slows the light from one slit, adding $(\\mu-1)t$ of optical path. The whole pattern slides towards that slit by $(\\mu-1)tD/d$. If one slit is dimmer, the amplitudes no longer cancel and the dark fringes glow.</p>" +
      '<div class="trap"><b>JEE trap: the film moves the fringes, it doesn\'t resize them.</b> $\\beta = \\lambda D/d$ has no $t$ or $\\mu$ in it. The pattern shifts <i>towards</i> the covered slit (its light is delayed, so the other path must be longer to match), and the number of fringes shifted is $(\\mu-1)t/\\lambda$.</div>');

    function apply(s) {
      lamS.set(s.lam); dS.set(s.d); DS.set(s.D); tS.set(s.t || 0); muS.set(s.mu || 1.5); rS.set(s.r === undefined ? 1 : s.r);
      if (s.y !== undefined) yP = s.y;
      P.resetBtn.click();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "fringe width", setup: { lam: 500, d: 0.4, D: 1.2, t: 0, r: 1, y: 1.5 }, watch: "Predict β, then read it off the screen and the readouts",
        q: "In Young's experiment the slits are 0.4 mm apart, the screen is 1.2 m away and the light has $\\lambda = 500$ nm. What is the fringe width?",
        options: ["0.15 mm", "0.75 mm", "1.5 mm", "3.0 mm"], answer: 2,
        explain: "$\\beta = \\lambda D/d = (500\\times10^{-9})(1.2)/(0.4\\times10^{-3}) = 1.5\\times10^{-3}$ m $= 1.5$ mm. P is parked on the first bright fringe at $y = 1.5$ mm, where $\\Delta = 1.00\\lambda$." },
      { level: "medium", tag: "thin film shift", setup: { lam: 600, d: 0.5, D: 1, t: 6, mu: 1.5, r: 1, y: 6 }, watch: "Watch the ▶ marker for the central fringe land on P",
        q: "A thin glass sheet ($\\mu = 1.5$) over one slit moves the central bright fringe to where the 5th bright fringe used to be ($\\lambda = 600$ nm). How thick is the sheet?",
        options: ["2 μm", "3 μm", "6 μm", "12 μm"], answer: 2,
        hints: ["The sheet adds an optical path of $(\\mu - 1)t$, not $\\mu t$: it replaces a thickness $t$ of air.", "Shifting by 5 fringes means that extra path equals $5\\lambda$."],
        explain: "$(\\mu - 1)t = 5\\lambda$, so $t = 5(600\\text{ nm})/0.5 = 6\\ \\mu$m. In the lab the central fringe lands at $y_0 = (\\mu-1)tD/d = 6.00$ mm $= 5\\beta$. Using $\\mu t = 5\\lambda$ gives the wrong 2 μm." },
      { level: "hard", tag: "unequal slits + film", setup: { lam: 500, d: 0.5, D: 1, t: 1.25, mu: 1.5, r: 0.25, y: 0 }, watch: "P sits at O, opposite the midpoint of the slits. Read I at P as a fraction of I_max",
        q: "In a YDSE with $\\lambda = 500$ nm, slit $S_2$ passes only a quarter of the intensity of $S_1$. A film with $\\mu = 1.5$ and $t = 1.25\\ \\mu$m covers $S_1$. What is the intensity at $O$, the point opposite the midpoint of the slits, as a fraction of the maximum intensity in the pattern?",
        options: ["$\\tfrac{1}{9}$", "$\\tfrac{1}{2}$", "$\\tfrac{5}{9}$", "$\\tfrac{2}{3}$"], answer: 2,
        hints: ["At $O$ the geometric paths are equal, so the only path difference is the film's $(\\mu-1)t$. How many wavelengths is that?", "Use $I = I_1 + I_2 + 2\\sqrt{I_1I_2}\\cos\\phi$ and $I_{max} = (\\sqrt{I_1}+\\sqrt{I_2})^2$, with $I_2 = I_1/4$."],
        explain: "$(\\mu-1)t = 0.625\\ \\mu$m $= 1.25\\lambda$, so $\\phi = 2.5\\pi$ and $\\cos\\phi = 0$. Then $I = I_1 + I_1/4 = 1.25I_1$, while $I_{max} = (1 + \\tfrac12)^2 I_1 = 2.25I_1$. The ratio is $1.25/2.25 = 5/9 \\approx 0.556$. Treating the slits as equal ($4I_0\\cos^2$) gives the trap answer $\\tfrac12$." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = K.transport(P, sim, {
      playLabel: "Play waves",
      onReset: function () { sim.resetClock(); P.time.textContent = "t = 0.00 s"; changed(); }
    });
    void transportUI;
    changed();

    if (location.hostname === "localhost") {
      window.__lab_ydse = {
        apply: apply, sim: sim, params: params,
        state: function () { return compute(); },
        intensity: function (y) { return intensity(params(), y); },
        formulaI: function (y) { return formulaI(params(), y); },
        P: function () { return yP; },
        geom: function () { var p = params(); return { sx: screenX(p.D), cy: CY, pxmm: PXMM, slitX: SLIT_X, W: W }; }
      };
    }

    return function destroy() {
      sim.destroy(); [gI, gB, gE].forEach(function (g) { g.destroy(); });
      if (window.__lab_ydse) delete window.__lab_ydse;
    };
  }
})();
