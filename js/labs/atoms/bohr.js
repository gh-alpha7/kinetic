/* Atoms & nuclei, lab 1: the Bohr model. A hydrogen-like atom whose electron you can kick up a level and watch fall back, one photon at a time. */
(function () {
  "use strict";
  var E0 = 13.6, HC = 1239.84, A0 = 0.529, V0 = 2.19e6;   // eV, eV·nm, Å, m/s
  var RYD = E0 / HC * 1000;                                // Rydberg constant in μm⁻¹ (1.097 × 10⁷ m⁻¹), consistent with E0 and hc
  var NMAX = 6, DWELL = 0.8, ABSORB = 0.45, LIFE = 1.6;    // highest level drawn; seconds in a level, for an incoming photon, for a photon on screen
  var SERIES = ["", "Lyman", "Balmer", "Paschen", "Brackett", "Pfund"];
  var IONS = [{ label: "H (Z = 1)", value: 1 }, { label: "He⁺ (Z = 2)", value: 2 }, { label: "Li²⁺ (Z = 3)", value: 3 }];

  var lab = {
    id: "bohr", chapter: "atoms", title: "Bohr model & spectra", short: "levels, photons, line spectra",
    lede: "Kick the electron up to a higher orbit and let it fall. Every jump down throws out one photon, and its colour is fixed by two whole numbers: $\\frac{1}{\\lambda} = RZ^2\\left(\\frac{1}{n_1^2} - \\frac{1}{n_2^2}\\right)$.",
    tries: [
      { id: "visible", title: "Light up the visible",
        text: "Make the atom emit a photon you could actually see (380–750 nm).",
        why: "In hydrogen only the Balmer series (falls to $n = 2$) lands in the visible: 656 nm red for 3 → 2, then 486, 434 and 410 nm. Lyman jumps are too big (ultraviolet), Paschen jumps too small (infrared)." },
      { id: "alllines", title: "Catch all 6 lines from n = 4",
        text: "Excite to $n = 4$ with the random way down, again and again, until the strip shows every possible line.",
        why: "From level $n$ there are $\\frac{n(n-1)}{2}$ pairs of levels, so 6 lines from $n = 4$. One atom makes at most $n - 1 = 3$ of them on its way down; a whole gas of atoms shows them all." },
      { id: "ionise", title: "Ionise He⁺ from the ground state",
        text: "Pick He⁺, make sure the electron is in $n = 1$, then pull it out.",
        why: "Ionisation takes the electron from $E_1$ up to $E = 0$, so it costs $13.6 Z^2 = 54.4$ eV for He⁺: four times hydrogen's 13.6 eV, because the nucleus pulls twice as hard on an orbit half the size." },
      { id: "twin", title: "Make He⁺ copy a hydrogen line",
        text: "Find a jump in He⁺ (or Li²⁺) that gives exactly the same wavelength as a hydrogen line.",
        why: "$Z^2\\left(\\frac{1}{n_1^2} - \\frac{1}{n_2^2}\\right)$ is unchanged if you double $Z$ and both $n$'s. So He⁺ 4 → 2 is hydrogen's 2 → 1 (122 nm) and He⁺ 6 → 4 is the red 656 nm Balmer line." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function En(n, Z) { return -E0 * Z * Z / (n * n); }
  function rn(n, Z) { return A0 * n * n / Z; }
  function vn(n, Z) { return V0 * Z / n; }
  // the photon's wavelength two ways: from the energy the electron lost, and from the Rydberg formula
  function lamFromEnergy(n2, n1, Z) { return HC / (En(n2, Z) - En(n1, Z)); }
  function lamRydberg(n2, n1, Z) { return 1000 / (RYD * Z * Z * (1 / (n1 * n1) - 1 / (n2 * n2))); }
  // three significant figures, the way the lab prints wavelengths
  function sig3(x) { return !isFinite(x) ? "—" : x >= 100 ? K.fmt(x, 0) : x >= 10 ? K.fmt(x, 1) : K.fmt(x, 2); }
  // approximate colour of visible light (null outside 380–750 nm)
  function visColor(l) {
    if (l < 380 || l > 750) return null;
    var r = 0, g = 0, b = 0;
    if (l < 440) { r = (440 - l) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; }
    else if (l < 510) { g = 1; b = (510 - l) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; }
    else if (l < 645) { r = 1; g = (645 - l) / 65; } else r = 1;
    return "rgb(" + Math.round(r * 255) + "," + Math.round(g * 255) + "," + Math.round(b * 255) + ")";
  }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 470;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });
    var AT = { x: 220, y: 208 };                                   // nucleus, world px
    var LV = { x0: 560, x1: 905, top: 40, bot: 384 };              // energy-level diagram
    var SP = { x0: 30, x1: 970, y0: 418, y1: 452 };                // spectrum strip
    function rDraw(n) { return 8 + 5.3 * n * n; }                 // drawn radius ∝ n² (true size shrinks by 1/Z)
    function yLevel(n) { return LV.top + (LV.bot - LV.top) / n; }  // y ∝ 1/n, i.e. √|E|: keeps the top levels apart

    /* ---------- controls ---------- */
    var Z = 1, way = "random", show = { all: true, limits: true }, nPick = 4;
    P.controls.innerHTML = "<h3>Atom</h3>";
    var zSeg = K.seg(IONS, 1, function (v) { Z = v; reset(); }, "Atom");
    P.controls.appendChild(zSeg);
    P.controls.appendChild(K.h("<h3>Excite the electron</h3>"));
    var exRow = K.h('<div class="row"></div>');
    for (var k = 2; k <= NMAX; k++) {
      (function (n) {
        var b = K.h('<button class="btn btn-sm" type="button">n = ' + n + "</button>");
        b.addEventListener("click", function () { excite(n); });
        exRow.appendChild(b);
      })(k);
    }
    var ionBtn = K.h('<button class="btn btn-sm" type="button">Ionise</button>');
    ionBtn.addEventListener("click", function () { ionise(); });
    exRow.appendChild(ionBtn);
    P.controls.appendChild(exRow);
    P.controls.appendChild(K.h('<p class="control-hint">' + K.md("Or click a level on the energy diagram, or an orbit. Click above $n = \\infty$ to ionise.") + "</p>"));
    P.controls.appendChild(K.h("<h3>On the way down</h3>"));
    var waySeg = K.seg([{ label: "Straight to n = 1", value: "direct" }, { label: "One level at a time", value: "step" }, { label: "Random", value: "random" }], way,
      function (v) { way = v; }, "Way down");
    P.controls.appendChild(waySeg);
    P.controls.appendChild(K.h("<h3>Show</h3>"));
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("All possible lines", true, function (v) { show.all = v; }));
    row.appendChild(K.check("Series limits", true, function (v) { show.limits = v; }));
    P.controls.appendChild(row);
    var clr = K.h('<button class="btn btn-sm" type="button">Clear the spectrum</button>');
    clr.addEventListener("click", function () { st.seen = {}; st.photons = []; st.arrows = []; renderAll(true); });
    P.controls.appendChild(clr);
    P.controls.appendChild(K.h('<div class="legend">' +
      '<span class="c-grav"><i></i>Lyman (→ 1)</span><span class="c-vel"><i></i>Balmer (→ 2)</span><span class="c-fric"><i></i>Paschen (→ 3)</span>' +
      '<span style="color:' + th.muted + '"><i></i>Brackett, Pfund</span><span class="c-app"><i></i>electron energy</span></div>'));
    function seriesColor(n1) { return n1 === 1 ? th.grav : n1 === 2 ? th.vel : n1 === 3 ? th.fric : th.muted; }

    /* ---------- the atom's state ---------- */
    var st, rng, seed = 1;
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      st = { n: 1, ang: -Math.PI / 2, rAnim: null, wait: 0, absorb: null, ionised: false, ionE: null, freeR: 0, idle: 0,
        photons: [], arrows: [], seen: {}, last: null, absorbed: null, top: 1, rec: [[0, En(1, Z)]], runs: 0 };
      P.time.textContent = "t = 0.00 s";
      theory(); renderAll(true);
    }
    function nowE() { return st.ionised ? 0 : En(st.n, Z); }
    function logE(t) { var last = st.rec[st.rec.length - 1]; st.rec.push([t, last[1]]); st.rec.push([t, nowE()]); }

    // absorb a photon that lifts the electron to level n (it arrives over ABSORB s, then the electron jumps)
    function excite(n) {
      if (st.ionised) { st.ionised = false; st.n = 1; st.freeR = 0; logE(sim.time); }
      if (st.absorb) return;
      if (n === st.n) { K.flash(P.note, "Already in n = " + n); return; }
      if (n < st.n) { drop(n); sim.play(); transportUI.render(); return; }    // clicking a lower level forces that jump
      nPick = n;
      var dE = En(n, Z) - En(st.n, Z);
      st.absorb = { t0: sim.time, from: st.n, to: n, dE: dE };
      st.absorbed = { from: st.n, to: n, dE: dE, lam: HC / dE };
      rng = mulberry(seed++);                         // a fresh but reproducible cascade every time
      st.runs++;
      sim.play(); transportUI.render(); renderAll(true);
    }
    function ionise() {
      if (st.ionised || st.absorb) return;
      var e = -En(st.n, Z);
      st.ionE = { from: st.n, E: e, Z: Z };
      st.absorbed = { from: st.n, to: Infinity, dE: e, lam: HC / e };
      st.ionised = true; st.freeR = rDraw(st.n); st.wait = 0;
      logE(sim.time);
      K.flash(P.note, "Ionised from n = " + st.ionE.from + ": it took " + K.fmt(e, 2) + " eV");
      if (Z === 2 && st.ionE.from === 1) tries.mark("ionise");
      sim.play(); transportUI.render(); renderAll(true);
    }
    // fall from the current level to n1 and send out one photon
    function drop(n1) {
      var n2 = st.n, ph = { n2: n2, n1: n1, Z: Z, lam: lamFromEnergy(n2, n1, Z), lamR: lamRydberg(n2, n1, Z), dE: En(n2, Z) - En(n1, Z), t0: sim.time, ang: st.ang };
      st.photons.push(ph);
      st.arrows.push(ph); if (st.arrows.length > 10) st.arrows.shift();
      st.last = ph; st.seen[n2 + "-" + n1] = ph;
      st.rAnim = { from: rDraw(n2), t0: sim.time };
      st.n = n1; st.wait = 0;
      logE(sim.time);
      K.flash(P.note, n2 + " → " + n1 + ": " + sig3(ph.lam) + " nm (" + (SERIES[n1] || "") + ")");
      checkTries(ph);
      renderMaths();
    }
    function nextLevel() {
      if (way === "direct") return 1;
      if (way === "step") return st.n - 1;
      return 1 + Math.floor(rng() * (st.n - 1));
    }
    function checkTries(ph) {
      if (ph.lam >= 380 && ph.lam <= 750) tries.mark("visible");
      if (ph.Z > 1 && ph.n1 % ph.Z === 0 && ph.n2 % ph.Z === 0) tries.mark("twin");
      if (seenAll(4)) tries.mark("alllines");
    }
    function seenAll(N) {
      for (var a = 2; a <= N; a++) for (var b = 1; b < a; b++) if (!st.seen[a + "-" + b]) return false;
      return true;
    }
    function seenCount(N) {
      var c = 0;
      for (var a = 2; a <= N; a++) for (var b = 1; b < a; b++) if (st.seen[a + "-" + b]) c++;
      return c;
    }

    sim.on("before", function () {
      var t = sim.time;
      st.ang += (st.ionised ? 0 : 4 / (st.n * st.n)) * K.DT;
      if (st.absorb) {
        if (t - st.absorb.t0 >= ABSORB - 1e-9) {
          st.rAnim = { from: rDraw(st.n), t0: t };
          st.n = st.absorb.to; st.top = Math.max(st.top, st.n); st.absorb = null; st.wait = 0;
          logE(t); renderMaths();
        }
      } else if (st.ionised) {
        st.freeR += 160 * K.DT;
      } else if (st.n > 1) {
        st.wait += K.DT;
        if (st.wait >= DWELL - 1e-9) drop(nextLevel());
      }
      st.photons = st.photons.filter(function (p) { return t - p.t0 < LIFE; });
      // back in the ground state (or long gone) with nothing in flight: stop the clock
      var settled = !st.absorb && (st.n === 1 || st.ionised) && !st.photons.length;
      st.idle = settled ? st.idle + K.DT : 0;
      if (st.idle > (st.ionised ? 1.5 : 0.4)) { sim.pause(); transportUI.render(); }
    });
    sim.on("step", function () { renderAll(false); });

    /* ---------- direct manipulation ---------- */
    function hit(pt) {
      var x = pt.px, y = pt.py;
      if (x >= LV.x0 - 40 && x <= LV.x1 + 60) {
        if (y < LV.top - 2 && y > LV.top - 34) return "ion";
        for (var n = 1; n <= NMAX; n++) if (Math.abs(y - yLevel(n)) <= Math.min(7, (yLevel(n) - yLevel(n + 1)) / 2)) return n;
      }
      var d = Math.hypot(x - AT.x, y - AT.y);
      for (var m = 1; m <= NMAX; m++) if (Math.abs(d - rDraw(m)) <= 6) return m;
      return null;
    }
    var hover = null;
    sim.pointer({
      down: function (pt) {
        var hgt = hit(pt);
        if (hgt == null) return false;
        if (hgt === "ion") ionise(); else excite(hgt);
        return false;
      },
      hover: function (pt) { hover = hit(pt); P.canvas.style.cursor = hover != null ? "pointer" : ""; }
    });

    /* ---------- drawing ---------- */
    sim.on("under", function (ctx) {
      var t = sim.time;
      // orbits
      for (var n = 1; n <= NMAX; n++) {
        ctx.strokeStyle = hover === n ? th.app : n === st.n && !st.ionised ? th.ink : th["grid-strong"];
        ctx.lineWidth = hover === n || (n === st.n && !st.ionised) ? 2 : 1.2;
        ctx.setLineDash(n === st.n ? [] : [3, 4]);
        ctx.beginPath(); ctx.arc(AT.x, AT.y, rDraw(n), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]);
      [1, 2, 3, 4, 5, 6].forEach(function (n) {
        K.label(ctx, "n=" + n, AT.x + rDraw(n) * 0.71 + 4, AT.y + rDraw(n) * 0.71 + 14, th.muted, { font: "600 10px 'JetBrains Mono', monospace", align: "left" });
      });
      // nucleus: Z protons
      ctx.fillStyle = th.fric;
      for (var i = 0; i < Z; i++) {
        var a = i * 2 * Math.PI / Z;
        ctx.beginPath(); ctx.arc(AT.x + (Z > 1 ? 3.5 * Math.cos(a) : 0), AT.y + (Z > 1 ? 3.5 * Math.sin(a) : 0), 4.5, 0, Math.PI * 2); ctx.fill();
      }
      K.label(ctx, "+" + Z + "e", AT.x, AT.y - 9, th.fric, { font: "700 11px 'JetBrains Mono', monospace" });
      K.label(ctx, "drawn ∝ n², true r₁ = " + K.fmt(rn(1, Z), 3) + " Å", 12, 22, th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });

      // photons flying out of the atom
      st.photons.forEach(function (p) {
        var age = t - p.t0, r0 = rDraw(p.n1) + 10, r = r0 + 200 * age;
        drawWave(ctx, AT.x + Math.cos(p.ang) * r, AT.y + Math.sin(p.ang) * r, p.ang, p.lam, Math.max(0, 1 - age / LIFE), seriesColor(p.n1));
      });
      // an incoming photon on its way to be absorbed
      if (st.absorb) {
        var f = (t - st.absorb.t0) / ABSORB, ex = AT.x + Math.cos(st.ang) * rDraw(st.n), ey = AT.y + Math.sin(st.ang) * rDraw(st.n);
        drawWave(ctx, ex - 260 * (1 - f), ey, 0, st.absorb.lam || HC / st.absorb.dE, 1, th.ink);
      }

      // energy-level diagram
      ctx.fillStyle = K.alpha(th.app, 0.07);
      ctx.fillRect(LV.x0 - 40, LV.top - 34, LV.x1 - LV.x0 + 100, 32);
      K.label(ctx, "free electron, E > 0" + (hover === "ion" ? ": click to ionise" : ""), (LV.x0 + LV.x1) / 2, LV.top - 12, hover === "ion" ? th.app : th.muted, { font: "600 11px 'JetBrains Mono', monospace" });
      for (var m = NMAX + 1; m <= 30; m++) {                   // the levels crowd towards E = 0
        ctx.strokeStyle = K.alpha(th.muted, 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(LV.x0, yLevel(m)); ctx.lineTo(LV.x1, yLevel(m)); ctx.stroke();
      }
      ctx.strokeStyle = th.ink; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(LV.x0, LV.top); ctx.lineTo(LV.x1, LV.top); ctx.stroke(); ctx.setLineDash([]);
      K.label(ctx, "n = ∞", LV.x0 - 8, LV.top + 6, th.muted, { align: "right", font: "600 11px 'JetBrains Mono', monospace" });
      K.label(ctx, "0 eV", LV.x1 + 8, LV.top + 6, th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
      for (var q = 1; q <= NMAX; q++) {
        var y = yLevel(q), on = q === st.n && !st.ionised;
        ctx.strokeStyle = hover === q ? th.app : on ? th.app : th.ink; ctx.lineWidth = on || hover === q ? 3 : 1.6;
        ctx.beginPath(); ctx.moveTo(LV.x0, y); ctx.lineTo(LV.x1, y); ctx.stroke();
        K.label(ctx, "n = " + q, LV.x0 - 8, y + 6, on ? th.app : th.ink, { align: "right", font: "700 11px 'JetBrains Mono', monospace" });
        K.label(ctx, K.fmt(En(q, Z), 2) + " eV", LV.x1 + 8, y + 6, on ? th.app : th.muted, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
      }
      K.label(ctx, "spacing ∝ 1/n (not to scale in E)", LV.x0 - 40, LV.bot + 22, th.muted, { align: "left", font: "500 10px 'JetBrains Mono', monospace" });
      // recent jumps as arrows: down = emitted, up (dashed) = absorbed
      st.arrows.forEach(function (p, i) {
        var x = LV.x0 + 24 + i * 32;
        K.arrow(ctx, x, yLevel(p.n2), x, yLevel(p.n1), seriesColor(p.n1), { width: 2.5, head: 8 });
        if (i === st.arrows.length - 1) K.label(ctx, sig3(p.lam) + " nm", x + 6, (yLevel(p.n2) + yLevel(p.n1)) / 2 + 6, seriesColor(p.n1), { align: "left", bg: true });
      });
      if (st.absorb) {
        var xa = LV.x1 - 20;
        K.arrow(ctx, xa, yLevel(st.absorb.from), xa, yLevel(st.absorb.to), th.ink, { width: 2, dash: [4, 3], label: "+" + K.fmt(st.absorb.dE, 2) + " eV", lx: -100 });
      }

      drawSpectrum(ctx);
    });
    sim.on("over", function (ctx) {
      // the electron: on its orbit, gliding between orbits, or flying free
      var t = sim.time, r = rDraw(st.n);
      if (st.rAnim && t - st.rAnim.t0 < 0.25) { var f = (t - st.rAnim.t0) / 0.25; r = st.rAnim.from + (r - st.rAnim.from) * (1 - Math.pow(1 - f, 2)); }
      if (st.ionised) r = st.freeR;
      var ex = AT.x + Math.cos(st.ang) * r, ey = AT.y + Math.sin(st.ang) * r;
      if (ex > -20 && ex < W + 20 && ey > -20 && ey < H) {
        ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill();
        K.label(ctx, "e⁻", ex, ey - 9, th.app, { font: "700 11px 'JetBrains Mono', monospace" });
      }
      // the electron on the level diagram
      if (!st.ionised) {
        ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(LV.x1 - 50, yLevel(st.n), 6, 0, Math.PI * 2); ctx.fill();
      }
    });
    function drawWave(ctx, x, y, ang, lam, alpha, fallback) {
      var col = visColor(lam) || fallback, per = 4 + 3 * Math.log(Math.max(lam, 5) / 5), len = 46;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
      for (var s = -len / 2; s <= len / 2; s += 1) {
        var env = Math.cos(Math.PI * s / len), yy = 6 * env * Math.sin(2 * Math.PI * s / per);
        if (s === -len / 2) ctx.moveTo(s, yy); else ctx.lineTo(s, yy);
      }
      ctx.stroke(); ctx.restore();
    }
    // spectrum strip, linear in 1/λ (photon energy): series limits are hard edges where lines pile up
    function kMax() { return RYD * Z * Z * 1.06; }
    function xOfK(kv) { return SP.x0 + (SP.x1 - SP.x0) * kv / kMax(); }
    function drawSpectrum(ctx) {
      ctx.fillStyle = th["canvas-bg"]; ctx.fillRect(SP.x0, SP.y0, SP.x1 - SP.x0, SP.y1 - SP.y0);
      // the visible band
      for (var l = 380; l < 750; l += 4) {
        var xa = xOfK(1000 / (l + 4)), xb = xOfK(1000 / l);
        ctx.fillStyle = K.alpha(rgbHex(visColor(l + 2)), 0.28); ctx.fillRect(xa, SP.y0, xb - xa + 0.6, SP.y1 - SP.y0);
      }
      ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.strokeRect(SP.x0, SP.y0, SP.x1 - SP.x0, SP.y1 - SP.y0);
      if (show.all) {
        for (var a = 2; a <= NMAX; a++) for (var b = 1; b < a; b++) {
          var xk = xOfK(1000 / lamRydberg(a, b, Z));
          ctx.strokeStyle = K.alpha(th.muted, 0.45); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(xk, SP.y1 - 10); ctx.lineTo(xk, SP.y1); ctx.stroke();
        }
      }
      if (show.limits) {
        [1, 2, 3].forEach(function (n1) {
          var kl = RYD * Z * Z / (n1 * n1), xl = xOfK(kl);
          ctx.strokeStyle = seriesColor(n1); ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(xl, SP.y0 - 14); ctx.lineTo(xl, SP.y1); ctx.stroke(); ctx.setLineDash([]);
          K.label(ctx, SERIES[n1] + " limit " + sig3(1000 / kl) + " nm", xl - 3, SP.y0 - 3, seriesColor(n1), { align: "right", font: "600 10px 'JetBrains Mono', monospace" });
        });
      }
      Object.keys(st.seen).forEach(function (key) {
        var p = st.seen[key], x = xOfK(1000 / p.lam), fresh = st.last === p && sim.time - p.t0 < 0.6;
        ctx.strokeStyle = visColor(p.lam) || seriesColor(p.n1); ctx.lineWidth = fresh ? 4 : 2.5;
        ctx.beginPath(); ctx.moveTo(x, SP.y0 + 1); ctx.lineTo(x, SP.y1 - 1); ctx.stroke();
      });
      K.label(ctx, "1/λ →  (higher photon energy)", SP.x1, SP.y1 + 16, th.muted, { align: "right", font: "600 10px 'JetBrains Mono', monospace" });
      K.label(ctx, "spectrum: lines seen " + Object.keys(st.seen).length, SP.x0, SP.y1 + 16, th.ink, { align: "left", font: "600 10px 'JetBrains Mono', monospace" });
    }
    function rgbHex(c) {
      var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c);
      return "#" + [1, 2, 3].map(function (i) { var s = (+m[i]).toString(16); return s.length < 2 ? "0" + s : s; }).join("");
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">E–t</b> · the electron\'s energy: each step down is one photon, grey lines are the allowed $E_n$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">1/λ vs (1/n₁² − 1/n₂²)</b> · dots are your photons (from ΔE = hc/λ), dashed line has slope $RZ^2$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">rₙ vs n</b> · radius grows as $n^2$: dots are the orbits, ring is the electron</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gE = new K.Graph(cv[0], { yLabel: "E (eV)", xMax: 4, xAuto: true, yMax: 0, color: th.app });
    var gK = new K.Graph(cv[1], { yLabel: "1/λ (μm⁻¹)", xLabel: "1/n₁² − 1/n₂²", xMax: 1, yMin: 0, color: th.vel });
    var gr = new K.Graph(cv[2], { yLabel: "r (Å)", xLabel: "n", xMax: 7, yMin: 0, color: th.disp });

    function theory() {
      gK.set("theory", { points: [[0, 0], [1, RYD * Z * Z]], color: th.vel, dash: [5, 5], width: 1.5 });
      var rp = [];
      for (var x = 0; x <= 6.6; x += 0.1) rp.push([x, rn(x, Z)]);
      gr.set("theory", { points: rp, color: th.disp, dash: [5, 5], width: 1.5 });
    }
    function renderGraphs() {
      var pts = st.rec.concat([[sim.time, nowE()]]), tEnd = Math.max(4, sim.time);
      for (var n = 1; n <= NMAX; n++) gE.set("lvl" + n, { points: [[0, En(n, Z)], [tEnd, En(n, Z)]], color: K.alpha(th.muted, 0.5), dash: [4, 4], width: 1 });
      gE.set("sim", { points: pts, color: th.app, width: 2.5, dot: true });
      var phs = Object.keys(st.seen).map(function (k) { return st.seen[k]; });
      gK.extra = function (ctx, X, Y) {
        phs.forEach(function (p) {
          ctx.fillStyle = seriesColor(p.n1);
          ctx.beginPath(); ctx.arc(X(1 / (p.n1 * p.n1) - 1 / (p.n2 * p.n2)), Y(1000 / p.lam), 4.5, 0, Math.PI * 2); ctx.fill();
        });
      };
      gr.extra = function (ctx, X, Y) {
        ctx.fillStyle = th.disp;
        for (var n = 1; n <= NMAX; n++) { ctx.beginPath(); ctx.arc(X(n), Y(rn(n, Z)), 4, 0, Math.PI * 2); ctx.fill(); }
        if (!st.ionised) { ctx.strokeStyle = th.app; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(st.n), Y(rn(st.n, Z)), 7.5, 0, Math.PI * 2); ctx.stroke(); }
      };
      [gE, gK, gr].forEach(function (g) { g.dirty = true; g.draw(); });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Orbit radius", "Energy of level n", "Rydberg formula (last photon)", "Possible lines from the top level"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "n", label: "level n", cls: "c-app" }, { id: "E", label: "energy Eₙ", cls: "c-app" }, { id: "r", label: "radius rₙ", cls: "c-disp" },
      { id: "v", label: "speed vₙ", cls: "c-vel" }, { id: "kp", label: "KE · PE", cls: "c-app" }, { id: "ion", label: "ionisation energy" },
      { id: "in", label: "photon absorbed" }, { id: "out", label: "last photon emitted", cls: "c-vel" }, { id: "lines", label: "lines seen" }
    ]);
    var slowMaths = K.throttle(renderMaths, 100);
    function renderAll(force) { renderGraphs(); if (force) renderMaths(); else slowMaths(); }

    function renderMaths() {
      var n = st.n, E = En(n, Z), p = st.last, top = Math.max(st.top, 2);
      K.tex(eqEls[0], "r_n = 0.529\\,\\frac{n^2}{Z}\\ \\text{Å} = 0.529\\,\\frac{(" + n + ")^2}{" + Z + "} = \\mathbf{" + K.fmt(rn(n, Z), 3) + "}\\ \\text{Å}");
      K.tex(eqEls[1], "E_n = -13.6\\,\\frac{Z^2}{n^2}\\ \\text{eV} = -13.6\\,\\frac{(" + Z + ")^2}{(" + n + ")^2} = \\mathbf{" + K.fmt(E, 2) + "}\\ \\text{eV}");
      if (p) {
        var br = 1 / (p.n1 * p.n1) - 1 / (p.n2 * p.n2);
        K.tex(eqEls[2], "\\frac{1}{\\lambda} = RZ^2\\left(\\frac{1}{" + p.n1 + "^2} - \\frac{1}{" + p.n2 + "^2}\\right) = (1.097 \\times 10^7)(" + p.Z + ")^2(" + K.fmt(br, 4) +
          ")\\ \\Rightarrow\\ \\lambda = \\mathbf{" + sig3(p.lamR) + "}\\ \\text{nm}");
      } else K.tex(eqEls[2], "\\frac{1}{\\lambda} = RZ^2\\left(\\frac{1}{n_1^2} - \\frac{1}{n_2^2}\\right),\\quad R = 1.097 \\times 10^7\\ \\text{m}^{-1}");
      K.tex(eqEls[3], "N = \\frac{n(n-1)}{2} = \\frac{" + top + "(" + (top - 1) + ")}{2} = \\mathbf{" + (top * (top - 1) / 2) + "}\\ \\text{lines}");
      setR("n", st.ionised ? "free" : String(n), st.ionised ? "ionised" : n === 1 ? "ground state" : "excited");
      setR("E", st.ionised ? "0 eV" : K.fmt(E, 2) + " eV", "−13.6 Z²/n²");
      setR("r", st.ionised ? "—" : K.fmt(rn(n, Z), 3) + " Å", "0.529 n²/Z");
      setR("v", st.ionised ? "—" : K.fmt(vn(n, Z) / 1e6, 2) + " × 10⁶ m/s", "2.19 × 10⁶ Z/n");
      setR("kp", st.ionised ? "—" : K.fmt(-E, 2) + " · " + K.fmt(2 * E, 2) + " eV", "KE = −E, PE = 2E");
      setR("ion", st.ionE ? K.fmt(st.ionE.E, 2) + " eV" : K.fmt(-E, 2) + " eV", st.ionE ? "used, from n = " + st.ionE.from : "from here; from n = 1: " + K.fmt(E0 * Z * Z, 1) + " eV");
      var a = st.absorbed;
      setR("in", a ? K.fmt(a.dE, 2) + " eV" : "—", a ? (a.to === Infinity ? a.from + " → ∞" : a.from + " → " + a.to) + " · λ = " + sig3(a.lam) + " nm" : "");
      setR("out", p ? sig3(p.lam) + " nm" : "—", p ? p.n2 + " → " + p.n1 + " " + SERIES[p.n1] + " · from ΔE = " + K.fmt(p.dE, 2) + " eV; Rydberg " + sig3(p.lamR) + " nm" : "hc/ΔE");
      setR("lines", seenCount(top) + " of " + top * (top - 1) / 2, "from levels up to n = " + top);
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Bohr's rule is that the electron's angular momentum comes in whole units, $mvr = n\\frac{h}{2\\pi}$. Put that together with the Coulomb pull providing the centripetal force and everything else follows: " +
      "<b class=\"c-disp\">$r_n = 0.529\\,n^2/Z$ Å</b>, <b class=\"c-vel\">$v_n = 2.19 \\times 10^6\\,Z/n$ m/s</b> and <b class=\"c-app\">$E_n = -13.6\\,Z^2/n^2$ eV</b>. " +
      "The energy is negative because the electron is bound: you have to add $|E_n|$ to set it free.</p>" +
      "<p>An electron only changes level by swapping a photon carrying exactly the difference, $h\\nu = E_{n_2} - E_{n_1}$. That's why atoms give <b>lines</b>, not a rainbow. " +
      "Each lower level $n_1$ collects a <b>series</b>: Lyman (→ 1, ultraviolet), Balmer (→ 2, visible), Paschen (→ 3, infrared). The longest wavelength in a series is the smallest jump, $n_1 + 1 \\to n_1$; the shortest is the <b>series limit</b> $\\infty \\to n_1$, where $\\lambda = n_1^2/RZ^2$.</p>" +
      "<p>Kinetic energy is $-E$ and potential energy is $2E$. Going up a level the electron slows down and its KE falls, yet its total energy rises.</p>" +
      '<div class="trap"><b>JEE trap: one atom vs many.</b> $\\frac{n(n-1)}{2}$ counts the different lines a <i>sample</i> of atoms in level $n$ can give. A <i>single</i> atom falling from $n$ makes at most $n - 1$ photons (one level at a time). Read the question: "an electron" or "a hydrogen sample"?</div>');

    function apply(s) {
      Z = s.Z;
      zSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(Z))); });
      if (s.way) { way = s.way; waySeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === way)); }); }
      reset();
      if (s.ionise) ionise();
      else if (s.n) excite(s.n);
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "ionisation energy", setup: { Z: 3, ionise: true }, watch: "Predict, then read the ionisation energy",
        q: "What is the ionisation energy of a Li²⁺ ion in its ground state?",
        options: ["13.6 eV", "40.8 eV", "122.4 eV", "30.6 eV"], answer: 2,
        explain: "Ionisation lifts the electron from $E_1 = -13.6Z^2$ to 0, so it costs $13.6 \\times 3^2 = 122.4$ eV. 40.8 eV forgets to square $Z$; 30.6 eV is what it takes from $n = 2$." },
      { level: "medium", tag: "how many lines", setup: { Z: 1, n: 5, way: "random" }, watch: "Press Play (or n = 5) again and again until no new lines appear",
        q: "A sample of hydrogen atoms is excited to $n = 5$. How many different spectral lines can it emit, and how many of them are visible (Balmer) lines?",
        options: ["10 lines, 3 visible", "10 lines, 4 visible", "4 lines, 3 visible", "15 lines, 4 visible"], answer: 0,
        hints: ["Every pair of levels from 1 to 5 gives one line.", "Visible means the jump ends on $n = 2$ and starts above it."],
        explain: "Pairs of levels: $\\frac{5 \\times 4}{2} = 10$. The Balmer lines are 5 → 2 (434 nm), 4 → 2 (486 nm) and 3 → 2 (656 nm): 3 of them. 6 → 2 would be a fourth, but nothing is up at $n = 6$. 4 is how many photons one atom can give at most." },
      { level: "hard", tag: "absorb, then emit", setup: { Z: 2, n: 4, way: "direct" }, watch: "Read the absorbed photon, then the photon that comes out on the way straight down",
        q: "He⁺ ions in the ground state absorb photons of one energy, and afterwards emit exactly 6 different wavelengths. What energy did each absorbed photon carry, and what is the shortest wavelength emitted? ($hc = 1240$ eV·nm)",
        options: ["51.0 eV and 24.3 nm", "12.75 eV and 97.2 nm", "51.0 eV and 30.4 nm", "40.8 eV and 30.4 nm"], answer: 0,
        hints: ["6 lines means $\\frac{n(n-1)}{2} = 6$: which level?", "The shortest wavelength is the biggest jump, straight back to $n = 1$."],
        explain: "$\\frac{n(n-1)}{2} = 6$ gives $n = 4$. The photon lifts it from $E_1 = -54.4$ eV to $E_4 = -3.40$ eV: $51.0$ eV. The biggest jump down is the same 4 → 1, so $\\lambda = 1240/51.0 = 24.3$ nm. 12.75 eV and 97.2 nm are hydrogen's numbers (forgetting $Z^2$); 30.4 nm is He⁺'s 2 → 1." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { onReset: reset, onPlay: function () {
      // Play from the ground state: send in a photon to the last level you chose
      if (!st.absorb && (st.n === 1 || st.ionised)) excite(nPick);
    } });
    reset();

    if (location.hostname === "localhost") window.__lab_bohr = {
      apply: apply, excite: excite, ionise: ionise, reset: reset, sim: sim,
      setZ: function (z) { apply({ Z: z }); }, setWay: function (w) { way = w; },
      state: function () { return st; }, En: En, rn: rn, vn: vn, lamFromEnergy: lamFromEnergy, lamRydberg: lamRydberg, sig3: sig3
    };

    return function destroy() { sim.destroy(); [gE, gK, gr].forEach(function (g) { g.destroy(); }); };
  }
})();
