// EMI & AC: the sliding rod, the magnet and coil, and the series LCR / RL circuits against their textbook formulas.
T.run(function () {
  ["faraday", "lcr"].forEach(function (id) { localStorage.removeItem("kinetic:tries:" + id); });
  var t = T.mount("faraday"), L = window.__lab_faraday, sim = t.sim;
  T.ok("faraday mounts", !!L && !!sim);
  function rodRun(n) { T.click(/^Kick/); sim.pause(); T.steps(sim, n); return L.rod(); }

  // easy practice: B 0.4, l 0.5, v 5 held steady by F = B²l²v/R = 0.2 N -> emf 1.0 V
  L.apply({ mode: "rod", B: 0.4, l: 0.5, R: 1, m: 0.5, v0: 5, F: 0.2 });
  var r = rodRun(120);
  T.check("easy: speed stays 5 m/s", r.v, 5, 1e-6);
  T.check("easy: emf Blv = 1.0 V", 0.4 * 0.5 * r.v, 1.0, 1e-6);
  T.check("easy: current 1.0 A", r.I, 1.0, 1e-6);
  T.ok("easy: maths shows 1.00 V", /1\.00/.test(T.text(".eqs")), T.text(".eqs").slice(0, 80));

  // kick with no push: v = v0 e^(-t/τ), τ = mR/B²l² = 0.5*2/1 = 1 s; heat = KE lost
  L.apply({ mode: "rod", B: 1, l: 1, R: 2, m: 0.5, v0: 4, F: 0 });
  r = rodRun(60);
  T.check("kick: v(1 s) = 4/e", r.v, 4 * Math.exp(-1), 1e-6);
  T.check("kick: heat = KE lost", r.heat, 0.5 * 0.5 * (16 - r.v * r.v), 1e-6);
  T.check("kick: distance v0τ(1 - 1/e)", r.x - 2, 4 * (1 - Math.exp(-1)), 1e-6);
  T.steps(sim, 120);
  T.ok("try brake marked", document.querySelectorAll(".tries li.done").length >= 1);

  // terminal velocity: F 2 N, B 1, l 1, R 2 -> v_t = FR/B²l² = 4 m/s; from v0 = 0
  L.apply({ mode: "rod", B: 1, l: 1, R: 2, m: 0.5, v0: 0, F: 2 });
  r = rodRun(120);
  T.check("terminal: v(2 s) = 4(1 - e^-2)", r.v, 4 * (1 - Math.exp(-2)), 1e-6);
  T.check("terminal: heat = work - KE", r.heat, r.work - 0.5 * 0.5 * r.v * r.v, 1e-6);
  T.steps(sim, 300);
  T.check("terminal: reaches FR/B²l²", r.v, 4, 0.01);

  // hard practice: d = m v0 R/B²l² = 2.4 m, Q = Bl d/R = 2.4 C
  L.apply({ mode: "rod", B: 1, l: 0.5, R: 0.5, m: 0.2, v0: 6, F: 0 });
  r = rodRun(600);
  T.ok("hard: run stops by itself", r.done && !sim.running);
  T.check("hard: distance 2.4 m", r.x - 2, 2.4, 0.005);
  T.check("hard: charge 2.4 C", r.q, 2.4, 0.005);
  T.ok("hard: readout shows 2.40 m", /2\.40 m/.test(T.text(".readouts")), T.text(".readouts"));

  // clockwise try: kick towards the resistor
  L.apply({ mode: "rod", B: 1, l: 1, R: 2, m: 0.5, v0: -4, F: 0 });
  rodRun(10);

  // coil: emf = 3NΦmax x v / a²(1 + x²/a²)^(5/2), at a mid-pass step
  L.apply({ mode: "coil", N: 200, phi: 2.5, R: 10, u: 0.2, pol: 1, end: "through" });
  T.click(/^Push magnet/); sim.pause();
  T.steps(sim, 100);
  var c = L.coil(), a = 0.1, xm = c.x - 0.5 * c.v / 60;   // midpoint of the last step
  var want = 3 * 200 * 2.5e-3 * xm * 0.2 / (a * a) / Math.pow(1 + xm * xm / (a * a), 2.5);
  T.check("coil: -NΔΦ/Δt matches formula", c.emf, want, Math.abs(want) * 0.002 + 1e-4);
  T.ok("coil: approaching emf negative", c.x < 0 && c.emf < 0, c.x + " " + c.emf);
  T.steps(sim, 600);
  c = L.coil();
  T.ok("coil: pass finished", c.done && Math.abs(c.x - Math.sqrt(24) * a) < 1e-9);
  T.ok("coil: emf flipped sign", c.max > 0.3 && c.min < -0.3, c.max + " " + c.min);
  T.check("coil: peak emf 0.8587 NΦmax u/a", c.max, 0.8587 * 200 * 2.5e-3 * 0.2 / a, 0.005);
  T.check("coil: net charge for a full pass ~0", c.Q, 0, 1e-9);

  // medium practice: Q = NΔΦ/R = 200 * 2.48e-3 / 10 = 49.6 mC, at two speeds
  [0.2, 0.05].forEach(function (u) {
    L.apply({ mode: "coil", N: 200, phi: 2.5, R: 10, u: u, pol: 1, end: "centre" });
    T.check("coil: start flux 0.02 mWb", L.coil().phi0 * 1e3, 0.02, 1e-9);
    T.click(/^Push magnet/); sim.pause();
    T.steps(sim, 2000);
    T.check("medium: Q = 49.6 mC at u = " + u, Math.abs(L.coil().Q) * 1e3, 49.6, 0.05);
  });
  T.ok("medium: readout 49.6 mC", /49\.6 mC/.test(T.text(".readouts")), T.text(".readouts"));
  T.check("faraday: all 4 tries", document.querySelectorAll(".tries li.done").length, 4, 0);

  if (!K.labs.some(function (l) { return l.id === "lcr"; })) return;
  lcrTests();
});

function lcrTests() {
  var t = T.mount("lcr"), L = window.__lab_lcr, sim = t.sim;
  T.ok("lcr mounts", !!L && !!sim);
  function period(n) { T.click(/^Switch on/); sim.pause(); T.steps(sim, n || 240); return L.ac(); }
  function Zof(R, Lh, C, w) { return Math.sqrt(R * R + Math.pow(w * Lh - 1 / (w * C), 2)); }

  // easy: ω0 = 1/√LC = 1000 rad/s with 100 mH, 10 µF: current peaks there
  L.apply({ mode: "ac", V: 10, R: 10, L: 100, C: 10, w: 1000 });
  var s = period();
  T.check("easy: resonance Irms = V/R = 1 A", s.meas.Irms, 1, 0.002);
  T.check("easy: ω0", 1 / Math.sqrt(0.1 * 1e-5), 1000, 1e-6);
  T.ok("easy: maths shows ω0 = 1000", /1000/.test(T.text(".eqs")), T.text(".eqs").slice(0, 200));
  var Ipeak = s.meas.Irms;
  [900, 1100].forEach(function (w) {
    L.apply({ mode: "ac", V: 10, R: 10, L: 100, C: 10, w: w });
    var m = period().meas.Irms;
    T.check("off resonance Irms at ω=" + w, m, 10 / Zof(10, 0.1, 1e-5, w), 0.002);
    T.ok("smaller than at resonance (" + w + ")", m < Ipeak);
  });

  // medium: R 30, X_L 80, X_C 40 -> Z 50, I 0.2 A, cosφ 0.6, P 1.2 W
  L.apply({ mode: "ac", V: 10, R: 30, L: 80, C: 25, w: 1000 });
  s = period();
  T.check("medium: Irms 0.2 A", s.meas.Irms, 0.2, 0.0005);
  T.check("medium: P = 1.2 W (measured ∫vi dt)", s.meas.P, 1.2, 0.003);
  T.check("medium: phase 53.13°", s.phi * 180 / Math.PI, 53.13, 0.01);
  T.ok("medium: readout 1.20 W", /1\.20 W/.test(T.text(".readouts")), T.text(".readouts"));

  // hard: V_L = Q V = 120 V, V_LC = 0 at resonance
  L.apply({ mode: "ac", V: 12, R: 20, L: 200, C: 5, w: 1000 });
  s = period();
  T.check("hard: I = 0.6 A", s.meas.Irms, 0.6, 0.002);
  T.check("hard: V_L = 120 V (measured)", s.meas.VL, 120, 0.3);
  T.check("hard: V_C = 120 V (measured)", s.meas.VC, 120, 0.3);
  T.check("hard: V_LC = 0", s.meas.VLC, 0, 0.3);
  T.ok("hard: readout 120 V", /120\.0 V/.test(T.text(".readouts")), T.text(".readouts"));

  // capacitive: current leads
  L.apply({ mode: "ac", V: 10, R: 10, L: 100, C: 10, w: 500 });
  s = period();
  T.check("lead: Irms at ω=500", s.meas.Irms, 10 / Zof(10, 0.1, 1e-5, 500), 0.002);

  // RL: i(τ) = (E/R)(1 - 1/e); open after 99%: decays as e^(-t/τ)
  L.apply({ mode: "rl", E: 10, R: 10, L: 100 });
  T.click(/^Close switch/); sim.pause();
  T.steps(sim, 40);                         // τ = 40 steps
  var r = L.rl();
  T.check("RL: i(τ) = 0.632 E/R", r.i, 1 - Math.exp(-1), 1e-9);
  T.check("RL: circuit time τ = L/R = 10 ms", r.tc * 1e3, 10, 1e-9);
  T.steps(sim, 200);
  L.flip(); sim.pause();
  T.steps(sim, 40);
  r = L.rl();
  T.check("RL decay: i(τ) = i0/e", r.i, (1 - Math.exp(-6)) * Math.exp(-1), 1e-9);
  T.check("lcr: all 4 tries", document.querySelectorAll(".tries li.done").length, 4, 0);
}
