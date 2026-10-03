/* Kinetic theory, lab 2: the speed distribution. Start every molecule at one speed and let elastic
   collisions spread them out into the Maxwell–Boltzmann distribution, then compare 2D (the box) with 3D (the textbook). */
(function () {
  "use strict";
  var KB = 1.380649e-23, AMU = 1.66053907e-27, RGAS = 8.314;
  var BOX = 30, R_MOL = 0.2, SIG = 2 * R_MOL;        // square box side, disc radius and diameter (nm)
  var PS_PER_STEP = 0.5, WIN = 240, BINS = 40;         // gas time per step (ps), averaging window (steps), histogram bins
  var GASES = [{ label: "H₂", value: "2" }, { label: "He", value: "4" }, { label: "N₂", value: "28" }, { label: "O₂", value: "32" },
    { label: "Ar", value: "40" }, { label: "He + Ar", value: "mix" }];
  var NAMES = { 2: "H₂", 4: "He", 28: "N₂", 32: "O₂", 40: "Ar" }, DOF = { 2: 5, 4: 3, 28: 5, 32: 5, 40: 3 };
  var SQPI2 = Math.sqrt(Math.PI) / 2;                   // 2D: v_avg / v_rms

  var lab = {
    id: "speeds", chapter: "ktg", title: "Speed distribution", short: "Maxwell–Boltzmann, v_mp, v_avg, v_rms",
    lede: "Give every molecule exactly the same speed and press play. Within a few dozen collisions the speeds spread into the Maxwell–Boltzmann curve, and nothing ever tells them to.",
    tries: [
      { id: "spread", title: "Watch one speed become a distribution",
        text: "Start with every molecule at the same speed and run until the histogram settles on the dashed curve.",
        why: "In each collision one molecule usually speeds up and the other slows down, though total energy is fixed. The most likely way to share a fixed energy among many molecules is the Maxwell–Boltzmann spread. Here $v_{avg}/v_{rms}$ falls from 1 to $\\sqrt\\pi/2 = 0.886$." },
      { id: "sideways", title: "Share energy between directions",
        text: "Start every molecule moving sideways (no up-down motion at all) and run until the up-down share reaches half.",
        why: "Off-centre collisions turn sideways motion into up-down motion until each direction holds $\\tfrac12 kT$ per molecule on average. That's equipartition: every quadratic term in the energy gets the same share." },
      { id: "hotter", title: "Double the temperature",
        text: "Let one gas settle, then at least double $T$ and let it settle again.",
        why: "Every speed scales by $\\sqrt{T_2/T_1}$, so the peak moves right and, since the area stays 1, it gets lower and wider. $v_{rms}$ goes up by $\\sqrt 2$, not 2." },
      { id: "mix", title: "Mix a light gas with a heavy one",
        text: "Pick He + Ar, start them at the same speed (so each Ar carries 10× the energy), and run until their mean energies match.",
        why: "Collisions pass energy from Ar to He until both have the same mean kinetic energy, $kT$ here ($\\tfrac32 kT$ in 3D). Same energy means He ends up $\\sqrt{40/4} = 3.16$ times faster in rms speed." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 2D and 3D Maxwell–Boltzmann speed densities (per m/s) for mass m (kg) at T (K); v in m/s
  function mb2(v, m, T) { var a = m / (KB * T); return a * v * Math.exp(-0.5 * a * v * v); }
  function mb3(v, m, T) { var a = m / (KB * T); return Math.sqrt(2 / Math.PI) * Math.pow(a, 1.5) * v * v * Math.exp(-0.5 * a * v * v); }

  /* ---------- hard discs in a square box, each with its own mass. Units nm, ps, kg ---------- */
  function Gas(rnd) { this.rnd = rnd; }
  Gas.prototype.init = function (masses, T, start) {
    var rnd = this.rnd, n = masses.length, i, j, tries;
    this.n = n; this.mass = Float64Array.from(masses);
    this.x = new Float64Array(n); this.y = new Float64Array(n); this.vx = new Float64Array(n); this.vy = new Float64Array(n);
    this.ord = [];
    for (i = 0; i < n; i++) {
      for (tries = 0; tries < 400; tries++) {
        this.x[i] = rnd() * BOX; this.y[i] = rnd() * BOX;
        for (j = 0; j < i; j++) if (Math.hypot(this.x[i] - this.x[j], this.y[i] - this.y[j]) < SIG * 1.4) break;
        if (j === i) break;
      }
      this.ord.push(i);
    }
    for (i = 0; i < n; i++) {
      var a = 2 * Math.PI * rnd();
      if (start === "mb") {                            // already Maxwellian: Gaussian components, σ² = kT/m
        var s = Math.sqrt(KB * T / this.mass[i] / 1e6), r = Math.sqrt(-2 * Math.log(1 - rnd()));
        this.vx[i] = s * r * Math.cos(a); this.vy[i] = s * r * Math.sin(a);
      } else if (start === "side") { this.vx[i] = rnd() < 0.5 ? -1 : 1; this.vy[i] = 0; }
      else { this.vx[i] = Math.cos(a); this.vy[i] = Math.sin(a); }   // one speed, random directions
    }
    this.setT(T);
  };
  Gas.prototype.ke = function () {
    var e = 0;
    for (var i = 0; i < this.n; i++) e += this.mass[i] * (this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
    return 0.5 * e * 1e6;
  };
  Gas.prototype.T = function () { return this.ke() / (this.n * KB); };     // 2D: KE = NkT
  Gas.prototype.scale = function (f) { for (var i = 0; i < this.n; i++) { this.vx[i] *= f; this.vy[i] *= f; } };
  Gas.prototype.setT = function (T) { this.scale(Math.sqrt(T / this.T())); };
  Gas.prototype.setMass = function (m) {           // one gas swapped for another at the same T: v ∝ 1/√m
    for (var i = 0; i < this.n; i++) { var f = Math.sqrt(this.mass[i] / m); this.vx[i] *= f; this.vy[i] *= f; this.mass[i] = m; }
  };
  Gas.prototype.step = function (dt) {
    var v = 0;
    for (var i = 0; i < this.n; i++) v = Math.max(v, this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
    v = Math.sqrt(v) + 1e-9;
    var nsub = Math.max(1, Math.ceil(dt * v / (0.3 * SIG))), h = dt / nsub;
    for (var s = 0; s < nsub; s++) this.sub(h, 1.5 * v);
  };
  Gas.prototype.sub = function (h, vmax) {
    var n = this.n, x = this.x, y = this.y, vx = this.vx, vy = this.vy, M = this.mass, ord = this.ord;
    var a, b, i, j, k;
    for (a = 1; a < n; a++) {
      k = ord[a];
      for (b = a - 1; b >= 0 && x[ord[b]] > x[k]; b--) ord[b + 1] = ord[b];
      ord[b + 1] = k;
    }
    var reach = SIG + 2 * vmax * h;
    for (a = 0; a < n; a++) {
      i = ord[a];
      for (b = a + 1; b < n; b++) {
        j = ord[b];
        var dx = x[j] - x[i];
        if (dx > reach) break;
        var dy = y[j] - y[i];
        if (dy > reach || dy < -reach) continue;
        var dvx = vx[j] - vx[i], dvy = vy[j] - vy[i], bb = dx * dvx + dy * dvy;
        if (bb >= 0) continue;
        var cc = dx * dx + dy * dy - SIG * SIG, aa = dvx * dvx + dvy * dvy, tc = 0;
        if (cc > 0) {
          var disc = bb * bb - aa * cc;
          if (disc < 0) continue;
          tc = (-bb - Math.sqrt(disc)) / aa;
          if (tc > h) continue;
        }
        var cx = dx + dvx * tc, cy = dy + dvy * tc, d = Math.hypot(cx, cy), nx = cx / d, ny = cy / d;
        var dvn = dvx * nx + dvy * ny, mt = M[i] + M[j];
        // elastic, any masses: the impulse along the line of centres conserves energy and momentum exactly
        var fi = 2 * M[j] / mt * dvn, fj = 2 * M[i] / mt * dvn;
        vx[i] += fi * nx; vy[i] += fi * ny; vx[j] -= fj * nx; vy[j] -= fj * ny;
        x[i] -= fi * nx * tc; y[i] -= fi * ny * tc; x[j] += fj * nx * tc; y[j] += fj * ny * tc;
      }
    }
    for (i = 0; i < n; i++) {
      x[i] += vx[i] * h; y[i] += vy[i] * h;
      if (x[i] < 0) { x[i] = -x[i]; if (vx[i] < 0) vx[i] = -vx[i]; }
      if (x[i] > BOX) { x[i] = 2 * BOX - x[i]; if (vx[i] > 0) vx[i] = -vx[i]; }
      if (y[i] < 0) { y[i] = -y[i]; if (vy[i] < 0) vy[i] = -vy[i]; }
      if (y[i] > BOX) { y[i] = 2 * BOX - y[i]; if (vy[i] > 0) vy[i] = -vy[i]; }
    }
  };

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 15, origin = { x: 40, y: 490 };
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: origin, g: 0, grid: false });
    var seed = 1, gas = new Gas(rng(seed));
    var SP = [th.vel, th.grav];                       // colours for species 0 and 1 in a mixture

    /* ---------- controls ---------- */
    var gasKey = "28", start = "one", turbo = false;
    var nS = K.slider({ label: "Molecules $N$", min: 60, max: 300, step: 20, value: 200, onInput: rebuild });
    var tS = K.slider({ label: "Temperature $T$", unit: "K", min: 100, max: 1500, step: 10, value: 300, onInput: function (v) { gas.setT(v); changed(); },
      hint: "Heating scales every speed by $\\sqrt{T_{new}/T_{old}}$: the shape stays, the scale stretches." });
    P.controls.innerHTML = "<h3>Gas</h3>";
    var gasSeg = K.seg(GASES, gasKey, function (v) {
      var wasMix = gasKey === "mix"; gasKey = v;
      if (v === "mix" || wasMix) rebuild(); else { gas.setMass(+v * AMU); changed(); }
    }, "Gas");
    P.controls.appendChild(gasSeg);
    [nS, tS].forEach(function (s) { P.controls.appendChild(s.el); });
    P.controls.appendChild(K.h("<h3>Start</h3>"));
    var startSeg = K.seg([{ label: "All one speed", value: "one" }, { label: "All sideways", value: "side" }, { label: "Already Maxwellian", value: "mb" }], start,
      function (v) { start = v; rebuild(); }, "Start");
    P.controls.appendChild(startSeg);
    var row = K.h('<div class="row"></div>');
    row.appendChild(K.check("Fast-forward ×10", false, function (v) { turbo = v; }));
    P.controls.appendChild(row);
    var legend = K.h('<div class="legend"></div>');
    P.controls.appendChild(legend);
    P.controls.appendChild(K.h('<p class="control-hint">Tap a molecule to see where it sits in the histogram.</p>'));
    function setLegend() {
      legend.innerHTML = gasKey === "mix"
        ? '<span class="c-vel"><i></i>He</span><span class="c-grav"><i></i>Ar</span><span class="c-acc"><i></i>3D textbook</span>'
        : '<span style="color:' + th.disp + '"><i></i>slow</span><span style="color:' + th.fric + '"><i></i>fast</span><span class="c-vel"><i></i>speeds (2D box)</span><span class="c-acc"><i></i>3D textbook</span>';
    }
    function setSeg(el, v) { el.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(v))); }); }

    /* ---------- state + rolling window ---------- */
    var gasT = 0, win, sinceChange = 0, eqTrace, picked = -1, records = [], vScale;
    function molars() { return gasKey === "mix" ? [4, 40] : [+gasKey]; }
    function species(i) { return gasKey === "mix" ? (i % 2) : 0; }
    function rebuild() {
      sim.pause(); if (transportUI) transportUI.render();
      gas = new Gas(rng(seed++));
      var n = nS.get(), ms = [], mm = molars();
      for (var i = 0; i < n; i++) ms.push(mm[i % mm.length] * AMU);
      gas.init(ms, tS.get(), start);
      gasT = 0; picked = -1; records = [];
      eqTrace = { t: [], a: [], b: [] };
      setLegend(); changed(true);
    }
    function changed(fromRebuild) {
      // the histogram range follows the lightest gas: 0 to 4 v_mp(2D)
      vScale = 4 * Math.sqrt(KB * tS.get() / (molars()[0] * AMU));
      win = []; sinceChange = 0;
      if (!fromRebuild) eqTrace = { t: [], a: [], b: [] };
      if (gasKey !== "mix") tS.set(Math.round(gas.T() / 10) * 10);
      update(true);
    }
    // one step's statistics, per species: histogram counts, Σv, Σv², KE_x, KE_y
    function sample() {
      var ns = molars().length, s = [], i, k;
      for (k = 0; k < ns; k++) s.push({ h: new Float64Array(BINS), n: 0, v: 0, v2: 0, kx: 0, ky: 0 });
      for (i = 0; i < gas.n; i++) {
        var q = s[species(i)], v = Math.hypot(gas.vx[i], gas.vy[i]) * 1000, m = gas.mass[i];
        var b = Math.floor(v / vScale * BINS);
        if (b < BINS) q.h[b]++;
        q.n++; q.v += v; q.v2 += v * v;
        q.kx += 0.5 * m * gas.vx[i] * gas.vx[i] * 1e6; q.ky += 0.5 * m * gas.vy[i] * gas.vy[i] * 1e6;
      }
      return s;
    }
    // averages over the window: per species density (per m/s), v_avg, v_rms, v_mp (histogram peak), mean KE_x, KE_y
    function stats() {
      var ns = molars().length, out = [], k, j, b, T = gas.T(), bw = vScale / BINS;
      for (k = 0; k < ns; k++) {
        var h = new Float64Array(BINS), n = 0, v = 0, v2 = 0, kx = 0, ky = 0;
        for (j = 0; j < win.length; j++) {
          var q = win[j][k];
          for (b = 0; b < BINS; b++) h[b] += q.h[b];
          n += q.n; v += q.v; v2 += q.v2; kx += q.kx; ky += q.ky;
        }
        var dens = Array.prototype.map.call(h, function (c) { return n ? c / (n * bw) : 0; });
        out.push({ dens: dens, n: n, avg: v / n, rms: Math.sqrt(v2 / n), kx: kx / n / (KB * T), ky: ky / n / (KB * T), mp: peak(dens, bw), m: molars()[k] * AMU });
      }
      return out;
    }
    // most probable speed, without assuming the answer: fit ln f = c0 + c1 ln v + c2 v² to the histogram
    // (weighted by counts; this family holds both the 2D and the 3D curve), then its peak is at v = √(−c1/2c2)
    function peak(d, bw) {
      var top = Math.max.apply(null, d), A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Y = [0, 0, 0], i, j, k;
      for (i = 0; i < d.length; i++) {
        if (!(d[i] > 0.05 * top)) continue;
        var u = i + 0.5, x = [1, Math.log(u), u * u / 100], y = Math.log(d[i]), w = d[i];
        for (j = 0; j < 3; j++) { Y[j] += w * x[j] * y; for (k = 0; k < 3; k++) A[j][k] += w * x[j] * x[k]; }
      }
      function det(M) { return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]); }
      function col(c) { return A.map(function (r, j2) { var q = r.slice(); q[c] = Y[j2]; return q; }); }
      var D = det(A), c1 = det(col(1)) / D, c2 = det(col(2)) / D / 100;
      return c1 > 0 && c2 < 0 ? Math.sqrt(-c1 / (2 * c2)) * bw : NaN;
    }

    sim.on("before", function () {
      var dt = PS_PER_STEP * (turbo ? 10 : 1);
      gas.step(dt);
      gasT += dt; sinceChange++;
      win.push(sample()); if (win.length > WIN) win.shift();
      if (sim.steps % 2 === 0) {
        var s = win[win.length - 1], T = gas.T();
        eqTrace.t.push(gasT);
        if (gasKey === "mix") { eqTrace.a.push((s[0].kx + s[0].ky) / s[0].n / (KB * T)); eqTrace.b.push((s[1].kx + s[1].ky) / s[1].n / (KB * T)); }
        else { eqTrace.a.push(s[0].kx / s[0].n / (KB * T)); eqTrace.b.push(s[0].ky / s[0].n / (KB * T)); }
        if (eqTrace.t.length > 1500) { eqTrace.t.shift(); eqTrace.a.shift(); eqTrace.b.shift(); }
      }
    });
    sim.on("step", function () { checkTries(); update(false); });

    function settled() { return sinceChange >= WIN && win.length >= WIN; }
    function checkTries() {
      if (!settled()) return;
      var st = stats(), s = st[0];
      if (gasKey !== "mix") {
        if (start !== "mb" && gasT <= 2000 && Math.abs(s.avg / s.rms - SQPI2) < 0.006) tries.mark("spread");
        if (start === "side" && Math.abs(s.ky - 0.5) < 0.03) tries.mark("sideways");
        var rec = { gas: gasKey, T: gas.T(), rms: s.rms };
        records.forEach(function (r) {
          if (r.gas === rec.gas && Math.max(r.T, rec.T) / Math.min(r.T, rec.T) >= 1.99 && Math.abs(rec.rms / r.rms - Math.sqrt(rec.T / r.T)) < 0.02 * Math.sqrt(rec.T / r.T)) tries.mark("hotter");
        });
        if (!records.some(function (r) { return r.gas === rec.gas && Math.abs(r.T - rec.T) < 1; })) records.push(rec);
      } else {
        var ka = st[0].kx + st[0].ky, kb = st[1].kx + st[1].ky;
        if (start !== "mb" && Math.abs(ka - kb) / kb < 0.05) tries.mark("mix");
      }
    }

    /* ---------- direct manipulation: tap a molecule ---------- */
    sim.pointer({
      down: function (pt) {
        var best = -1, bd = 1;
        for (var i = 0; i < gas.n; i++) { var d = Math.hypot(gas.x[i] - pt.m.x, gas.y[i] - pt.m.y); if (d < bd) { bd = d; best = i; } }
        picked = best === picked ? -1 : best;
        return false;
      }
    });

    /* ---------- drawing ---------- */
    function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    function mix(a, b, t) { var p = hex(a), q = hex(b); if (!p || !q) return a; return "rgb(" + p.map(function (v, i) { return Math.round(v + (q[i] - v) * t); }).join(",") + ")"; }
    var HX = { x0: 540, x1: 975, y0: 440, y1: 70 };     // on-stage histogram frame (world px)
    sim.on("under", function (ctx) {
      var b0 = sim.px(-R_MOL, -R_MOL), b1 = sim.px(BOX + R_MOL, BOX + R_MOL), wall = sim.u(5);
      ctx.fillStyle = th.surface; ctx.fillRect(b0.x, b1.y, b1.x - b0.x, b0.y - b1.y);
      ctx.strokeStyle = th.body; ctx.lineWidth = wall; ctx.strokeRect(b0.x - wall / 2, b1.y - wall / 2, b1.x - b0.x + wall, b0.y - b1.y + wall);
      K.label(ctx, BOX + " nm × " + BOX + " nm box, walls perfectly elastic", (b0.x + b1.x) / 2, b0.y + sim.u(24), th.muted, { s: sim.u(1), font: "600 11px 'JetBrains Mono', monospace" });
      drawHist(ctx);
    });
    sim.on("over", function (ctx) {
      var T = gas.T(), r = R_MOL * ppm, mix2 = gasKey === "mix";
      for (var i = 0; i < gas.n; i++) {
        var p = sim.px(gas.x[i], gas.y[i]), sp = species(i), vr = Math.sqrt(2 * KB * T / gas.mass[i] / 1e6);
        ctx.fillStyle = mix2 ? SP[sp] : mix(th.disp, th.fric, K.clamp(Math.hypot(gas.vx[i], gas.vy[i]) / (2 * vr), 0, 1));
        ctx.beginPath(); ctx.arc(p.x, p.y, i === picked ? r * 1.8 : r, 0, Math.PI * 2); ctx.fill();
      }
      if (picked >= 0) {
        var pp = sim.px(gas.x[picked], gas.y[picked]), k = 25;
        ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(1.5); ctx.beginPath(); ctx.arc(pp.x, pp.y, r * 3, 0, Math.PI * 2); ctx.stroke();
        K.arrow(ctx, pp.x, pp.y, pp.x + gas.vx[picked] * k, pp.y - gas.vy[picked] * k, th.ink, { s: sim.u(1) });
      }
    });
    // what every molecule is doing right now, as a histogram (one frame, so it's noisy)
    function drawHist(ctx) {
      var ns = molars().length, T = gas.T(), bw = vScale / BINS, f = HX, now = sample(), i, k;
      var yMax = 0;
      for (k = 0; k < ns; k++) yMax = Math.max(yMax, mb2(Math.sqrt(KB * T / (molars()[k] * AMU)), molars()[k] * AMU, T));
      for (k = 0; k < ns; k++) for (i = 0; i < BINS; i++) yMax = Math.max(yMax, Math.min(now[k].h[i] / (now[k].n * bw), 3 * yMax));
      yMax *= 1.1;
      var X = function (v) { return f.x0 + (f.x1 - f.x0) * v / vScale; }, Y = function (d) { return f.y0 - (f.y0 - f.y1) * Math.min(d / yMax, 1.05); };
      ctx.fillStyle = th.surface; ctx.fillRect(f.x0 - 10, f.y1 - 30, f.x1 - f.x0 + 20, f.y0 - f.y1 + 64);
      for (k = 0; k < ns; k++) {
        ctx.fillStyle = K.alpha(ns > 1 ? SP[k] : th.vel, ns > 1 ? 0.5 : 0.65);
        for (i = 0; i < BINS; i++) { var d = now[k].h[i] / (now[k].n * bw); if (d > 0) ctx.fillRect(X(i * bw) + 1, Y(d), (f.x1 - f.x0) / BINS - 2, f.y0 - Y(d)); }
        ctx.strokeStyle = ns > 1 ? SP[k] : th.vel; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath();
        for (i = 0; i <= 120; i++) { var v = vScale * i / 120, yy = Y(mb2(v, molars()[k] * AMU, T)); if (i) ctx.lineTo(X(v), yy); else ctx.moveTo(X(v), yy); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      // the three speeds for species 0, 2D formulas
      var m0 = molars()[0] * AMU, kt = KB * T / m0, marks = [["v_mp", Math.sqrt(kt)], ["v_avg", Math.sqrt(Math.PI * kt / 2)], ["v_rms", Math.sqrt(2 * kt)]];
      marks.forEach(function (q, j) {
        ctx.strokeStyle = K.alpha(th.ink, 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(q[1]), f.y0); ctx.lineTo(X(q[1]), f.y1 + 6 + j * 14); ctx.stroke();
        K.label(ctx, q[0], X(q[1]), f.y1 + 4 + j * 14, th.ink, { font: "600 10px 'JetBrains Mono', monospace" });
      });
      ctx.strokeStyle = th["grid-strong"]; ctx.beginPath(); ctx.moveTo(f.x0, f.y1 - 10); ctx.lineTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y0); ctx.stroke();
      ctx.fillStyle = th.muted; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      var step = vScale > 6000 ? 2000 : vScale > 3000 ? 1000 : vScale > 1200 ? 500 : 200;
      for (var vv = 0; vv <= vScale; vv += step) ctx.fillText(vv, X(vv), f.y0 + 4);
      K.label(ctx, "speed (m/s), right now · dashed: 2D Maxwell–Boltzmann at " + K.fmt(T, 0) + " K", (f.x0 + f.x1) / 2, f.y0 + 34, th.muted, { font: "600 10px 'JetBrains Mono', monospace" });
      if (picked >= 0) {
        var pv = Math.hypot(gas.vx[picked], gas.vy[picked]) * 1000;
        K.arrow(ctx, X(pv), f.y1 - 26, X(pv), f.y0 - 4, th.ink, { width: 2, label: K.fmt(pv, 0) + " m/s", lx: 4, ly: -150 });
      }
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">f(v), averaged</b> · the last 240 steps of the box (120 ps, ten times that on fast-forward) against the 2D formula (dashed). Orange: the 3D textbook curve</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">Equipartition</b> · mean KE ÷ kT: <span class="eqcap"></span></p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">3D textbook f(v)</b> · your gas at $T$ (thick) and at 300 K (thin), with $v_{mp} \lt v_{avg} \lt v_{rms}$</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var eqcap = P.graphs.querySelector(".eqcap");
    var cv = P.graphs.querySelectorAll("canvas");
    var gh = new K.Graph(cv[0], { yLabel: "f(v) (per km/s)", xLabel: "v (m/s)", xMax: 2000, yMin: 0, color: th.vel });
    var ge = new K.Graph(cv[1], { yLabel: "⟨KE⟩ / kT", xLabel: "t (ps)", xMax: 200, xAuto: true, yMin: 0, color: th.acc });
    var g3 = new K.Graph(cv[2], { yLabel: "f(v) (per km/s)", xLabel: "v (m/s)", xMax: 2000, yMin: 0, color: th.acc });

    var slowMaths = K.throttle(renderMaths, 150), slowGraphs = K.throttle(drawGraphs, 80);
    function update(force) { if (force) { drawGraphs(); renderMaths(); } else { slowGraphs(); slowMaths(); } }
    function curve(fn, m, T, vmax) { var pts = []; for (var i = 0; i <= 120; i++) { var v = vmax * i / 120; pts.push([v, fn(v, m, T) * 1000]); } return pts; }
    function drawGraphs() {
      var T = gas.T(), ms = molars(), bw = vScale / BINS, st = win.length ? stats() : null;
      gh.o.xMax = vScale; g3.o.xMax = vScale;
      gh.clear(); ge.clear(); g3.clear();
      ms.forEach(function (M, k) {
        var col = ms.length > 1 ? SP[k] : th.vel;
        gh.set("t" + k, { points: curve(mb2, M * AMU, T, vScale), color: col, dash: [5, 5], width: 1.5 });
        gh.set("t3" + k, { points: curve(mb3, M * AMU, T, vScale), color: K.alpha(th.acc, 0.7), dash: [2, 4], width: 1.5 });
        if (st) {
          var pts = [];
          st[k].dens.forEach(function (d, i) { pts.push([i * bw, d * 1000]); pts.push([(i + 1) * bw, d * 1000]); });
          gh.set("s" + k, { points: pts, color: col, width: 2.5 });
        }
        g3.set("a" + k, { points: curve(mb3, M * AMU, T, vScale), color: ms.length > 1 ? col : th.acc, dash: [5, 5], width: 2.2 });
        g3.set("r" + k, { points: curve(mb3, M * AMU, 300, vScale), color: K.alpha(ms.length > 1 ? col : th.acc, 0.45), dash: [3, 4], width: 1.2 });
      });
      g3.extra = function (ctx, X, Y) {
        var m = ms[0] * AMU, kt = KB * T / m;
        [["mp", Math.sqrt(2 * kt)], ["avg", Math.sqrt(8 * kt / Math.PI)], ["rms", Math.sqrt(3 * kt)]].forEach(function (q, j) {
          ctx.strokeStyle = th.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(q[1]), Y(0)); ctx.lineTo(X(q[1]), Y(mb3(q[1], m, T) * 1000)); ctx.stroke();
          ctx.fillStyle = th.ink; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(q[0], X(q[1]), Y(0) - 6 - j * 11);
        });
      };
      var mixed = gasKey === "mix", tEnd = eqTrace.t.length ? eqTrace.t[eqTrace.t.length - 1] : 200;
      ge.set("a", { points: eqTrace.t.map(function (t, i) { return [t, eqTrace.a[i]]; }), color: mixed ? SP[0] : th.disp, width: 2.2, dot: true });
      ge.set("b", { points: eqTrace.t.map(function (t, i) { return [t, eqTrace.b[i]]; }), color: mixed ? SP[1] : th.acc, width: 2.2, dot: true });
      ge.set("th", { points: [[eqTrace.t[0] || 0, mixed ? 1 : 0.5], [Math.max(tEnd, 200), mixed ? 1 : 0.5]], color: th.ink, dash: [5, 5], width: 1.2 });
      eqcap.innerHTML = mixed ? K.md("He (green) and Ar (purple) both head for $kT$, so $\\tfrac12 m v^2$ matches, not $v$")
        : K.md("sideways $x$ (blue) and up-down $y$ (orange) each head for $\\tfrac12 kT$");
      [gh, ge, g3].forEach(function (g) { g.dirty = true; g.draw(); });
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Maxwell–Boltzmann in the 2D box", "The three speeds, 2D: 1 : √(π/2) : √2", "The 3D textbook: 1 : √(4/π) : √(3/2)", "Equipartition: ½kT per quadratic term"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "mp", label: "v_mp (box)", cls: "c-vel" }, { id: "avg", label: "v_avg (box)", cls: "c-vel" }, { id: "rms", label: "v_rms (box)", cls: "c-vel" },
      { id: "ratio", label: "v_avg / v_rms", cls: "c-vel" }, { id: "v3", label: "3D v_rms", cls: "c-acc" }, { id: "eq", label: "equipartition", cls: "c-acc" },
      { id: "cv", label: "textbook C_v, γ", cls: "c-acc" }, { id: "T", label: "temperature", cls: "c-acc" }
    ]);
    function renderMaths() {
      var T = gas.T(), ms = molars(), M0 = ms[0], m0 = M0 * AMU, kt = KB * T / m0, name = NAMES[M0];
      var st = win.length ? stats() : null, s = st && st[0], ok = settled();
      var vmp = Math.sqrt(kt), vavg = Math.sqrt(Math.PI * kt / 2), vrms = Math.sqrt(2 * kt);
      K.tex(eqEls[0], "f(v) = \\frac{mv}{kT}e^{-mv^2/2kT},\\quad v_{mp} = \\sqrt{\\frac{kT}{m}} = \\sqrt{\\frac{(1.38\\times10^{-23})(" + K.fmt(T, 0) + ")}{" + M0 + "(1.66\\times10^{-27})}} = \\mathbf{" + K.fmt(vmp, 0) + "}\\ \\text{m/s}");
      K.tex(eqEls[1], "v_{avg} = \\sqrt{\\frac{\\pi kT}{2m}} = \\mathbf{" + K.fmt(vavg, 0) + "},\\quad v_{rms} = \\sqrt{\\frac{2kT}{m}} = \\mathbf{" + K.fmt(vrms, 0) + "}\\ \\text{m/s}");
      var v3 = function (M) { return [Math.sqrt(2 * RGAS * T / (M * 1e-3)), Math.sqrt(8 * RGAS * T / (Math.PI * M * 1e-3)), Math.sqrt(3 * RGAS * T / (M * 1e-3))]; }, a3 = v3(M0);
      K.tex(eqEls[2], "v_{rms} = \\sqrt{\\frac{3RT}{M}} = \\sqrt{\\frac{3(8.314)(" + K.fmt(T, 0) + ")}{" + M0 + "\\times10^{-3}}} = \\mathbf{" + K.fmt(a3[2], 0) + "}\\ \\text{m/s}\\;(" + name + "),\\ v_{mp} = " + K.fmt(a3[0], 0) + ",\\ v_{avg} = " + K.fmt(a3[1], 0));
      var f = DOF[M0], kinds = ms.map(function (M) { return NAMES[M] + (DOF[M] === 3 ? "\\text{: monatomic}, f = 3" : "\\text{: diatomic}, f = 5"); }).join(";\\ ");
      K.tex(eqEls[3], kinds +"\\Rightarrow C_v = \\tfrac f2 R = " + K.fmt(f / 2 * RGAS, 1) + ",\\ \\gamma = 1 + \\tfrac2f = \\mathbf{" + K.fmt(1 + 2 / f, 2) + "}.\\ \\text{The box: } f = 2,\\ \\gamma = 2");
      var tag = name + (ms.length > 1 ? " only" : "") + " · ";
      setR("mp", ok ? K.fmt(s.mp, 0) + " m/s" : "settling…", tag + "√(kT/m) = " + K.fmt(vmp, 0));
      setR("avg", s ? K.fmt(s.avg, 0) + " m/s" : "—", tag + "√(πkT/2m) = " + K.fmt(vavg, 0));
      setR("rms", s ? K.fmt(s.rms, 0) + " m/s" : "—", tag + "√(2kT/m) = " + K.fmt(vrms, 0));
      setR("ratio", s ? K.fmt(s.avg / s.rms, 3) : "—", "2D: √π/2 = 0.886 · 3D: 0.921");
      setR("v3", K.fmt(a3[2], 0) + " m/s", ms.length > 1 ? "Ar: " + K.fmt(v3(ms[1])[2], 0) + " m/s · ratio " + K.fmt(a3[2] / v3(ms[1])[2], 2) : name + ", √(3RT/M)");
      if (ms.length > 1 && st) {
        var ka = st[0].kx + st[0].ky, kb = st[1].kx + st[1].ky;
        setR("eq", "He " + K.fmt(ka, 2) + " · Ar " + K.fmt(kb, 2), "KE/kT · He's share " + K.fmt(100 * ka / (ka + kb), 0) + "%");
      } else setR("eq", s ? "x " + K.fmt(s.kx, 2) + " · y " + K.fmt(s.ky, 2) : "—", "KE/kT, each → 0.5");
      setR("cv", K.fmt(f / 2 * RGAS, 1) + " J/mol·K, " + K.fmt(1 + 2 / f, 2), name + ": f = " + f + " in 3D");
      setR("T", K.fmt(T, 1) + " K", "total KE is conserved");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Nothing in the simulation knows about Maxwell or Boltzmann. Each collision just shares energy between two molecules, and after many of them the speeds settle into the <b>most likely way to split a fixed total energy</b>: few very slow, few very fast, most in between.</p>" +
      "<p>The shape depends on how many directions a molecule can move in. In this flat box $f(v) \\propto v\\,e^{-mv^2/2kT}$, and $v_{mp} : v_{avg} : v_{rms} = 1 : 1.25 : 1.41$. Real gases move in 3D: $f(v) \\propto v^2 e^{-mv^2/2kT}$, and the ratios are $\\sqrt2 : \\sqrt{8/\\pi} : \\sqrt3 = 1 : 1.13 : 1.22$. Either way the order is the same: $v_{mp} < v_{avg} < v_{rms}$.</p>" +
      "<p>Every speed goes as $\\sqrt{T/M}$: a hotter or lighter gas has a wider, flatter, faster curve. <b>Equipartition</b> gives each quadratic term in the energy $\\tfrac12 kT$: 3 for a monatomic gas, 5 for a diatomic one at room temperature (3 translation + 2 rotation). That sets $C_v = \\tfrac f2 R$ and $\\gamma = 1 + \\tfrac 2f$.</p>" +
      '<div class="trap"><b>JEE trap: the average of the speeds is not the rms speed.</b> $v_{avg} = \\sqrt{8RT/\\pi M}$ and $v_{rms} = \\sqrt{3RT/M}$ differ by about 8%. The mean KE uses $v_{rms}$: $\\tfrac12 m v_{rms}^2 = \\tfrac32 kT$, but $\\tfrac12 m v_{avg}^2$ is smaller. And use $M$ in kg/mol: 32 g/mol is $0.032$.</div>');
    function apply(s) {
      gasKey = String(s.gas); start = s.start || "one";
      setSeg(gasSeg, gasKey); setSeg(startSeg, start);
      nS.set(s.n || 200); tS.set(s.T || 300);
      rebuild();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "rms speed and mass", setup: { gas: 2, T: 300 }, watch: "Note the 3D v_rms for H₂, then switch to O₂",
        q: "Hydrogen ($M = 2$ g/mol) and oxygen ($M = 32$ g/mol) are at the same temperature. What is the ratio $v_{rms}(\\text{H}_2) : v_{rms}(\\text{O}_2)$?",
        options: ["1 : 4", "4 : 1", "16 : 1", "1 : 1"], answer: 1,
        explain: "$v_{rms} = \\sqrt{3RT/M} \\propto 1/\\sqrt M$, so the ratio is $\\sqrt{32/2} = 4$. At 300 K that's 1934 m/s against 484 m/s. 16 : 1 forgets the square root; 1 : 1 is the mean KE ratio, which really is equal." },
      { level: "medium", tag: "doubling v_rms", setup: { gas: 28, T: 300 }, watch: "Note v_rms, then raise T to 1200 K",
        q: "Nitrogen is at 27 °C. To what temperature must it be heated for its rms speed to double?",
        options: ["54 °C", "108 °C", "927 °C", "1200 °C"], answer: 2,
        hints: ["$v_{rms} \\propto \\sqrt T$ with $T$ in kelvin.", "Doubling $v_{rms}$ needs $4\\times$ the absolute temperature."],
        explain: "27 °C is 300 K. $v_{rms} \\propto \\sqrt T$, so doubling it needs $4 \\times 300 = 1200$ K, which is 927 °C. 54 °C doubles the Celsius number (the classic slip); 1200 °C forgets to convert back. In the lab, 3D $v_{rms}$ goes from 517 to 1034 m/s." },
      { level: "hard", tag: "a mixture shares energy", setup: { gas: "mix", T: 400 }, watch: "Run until both lines on the equipartition graph meet. Read He's share and the 3D v_rms",
        q: "A box holds equal numbers of He ($M = 4$ g/mol) and Ar ($M = 40$ g/mol) atoms in equilibrium at 400 K ($R = 8.314$ J/mol·K). What is the rms speed of the He atoms, and what fraction of the total kinetic energy do they carry?",
        options: ["1579 m/s; 50%", "1579 m/s; 9%", "1289 m/s; 50%", "499 m/s; 91%"], answer: 0,
        hints: ["In equilibrium every species has the same mean KE, $\\tfrac32 kT$ per atom, whatever its mass.", "$v_{rms} = \\sqrt{3RT/M}$ with $M$ in kg/mol."],
        explain: "$v_{rms} = \\sqrt{3(8.314)(400)/0.004} = 1579$ m/s. Mean KE depends only on $T$, so with equal numbers He carries exactly half the energy, even though Ar atoms are 10 times heavier (9% assumes equal speeds). 1289 m/s is $v_{mp} = \\sqrt{2RT/M}$, and 499 m/s is the Ar rms speed. In the box, start them at the same speed (each Ar with 10× the energy) and watch He's share climb to 50%." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { onReset: function () { rebuild(); } });
    sim.on("step", function () { P.time.textContent = "t = " + K.fmt(gasT, 0) + " ps"; });
    rebuild();

    if (location.hostname === "localhost") {
      window.__lab_speeds = { apply: apply, gas: function () { return gas; }, stats: stats, settled: settled, setTurbo: function (v) { turbo = v; },
        tS: tS, changed: changed, setGas: function (v) { gasSeg.querySelector('[data-value="' + v + '"]').click(); }, mb2: mb2, mb3: mb3, vScale: function () { return vScale; } };
    }
    return function destroy() { sim.destroy(); [gh, ge, g3].forEach(function (g) { g.destroy(); }); };
  }
})();
