/* Current electricity, lab 2: the Wheatstone bridge and the meter bridge, with the galvanometer current solved exactly. */
(function () {
  "use strict";
  var LAM = 0.04;                 // meter-bridge wire: 0.04 Ω per cm, 4 Ω for the full 100 cm
  var UPC = 0.14;                 // drawing: 100 cm of wire is 14 units long
  var MYSTERY = [2.5, 3.5, 4.5, 6.5, 7.5, 8.5, 11.5, 13.5, 16.5, 18.5];

  var lab = {
    id: "bridge", chapter: "current", title: "Wheatstone & meter bridge", short: "balance, null point, end error",
    lede: "Four resistors, one galvanometer across the middle. When it reads zero the bridge is balanced, and then $P/Q = R/S$ whatever the battery or the meter. Slide the jockey along a metre of wire to find the null and weigh an unknown resistance.",
    tries: [
      { id: "balance", title: "Balance the bridge with P ≠ Q",
        text: "Make the galvanometer read exactly zero with unequal $P$ and $Q$.",
        why: "Zero current through G means B and D sit at the same potential. That needs the same fraction of the voltage dropped on each side: $\\frac{P}{P+Q} = \\frac{R}{R+S}$, which is $P/Q = R/S$. A ratio, not equal resistors." },
      { id: "robust", title: "Show balance ignores E and G",
        text: "Balance the bridge, then change the battery EMF or the galvanometer resistance. Does it stay balanced?",
        why: "Balance is a statement about ratios of resistances only. $E$ scales every potential equally, and with no current in G its resistance never enters. That's why a null method is so accurate." },
      { id: "mystery", title: "Weigh the mystery resistor",
        text: "Switch on Mystery X in the meter bridge and slide the jockey to the null point (within 0.3 cm).",
        why: "At the null, $\\frac{R}{X} = \\frac{l}{100 - l}$, so $X = R\\frac{100 - l}{l}$. You never need to know the battery, the wire's resistance or the galvanometer's." },
      { id: "swap", title: "Catch the end error by swapping",
        text: "With an end error switched on, find the null, swap R and X, and find the null again.",
        why: "Extra resistance at the ends (the copper strips, the solder) acts like extra wire $\\alpha$, $\\beta$. One reading can't separate it from the answer; two readings with the resistors swapped give two equations for $\\alpha$ and $\\beta$." }
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

  var DEF = {
    P: { label: "$P$", unit: "Ω", min: 1, max: 100, step: 1 }, Q: { label: "$Q$", unit: "Ω", min: 1, max: 100, step: 1 },
    R: { label: "$R$ (known)", unit: "Ω", min: 1, max: 100, step: 1 }, S: { label: "$S$", unit: "Ω", min: 1, max: 100, step: 1 },
    E: { label: "Battery EMF $E$", unit: "V", min: 1, max: 12, step: 0.5 }, G: { label: "Galvanometer resistance $G$", unit: "Ω", min: 1, max: 200, step: 1 },
    Rb: { label: "Resistance box $R$", unit: "Ω", min: 1, max: 30, step: 0.5 }, X: { label: "Unknown $X$", unit: "Ω", min: 1, max: 30, step: 0.5 },
    l: { label: "Jockey position $l$", unit: "cm", min: 0.5, max: 99.5, step: 0.1 },
    al: { label: "End error at A, $\\alpha$", unit: "cm", min: 0, max: 3, step: 0.5 }, be: { label: "End error at C, $\\beta$", unit: "cm", min: 0, max: 3, step: 0.5 }
  };

  function wheatDef() {
    return { ground: "C", nodes: { A: [4, 5], B: [10, 8.6], C: [16, 5], D: [10, 1.4] }, show: { A: [-0.9, 0.3], B: [0, 0.5], C: [0.95, 0.3], D: [0, -0.8] },
      branches: [
        { id: "p", a: "A", b: "B", parts: [{ kind: "R", key: "P", at: [7, 6.8], name: "P" }] },
        { id: "q", a: "B", b: "C", parts: [{ kind: "R", key: "Q", at: [13, 6.8], name: "Q" }] },
        { id: "r", a: "A", b: "D", parts: [{ kind: "R", key: "R", at: [7, 3.2], name: "R", side: -1 }] },
        { id: "s", a: "D", b: "C", parts: [{ kind: "R", key: "S", at: [13, 3.2], name: "S", side: -1 }] },
        { id: "g", a: "B", b: "D", parts: [{ kind: "G", key: "G", at: [10, 5], name: "G" }] },
        { id: "bat", a: "C", b: "A", via: [[18.6, 5], [18.6, 0.8], [1.6, 0.8], [1.6, 5]], parts: [{ kind: "E", key: "E", at: [5, 0.8], name: "E", lab: [0.7, 0.55] }] }
      ] };
  }
  function meterDef(l, swapped) {
    var xj = 3 + UPC * l, Lk = swapped ? "X" : "Rb", Rk = swapped ? "Rb" : "X", nm = function (k) { return k === "X" ? "X" : "R"; };
    return { ground: "C", nodes: { A: [3, 2.8], C: [17, 2.8], D: [10, 6.6], J: [xj, 2.8] }, show: { A: [-0.75, 0.25], D: [0, 0.5], C: [0.75, 0.25] }, swapped: swapped,
      branches: [
        { id: "left", a: "A", b: "D", via: [[3, 6.6]], parts: [{ kind: "R", key: Lk, at: [6.5, 6.6], name: nm(Lk) }] },
        { id: "right", a: "D", b: "C", via: [[17, 6.6]], parts: [{ kind: "R", key: Rk, at: [13.5, 6.6], name: nm(Rk) }] },
        { id: "wl", a: "A", b: "J", parts: [{ kind: "W", key: "WL", at: [(3 + xj) / 2, 2.8], len: xj - 3 }] },
        { id: "wr", a: "J", b: "C", parts: [{ kind: "W", key: "WR", at: [(17 + xj) / 2, 2.8], len: 17 - xj }] },
        { id: "g", a: "D", b: "J", via: [[10, 4.4]], parts: [{ kind: "G", key: "G", at: [10, 5.5], name: "G" }] },
        { id: "bat", a: "C", b: "A", via: [[18.4, 2.8], [18.4, 0.8], [1.6, 0.8], [1.6, 2.8]], parts: [{ kind: "E", key: "E", at: [5, 0.8], name: "E", lab: [0.7, 0.55] }] }
      ] };
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 520, ppm = 50;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: ppm, origin: { x: 0, y: 520 }, g: 0, grid: false });

    /* ---------- state ---------- */
    var mode = "wheat", swapped = false, mystery = false, sel = "S";
    var vals = { P: 10, Q: 20, R: 15, S: 25, E: 6, G: 20, Rb: 4, X: 6, l: 30, al: 0, be: 0 };
    var c = null, info = {}, nulls = {}, balancedAt = null;
    function val(k) {
      if (k === "WL") return LAM * (vals.l + vals.al);
      if (k === "WR") return LAM * (100 - vals.l + vals.be);
      return vals[k];
    }

    /* ---------- controls ---------- */
    P.controls.innerHTML = "<h3>Bridge</h3>";
    var modeSeg = K.seg([{ label: "Wheatstone bridge", value: "wheat" }, { label: "Meter bridge", value: "meter" }], mode, function (v) { setMode(v); }, "Bridge");
    P.controls.appendChild(modeSeg);
    var sliders = {};
    function mk(k) {
      var d = DEF[k];
      sliders[k] = K.slider({ label: d.label, unit: d.unit, min: d.min, max: d.max, step: d.step, value: vals[k],
        onInput: function (v) { vals[k] = v; if (k !== "l") select(k); recompute(); } });
      return sliders[k].el;
    }
    var wheatBox = K.h('<div><h3>Arms <small class="muted">or click one and drag up or down</small></h3></div>');
    ["P", "Q", "R", "S"].forEach(function (k) { wheatBox.appendChild(mk(k)); });
    var meterBox = K.h("<div><h3>Gaps and jockey</h3></div>");
    ["Rb", "X", "l"].forEach(function (k) { meterBox.appendChild(mk(k)); });
    var mysteryRow = K.h('<div class="row"></div>');
    mysteryRow.appendChild(K.check("Mystery X", false, function (v) { setMystery(v); }));
    var swapBtn = K.h('<button class="btn btn-sm" type="button">Swap R and X</button>');
    swapBtn.addEventListener("click", function () { swapped = !swapped; build0(); recompute(); K.flash(P.note, swapped ? "X is in the left gap now" : "R is back in the left gap"); });
    mysteryRow.appendChild(swapBtn);
    meterBox.appendChild(mysteryRow);
    meterBox.appendChild(K.h("<h3>End errors</h3>"));
    ["al", "be"].forEach(function (k) { meterBox.appendChild(mk(k)); });
    var common = K.h("<div><h3>Battery and meter</h3></div>");
    ["E", "G"].forEach(function (k) { common.appendChild(mk(k)); });
    [wheatBox, meterBox, common].forEach(function (b) { P.controls.appendChild(b); });
    P.controls.appendChild(K.h('<div class="legend"><span class="c-ten"><i></i>current (dots: speed ∝ I)</span><span class="c-disp"><i></i>potential</span>' +
      '<span class="c-app"><i></i>cell</span><span class="c-acc"><i></i>galvanometer</span></div>'));

    function setMode(m) {
      mode = m;
      modeSeg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.value === m)); });
      wheatBox.hidden = m !== "wheat"; meterBox.hidden = m !== "meter";
      sel = m === "wheat" ? "S" : "Rb";
      build0(); reset();
    }
    function setMystery(on) {
      mystery = on;
      if (on) { var x; do { x = MYSTERY[Math.floor(Math.random() * MYSTERY.length)]; } while (x === vals.X); vals.X = x; sliders.X.set(x); }
      sliders.X.el.hidden = on;
      mysteryRow.querySelector("input").checked = on;
      recompute();
    }
    function select(k) {
      sel = k;
      Object.keys(sliders).forEach(function (q) { sliders[q].el.style.outline = q === k ? "2px solid " + th.ten : ""; sliders[q].el.style.borderRadius = "8px"; });
    }
    function build0() {
      var keep = c ? c.branches.map(function (b) { return b.phase; }) : null;
      c = build(mode === "wheat" ? wheatDef() : meterDef(vals.l, swapped));
      if (keep) c.branches.forEach(function (b, i) { b.phase = keep[i] || 0; });
    }
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      c.branches.forEach(function (b) { b.phase = 0; });
      P.time.textContent = "t = 0.00 s";
      select(sel); recompute();
    }

    /* ---------- physics ---------- */
    function par(a, b) { return a * b / (a + b); }
    // Thevenin across the galvanometer (ideal cell): I_g = (V₁ − V₂)/(R_th + G)
    function wheatFormula(v) {
      var VB = v.E * v.Q / (v.P + v.Q), VD = v.E * v.S / (v.R + v.S);
      return { VB: VB, VD: VD, Rth: par(v.P, v.Q) + par(v.R, v.S), Ig: (VB - VD) / (par(v.P, v.Q) + par(v.R, v.S) + v.G) };
    }
    function gaps() { return swapped ? { L: vals.X, R: vals.Rb } : { L: vals.Rb, R: vals.X }; }
    function meterFormula(v, l) {
      var g = gaps(), WL = LAM * (l + v.al), WR = LAM * (100 - l + v.be);
      var VD = v.E * g.R / (g.L + g.R), VJ = v.E * WR / (WL + WR), Rth = par(g.L, g.R) + par(WL, WR);
      return { VD: VD, VJ: VJ, Rth: Rth, Ig: (VD - VJ) / (Rth + v.G) };
    }
    // the null: (l + α)/(100 − l + β) = left/right
    function nullL() { var g = gaps(); return (g.L * (100 + vals.be) - g.R * vals.al) / (g.L + g.R); }
    function recompute() {
      if (mode === "meter") { var J = c.nodes.J; if (Math.abs(J[0] - (3 + UPC * vals.l)) > 1e-9) build0(); }
      solveCircuit(c, val);
      var Ig = c.byId.g.I;
      info = { Ig: Ig, f: mode === "wheat" ? wheatFormula(vals) : meterFormula(vals, vals.l) };
      if (mode === "meter") { info.l0 = nullL(); info.atNull = Math.abs(vals.l - info.l0) <= 0.3; }
      checkTries();
      theory(); update(true);
    }
    function checkTries() {
      if (mode === "wheat") {
        var bal = Math.abs(info.Ig) < 1e-9;
        if (bal && vals.P !== vals.Q) tries.mark("balance");
        if (bal) {
          var key = [vals.P, vals.Q, vals.R, vals.S].join(",");
          if (balancedAt && balancedAt.key === key && (balancedAt.E !== vals.E || balancedAt.G !== vals.G)) tries.mark("robust");
          if (!balancedAt || balancedAt.key !== key) balancedAt = { key: key, E: vals.E, G: vals.G };
        }
      } else if (info.atNull) {
        if (mystery) tries.mark("mystery");
        var k = [vals.Rb, vals.X, vals.al, vals.be].join(",");
        nulls[swapped ? "b" : "a"] = { key: k, l: vals.l };
        if (vals.al + vals.be > 0 && nulls.a && nulls.b && nulls.a.key === k && nulls.b.key === k) tries.mark("swap");
      }
    }

    /* ---------- dots ---------- */
    function speedK() {
      var imax = 0;
      c.branches.forEach(function (b) { imax = Math.max(imax, Math.abs(b.I)); });
      return imax > 0 ? 4 / imax : 0;                   // the biggest current on screen moves at 4 units/s; the rest in proportion
    }
    sim.on("step", function () { var k = speedK(); c.branches.forEach(function (b) { b.phase += k * b.I * K.DT; }); });

    /* ---------- pointer ---------- */
    var drag = null;
    function hit(m) {
      if (mode === "meter" && m.y > 1.9 && m.y < 4.2 && m.x > 2.6 && m.x < 17.4) return { jockey: true };
      var best = null, bd = 0.85;
      c.branches.forEach(function (b) {
        b.parts.forEach(function (p) {
          if (!p.key || p.kind === "W" || (p.key === "X" && mystery)) return;
          var q = pointAt(b, p.s), d = Math.hypot(q.x - m.x, q.y - m.y);
          if (d < bd) { bd = d; best = p; }
        });
      });
      return best;
    }
    function setL(x) {
      var l = K.clamp(Math.round((x - 3) / UPC * 10) / 10, 0.5, 99.5);
      if (l !== vals.l) { vals.l = l; sliders.l.set(l); recompute(); }
    }
    sim.pointer({
      down: function (p) {
        var h = hit(p.m);
        if (!h) return false;
        if (h.jockey) { drag = { jockey: true }; setL(p.m.x); return; }
        select(h.key); drag = { key: h.key, y: p.py, v0: vals[h.key] };
        K.flash(P.note, "Drag up or down to change " + h.name);
        recompute();
      },
      drag: function (p) {
        if (!drag) return;
        if (drag.jockey) { setL(p.m.x); return; }
        var d = DEF[drag.key], v = K.clamp(drag.v0 + Math.round((drag.y - p.py) / 10) * d.step, d.min, d.max);
        if (v !== vals[drag.key]) { vals[drag.key] = v; sliders[drag.key].set(v); recompute(); }
      },
      up: function () { drag = null; },
      hover: function (p) { var h = hit(p.m); P.canvas.style.cursor = h ? (h.jockey ? "ew-resize" : "ns-resize") : "default"; }
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
    function fmtI(I) { var a = Math.abs(I); return a >= 1e-3 ? K.fmt(I * 1e3, 2) + " mA" : K.fmt(I * 1e6, 1) + " μA"; }
    function drawPart(ctx, b, p) {
      var m = pointAt(b, p.s), nx = -m.uy, ny = m.ux, side = p.side || 1, on = p.key === sel;
      var at = function (s, off) { var q = pointAt(b, s); return X(q.x + nx * off, q.y + ny * off); };
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (p.kind === "R") {
        var nz = 6;
        ctx.beginPath(); var q0 = at(p.s0, 0); ctx.moveTo(q0.x, q0.y);
        for (var i = 0; i < nz; i++) { var q = at(p.s0 + (i + 0.5) / nz * (p.s1 - p.s0), (i % 2 ? -1 : 1) * 0.22); ctx.lineTo(q.x, q.y); }
        var q1 = at(p.s1, 0); ctx.lineTo(q1.x, q1.y);
        ctx.strokeStyle = on ? th.ten : th.ink; ctx.lineWidth = sim.u(on ? 3.5 : 2.5); ctx.stroke();
        var lp = at(p.s, side * 0.65), hidden = p.key === "X" && mystery;
        K.label(ctx, p.name + " " + (hidden ? "?" : String(vals[p.key])) + " Ω", lp.x, lp.y + sim.u(7), on ? th.ink : th.muted, { s: sim.u(1), bg: on });
      } else if (p.kind === "W") {
        var w0 = at(p.s0, 0), w1 = at(p.s1, 0);
        ctx.strokeStyle = th.fric; ctx.lineWidth = sim.u(3);
        ctx.beginPath(); ctx.moveTo(w0.x, w0.y); ctx.lineTo(w1.x, w1.y); ctx.stroke();
      } else if (p.kind === "E") {
        var neg = at(p.s - 0.1, 0), pos = at(p.s + 0.1, 0), L1 = 0.45 * ppm, L2 = 0.22 * ppm, px = nx, py = -ny;
        ctx.strokeStyle = th.app;
        ctx.lineWidth = sim.u(on ? 3.5 : 2.5); ctx.beginPath(); ctx.moveTo(pos.x - px * L1, pos.y - py * L1); ctx.lineTo(pos.x + px * L1, pos.y + py * L1); ctx.stroke();
        ctx.lineWidth = sim.u(6); ctx.beginPath(); ctx.moveTo(neg.x - px * L2, neg.y - py * L2); ctx.lineTo(neg.x + px * L2, neg.y + py * L2); ctx.stroke();
        var ce = pointAt(b, p.s), le = X(ce.x + p.lab[0], ce.y + p.lab[1]);
        K.label(ctx, "E " + vals.E + " V (+ on the left)", le.x, le.y + sim.u(7), th.app, { s: sim.u(1), align: "left" });
      } else if (p.kind === "G") {
        var cg = at(p.s, 0), r = 0.5 * ppm, Ig = b.I, ang = 55 * Math.tanh(Ig / 2e-3) * K.DEG;
        ctx.fillStyle = th.surface; ctx.strokeStyle = on ? th.ten : th.acc; ctx.lineWidth = sim.u(on ? 3 : 2.2);
        ctx.beginPath(); ctx.arc(cg.x, cg.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = th.muted; ctx.lineWidth = sim.u(1);
        for (var k = -2; k <= 2; k++) { var a = k * 27.5 * K.DEG; ctx.beginPath(); ctx.moveTo(cg.x + Math.sin(a) * r * 0.72, cg.y + r * 0.35 - Math.cos(a) * r * 0.72); ctx.lineTo(cg.x + Math.sin(a) * r * 0.86, cg.y + r * 0.35 - Math.cos(a) * r * 0.86); ctx.stroke(); }
        ctx.strokeStyle = Math.abs(Ig) < 1e-9 ? th.good : th.acc; ctx.lineWidth = sim.u(2.5);
        ctx.beginPath(); ctx.moveTo(cg.x, cg.y + r * 0.35); ctx.lineTo(cg.x + Math.sin(ang) * r * 0.85, cg.y + r * 0.35 - Math.cos(ang) * r * 0.85); ctx.stroke();
        K.label(ctx, "G", cg.x - r - sim.u(10), cg.y + sim.u(7), th.acc, { s: sim.u(1.1) });
        K.label(ctx, (Math.abs(Ig) < 1e-9 ? "null · " : "") + fmtI(Ig), cg.x + r + sim.u(6), cg.y + sim.u(7), Math.abs(Ig) < 1e-9 ? th.good : th.acc, { s: sim.u(1), align: "left", bg: true });
      }
    }
    sim.on("under", function (ctx) {
      if (!c) return;
      ctx.strokeStyle = th.ink; ctx.lineWidth = sim.u(2.5); ctx.lineCap = "round";
      c.branches.forEach(function (b) {
        var s = 0;
        b.parts.forEach(function (p) { wire(ctx, b, s, p.s0); s = p.s1; });
        wire(ctx, b, s, b.L);
      });
      if (mode === "meter") {
        // copper strips are drawn thick; the ruler sits under the wire
        ctx.strokeStyle = th.acc; ctx.lineWidth = sim.u(5);
        [[[3, 2.8], [3, 6.6], [5.8, 6.6]], [[7.2, 6.6], [12.8, 6.6]], [[14.2, 6.6], [17, 6.6], [17, 2.8]]].forEach(function (seg) {
          ctx.beginPath(); seg.forEach(function (q, i) { var pp = X(q[0], q[1]); if (i) ctx.lineTo(pp.x, pp.y); else ctx.moveTo(pp.x, pp.y); }); ctx.stroke();
        });
        ctx.strokeStyle = th.muted; ctx.fillStyle = th.muted; ctx.lineWidth = sim.u(1);
        ctx.font = "600 " + sim.u(10) + "px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        for (var cm = 0; cm <= 100; cm += 5) {
          var t = X(3 + UPC * cm, 2.6), big = cm % 10 === 0;
          ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y + sim.u(big ? 9 : 5)); ctx.stroke();
          if (cm % 20 === 0) ctx.fillText(cm + "", t.x, t.y + sim.u(11));
        }
        var lA = X(3, 2.8), lC = X(17, 2.8);
        K.label(ctx, "A", lA.x - sim.u(12), lA.y + sim.u(18), th.ink, { s: sim.u(1) });
        K.label(ctx, "C", lC.x + sim.u(12), lC.y + sim.u(18), th.ink, { s: sim.u(1) });
      }
      c.branches.forEach(function (b) { b.parts.forEach(function (p) { drawPart(ctx, b, p); }); });
      if (mode === "meter") {
        var j = X(c.nodes.J[0], c.nodes.J[1]);
        ctx.fillStyle = th.ink;
        ctx.beginPath(); ctx.moveTo(j.x, j.y - sim.u(2)); ctx.lineTo(j.x - sim.u(9), j.y - sim.u(20)); ctx.lineTo(j.x + sim.u(9), j.y - sim.u(20)); ctx.closePath(); ctx.fill();
        var lft = c.nodes.J[0] < 10;
        K.label(ctx, "J  l = " + K.fmt(vals.l, 1) + " cm", j.x + sim.u(lft ? -12 : 12), j.y - sim.u(14), th.ink, { s: sim.u(1), align: lft ? "right" : "left", bg: true });
      }
    });
    sim.on("over", function (ctx) {
      if (!c) return;
      ctx.fillStyle = th.ten;
      c.branches.forEach(function (b) {
        if (Math.abs(b.I) < 1e-9) return;
        var n = Math.max(1, Math.round(b.L / 0.55)), g = b.L / n;
        for (var i = 0; i < n; i++) {
          var s = ((b.phase + i * g) % b.L + b.L) % b.L, skip = false;
          b.parts.forEach(function (p) { if ((p.kind === "E" || p.kind === "G") && s > p.s0 - 0.55 && s < p.s1 + 0.55) skip = true; });
          if (skip) continue;
          var q = pointAt(b, s), px = X(q.x, q.y);
          ctx.beginPath(); ctx.arc(px.x, px.y, sim.u(3.2), 0, Math.PI * 2); ctx.fill();
        }
      });
      Object.keys(c.show).forEach(function (n) {
        var q = X(c.nodes[n][0], c.nodes[n][1]), o = c.show[n];
        ctx.fillStyle = th.disp; ctx.beginPath(); ctx.arc(q.x, q.y, sim.u(4.5), 0, Math.PI * 2); ctx.fill();
        K.label(ctx, n + "  " + K.fmt(c.V[n], 2) + " V", q.x + o[0] * ppm, q.y - o[1] * ppm, th.disp, { s: sim.u(1), bg: true });
      });
      if (mode === "meter") {
        var j = X(c.nodes.J[0], c.nodes.J[1]);
        K.label(ctx, K.fmt(c.V.J, 2) + " V", j.x, j.y + sim.u(40), th.disp, { s: sim.u(0.9) });
      }
    });

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">I<sub>g</sub></b> · galvanometer current as you vary <span class="gx">S</span>; it crosses zero at the balance point. Dashed: Thevenin formula</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-disp">potential</b> · <span class="gv">down the two arms from A to C: balance when the middle points match</span></p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gI = new K.Graph(cv[0], { yLabel: "I_g (mA)", xLabel: "S (Ω)", xMax: 100, color: th.acc });
    var gV = new K.Graph(cv[1], { yLabel: "V (V)", xLabel: "along the arm", xMax: 2, yMin: 0, color: th.disp });

    function theory() {
      var sim1 = [], form = [], v = Object.assign({}, vals), test = build(mode === "wheat" ? wheatDef() : meterDef(50, swapped));
      if (mode === "wheat") {
        for (var S = 1; S <= 100; S += 0.5) {
          v.S = S;
          solveCircuit(test, function (k) { return v[k]; });
          sim1.push([S, test.byId.g.I * 1e3]); form.push([S, wheatFormula(v).Ig * 1e3]);
        }
        var f = info.f;
        gV.o.xMax = 2; gV.o.xLabel = "A → B or D → C";
        gV.set("upper", { points: [[0, vals.E], [1, f.VB], [2, 0]], color: th.disp, width: 2.5 });
        gV.set("lower", { points: [[0, vals.E], [1, f.VD], [2, 0]], color: th.disp, width: 1.5, dash: [5, 5] });
      } else {
        for (var l = 0.5; l <= 99.5 + 1e-9; l += 0.5) {
          var tc = build(meterDef(l, swapped));
          solveCircuit(tc, function (k) { return k === "WL" ? LAM * (l + v.al) : k === "WR" ? LAM * (100 - l + v.be) : v[k]; });
          sim1.push([l, tc.byId.g.I * 1e3]); form.push([l, meterFormula(v, l).Ig * 1e3]);
        }
        gV.o.xMax = 100; gV.o.xLabel = "l (cm)";
        var wp = [];
        for (var x = 0; x <= 100; x += 2) wp.push([x, meterFormula(v, x).VJ]);
        gV.set("upper", { points: wp, color: th.disp, width: 2.5 });
        gV.set("lower", { points: [[0, info.f.VD], [100, info.f.VD]], color: th.disp, width: 1.5, dash: [5, 5] });
      }
      gI.o.xLabel = mode === "wheat" ? "S (Ω)" : "l (cm)";
      gI.set("theory", { points: form, color: th.acc, dash: [5, 5], width: 1.5 });
      gI.set("sim", { points: sim1, color: th.acc, width: 2.5 });
      P.graphs.querySelector(".gx").textContent = mode === "wheat" ? "S" : "the jockey position l";
      P.graphs.querySelector(".gv").textContent = mode === "wheat" ? "down the two arms from A to C (solid via B, dashed via D): balance when the middle points match"
        : "along the wire at the jockey (solid) and at D (dashed): the null is where they cross";
    }
    var slowMaths = K.throttle(renderMaths, 100);
    function update(force) {
      gI.extra = function (ctx, Xf, Yf) {
        ring(ctx, Xf(mode === "wheat" ? vals.S : vals.l), Yf(info.Ig * 1e3));
        var x0 = mode === "wheat" ? vals.Q * vals.R / vals.P : info.l0;
        if (x0 <= (mode === "wheat" ? 100 : 100)) { ctx.strokeStyle = th.good; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(Xf(x0), Yf(0) - 30); ctx.lineTo(Xf(x0), Yf(0) + 30); ctx.stroke(); ctx.setLineDash([]); }
      };
      gV.extra = function (ctx, Xf, Yf) {
        if (mode === "wheat") { ring(ctx, Xf(1), Yf(info.f.VB)); ring(ctx, Xf(1), Yf(info.f.VD)); }
        else ring(ctx, Xf(vals.l), Yf(info.f.VJ));
      };
      [gI, gV].forEach(function (g) { g.dirty = true; g.draw(); });
      if (force) renderMaths(); else slowMaths();
    }
    function ring(ctx, x, y) { ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="eq"><p class="eq-label"></p><div class="eq-tex"></div></div>'; }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex"), eqLabels = P.eqs.querySelectorAll(".eq-label");
    var setR = K.readout(P.readouts, [
      { id: "ig", label: "galvanometer current", cls: "c-acc" }, { id: "v1", label: "V_B", cls: "c-disp" }, { id: "v2", label: "V_D", cls: "c-disp" },
      { id: "bal", label: "balance point", cls: "c-ten" }, { id: "x1", label: "X from l", cls: "c-ten" }, { id: "x2", label: "X, end error corrected", cls: "c-ten" }
    ]);
    var rLabels = P.readouts.querySelectorAll(".readout span");
    function endCorrections() {
      // R/X = (l₁+α)/(100−l₁+β) and X/R = (l₂+α)/(100−l₂+β): two linear equations in α and β
      if (!nulls.a || !nulls.b || nulls.a.key !== nulls.b.key) return null;
      var R = vals.Rb, Xv = vals.X, l1 = nulls.a.l, l2 = nulls.b.l;
      var a1 = Xv, b1 = -R, c1 = R * (100 - l1) - Xv * l1, a2 = R, b2 = -Xv, c2 = Xv * (100 - l2) - R * l2, det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-9) return null;
      return { a: (c1 * b2 - c2 * b1) / det, b: (a1 * c2 - a2 * c1) / det, l1: l1, l2: l2 };
    }
    function renderMaths() {
      var f = info.f, v = vals;
      if (mode === "wheat") {
        eqLabels[0].textContent = "Balance condition"; eqLabels[1].textContent = "Potentials of B and D (C is 0 V)";
        eqLabels[2].textContent = "Galvanometer current (Thevenin)"; eqLabels[3].textContent = "S needed for balance";
        var bal = Math.abs(info.Ig) < 1e-9;
        K.tex(eqEls[0], "\\frac{P}{Q} = \\frac{" + v.P + "}{" + v.Q + "} = " + K.fmt(v.P / v.Q, 3) + (bal ? "\\; = \\;" : "\\; \\ne \\;") + "\\frac{R}{S} = \\frac{" + v.R + "}{" + v.S + "} = " + K.fmt(v.R / v.S, 3) + "\\;\\Rightarrow\\; \\mathbf{" + (bal ? "balanced" : "not\\ balanced") + "}");
        K.tex(eqEls[1], "V_B = \\frac{EQ}{P+Q} = \\frac{(" + v.E + ")(" + v.Q + ")}{" + (v.P + v.Q) + "} = \\mathbf{" + K.fmt(f.VB, 3) + "},\\quad V_D = \\frac{ES}{R+S} = \\frac{(" + v.E + ")(" + v.S + ")}{" + (v.R + v.S) + "} = \\mathbf{" + K.fmt(f.VD, 3) + "}\\ \\text{V}");
        K.tex(eqEls[2], "I_g = \\frac{V_B - V_D}{P\\parallel Q + R\\parallel S + G} = \\frac{" + K.fmt(f.VB - f.VD, 3) + "}{" + K.fmt(par(v.P, v.Q), 2) + " + " + K.fmt(par(v.R, v.S), 2) + " + " + v.G + "} = \\mathbf{" + K.fmt(f.Ig * 1e3, 3) + "}\\ \\text{mA}");
        K.tex(eqEls[3], "S = \\frac{QR}{P} = \\frac{(" + v.Q + ")(" + v.R + ")}{" + v.P + "} = \\mathbf{" + K.fmt(v.Q * v.R / v.P, 2) + "}\\ \\Omega");
        rLabels[1].textContent = "V_B"; rLabels[2].textContent = "V_D"; rLabels[3].textContent = "balance at S ="; rLabels[4].textContent = "P/Q"; rLabels[5].textContent = "R/S";
        setR("v1", K.fmt(f.VB, 3) + " V"); setR("v2", K.fmt(f.VD, 3) + " V");
        setR("bal", K.fmt(v.Q * v.R / v.P, 2) + " Ω", "QR / P"); setR("x1", K.fmt(v.P / v.Q, 3)); setR("x2", K.fmt(v.R / v.S, 3));
      } else {
        var g = gaps(), Lt = swapped ? "X" : "R", Rt = swapped ? "R" : "X", hide = mystery;
        var Xnaive = swapped ? vals.Rb * v.l / (100 - v.l) : vals.Rb * (100 - v.l) / v.l;
        var Xcorr = swapped ? vals.Rb * (v.l + v.al) / (100 - v.l + v.be) : vals.Rb * (100 - v.l + v.be) / (v.l + v.al);
        eqLabels[0].textContent = "At the null: " + Lt + " / " + Rt + " = l / (100 − l)"; eqLabels[1].textContent = "With end errors α, β (extra cm of wire)";
        eqLabels[2].textContent = "Galvanometer current (Thevenin)"; eqLabels[3].textContent = "End corrections from two nulls (swap R and X)";
        K.tex(eqEls[0], "X = R\\," + (swapped ? "\\frac{l}{100 - l} = " + vals.Rb + "\\times\\frac{" + K.fmt(v.l, 1) + "}{" + K.fmt(100 - v.l, 1) + "}" : "\\frac{100 - l}{l} = " + vals.Rb + "\\times\\frac{" + K.fmt(100 - v.l, 1) + "}{" + K.fmt(v.l, 1) + "}") + " = \\mathbf{" + K.fmt(Xnaive, 2) + "}\\ \\Omega" + (info.atNull ? "" : "\\ \\text{(only true at the null)}"));
        K.tex(eqEls[1], "X = R\\," + (swapped ? "\\frac{l + \\alpha}{100 - l + \\beta} = " + vals.Rb + "\\times\\frac{" + K.fmt(v.l + v.al, 1) + "}{" + K.fmt(100 - v.l + v.be, 1) + "}" : "\\frac{100 - l + \\beta}{l + \\alpha} = " + vals.Rb + "\\times\\frac{" + K.fmt(100 - v.l + v.be, 1) + "}{" + K.fmt(v.l + v.al, 1) + "}") + " = \\mathbf{" + K.fmt(Xcorr, 2) + "}\\ \\Omega");
        K.tex(eqEls[2], "I_g = \\frac{V_D - V_J}{R\\parallel X + R_{AJ}\\parallel R_{JC} + G} = \\frac{" + K.fmt(f.VD - f.VJ, 4) + "}{" + K.fmt(f.Rth, 3) + " + " + v.G + "} = \\mathbf{" + K.fmt(info.Ig * 1e3, 3) + "}\\ \\text{mA}");
        var ec = endCorrections();
        K.tex(eqEls[3], ec ? "l_1 = " + K.fmt(ec.l1, 1) + ",\\ l_2 = " + K.fmt(ec.l2, 1) + "\\;\\Rightarrow\\; \\alpha = \\mathbf{" + K.fmt(ec.a, 1) + "}\\ \\text{cm},\\ \\beta = \\mathbf{" + K.fmt(ec.b, 1) + "}\\ \\text{cm}"
          : "\\frac{R}{X} = \\frac{l_1 + \\alpha}{100 - l_1 + \\beta},\\quad \\frac{X}{R} = \\frac{l_2 + \\alpha}{100 - l_2 + \\beta}\\quad\\text{(find both nulls)}");
        rLabels[1].textContent = "V_D"; rLabels[2].textContent = "V_J (jockey)"; rLabels[3].textContent = "null point"; rLabels[4].textContent = "X from your l"; rLabels[5].textContent = "X, end error corrected";
        setR("v1", K.fmt(f.VD, 3) + " V"); setR("v2", K.fmt(f.VJ, 3) + " V");
        setR("bal", hide ? (info.atNull ? K.fmt(v.l, 1) + " cm" : "find it") : K.fmt(info.l0, 1) + " cm", info.atNull ? "you're on it" : "");
        setR("x1", K.fmt(Xnaive, 2) + " Ω", info.atNull ? "R(100 − l)/l at the null" : "not at the null yet");
        setR("x2", K.fmt(Xcorr, 2) + " Ω", hide ? (info.atNull ? "true X = " + vals.X + " Ω" : "") : "true X = " + vals.X + " Ω");
        void g;
      }
      setR("ig", fmtI(info.Ig), Math.abs(info.Ig) < 1e-9 ? "null: balanced" : (mode === "meter" ? (info.Ig > 0 ? "D → J: move the jockey left" : "J → D: move the jockey right") : (info.Ig > 0 ? "B → D" : "D → B")));
    }

    /* ---------- the idea + quiz ---------- */
    P.concept.innerHTML = K.md(
      "<p>A <b>Wheatstone bridge</b> is two voltage dividers side by side, with a galvanometer joining their middles. If both dividers split the battery's voltage in the same ratio, B and D sit at the same potential and no current flows through G: $\\frac{P}{Q} = \\frac{R}{S}$. Nothing else matters: not $E$, not $G$, not the battery's internal resistance.</p>" +
      "<p>The <b>meter bridge</b> is the same circuit with $R$ and $S$ replaced by two lengths of one uniform wire. Resistance is proportional to length, so at the null $\\frac{R}{X} = \\frac{l}{100 - l}$. It's most sensitive near the middle of the wire, so pick $R$ to bring the null close to 50 cm.</p>" +
      '<div class="trap"><b>JEE trap: end error.</b> The joins at A and C add a little resistance, as if the wire had extra lengths $\\alpha$ and $\\beta$. Then $\\frac{R}{X} = \\frac{l + \\alpha}{100 - l + \\beta}$. Problems give two null readings (resistors swapped, or two known resistors) and expect you to solve for $\\alpha$ and $\\beta$ first.</div>');
    function apply(s) {
      setMode(s.mode);
      if (s.mystery !== undefined && s.mystery !== mystery) setMystery(s.mystery);
      if (s.swapped !== undefined) swapped = s.swapped;
      Object.keys(s).forEach(function (k) { if (sliders[k]) { vals[k] = s[k]; sliders[k].set(s[k]); } });
      build0(); reset();
    }
    K.practice(P.quiz, [
      { level: "easy", tag: "balance condition", setup: { mode: "wheat", P: 10, Q: 20, R: 15, S: 30 }, watch: "Check the galvanometer reads zero, then try S = 29 and 31",
        q: "In a Wheatstone bridge $P = 10\\ \\Omega$, $Q = 20\\ \\Omega$ and $R = 15\\ \\Omega$. What must $S$ be for the galvanometer to read zero?",
        options: ["30 Ω", "7.5 Ω", "20 Ω", "45 Ω"], answer: 0,
        explain: "Balance needs $P/Q = R/S$, so $S = QR/P = 20 \\times 15/10 = 30\\ \\Omega$. 7.5 Ω comes from flipping the ratio, $PR/Q$." },
      { level: "medium", tag: "meter bridge", setup: { mode: "meter", Rb: 4, X: 6, l: 40, al: 0, be: 0, swapped: false, mystery: false }, watch: "The jockey is at 40 cm: is it a null? Slide either side to check",
        q: "In a meter bridge a 4 Ω resistor is in the left gap and an unknown $X$ in the right. The null point is 40 cm from the left end. What is $X$?",
        options: ["6 Ω", "2.67 Ω", "10 Ω", "1.6 Ω"], answer: 0,
        hints: ["Resistance of wire is proportional to its length, so the two parts of the wire are in the ratio 40 : 60.", "$\\frac{4}{X} = \\frac{40}{60}$."],
        explain: "At the null $\\frac{R}{X} = \\frac{l}{100 - l}$: $\\frac{4}{X} = \\frac{40}{60}$, so $X = 6\\ \\Omega$. 2.67 Ω puts the lengths the wrong way round; 1.6 Ω uses $4 \\times 40/100$." },
      { level: "hard", tag: "end corrections", setup: { mode: "meter", Rb: 10, X: 15, l: 39.2, al: 2, be: 1, swapped: false, mystery: false }, watch: "Confirm the null at 39.2 cm, press Swap, then find the new null",
        q: "A meter bridge has end corrections. With 10 Ω in the left gap and 15 Ω in the right, the null is at 39.2 cm. With the two resistors swapped it is at 59.8 cm. What are the end corrections $\\alpha$ (left) and $\\beta$ (right)?",
        options: ["α = 2 cm, β = 1 cm", "α = 1 cm, β = 2 cm", "α = β = 0.5 cm", "α = β = 0"], answer: 0,
        hints: ["Treat the ends as extra wire: $\\frac{10}{15} = \\frac{39.2 + \\alpha}{60.8 + \\beta}$.", "Swapped: $\\frac{15}{10} = \\frac{59.8 + \\alpha}{40.2 + \\beta}$. Clear the fractions: two linear equations."],
        explain: "The first gives $2(60.8 + \\beta) = 3(39.2 + \\alpha)$, so $3\\alpha - 2\\beta = 4$. The second gives $3(40.2 + \\beta) = 2(59.8 + \\alpha)$, so $2\\alpha - 3\\beta = 1$. Solving, $\\alpha = 2$ cm and $\\beta = 1$ cm. Without end errors the two nulls would add to exactly 100 cm; here they add to 99 cm." }
    ], apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Flow", onReset: reset });
    setMode("wheat");

    if (location.hostname === "localhost") {
      window.__lab_bridge = {
        apply: apply, setMode: setMode, setMystery: setMystery,
        set: function (k, v) { vals[k] = v; if (sliders[k]) sliders[k].set(v); recompute(); },
        swap: function () { swapBtn.click(); },
        state: function () { return { mode: mode, Ig: info.Ig, f: info.f, l0: info.l0, atNull: info.atNull, vals: vals, V: c.V, ec: endCorrections(), swapped: swapped }; }
      };
    }

    return function destroy() { sim.destroy(); [gI, gV].forEach(function (g) { g.destroy(); }); };
  }
})();
