// Thermal properties: expansion, calorimetry and conduction against their textbook formulas.
T.run(function () {
  function done(lab, id) { return JSON.parse(localStorage.getItem("kinetic:tries:" + lab) || "{}")[id] === true; }
  ["expansion", "calorimetry", "conduction"].forEach(function (id) { localStorage.removeItem("kinetic:tries:" + id); });

  /* ---------- expansion ---------- */
  var t = T.mount("expansion"), X = window.__lab_expansion;
  T.ok("expansion mounts", !!X && T.text(".readouts").length > 20, T.text(".readouts"));
  function heat(setup) { X.apply(setup); T.click(/^(Heat|Cool)/); t.sim.pause(); T.steps(t.sim, 300); return X.state(); }
  var s = heat({ mode: "rods", A: "copper", B: "steel", LA: 2, LB: 1, T0: 20, T1: 120 });
  T.ok("expansion run finishes at T", s.done && s.T === 120, s);
  T.check("easy: copper 2 m, ΔT 100: ΔL (mm)", s.dLA * 1000, 3.4, 0.0005);
  T.check("steel 1 m, ΔT 100: ΔL (mm)", s.dLB * 1000, 1.2, 0.0005);
  s = heat({ mode: "area", A: "brass", LA: 0.5, T0: 20, T1: 120 });
  T.check("medium: brass ΔA/A ×10⁻³ (2αΔT = 3.80)", s.fA * 1000, 3.8, 0.005);
  T.check("brass ΔV/V ×10⁻³ = (1+αΔT)³ − 1", s.fV * 1000, (Math.pow(1.0019, 3) - 1) * 1000, 0.0005);
  T.check("brass ΔV/V ≈ 3αΔT (to 1%)", s.fV * 1000, 5.7, 0.06);
  T.check("β/α ≈ 2", s.fA / s.fL, 2, 0.005);
  s = heat({ mode: "clamp", A: "steel", LA: 1, T0: 20, T1: 120, area: 2, gap: 0.3 });
  T.check("hard: stress with 0.3 mm gap (MPa)", s.sigma / 1e6, 180, 0.01);
  s = heat({ mode: "clamp", A: "steel", LA: 1, T0: 20, T1: 70, area: 2, gap: 0 });
  T.check("clamped steel, ΔT 50, A 2 cm²: F (kN) = YAαΔT", s.F / 1000, 24, 0.01);
  T.check("clamped steel σ = YαΔT (MPa)", s.sigma / 1e6, 120, 0.01);
  s = heat({ mode: "clamp", A: "steel", LA: 2, T0: 20, T1: 70, area: 2, gap: 0 });
  T.ok("try: stress independent of length", done("expansion", "stress"), s.sigma);
  s = heat({ mode: "bimetal", A: "brass", B: "invar", l: 20, d: 0.5, T0: 20, T1: 220 });
  T.check("bimetal R = d/(Δα ΔT) (m)", s.R, 0.5e-3 / (1.8e-5 * 200), 0.0005);
  var Rf = 0.5e-3 / (1.8e-5 * 200);
  T.check("bimetal tip = R(1 − cos ℓ/R) (mm)", s.tip * 1000, 1000 * Rf * (1 - Math.cos(0.2 / Rf)), 0.05);
  s = heat({ mode: "bimetal", A: "brass", B: "invar", l: 20, d: 0.5, T0: 20, T1: -20 });
  T.ok("bimetal bends the other way when cooled", s.R < 0, s.R);
  T.ok("try: cool the strip", done("expansion", "cool"));
  heat({ mode: "rods", A: "copper", B: "steel", LA: 1.2, LB: 1.7, T0: 20, T1: 120 });
  T.ok("try: equal ΔL keeps the gap", done("expansion", "equal"));
  heat({ mode: "area", A: "alu", LA: 1, T0: 20, T1: 150 });
  T.ok("try: area and volume", done("expansion", "area"));
  // dragging the thermometer moves the temperature
  X.apply({ mode: "rods", A: "alu", B: "steel", LA: 1, LB: 1, T0: 20, T1: 220 });
  X.setT(120);
  T.check("thermometer scrub: Al 1 m to 120 °C ΔL (mm)", X.state().dLA * 1000, 2.3, 0.0005);

  /* ---------- calorimetry ---------- */
  t = T.mount("calorimetry"); var C = window.__lab_calorimetry;
  T.ok("calorimetry mounts", !!C && T.text(".readouts").length > 20, T.text(".readouts"));
  function settle(setup, max) {
    C.apply(setup); T.click(/^(Drop|Heat)/); t.sim.pause();
    for (var i = 0; i < (max || 6000) && !C.state().done; i++) t.sim.stepOnce();
    return C.state();
  }
  var c = settle({ mode: "mix", item: "water", mw: 300, Tw: 20, mc: 0, mi: 200, Ti: 80 });
  T.ok("mix settles", c.done, c.t);
  T.check("easy: 200 g at 80 into 300 g at 20 → 44 °C", c.TA, 44, 0.005);
  T.check("heat lost = heat gained (J)", c.Q, 0.3 * 4200 * 24, 1);
  c = settle({ mode: "mix", item: "metal", metal: "alu", mw: 500, Tw: 20, mc: 100, mi: 200, Ti: 150 });
  T.check("medium: Al block into water + copper can (°C)", c.TA, (2139 * 20 + 180 * 150) / 2319, 0.005);
  c = settle({ mode: "mix", item: "ice", mw: 200, Tw: 30, mc: 0, mi: 100, Ti: -10 });
  T.check("hard: final T with ice left (°C)", c.TA, 0, 0.005);
  T.check("hard: ice left (g)", c.ice * 1000, 31.25, 0.05);
  T.ok("try: ice left at 0 °C", done("calorimetry", "ice0"));
  c = settle({ mode: "mix", item: "ice", mw: 500, Tw: 60, mc: 100, mi: 50, Ti: -20 });
  T.check("all ice melts: T_f (°C)", c.TA, (500 * 4.2 * 60 + 39 * 60 - 50 * 2.1 * 20 - 50 * 336) / (0.5 * 4200 + 39 + 0.05 * 4200) , 0.005);
  c = settle({ mode: "mix", item: "ice", mw: 50, Tw: 5, mc: 0, mi: 1000, Ti: -40 });
  T.check("water freezes solid: T_f (°C)", c.TA, (1050 + 16800 - 84000) / 2205, 0.005);
  c = settle({ mode: "mix", item: "metal", metal: "alu", mw: 100, Tw: 20, mc: 0, mi: 1000, Ti: 300 });
  T.check("hot block boils water: T_f (°C)", c.TA, 100, 0.005);
  T.check("steam made (g)", c.steam * 1000, (420 * (20 - 100) + 900 * 200) / 2268, 0.05);
  c = settle({ mode: "mix", item: "water", mw: 200, Tw: 20, mc: 0, mi: 200, Ti: 60 });
  T.ok("try: equal masses land halfway", done("calorimetry", "half"), c.TA);
  c = settle({ mode: "heat", m: 20, T0: -20, P: 1000 });
  T.ok("heating run reaches steam at 130 °C", c.done && c.T >= 130, c.T);
  T.check("melting plateau mL_f/P (s)", c.marks.meltEnd - c.marks.meltStart, 0.02 * 336000 / 1000, 0.005);
  T.check("boiling plateau mL_v/P (s)", c.marks.boilEnd - c.marks.boilStart, 0.02 * 2268000 / 1000, 0.005);
  T.check("ice warms to 0 in m c_i ΔT / P (s)", c.marks.meltStart, 0.02 * 2100 * 20 / 1000, 0.005);
  T.ok("try: melt", done("calorimetry", "melt")); T.ok("try: boil dry", done("calorimetry", "boil"));
  c = settle({ mode: "heat", m: 50, T0: 40, P: 500 });
  T.check("water start: reaches 100 °C at m c_w ΔT/P (s)", c.marks.boilStart, 0.05 * 4200 * 60 / 500, 0.005);

  /* ---------- conduction, radiation, cooling ---------- */
  t = T.mount("conduction"); var D = window.__lab_conduction;
  T.ok("conduction mounts", !!D && T.text(".readouts").length > 20, T.text(".readouts"));
  function run(setup, max) {
    D.apply(setup); T.click(/^(Heat it|Let it cool|Start the clock)/); t.sim.pause();
    for (var i = 0; i < (max || 20000) && !D.state().done; i++) t.sim.stepOnce();
    return D.state();
  }
  var d = run({ mode: "series", m1: "copper", m2: "steel", L1: 10, L2: 10, A: 10, TH: 100, TC: 0 });
  T.ok("series reaches steady state", d.steady, d.t);
  T.check("medium: junction temperature (°C)", d.Tj, 100 - 100 / 9, 0.005);
  T.check("series H = ΔT/(R1+R2) (W)", d.out, 100 / (0.25 + 2), 0.005);
  T.check("series H in = H out at steady state", d.in, d.out, 0.001);
  D.probe(0.15); T.check("probe in the steel half: linear profile (°C)", D.state().probe, (100 - 100 / 9) * 0.5, 0.01);
  d = run({ mode: "series", m1: "alu", m2: "glass", L1: 5, L2: 2, A: 4, TH: 150, TC: 20 });
  var R1 = 0.05 / (200 * 4e-4), R2 = 0.02 / (1 * 4e-4);
  T.check("Al + glass series H (W)", d.out, 130 / (R1 + R2), 0.0005);
  T.check("Al + glass junction (°C)", d.Tj, 150 - 130 / (R1 + R2) * R1, 0.01);
  d = run({ mode: "parallel", m1: "copper", m2: "steel", L1: 10, A: 10, TH: 100, TC: 0 });
  T.check("parallel H = ΔT(1/R1 + 1/R2) (W)", d.out, 100 * (4 + 0.5), 0.05);
  T.check("parallel bar 2 current (W)", d.I[1], 50, 0.01);
  run({ mode: "series", m1: "copper", m2: "brass", L1: 16, L2: 4, A: 10, TH: 100, TC: 0 });
  T.ok("try: junction halfway", done("conduction", "mid"));
  var ds = run({ mode: "series", m1: "brass", m2: "brass", L1: 10, L2: 10, A: 5, TH: 100, TC: 0 });
  var dp = run({ mode: "parallel", m1: "brass", m2: "brass", L1: 10, A: 5, TH: 100, TC: 0 });
  T.check("parallel / series identical bars = 4", dp.out / ds.out, 4, 0.001);
  T.ok("try: four times the current", done("conduction", "four"));
  // radiation
  D.apply({ mode: "rad", Tr: 1000, Ts: 0, e: 1, r: 2 });
  T.check("easy: P at 1000 K, r = 2 cm (W)", D.state().P, 5.67e-8 * 4 * Math.PI * 4e-4 * 1e12, 0.1);
  T.click(/^Let it cool/); t.sim.pause(); T.steps(t.sim, 120);
  var r = D.state(), want = Math.pow(1e-9 + 3 * 5.67e-8 * r.Ab * r.t / r.Cb, -1 / 3);
  T.check("radiative cooling into 0 K: T(t) = (Ti⁻³ + 3σAt/mc)^(-1/3) (K)", r.T, want, 0.05);
  D.apply({ mode: "rad", Tr: 2000, Ts: 0, e: 1, r: 2 });
  T.check("P at 2000 K is 16× (W)", D.state().P / (5.67e-8 * 4 * Math.PI * 4e-4 * 1e12), 16, 1e-6);
  T.click(/^Let it cool/); t.sim.pause(); T.steps(t.sim, 2);
  T.ok("try: double T, 16× power", done("conduction", "sixteen"));
  T.check("Wien: spectrum peak × T (µm·K) at 1500 K", D.peakOf(1500) * 1500, 2897.8, 0.2);
  T.check("Wien: spectrum peak at 3000 K (µm)", D.peakOf(3000), 2.8978 / 3, 0.0005);
  // Newton's law of cooling
  var n = run({ mode: "cool", Ti: 80, T0: 20, T1: 60, t1: 5, T2: 40 }, 8000);
  T.check("cooling reaches T1 at t1 (min)", n.marks.T1, 5, 0.002);
  T.check("hard: 60 → 40 °C exactly (min)", n.marks.T2 - n.marks.T1, 5 * Math.LN2 / Math.log(1.5), 0.002);
  T.check("excess halves at ln2/k (min)", n.marks.half, Math.LN2 / n.k, 0.002);
  T.ok("try: half the excess", done("conduction", "half"));
});
