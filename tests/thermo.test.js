// Thermodynamics: the gas processes and the heat-engine labs against the textbook formulas.
T.run(function () {
  var R = 8.314;
  ["processes", "engines"].forEach(function (id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) { /* ignore */ } });
  function doneTries() { return [].slice.call(document.querySelectorAll("#app .try.done")).length; }

  /* ---------- lab 1: processes ---------- */
  var t = T.mount("processes"), L = window.__lab_processes;
  T.ok("processes mounts with its hook", !!L && !!t.sim);
  T.ok("processes has 3 practice questions", document.querySelectorAll("#app .qcard").length === 3);
  T.ok("processes has 3-4 equations", document.querySelectorAll("#app .eq").length >= 3);
  function run(setup, n) { L.apply(setup); T.steps(t.sim, n || 200); return L.state(); }

  // easy: isochoric, Q = 3/2 V dP
  T.click(/^Set it up in the lab/);            // the easy question's own button
  T.click(/^Run process/); t.sim.pause(); T.steps(t.sim, 200);
  var s = L.state();
  T.check("easy: isochoric Q = 1500 J", s.g.Q, 1500, 0.5);
  T.check("easy: isochoric W = 0", s.g.W, 0, 1e-9);
  T.check("easy: ΔU = nCvΔT = Q", 1 * 1.5 * R * (s.g.T - s.T1), 1500, 0.5);
  T.check("easy: final P", s.g.P, 150, 1e-9);

  // medium: isobaric diatomic
  s = run({ proc: "isobaric", gas: "di", n: 1, P1: 100, V1: 20, V2: 30 });
  T.check("medium: isobaric W = PΔV = 1000 J", s.g.W, 1000, 0.5);
  T.check("medium: isobaric Q = 7/2 PΔV = 3500 J", s.g.Q, 3500, 0.5);
  T.check("medium: ΔU = 2500 J", 2.5 * R * (s.g.T - s.T1), 2500, 0.5);
  var text = T.text(".readouts");
  T.ok("medium: readout shows Q = 3500 J", /3500 J/.test(text), text.slice(0, 120));

  // hard: adiabatic compression 32 L -> 4 L, monatomic
  s = run({ proc: "adiabatic", gas: "mono", n: 1, P1: 100, V1: 32, V2: 4 });
  T.check("hard: adiabatic P2 = 3200 kPa", s.g.P, 3200, 0.05);
  T.check("hard: W by gas = -14400 J", s.g.W, -14400, 0.5);
  T.check("hard: Q = 0", s.g.Q, 0, 1e-9);
  T.check("hard: ΔU = nCvΔT = -W = 14400 J", 1.5 * R * (s.g.T - s.T1), 14400, 0.5);
  T.check("hard: T2/T1 = 8^(2/3) = 4", s.g.T / s.T1, 4, 1e-4);
  T.check("hard: PV^γ conserved", s.g.P * Math.pow(s.g.V, 5 / 3), 100 * Math.pow(32, 5 / 3), 1);

  // isothermal expansion 25 -> 40 L: W = P1V1 ln 1.6 (also the "iso" try)
  s = run({ proc: "isothermal", gas: "mono", n: 1, P1: 100, V1: 25, V2: 40 });
  T.check("isothermal W = nRT ln(V2/V1)", s.g.W, 2500 * Math.log(1.6), 0.5);
  T.check("isothermal Q = W", s.g.Q, s.g.W, 0.5);
  T.check("isothermal ΔU = 0", s.g.T - s.T1, 0, 1e-9);
  // drag back to V1: reversible path, work returns to zero
  L.move(30); L.move(25);
  T.check("isothermal drag back: W returns to 0", L.state().g.W, 0, 0.05);

  // heat button at constant volume
  L.apply({ proc: "isochoric", gas: "di", n: 2, P1: 100, V1: 25, P2: 200 });
  L.heat(100);
  T.check("heat +100 J at constant V: Q = 100 J", L.state().g.Q, 100, 1e-6);
  T.check("…and ΔU = 100 J, W = 0", 2 * 2.5 * R * (L.state().g.T - L.state().T1), 100, 1e-6);
  // Cp - Cv = R via the cpcv try: isochoric then isobaric heating, same n and gas
  run({ proc: "isochoric", gas: "mono", n: 1, P1: 100, V1: 25, P2: 200 });
  s = run({ proc: "isobaric", gas: "mono", n: 1, P1: 100, V1: 25, V2: 40 });
  T.check("isobaric Q/(nΔT) = Cp = 5R/2", s.g.Q / (s.g.T - s.T1), 2.5 * R, 1e-6);
  // double: adiabatic 30 -> 10 L monatomic: T x 3^(2/3) = 2.08
  run({ proc: "adiabatic", gas: "mono", n: 1, P1: 100, V1: 30, V2: 10 });
  // allneg: isobaric compression
  s = run({ proc: "isobaric", gas: "mono", n: 1, P1: 100, V1: 40, V2: 20 });
  T.ok("isobaric compression: Q, W, ΔU all < 0", s.g.Q < 0 && s.g.W < 0 && s.g.T < s.T1, [s.g.Q, s.g.W].join(","));
  T.check("processes: all 4 tries triggered", doneTries(), 4, 0);

  /* ---------- lab 2: engines ---------- */
  t = T.mount("engines");
  var E = window.__lab_engines;
  T.ok("engines mounts with its hook", !!E && !!t.sim);
  T.ok("engines has 3 practice questions", document.querySelectorAll("#app .qcard").length === 3);
  function lap(setup) { E.apply(setup); T.steps(t.sim, 360); return { r: E.state().last, c: E.cyc() }; }

  // easy: rectangle W = ΔP ΔV
  T.click(/^Set it up in the lab/);
  T.click(/^Play/); t.sim.pause();
  T.steps(t.sim, 135);
  var mid = E.exactAt(E.state().t);
  T.check("rectangle mid-lap: sim W matches formula", E.state().g.W, mid.W, 0.5);
  T.check("rectangle mid-lap: sim Q_in matches formula", E.state().g.Qin, mid.Qin, 0.5);
  T.steps(t.sim, 225);
  var r = E.state().last;
  T.check("easy: rectangle W = 2000 J", r.W, 2000, 0.5);
  T.check("easy: rectangle Q_in = 1.5 VaΔP + 2.5 PhΔV = 10500 J", r.Qin, 10500, 0.5);
  T.check("easy: W = Q_in - Q_out", r.Qin - r.Qout, r.W, 0.5);
  T.check("easy: η = 2000/10500", r.eta, 2000 / 10500, 5e-4);

  // medium: Carnot refrigerator 300 K / 250 K
  var o = lap({ cyc: "carnot", dir: "fridge", gas: "mono", n: 1, Th: 300, Tc: 250, V1: 10, ratio: 2 });
  T.check("medium: Carnot COP = Tc/(Th-Tc) = 5", o.r.cop, 5, 0.005);
  T.check("medium: heat from cold = nRTc ln 2", o.r.Qin, R * 250 * Math.log(2), 0.5);
  T.ok("medium: W < 0 for a refrigerator", o.r.W < 0, o.r.W);

  // hard: Otto, diatomic, r = 8, Q = 4000 J
  o = lap({ cyc: "otto", dir: "engine", gas: "di", n: 1, T1: 300, V1: 24, r: 8, Q: 4000 });
  T.check("hard: Otto T2 = 300·8^0.4 = 689.2 K", o.c.c[1].T, 300 * Math.pow(8, 0.4), 0.05);
  T.check("hard: Otto W = 2259 J", o.r.W, 4000 * (1 - Math.pow(8, -0.4)), 0.5);
  T.check("hard: Otto sim Q_in = 4000 J", o.r.Qin, 4000, 0.5);
  T.check("hard: Otto η = 1 - 1/r^(γ-1)", o.r.eta, 1 - Math.pow(8, -0.4), 5e-4);
  T.ok("hard: Otto below Carnot limit", o.r.eta < o.c.etaC, o.c.etaC);
  o = lap({ cyc: "otto", dir: "engine", gas: "di", n: 1, T1: 300, V1: 24, r: 8, Q: 2500 });   // the "otto" try
  T.check("Otto η independent of Q_in", o.r.eta, 1 - Math.pow(8, -0.4), 5e-4);

  // Carnot engine 500/300 and the 50% try
  o = lap({ cyc: "carnot", dir: "engine", gas: "di", n: 1, Th: 500, Tc: 300, V1: 10, ratio: 2 });
  T.check("Carnot η = 1 - Tc/Th = 0.4", o.r.eta, 0.4, 5e-4);
  T.check("Carnot Q_in = nRTh ln 2", o.r.Qin, R * 500 * Math.log(2), 0.5);
  T.check("Carnot Q_out/Q_in = Tc/Th", o.r.Qout / o.r.Qin, 0.6, 5e-4);
  T.check("Carnot: back at the start state", E.state().g.T, 500, 1e-9);
  o = lap({ cyc: "carnot", dir: "engine", gas: "mono", n: 1, Th: 600, Tc: 300, V1: 10, ratio: 2 });
  T.check("Carnot 600/300 η = 0.5", o.r.eta, 0.5, 5e-4);
  o = lap({ cyc: "rect", dir: "engine", gas: "mono", n: 1, Va: 10, Vb: 20, Pl: 100, Ph: 200 });
  T.check("rectangle 100 kPa × 10 L = 1000 J", o.r.W, 1000, 0.5);
  // reversed rectangle: COP = heat absorbed / |W|
  o = lap({ cyc: "rect", dir: "fridge", gas: "mono", n: 1, Va: 10, Vb: 20, Pl: 100, Ph: 200 });
  T.check("reversed rectangle W = -1000 J", o.r.W, -1000, 0.5);
  T.check("reversed rectangle COP = (2.5·Pl·ΔV + 1.5·Vb·ΔP)/|W|", o.r.cop, (2.5 * 100 * 10 + 1.5 * 20 * 100) / 1000, 0.005);
  T.check("engines: all 4 tries triggered", doneTries(), 4, 0);
  T.ok("readouts render", (T.text(".readouts") || "").length > 40);
});
