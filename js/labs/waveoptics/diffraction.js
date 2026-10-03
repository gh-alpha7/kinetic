/* Wave optics lab 2: single-slit diffraction, polarisers (Malus's law) and Brewster's angle. */
(function () {
  "use strict";
  var VIEW = 25;                   // mm: the screen shows y from -VIEW to +VIEW
  var N = 200;                     // Huygens strips across the slit
  var D_MIN = 0.5, D_MAX = 2;

  var lab = {
    id: "diffraction", chapter: "waveoptics", title: "Diffraction & polarisation", short: "single slit, Malus, Brewster",
    lede: "Squeeze light through one narrow slit and it spreads out, with dark bands where the slit's own wavelets cancel. Then switch to polarisers and make light appear by adding a filter, and find the angle where glass reflects only one polarisation.",
    tries: [
      { id: "dark2", title: "Stand on the 2nd dark band",
        text: "In <b>Single slit</b>, drag $P$ until the two edges of the slit differ in path by exactly $2\\lambda$.",
        why: "Split the slit into four strips: each pair of neighbours differs by $\\lambda/2$ and cancels. The phasor chain curls round twice and closes, so the resultant is zero. Minima sit at $a\\sin\\theta = n\\lambda$." },
      { id: "width10", title: "Make the central maximum exactly 1 cm wide",
        text: "Choose $\\lambda$, $a$ and $D$ so the bright band between the two first minima is 10.00 mm.",
        why: "The central maximum runs from $-\\lambda D/a$ to $+\\lambda D/a$, so its width is $2\\lambda D/a$: twice every other band. 500 nm with $a = 0.1$ mm at 1 m does it." },
      { id: "surprise", title: "Get light through crossed polarisers",
        text: "In <b>Polarisers</b>, cross the first and last ($90°$ apart) so nothing gets through, then switch on the middle one and get at least $I_0/8$ out.",
        why: "Each polariser passes only the component along its axis. With a middle one at $45°$, light loses half at the first, then $\\cos^2 45°$ twice: $I_0/2 \\times \\tfrac12 \\times \\tfrac12 = I_0/8$. Adding a filter let light through." },
      { id: "brewster", title: "Find Brewster's angle",
        text: "In <b>Brewster</b>, set the angle of incidence where the reflected light has no in-plane (p) part at all.",
        why: "At $\\tan\\theta_B = n$ the reflected and refracted rays are at $90°$. The p-wave would have to be re-radiated along its own direction of oscillation, which dipoles can't do, so it isn't reflected at all." }
    ],
    mount: mount
  };
  K.registerLab(lab);

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
  function mod180(a) { return ((a % 180) + 180) % 180; }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, CY = 240, PXMM = 8.4;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 100, origin: { x: 0, y: H }, g: 0, grid: false });
    var LASER_X = 100, SLIT_X = 300, SLIT_PX = 300;       // slit width drawn at 300 px per mm (not to scale)
    var POL_X = [330, 530, 730], POL_RX = 36, POL_RY = 100, DET_X = 900;
    var O = { x: 500, y: 280 }, RAY = 230;
    var mode = "slit";

    /* ---------- controls ---------- */
    var modeSeg = K.seg([{ label: "Single slit", value: "slit" }, { label: "Polarisers", value: "polar" }, { label: "Brewster", value: "brewster" }], "slit",
      function (v) { setMode(v); }, "Mode");
    var lamS = K.slider({ label: "Wavelength $\\lambda$", unit: "nm", min: 400, max: 700, step: 10, value: 600, onInput: changed });
    var swatch = K.h('<div class="legend"><span><i></i><em></em></span></div>');
    var aS = K.slider({ label: "Slit width $a$", unit: "mm", min: 0.05, max: 0.5, step: 0.01, value: 0.15, digits: 2, onInput: changed,
      hint: "Or drag a slit edge on the stage." });
    var DS = K.slider({ label: "Screen distance $D$", unit: "m", min: D_MIN, max: D_MAX, step: 0.1, value: 1, onInput: changed,
      hint: "Or drag the handle on top of the screen." });
    var thA = K.slider({ label: "Polariser A axis $\\theta_A$", unit: "°", min: 0, max: 180, step: 1, value: 0, onInput: changed });
    var thB = K.slider({ label: "Polariser B axis $\\theta_B$", unit: "°", min: 0, max: 180, step: 1, value: 45, onInput: changed });
    var thC = K.slider({ label: "Polariser C axis $\\theta_C$", unit: "°", min: 0, max: 180, step: 1, value: 60, onInput: changed,
      hint: "Angles from the vertical. Or drag a polariser to turn it." });
    var on = { B: false, C: true };
    var nS = K.slider({ label: "Refractive index $n$", min: 1.2, max: 2.4, step: 0.01, value: 1.5, digits: 2, onInput: changed });
    var iS = K.slider({ label: "Angle of incidence $i$", unit: "°", min: 0, max: 89.5, step: 0.5, value: 40, digits: 1, onInput: changed,
      hint: "Or drag the incoming ray." });

    P.controls.innerHTML = "<h3>Mode</h3>";
    P.controls.appendChild(modeSeg);
    var gSlit = K.h("<div></div>"), gPol = K.h("<div></div>"), gBr = K.h("<div></div>");
    gSlit.appendChild(K.h("<h3>Light and slit</h3>"));
    [lamS.el, swatch, aS.el, DS.el].forEach(function (e) { gSlit.appendChild(e); });
    var slitPresets = K.h('<div class="row"></div>');
    [{ label: "Narrow slit", lam: 600, a: 0.08, D: 1 }, { label: "Wide slit", lam: 600, a: 0.4, D: 1 }, { label: "Blue vs red", lam: 420, a: 0.15, D: 1 }].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p.label + "</button>");
      b.addEventListener("click", function () { apply({ mode: "slit", lam: p.lam, a: p.a, D: p.D }); });
      slitPresets.appendChild(b);
    });
    gSlit.appendChild(K.h("<h3>Presets</h3>")); gSlit.appendChild(slitPresets);
    gSlit.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>ray from the top edge</span><span class="c-acc"><i></i>ray from the bottom edge</span></div>'));

    gPol.appendChild(K.h("<h3>Polariser angles</h3>"));
    [thA, thB, thC].forEach(function (s) { gPol.appendChild(s.el); });
    var pRow = K.h('<div class="row"></div>');
    var chkB = K.check("Middle polariser B", false, function (v) { on.B = v; changed(); });
    var chkC = K.check("Last polariser C", true, function (v) { on.C = v; changed(); });
    pRow.appendChild(chkB); pRow.appendChild(chkC);
    gPol.appendChild(pRow);
    var polPresets = K.h('<div class="row"></div>');
    [{ label: "Crossed", thA: 0, thB: 45, thC: 90, B: false, C: true }, { label: "Three-polariser surprise", thA: 0, thB: 45, thC: 90, B: true, C: true },
      { label: "Malus at 60°", thA: 0, thB: 45, thC: 60, B: false, C: true }].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p.label + "</button>");
      b.addEventListener("click", function () { apply({ mode: "polar", thA: p.thA, thB: p.thB, thC: p.thC, B: p.B, C: p.C }); });
      polPresets.appendChild(b);
    });
    gPol.appendChild(K.h("<h3>Presets</h3>")); gPol.appendChild(polPresets);
    gPol.appendChild(K.h('<div class="legend"><span class="c-ten"><i></i>light (E field)</span><span class="c-grav"><i></i>transmission axis</span></div>'));

    gBr.appendChild(K.h("<h3>Surface and ray</h3>"));
    [nS, iS].forEach(function (s) { gBr.appendChild(s.el); });
    var brRow = K.h('<div class="row"></div>');
    var bB = K.h('<button class="btn btn-sm" type="button">Jump to tan θ = n</button>');
    bB.addEventListener("click", function () { iS.set(Math.round(Math.atan(nS.get()) / K.DEG * 2) / 2); changed(); });
    brRow.appendChild(bB);
    [{ label: "Water 1.33", n: 1.33 }, { label: "Glass 1.5", n: 1.5 }, { label: "Diamond 2.42", n: 2.4 }].forEach(function (p) {
      var b = K.h('<button class="btn btn-sm" type="button">' + p.label + "</button>");
      b.addEventListener("click", function () { nS.set(p.n); changed(); });
      brRow.appendChild(b);
    });
    gBr.appendChild(K.h("<h3>Shortcuts</h3>")); gBr.appendChild(brRow);
    gBr.appendChild(K.h('<div class="legend"><span class="c-disp"><i></i>s: E out of the page (dots)</span><span class="c-acc"><i></i>p: E in the page (arrows)</span></div>'));
    [gSlit, gPol, gBr].forEach(function (g) { P.controls.appendChild(g); });

    var yP = 4;                         // mm: the point P on the screen (single slit)

    /* ---------- single slit physics ---------- */
    function sp() { return { lam: lamS.get(), a: aS.get(), D: DS.get() }; }
    function sinT(p, y) { var Y = y * 1e-3; return Y / Math.hypot(Y, p.D); }
    // Huygens: add up N equal phasors, one per strip of width a/N, each a step δ further along in phase
    function slitI(p, y) {
      var dl = 2 * Math.PI * (p.a * 1e-3 / N) * sinT(p, y) / (p.lam * 1e-9);
      var cr = Math.cos(dl), ci = Math.sin(dl), zr = 1, zi = 0, sr = 0, si = 0;
      for (var k = 0; k < N; k++) { sr += zr; si += zi; var t = zr * cr - zi * ci; zi = zr * ci + zi * cr; zr = t; }
      return (sr * sr + si * si) / (N * N);
    }
    function slitIF(p, y) {         // textbook: (sin β / β)², β = π a y / (λ D)
      var b = Math.PI * (p.a * 1e-3) * (y * 1e-3) / (p.lam * 1e-9 * p.D);
      return Math.abs(b) < 1e-9 ? 1 : Math.pow(Math.sin(b) / b, 2);
    }
    // the first dark band, found from the simulated pattern alone: scan for the first dip, then home in
    function firstMin(p) {
      var step = 0.1, prev = slitI(p, 0), y = step, cur = slitI(p, y);
      while (y < 80) {
        var nxt = slitI(p, y + step);
        if (cur <= prev && cur <= nxt) break;
        prev = cur; cur = nxt; y += step;
      }
      var lo = Math.max(0, y - step), hi = y + step, g = (Math.sqrt(5) - 1) / 2;
      for (var i = 0; i < 60; i++) {
        var m1 = hi - g * (hi - lo), m2 = lo + g * (hi - lo);
        if (slitI(p, m1) < slitI(p, m2)) hi = m2; else lo = m1;
      }
      return (lo + hi) / 2;
    }

    /* ---------- polariser physics ---------- */
    function pp() { return { A: thA.get(), B: thB.get(), C: thC.get(), onB: on.B, onC: on.C }; }
    function stack(p) { var s = [p.A]; if (p.onB) s.push(p.B); if (p.onC) s.push(p.C); return s; }
    // simulated: unpolarised light = many random-ish polarisation directions; project the E vector onto each axis in turn
    function polSim(p) {
      var axes = stack(p), M = 720, stages = axes.map(function () { return 0; });
      for (var j = 0; j < M; j++) {
        var ang = (j + 0.5) / M * Math.PI, ex = Math.sin(ang), ey = Math.cos(ang);
        axes.forEach(function (a, k) {
          var nx = Math.sin(a * K.DEG), ny = Math.cos(a * K.DEG), dot = ex * nx + ey * ny;
          ex = dot * nx; ey = dot * ny;
          stages[k] += ex * ex + ey * ey;
        });
      }
      return stages.map(function (s) { return s / M; });
    }
    function polF(p) {            // Malus: I0/2, then cos² of each relative angle
      var axes = stack(p), I = 0.5, out = [I];
      for (var k = 1; k < axes.length; k++) { I *= Math.pow(Math.cos((axes[k] - axes[k - 1]) * K.DEG), 2); out.push(I); }
      return out;
    }

    /* ---------- Brewster physics (Fresnel equations) ---------- */
    function fresnel(n, iDeg) {
      var i = iDeg * K.DEG, r = Math.asin(Math.sin(i) / n), ci = Math.cos(i), cr = Math.cos(r);
      var rs = (ci - n * cr) / (ci + n * cr), rp = (n * ci - cr) / (n * ci + cr);
      return { r: r / K.DEG, rs: rs, rp: rp, Rs: rs * rs, Rp: rp * rp, ts: 2 * ci / (ci + n * cr), tp: 2 * ci / (n * ci + cr) };
    }
    function brewsterSim(n) {     // the angle where the simulated Rp is smallest
      var lo = 0.5, hi = 89.9, g = (Math.sqrt(5) - 1) / 2;
      for (var k = 0; k < 80; k++) {
        var m1 = hi - g * (hi - lo), m2 = lo + g * (hi - lo);
        if (fresnel(n, m1).Rp < fresnel(n, m2).Rp) hi = m2; else lo = m1;
      }
      return (lo + hi) / 2;
    }

    var S = null;
    function compute() {
      var p = sp(), q = pp(), n = nS.get(), i = iS.get();
      var s = { mode: mode };
      s.y1 = firstMin(p); s.y1F = p.lam * 1e-9 * p.D / (p.a * 1e-3) * 1e3;
      s.width = 2 * s.y1; s.widthF = 2 * s.y1F;
      s.IP = slitI(p, yP); s.IPF = slitIF(p, yP);
      s.nP = p.a * 1e-3 * sinT(p, yP) / (p.lam * 1e-9);     // a sinθ / λ at P
      s.betaP = Math.PI * (p.a * 1e-3) * (yP * 1e-3) / (p.lam * 1e-9 * p.D);
      s.stages = polSim(q); s.stagesF = polF(q);
      s.Iout = s.stages[s.stages.length - 1]; s.IoutF = s.stagesF[s.stagesF.length - 1];
      var f = fresnel(n, i);
      s.fr = f; s.thB = brewsterSim(n); s.thBF = Math.atan(n) / K.DEG;
      s.Ru = (f.Rs + f.Rp) / 2; s.pol = (f.Rs - f.Rp) / (f.Rs + f.Rp);
      return s;
    }

    /* ---------- drawing ---------- */
    function screenX(D) { return 480 + (D - D_MIN) / (D_MAX - D_MIN) * 360; }
    function yPx(ymm) { return CY - ymm * PXMM; }
    function colour(a, nm) { var c = wlRGB(nm || lamS.get()); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
    function inkColour(a, nm) {
      var c = wlRGB(nm || lamS.get()), bg = th["canvas-bg"] || "#fff", light = /^#?[ef]/i.test(bg.replace("#", ""));
      if (light) c = c.map(function (v) { return Math.round(v * 0.62); });
      return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
    }
    var pattern = [];
    function buildPattern() {
      var p = sp(); pattern = [];
      for (var row = Math.round(CY - VIEW * PXMM); row <= Math.round(CY + VIEW * PXMM); row++) pattern.push(slitI(p, (CY - row) / PXMM));
    }

    sim.on("under", function (ctx) {
      if (mode === "slit") drawSlit(ctx);
      else if (mode === "polar") drawPolar(ctx);
      else drawBrewster(ctx);
    });

    function drawSlit(ctx) {
      var p = sp(), sx = screenX(p.D), half = Math.max(3, p.a * SLIT_PX / 2), lamPx = 14 + (p.lam - 400) / 300 * 16, phase = sim.time % 1;
      ctx.fillStyle = th.body; ctx.fillRect(LASER_X - 70, CY - 18, 70, 36);
      ctx.fillStyle = colour(1); ctx.fillRect(LASER_X - 6, CY - 6, 6, 12);
      K.label(ctx, "laser", LASER_X - 35, CY - 22, th.muted);
      ctx.strokeStyle = inkColour(0.55); ctx.lineWidth = 2;
      for (var n = 0; n < 30; n++) {
        var x = SLIT_X + (phase - n) * lamPx;
        if (x < LASER_X) break;
        if (x > SLIT_X) continue;
        ctx.beginPath(); ctx.moveTo(x, CY - 60); ctx.lineTo(x, CY + 60); ctx.stroke();
      }
      // wavefronts beyond the slit, bright only in the directions the pattern is bright
      ctx.save(); ctx.beginPath(); ctx.rect(SLIT_X, 0, sx - SLIT_X, H); ctx.clip();
      var L = sx - SLIT_X, rMax = Math.hypot(L, H), top = Math.round(CY - VIEW * PXMM);
      ctx.lineWidth = 2;
      for (var k = 0; (k + phase) * lamPx < rMax; k++) {
        var r = (k + phase) * lamPx, fade = Math.max(0, 0.7 * (1 - r / rMax));
        for (var sgi = -40; sgi < 40; sgi++) {
          var a0 = sgi / 40 * 1.2, a1 = (sgi + 1) / 40 * 1.2, ym = (a0 + a1) / 2, row = Math.round(CY + Math.tan(ym) * L) - top;
          var I = row >= 0 && row < pattern.length ? pattern[row] : 0;
          if (I < 0.01) continue;
          ctx.strokeStyle = inkColour(fade * Math.sqrt(I));
          ctx.beginPath(); ctx.arc(SLIT_X, CY, r, a0, a1); ctx.stroke();
        }
      }
      ctx.restore();
      // barrier with one slit
      ctx.fillStyle = th.body;
      ctx.fillRect(SLIT_X - 4, 20, 8, CY - half - 20);
      ctx.fillRect(SLIT_X - 4, CY + half, 8, H - 60 - (CY + half));
      ctx.strokeStyle = th.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(SLIT_X - 20, CY - half); ctx.lineTo(SLIT_X - 20, CY + half); ctx.stroke();
      K.label(ctx, "a", SLIT_X - 30, CY + 6, th.muted);
      // screen and its pattern
      var Ht = pattern.length;
      ctx.fillStyle = "#0b0d12"; ctx.fillRect(sx - 7, top, 14, Ht);
      pattern.forEach(function (I, i) { ctx.fillStyle = colour(K.clamp(Math.sqrt(I) * 0.35 + I * 0.65, 0, 1)); ctx.fillRect(sx - 6, top + i, 12, 1); });
      ctx.fillStyle = th.muted; ctx.fillRect(sx - 7, top - 22, 14, 14);
      K.label(ctx, "⇔ drag", sx, top - 24, th.muted, { font: "600 10px 'JetBrains Mono', monospace" });
      var gx0 = sx + 14, gw = 120;
      ctx.strokeStyle = th.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx0, top); ctx.lineTo(gx0, top + Ht); ctx.stroke();
      ctx.strokeStyle = inkColour(0.95); ctx.lineWidth = 2;
      ctx.beginPath();
      pattern.forEach(function (I, i) { var x = gx0 + I * gw; if (i) ctx.lineTo(x, top + i); else ctx.moveTo(x, top + i); });
      ctx.stroke();
      // first minima and the width of the central maximum
      if (S && S.y1 < VIEW) {
        ctx.strokeStyle = th.ink; ctx.setLineDash([3, 3]);
        [S.y1, -S.y1].forEach(function (y) { ctx.beginPath(); ctx.moveTo(sx + 8, yPx(y)); ctx.lineTo(gx0 + gw, yPx(y)); ctx.stroke(); });
        ctx.setLineDash([]);
        K.label(ctx, "2λD/a = " + K.fmt(S.width, 2) + " mm", gx0 + 40, yPx(0) + 20, th.ink, { align: "left", bg: true, font: "700 11px 'JetBrains Mono', monospace" });
      }
      ctx.fillStyle = th.muted; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (var mm = -20; mm <= 20; mm += 10) { ctx.fillRect(sx - 12, yPx(mm), 5, 1); ctx.fillText(mm + "", sx - 14, yPx(mm)); }
      var dy = H - 22;
      K.arrow(ctx, (SLIT_X + sx) / 2, dy, SLIT_X + 2, dy, th.muted, { width: 1.2, head: 7 });
      K.arrow(ctx, (SLIT_X + sx) / 2, dy, sx - 2, dy, th.muted, { width: 1.2, head: 7 });
      K.label(ctx, "D = " + K.fmt(p.D, 1) + " m", (SLIT_X + sx) / 2, dy - 4, th.muted, { bg: true });
      K.label(ctx, "schematic: slit width drawn ×" + Math.round(SLIT_PX / PXMM) + " · screen in mm", 12, H - 2, th.muted, { align: "left", font: "600 10px 'JetBrains Mono', monospace" });
      drawPhasors(ctx);
    }

    // phasor chain for P: 24 strips, each turned by the same angle; the gap from tail to head is the resultant
    function drawPhasors(ctx) {
      if (!S) return;
      var bx = 20, by = 300, bw = 230, bh = 170, M = 24, len = 130 / M;
      ctx.fillStyle = K.alpha(th.surface, 0.92); ctx.strokeStyle = th.line; ctx.lineWidth = 1;
      ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
      K.label(ctx, "phasors at P", bx + 8, by + 18, th.muted, { align: "left", font: "700 11px 'JetBrains Mono', monospace" });
      var total = 2 * S.betaP, step = total / M, x = 0, y = 0, pts = [[0, 0]], ang = -total / 2;
      for (var k = 0; k < M; k++) { ang += step; x += len * Math.cos(ang - step / 2); y += len * Math.sin(ang - step / 2); pts.push([x, y]); }
      var minX = 0, maxX = 0, minY = 0, maxY = 0;
      pts.forEach(function (q) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); });
      var ox = bx + bw / 2 - (minX + maxX) / 2, oy = by + 24 + (bh - 24) / 2 + (minY + maxY) / 2;
      ctx.strokeStyle = inkColour(0.9); ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach(function (q, i) { if (i) ctx.lineTo(ox + q[0], oy - q[1]); else ctx.moveTo(ox + q[0], oy - q[1]); });
      ctx.stroke();
      var e = pts[pts.length - 1];
      K.arrow(ctx, ox, oy, ox + e[0], oy - e[1], th.ink, { width: 2, head: 8 });
      K.label(ctx, "I/I₀ = " + K.fmt(S.IP, 3), bx + bw - 8, by + bh - 4, th.ink, { align: "right", font: "700 11px 'JetBrains Mono', monospace" });
    }

    function polAxisEnd(x, ang, s) { return { x: x + Math.sin(ang * K.DEG) * POL_RX * s, y: CY - Math.cos(ang * K.DEG) * POL_RY * s }; }
    function drawPolar(ctx) {
      var q = pp(), axes = [q.A, q.B, q.C], enabled = [true, q.onB, q.onC], t = sim.time, NM = 580;
      // the beam: before A unpolarised (many directions), then one direction with shrinking amplitude
      var segs = [[LASER_X, POL_X[0]]], dirs = [null], amps = [1];
      var I = 0.5, last = q.A, prevX = POL_X[0];
      for (var k = 1; k < 3; k++) {
        if (!enabled[k]) continue;
        segs.push([prevX, POL_X[k]]); dirs.push(last); amps.push(Math.sqrt(I / 0.5) * Math.sqrt(0.5));
        I *= Math.pow(Math.cos((axes[k] - last) * K.DEG), 2); last = axes[k]; prevX = POL_X[k];
      }
      segs.push([prevX, DET_X]); dirs.push(last); amps.push(Math.sqrt(I));
      ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(LASER_X, CY); ctx.lineTo(DET_X, CY); ctx.stroke();
      segs.forEach(function (sg, i) {
        var list = dirs[i] === null ? [0, 45, 90, 135] : [dirs[i]], A = 55 * amps[i];
        if (A < 0.5) return;
        list.forEach(function (d) {
          ctx.strokeStyle = dirs[i] === null ? K.alpha(th.ten, 0.5) : th.ten; ctx.lineWidth = 2;
          ctx.beginPath();
          for (var x = sg[0] + 4; x <= sg[1] - 4; x += 3) {
            var v = A * Math.cos(2 * Math.PI * (x / 60 - t));
            var px = x + Math.sin(d * K.DEG) * 0.36 * v, py = CY - Math.cos(d * K.DEG) * v;
            if (x === sg[0] + 4) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        });
      });
      ctx.fillStyle = th.body; ctx.fillRect(LASER_X - 70, CY - 18, 70, 36);
      ctx.fillStyle = colour(1, NM); ctx.fillRect(LASER_X - 6, CY - 6, 6, 12);
      K.label(ctx, "unpolarised I₀", LASER_X - 35, CY - 22, th.muted);
      // polarisers
      ["A", "B", "C"].forEach(function (name, k) {
        var x = POL_X[k];
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x, CY, POL_RX, POL_RY, 0, 0, Math.PI * 2);
        if (enabled[k]) { ctx.fillStyle = K.alpha(th.grav, 0.14); ctx.fill(); ctx.strokeStyle = th.grav; ctx.lineWidth = 2; ctx.stroke(); }
        else { ctx.setLineDash([5, 5]); ctx.strokeStyle = th.muted; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.restore();
        if (enabled[k]) {
          var e1 = polAxisEnd(x, axes[k], 1), e2 = polAxisEnd(x, axes[k], -1);
          ctx.strokeStyle = th.grav; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
          K.label(ctx, name + ": " + axes[k] + "°", x, CY + POL_RY + 22, th.grav);
        } else K.label(ctx, name + ": off (tap)", x, CY + POL_RY + 22, th.muted);
      });
      // detector
      var Io = S ? S.Iout : 0;
      ctx.fillStyle = th.body; ctx.fillRect(DET_X, CY - 40, 30, 80);
      ctx.fillStyle = colour(K.clamp(Io * 2, 0, 1), NM); ctx.fillRect(DET_X + 4, CY - 36, 22, 72);
      K.label(ctx, "I = " + K.fmt(Io, 3) + " I₀", DET_X + 15, CY - 46, th.ink, { bg: true });
      K.label(ctx, "angles measured from the vertical · drag a polariser to turn it", 12, H - 2, th.muted, { align: "left", font: "600 10px 'JetBrains Mono', monospace" });
    }

    function drawBrewster(ctx) {
      var n = nS.get(), i = iS.get(), f = S ? S.fr : fresnel(n, i), t = sim.time;
      ctx.fillStyle = K.alpha(th.disp, 0.12); ctx.fillRect(40, O.y, W - 80, H - 40 - O.y);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, O.y); ctx.lineTo(W - 40, O.y); ctx.stroke();
      ctx.strokeStyle = th.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(O.x, O.y - RAY); ctx.lineTo(O.x, O.y + 200); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "air", 60, O.y - 8, th.muted, { align: "left" });
      K.label(ctx, "n = " + K.fmt(n, 2), 60, O.y + 26, th.muted, { align: "left" });
      var ir = i * K.DEG, rr = f.r * K.DEG;
      var inc = { x: O.x - Math.sin(ir) * RAY, y: O.y - Math.cos(ir) * RAY };
      var ref = { x: O.x + Math.sin(ir) * RAY, y: O.y - Math.cos(ir) * RAY };
      var trn = { x: O.x + Math.sin(rr) * 200, y: O.y + Math.cos(rr) * 200 };
      ray(ctx, inc, O, 1, 1, t, "incident (unpolarised)");
      ray(ctx, O, ref, Math.abs(f.rs) * 2.5, Math.abs(f.rp) * 2.5, t, "reflected R = " + K.fmt(S ? S.Ru : 0, 3));
      ray(ctx, O, trn, f.ts * 0.8, f.tp * 0.8 * n, t, "refracted");
      // angles
      K.label(ctx, "i = " + K.fmt(i, 1) + "°", O.x - 14, O.y - 40, th.ink, { align: "right" });
      K.label(ctx, "r = " + K.fmt(f.r, 1) + "°", O.x + 14, O.y + 60, th.ink, { align: "left" });
      var between = 180 - i - f.r;
      K.label(ctx, "reflected ∠ refracted = " + K.fmt(between, 1) + "°", W - 50, 30, Math.abs(between - 90) < 0.5 ? th.good : th.muted, { align: "right", bg: true });
      if (Math.abs(i - (S ? S.thBF : 0)) <= 0.5) K.label(ctx, "Brewster: reflected light is fully s-polarised", W - 50, 54, th.good, { align: "right", bg: true });
      K.label(ctx, "drag the incoming ray to change i", 12, H - 2, th.muted, { align: "left", font: "600 10px 'JetBrains Mono', monospace" });
    }
    // a ray from a to b with polarisation marks travelling along it: dots for s, cross-strokes for p
    function ray(ctx, a, b, sAmp, pAmp, t, text) {
      var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      var w = 1 + 2.5 * Math.min(1, Math.max(sAmp, pAmp));
      ctx.strokeStyle = th.ten; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      K.arrow(ctx, a.x + dx * 0.45, a.y + dy * 0.45, a.x + dx * 0.55, a.y + dy * 0.55, th.ten, { width: w, head: 12 });
      var off = (t * 40) % 40;
      for (var d = off + 10; d < L - 10; d += 40) {
        var x = a.x + ux * d, y = a.y + uy * d;
        if (sAmp > 0.02) { ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(x, y, Math.min(7, 2 + 4 * sAmp), 0, Math.PI * 2); ctx.fill(); }
        var pl = Math.min(18, 16 * pAmp);
        if (pl > 1) {
          var px = x + ux * 20, py = y + uy * 20;
          ctx.strokeStyle = th.acc; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(px - uy * pl, py + ux * pl); ctx.lineTo(px + uy * pl, py - ux * pl); ctx.stroke();
        }
      }
      var e = b.x === O.x && b.y === O.y ? a : b;          // label the far end of the ray, away from O
      K.label(ctx, text, e.x + (e.x >= O.x ? 6 : -6), e.y + (e.y < O.y ? -4 : 16), th.ink, { align: e.x >= O.x ? "left" : "right", font: "700 11px 'JetBrains Mono', monospace" });
    }

    sim.on("over", function (ctx) {
      if (mode !== "slit" || !S) return;
      var p = sp(), sx = screenX(p.D), half = Math.max(3, p.a * SLIT_PX / 2), py = yPx(yP);
      ctx.lineWidth = 2;
      ctx.strokeStyle = th.disp; ctx.beginPath(); ctx.moveTo(SLIT_X, CY - half); ctx.lineTo(sx, py); ctx.stroke();
      ctx.strokeStyle = th.acc; ctx.beginPath(); ctx.moveTo(SLIT_X, CY + half); ctx.lineTo(sx, py); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(sx, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.surface; ctx.beginPath(); ctx.arc(sx, py, 2.5, 0, Math.PI * 2); ctx.fill();
      K.label(ctx, "P: a sinθ = " + K.fmt(S.nP, 2) + " λ, " + kindAt(S), sx - 16, py - 8, th.ink, { align: "right", bg: true });
    });
    function kindAt(s) {
      var n = Math.abs(s.nP), f = n - Math.round(n);
      return n < 0.05 ? "centre" : Math.abs(f) < 0.03 ? "dark" : "bright-ish";
    }

    /* ---------- direct manipulation ---------- */
    var dragging = null;
    sim.pointer({
      down: function (pt) {
        if (mode === "slit") {
          var p = sp(), sx = screenX(p.D), top = yPx(VIEW);
          if (Math.abs(pt.px - sx) < 26 && pt.py < top - 4 && pt.py > top - 40) dragging = "screen";
          else if (Math.abs(pt.px - sx) < 40 && pt.py >= top - 4 && pt.py <= yPx(-VIEW) + 4) dragging = "P";
          else if (Math.abs(pt.px - SLIT_X) < 22) dragging = "slit";
          else return false;
        } else if (mode === "polar") {
          var k = POL_X.map(function (x) { return Math.abs(pt.px - x) < POL_RX + 10 && Math.abs(pt.py - CY) < POL_RY + 10; }).indexOf(true);
          if (k < 0) return false;
          if (k === 1 && !on.B) { on.B = true; chkB.querySelector("input").checked = true; changed(); return false; }
          if (k === 2 && !on.C) { on.C = true; chkC.querySelector("input").checked = true; changed(); return false; }
          dragging = "pol" + k;
        } else {
          if (pt.py > O.y || pt.px > O.x + 20) return false;
          dragging = "ray";
        }
        move(pt);
        return true;
      },
      drag: function (pt) { move(pt); },
      up: function () { dragging = null; }
    });
    function move(pt) {
      if (dragging === "P") { yP = Math.round(K.clamp((CY - pt.py) / PXMM, -VIEW, VIEW) * 100) / 100; refresh(); }
      else if (dragging === "screen") { DS.set(K.clamp(Math.round((D_MIN + (pt.px - 480) / 360 * (D_MAX - D_MIN)) * 10) / 10, D_MIN, D_MAX)); changed(); }
      else if (dragging === "slit") { aS.set(K.clamp(Math.round(2 * Math.abs(pt.py - CY) / SLIT_PX * 100) / 100, 0.05, 0.5)); changed(); }
      else if (dragging && dragging.indexOf("pol") === 0) {
        var k = +dragging.slice(3), dx = (pt.px - POL_X[k]) / 0.36, dy = CY - pt.py;
        if (Math.hypot(dx, dy) < 8) return;
        var ang = Math.round(mod180(Math.atan2(dx, dy) / K.DEG));
        [thA, thB, thC][k].set(ang === 180 ? 0 : ang); changed();
      } else if (dragging === "ray") {
        var a = Math.atan2(O.x - pt.px, O.y - pt.py) / K.DEG;
        iS.set(K.clamp(Math.round(a * 2) / 2, 0, 89.5)); changed();
      }
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML = [0, 1, 2].map(function () { return '<div class="graph"><canvas></canvas><p class="graph-cap"></p></div>'; }).join("");
    var cv = P.graphs.querySelectorAll("canvas"), caps = P.graphs.querySelectorAll(".graph-cap");
    var g1 = new K.Graph(cv[0], { yLabel: "I / I₀", xMax: 1 }), g2 = new K.Graph(cv[1], { yLabel: "", xMax: 1 }), g3 = new K.Graph(cv[2], { yLabel: "", xMax: 1 });
    var CAPS = {
      slit: ['<b class="c-disp">I across the screen (top half; it\'s symmetric)</b> · phasor sum of ' + N + ' strips (solid) vs $(\\sin\\beta/\\beta)^2$ (dashed)',
        '<b class="c-disp">central maximum width vs a</b> · measured (solid) vs $2\\lambda D/a$ (dashed); dot = your slit',
        '<b class="c-disp">I vs a sinθ / λ</b> · zeros at every whole number, whatever $\\lambda$, $a$ and $D$ are'],
      polar: ['<b class="c-ten">I out vs θ of the last polariser</b> · simulated (solid) vs Malus (dashed); dot = now',
        '<b class="c-ten">I out vs the middle polariser B</b> · with A and C as set, B switched in; peaks at 45° between crossed ones',
        '<b class="c-ten">I after each stage</b> · source, A, B, C: simulated (solid) vs $I_0/2$ then $\\cos^2$ (dashed)'],
      brewster: ['<b class="c-disp">reflectance vs i</b> · $R_s$ (blue) and $R_p$ (orange) from Fresnel; dashed line at $\\tan\\theta_B = n$',
        '<b class="c-disp">how polarised the reflected light is</b> · $(R_s - R_p)/(R_s + R_p)$ reaches 1 at $\\theta_B$',
        '<b class="c-disp">angle between reflected and refracted rays</b> · exactly 90° (dashed) at $\\theta_B$']
    };
    function setAxes(g, o) { Object.keys(o).forEach(function (k) { g.o[k] = o[k]; }); g.clear(); }
    var curveKey = "";
    function updateGraphs() {
      CAPS[mode].forEach(function (c, i) { caps[i].innerHTML = K.md(c); });
      g1.extra = null;
      var dash = { color: th.ink, dash: [5, 5], width: 1.5 };
      function D2(pts, col) { var o = { points: pts }; Object.keys(dash).forEach(function (k) { o[k] = dash[k]; }); if (col) o.color = col; return o; }
      if (mode === "slit") {
        var p = sp(), a1 = [], b1 = [], a3 = [], b3 = [];
        setAxes(g1, { yLabel: "I / I₀", xLabel: "y (mm)", xMax: VIEW, yMin: 0, yMax: 1, xAuto: false });
        for (var k = 0; k <= 300; k++) { var y = VIEW * k / 300; a1.push([y, slitI(p, y)]); b1.push([y, slitIF(p, y)]); }
        g1.set("sim", { points: a1, color: th.disp, width: 2.5 }); g1.set("theory", D2(b1));
        g1.extra = function (ctx, X, Y) {
          var x = X(Math.abs(yP));
          ctx.fillStyle = th.ink; ctx.beginPath(); ctx.moveTo(x, Y(1.06)); ctx.lineTo(x - 5, Y(1.06) - 8); ctx.lineTo(x + 5, Y(1.06) - 8); ctx.fill();
        };
        setAxes(g2, { yLabel: "width (mm)", xLabel: "a (mm)", xMax: 0.5, yMin: 0, yMax: undefined, xAuto: false });
        var key = p.lam + "|" + p.D;
        if (key !== curveKey) {
          curveKey = key; widthCurve = [];
          for (var a = 0.05; a <= 0.5001; a += 0.01) widthCurve.push([a, 2 * firstMin({ lam: p.lam, a: a, D: p.D })]);
        }
        var wf = [];
        for (var aa = 0.05; aa <= 0.5001; aa += 0.005) wf.push([aa, 2 * p.lam * 1e-9 * p.D / (aa * 1e-3) * 1e3]);
        g2.set("sim", { points: widthCurve, color: th.disp, width: 2.5 }); g2.set("theory", D2(wf));
        g2.set("now", { points: [[p.a, S.width]], color: th.acc, width: 0, dot: true });
        setAxes(g3, { yLabel: "I / I₀", xLabel: "a sinθ / λ", xMax: 4, yMin: 0, yMax: 1, xAuto: false });
        for (var j = 0; j <= 300; j++) {
          var u = 4 * j / 300, yy = Math.tan(Math.asin(u * p.lam * 1e-9 / (p.a * 1e-3))) * p.D * 1e3;
          var bb = Math.PI * u;
          a3.push([u, slitI(p, yy)]); b3.push([u, j ? Math.pow(Math.sin(bb) / bb, 2) : 1]);
        }
        g3.set("sim", { points: a3, color: th.disp, width: 2.5 }); g3.set("theory", D2(b3));
        g3.set("now", { points: [[Math.min(4, Math.abs(S.nP)), S.IP]], color: th.acc, width: 0, dot: true });
      } else if (mode === "polar") {
        var q = pp(), m1 = [], f1 = [], m2 = [], f2 = [];
        setAxes(g1, { yLabel: "I / I₀", xLabel: "θ (°)", xMax: 180, yMin: 0, yMax: 0.5, xAuto: false });
        var lastKey = q.onC ? "C" : q.onB ? "B" : "A";
        for (var d = 0; d <= 180; d += 3) {
          var qq = { A: q.A, B: q.B, C: q.C, onB: q.onB, onC: q.onC }; qq[lastKey] = d;
          var ss = polSim(qq), ff = polF(qq);
          m1.push([d, ss[ss.length - 1]]); f1.push([d, ff[ff.length - 1]]);
          var q2 = { A: q.A, B: d, C: q.C, onB: true, onC: q.onC }, s2 = polSim(q2), f2v = polF(q2);
          m2.push([d, s2[s2.length - 1]]); f2.push([d, f2v[f2v.length - 1]]);
        }
        g1.o.xLabel = "θ_" + lastKey + " (°)";
        g1.set("sim", { points: m1, color: th.ten, width: 2.5 }); g1.set("theory", D2(f1));
        g1.set("now", { points: [[q[lastKey], S.Iout]], color: th.ink, width: 0, dot: true });
        setAxes(g2, { yLabel: "I / I₀", xLabel: "θ_B (°)", xMax: 180, yMin: 0, yMax: 0.5, xAuto: false });
        g2.set("sim", { points: m2, color: th.ten, width: 2.5 }); g2.set("theory", D2(f2));
        if (q.onB) g2.set("now", { points: [[q.B, S.Iout]], color: th.ink, width: 0, dot: true });
        setAxes(g3, { yLabel: "I / I₀", xLabel: "stage", xMax: 3, yMin: 0, yMax: 1, xAuto: false });
        var st = [[0, 1]], sf = [[0, 1]], x = 0;
        [S.stages, S.stagesF].forEach(function (arr, w) {
          var out = w ? sf : st, prev = 1; x = 0;
          var slots = [1].concat(q.onB ? [2] : []).concat(q.onC ? [3] : []);
          arr.forEach(function (v, i2) { out.push([slots[i2], prev]); out.push([slots[i2], v]); prev = v; });
          out.push([3, prev]);
        });
        void x;
        g3.set("sim", { points: st, color: th.ten, width: 2.5 }); g3.set("theory", D2(sf));
      } else {
        var n = nS.get(), rs = [], rp = [], pol = [], ang = [], tb = S.thBF;
        setAxes(g1, { yLabel: "R", xLabel: "i (°)", xMax: 90, yMin: 0, yMax: 1, xAuto: false });
        setAxes(g2, { yLabel: "polarisation", xLabel: "i (°)", xMax: 90, yMin: 0, yMax: 1, xAuto: false });
        setAxes(g3, { yLabel: "angle (°)", xLabel: "i (°)", xMax: 90, yMin: 0, yMax: 180, xAuto: false });
        for (var ii = 0; ii <= 89.5; ii += 0.5) {
          var fr = fresnel(n, ii);
          rs.push([ii, fr.Rs]); rp.push([ii, fr.Rp]);
          pol.push([ii, ii === 0 ? 0 : (fr.Rs - fr.Rp) / (fr.Rs + fr.Rp)]); ang.push([ii, 180 - ii - fr.r]);
        }
        g1.set("rs", { points: rs, color: th.disp, width: 2.5 }); g1.set("rp", { points: rp, color: th.acc, width: 2.5 });
        g1.set("tb", D2([[tb, 0], [tb, 1]]));
        g1.set("now", { points: [[iS.get(), S.fr.Rp]], color: th.acc, width: 0, dot: true });
        g2.set("sim", { points: pol, color: th.disp, width: 2.5 }); g2.set("tb", D2([[tb, 0], [tb, 1]]));
        g2.set("now", { points: [[iS.get(), S.pol]], color: th.ink, width: 0, dot: true });
        g3.set("sim", { points: ang, color: th.disp, width: 2.5 }); g3.set("ninety", D2([[0, 90], [90, 90]])); g3.set("tb", D2([[tb, 0], [tb, 180]]));
        g3.set("now", { points: [[iS.get(), 180 - iS.get() - S.fr.r]], color: th.ink, width: 0, dot: true });
      }
      [g1, g2, g3].forEach(function (g) { g.dirty = true; g.draw(); });
    }
    var widthCurve = [];

    /* ---------- maths + readouts ---------- */
    var LABELS = {
      slit: ["Dark bands", "Central maximum", "Intensity at P", "Across the slit at P"],
      polar: ["First polariser: half of unpolarised light", "Malus's law at each next polariser", "What comes out", "Crossed polarisers"],
      brewster: ["Brewster's law", "Snell's law", "Reflected p-wave (Fresnel)", "Reflected ⟂ refracted at θ_B"]
    };
    var eqEls = [], setR = null;
    function buildPanels() {
      P.eqs.innerHTML = LABELS[mode].map(function (l) { return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>'; }).join("");
      eqEls = P.eqs.querySelectorAll(".eq-tex");
      var R = {
        slit: [{ id: "y1", label: "first dark band y₁", cls: "c-disp" }, { id: "w", label: "central maximum width", cls: "c-disp" },
          { id: "w2", label: "a secondary maximum", cls: "c-disp" }, { id: "nP", label: "a sinθ at P", cls: "c-acc" }, { id: "IP", label: "intensity at P" }],
        polar: [{ id: "I1", label: "after A", cls: "c-ten" }, { id: "Iout", label: "out of the last polariser", cls: "c-ten" },
          { id: "frac", label: "as a fraction" }, { id: "rel", label: "first ↔ last axis" }],
        brewster: [{ id: "thB", label: "Brewster angle θ_B", cls: "c-disp" }, { id: "r", label: "refraction angle r" }, { id: "Rp", label: "R_p (in-plane)", cls: "c-acc" },
          { id: "Rs", label: "R_s (out of plane)", cls: "c-disp" }, { id: "pol", label: "reflected light polarised" }, { id: "sum", label: "reflected ↔ refracted" }]
      };
      setR = K.readout(P.readouts, R[mode]);
    }
    function n2(v, d) { var s = K.fmt(v, d === undefined ? 2 : d); return v < 0 ? "(" + s + ")" : s; }
    function frac(v) {
      if (v < 1e-6) return "0";
      var inv = 1 / v, r = Math.round(inv);
      return Math.abs(inv - r) < 0.02 * inv ? "I₀/" + r : K.fmt(v, 3) + " I₀";
    }
    function renderMaths() {
      if (mode === "slit") {
        var p = sp();
        K.tex(eqEls[0], "a\\sin\\theta = n\\lambda \\;\\Rightarrow\\; y_1 = \\frac{\\lambda D}{a} = \\frac{(" + p.lam + "\\times10^{-9})(" + K.fmt(p.D, 1) + ")}{" + K.fmt(p.a, 2) + "\\times10^{-3}}\\text{ m} = \\mathbf{" + K.fmt(S.y1F, 2) + "}\\text{ mm}");
        K.tex(eqEls[1], "w = \\frac{2\\lambda D}{a} = 2 \\times " + K.fmt(S.y1F, 2) + " = \\mathbf{" + K.fmt(S.widthF, 2) + "}\\text{ mm}\\quad(\\text{others are } \\tfrac{\\lambda D}{a})");
        K.tex(eqEls[2], "\\beta = \\frac{\\pi a y}{\\lambda D} = " + n2(S.betaP / Math.PI, 3) + "\\pi,\\quad I = I_0\\left(\\frac{\\sin\\beta}{\\beta}\\right)^2 = \\mathbf{" + K.fmt(S.IPF, 3) + "}\\,I_0");
        K.tex(eqEls[3], "a\\sin\\theta = \\frac{a y}{D} = \\frac{" + K.fmt(p.a, 2) + "\\text{ mm}\\times" + n2(yP, 2) + "\\text{ mm}}{" + K.fmt(p.D, 1) + "\\text{ m}} = \\mathbf{" + K.fmt(p.a * yP / p.D, 3) + "}\\ \\mu\\text{m} = \\mathbf{" + K.fmt(S.nP, 2) + "}\\,\\lambda");
        setR("y1", K.fmt(S.y1, 2) + " mm", "formula λD/a = " + K.fmt(S.y1F, 2) + " mm");
        setR("w", K.fmt(S.width, 2) + " mm", "formula 2λD/a = " + K.fmt(S.widthF, 2) + " mm");
        setR("w2", K.fmt(S.y1F, 2) + " mm wide", "half the central one");
        setR("nP", K.fmt(S.nP, 2) + " λ", kindAt(S));
        setR("IP", K.fmt(S.IP, 3) + " I₀", "formula (sin β/β)² = " + K.fmt(S.IPF, 3));
      } else if (mode === "polar") {
        var q = pp(), ax = stack(q), names = ["A"].concat(q.onB ? ["B"] : []).concat(q.onC ? ["C"] : []);
        K.tex(eqEls[0], "I_A = \\frac{I_0}{2} = \\mathbf{0.500}\\,I_0 \\quad(\\text{the average of } \\cos^2 \\text{ over all directions})");
        var steps = [];
        for (var k = 1; k < ax.length; k++) steps.push("\\cos^2(" + ax[k] + "^\\circ - " + ax[k - 1] + "^\\circ)");
        K.tex(eqEls[1], steps.length ? "I = I_0\\cos^2\\theta:\\quad " + steps.map(function (s, k) {
          return "I_" + names[k + 1] + " = I_" + names[k] + s.replace("\\cos^2", "\\,\\cos^2");
        }).join(",\\ ") : "\\text{only one polariser: } I = I_0/2 \\text{ at any angle}");
        K.tex(eqEls[2], "I_{out} = \\frac{I_0}{2}" + steps.join("") + " = \\mathbf{" + K.fmt(S.IoutF, 4) + "}\\,I_0");
        var rel = mod180(ax[ax.length - 1] - ax[0]);
        K.tex(eqEls[3], q.onB && q.onC ? "\\text{with B between: } I = \\frac{I_0}{8}\\sin^2 2\\theta_{AB} \\text{ when A} \\perp \\text{C}" + (Math.abs(rel - 90) < 0.5 ? " = \\mathbf{" + K.fmt(S.IoutF, 4) + "}\\,I_0" : "")
          : "\\text{A} \\perp \\text{C}: I = \\frac{I_0}{2}\\cos^2 90^\\circ = 0");
        setR("I1", K.fmt(S.stages[0], 3) + " I₀", "formula I₀/2");
        setR("Iout", K.fmt(S.Iout, 4) + " I₀", "formula " + K.fmt(S.IoutF, 4) + " I₀");
        setR("frac", frac(S.Iout));
        setR("rel", K.fmt(rel, 0) + "°", Math.abs(rel - 90) < 0.5 ? "crossed" : "");
      } else {
        var n = nS.get(), i = iS.get(), f = S.fr;
        K.tex(eqEls[0], "\\tan\\theta_B = n \\;\\Rightarrow\\; \\theta_B = \\tan^{-1}(" + K.fmt(n, 2) + ") = \\mathbf{" + K.fmt(S.thBF, 2) + "^\\circ}");
        K.tex(eqEls[1], "\\sin i = n\\sin r:\\quad \\sin " + K.fmt(i, 1) + "^\\circ = " + K.fmt(n, 2) + "\\sin r \\;\\Rightarrow\\; r = \\mathbf{" + K.fmt(f.r, 2) + "^\\circ}");
        K.tex(eqEls[2], "R_p = \\left(\\frac{n\\cos i - \\cos r}{n\\cos i + \\cos r}\\right)^2 = \\mathbf{" + K.fmt(f.Rp, 4) + "},\\quad R_s = " + K.fmt(f.Rs, 4));
        K.tex(eqEls[3], "i + r = " + K.fmt(i, 1) + "^\\circ + " + K.fmt(f.r, 1) + "^\\circ = \\mathbf{" + K.fmt(i + f.r, 1) + "^\\circ}\\quad(90^\\circ \\text{ exactly at } \\theta_B)");
        setR("thB", K.fmt(S.thB, 2) + "°", "where R_p is least · formula tan⁻¹ n = " + K.fmt(S.thBF, 2) + "°");
        setR("r", K.fmt(f.r, 2) + "°", "Snell");
        setR("Rp", K.fmt(f.Rp, 4), f.Rp < 1e-4 ? "none: Brewster!" : "");
        setR("Rs", K.fmt(f.Rs, 4));
        setR("pol", K.fmt(S.pol * 100, 1) + " %", "(R_s − R_p)/(R_s + R_p)");
        setR("sum", K.fmt(180 - i - f.r, 1) + "°", "90° at θ_B");
      }
    }

    function swatchUpdate() {
      var nm = lamS.get(), c = wlRGB(nm);
      swatch.querySelector("span").style.color = "rgb(" + c.join(",") + ")";
      swatch.querySelector("em").textContent = nm + " nm looks " + wlName(nm);
    }
    function setMode(v) {
      mode = v;
      modeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === v)); });
      gSlit.style.display = v === "slit" ? "" : "none";
      gPol.style.display = v === "polar" ? "" : "none";
      gBr.style.display = v === "brewster" ? "" : "none";
      buildPanels(); changed();
    }
    function refresh() { S = compute(); renderMaths(); updateGraphs(); checkTries(); }
    function changed() { S = compute(); buildPattern(); swatchUpdate(); renderMaths(); updateGraphs(); checkTries(); }

    function checkTries() {
      var q = pp();
      if (mode === "slit" && Math.abs(Math.abs(S.nP) - 2) < 0.03) tries.mark("dark2");
      if (mode === "slit" && Math.abs(S.width - 10) < 0.005) tries.mark("width10");
      if (mode === "polar" && q.onB && q.onC && Math.abs(mod180(q.C - q.A) - 90) < 0.5 && S.Iout >= 0.12) tries.mark("surprise");
      if (mode === "brewster" && Math.abs(iS.get() - S.thBF) <= 0.5) tries.mark("brewster");
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p><b>Diffraction</b> is interference between the wavelets from different parts of <i>one</i> opening. Pair each strip in the top half of the slit with the matching strip in the bottom half: when the edges differ in path by $\\lambda$, every pair differs by $\\lambda/2$ and cancels. So the dark bands sit at $a\\sin\\theta = n\\lambda$, and the intensity is $I_0(\\sin\\beta/\\beta)^2$ with $\\beta = \\pi a\\sin\\theta/\\lambda$. The phasor chain shows it: it curls into a closed circle at each dark band.</p>" +
      "<p>The central band runs from $-\\lambda D/a$ to $+\\lambda D/a$, twice as wide as the rest. A <i>narrower</i> slit spreads the light <i>more</i>.</p>" +
      "<p><b>Polarisation</b> shows light is a transverse wave. A polariser passes only the part of $\\vec E$ along its axis, so intensity follows <b>Malus's law</b>, $I = I_0\\cos^2\\theta$. Unpolarised light averages $\\cos^2$ over every direction and loses exactly half. Reflection polarises too: at <b>Brewster's angle</b>, $\\tan\\theta_B = n$, the reflected ray is purely s-polarised and is perpendicular to the refracted ray.</p>" +
      '<div class="trap"><b>JEE trap: the first polariser takes half, not cos².</b> For unpolarised light the first polariser always gives $I_0/2$, whatever its angle. Malus\'s law starts from the second one. And in single-slit questions, $a\\sin\\theta = n\\lambda$ gives <i>dark</i> bands, the opposite of the double-slit bright-fringe rule $d\\sin\\theta = n\\lambda$.</div>');

    function apply(s) {
      if (s.lam !== undefined) lamS.set(s.lam);
      if (s.a !== undefined) aS.set(s.a);
      if (s.D !== undefined) DS.set(s.D);
      if (s.y !== undefined) yP = s.y;
      if (s.thA !== undefined) thA.set(s.thA);
      if (s.thB !== undefined) thB.set(s.thB);
      if (s.thC !== undefined) thC.set(s.thC);
      if (s.B !== undefined) { on.B = s.B; chkB.querySelector("input").checked = s.B; }
      if (s.C !== undefined) { on.C = s.C; chkC.querySelector("input").checked = s.C; }
      if (s.n !== undefined) nS.set(s.n);
      if (s.i !== undefined) iS.set(s.i);
      setMode(s.mode || mode);
      P.resetBtn.click();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "central maximum", setup: { mode: "slit", lam: 600, a: 0.2, D: 1.5, y: 4.5 }, watch: "Predict the width, then check the dashed lines on the screen",
        q: "Light of wavelength 600 nm falls on a slit 0.2 mm wide. On a screen 1.5 m away, how wide is the central bright band?",
        options: ["2.25 mm", "4.5 mm", "9 mm", "18 mm"], answer: 2,
        explain: "The first minima are at $y = \\pm\\lambda D/a = \\pm(600\\times10^{-9})(1.5)/(0.2\\times10^{-3}) = \\pm4.5$ mm, so the central band is $2\\lambda D/a = 9$ mm wide. 4.5 mm is the trap: that's only half of it (and the width of each secondary band). P sits on the first dark band." },
      { level: "medium", tag: "Brewster's angle", setup: { mode: "brewster", n: 1.73, i: 60 }, watch: "Read r, and the angle between the reflected and refracted rays",
        q: "Light reflected from a glass surface ($n = \\sqrt3$) is completely plane polarised. What is the angle of refraction?",
        options: ["30°", "45°", "60°", "90°"], answer: 0,
        hints: ["Completely polarised reflection means you are at Brewster's angle: $\\tan\\theta_B = n$.", "At Brewster's angle the reflected and refracted rays are perpendicular, so $i + r = 90°$."],
        explain: "$\\tan\\theta_B = \\sqrt3$ gives $i = 60°$. Then $i + r = 90°$, so $r = 30°$ (Snell agrees: $\\sin r = \\sin 60°/\\sqrt3 = 1/2$). 90° is the angle between the reflected and refracted rays, not $r$." },
      { level: "hard", tag: "three polarisers", setup: { mode: "polar", thA: 0, thB: 15, thC: 90, B: true, C: true }, watch: "Read I out: does it match I₀/32? Then try B = 30° and 75°",
        q: "Unpolarised light of intensity $I_0$ passes through polariser A, then B, then C, where C is crossed with A. The light that emerges has intensity $I_0/32$. What is the angle between the axes of A and B (less than 45°)?",
        options: ["15°", "22.5°", "30°", "45°"], answer: 0,
        hints: ["After A: $I_0/2$. After B: $\\tfrac{I_0}{2}\\cos^2\\theta$. After C, whose axis is $90° - \\theta$ from B: multiply by $\\sin^2\\theta$.", "So $I = \\tfrac{I_0}{8}\\sin^2 2\\theta$. Set it equal to $I_0/32$."],
        explain: "$\\tfrac{I_0}{8}\\sin^2 2\\theta = \\tfrac{I_0}{32}$ gives $\\sin 2\\theta = \\tfrac12$, so $2\\theta = 30°$ and $\\theta = 15°$ (75° also works, by symmetry). 22.5° gives $I_0/16$ and 30° gives $3I_0/32$. The lab shows $I_{out} = 0.0312\\,I_0$, which is $I_0/32$." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    K.transport(P, sim, {
      playLabel: "Play waves",
      onReset: function () { sim.resetClock(); P.time.textContent = "t = 0.00 s"; changed(); }
    });
    setMode("slit");

    if (location.hostname === "localhost") {
      window.__lab_diffraction = {
        apply: apply, sim: sim, state: function () { return compute(); },
        slitI: function (y) { return slitI(sp(), y); }, slitIF: function (y) { return slitIF(sp(), y); },
        fresnel: fresnel, P: function () { return yP; }, mode: function () { return mode; },
        geom: function () { var p = sp(); return { sx: screenX(p.D), cy: CY, pxmm: PXMM, polX: POL_X, O: O }; }
      };
    }

    return function destroy() {
      sim.destroy(); [g1, g2, g3].forEach(function (g) { g.destroy(); });
      if (window.__lab_diffraction) delete window.__lab_diffraction;
    };
  }
})();
