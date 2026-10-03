// Semiconductors: diode (Shockley, load line, depletion width, r_d, rectifiers) and logic gates.
T.run(function () {
  /* ---------- diode ---------- */
  var t = T.mount("diode"), L = window.__lab_diode, Q = L.questions, s, m;
  T.ok("diode mounts with a sim", !!t.sim);
  T.ok("diode readouts render", T.text(".readouts").length > 20);
  var si = { m: L.MAT.si, zener: false, Vz: 5 }, ge = { m: L.MAT.ge, zener: false, Vz: 5 };

  // easy practice: 5 V, 1 kΩ, Si -> 4.3 mA (knee model)
  L.apply(Q[0].setup); s = L.state();
  T.check("easy: I ≈ (5 − 0.7)/1 kΩ = 4.3 mA", s.op.I * 1e3, 4.3, 0.06);
  T.check("easy: Shockley at V_D equals the loop current", L.diodeI(s.op.V, si) * 1e3, s.op.I * 1e3, 1e-6);
  T.check("easy: V_D near the 0.7 V knee", s.op.V, 0.7, 0.04);
  T.ok("easy answer is option B (4.3 mA)", Q[0].answer === 1);
  T.check("r_d (ΔV/ΔI from the circuit) = ηV_T/(I + I_s)", s.op.rdSim, 2 * L.VT / (s.op.I + L.MAT.si.Is), 0.002 * 2 * L.VT / s.op.I);
  T.check("depletion width = √(1 − V/V0)", s.op.W, Math.sqrt(Math.max(0, 1 - s.op.V / 0.7)), 1e-9);

  // germanium: 2 V through 500 Ω -> (2 − 0.3)/500 = 3.4 mA
  L.apply({ mode: "junction", mat: "ge", VB: 2, R: 500 }); s = L.state();
  T.check("Ge: I ≈ (2 − 0.3)/500 Ω = 3.4 mA", s.op.I * 1e3, 3.4, 0.12);
  T.check("Ge: Shockley at V_D equals loop current", L.diodeI(s.op.V, ge) * 1e3, s.op.I * 1e3, 1e-6);

  // reverse bias: only −I_s flows
  L.apply({ mode: "junction", mat: "si", VB: -10, R: 1000 }); s = L.state();
  T.check("reverse: I = −I_s = −10 nA", s.op.I * 1e9, -10, 0.01);
  T.check("reverse: W/W0 = √(1 + 10/0.7)", s.op.W, Math.sqrt(1 + (-s.op.V) / 0.7), 1e-9);
  T.check("reverse: V_D ≈ V_B (no drop across R)", s.op.V, -10, 1e-4);

  // Zener: −12 V, 1 kΩ, Vz = 5
  L.apply({ mode: "junction", mat: "si", VB: -12, R: 1000, zener: true, Vz: 5 }); s = L.state();
  T.check("Zener: V_D pinned near −V_z", s.op.V, -5.19, 0.05);
  T.check("Zener: I = (V_B − V_D)/R", s.op.I * 1e3, (-12 - s.op.V), 1e-6);
  T.check("Zener: Shockley+breakdown at V_D equals loop current", L.diodeI(s.op.V, s.dev) * 1e3, s.op.I * 1e3, 1e-6);

  // rectifiers
  L.apply({ mode: "rect", rect: "half", Vm: 10, f: 50, RL: 1, C: 0, ideal: true }); m = L.runRect();
  T.check("half-wave ideal: peak = V_m", m.peak, 10, 0.01);
  T.check("half-wave ideal: V_dc = V_m/π", m.avg, 10 / Math.PI, 0.01);
  T.check("half-wave: ripple frequency = f", m.fr, 50, 0.5);
  L.apply(Q[1].setup); m = L.runRect();
  T.check("medium: bridge peak = 12 − 1.4 = 10.6 V", m.peak, 10.6, 0.01);
  T.check("medium: ripple frequency = 2f = 100 Hz", m.fr, 100, 1);
  T.check("bridge (Si) average = exact integral", m.avg, L.exactAvg(12, 1.4, true), 0.01);
  T.ok("medium answer is option B", Q[1].answer === 1);
  L.apply({ mode: "rect", rect: "full", Vm: 10, f: 50, RL: 1, C: 0, ideal: true }); m = L.runRect();
  T.check("full-wave ideal: V_dc = 2V_m/π", m.avg, 20 / Math.PI, 0.02);
  L.apply(Q[2].setup); m = L.runRect(); s = L.state();
  T.check("hard: formula ripple V_p/(f_r R C) = 1.00 V", s.t.ripple, 1.0, 1e-9);
  // exact ripple (ideal diodes): measuring t from the peak, the diode lets go when the sine falls faster than
  // the RC decay, tan(ωt_off) = 1/(ωRC); then v = Vp cos(ωt_off) e^(−(t − t_off)/RC) until |cos ωt| catches it again
  function exactRipple(Vp, fr, RC) {
    var w = Math.PI * fr, toff = Math.atan(1 / (w * RC)) / w, v0 = Math.cos(w * toff), lo = 0.25 / fr, hi = 1 / fr;
    for (var i = 0; i < 100; i++) { var mid = (lo + hi) / 2; if (v0 * Math.exp(-(mid - toff) / RC) > Math.abs(Math.cos(w * mid))) lo = mid; else hi = mid; }
    return Vp * (1 - v0 * Math.exp(-(lo - toff) / RC));
  }
  T.check("hard: simulated ripple = exact discharge/recharge ripple", m.ripple, exactRipple(20, 100, 0.2), 0.002);
  T.check("hard: simulated ripple within 15% of the 1 V estimate", m.ripple, 1.0, 0.15);
  T.ok("hard: simulated ripple ≤ 1 V with 200 µF", m.ripple <= 1.0, m.ripple);
  T.ok("hard answer is option B (200 µF)", Q[2].answer === 1);
  L.apply({ mode: "rect", rect: "full", Vm: 20, f: 50, RL: 1, C: 100, ideal: true }); m = L.runRect();
  T.check("100 µF: simulated ripple = exact ripple", m.ripple, exactRipple(20, 100, 0.1), 0.004);
  T.ok("100 µF ripple is about twice as big", m.ripple > 1.6 && m.ripple < 2.05, m.ripple);

  // tries
  localStorage.clear();
  t = T.mount("diode"); L = window.__lab_diode;
  L.bias(-5);
  T.ok("try widen triggers", T.text(".tries").length && t.root.querySelectorAll(".try.done").length >= 1);
  L.apply({ mode: "junction", mat: "si", VB: -12, R: 1000, zener: true, Vz: 5 });
  T.ok("try zener triggers", t.root.querySelectorAll(".try.done").length >= 2);
  L.apply({ mode: "rect", rect: "full", Vm: 10, f: 50, RL: 1, C: 200, ideal: false }); L.runRect();
  T.ok("try smooth triggers", t.root.querySelectorAll(".try.done").length >= 3);
  L.apply({ mode: "rect", rect: "full", Vm: 10, f: 50, RL: 1, C: 0, ideal: false }); L.toggleDiode(0); L.runRect(); m = L.state().m;
  T.ok("try broken triggers", t.root.querySelectorAll(".try.done").length >= 4);
  T.check("open diode: bridge becomes half-wave (f_r = f)", m.fr, 50, 0.5);

  /* ---------- logic gates ---------- */
  localStorage.clear();
  t = T.mount("logic"); var G = window.__lab_logic, Lq = G.questions;
  T.ok("logic mounts with a sim", !!t.sim);
  T.ok("logic truth table renders", !!t.root.querySelector(".truth table"));
  // every gate against its textbook truth table, rows 00, 01, 10, 11
  var BOOK = { AND: "0001", OR: "0111", NAND: "1110", NOR: "1000", XOR: "0110" };
  Object.keys(BOOK).forEach(function (k) {
    G.apply({ mode: "single", gate: k, A: 0, B: 0 });
    var col = G.state().table.rows.map(function (r) { return r.y; }).join("");
    T.ok(k + " truth table = " + BOOK[k], col === BOOK[k], col);
  });
  G.build([["NOT", "A", "A"]]);
  T.ok("NOT truth table = 10", G.state().table.rows.map(function (r) { return r.y; }).join("") === "10");
  // clicking the switches changes the lamp
  G.apply({ mode: "single", gate: "AND", A: 0, B: 0 });
  G.toggle("A"); G.toggle("B");
  T.ok("AND: A=1, B=1 lights the lamp", G.state().y === 1);
  G.toggle("B");
  T.ok("AND: A=1, B=0 lamp off", G.state().y === 0);
  // presets behave like their targets
  Object.keys(G.PRESETS).forEach(function (k) {
    G.loadPreset(k);
    var like = G.behaves(G.state().gates);
    T.ok("preset " + G.PRESETS[k].label + " behaves like " + G.PRESETS[k].target, like && like.name === G.PRESETS[k].target, like && like.name);
  });
  // easy: NAND with A=1, B=0
  G.apply(Lq[0].setup);
  T.ok("easy: NAND(1, 0) = 1 = option B", G.state().y === 1 && Lq[0].options[Lq[0].answer] === "1");
  // medium: the mystery circuit is XOR
  G.apply(Lq[1].setup);
  T.ok("medium: Y column is 0110 (XOR)", G.state().table.rows.map(function (r) { return r.y; }).join("") === "0110" && Lq[1].options[Lq[1].answer] === "XOR");
  // hard: Y = B + C, 6 ones out of 8; also fill the table with Play and the timing diagram
  G.apply(Lq[2].setup);
  T.click(/^Play all/);
  T.steps(t.sim, 8 * 60 + 2);
  var st = G.state(), ones = st.table.rows.filter(function (r) { return r.y; }).length;
  T.check("hard: rows with Y = 1", ones, 6, 0);
  T.ok("hard answer option is 6", Lq[2].options[Lq[2].answer] === "6");
  T.ok("hard: behaves like B + C", st.like && st.like.tex === "B + C");
  T.check("Play fills all 8 rows", Object.keys(st.filled).length, 8, 0);
  T.ok("Play stops at the end", !st.playing && !t.sim.running);
  T.ok("ones readout shows 6", /ROWS WITH Y = 1\s*6/i.test(T.text(".readouts").toUpperCase()), T.text(".readouts").slice(0, 200));
  // timing diagram: in the middle of each row, simulated output = Boolean expression = truth table
  var okT = true;
  for (var r = 0; r < 8; r++) {
    var tm = r + 0.6, y = null, yi = null;
    st.rec.y.forEach(function (q) { if (q[0] <= tm) y = q[1]; });
    st.rec.ideal.forEach(function (q) { if (q[0] <= tm) yi = q[1]; });
    if (y !== st.table.rows[r].y || yi !== st.table.rows[r].y) okT = false;
  }
  T.ok("timing diagram output matches the table in every row", okT);
  var lag = null;   // gate delay: the solid output switches after the dashed one
  for (var i = 1; i < st.rec.y.length; i++) if (st.rec.y[i][1] !== st.rec.y[i - 1][1]) { lag = st.rec.y[i][0]; break; }
  T.ok("simulated output lags the expression (gate delay)", lag !== null && lag % 1 > 0.05, lag);
  T.ok("try fill triggers", t.root.querySelectorAll(".try.done").length >= 1);
  // build tries
  G.build([["NAND", "B", "B"]]);
  T.ok("try nandnot triggers", t.root.querySelectorAll(".try.done").length >= 2);
  G.build([["OR", "A", "B"], ["NAND", "A", "B"], ["AND", "G1", "G2"]]);
  T.ok("try xor triggers", t.root.querySelectorAll(".try.done").length >= 3);
  G.build([["NOT", "A", "A"], ["NOT", "B", "B"], ["AND", "G1", "G2"]]);
  T.ok("try demorgan triggers", t.root.querySelectorAll(".try.done").length >= 4);
  T.ok("De Morgan circuit behaves like NOR", G.behaves(G.state().gates).name === "NOR");
});
