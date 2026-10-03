/* Semiconductors, lab 2: logic gates. Toggle inputs, wire up to three gates, and watch the truth table and timing diagram fill in. */
(function () {
  "use strict";
  var ROW_T = 1;                 // seconds per input combination when playing
  var DELAY = 0.1;               // gate propagation delay (s), only while playing

  // the six gates: truth function, number of inputs, and how to write them
  var TYPES = {
    AND:  { n: 2, f: function (a, b) { return a & b; } },
    OR:   { n: 2, f: function (a, b) { return a | b; } },
    NOT:  { n: 1, f: function (a) { return a ? 0 : 1; } },
    NAND: { n: 2, f: function (a, b) { return (a & b) ? 0 : 1; } },
    NOR:  { n: 2, f: function (a, b) { return (a | b) ? 0 : 1; } },
    XOR:  { n: 2, f: function (a, b) { return a ^ b; } }
  };
  var TYPE_LIST = ["AND", "OR", "NOT", "NAND", "NOR", "XOR"];
  // functions a circuit might turn out to be, written over (A, B, C)
  var CATALOG = [
    { name: "AND", tex: "A\\cdot B", f: function (a, b) { return a & b; } },
    { name: "OR", tex: "A + B", f: function (a, b) { return a | b; } },
    { name: "NAND", tex: "\\overline{A\\cdot B}", f: function (a, b) { return 1 - (a & b); } },
    { name: "NOR", tex: "\\overline{A + B}", f: function (a, b) { return 1 - (a | b); } },
    { name: "XOR", tex: "A\\oplus B", f: function (a, b) { return a ^ b; } },
    { name: "XNOR", tex: "\\overline{A\\oplus B}", f: function (a, b) { return 1 - (a ^ b); } },
    { name: "NOT A", tex: "\\overline{A}", f: function (a) { return 1 - a; } },
    { name: "NOT B", tex: "\\overline{B}", f: function (a, b) { return 1 - b; } },
    { name: "A", tex: "A", f: function (a) { return a; } },
    { name: "B", tex: "B", f: function (a, b) { return b; } },
    { name: "OR of B, C", tex: "B + C", f: function (a, b, c) { return b | c; } },
    { name: "AND of A, B, C", tex: "A\\cdot B\\cdot C", f: function (a, b, c) { return a & b & c; } },
    { name: "OR of A, B, C", tex: "A + B + C", f: function (a, b, c) { return a | b | c; } },
    { name: "always 0", tex: "0", f: function () { return 0; } },
    { name: "always 1", tex: "1", f: function () { return 1; } }
  ];
  var PRESETS = {
    nandnot: { label: "NOT from NAND", gates: [["NAND", "A", "A"]], target: "NOT A" },
    nandand: { label: "AND from NANDs", gates: [["NAND", "A", "B"], ["NAND", "G1", "G1"]], target: "AND" },
    nandor:  { label: "OR from NANDs", gates: [["NAND", "A", "A"], ["NAND", "B", "B"], ["NAND", "G1", "G2"]], target: "OR" },
    nornot:  { label: "NOT from NOR", gates: [["NOR", "A", "A"]], target: "NOT A" },
    noror:   { label: "OR from NORs", gates: [["NOR", "A", "B"], ["NOR", "G1", "G1"]], target: "OR" },
    norand:  { label: "AND from NORs", gates: [["NOR", "A", "A"], ["NOR", "B", "B"], ["NOR", "G1", "G2"]], target: "AND" },
    xornor:  { label: "Mystery 1", gates: [["NOR", "A", "B"], ["AND", "A", "B"], ["NOR", "G1", "G2"]], target: "XOR" },
    bc:      { label: "Mystery 2", gates: [["NAND", "A", "B"], ["NOR", "B", "C"], ["NAND", "G1", "G2"]], target: "OR of B, C" }
  };

  var lab = {
    id: "logic", chapter: "semi", title: "Logic gates", short: "truth tables, NAND & NOR, circuits",
    lede: "Click the switches, click a gate to change it, and wire up to three gates into a circuit. Press Play and the lab runs through every input, filling the truth table and drawing the timing diagram.",
    tries: [
      { id: "fill", title: "Fill a whole truth table",
        text: "Press Play and let it step through every input combination.",
        why: "$n$ inputs have $2^n$ combinations, so 2 inputs need 4 rows and 3 inputs need 8. The table lists them in binary counting order: that's the only way to be sure none is missed." },
      { id: "nandnot", title: "Build a NOT gate from one NAND",
        text: "In Build mode, use a single NAND and wire both of its inputs to the same switch.",
        why: "$\\overline{A\\cdot A} = \\overline{A}$. With both inputs tied together a NAND can only see 00 or 11, and for those it is exactly an inverter. That's the first step to showing NAND is universal." },
      { id: "xor", title: "Make an XOR without an XOR gate",
        text: "Wire up other gates so the circuit behaves exactly like XOR.",
        why: "$A\\oplus B = (A + B)\\cdot\\overline{A\\cdot B}$: true when the inputs differ. One answer is NOR(NOR(A, B), AND(A, B)); another is AND(OR(A, B), NAND(A, B))." },
      { id: "demorgan", title: "Prove a De Morgan law with gates",
        text: "Using only NOT and AND gates, build a circuit that behaves like NOR.",
        why: "$\\overline{A + B} = \\overline{A}\\cdot\\overline{B}$: invert both inputs, then AND them. Breaking the bar changes OR into AND, which is exactly De Morgan's law." }
    ],
    mount: mount
  };
  K.registerLab(lab);

  /* ---------- the logic (pure functions, also used by the tests) ---------- */
  function srcVal(s, vals, outs) { return s.charAt(0) === "G" ? outs[+s.slice(1) - 1] : vals[s]; }
  // settle the whole circuit instantly: each gate only sees inputs or earlier gates
  function evaluate(gates, vals) {
    var outs = [];
    gates.forEach(function (g) { var T = TYPES[g.type]; outs.push(T.f(srcVal(g.a, vals, outs), T.n === 2 ? srcVal(g.b, vals, outs) : 0)); });
    return { outs: outs, y: outs[outs.length - 1] };
  }
  function varsOf(gates) {
    var used = {};
    gates.forEach(function (g) { [g.a, TYPES[g.type].n === 2 ? g.b : null].forEach(function (s) { if (s && s.charAt(0) !== "G") used[s] = true; }); });
    return ["A", "B", "C"].filter(function (v) { return used[v]; });
  }
  function rowVals(vars, r) {
    var vals = { A: 0, B: 0, C: 0 };
    vars.forEach(function (v, i) { vals[v] = (r >> (vars.length - 1 - i)) & 1; });
    return vals;
  }
  function truth(gates) {
    var vars = varsOf(gates), rows = [];
    for (var r = 0; r < (1 << vars.length); r++) { var vals = rowVals(vars, r), e = evaluate(gates, vals); rows.push({ vals: vals, outs: e.outs, y: e.y }); }
    return { vars: vars, rows: rows };
  }
  // which named function the circuit is, checked over all 8 values of (A, B, C)
  function behaves(gates) {
    return CATALOG.filter(function (c) {
      for (var r = 0; r < 8; r++) {
        var v = rowVals(["A", "B", "C"], r);
        if (evaluate(gates, v).y !== c.f(v.A, v.B, v.C)) return false;
      }
      return true;
    })[0] || null;
  }
  // Boolean expression for a source, as TeX; sub = values instead of letters
  function texOf(gates, s, vals, sub) {
    if (s.charAt(0) !== "G") return sub ? String(vals[s]) : s;
    var g = gates[+s.slice(1) - 1], T = TYPES[g.type];
    var a = texOf(gates, g.a, vals, sub), b = T.n === 2 ? texOf(gates, g.b, vals, sub) : "";
    function wrap(src, t) { var k = src.charAt(0) === "G" ? gates[+src.slice(1) - 1].type : ""; return k === "OR" || k === "XOR" ? "(" + t + ")" : t; }
    switch (g.type) {
      case "AND": return wrap(g.a, a) + "\\cdot " + wrap(g.b, b);
      case "OR": return a + " + " + b;
      case "NOT": return "\\overline{" + a + "}";
      case "NAND": return "\\overline{" + wrap(g.a, a) + "\\cdot " + wrap(g.b, b) + "}";
      case "NOR": return "\\overline{" + a + " + " + b + "}";
      default: return wrap(g.a, a) + "\\oplus " + wrap(g.b, b);
    }
  }

  function mount(root) {
    var P = K.scaffold(root, lab), th = K.theme;
    var W = 1000, H = 440;
    var sim = new K.Sim(P.canvas, { W: W, H: H, ppm: 1, origin: { x: 0, y: H }, g: 0, grid: false });
    var HI = th.vel, LO = th.muted;

    /* ---------- state ---------- */
    var mode = "single", single = "AND", gates = [], preset = null, custom = false;
    var inputs = { A: 0, B: 0, C: 0 }, live = [], filled = {}, playing = false, rec, playDone = false;

    /* ---------- controls ---------- */
    P.controls.innerHTML = "<h3>Mode</h3>";
    var modeSeg = K.seg([{ label: "One gate", value: "single" }, { label: "Circuit", value: "circuit" }], mode, function (v) { setMode(v); }, "Mode");
    P.controls.appendChild(modeSeg);
    var singleBox = K.h("<div><h3>Gate</h3></div>");
    var gateSeg = K.seg(TYPE_LIST.map(function (t) { return { label: t, value: t }; }), single, function (v) { single = v; setSingle(); }, "Gate");
    singleBox.appendChild(gateSeg);
    singleBox.appendChild(K.h('<p class="control-hint">Or click the gate on the stage to cycle through all six.</p>'));
    P.controls.appendChild(singleBox);

    var circBox = K.h("<div></div>");
    circBox.appendChild(K.h("<h3>Universal gates</h3>"));
    var uniRow = K.h('<div class="row"></div>'), mysRow = K.h('<div class="row"></div>');
    Object.keys(PRESETS).forEach(function (k) {
      var b = K.h('<button class="btn btn-sm" type="button">' + PRESETS[k].label + "</button>");
      b.addEventListener("click", function () { loadPreset(k); });
      (k === "xornor" || k === "bc" ? mysRow : uniRow).appendChild(b);
    });
    circBox.appendChild(uniRow);
    circBox.appendChild(K.h("<h3>Mystery circuits</h3>"));
    circBox.appendChild(mysRow);
    circBox.appendChild(K.h("<h3>Build your own</h3>"));
    var builder = K.h("<div></div>");
    circBox.appendChild(builder);
    P.controls.appendChild(circBox);
    P.controls.appendChild(K.h('<div class="legend"><span class="c-vel"><i></i>1 (high)</span><span style="color:var(--muted)"><i></i>0 (low)</span><span class="c-acc"><i></i>output Y</span></div>'));

    function gate(type, a, b) { return { type: type, a: a, b: b, out: 0, next: 0, since: 0 }; }
    function setMode(v) {
      mode = v; singleBox.hidden = v !== "single"; circBox.hidden = v !== "circuit";
      if (v === "single") setSingle(); else if (!preset && !custom) loadPreset("nandand"); else changed();
    }
    function setSingle() { gates = [gate(single, "A", "B")]; preset = null; changed(); }
    function loadPreset(k) {
      preset = k; custom = false;
      gates = PRESETS[k].gates.map(function (g) { return gate(g[0], g[1], g[2]); });
      changed();
      K.flash(P.note, PRESETS[k].label + ": press Play to fill its truth table");
    }
    function edited() { preset = null; custom = true; changed(); }

    function renderBuilder() {
      builder.innerHTML = "";
      var cnt = K.seg([1, 2, 3].map(function (n) { return { label: n + (n === 1 ? " gate" : " gates"), value: n }; }), gates.length, function (n) {
        while (gates.length < n) gates.push(gate("AND", "G" + gates.length, "C"));
        while (gates.length > n) gates.pop();
        edited();
      }, "Number of gates");
      builder.appendChild(cnt);
      gates.forEach(function (g, i) {
        var box = K.h('<div class="gate-row" style="margin-top:10px"><p class="control-hint" style="margin:0 0 4px"><b>G' + (i + 1) + "</b>" + (i === gates.length - 1 ? " · output Y" : "") + "</p></div>");
        box.appendChild(K.seg(TYPE_LIST.map(function (t) { return { label: t, value: t }; }), g.type, function (t) { g.type = t; edited(); }, "Type of G" + (i + 1)));
        var srcs = ["A", "B", "C"]; for (var k = 1; k <= i; k++) srcs.push("G" + k);
        var opts = srcs.map(function (s) { return { label: s, value: s }; });
        var r1 = K.h('<div class="row" style="align-items:center;margin-top:4px"><span class="control-hint" style="margin:0">in 1</span></div>');
        r1.appendChild(K.seg(opts, g.a, function (s) { g.a = s; edited(); }, "First input of G" + (i + 1)));
        box.appendChild(r1);
        if (TYPES[g.type].n === 2) {
          var r2 = K.h('<div class="row" style="align-items:center;margin-top:4px"><span class="control-hint" style="margin:0">in 2</span></div>');
          r2.appendChild(K.seg(opts, g.b, function (s) { g.b = s; edited(); }, "Second input of G" + (i + 1)));
          box.appendChild(r2);
        }
        builder.appendChild(box);
      });
    }

    /* ---------- truth table (lives under the readouts) ---------- */
    var setR = K.readout(P.readouts, [
      { id: "in", label: "inputs" }, { id: "y", label: "output Y", cls: "c-acc" }, { id: "like", label: "behaves like" },
      { id: "gates", label: "gates used" }, { id: "rows", label: "rows filled" }, { id: "ones", label: "rows with Y = 1", cls: "c-acc" }
    ]);
    var tableBox = K.h('<div class="truth" style="grid-column:1/-1;overflow-x:auto"></div>');
    P.readouts.appendChild(tableBox);
    tableBox.addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-row]");
      if (!tr || playing) return;
      var tt = truth(gates), vals = rowVals(tt.vars, +tr.dataset.row);
      tt.vars.forEach(function (v) { inputs[v] = vals[v]; });
      settle(); update(true);
    });

    function renderTable() {
      var tt = truth(gates), cur = rowIndex(tt.vars), cell = "padding:4px 10px;text-align:center;border-bottom:1px solid var(--line);";
      var head = tt.vars.concat(gates.length > 1 ? gates.slice(0, -1).map(function (g, i) { return "G" + (i + 1); }) : []).concat(["Y"]);
      var html = '<table style="border-collapse:collapse;font:600 13px var(--mono);margin-top:4px"><thead><tr>' +
        head.map(function (hd) { return '<th style="' + cell + "color:" + (hd === "Y" ? "var(--acc)" : "var(--muted)") + '">' + hd + "</th>"; }).join("") + "</tr></thead><tbody>";
      tt.rows.forEach(function (row, r) {
        var on = r === cur, show = filled[r];
        html += '<tr data-row="' + r + '" style="cursor:pointer;' + (on ? "background:var(--surface-2);outline:2px solid var(--acc);" : "") + '">' +
          tt.vars.map(function (v) { return '<td style="' + cell + '">' + row.vals[v] + "</td>"; }).join("") +
          (gates.length > 1 ? row.outs.slice(0, -1).map(function (o) { return '<td style="' + cell + 'color:var(--muted)">' + (show ? o : "?") + "</td>"; }).join("") : "") +
          '<td style="' + cell + "color:var(--acc);font-weight:800" + '">' + (show ? row.y : "?") + "</td></tr>";
      });
      html += '</tbody></table><p class="control-hint">Click a row to set the switches. "?" rows haven\'t been tried yet.</p>';
      tableBox.innerHTML = html;
    }
    function complete() { var n = 1 << varsOf(gates).length; for (var r = 0; r < n; r++) if (!filled[r]) return false; return true; }
    function rowIndex(vars) { return vars.reduce(function (r, v) { return r * 2 + inputs[v]; }, 0); }

    /* ---------- simulation ---------- */
    // paused: everything settles at once. Playing: each gate takes DELAY to respond, like a real chip.
    function settle() {
      var e = evaluate(gates, inputs);
      gates.forEach(function (g, i) { g.out = g.next = e.outs[i]; g.since = 0; });
      filled[rowIndex(varsOf(gates))] = true;
    }
    function changed() {
      sim.pause(); if (transportUI) transportUI.render();
      playing = false; filled = {}; playDone = false;
      var vars = varsOf(gates);
      ["A", "B", "C"].forEach(function (v) { if (vars.indexOf(v) === -1 && v === "C") inputs.C = 0; });
      renderBuilder(); settle(); resetRec(); checkTries(); update(true);
    }
    function reset() {
      sim.pause(); sim.resetClock(); if (transportUI) transportUI.render();
      playing = false; filled = {}; settle(); resetRec();
      P.time.textContent = "t = 0.00 s";
      update(true);
    }
    function resetRec() {
      var n = 1 << varsOf(gates).length;
      rec = { t: [], x: {}, g: gates.map(function () { return []; }), y: [], ideal: [] };
      ["A", "B", "C"].forEach(function (v) { rec.x[v] = []; });
      [gIn, gOut, gMid].forEach(function (g) { g.o.xMax = n * ROW_T; });
      sim.resetClock();
    }
    function startPlay() {
      sim.resetClock(); resetRec(); filled = {}; playing = true; playDone = false;
      var vars = varsOf(gates); vars.forEach(function (v) { inputs[v] = 0; });
      settle();                                   // start from a settled circuit at row 0
      record(0);
    }
    function push(arr, t, v) {
      if (arr.length && arr[arr.length - 1][1] !== v) arr.push([t, arr[arr.length - 1][1]]);
      arr.push([t, v]);
    }
    function record(t) {
      var vars = varsOf(gates);
      vars.forEach(function (v) { push(rec.x[v], t, inputs[v]); });
      gates.forEach(function (g, i) { push(rec.g[i], t, g.out); });
      push(rec.y, t, gates[gates.length - 1].out);
      push(rec.ideal, t, evaluate(gates, inputs).y);
    }
    sim.on("step", function (t) {
      if (!playing) return;
      var vars = varsOf(gates), n = 1 << vars.length;
      if (t >= n * ROW_T - 1e-9) {
        record(n * ROW_T);
        playing = false; playDone = true; sim.pause(); transportUI.render();
        settle(); tries.mark("fill");
        K.flash(P.note, "All " + n + " rows done. Y = 1 in " + truth(gates).rows.filter(function (r) { return r.y; }).length + " of them");
        update(true); return;
      }
      var r = Math.floor(t / ROW_T + 1e-9), vals = rowVals(vars, r);
      vars.forEach(function (v) { inputs[v] = vals[v]; });
      // each gate looks at its inputs as they are now, and changes its output DELAY after they change
      var outs = gates.map(function (g) { return g.out; });
      gates.forEach(function (g) {
        var T = TYPES[g.type], want = T.f(srcVal(g.a, inputs, outs), T.n === 2 ? srcVal(g.b, inputs, outs) : 0);
        if (want !== g.next) { g.next = want; g.since = 0; }
        if (g.out !== g.next) { g.since += K.DT; if (g.since >= DELAY - 1e-9) g.out = g.next; }
      });
      if (t - r * ROW_T >= 0.5 * ROW_T) filled[r] = true;          // settled: write the row in
      record(t);
      update(false);
    });

    /* ---------- layout + drawing ---------- */
    var IN_X = 70;
    function inY(v, vars) {
      var list = vars.indexOf("C") !== -1 ? ["A", "B", "C"] : ["A", "B"];
      var ys = list.length === 3 ? [100, 220, 340] : [150, 290];
      return ys[list.indexOf(v)];
    }
    function shown() { var v = varsOf(gates); return v.indexOf("C") !== -1 ? ["A", "B", "C"] : ["A", "B"]; }
    function layout() {
      var vars = varsOf(gates), depth = [], pos = [];
      gates.forEach(function (g, i) {
        var d = 0;
        [g.a, TYPES[g.type].n === 2 ? g.b : null].forEach(function (s) { if (s && s.charAt(0) === "G") d = Math.max(d, depth[+s.slice(1) - 1]); });
        depth[i] = d + 1;
      });
      var maxD = Math.max.apply(null, depth), colW = Math.min(240, 560 / Math.max(1, maxD));
      for (var d = 1; d <= maxD; d++) {
        var col = []; depth.forEach(function (dd, i) { if (dd === d) col.push(i); });
        col.forEach(function (i, k) {
          var y;
          if (col.length === 1) {
            var g = gates[i], ys = [g.a, TYPES[g.type].n === 2 ? g.b : g.a].map(function (s) { return s.charAt(0) === "G" ? pos[+s.slice(1) - 1].y : inY(s, vars); });
            y = (ys[0] + ys[1]) / 2;
          } else y = col.length === 2 ? [140, 300][k] : [100, 220, 340][k];
          pos[i] = { x: 250 + (d - 1) * colW, y: y, col: k };
        });
      }
      return { pos: pos, outX: Math.min(900, 250 + (maxD - 1) * colW + 170) };
    }
    function pinsOf(g, p) {
      var two = TYPES[g.type].n === 2;
      return { ins: two ? [{ x: p.x - 40, y: p.y - 16 }, { x: p.x - 40, y: p.y + 16 }] : [{ x: p.x - 40, y: p.y }], out: { x: p.x + 52, y: p.y } };
    }
    function srcPoint(s, lay, vars) {
      if (s.charAt(0) === "G") { var i = +s.slice(1) - 1; return { pt: pinsOf(gates[i], lay.pos[i]).out, v: gates[i].out }; }
      return { pt: { x: IN_X + 46, y: inY(s, vars) }, v: inputs[s] };
    }
    function wire(ctx, a, b, midX, on) {
      var pts = [[a.x, a.y], [midX, a.y], [midX, b.y], [b.x, b.y]];
      ctx.strokeStyle = on ? HI : LO; ctx.lineWidth = on ? 3.5 : 2.5; ctx.lineJoin = "round";
      ctx.beginPath(); pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
      if (on) {                                   // a high wire carries a little flow of dots
        var len = Math.abs(midX - a.x) + Math.abs(b.y - a.y) + Math.abs(b.x - midX), off = (sim.time * 60) % 22;
        ctx.fillStyle = K.alpha(th["canvas-bg"] || "#ffffff", 0.9);
        for (var d = off; d < len; d += 22) {
          var p = along(pts, d); ctx.beginPath(); ctx.arc(p[0], p[1], 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    function along(pts, d) {
      for (var i = 1; i < pts.length; i++) {
        var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (d <= l) { var f = l ? d / l : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; }
        d -= l;
      }
      return pts[pts.length - 1];
    }
    function txt(ctx, s, x, y, color, size, align) {
      ctx.fillStyle = color || th.ink; ctx.font = "700 " + (size || 13) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
    }
    function drawGate(ctx, g, p, i) {
      var x = p.x, y = p.y, t = g.type, on = g.out;
      ctx.save();
      ctx.fillStyle = th.surface; ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (t === "AND" || t === "NAND") {
        ctx.moveTo(x - 40, y - 30); ctx.lineTo(x, y - 30); ctx.arc(x, y, 30, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x - 40, y + 30); ctx.closePath();
      } else if (t === "NOT") {
        ctx.moveTo(x - 32, y - 26); ctx.lineTo(x + 30, y); ctx.lineTo(x - 32, y + 26); ctx.closePath();
      } else {
        ctx.moveTo(x - 40, y - 30); ctx.quadraticCurveTo(x + 10, y - 30, x + 40, y); ctx.quadraticCurveTo(x + 10, y + 30, x - 40, y + 30);
        ctx.quadraticCurveTo(x - 22, y, x - 40, y - 30);
      }
      ctx.fill(); ctx.stroke();
      if (t === "XOR") { ctx.beginPath(); ctx.moveTo(x - 50, y - 30); ctx.quadraticCurveTo(x - 32, y, x - 50, y + 30); ctx.stroke(); }
      var bub = t === "NAND" || t === "NOR" ? x + 46 : t === "NOT" ? x + 36 : 0;
      if (bub) { ctx.beginPath(); ctx.arc(bub, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      // stub from the body to the output pin
      ctx.strokeStyle = on ? HI : LO; ctx.lineWidth = on ? 3.5 : 2.5;
      ctx.beginPath(); ctx.moveTo(bub ? bub + 6 : x + (t === "AND" ? 30 : 40), y); ctx.lineTo(x + 52, y); ctx.stroke();
      ctx.restore();
      txt(ctx, t, x - 8, y + 46, th.muted, 12);
      txt(ctx, "G" + (i + 1), x - 8, y - 42, th.muted, 11);
    }
    sim.on("under", function (ctx) {
      var vars = varsOf(gates), lay = layout(), list = shown();
      // wires first, so gates sit on top of them
      gates.forEach(function (g, i) {
        var pins = pinsOf(g, lay.pos[i]).ins, srcs = TYPES[g.type].n === 2 ? [g.a, g.b] : [g.a];
        srcs.forEach(function (s, k) {
          var sp = srcPoint(s, lay, vars), mid = pins[k].x - 16 - 9 * k - 20 * lay.pos[i].col;
          if (s.charAt(0) === "G") mid = Math.max(mid, sp.pt.x + 10);
          wire(ctx, sp.pt, pins[k], mid, sp.v);
          ctx.fillStyle = sp.v ? HI : LO; ctx.beginPath(); ctx.arc(sp.pt.x, sp.pt.y, 3.5, 0, Math.PI * 2); ctx.fill();
        });
      });
      gates.forEach(function (g, i) { drawGate(ctx, g, lay.pos[i], i); });
      // output lamp
      var last = gates.length - 1, op = pinsOf(gates[last], lay.pos[last]).out, y = gates[last].out, lx = lay.outX;
      wire(ctx, op, { x: lx - 26, y: op.y }, (op.x + lx) / 2, y);
      ctx.fillStyle = y ? th.acc : th.surface; ctx.strokeStyle = y ? th.acc : th.line; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lx, op.y, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (y) { ctx.strokeStyle = K.alpha(th.acc, 0.35); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(lx, op.y, 34, 0, Math.PI * 2); ctx.stroke(); }
      txt(ctx, "Y = " + y, lx, op.y + 46, th.acc, 15);
      // input switches
      list.forEach(function (v) {
        var yy = inY(v, vars), on = inputs[v], used = vars.indexOf(v) !== -1;
        ctx.globalAlpha = used ? 1 : 0.4;
        ctx.fillStyle = on ? HI : th.surface; ctx.strokeStyle = on ? HI : th.line; ctx.lineWidth = 2;
        roundRect(ctx, IN_X - 30, yy - 18, 76, 36, 18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = on ? "#fff" : th.muted; ctx.beginPath(); ctx.arc(on ? IN_X + 28 : IN_X - 12, yy, 13, 0, Math.PI * 2); ctx.fill();
        txt(ctx, v + " = " + on, IN_X + 8, yy - 32, on ? HI : th.ink, 14);
        ctx.globalAlpha = 1;
      });
      txt(ctx, playing ? "playing every combination…" : "click a switch to flip it · click a gate to change it", 980, 425, th.muted, 11, "right");
      var like = behaves(gates);
      txt(ctx, "Y = " + plain(gates), 20, 404, th.ink, 13, "left");
      if (like && mode === "circuit" && complete()) txt(ctx, "behaves like " + like.name, 20, 425, th.acc, 12, "left");
    });
    function plain(gs) { return texOf(gs, "G" + gs.length, inputs, false).replace(/\\overline\{([^{}]*)\}/g, "NOT($1)").replace(/\\overline\{/g, "NOT(").replace(/\}/g, ")").replace(/\\cdot /g, "·").replace(/\\oplus /g, "⊕"); }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    sim.pointer({
      down: function (p) {
        var vars = varsOf(gates), lay = layout(), hit = null;
        shown().forEach(function (v) { if (Math.abs(p.px - (IN_X + 8)) < 50 && Math.abs(p.py - inY(v, vars)) < 26) hit = v; });
        if (hit) { toggle(hit); return; }
        for (var i = 0; i < gates.length; i++) {
          var q = lay.pos[i];
          if (Math.abs(p.px - q.x) < 48 && Math.abs(p.py - q.y) < 36) { cycleGate(i); return; }
        }
        return false;
      },
      hover: function (p) {
        var vars = varsOf(gates), lay = layout(), on = shown().some(function (v) { return Math.abs(p.px - (IN_X + 8)) < 50 && Math.abs(p.py - inY(v, vars)) < 26; }) ||
          gates.some(function (g, i) { return Math.abs(p.px - lay.pos[i].x) < 48 && Math.abs(p.py - lay.pos[i].y) < 36; });
        P.canvas.style.cursor = on ? "pointer" : "";
      }
    });
    function toggle(v) {
      if (playing) { K.flash(P.note, "Pause first, then flip the switches yourself"); return; }
      inputs[v] = inputs[v] ? 0 : 1; settle(); update(true);
    }
    function cycleGate(i) {
      var g = gates[i], nxt = TYPE_LIST[(TYPE_LIST.indexOf(g.type) + 1) % TYPE_LIST.length];
      if (mode === "single") { var b = gateSeg.querySelector('button[data-value="' + nxt + '"]'); if (b) b.click(); return; }
      g.type = nxt; edited();
      K.flash(P.note, "G" + (i + 1) + " is now " + nxt);
    }

    /* ---------- graphs ---------- */
    P.graphs.innerHTML =
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-vel">inputs</b> · Play counts through them in binary, one row per second</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b class="c-acc">output Y</b> · solid: the gates (each takes 0.1 s to respond), dashed: the Boolean expression</p></div>' +
      '<div class="graph"><canvas></canvas><p class="graph-cap"><b>inside the circuit</b> · each gate\'s output, stacked</p></div>';
    var cv = P.graphs.querySelectorAll("canvas");
    var gIn = new K.Graph(cv[0], { yLabel: "inputs", xMax: 4, yMin: 0, yMax: 3.4, color: th.vel });
    var gOut = new K.Graph(cv[1], { yLabel: "Y", xMax: 4, yMin: 0, yMax: 1.1, color: th.acc });
    var gMid = new K.Graph(cv[2], { yLabel: "gates", xMax: 4, yMin: 0, yMax: 3.4, color: th.ink });
    function stackLabels(names) {
      return function (ctx, X, Y) {
        ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        names.forEach(function (n, k) { ctx.fillStyle = n.c; ctx.fillText(n.s, X(0) + 4, Y(n.off + 0.5)); });
      };
    }

    /* ---------- maths + readouts ---------- */
    P.eqs.innerHTML = ["Output, from the wiring", "Gate by gate", "De Morgan's laws, with your inputs", "Rows of the truth table"].map(function (l) {
      return '<div class="eq"><p class="eq-label">' + l + '</p><div class="eq-tex"></div></div>';
    }).join("");
    var eqEls = P.eqs.querySelectorAll(".eq-tex");
    var slowMaths = K.throttle(function () { renderMaths(); }, 120);

    function update(force) {
      var vars = varsOf(gates), list = ["A", "B", "C"].filter(function (v) { return vars.indexOf(v) !== -1; }), m = list.length;
      gIn.clear(); gOut.clear(); gMid.clear();
      var lab1 = [];
      list.forEach(function (v, k) {
        var off = 1.2 * (m - 1 - k);
        gIn.set(v, { points: rec.x[v].map(function (q) { return [q[0], off + 0.8 * q[1]]; }), color: th.vel, width: 2.5 });
        lab1.push({ s: v, off: off, c: th.vel });
      });
      gIn.o.yMax = 1.2 * m; gIn.extra = stackLabels(lab1);
      gOut.set("ideal", { points: rec.ideal, color: th.acc, dash: [5, 5], width: 1.5 });
      gOut.set("sim", { points: rec.y, color: th.acc, width: 2.5, dot: playing });
      var lab3 = [], ng = gates.length;
      gates.forEach(function (g, i) {
        var off = 1.2 * (ng - 1 - i);
        gMid.set("g" + i, { points: rec.g[i].map(function (q) { return [q[0], off + 0.8 * q[1]]; }), color: i === ng - 1 ? th.acc : th.ink, width: 2.5 });
        lab3.push({ s: "G" + (i + 1) + " " + g.type, off: off, c: i === ng - 1 ? th.acc : th.ink });
      });
      gMid.o.yMax = 1.2 * ng; gMid.extra = stackLabels(lab3);
      [gIn, gOut, gMid].forEach(function (g) { g.dirty = true; g.draw(); });
      P.hud.innerHTML = list.map(function (v) { return "<span>" + v + " = " + inputs[v] + "</span>"; }).join("") + '<span class="c-acc">Y = ' + gates[gates.length - 1].out + "</span>";
      if (force) { renderMaths(); renderTable(); } else { slowMaths(); if (sim.steps % 6 === 0) renderTable(); }
    }

    function renderMaths() {
      var tt = truth(gates), y = evaluate(gates, inputs).y, last = "G" + gates.length, like = behaves(gates), A = inputs.A, B = inputs.B;
      K.tex(eqEls[0], "Y = " + texOf(gates, last, inputs, false) + " = " + texOf(gates, last, inputs, true) + " = \\mathbf{" + y + "}");
      K.tex(eqEls[1], gates.map(function (g, i) {
        return "G_" + (i + 1) + " = " + texOf(gates, "G" + (i + 1), inputs, false) + " = \\mathbf{" + evaluate(gates, inputs).outs[i] + "}";
      }).join(",\\quad "));
      K.tex(eqEls[2], "\\overline{A\\cdot B} = \\overline{A} + \\overline{B}:\\ \\overline{" + A + "\\cdot " + B + "} = " + (1 - A) + " + " + (1 - B) + " = \\mathbf{" + (1 - (A & B)) + "}" +
        "\\qquad \\overline{A + B} = \\overline{A}\\cdot\\overline{B}:\\ \\overline{" + A + " + " + B + "} = " + (1 - A) + "\\cdot " + (1 - B) + " = \\mathbf{" + (1 - (A | B)) + "}");
      var ones = tt.rows.filter(function (r) { return r.y; }).length;
      var nf = Object.keys(filled).filter(function (k) { return +k < tt.rows.length; }).length;
      K.tex(eqEls[3], "2^{" + tt.vars.length + "} = \\mathbf{" + tt.rows.length + "}\\ \\text{rows},\\quad " + (nf === tt.rows.length ? "Y = 1\\ \\text{in}\\ \\mathbf{" + ones + "}" +
        (like ? "\\quad\\Rightarrow\\quad Y = " + like.tex : "") : "\\text{filled so far: } " + nf));
      setR("in", tt.vars.map(function (v) { return v + "=" + inputs[v]; }).join(" "), "");
      setR("y", String(gates[gates.length - 1].out), "expression gives " + y);
      var done = nf === tt.rows.length;
      setR("like", done ? (like ? like.name : "its own function") : "?", done ? (preset && !/^Mystery/.test(PRESETS[preset].label) ? "target: " + PRESETS[preset].target : "") : "fill the table first");
      setR("gates", String(gates.length), gates.map(function (g) { return g.type; }).join(", "));
      setR("rows", nf + " of " + tt.rows.length, nf === tt.rows.length ? "complete" : "press Play");
      setR("ones", nf === tt.rows.length ? String(ones) : "?", "of " + tt.rows.length);
    }

    function checkTries() {
      if (!custom || mode !== "circuit") return;
      var like = behaves(gates), types = gates.map(function (g) { return g.type; });
      var only = function (list) { return types.every(function (t) { return list.indexOf(t) !== -1; }); };
      if (like && /^NOT [AB]$/.test(like.name) && only(["NAND"])) tries.mark("nandnot");
      if (like && like.name === "XOR" && types.indexOf("XOR") === -1) tries.mark("xor");
      if (like && like.name === "NOR" && only(["AND", "NOT"])) tries.mark("demorgan");
    }

    /* ---------- the idea + practice ---------- */
    P.concept.innerHTML = K.md(
      "<p>A logic gate turns input voltages into an output voltage: high is <b class=\"c-vel\">1</b>, low is <b>0</b>. Inside, diodes and transistors act as switches, but all you need is the rule. <b>AND</b> $A\\cdot B$ is 1 only if both are 1. <b>OR</b> $A + B$ is 1 if either is. <b>NOT</b> $\\overline{A}$ flips. A bubble on the output means NOT: <b>NAND</b> $\\overline{A\\cdot B}$, <b>NOR</b> $\\overline{A + B}$. <b>XOR</b> $A\\oplus B$ is 1 when the inputs differ.</p>" +
      "<p>To find what a circuit does, work from the inputs outwards, one gate at a time, and write each gate's output on its wire. With $n$ inputs there are $2^n$ rows to check.</p>" +
      "<p>NAND and NOR are <b>universal</b>: tie the inputs together and you get NOT, add another and you get AND (from NANDs) or OR (from NORs), and from those you can build anything. Chips are made mostly of NANDs for exactly this reason.</p>" +
      '<div class="trap"><b>JEE trap: the bar doesn\'t distribute.</b> $\\overline{A\\cdot B}$ is <i>not</i> $\\overline{A}\\cdot\\overline{B}$. De Morgan says breaking the bar flips the operation: $\\overline{A\\cdot B} = \\overline{A} + \\overline{B}$ and $\\overline{A + B} = \\overline{A}\\cdot\\overline{B}$. ' +
      "Check one row: A = 1, B = 0 gives NAND = 1 but $\\overline{A}\\cdot\\overline{B} = 0$.</div>");

    function setSeg(el, value) { var b = el.querySelector('button[data-value="' + value + '"]'); if (b && b.getAttribute("aria-pressed") !== "true") b.click(); }
    function apply(s) {
      setSeg(modeSeg, s.mode);
      if (s.mode === "single") { setSeg(gateSeg, s.gate); single = s.gate; setSingle(); }
      else loadPreset(s.preset);
      ["A", "B", "C"].forEach(function (v) { inputs[v] = s[v] || 0; });
      reset();
    }
    var Q = [
      { level: "easy", tag: "NAND", setup: { mode: "single", gate: "NAND", A: 1, B: 0 }, watch: "Look at the lamp, then flip the switches to check the other rows",
        q: "A NAND gate has inputs $A = 1$ and $B = 0$. What is its output?",
        options: ["0", "1", "the same as A", "it depends on the previous output"], answer: 1,
        explain: "NAND is NOT(AND). $1\\cdot 0 = 0$, and inverting gives $\\overline{0} = 1$. A NAND is 0 only when <i>both</i> inputs are 1." },
      { level: "medium", tag: "which gate is it?", setup: { mode: "circuit", preset: "xornor", A: 0, B: 0 }, watch: "Predict, then press Play and read the Y column",
        q: "$A$ and $B$ go into a NOR gate and into an AND gate. The two outputs go into a second NOR gate, whose output is $Y$. Which single gate is this circuit equivalent to?",
        options: ["XNOR", "OR", "XOR", "NAND"], answer: 2,
        hints: ["Write the outputs: $G_1 = \\overline{A + B}$, $G_2 = A\\cdot B$, $Y = \\overline{G_1 + G_2}$.", "$G_1 + G_2$ is 1 when both inputs are equal (both 0 or both 1). $Y$ inverts that."],
        explain: "$Y = \\overline{\\overline{A + B} + A\\cdot B} = (A + B)\\cdot\\overline{A\\cdot B}$ by De Morgan: 1 when exactly one input is 1. The table reads 0, 1, 1, 0: XOR. Getting XNOR means you forgot the final inversion." },
      { level: "hard", tag: "3-input circuit", setup: { mode: "circuit", preset: "bc", A: 0, B: 0, C: 0 }, watch: "Predict the count, then press Play and count the 1s in the Y column",
        q: "$G_1 = \\text{NAND}(A, B)$, $G_2 = \\text{NOR}(B, C)$, and $Y = \\text{NAND}(G_1, G_2)$. For how many of the 8 input combinations is $Y = 1$?",
        options: ["2", "4", "6", "7"], answer: 2,
        hints: ["NAND of two signals is $\\overline{G_1\\cdot G_2} = \\overline{G_1} + \\overline{G_2}$ (De Morgan).", "$\\overline{G_1} = A\\cdot B$ and $\\overline{G_2} = B + C$. Now simplify $AB + B + C$."],
        explain: "$Y = \\overline{G_1} + \\overline{G_2} = AB + B + C = B + C$, because $AB$ is already covered by $B$. So $A$ doesn't matter at all, and $Y = 0$ only when $B = C = 0$: 2 of the 8 rows. That leaves $8 - 2 = 6$ rows with $Y = 1$." }
    ];
    K.practice(P.quiz, Q, apply, P);

    var tries = K.Tries(P.tries, lab.id, lab.tries, function () { K.refreshProgress(document); count(); });
    function count() { P.triesCount.textContent = tries.count() + " of " + tries.total + " done"; }
    count();

    var transportUI = null;
    transportUI = K.transport(P, sim, { playLabel: "Play all inputs", onReset: reset, onPlay: function () { startPlay(); } });
    singleBox.hidden = false; circBox.hidden = true;
    setSingle();

    if (location.hostname === "localhost") {
      window.__lab_logic = {
        apply: apply, questions: Q, PRESETS: PRESETS, TYPES: TYPES, evaluate: evaluate, truth: truth, behaves: behaves,
        loadPreset: loadPreset, toggle: toggle, setMode: function (v) { setSeg(modeSeg, v); },
        build: function (list) { setSeg(modeSeg, "circuit"); gates = list.map(function (g) { return gate(g[0], g[1], g[2]); }); edited(); },
        state: function () { return { mode: mode, gates: gates, inputs: inputs, y: gates[gates.length - 1].out, filled: filled, playing: playing, rec: rec, table: truth(gates), like: behaves(gates) }; }
      };
    }

    return function destroy() { sim.destroy(); [gIn, gOut, gMid].forEach(function (g) { g.destroy(); }); if (window.__lab_logic) delete window.__lab_logic; };
  }
})();
