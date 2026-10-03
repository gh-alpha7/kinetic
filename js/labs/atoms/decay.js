/* Atoms & nuclei, lab 2: radioactive decay and binding energy. A grid of nuclei that decay at random, and the curve that says which nuclei hold together best. */
(function () {
  "use strict";
  var LN2 = Math.LN2, U = 931.5, MH = 1.007825, MN = 1.008665;  // MeV per u, ¹H atom and neutron masses (u)
  var REAL_HALF = 2, HALVES = 6, SUB = 4, BIN = 30;             // one half-life lasts 2 s on screen; run for 6; substeps per step; steps per activity bin
  var ISOTOPES = [
    { id: "custom", label: "Your own", half: 5, unit: "s", mode: "set t½ with the slider" },
    { id: "rn222", label: "Rn-222", half: 3.82, unit: "d", mode: "α → Po-218" },
    { id: "i131", label: "I-131", half: 8.02, unit: "d", mode: "β⁻ → Xe-131" },
    { id: "co60", label: "Co-60", half: 5.27, unit: "y", mode: "β⁻ → Ni-60" },
    { id: "c14", label: "C-14", half: 5730, unit: "y", mode: "β⁻ → N-14" }
  ];
  // atomic masses (u): binding energies below come from these, B = [Z m_H + N m_n − M] × 931.5 MeV
  var NUCLEI = [
    ["H-2", 1, 2, 2.014102], ["H-3", 1, 3, 3.016049], ["He-3", 2, 3, 3.016029], ["He-4", 2, 4, 4.002603],
    ["Li-6", 3, 6, 6.015123], ["Li-7", 3, 7, 7.016003], ["Be-9", 4, 9, 9.012182], ["B-11", 5, 11, 11.009305],
    ["C-12", 6, 12, 12.000000], ["N-14", 7, 14, 14.003074], ["O-16", 8, 16, 15.994915], ["Ne-20", 10, 20, 19.992440],
    ["Mg-24", 12, 24, 23.985042], ["Si-28", 14, 28, 27.976927], ["S-32", 16, 32, 31.972071], ["Ca-40", 20, 40, 39.962591],
    ["Fe-56", 26, 56, 55.934937], ["Ni-62", 28, 62, 61.928345], ["Kr-92", 36, 92, 91.926156], ["Zr-90", 40, 90, 89.904704],
    ["Sn-120", 50, 120, 119.902199], ["Ba-138", 56, 138, 137.905247], ["Ba-141", 56, 141, 140.914411],
    ["Pb-208", 82, 208, 207.976652], ["U-235", 92, 235, 235.043930], ["U-238", 92, 238, 238.050788]
  ].map(function (r) {
    var dm = r[1] * MH + (r[2] - r[1]) * MN - r[3];
    return { name: r[0], Z: r[1], A: r[2], M: r[3], dm: dm, B: dm * U, BA: dm * U / r[2] };
  });
  function nuc(name) { return NUCLEI.filter(function (n) { return n.name === name; })[0]; }
  var REACTIONS = {
    fission: { label: "U-235 + n → Ba-141 + Kr-92 + 3n", ins: ["U-235"], outs: ["Ba-141", "Kr-92"], nIn: 1, nOut: 3 },
    fusion: { label: "H-2 + H-3 → He-4 + n", ins: ["H-2", "H-3"], outs: ["He-4"], nIn: 0, nOut: 1 }
  };
  // Q from the masses (u → MeV); neutrons carry no binding energy, so Q is also the rise in total B
  function reactionQ(r) {
    var mIn = r.ins.reduce(function (s, n) { return s + nuc(n).M; }, 0) + r.nIn * MN;
    var mOut = r.outs.reduce(function (s, n) { return s + nuc(n).M; }, 0) + r.nOut * MN;
    return { dm: mIn - mOut, Q: (mIn - mOut) * U, mIn: mIn, mOut: mOut };
  }
  // semi-empirical (liquid-drop) formula, along the valley of stability, pairing term left out
  function semf(A) {
    var Z = A / (2 + 0.0155 * Math.pow(A, 2 / 3));
    var B = 15.8 * A - 18.3 * Math.pow(A, 2 / 3) - 0.714 * Z * (Z - 1) / Math.pow(A, 1 / 3) - 23.2 * (A - 2 * Z) * (A - 2 * Z) / A;
    return B / A;
  }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // 3 significant figures, with powers of ten when needed: text and TeX versions
  var SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sig(x, d) {
    d = d || 3;
    if (!isFinite(x)) return "—";
    if (x === 0) return "0";
    var e = Math.floor(Math.log10(Math.abs(x)));
    if (e >= -2 && e < 5) return K.fmt(x, Math.max(0, d - 1 - e));
    var m = x / Math.pow(10, e);
    return K.fmt(m, d - 1) + " × 10" + String(e).split("").map(function (c) { return SUP[c]; }).join("");
  }
  function sigTex(x, d) {
    d = d || 3;
    if (x === 0) return "0";
    var e = Math.floor(Math.log10(Math.abs(x)));
    if (e >= -2 && e < 5) return K.fmt(x, Math.max(0, d - 1 - e));
    return K.fmt(x / Math.pow(10, e), d - 1) + " \\times 10^{" + e + "}";
  }

  var lab = {
    id: "decay", chapter: "atoms", title: "Radioactive decay & nuclei", short: "half-life, activity, binding energy",
    lede: "No one can say when one nucleus will decay. Put a thousand of them together and the count falls along a perfect curve, $N = N_0 e^{-\\lambda t}$. Then see why splitting the heaviest nuclei and fusing the lightest both release energy.",
    tries: [
      { id: "noise", title: "Catch the randomness",
        text: "With $N_0 = 100$, run to one half-life, then press <b>New run</b> and do it again. Do you get exactly 50 both times?",
        why: "Each nucleus decays on its own, at random. The formula only gives the average; the scatter is about $\\sqrt{N_0/4} = 5$ nuclei at one half-life, which is 10% of what's left." },
      { id: "smooth", title: "Make the grid hug the curve",
        text: "Run $N_0 = 1600$ to three half-lives and keep the count within 3% of $N_0$ of the formula all the way.",
        why: "The scatter grows like $\\sqrt{N}$ but the count grows like $N$, so the relative error falls as $1/\\sqrt{N}$. A real sample has about $10^{20}$ nuclei: the curve is exact for all practical purposes." },
      { id: "mean", title: "Pause at the mean life",
        text: "Stop the clock within 5% of $\\tau = 1/\\lambda$ and look at the fraction left. (¼× speed helps.)",
        why: "At $t = \\tau$, $N = N_0 e^{-1} = 0.37N_0$, not half. The mean life is $1/\\ln 2 = 1.44$ half-lives: the few long-lived nuclei pull the average up." },
      { id: "peak", title: "Find the most tightly bound nucleus",
        text: "Click the dots on the binding-energy curve and find the highest one.",
        why: "Binding energy per nucleon peaks near iron and nickel ($A \\approx 56$–62, about 8.8 MeV). Anything that moves nuclei towards the peak, fission from the right or fusion from the left, releases energy." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 450;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });
    var GR = { x: 24, y: 58, size: 352 };                          // nucleus grid
    var BC = { x0: 476, x1: 972, y0: 46, y1: 392, aMax: 250, bMax: 9.5 };   // binding-energy curve

    /* ---------- controls ---------- */
    var iso = ISOTOPES[1], N0 = 1600, seed = 1, reaction = "none", selName = "U-235";
    P.controls.innerHTML = "<h3>Isotope</h3>";
    var isoSeg = K.seg(ISOTOPES.map(function (i) { return { label: i.label, value: i.id }; }), iso.id, function (v) { setIso(v); reset(); }, "Isotope");
    P.controls.appendChild(isoSeg);
    var halfS = K.slider({ label: "Half-life $t_{1/2}$ (your own)", unit: "s", min: 1, max: 20, step: 0.5, value: 5, onInput: function (v) { ISOTOPES[0].half = v; reset(); } });
    P.controls.appendChild(halfS.el);
    P.controls.appendChild(K.h("<h3>Sample</h3>"));
    var nSeg = K.seg([{ label: "100", value: 100 }, { label: "400", value: 400 }, { label: "1600", value: 1600 }], N0, function (v) { N0 = v; reset(); }, "Nuclei");
    P.controls.appendChild(nSeg);
    var seedRow = K.h('<div class="row"></div>');
    var newRun = K.h('<button class="btn btn-sm" type="button">New run (new seed)</button>');
    newRun.addEventListener("click", function () { seed++; reset(); sim.play(); transportUI.render(); });
    var seedOut = K.h('<span class="mono" style="font-size:12px"></span>');
    seedRow.appendChild(newRun); seedRow.appendChild(seedOut);
    P.controls.appendChild(seedRow);
    P.controls.appendChild(K.h('<p class="control-hint">' + K.md("Same seed, same run: Reset replays it exactly. Click a nucleus to follow it.") + "</p>"));
    P.controls.appendChild(K.h("<h3>Energy from nuclei</h3>"));
    var rSeg = K.seg([{ label: "None", value: "none" }, { label: "Fission", value: "fission" }, { label: "Fusion", value: "fusion" }], reaction,
      function (v) { reaction = v; renderMaths(); }, "Reaction");
    P.controls.appendChild(rSeg);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-app"><i></i>parent nucleus</span><span style="color:' + th.muted + '"><i></i>decayed</span>' +
      '<span class="c-acc"><i></i>just decayed</span><span class="c-disp"><i></i>binding energy / nucleon</span></div>'));
    function setIso(id) {
      iso = ISOTOPES.filter(function (i) { return i.id === id; })[0];
      halfS.el.hidden = id !== "custom";
    }
    halfS.el.hidden = true;

    function lam() { return LN2 / iso.half; }
    function tModel() { return sim.time * iso.half / REAL_HALF; }   // time in the isotope's own unit
    function formulaN(t) { return N0 * Math.exp(-lam() * t); }

    /* ---------- the sample ---------- */
    var st, rng, follow = null, lives = [];
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      rng = mulberry(seed * 7919 + N0);
      st = { alive: new Uint8Array(N0), at: new Float64Array(N0), N: N0, rec: [[0, N0]], bins: [], binCount: 0, maxDev: 0, done: false, atHalf: null };
      for (var i = 0; i < N0; i++) st.alive[i] = 1;
      follow = null;
      seedOut.textContent = "seed " + seed;
      P.hud.innerHTML = "<span>" + iso.label + ": t½ = " + sig(iso.half) + " " + iso.unit + "</span><span>1 half-life = " + REAL_HALF + " s on screen</span>";
      P.time.textContent = "t = 0.00 s";
      theory(); update(true);
    }

    sim.on("before", function () {
      if (st.done) return;
      // every nucleus still there decays with probability λ·dt in each small time step
      var p = lam() * (K.DT * iso.half / REAL_HALF) / SUB, t0 = sim.time;
      for (var s = 0; s < SUB; s++) {
        for (var i = 0; i < N0; i++) {
          if (st.alive[i] && rng() < p) { st.alive[i] = 0; st.at[i] = t0 + (s + 1) * K.DT / SUB; st.N--; st.binCount++; }
        }
      }
    });
    sim.on("step", function () {
      if (st.done) return;
      var t = tModel(), n = sim.steps;
      st.rec.push([t, st.N]);
      st.maxDev = Math.max(st.maxDev, Math.abs(st.N - formulaN(t)) / N0);
      if (n % BIN === 0) {
        var w = BIN * K.DT * iso.half / REAL_HALF;
        st.bins.push([t - w, t, st.binCount / w]); st.binCount = 0;
      }
      if (follow != null && !st.alive[follow]) {
        var life = st.at[follow] * iso.half / REAL_HALF;
        lives.push(life / (1 / lam()));
        K.flash(P.note, "Your nucleus lasted " + sig(life) + " " + iso.unit + " (τ = " + sig(1 / lam()) + " " + iso.unit + ")", 3000);
        follow = null;
      }
      if (n === BIN * 4) {                                            // one half-life
        st.atHalf = st.N;
        if (N0 === 100) {
          halfRuns.push({ seed: seed, N: st.N });
          if (halfRuns.some(function (r) { return r.seed !== seed; })) tries.mark("noise");
        }
      }
      if (n === BIN * 12 && N0 === 1600 && st.maxDev <= 0.03) tries.mark("smooth");
      if (n >= BIN * 4 * HALVES || st.N === 0) {
        st.done = true; sim.pause(); transportUI.render();
        K.flash(P.note, st.N === 0 ? "Every nucleus has decayed" : HALVES + " half-lives: " + st.N + " left of " + N0);
      }
      update(st.done || n % BIN === 0);
    });
    var halfRuns = [];

    /* ---------- direct manipulation ---------- */
    function cell() { var side = Math.round(Math.sqrt(N0)); return { side: side, w: GR.size / side }; }
    function nearestNucleus(px, py) {
      var best = null, bd = 12;
      NUCLEI.forEach(function (n) {
        var d = Math.hypot(px - bx(n.A), py - by(n.BA));
        if (d < bd) { bd = d; best = n; }
      });
      return best;
    }
    var hoverN = null;
    sim.pointer({
      down: function (pt) {
        var c = cell(), gx = Math.floor((pt.px - GR.x) / c.w), gy = Math.floor((pt.py - GR.y) / c.w);
        if (gx >= 0 && gy >= 0 && gx < c.side && gy < c.side) {
          var i = gy * c.side + gx;
          if (st.alive[i]) { follow = i; K.flash(P.note, "Following one nucleus. When will it go? Nobody knows."); }
          else K.flash(P.note, "That one has already decayed");
          return false;
        }
        var n = nearestNucleus(pt.px, pt.py);
        if (n) select(n.name, true);
        return false;
      },
      hover: function (pt) { hoverN = nearestNucleus(pt.px, pt.py); P.canvas.style.cursor = hoverN ? "pointer" : ""; }
    });
    function select(name, byUser) {
      selName = name; renderMaths();
      var n = nuc(name);
      if (byUser) {
        K.flash(P.note, n.name + ": B/A = " + K.fmt(n.BA, 3) + " MeV");
        if (name === "Fe-56" || name === "Ni-62") tries.mark("peak");
      }
    }

    /* ---------- drawing ---------- */
    function bx(A) { return BC.x0 + (BC.x1 - BC.x0) * A / BC.aMax; }
    function by(b) { return BC.y1 - (BC.y1 - BC.y0) * b / BC.bMax; }
    sim.on("under", function (ctx) {
      var c = cell(), now = sim.time;
      K.label(ctx, N0 + " nuclei of " + iso.label + " (" + iso.mode + ")", GR.x, GR.y - 18, th.ink, { align: "left", font: "700 12px 'JetBrains Mono', monospace" });
      for (var i = 0; i < N0; i++) {
        var x = GR.x + (i % c.side) * c.w + c.w / 2, y = GR.y + Math.floor(i / c.side) * c.w + c.w / 2, r = c.w * 0.38;
        if (st.alive[i]) { ctx.fillStyle = th.app; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
        else {
          var age = now - st.at[i];
          if (age < 0.35) { ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(x, y, r * (1 + age * 2.5), 0, Math.PI * 2); ctx.fill(); }
          else { ctx.strokeStyle = K.alpha(th.muted, 0.6); ctx.lineWidth = Math.max(0.8, c.w * 0.08); ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.stroke(); }
        }
        if (i === follow) { ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
      }
      var t = tModel();
      K.label(ctx, "N = " + st.N + " left   (formula " + K.fmt(formulaN(t), 0) + ")", GR.x, GR.y + GR.size + 26, th.app, { align: "left" });

      // binding energy per nucleon
      ctx.strokeStyle = th["grid-strong"]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(BC.x0, BC.y0); ctx.lineTo(BC.x0, BC.y1); ctx.lineTo(BC.x1, BC.y1); ctx.stroke();
      ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.fillStyle = th.muted;
      for (var b = 0; b <= 9; b += 1) {
        ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(BC.x0, by(b)); ctx.lineTo(BC.x1, by(b)); ctx.stroke();
        ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(String(b), BC.x0 - 5, by(b));
      }
      for (var A = 0; A <= 250; A += 50) { ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(String(A), bx(A), BC.y1 + 4); }
      K.label(ctx, "mass number A", BC.x1, BC.y1 + 30, th.muted, { align: "right", font: "600 10px 'JetBrains Mono', monospace" });
      K.label(ctx, "B/A (MeV per nucleon)", BC.x0 + 4, BC.y0 - 6, th.disp, { align: "left", font: "700 11px 'JetBrains Mono', monospace" });
      // fission and fusion regions
      K.label(ctx, "← fusion releases energy", bx(8), by(1.4), th.vel, { align: "left", font: "600 11px 'JetBrains Mono', monospace" });
      K.label(ctx, "fission releases energy →", bx(250), by(6.6), th.fric, { align: "right", font: "600 11px 'JetBrains Mono', monospace" });
      ctx.strokeStyle = th.disp; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath();
      for (var a = 6; a <= 250; a += 2) { var yy = by(Math.max(0, semf(a))); if (a === 6) ctx.moveTo(bx(a), yy); else ctx.lineTo(bx(a), yy); }
      ctx.stroke(); ctx.setLineDash([]);
      NUCLEI.forEach(function (n) {
        var x2 = bx(n.A), y2 = by(n.BA), on = n.name === selName;
        ctx.fillStyle = on ? th.app : th.disp; ctx.beginPath(); ctx.arc(x2, y2, on ? 6 : hoverN === n ? 5.5 : 4, 0, Math.PI * 2); ctx.fill();
        if (on || hoverN === n || /^(H-2|He-4|C-12|Fe-56|U-235|Pb-208|Li-6)$/.test(n.name))
          K.label(ctx, n.name, x2 + (n.A > 200 ? -6 : 6), y2 - 4, on ? th.app : th.ink, { align: n.A > 200 ? "right" : "left", font: "700 10px 'JetBrains Mono', monospace", bg: on });
      });
      if (reaction !== "none") {
        var R = REACTIONS[reaction], q = reactionQ(R), col = reaction === "fission" ? th.fric : th.vel;
        R.ins.forEach(function (from) {
          R.outs.forEach(function (to) {
            var f = nuc(from), g = nuc(to);
            K.arrow(ctx, bx(f.A), by(f.BA), bx(g.A), by(g.BA), col, { width: 2.5, head: 10 });
          });
        });
        K.label(ctx, R.label + ":  Q = " + K.fmt(q.Q, 1) + " MeV", BC.x1, BC.y1 - 12, col, { align: "right", bg: true });
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">N–t</b> · nuclei left; dashed is $N_0 e^{-\\lambda t}$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">activity A–t</b> · decays counted per unit time; dashed is $\\lambda N_0 e^{-\\lambda t}$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">ln N vs t</b> · a straight line of slope $-\\lambda$</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (c) { c.innerHTML = K.md(c.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gN = new K.Graph(cv[0], { yLabel: "N", xMax: 1, yMin: 0, color: th.app });
    var gA = new K.Graph(cv[1], { yLabel: "A", xMax: 1, yMin: 0, color: th.acc });
    var gL = new K.Graph(cv[2], { yLabel: "ln N", xMax: 1, yMin: 0, color: th.disp });

    function theory() {
      var tEnd = iso.half * HALVES, np = [], ap = [], lp = [], L = lam();
      [gN, gA, gL].forEach(function (g) { g.o.xMax = tEnd; g.o.xLabel = "t (" + iso.unit + ")"; g.o.yLabel = g === gA ? "A (per " + iso.unit + ")" : g.o.yLabel; });
      for (var i = 0; i <= 120; i++) {
        var t = tEnd * i / 120;
        np.push([t, formulaN(t)]); ap.push([t, L * formulaN(t)]); lp.push([t, Math.log(formulaN(t))]);
      }
      gN.set("theory", { points: np, color: th.app, dash: [5, 5], width: 1.5 });
      gA.set("theory", { points: ap, color: th.acc, dash: [5, 5], width: 1.5 });
      gL.set("theory", { points: lp, color: th.disp, dash: [5, 5], width: 1.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      gN.set("sim", { points: st.rec, color: th.app, width: 2.5, dot: true });
      var bars = [];
      st.bins.forEach(function (b) { bars.push([b[0], b[2]]); bars.push([b[1], b[2]]); });
      gA.set("sim", { points: bars, color: th.acc, width: 2.5, dot: true, fill: K.alpha(th.acc, 0.15) });
      gL.set("sim", { points: st.rec.filter(function (p) { return p[1] > 0; }).map(function (p) { return [p[0], Math.log(p[1])]; }), color: th.disp, width: 2.5, dot: true });
      [gN, gA, gL].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Decay law", "Half-life and mean life", "Activity", "Mass defect → energy"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "t", label: "time" }, { id: "N", label: "nuclei left N", cls: "c-app" }, { id: "f", label: "fraction left", cls: "c-app" },
      { id: "A", label: "activity A", cls: "c-acc" }, { id: "lam", label: "decay constant λ" }, { id: "fol", label: "followed nuclei" },
      { id: "B", label: "binding energy", cls: "c-disp" }, { id: "Q", label: "energy released Q" }
    ]);
    function stats() {
      var t = tModel(), q = Math.exp(-lam() * t);
      return { t: t, q: q, Nf: N0 * q, sd: Math.sqrt(N0 * q * (1 - q)) };
    }
    function renderMaths() {
      var s = stats(), L = lam(), u = iso.unit, lb = st.bins[st.bins.length - 1];
      K.tex(eqEls[0], "N = N_0 e^{-\\lambda t} = " + N0 + "\\,e^{-(" + sigTex(L) + ")(" + sigTex(s.t) + ")} = \\mathbf{" + K.fmt(s.Nf, 0) + "}");
      K.tex(eqEls[1], "t_{1/2} = \\frac{\\ln 2}{\\lambda} = \\frac{0.693}{" + sigTex(L) + "} = \\mathbf{" + sigTex(iso.half) + "}\\ \\text{" + u + "},\\quad \\tau = \\frac{1}{\\lambda} = \\mathbf{" + sigTex(1 / L) + "}\\ \\text{" + u + "}");
      K.tex(eqEls[2], "A = \\lambda N = (" + sigTex(L) + ")(" + st.N + ") = \\mathbf{" + sigTex(L * st.N) + "}\\ \\text{per " + u + "}");
      if (reaction === "none") {
        var n = nuc(selName);
        K.tex(eqEls[3], "B = [Zm_H + Nm_n - M]c^2 = [(" + n.Z + ")(1.007825) + (" + (n.A - n.Z) + ")(1.008665) - " + n.M.toFixed(6) + "](931.5) = (" + n.dm.toFixed(6) + ")(931.5) = \\mathbf{" + K.fmt(n.B, 2) + "}\\ \\text{MeV}");
      } else {
        var q = reactionQ(REACTIONS[reaction]);
        K.tex(eqEls[3], "Q = \\Delta m\\,c^2 = (" + q.mIn.toFixed(6) + " - " + q.mOut.toFixed(6) + ")(931.5) = (" + q.dm.toFixed(6) + ")(931.5) = \\mathbf{" + K.fmt(q.Q, 1) + "}\\ \\text{MeV}");
      }
      setR("t", sig(s.t) + " " + u, "= " + K.fmt(s.t / iso.half, 2) + " t½");
      setR("N", String(st.N), "formula " + K.fmt(s.Nf, 0) + " ± " + K.fmt(s.sd, 0) + " (1σ scatter)");
      setR("f", K.fmt(100 * st.N / N0, 1) + "%", "e^(−λt) = " + K.fmt(100 * s.q, 1) + "%");
      setR("A", lb ? sig(lb[2]) + " per " + u : "—", "counted last bin · λN = " + sig(L * st.N));
      setR("lam", sig(L) + " per " + u, "τ = 1/λ = " + sig(1 / L) + " " + u + " = 1.44 t½");
      setR("fol", lives.length ? lives.length + " lived " + K.fmt(lives.reduce(function (a, b) { return a + b; }, 0) / lives.length, 2) + " τ" : "—", lives.length ? "average, in units of τ (→ 1)" : "click a nucleus");
      var nn = nuc(selName);
      setR("B", K.fmt(nn.B, 2) + " MeV", nn.name + " · B/A = " + K.fmt(nn.BA, 3) + " MeV");
      if (reaction === "none") setR("Q", "—", "pick fission or fusion");
      else { var qq = reactionQ(REACTIONS[reaction]); setR("Q", K.fmt(qq.Q, 1) + " MeV", "Δm = " + qq.dm.toFixed(6) + " u"); }
    }
    // pausing right at the mean life
    function onPauseClick() {
      if (sim.running) return;
      var t = tModel(), tau = 1 / lam();
      if (Math.abs(t - tau) <= 0.05 * tau) { tries.mark("mean"); K.flash(P.note, "t = τ: " + K.fmt(100 * st.N / N0, 1) + "% left (e⁻¹ = 36.8%)"); }
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>Every unstable nucleus has the same chance $\\lambda\\,dt$ of decaying in the next instant, whatever its age. So the number that decay is proportional to the number left: $\\frac{dN}{dt} = -\\lambda N$, which gives <b class=\"c-app\">$N = N_0 e^{-\\lambda t}$</b>. " +
      "The <b>half-life</b> $t_{1/2} = \\ln 2/\\lambda$ is how long it takes for half to go, from any starting point; the <b>mean life</b> $\\tau = 1/\\lambda = 1.44\\,t_{1/2}$. The <b class=\"c-acc\">activity</b> $A = \\lambda N$ falls with the same half-life.</p>" +
      "<p>A nucleus weighs less than its protons and neutrons separately. That <b>mass defect</b> $\\Delta m$ is the binding energy, $B = \\Delta m\\,c^2$, with 1 u ↔ 931.5 MeV. " +
      "<b class=\"c-disp\">Binding energy per nucleon</b> rises steeply for light nuclei, peaks at about 8.8 MeV near iron, then falls slowly. Fusing light nuclei or splitting heavy ones both climb towards the peak, and the rise in total binding energy comes out as $Q$.</p>" +
      '<div class="trap"><b>JEE trap: the mean life is not the half-life.</b> At $t = \\tau$ about 37% is left, not 50%. And after two half-lives a quarter is left, not zero: the fraction left after $n$ half-lives is $(1/2)^n$, whatever the isotope.</div>');

    function apply(s) {
      if (s.iso) { setIso(s.iso); isoSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === s.iso)); }); }
      if (s.half) { ISOTOPES[0].half = s.half; halfS.set(s.half); }
      if (s.N0) { N0 = s.N0; nSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === String(N0))); }); }
      if (s.seed) seed = s.seed;
      if (s.reaction) { reaction = s.reaction; rSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === reaction)); }); }
      if (s.sel) select(s.sel, false);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "half-lives", setup: { iso: "i131", N0: 1600, seed: 3 }, watch: "Predict, then play to t = 24 d (3 half-lives) and read N",
        q: "Iodine-131 has a half-life of 8 days. What fraction of a sample is left after 24 days?",
        options: ["1/3", "1/8", "1/6", "1/9"], answer: 1,
        explain: "24 days is 3 half-lives, so $(\\tfrac12)^3 = \\tfrac18$ is left. It is not $1/3$: each half-life halves what is <i>left</i>, so it never runs out on a schedule. In the lab about 200 of 1600 remain at 24 d." },
      { level: "medium", tag: "mean life", setup: { iso: "custom", half: 5, N0: 1600, seed: 2 }, watch: "Run to t = 20 s, check A has fallen to 1/16, then read τ",
        q: "The activity of a radioactive sample falls to $\\tfrac{1}{16}$ of its starting value in 20 s. What is its mean life?",
        options: ["5.0 s", "7.2 s", "3.5 s", "1.25 s"], answer: 1,
        hints: ["$\\tfrac{1}{16} = (\\tfrac12)^4$: how many half-lives is that?", "$\\tau = 1/\\lambda = t_{1/2}/\\ln 2$."],
        explain: "Four halvings take 20 s, so $t_{1/2} = 5$ s and $\\tau = 5/0.693 = 7.2$ s. 5.0 s is the half-life; 3.5 s multiplies by $\\ln 2$ instead of dividing; 1.25 s divides 20 s by 16." },
      { level: "hard", tag: "fusion energy", setup: { reaction: "fusion", sel: "He-4" }, watch: "Compare Q on the curve with your 4(B/A) − 2(B/A) − 3(B/A)",
        q: "The binding energies per nucleon of ²H, ³H and ⁴He are 1.112, 2.827 and 7.074 MeV. How much energy is released in $^2\\text{H} + {}^3\\text{H} \\to {}^4\\text{He} + n$?",
        options: ["17.6 MeV", "28.3 MeV", "11.0 MeV", "3.14 MeV"], answer: 0,
        hints: ["Total binding energy is $A \\times (B/A)$ for each nucleus; the free neutron has none.", "$Q$ = total binding energy after − total binding energy before."],
        explain: "Before: $2(1.112) + 3(2.827) = 10.705$ MeV. After: $4(7.074) = 28.296$ MeV. $Q = 28.296 - 10.705 = 17.6$ MeV, the same as the mass defect $0.018883$ u × 931.5. 28.3 MeV is helium's binding energy alone; 3.14 MeV just subtracts the per-nucleon values." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { onReset: reset, onPlay: function () { if (st.done) reset(); } });
    P.playBtn.addEventListener("click", onPauseClick);       // after the transport handler, so a pause has already happened
    reset();

    if (location.hostname === "localhost") window.__lab_decay = {
      apply: apply, reset: reset, sim: sim, select: select, state: function () { return st; }, stats: stats,
      lam: lam, tModel: tModel, iso: function () { return iso; }, N0: function () { return N0; },
      setN0: function (n) { apply({ N0: n }); }, setSeed: function (s) { seed = s; reset(); },
      nuc: nuc, reactionQ: function (k) { return reactionQ(REACTIONS[k]); }, semf: semf, follow: function (i) { follow = i; }, lives: lives
    };

    return function destroy() { sim.destroy(); [gN, gA, gL].forEach(function (g) { g.destroy(); }); };
  }
})();
