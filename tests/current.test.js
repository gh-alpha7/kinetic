// Current electricity: circuits solved by nodal analysis, bridges, and RC charging, against the textbook formulas.
T.run(function () {
  ["circuits", "bridge", "rc"].forEach(function (id) { localStorage.removeItem("kinetic:tries:" + id); });
  function done(id) { return [].slice.call(document.querySelectorAll(".tries li")).filter(function (li) { return li.classList.contains("done") && li.textContent.indexOf(id) !== -1; }).length > 0; }
  function triesDone() { return document.querySelectorAll(".tries li.done").length; }

  /* ---------- circuits ---------- */
  var t = T.mount("circuits"), L = window.__lab_circuits, s = L.state();
  T.ok("circuits: sim exists", !!t.sim);
  T.check("series: I = E/(R1+R2+R3)", s.I.w1, 12 / 12, 1e-9);
  T.check("series: V after R1 = 12 − 2", s.V.c, 10, 1e-9);
  T.check("series: V after R2 = 10 − 4", s.V.d, 6, 1e-9);
  T.check("series: KVL sum", s.walk[s.walk.length - 1][1] - s.walk[0][1], 0, 1e-9);
  T.check("series: Thevenin R seen by R2 = R1 + R3", s.info.th.R, 8, 1e-6);
  T.ok("series: KVL text", /= \\mathbf\{0.00\}/.test(s.kvl), s.kvl);

  L.setPreset("parallel"); s = L.state();
  T.check("parallel: I1 = 12/4", s.I.r1, 3, 1e-9);
  T.check("parallel: I2 = 12/5", s.I.r2, 2.4, 1e-9);
  T.check("parallel: I3 = 12/6", s.I.r3, 2, 1e-9);
  T.check("parallel: battery = sum", s.I.bat, 7.4, 1e-9);
  T.ok("parallel: KCL text", s.kcl.indexOf("7.40 = 3.00 + 4.40") !== -1, s.kcl);
  [0, 1, 2].forEach(function (i) { L.loop(i); var w = L.state().walk; T.check("parallel: loop " + i + " closes (KVL)", w[w.length - 1][1] - w[0][1], 0, 1e-9); });
  T.click(/^Flow/); t.sim.pause(); var ph0 = L.state().phase; T.steps(t.sim, 30); var ph1 = L.state().phase;
  // branch order: bat, wb, r1, w12, r2, w23, r3 ...
  T.check("parallel: dot speed ∝ current (r1 / r3)", (ph1[2] - ph0[2]) / (ph1[6] - ph0[6]), 3 / 2, 1e-9);
  T.ok("circuits: try share not yet", !done("2 : 1"));
  L.set("R3", 10);
  T.ok("circuits: try 'share' triggers (R2 = 5, R3 = 10)", done("2 : 1"));

  // practice easy: mixed, 12 V, 2 + (6 || 3)
  L.apply({ preset: "mixed", E1: 12, R1: 2, R2: 6, R3: 3 }); s = L.state();
  T.check("easy: cell current 3 A", s.I.bat, 3, 1e-9);
  T.check("easy: I2 = 1 A", s.I.r2, 1, 1e-9);
  T.check("easy: I3 = 2 A", s.I.r3, 2, 1e-9);

  // practice medium: max power 12.5 W at R = r = 2
  L.apply({ preset: "battery", E1: 10, r: 2, R: 2, sel: "R" }); s = L.state();
  T.check("medium: P at R = r", s.info.Psel, 12.5, 1e-9);
  T.check("medium: Thevenin R = r", s.info.th.R, 2, 1e-6);
  T.check("medium: terminal V = E − Ir", s.info.Vterm, 10 - 2.5 * 2, 1e-9);
  T.ok("circuits: try 'maxpower' triggers", done("most power"));
  T.ok("readout shows 12.50 W", T.text(".readouts").indexOf("12.50 W") !== -1, T.text(".readouts"));
  L.set("R", 3); T.check("battery: P(3 Ω) = E²R/(R+r)²", L.state().info.Psel, 100 * 3 / 25, 1e-9);
  L.set("R", 1); s = L.state();
  T.check("battery: V = ER/(R+r)", s.info.Vterm, 10 / 3, 1e-9);
  T.ok("circuits: try 'sag' triggers", done("E/2"));

  // practice hard: two batteries
  L.apply({ preset: "network", E1: 10, E2: 4, R1: 2, R2: 4, R3: 4, sel: "R3" }); s = L.state();
  T.check("hard: I3 = 1.5 A", s.I.r3, 1.5, 1e-9);
  T.check("hard: I1 = 2 A", s.I.r1, 2, 1e-9);
  T.check("hard: I2 = −0.5 A (E2 charged)", s.I.bat2, -0.5, 1e-9);
  T.check("hard: junction at 6 V", s.V.t, 6, 1e-9);
  [0, 1, 2].forEach(function (i) { L.loop(i); var w = L.state().walk; T.check("network: loop " + i + " closes", w[w.length - 1][1] - w[0][1], 0, 1e-9); });
  T.check("network: ΣEI = ΣI²R", s.info.emfPower, s.info.heat, 1e-9);
  T.ok("circuits: try 'charging' triggers", done("backwards"));
  T.check("circuits: all 4 tries", triesDone(), 4, 0);

  /* ---------- bridge ---------- */
  t = T.mount("bridge"); var B = window.__lab_bridge; s = B.state();
  function thev(v) { var VB = v.E * v.Q / (v.P + v.Q), VD = v.E * v.S / (v.R + v.S); return (VB - VD) / (v.P * v.Q / (v.P + v.Q) + v.R * v.S / (v.R + v.S) + v.G); }
  T.check("wheat: Ig (nodal) = Thevenin", s.Ig, thev(s.vals), 1e-12);
  B.set("G", 100); B.set("E", 3); s = B.state();
  T.check("wheat: Ig with G = 100, E = 3", s.Ig, thev(s.vals), 1e-12);
  B.set("G", 20); B.set("E", 6);
  // practice easy: S = QR/P = 30
  B.apply({ mode: "wheat", P: 10, Q: 20, R: 15, S: 30 }); s = B.state();
  T.check("easy: balanced at S = 30", s.Ig, 0, 1e-12);
  T.check("easy: V_B = V_D", s.V.B - s.V.D, 0, 1e-12);
  T.ok("bridge: try 'balance' triggers", done("P ≠ Q"));
  B.set("E", 9); B.set("G", 150);
  T.check("balance survives new E and G", B.state().Ig, 0, 1e-12);
  T.ok("bridge: try 'robust' triggers", done("ignores"));
  B.set("S", 29); T.ok("S = 29 unbalances", Math.abs(B.state().Ig) > 1e-5);

  // practice medium: meter bridge, 4 Ω, null at 40 cm, X = 6
  B.apply({ mode: "meter", Rb: 4, X: 6, l: 40, al: 0, be: 0, swapped: false, mystery: false }); s = B.state();
  T.check("medium: null at 40 cm", s.l0, 40, 1e-9);
  T.check("medium: Ig = 0 at l = 40", s.Ig, 0, 1e-12);
  T.ok("medium: X readout 6.00 Ω", T.text(".readouts").indexOf("6.00 Ω") !== -1, T.text(".readouts"));
  B.set("l", 30); s = B.state();
  function mthev(v, l, sw) {
    var Lr = sw ? v.X : v.Rb, Rr = sw ? v.Rb : v.X, WL = 0.04 * (l + v.al), WR = 0.04 * (100 - l + v.be);
    return (v.E * Rr / (Lr + Rr) - v.E * WR / (WL + WR)) / (Lr * Rr / (Lr + Rr) + WL * WR / (WL + WR) + v.G);
  }
  T.check("meter: Ig at l = 30 (nodal) = Thevenin", s.Ig, mthev(s.vals, 30, false), 1e-12);

  // practice hard: end corrections α = 2, β = 1
  B.apply({ mode: "meter", Rb: 10, X: 15, l: 39.2, al: 2, be: 1, swapped: false, mystery: false }); s = B.state();
  T.check("hard: null at 39.2 cm", s.l0, 39.2, 1e-9);
  T.check("hard: Ig = 0 at 39.2", s.Ig, 0, 1e-12);
  B.swap(); s = B.state();
  T.check("hard: swapped null at 59.8 cm", s.l0, 59.8, 1e-9);
  B.set("l", 59.8); s = B.state();
  T.check("hard: Ig = 0 at 59.8", s.Ig, 0, 1e-12);
  T.ok("bridge: try 'swap' triggers", done("swapping"));
  T.check("hard: α from the two nulls", s.ec && s.ec.a, 2, 1e-9);
  T.check("hard: β from the two nulls", s.ec && s.ec.b, 1, 1e-9);

  B.apply({ mode: "meter", Rb: 5, X: 6, l: 20, al: 0, be: 0, swapped: false, mystery: false });
  B.setMystery(true); s = B.state();
  T.ok("mystery X hidden in the label", T.text(".readouts").indexOf("find it") !== -1);
  B.set("l", Math.round(s.l0 * 10) / 10); s = B.state();
  T.ok("bridge: try 'mystery' triggers", done("mystery"), JSON.stringify(s));
  T.check("bridge: all 4 tries", triesDone(), 4, 0);

  /* ---------- rc ---------- */
  t = T.mount("rc"); var R = window.__lab_rc;
  function q(E, Rk, Cu, tt) { return Cu * 1e-6 * E * (1 - Math.exp(-tt / (Rk * Cu * 1e-3))); }
  // practice easy: τ = 1 s, q(τ) = 632 μC
  R.apply({ E: 10, R: 10, C: 100 }); T.steps(t.sim, 60); s = R.state();
  T.check("easy: τ = RC = 1 s", s.tau, 1, 1e-12);
  T.check("easy: q(1 s) = CE(1 − 1/e)", s.q, q(10, 10, 100, 1), 1e-12);
  T.check("easy: q(1 s) in μC", s.q * 1e6, 632.1, 0.05);
  T.check("easy: I(1 s) = (E/R)/e", s.I, 1e-3 * Math.exp(-1), 1e-12);
  R.render(); T.ok("rc: readout shows 632.1 μC", T.text(".readouts").indexOf("632.1 μC") !== -1, T.text(".readouts"));
  T.steps(t.sim, 600); s = R.state();
  T.ok("rc: try 'full' triggers", done("fully"));
  var qf = q(10, 10, 100, 11); T.check("full charge (11τ): U = q²/2C", s.U, qf * qf / 2e-4, 1e-12); T.check("full charge: U ≈ ½CE² = 5 mJ", s.U * 1e3, 5, 0.001);
  T.check("full charge: heat = ½CE²", s.H, 5e-3, 2e-7);
  T.check("full charge: battery work = E q", s.W, 10 * qf, 1e-12); T.check("heat = W − U", s.H, 10 * qf - qf * qf / 2e-4, 1e-12);
  T.ok("rc: auto-paused when settled", s.done);
  // discharge: half the charge goes in τ ln 2
  var q0 = s.q; R.flip("discharge"); t.sim.pause();
  T.steps(t.sim, 41); var sa = R.state(); T.steps(t.sim, 1); var sb = R.state();
  T.ok("discharge halves between 41 and 42 steps (τ ln2 = 41.6 steps)", sa.q > q0 / 2 && sb.q <= q0 / 2, [sa.q, sb.q, q0]);
  T.check("discharge: q = q0 e^(−t/τ)", sb.q, q0 * Math.exp(-42 / 60), 1e-12);
  T.ok("rc: try 'half' triggers", done("half the charge"));
  // flip mid-charge
  R.apply({ E: 10, R: 10, C: 100 }); T.steps(t.sim, 30); var qm = R.state().q; R.flip("discharge"); t.sim.pause();
  s = R.state();
  T.check("flip: current reverses to −V_C/R", s.I, -qm / 100e-6 / 10e3, 1e-12);
  T.ok("rc: try 'flip' triggers", done("halfway"));
  // energy with a 4× bigger R
  R.apply({ E: 10, R: 40, C: 100 }); T.steps(t.sim, 60 * 22); s = R.state();
  T.check("R = 40 kΩ: heat still ½CE²", s.H, 5e-3, 2e-7);
  T.ok("rc: try 'energy' triggers", done("doesn't depend"));
  T.check("rc: all 4 tries", triesDone(), 4, 0);
  // practice medium: heat 14.4 mJ
  R.apply({ E: 12, R: 20, C: 200 }); T.steps(t.sim, 60 * 40); s = R.state();
  T.check("medium: heat = ½CE² = 14.4 mJ", s.H * 1e3, 14.4, 0.005);
  // practice hard: U = ¼U_max at t = τ ln 2 = 1.386 s (between steps 83 and 84)
  R.apply({ E: 10, R: 20, C: 100 }); T.steps(t.sim, 83); sa = R.state(); T.steps(t.sim, 1); sb = R.state();
  var Umax = 0.5 * 100e-6 * 100;
  T.ok("hard: U crosses Umax/4 between 1.383 s and 1.400 s", sa.U < Umax / 4 && sb.U >= Umax / 4, [sa.U, sb.U, Umax / 4]);
  T.check("hard: τ ln 2", 2 * Math.LN2, 1.386, 0.001);
  T.check("hard: q(84 steps) exact", sb.q, q(10, 20, 100, 84 / 60), 1e-12);
});
