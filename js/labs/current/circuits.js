/* Current electricity, lab 1: Ohm's and Kirchhoff's laws. Preset circuits solved exactly by nodal analysis. */
(function () {
  "use strict";

  var lab = {
    id: "circuits", chapter: "current", title: "Ohm's & Kirchhoff's laws", short: "series, parallel, KCL, KVL, internal r",
    lede: "Build-free circuits you can poke: click a resistor or a cell and drag it up or down. Every current and potential is solved exactly, and the junction and loop rules write themselves out with your numbers.",
    tries: [
      { id: "share", title: "Split the current 2 : 1",
        text: "In the parallel circuit, make one resistor carry exactly twice the current of another.",
        why: "Parallel resistors share one voltage, so $I = V/R$: the current divides in the <i>inverse</i> ratio of the resistances. Twice the current needs half the resistance." },
      { id: "charging", title: "Push a battery backwards",
        text: "In the two-battery network, make the current flow through one cell from its + terminal to its − terminal.",
        why: "A stronger cell can drive current backwards through a weaker one, which is then being charged. KVL still holds: the cell's EMF simply enters the loop sum against the current." },
      { id: "maxpower", title: "Get the most power out of a battery",
        text: "With the battery that has internal resistance, set the load so it takes the greatest possible power.",
        why: "$P = \\frac{E^2R}{(R+r)^2}$ peaks at $R = r$, where $P_{max} = \\frac{E^2}{4r}$. The P–R graph shows the peak: either side of it, less power reaches the load." },
      { id: "sag", title: "Pull the terminal voltage below E/2",
        text: "With the internal-resistance battery, make the voltmeter across the cell read less than half its EMF.",
        why: "$V = E - Ir = \\frac{ER}{R+r}$, which drops below $E/2$ once $R < r$. More current means more voltage lost inside the cell." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- circuit kit: nodes, branches, an exact nodal solve ---------- */
  // A branch runs from node a to node b along a polyline. Its parts (resistors, cells, meters) sit on
  // straight runs. Branch current I is measured a → b, and V_b = V_a + ΣE − I·ΣR along it.
  var PART_LEN = { R: 1.4, r: 0.9, E: 0.5, A: 0.84, G: 1.0 };
  function build(def) {
    def.branches.forEach(function (b) {
      var pts = [def.nodes[b.a]].concat(b.via || [], [def.nodes[b.b]]).map(function (q) { return { x: q[0], y: q[1] }; });
      var cum = [0];
      for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      b.pts = pts; b.cum = cum; b.L = cum[cum.length - 1]; b.phase = 0; b.I = 0;
      b.parts = (b.parts || []).map(function (p) {
        var s = locate(b, p.at), len = p.len || PART_LEN[p.kind];
        return Object.assign({}, p, { s: s, s0: s - len / 2, s1: s + len / 2 });
      }).sort(function (u, v) { return u.s - v.s; });
    });
    def.byId = {};
    def.branches.forEach(function (b) { def.byId[b.id] = b; });
    return def;
  }
  function locate(b, at) {
    var best = 0, bd = Infinity;
    for (var i = 1; i < b.pts.length; i++) {
      var p = b.pts[i - 1], q = b.pts[i], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
      var t = K.clamp(((at[0] - p.x) * dx + (at[1] - p.y) * dy) / (L * L), 0, 1);
      var d = Math.hypot(p.x + t * dx - at[0], p.y + t * dy - at[1]);
      if (d < bd) { bd = d; best = b.cum[i - 1] + t * L; }
    }
    return best;
  }
  function pointAt(b, s) {
    s = K.clamp(s, 0, b.L);
    for (var i = 1; i < b.pts.length; i++) {
      if (s <= b.cum[i] + 1e-9 || i === b.pts.length - 1) {
        var p = b.pts[i - 1], q = b.pts[i], L = (b.cum[i] - b.cum[i - 1]) || 1, t = (s - b.cum[i - 1]) / L;
        return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y), ux: (q.x - p.x) / L, uy: (q.y - p.y) / L };
      }
    }
  }
  function gauss(A, z) {
    var n = z.length, M = A.map(function (r, i) { return r.concat([z[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-15) return z.map(function () { return 0; });
      var t = M[c]; M[c] = M[p]; M[p] = t;
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c] / M[c][c]; if (f) for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(function (row, i) { return row[n] / row[i]; });
  }
  // Modified nodal analysis. Unknowns: every node potential except ground, plus the current in each
  // branch with no resistance (wires, ideal cells, ammeters), whose ends are tied by V_b = V_a + E.
  function solveCircuit(c, val) {
    var ids = Object.keys(c.nodes).filter(function (n) { return n !== c.ground; }), idx = {}, extra = 0;
    ids.forEach(function (n, i) { idx[n] = i; });
    c.branches.forEach(function (b) {
      b.R = 0; b.E = 0;
      b.parts.forEach(function (p) { if (p.kind === "E") b.E += val(p.key); else if (p.kind !== "A") b.R += val(p.key); });
      b.k = b.R > 1e-12 ? -1 : ids.length + extra++;
    });
    var n = ids.length + extra, A = [], z = [];
    for (var i = 0; i < n; i++) { A.push([]); for (var j = 0; j < n; j++) A[i].push(0); z.push(0); }
    function put(row, node, v) { if (row >= 0 && idx[node] !== undefined) A[row][idx[node]] += v; }
    c.branches.forEach(function (b) {
      var ra = idx[b.a] === undefined ? -1 : idx[b.a], rb = idx[b.b] === undefined ? -1 : idx[b.b];
      if (b.k < 0) {
        var g = 1 / b.R;                 // current leaving a = g(V_a − V_b + E)
        put(ra, b.a, g); put(ra, b.b, -g); if (ra >= 0) z[ra] -= g * b.E;
        put(rb, b.a, -g); put(rb, b.b, g); if (rb >= 0) z[rb] += g * b.E;
      } else {
        if (ra >= 0) A[ra][b.k] += 1;
        if (rb >= 0) A[rb][b.k] -= 1;
        put(b.k, b.a, 1); put(b.k, b.b, -1); z[b.k] = -b.E;
      }
    });
    var x = gauss(A, z), V = {};
    V[c.ground] = 0;
    ids.forEach(function (nd, i) { V[nd] = x[i]; });
    c.branches.forEach(function (b) { b.I = b.k < 0 ? (V[b.a] - V[b.b] + b.E) / b.R : x[b.k]; });
    c.V = V;
    return c;
  }
  // potential at arclength s along a branch, walking from a
  function vAlong(c, b, s, val) {
    var v = c.V[b.a];
    b.parts.forEach(function (p) {
      var f = K.clamp((s - p.s0) / (p.s1 - p.s0), 0, 1);
      if (p.kind === "E") v += f * val(p.key);
      else if (p.kind !== "A") v -= f * b.I * val(p.key);
    });
    return v;
  }
  function num(v) { var r = +(+v).toFixed(2); return String(Object.is(r, -0) ? 0 : r); }

  /* ---------- the circuits ---------- */
  var DEF = {
    E1: { label: "EMF $E_1$", unit: "V", min: 0, max: 24, step: 0.5 },
    E2: { label: "EMF $E_2$", unit: "V", min: 0, max: 24, step: 0.5 },
    R1: { label: "$R_1$", unit: "Ω", min: 0.5, max: 20, step: 0.5 },
    R2: { label: "$R_2$", unit: "Ω", min: 0.5, max: 20, step: 0.5 },
    R3: { label: "$R_3$", unit: "Ω", min: 0.5, max: 20, step: 0.5 },
    R: { label: "Load $R$", unit: "Ω", min: 0.5, max: 20, step: 0.5 },
    r: { label: "Internal resistance $r$", unit: "Ω", min: 0, max: 10, step: 0.5 }
  };
  var TEXN = { E1: "E_1", E2: "E_2", R1: "R_1", R2: "R_2", R3: "R_3", R: "R", r: "r" };
  var PRESETS = {
    series: { label: "Series", keys: ["E1", "R1", "R2", "R3"], defaults: { E1: 12, R1: 2, R2: 4, R3: 6 }, sel: "R2",
      def: function () { return { ground: "a", nodes: { a: [3, 2], b: [3, 8], c: [17, 8], d: [17, 2] },
        show: { b: [0, 0.45], c: [0, 0.45], d: [0, -0.75], a: [0, -0.75] }, junction: "c", cell: "bat",
        branches: [
          { id: "bat", a: "a", b: "b", name: "I", parts: [{ kind: "E", key: "E1", at: [3, 5], name: "E₁" }] },
          { id: "w1", a: "b", b: "c", name: "I", parts: [{ kind: "R", key: "R1", at: [10, 8], name: "R₁" }] },
          { id: "w2", a: "c", b: "d", name: "I", parts: [{ kind: "R", key: "R2", at: [17, 5], name: "R₂" }] },
          { id: "w3", a: "d", b: "a", name: "I", parts: [{ kind: "R", key: "R3", at: [10, 2], name: "R₃" }] }
        ], loops: [{ name: "the loop", path: [["bat", 1], ["w1", 1], ["w2", 1], ["w3", 1]] }] }; } },
    parallel: { label: "Parallel", keys: ["E1", "R1", "R2", "R3"], defaults: { E1: 12, R1: 4, R2: 5, R3: 6 }, sel: "R1",
      def: function () { return { ground: "a", nodes: { a: [3, 2], b: [3, 8], t1: [8, 8], t2: [12.5, 8], t3: [17, 8], u1: [8, 2], u2: [12.5, 2], u3: [17, 2] },
        show: { b: [0, 0.45], t1: [0, 0.45], a: [0, -0.75] }, junction: "t1", cell: "bat",
        branches: [
          { id: "bat", a: "a", b: "b", name: "I", parts: [{ kind: "E", key: "E1", at: [3, 5], name: "E₁" }] },
          { id: "wb", a: "b", b: "t1", name: "I", parts: [] },
          { id: "r1", a: "t1", b: "u1", name: "I_1", parts: [{ kind: "R", key: "R1", at: [8, 5], name: "R₁" }] },
          { id: "w12", a: "t1", b: "t2", name: "(I_2 + I_3)", parts: [] },
          { id: "r2", a: "t2", b: "u2", name: "I_2", parts: [{ kind: "R", key: "R2", at: [12.5, 5], name: "R₂" }] },
          { id: "w23", a: "t2", b: "t3", name: "I_3", parts: [] },
          { id: "r3", a: "t3", b: "u3", name: "I_3", parts: [{ kind: "R", key: "R3", at: [17, 5], name: "R₃" }] },
          { id: "x32", a: "u3", b: "u2", name: "I_3", parts: [] },
          { id: "x21", a: "u2", b: "u1", name: "(I_2 + I_3)", parts: [] },
          { id: "x1a", a: "u1", b: "a", name: "I", parts: [] }
        ], loops: [
          { name: "through R₁", path: [["bat", 1], ["wb", 1], ["r1", 1], ["x1a", 1]] },
          { name: "through R₃", path: [["bat", 1], ["wb", 1], ["w12", 1], ["w23", 1], ["r3", 1], ["x32", 1], ["x21", 1], ["x1a", 1]] },
          { name: "R₁ and R₂", path: [["w12", 1], ["r2", 1], ["x21", 1], ["r1", -1]] }
        ] }; } },
    mixed: { label: "Mixed", keys: ["E1", "R1", "R2", "R3"], defaults: { E1: 12, R1: 4, R2: 6, R3: 3 }, sel: "R2",
      def: function () { return { ground: "a", nodes: { a: [3, 2], b: [3, 8], t2: [11, 8], t3: [17, 8], u2: [11, 2], u3: [17, 2] },
        show: { b: [0, 0.45], t2: [0, 0.45], a: [0, -0.75] }, junction: "t2", cell: "bat",
        branches: [
          { id: "bat", a: "a", b: "b", name: "I", parts: [{ kind: "E", key: "E1", at: [3, 5], name: "E₁" }] },
          { id: "r1", a: "b", b: "t2", name: "I", parts: [{ kind: "R", key: "R1", at: [7, 8], name: "R₁" }] },
          { id: "r2", a: "t2", b: "u2", name: "I_2", parts: [{ kind: "R", key: "R2", at: [11, 5], name: "R₂" }] },
          { id: "w23", a: "t2", b: "t3", name: "I_3", parts: [] },
          { id: "r3", a: "t3", b: "u3", name: "I_3", parts: [{ kind: "R", key: "R3", at: [17, 5], name: "R₃" }] },
          { id: "x32", a: "u3", b: "u2", name: "I_3", parts: [] },
          { id: "x2a", a: "u2", b: "a", name: "I", parts: [] }
        ], loops: [
          { name: "through R₂", path: [["bat", 1], ["r1", 1], ["r2", 1], ["x2a", 1]] },
          { name: "through R₃", path: [["bat", 1], ["r1", 1], ["w23", 1], ["r3", 1], ["x32", 1], ["x2a", 1]] }
        ] }; } },
    network: { label: "Two batteries", keys: ["E1", "E2", "R1", "R2", "R3"], defaults: { E1: 10, E2: 8, R1: 2, R2: 2, R3: 4 }, sel: "R3",
      def: function () { return { ground: "a", nodes: { a: [3, 2], b: [3, 8], t: [10, 8], m: [10, 2], d: [17, 8], e: [17, 2] },
        show: { b: [0, 0.45], t: [0, 0.45], d: [0, 0.45], m: [0, -0.75] }, junction: "t", cell: "bat1",
        branches: [
          { id: "bat1", a: "a", b: "b", name: "I_1", parts: [{ kind: "E", key: "E1", at: [3, 5], name: "E₁" }] },
          { id: "r1", a: "b", b: "t", name: "I_1", parts: [{ kind: "R", key: "R1", at: [6.5, 8], name: "R₁" }] },
          { id: "r3", a: "t", b: "m", name: "I_3", parts: [{ kind: "R", key: "R3", at: [10, 5], name: "R₃" }] },
          { id: "xm", a: "m", b: "a", name: "I_1", parts: [] },
          { id: "bat2", a: "e", b: "d", name: "I_2", parts: [{ kind: "E", key: "E2", at: [17, 5], name: "E₂", side: -1 }] },
          { id: "r2", a: "d", b: "t", name: "I_2", parts: [{ kind: "R", key: "R2", at: [13.5, 8], name: "R₂", side: -1 }] },
          { id: "xe", a: "e", b: "m", name: "I_2", parts: [] }
        ], loops: [
          { name: "left loop", path: [["bat1", 1], ["r1", 1], ["r3", 1], ["xm", 1]] },
          { name: "right loop", path: [["bat2", 1], ["r2", 1], ["r3", 1], ["xe", -1]] },
          { name: "outer loop", path: [["bat1", 1], ["r1", 1], ["r2", -1], ["bat2", -1], ["xe", 1], ["xm", 1]] }
        ] }; } },
    battery: { label: "Battery with r", keys: ["E1", "r", "R"], defaults: { E1: 12, r: 2, R: 4 }, sel: "R",
      def: function () { return { ground: "a", nodes: { a: [3, 2], b: [3, 8], c: [17, 8], d: [17, 2] },
        show: { b: [0, 0.45], a: [0, -0.75] }, junction: "c", cell: "bat", meters: [{ n1: "b", n2: "a", at: [6.4, 5] }],
        branches: [
          { id: "bat", a: "a", b: "b", name: "I", box: true, parts: [{ kind: "E", key: "E1", at: [3, 4.3], name: "E" }, { kind: "r", key: "r", at: [3, 5.8], name: "r" }] },
          { id: "w", a: "b", b: "c", name: "I", parts: [] },
          { id: "load", a: "c", b: "d", name: "I", parts: [{ kind: "R", key: "R", at: [17, 5], name: "R" }] },
          { id: "bot", a: "d", b: "a", name: "I", parts: [{ kind: "A", at: [10, 2] }] }
        ], loops: [{ name: "the loop", path: [["bat", 1], ["w", 1], ["load", 1], ["bot", 1]] }] }; } }
  };

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 50;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: { x: 0, y: 520 }, g: 0, grid: false });

    /* ---------- state ---------- */
    var preset = "series", vals = {}, sel = "R2", lastR = "R2", loopIx = 0, c = null, cs = null, info = {};
    function val(k) { return vals[k]; }
    function valWith(k, v) { return function (q) { return q === k ? v : vals[q]; }; }

    /* ---------- controls ---------- */
    P.controls.innerHTML = "<h3>Circuit</h3>";
    var presetSeg = K.seg(Object.keys(PRESETS).map(function (k) { return { label: PRESETS[k].label, value: k }; }), preset,
      function (v) { setPreset(v); }, "Circuit");
    P.controls.appendChild(presetSeg);
    var valBox = K.h("<div></div>"), loopBox = K.h("<div></div>");
    P.controls.appendChild(K.h('<h3>Values <small class="muted">or click a part and drag it up or down</small></h3>'));
    P.controls.appendChild(valBox);
    P.controls.appendChild(K.h("<h3>Loop for KVL</h3>"));
    P.controls.appendChild(loopBox);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-ten"><i></i>current (dots: speed ∝ I)</span>' +
      '<span class="c-disp"><i></i>potential</span><span class="c-app"><i></i>cell / EMF</span><span class="c-fric"><i></i>heat in a resistor</span></div>'));
    var sliders = {};

    function setPreset(name, keepVals) {
      preset = name;
      presetSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === name)); });
      var pr = PRESETS[name];
      if (!keepVals) Object.keys(pr.defaults).forEach(function (k) { vals[k] = pr.defaults[k]; });
      sel = pr.sel; lastR = pr.sel; loopIx = 0;
      c = build(pr.def()); cs = build(pr.def());
      valBox.innerHTML = ""; sliders = {};
      pr.keys.forEach(function (k) {
        var d = DEF[k];
        sliders[k] = K.slider({ label: d.label, unit: d.unit, min: d.min, max: d.max, step: d.step, value: vals[k],
          onInput: function (v) { vals[k] = v; select(k); recompute(); } });
        valBox.appendChild(sliders[k].el);
      });
      loopBox.innerHTML = "";
      if (c.loops.length > 1) loopBox.appendChild(K.seg(c.loops.map(function (l, i) { return { label: l.name, value: i }; }), 0,
        function (v) { loopIx = v; recompute(); }, "Loop"));
      else loopBox.appendChild(K.h('<p class="control-hint">One loop: ' + c.loops[0].name + ".</p>"));
      reset();
    }
    function select(k) {
      sel = k;
      if (/^R/.test(k)) lastR = k;
      Object.keys(sliders).forEach(function (q) { sliders[q].el.style.outline = q === k ? "2px solid " + th.ten : ""; sliders[q].el.style.borderRadius = "8px"; });
    }

    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      c.branches.forEach(function (b) { b.phase = 0; });
      P.time.textContent = "t = 0.00 s";
      select(sel);
      recompute();
    }

    /* ---------- solving + derived numbers ---------- */
    function partOf(circ, key) {
      for (var i = 0; i < circ.branches.length; i++) for (var j = 0; j < circ.branches[i].parts.length; j++)
        if (circ.branches[i].parts[j].key === key) return { b: circ.branches[i], p: circ.branches[i].parts[j] };
      return null;
    }
    // Thevenin view of the circuit from resistor k: open it (huge R) for V_th, short it (tiny R) for I_sc
    function thevenin(k) {
      solveCircuit(cs, valWith(k, 1e9)); var voc = Math.abs(partOf(cs, k).b.I) * 1e9;
      solveCircuit(cs, valWith(k, 1e-9)); var isc = Math.abs(partOf(cs, k).b.I);
      return { V: voc, R: isc > 1e-12 ? voc / isc : Infinity };
    }
    function recompute() {
      solveCircuit(c, val);
      var cell = c.byId[c.cell], rIn = vals.r && preset === "battery" ? vals.r : 0;
      var sp = partOf(c, lastR), th0 = thevenin(lastR);
      info = {
        cell: cell, Icell: cell.I, Vterm: c.V[cell.b] - c.V[cell.a], r: rIn,
        sel: sp, Isel: sp.b.I, Vsel: sp.b.I * vals[lastR], Psel: sp.b.I * sp.b.I * vals[lastR], th: th0,
        heat: c.branches.reduce(function (s, b) { return s + b.I * b.I * b.R; }, 0),
        emfPower: c.branches.reduce(function (s, b) { return s + b.E * b.I; }, 0)
      };
      checkTries();
      theory(); update(true);
    }

    function checkTries() {
      if (preset === "parallel") {
        var I = ["r1", "r2", "r3"].map(function (id) { return Math.abs(c.byId[id].I); });
        for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) if (i !== j && I[j] > 1e-9 && Math.abs(I[i] / I[j] - 2) < 1e-6) tries.mark("share");
      }
      if (preset === "network") {
        ["bat1", "bat2"].forEach(function (id) { var b = c.byId[id]; if (b.E > 0 && b.I < -0.005) tries.mark("charging"); });
      }
      if (preset === "battery") {
        if (vals.r > 0 && Math.abs(vals.R - vals.r) < 1e-9) tries.mark("maxpower");
        if (vals.E1 > 0 && info.Vterm < vals.E1 / 2 - 1e-9) tries.mark("sag");
      }
    }

    /* ---------- dots ---------- */
    function speedK() {
      var imax = 0;
      c.branches.forEach(function (b) { imax = Math.max(imax, Math.abs(b.I)); });
      return imax * 1.2 > 9 ? 9 / imax : 1.2;            // units/s per ampere, the same for every wire on screen
    }
    sim.on("step", function () {
      var k = speedK();
      c.branches.forEach(function (b) { b.phase += k * b.I * K.DT; });
    });

    /* ---------- pointer: click a part, drag up/down to change it ---------- */
    var drag = null;
    function hit(m) {
      var best = null, bd = 0.85;
      c.branches.forEach(function (b) {
        b.parts.forEach(function (p) {
          if (!p.key) return;
          var q = pointAt(b, p.s), d = Math.hypot(q.x - m.x, q.y - m.y);
          if (d < bd) { bd = d; best = p; }
        });
      });
      return best;
    }
    sim.pointer({
      down: function (p) {
        var h = hit(p.m);
        if (!h) return false;
        select(h.key); drag = { key: h.key, y: p.py, v0: vals[h.key] };
        K.flash(P.note, "Drag up or down to change " + h.name);
        recompute();
      },
      drag: function (p) {
        if (!drag) return;
        var d = DEF[drag.key], v = K.clamp(drag.v0 + Math.round((drag.y - p.py) / 10) * d.step, d.min, d.max);
        if (v !== vals[drag.key]) { vals[drag.key] = v; sliders[drag.key].set(v); recompute(); }
      },
      up: function () { drag = null; },
      hover: function (p) { P.canvas.style.cursor = hit(p.m) ? "ns-resize" : "default"; }
    });

    /* ---------- drawing ---------- */
    function X(x, y) { return sim.px(x, y); }
    function wire(ctx, b, s0, s1) {
      if (s1 - s0 < 1e-6) return;
      var a = pointAt(b, s0), q = X(a.x, a.y);
      ctx.beginPath(); ctx.moveTo(q.x, q.y);
      for (var i = 1; i < b.pts.length; i++) if (b.cum[i] > s0 && b.cum[i] < s1) { q = X(b.pts[i].x, b.pts[i].y); ctx.lineTo(q.x, q.y); }
      a = pointAt(b, s1); q = X(a.x, a.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    function drawPart(ctx, b, p, pmax) {
      var m = pointAt(b, p.s), ux = m.ux, uy = m.uy, nx = -uy, ny = ux, side = p.side || 1, on = p.key && p.key === sel;
      var vert0 = Math.abs(uy) > 0.9;
      var at = function (s, off) { var q = pointAt(b, s); return X(q.x + nx * off, q.y + ny * off); };
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (p.kind === "R" || p.kind === "r") {
        var amp = p.kind === "R" ? 0.22 : 0.16, nz = 6, heat = pmax > 0 ? b.I * b.I * vals[p.key] / pmax : 0;
        var path = function () {
          ctx.beginPath(); var q0 = at(p.s0, 0); ctx.moveTo(q0.x, q0.y);
          for (var i = 0; i < nz; i++) { var q = at(p.s0 + (i + 0.5) / nz * (p.s1 - p.s0), (i % 2 ? -1 : 1) * amp); ctx.lineTo(q.x, q.y); }
          var q1 = at(p.s1, 0); ctx.lineTo(q1.x, q1.y);
        };
        if (heat > 0.01) { path(); ctx.strokeStyle = K.alpha(th.fric, 0.15 + 0.5 * heat); ctx.lineWidth = sim.u(12); ctx.stroke(); }
        path(); ctx.strokeStyle = on ? th.ten : th.ink; ctx.lineWidth = sim.u(on ? 3.5 : 2.5); ctx.stroke();
        var vert = Math.abs(uy) > 0.9, al = vert ? (nx * side > 0 ? "left" : "right") : "center", lp = at(p.s, side * (vert ? (b.box ? 0.8 : 0.42) : 0.62));
        K.label(ctx, p.name + " " + num(vals[p.key]) + " Ω", lp.x, lp.y + sim.u(7), on ? th.ink : th.muted, { s: sim.u(1), bg: on, align: al });
      } else if (p.kind === "E") {
        var neg = at(p.s - 0.1, 0), pos = at(p.s + 0.1, 0), L1 = 0.45 * ppm, L2 = 0.22 * ppm, nxp = nx, nyp = -ny;
        ctx.strokeStyle = th.app;
        ctx.lineWidth = sim.u(on ? 3.5 : 2.5); ctx.beginPath(); ctx.moveTo(pos.x - nxp * L1, pos.y - nyp * L1); ctx.lineTo(pos.x + nxp * L1, pos.y + nyp * L1); ctx.stroke();
        ctx.lineWidth = sim.u(6); ctx.beginPath(); ctx.moveTo(neg.x - nxp * L2, neg.y - nyp * L2); ctx.lineTo(neg.x + nxp * L2, neg.y + nyp * L2); ctx.stroke();
        var plus = at(p.s + 0.3, -side * 0.45);
        K.label(ctx, "+", plus.x, plus.y + sim.u(8), th.app, { s: sim.u(1.1) });
        var le = at(p.s, side * (vert0 ? (b.box ? 0.8 : 0.62) : 0.9));
        K.label(ctx, p.name + " " + num(vals[p.key]) + " V", le.x, le.y + sim.u(7), on ? th.ink : th.app, { s: sim.u(1), bg: on, align: vert0 ? (nx * side > 0 ? "left" : "right") : "center" });
      } else if (p.kind === "A") {
        var cA = at(p.s, 0);
        ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2);
        ctx.beginPath(); ctx.arc(cA.x, cA.y, 0.42 * ppm, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        K.label(ctx, "A", cA.x, cA.y + sim.u(8), th.ink, { s: sim.u(1.1) });
        K.label(ctx, K.fmt(Math.abs(b.I), 2) + " A", cA.x, cA.y + 0.5 * ppm + sim.u(20), th.ten, { s: sim.u(1), bg: true });
      }
    }
    sim.on("under", function (ctx) {
      if (!c) return;
      var pmax = 0;
      c.branches.forEach(function (b) { pmax = Math.max(pmax, b.I * b.I * b.R); });
      // wires, leaving gaps where the parts sit
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5); ctx.lineCap = "round";
      c.branches.forEach(function (b) {
        var s = 0;
        b.parts.forEach(function (p) { wire(ctx, b, s, p.s0); s = p.s1; });
        wire(ctx, b, s, b.L);
      });
      c.branches.forEach(function (b) {
        if (b.box) {                                    // dashed outline: the cell and its internal resistance are one battery
          var q0 = pointAt(b, b.parts[0].s0 - 0.35), q1 = pointAt(b, b.parts[b.parts.length - 1].s1 + 0.45);
          var A0 = X(Math.min(q0.x, q1.x) - 0.6, Math.max(q0.y, q1.y)), A1 = X(Math.max(q0.x, q1.x) + 0.6, Math.min(q0.y, q1.y));
          ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1.5);
          ctx.strokeRect(A0.x, A0.y, A1.x - A0.x, A1.y - A0.y); ctx.restore();
          K.label(ctx, "battery", A0.x + (A1.x - A0.x) / 2, A0.y - sim.u(1), th.muted, { s: sim.u(0.85) });
        }
        b.parts.forEach(function (p) { drawPart(ctx, b, p, pmax); });
      });
      (c.meters || []).forEach(function (mt) {
        var cm = X(mt.at[0], mt.at[1]);
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = th.disp; ctx.lineWidth = sim.u(1.5);
        [mt.n1, mt.n2].forEach(function (n) { var q = X(c.nodes[n][0], c.nodes[n][1]); ctx.beginPath(); ctx.moveTo(cm.x, cm.y); ctx.lineTo(q.x, q.y); ctx.stroke(); });
        ctx.restore();
        ctx.fillStyle = th.surface; ctx.strokeStyle = th.disp; ctx.lineWidth = sim.u(2);
        ctx.beginPath(); ctx.arc(cm.x, cm.y, 0.48 * ppm, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        K.label(ctx, "V", cm.x, cm.y + sim.u(8), th.disp, { s: sim.u(1.1) });
        K.label(ctx, K.fmt(c.V[mt.n1] - c.V[mt.n2], 2) + " V", cm.x + 0.7 * ppm, cm.y + sim.u(7), th.disp, { s: sim.u(1), align: "left", bg: true });
      });
    });
    sim.on("over", function (ctx) {
      if (!c) return;
      // charges: conventional current, spaced evenly, moving at a speed proportional to the branch current
      var gap = 0.55;
      ctx.fillStyle = th.ten;
      c.branches.forEach(function (b) {
        if (Math.abs(b.I) < 1e-6) return;
        var n = Math.max(1, Math.round(b.L / gap)), g = b.L / n;
        for (var i = 0; i < n; i++) {
          var s = ((b.phase + i * g) % b.L + b.L) % b.L, inside = false;
          b.parts.forEach(function (p) { if (s > p.s0 - 0.05 && s < p.s1 + 0.05 && p.kind !== "R" && p.kind !== "r") inside = true; });
          if (inside) continue;
          var q = pointAt(b, s), px = X(q.x, q.y);
          ctx.beginPath(); ctx.arc(px.x, px.y, sim.u(3.4), 0, Math.PI * 2); ctx.fill();
        }
        // direction arrow on the longest straight run, labelled with the current
        if (b.L > 2) {
          var s0 = b.parts.length ? (b.parts[b.parts.length - 1].s1 + b.L) / 2 : b.L / 2;
          if (b.parts.length && s0 > b.L - 0.4) s0 = b.parts[0].s0 / 2;
          var a = pointAt(b, s0), dir = b.I > 0 ? 1 : -1, p0 = X(a.x - a.ux * 0.3 * dir, a.y - a.uy * 0.3 * dir), p1 = X(a.x + a.ux * 0.3 * dir, a.y + a.uy * 0.3 * dir);
          K.arrow(ctx, p0.x, p0.y, p1.x, p1.y, th.ten, { s: sim.u(1), width: 3, head: 10 });
        }
      });
      Object.keys(c.show || {}).forEach(function (n) {
        var q = X(c.nodes[n][0], c.nodes[n][1]), o = c.show[n];
        ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(q.x, q.y, sim.u(4.5), 0, Math.PI * 2); ctx.fill();
        K.label(ctx, K.fmt(c.V[n], 2) + " V", q.x + o[0] * ppm, q.y - o[1] * ppm, th.disp, { s: sim.u(1), bg: true });
      });
      // the junction for KCL
      var jq = X(c.nodes[c.junction][0], c.nodes[c.junction][1]);
      ctx.strokeStyle = th.acc; ctx.lineWidth = sim.u(2); ctx.beginPath(); ctx.arc(jq.x, jq.y, sim.u(11), 0, Math.PI * 2); ctx.stroke();
      // highlight the KVL loop
      var loop = c.loops[loopIx];
      ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = th.acc; ctx.lineWidth = sim.u(12); ctx.lineCap = "round";
      loop.path.forEach(function (e) { wire(ctx, c.byId[e[0]], 0, c.byId[e[0]].L); });
      ctx.restore();
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">V round the loop</b> · walk the highlighted loop: rises at cells, drops across resistors, back to the start (KVL)</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">P vs R</b> · power in the selected resistor as you change it; dashed: $\\frac{V_{th}^2R}{(R+R_{th})^2}$, peak at $R = R_{th}$</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-app">terminal V vs I</b> · for cell $E_1$ as the selected resistor changes; dashed: $V = E - Ir$</p></div>';
    P.graphs.querySelectorAll(".graph-cap").forEach(function (cp) { cp.innerHTML = K.md(cp.innerHTML); });
    var cv = P.graphs.querySelectorAll("canvas");
    var gV = new K.Graph(cv[0], { yLabel: "V (V)", xLabel: "along the loop", xMax: 10, xAuto: true, color: th.disp });
    var gP = new K.Graph(cv[1], { yLabel: "P (W)", xLabel: "R (Ω)", xMax: 20, yMin: 0, color: th.acc });
    var gT = new K.Graph(cv[2], { yLabel: "V (V)", xLabel: "I (A)", xMax: 1, xAuto: true, yMin: 0, color: th.app });

    function loopWalk() {
      var loop = c.loops[loopIx], pts = [], x = 0;
      loop.path.forEach(function (e) {
        var b = c.byId[e[0]], dir = e[1], ss = [0, b.L];
        b.parts.forEach(function (p) { ss.push(p.s0, p.s1, p.s); });
        for (var s = 0.25; s < b.L; s += 0.25) ss.push(s);
        ss.sort(function (u, v) { return u - v; });
        if (dir < 0) ss = ss.slice().reverse();
        ss.forEach(function (s, i) {
          var d = dir > 0 ? s : b.L - s;
          pts.push([x + d, vAlong(c, b, s, val)]);
          void i;
        });
        x += b.L;
      });
      return pts;
    }
    function theory() {
      var k = lastR, d = DEF[k], pp = [], pf = [], vt = [], vtf = [], th0 = info.th, cellId = c.cell, Imax = 0;
      for (var R = d.min / 5; R <= d.max + 1e-9; R += 0.1) {
        solveCircuit(cs, valWith(k, R));
        var pb = partOf(cs, k).b, cb = cs.byId[cellId];
        pp.push([R, pb.I * pb.I * R]);
        pf.push([R, th0.V * th0.V * R / Math.pow(R + th0.R, 2)]);
        if (cb.I >= 0) { vt.push([cb.I, cs.V[cb.b] - cs.V[cb.a]]); Imax = Math.max(Imax, cb.I); }
      }
      vt.sort(function (u, v) { return u[0] - v[0]; });
      var E = vals.E1, r = info.r;
      for (var i = 0; i <= 40; i++) { var I = Imax * 1.05 * i / 40; vtf.push([I, E - I * r]); }
      gP.set("theory", { points: pf, color: th.acc, dash: [5, 5], width: 1.5 });
      gP.set("sim", { points: pp, color: th.acc, width: 2.5 });
      gT.set("theory", { points: vtf, color: th.app, dash: [5, 5], width: 1.5 });
      gT.set("sim", { points: vt, color: th.app, width: 2.5 });
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      gV.set("sim", { points: loopWalk(), color: th.disp, width: 2.5 });
      gV.dirty = true;
      var th0 = info.th;
      gP.extra = function (ctx, Xf, Yf) {
        ring(ctx, Xf(vals[lastR]), Yf(info.Psel));
        if (isFinite(th0.R) && th0.R <= 20) {
          ctx.strokeStyle = K.alpha(th.muted, 0.8); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(Xf(th0.R), Yf(0)); ctx.lineTo(Xf(th0.R), Yf(th0.V * th0.V / (4 * th0.R))); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = th.muted; ctx.font = "600 10px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.fillText("R = R_th", Xf(th0.R) + 4, Yf(0) - 8);
        }
      };
      gT.extra = function (ctx, Xf, Yf) { if (info.Icell >= 0) ring(ctx, Xf(info.Icell), Yf(info.Vterm)); };
      [gV, gP, gT].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Ohm's law for the selected resistor", "Junction rule (KCL) at the ringed junction", "Loop rule (KVL) round the highlighted loop", "The cell: terminal voltage and power"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var setR = K.readout(P.readouts, [
      { id: "Ic", label: "current from E₁", cls: "c-ten" }, { id: "Vt", label: "terminal voltage of E₁", cls: "c-disp" },
      { id: "Is", label: "current in R", cls: "c-ten" }, { id: "Vs", label: "voltage across R", cls: "c-disp" },
      { id: "Ps", label: "power in R", cls: "c-fric" }, { id: "heat", label: "total heat rate ΣI²R", cls: "c-fric" },
      { id: "emf", label: "cells' power ΣEI", cls: "c-app" }, { id: "eta", label: "efficiency", cls: "c-acc" }
    ]);
    function kclTex() {
      var j = c.junction, ins = [], outs = [];
      c.branches.forEach(function (b) {
        if (b.a !== j && b.b !== j) return;
        var into = b.b === j ? b.I : -b.I;
        if (into > 1e-9) ins.push({ n: b.name, v: into }); else if (into < -1e-9) outs.push({ n: b.name, v: -into });
      });
      if (!ins.length) return "\\text{no current: } 0 = 0";
      var sum = function (a) { return a.reduce(function (s, q) { return s + q.v; }, 0); };
      return "\\underbrace{" + ins.map(function (q) { return q.n; }).join(" + ") + "}_{\\text{in}} = \\underbrace{" + outs.map(function (q) { return q.n; }).join(" + ") + "}_{\\text{out}}" +
        "\\;\\Rightarrow\\; " + ins.map(function (q) { return K.fmt(q.v, 2); }).join(" + ") + " = " + outs.map(function (q) { return K.fmt(q.v, 2); }).join(" + ") +
        " = \\mathbf{" + K.fmt(sum(outs), 2) + "}\\ \\text{A}";
    }
    function kvlTex() {
      var loop = c.loops[loopIx], sym = [], nums = [], total = 0;
      loop.path.forEach(function (e) {
        var b = c.byId[e[0]], dir = e[1], parts = dir > 0 ? b.parts : b.parts.slice().reverse();
        parts.forEach(function (p) {
          if (p.kind === "E") {
            var E = vals[p.key]; total += dir * E;
            sym.push((dir > 0 ? "+ " : "- ") + TEXN[p.key]); nums.push((dir > 0 ? "+ " : "- ") + num(E));
          } else if (p.kind === "R" || p.kind === "r") {
            var R = vals[p.key]; total -= dir * b.I * R;
            sym.push((dir > 0 ? "- " : "+ ") + b.name.replace(/[()]/g, "") + TEXN[p.key]);
            nums.push((dir > 0 ? "- " : "+ ") + "(" + K.fmt(b.I, 2) + ")(" + num(R) + ")");
          }
        });
      });
      var strip = function (a) { var s = a.join(" "); return s.charAt(0) === "+" ? s.slice(2) : s; };
      return strip(sym) + " = " + strip(nums) + " = \\mathbf{" + K.fmt(total, 2) + "}";
    }
    function renderMaths() {
      var k = lastR, sp = info.sel, Rv = vals[k], cell = info.cell;
      K.tex(eqEls[0], "V_{" + TEXN[k] + "} = " + sp.b.name.replace(/[()]/g, "") + TEXN[k] + " = (" + K.fmt(info.Isel, 2) + ")(" + num(Rv) + ") = \\mathbf{" + K.fmt(info.Vsel, 2) + "}\\ \\text{V}");
      K.tex(eqEls[1], kclTex());
      K.tex(eqEls[2], kvlTex());
      if (preset === "battery") {
        var E = vals.E1, r = vals.r, R = vals.R;
        K.tex(eqEls[3], "V = E - Ir = " + num(E) + " - (" + K.fmt(info.Icell, 2) + ")(" + num(r) + ") = \\mathbf{" + K.fmt(info.Vterm, 2) + "}\\ \\text{V},\\quad " +
          "P_R = \\frac{E^2R}{(R+r)^2} = \\frac{(" + num(E) + ")^2(" + num(R) + ")}{(" + num(R) + " + " + num(r) + ")^2} = \\mathbf{" + K.fmt(info.Psel, 2) + "}\\ \\text{W}" +
          (r > 0 ? " \\le \\frac{E^2}{4r} = " + K.fmt(E * E / (4 * r), 2) + "\\ \\text{W}" : ""));
      } else {
        K.tex(eqEls[3], "V = E_1 - I_1 r = E_1 = \\mathbf{" + K.fmt(info.Vterm, 2) + "}\\ \\text{V}\\ (r = 0),\\quad \\sum EI = " + K.fmt(info.emfPower, 2) + "\\ \\text{W} = \\sum I^2R = \\mathbf{" + K.fmt(info.heat, 2) + "}\\ \\text{W}");
        void cell;
      }
      setR("Ic", K.fmt(info.Icell, 2) + " A", info.Icell < -1e-9 ? "backwards: being charged" : "");
      setR("Vt", K.fmt(info.Vterm, 2) + " V", "EMF " + num(vals.E1) + " V");
      var nm = DEF[k].label.replace(/\$|\\/g, "").replace("Load ", "");
      P.readouts.querySelectorAll(".readout span")[2].textContent = "current in " + nm;
      P.readouts.querySelectorAll(".readout span")[3].textContent = "voltage across " + nm;
      P.readouts.querySelectorAll(".readout span")[4].textContent = "power in " + nm;
      setR("Is", K.fmt(Math.abs(info.Isel), 3) + " A");
      setR("Vs", K.fmt(Math.abs(info.Vsel), 2) + " V", "= IR");
      setR("Ps", K.fmt(info.Psel, 2) + " W", "max " + K.fmt(info.th.V * info.th.V / (4 * info.th.R), 2) + " W at R = " + K.fmt(info.th.R, 2) + " Ω");
      setR("heat", K.fmt(info.heat, 2) + " W");
      setR("emf", K.fmt(info.emfPower, 2) + " W", "equals the heat: energy is conserved");
      setR("eta", preset === "battery" && vals.E1 > 0 ? K.fmt(100 * info.Vterm / vals.E1, 1) + " %" : "100 %", preset === "battery" ? "V / E = R / (R + r)" : "ideal cell");
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p><b>Ohm's law</b> $V = IR$ is a rule for one resistor. Two more rules handle any network. The <b>junction rule</b> (KCL): charge doesn't pile up, so the current into a junction equals the current out. The <b>loop rule</b> (KVL): potential is a height, so walking round any closed loop, the rises at cells and the drops $IR$ across resistors add to zero.</p>" +
      "<p>Series resistors share one current and add: $R = R_1 + R_2 + \\dots$. Parallel resistors share one voltage and add as $\\frac1R = \\frac1{R_1} + \\frac1{R_2} + \\dots$. A real cell is an ideal EMF $E$ in series with an <b>internal resistance</b> $r$: its terminal voltage is $V = E - Ir$, and the load gets the most power when $R = r$.</p>" +
      '<div class="trap"><b>JEE trap: maximum power is not maximum efficiency.</b> At $R = r$ the load gets $E^2/4r$, but just as much heats the battery itself, so the efficiency is only 50 %. Efficiency $\\eta = R/(R+r)$ keeps rising as $R$ grows while the power falls.</div>');
    function apply(s) {
      setPreset(s.preset, true);
      Object.keys(s).forEach(function (k) { if (k !== "preset" && sliders[k]) { vals[k] = s[k]; sliders[k].set(s[k]); } });
      if (s.sel) select(s.sel);
      reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "series–parallel", setup: { preset: "mixed", E1: 12, R1: 2, R2: 6, R3: 3 }, watch: "Predict the current from the cell, then read the ammeter numbers",
        q: "A 12 V ideal cell drives $R_1 = 2\\ \\Omega$ in series with $R_2 = 6\\ \\Omega$ and $R_3 = 3\\ \\Omega$ in parallel. What current leaves the cell?",
        options: ["3 A", "1.09 A", "6 A", "2 A"], answer: 0,
        explain: "The parallel pair is $\\frac{6 \\times 3}{6 + 3} = 2\\ \\Omega$, so the total is $2 + 2 = 4\\ \\Omega$ and $I = 12/4 = 3$ A. 1.09 A comes from putting all three in series; 6 A forgets $R_1$." },
      { level: "medium", tag: "maximum power", setup: { preset: "battery", E1: 10, r: 2, R: 2, sel: "R" }, watch: "Drag R either side of 2 Ω and watch the power fall",
        q: "A battery of EMF 10 V and internal resistance 2 Ω is connected to a variable resistor $R$. What is the greatest power that can be delivered to $R$?",
        options: ["12.5 W", "25 W", "50 W", "6.25 W"], answer: 0,
        hints: ["$P = I^2R = \\frac{E^2R}{(R+r)^2}$. For which $R$ is this largest?", "It peaks at $R = r$. Put that back in."],
        explain: "The power peaks at $R = r = 2\\ \\Omega$: $I = 10/4 = 2.5$ A and $P = (2.5)^2(2) = 12.5$ W $= E^2/4r$. 50 W is $E^2/r$, the power if the battery were short-circuited, all of it wasted inside." },
      { level: "hard", tag: "two-battery network", setup: { preset: "network", E1: 10, E2: 4, R1: 2, R2: 4, R3: 4, sel: "R3" }, watch: "Predict I₃ and the direction of I₂, then read the KCL line",
        q: "Two ideal cells, $E_1 = 10$ V with $R_1 = 2\\ \\Omega$ and $E_2 = 4$ V with $R_2 = 4\\ \\Omega$, both have their + terminals joined (through their resistors) to a junction, which connects through $R_3 = 4\\ \\Omega$ to the common − line. Find the current in $R_3$ and say what happens in $E_2$.",
        options: ["1.5 A; 0.5 A flows backwards through $E_2$ (it is charged)", "1.5 A; $E_2$ supplies 0.5 A", "1.75 A; $E_2$ supplies 1 A", "0.6 A; no current in $E_2$"], answer: 0,
        hints: ["Call the junction potential $V$ (the − line is 0). KCL: $\\frac{10 - V}{2} + \\frac{4 - V}{4} = \\frac{V}{4}$.", "Solve for $V$, then $I_2 = \\frac{4 - V}{4}$. A negative answer means it flows the other way."],
        explain: "KCL gives $5 - \\frac V2 + 1 - \\frac V4 = \\frac V4$, so $V = 6$ V. Then $I_3 = 6/4 = 1.5$ A, $I_1 = (10 - 6)/2 = 2$ A and $I_2 = (4 - 6)/4 = -0.5$ A: the junction sits above $E_2$'s EMF, so 0.5 A is driven backwards through it. Check: $2 - 0.5 = 1.5$ A." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Flow", onReset: reset });
    setPreset("series");

    if (location.hostname === "localhost") {
      window.__lab_circuits = {
        apply: apply, setPreset: setPreset, select: select,
        set: function (k, v) { vals[k] = v; if (sliders[k]) sliders[k].set(v); recompute(); },
        loop: function (i) { loopIx = i; recompute(); },
        state: function () {
          var I = {}; c.branches.forEach(function (b) { I[b.id] = b.I; });
          return { preset: preset, I: I, V: c.V, info: info, vals: vals, kcl: kclTex(), kvl: kvlTex(), walk: loopWalk(), speedK: speedK(),
            phase: c.branches.map(function (b) { return b.phase; }) };
        }
      };
    }

    return function destroy() { sim.destroy(); [gV, gP, gT].forEach(function (g) { g.destroy(); }); };
  }
})();
