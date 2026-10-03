// Electrostatics: Coulomb's law & superposition, field/potential/Gauss, capacitors.
T.run(function () {
  try { localStorage.clear(); } catch (e) { /* private mode */ }
  function done(id) { var li = [].slice.call(document.querySelectorAll(".tries li")); var lab = K.labs.filter(function (l) { return l.id === T.__cur; })[0]; var i = lab.tries.map(function (x) { return x.id; }).indexOf(id); return li[i] && li[i].classList.contains("done"); }
  function stepUntil(sim, cond, max) { for (var i = 0; i < (max || 6000) && !cond(); i++) sim.stepOnce(); return cond(); }

  /* ---------- coulomb ---------- */
  T.__cur = "coulomb";
  var t = T.mount("coulomb"), L = window.__lab_coulomb;
  T.ok("coulomb mounts with readouts", (T.text(".readouts") || "").length > 20);
  T.ok("coulomb has 3 graphs, 4 eqs, 3 questions", document.querySelectorAll(".graph canvas").length === 3 && document.querySelectorAll(".eq").length === 4 && document.querySelectorAll(".qcard").length === 3);
  var lab = t.lab, qs = document.querySelectorAll(".qcard");
  // easy: +5 and -5 μC, 1.5 m apart -> 0.10 N attractive
  qs[0].querySelector(".btn-primary").click();
  var s = L.state();
  T.check("easy: F = k q1 q2 / r² (mN)", s.pair.F, 100, 0.01);
  T.ok("easy: attractive", s.pair.f < 0);
  T.ok("easy: answer option is 0.10 N", /0\.10 N/.test(lab.mount && qs[0].querySelectorAll(".quiz-opts button")[0].textContent));
  // inverse square: drag to double r
  L.load("pair");                                   // +4 at 1.5, -2 at 3.5: r = 2
  var F1 = L.state().pair.F;
  T.check("pair F (4, -2 μC at 2 m) = 9·8/4 mN", F1, 18, 1e-9);
  L.move(0, 2.5, 1.6);                              // r = 1
  var F2 = L.state().pair.F;
  T.check("r halves -> F x4", F2 / F1, 4, 1e-9);
  T.ok("try 'inverse' triggered", done("inverse"));
  // medium: balance point 2 m from the +4 μC charge
  qs[1].querySelector(".btn-primary").click();
  s = L.state();
  T.check("medium: null point formula x = d/(1+√(q2/q1)) -> 3.00 m", s.nullPoint.x, 3, 1e-9);
  T.check("medium: numeric balance on the wire", s.eq.x, 3, 1e-6);
  L.move(2, 3, 1.6);
  T.check("medium: net force at x = 3 m", L.state().net.mag, 0, 1e-9);
  T.ok("try 'null' triggered", done("null"));
  // outside: +4 and -1, 1.5 m apart -> 1.5 m beyond the -1
  L.load("outside");
  s = L.state();
  T.check("outside: null point at 4.5 m", s.nullPoint.x, 4.5, 1e-9);
  T.check("outside: numeric balance agrees", s.eq.x, 4.5, 1e-6);
  // hard: oscillation period 3.82 s
  qs[2].querySelector(".btn-primary").click();
  s = L.state();
  T.check("hard: k_eff = 0.027 N/m", s.eq.k, 0.027, 1e-6);
  T.click(/^Release/); t.sim.pause();
  stepUntil(t.sim, function () { var r = L.state().run; return r && r.turns.length >= 5; }, 3000);
  var Tm = L.state().period, Tf = 2 * Math.PI * Math.sqrt(0.01 / 0.027);
  T.check("hard: measured period vs 2π√(m/k) = 3.82 s", Tm, Tf, 0.01);
  T.ok("hard: readout shows 3.82 s", /3\.82 s/.test(T.text(".readouts")), T.text(".readouts"));
  T.ok("try 'stable' triggered", done("stable"));
  // unstable: negative charge at the same balance point
  T.click(/^Reset/);
  L.setQ(2, -1);
  T.ok("negative charge: k_eff < 0", L.state().eq.k < 0);
  T.click(/^Release/); t.sim.pause();
  stepUntil(t.sim, function () { return done("unstable"); }, 3000);
  T.ok("try 'unstable' triggered", done("unstable"));
  // energy check of the released charge: ½mv² = drop in qV along the wire
  T.click(/^Reset/); L.setQ(2, 1); L.move(2, 2.5, 1.6);
  T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 30);
  var c3 = L.charges()[2], V = function (x) { return 9e3 * (4 / Math.abs(x - 1) + 1 / Math.abs(4 - x)); };   // V in V (μC, m)
  T.check("released charge conserves energy", 0.5 * 0.01 * c3.vx * c3.vx, 1e-6 * (V(2.5) - V(c3.x)), 1e-8);

  /* ---------- field lines, potential, Gauss ---------- */
  T.__cur = "fieldlines";
  t = T.mount("fieldlines"); L = window.__lab_fieldlines; qs = document.querySelectorAll(".qcard");
  T.ok("fieldlines mounts, draws lines and equipotentials", L.cache().lines.length > 10 && L.cache().segs.length > 100, L.cache().lines.length + " lines");
  T.ok("fieldlines has 3 graphs, 4 eqs, 3 questions", document.querySelectorAll(".graph canvas").length === 3 && document.querySelectorAll(".eq").length === 4 && qs.length === 3);
  L.loadCharges("single"); L.setProbe(4, 1.6);
  var f = L.field(4, 1.6);
  T.check("point: E = kq/r² (2 μC, 1 m) = 18 kN/C", f.mag, 18, 1e-9);
  T.check("point: V = kq/r = 18 kV", f.V, 18, 1e-9);
  L.setProbe(4.5, 1.6);
  T.check("point: E at 1.5 m = 8 kN/C", L.field(4.5, 1.6).mag, 8, 1e-9);
  // easy: midpoint of two +2 μC charges
  qs[0].querySelector(".btn-primary").click();
  f = L.field(3, 1.6);
  T.check("easy: E = 0 at the midpoint", f.mag, 0, 1e-9);
  T.check("easy: V = 36 kV at the midpoint", f.V, 36, 1e-9);
  T.ok("easy: readout shows 36.0 kV", /36\.0 kV/.test(T.text(".readouts")));
  L.setProbe(3, 1.6);
  T.ok("try 'zeroE' triggered", done("zeroE"));
  // line charge field: E = 2kλ/r
  L.setMode("line"); L.loadCharges("single");
  T.check("line: E = 2kλ/r (2 μC/m, 1 m) = 36 kN/C", L.field(4, 1.6).mag, 36, 1e-9);
  // medium: flux = λ_enc/ε₀ = 4πk(2 μC/m)
  qs[1].querySelector(".btn-primary").click();
  var fl = L.flux();
  T.check("medium: λ_enc = 2 μC/m", fl.lam, 2, 1e-9);
  T.check("medium: measured flux = λ_enc/ε₀ = 226.2 kN·m/C", fl.phi, 72 * Math.PI, 0.05);
  T.ok("medium: answer 226 matches 2e-6/8.84e-12", Math.round(2e-6 / 8.84e-12 / 1e3) === 226 && Math.round(fl.phi) === 226);
  L.moveVertex(0, 0.3, 0.2); L.moveVertex(2, 4.2, 3.2);
  fl = L.flux();
  T.check("medium: reshaped loop, same flux", fl.phi, 72 * Math.PI, 0.05);
  T.ok("reshaped loop is much longer", fl.per > 9.3, fl.per);
  T.ok("try 'shape' triggered", done("shape"));
  // a loop squeezed right next to a charge still gives the exact flux
  L.setLoop([{ x: 1.95, y: 1.75 }, { x: 2.05, y: 1.75 }, { x: 2.05, y: 1.85 }, { x: 1.95, y: 1.85 }]);
  T.check("tiny loop round the +3 rod: 3 × 36π", L.flux().phi, 108 * Math.PI, 0.1);
  // dipole inside: zero net flux though lines cross
  L.loadCharges("dipole");
  L.setLoop([{ x: 1.5, y: 1 }, { x: 4.7, y: 1 }, { x: 4.7, y: 2.2 }, { x: 1.5, y: 2.2 }]);
  fl = L.flux();
  T.check("dipole loop: zero flux", fl.phi, 0, 0.1);
  T.ok("dipole loop: lines do cross it", fl.out > 50, fl.out);
  T.ok("try 'zeroflux' triggered", done("zeroflux"));
  // hard: top speed 6.97 m/s where E = 0
  qs[2].querySelector(".btn-primary").click();
  T.click(/^Release/); t.sim.pause();
  T.steps(t.sim, 90);
  var tt = L.test();
  T.ok("hard: bead turned back before reaching the 1 μC charge", tt.turned && !tt.done);
  T.check("hard: top speed = √(2qΔV/m) = 6.97 m/s", tt.vmax, Math.sqrt(48.6), 0.005);
  T.check("hard: top speed where E = 0 (x = 3 m)", tt.xAtVmax, 3, 0.01);
  T.check("energy conserved: qV + ½mv² drift (mJ)", tt.maxDrift, 0, 1e-4);
  T.ok("try 'energy' triggered", done("energy"));

  /* ---------- capacitors ---------- */
  T.__cur = "capacitors";
  t = T.mount("capacitors"); L = window.__lab_capacitors; qs = document.querySelectorAll(".qcard");
  T.ok("capacitors has 3 graphs, 4 eqs, 3 questions", document.querySelectorAll(".graph canvas").length === 3 && document.querySelectorAll(".eq").length === 4 && qs.length === 3);
  // easy: 100 cm², 2 mm -> 44.25 pF
  qs[0].querySelector(".btn-primary").click();
  var c = L.state();
  T.check("easy: C = ε₀A/d = 44.25 pF", c.C, 44.25, 1e-9);
  T.check("easy: Q = CV = 4.425 nC", c.Q, 4.425, 1e-9);
  T.ok("easy: readout shows 44.25 pF", /44\.25 pF/.test(T.text(".readouts")));
  // connected, double the gap: Q halves, U halves, battery takes back V0ΔQ, you do +½V0|ΔQ|
  L.set({ d: 4 }); c = L.state();
  T.check("connected, d doubled: Q halves", c.Q, 2.2125, 1e-9);
  T.check("connected, d doubled: U = ½CV² halves", c.U, 110.625, 1e-9);
  T.check("battery work = V0ΔQ = -221.25 nJ", L.book().Wb, -221.25, 1e-6);
  T.check("your work = ΔU - W_b = +110.6 nJ", c.U - L.book().U0 - L.book().Wb, 110.625, 1e-6);
  T.ok("try 'connected' triggered", done("connected"));
  // cut off, then pull apart: Q fixed, V and U grow, E unchanged
  L.set({ d: 2 }); L.setConnected(false);
  var E0 = L.state().Eair;
  L.set({ d: 3 }); c = L.state();
  T.check("isolated: Q fixed", c.Q, 4.425, 1e-9);
  T.check("isolated: V = Qd/ε₀A = 150 V", c.V, 150, 1e-9);
  T.check("isolated: E unchanged (σ/ε₀)", c.Eair, E0, 1e-9);
  T.check("isolated: your work = ΔU = Q²Δ(1/C)/2", c.U - L.book().U0, 0.5 * 4.425 * 4.425 / 29.5 * 1000 - 221.25, 1e-6);
  T.ok("try 'isolated' triggered", done("isolated"));
  // medium: isolated, slab K=4 slides in -> V = 25 V, U = 55.3 nJ
  qs[1].querySelector(".btn-primary").click();
  T.click(/^Play/); t.sim.pause();
  T.steps(t.sim, 300);
  c = L.state();
  T.check("medium: slab all the way in by Play", +document.querySelectorAll(".controls output")[5].textContent.replace(/[^\d.]/g, ""), 100, 1e-9);
  T.check("medium: V = Q/(KC) = 25 V", c.V, 25, 1e-9);
  T.check("medium: U = U0/K = 55.31 nJ", c.U, 221.25 / 4, 1e-9);
  T.ok("try 'fill' triggered", done("fill"));
  // half-in slab: parallel combination
  L.set({ f: 50 }); c = L.state();
  T.check("half slab (full thickness): C = (K+1)/2 · C0", c.C, 44.25 * 2.5, 1e-9);
  // hard: partial-thickness slab
  qs[2].querySelector(".btn-primary").click();
  c = L.state();
  T.check("hard: C = ε₀A/(d - t + t/K) = 44.25 pF", c.C, 44.25, 1e-9);
  T.check("hard: E in air = V/(d - t + t/K) = 30 kV/m", c.Egap, 30, 1e-9);
  T.check("hard: E in slab = 10 kV/m", c.Eslab, 10, 1e-9);
  T.ok("hard: readouts show 30.0 and 10.0 kV/m", /30\.0 kV\/m/.test(T.text(".readouts")) && /10\.0 kV\/m/.test(T.text(".readouts")));
  // combinations
  L.setMode("combo");
  var k = L.combo();
  T.check("series 2,3,6 μF: C_eq = 1 μF", k.Ceq, 1, 1e-12);
  T.ok("series: same Q, V shares 6/4/2", Math.abs(k.Q[0] - 12) < 1e-9 && Math.abs(k.Q[2] - 12) < 1e-9 && Math.abs(k.Vs[0] - 6) < 1e-9 && Math.abs(k.Vs[2] - 2) < 1e-9);
  T.click(/^Play/); t.sim.pause(); T.steps(t.sim, 200);
  L.topo("parallel"); k = L.combo();
  T.check("parallel: C_eq = 11 μF", k.Ceq, 11, 1e-12);
  T.click(/^Play/); t.sim.pause(); T.steps(t.sim, 200);
  T.ok("try 'combo' triggered", done("combo"));
  L.apply({ mode: "combo", topo: "mixed", c: [6, 1, 2], V: 12 }); k = L.combo();
  T.check("mixed 6 + (1 ∥ 2): C_eq = 2 μF", k.Ceq, 2, 1e-12);
  T.ok("mixed: Q1 = 24, V1 = 4, Q2 = 8, Q3 = 16", [k.Q[0] - 24, k.Vs[0] - 4, k.Q[1] - 8, k.Q[2] - 16].every(function (x) { return Math.abs(x) < 1e-9; }));
  T.check("energy ½C_eqV² = ΣU_i", k.U[0] + k.U[1] + k.U[2], k.Utot, 1e-9);

  /* ---------- concept map ---------- */
  var bad = Maps.EDGES.filter(function (e) { return (e[0] + e[1]).indexOf("electrostatics_") !== -1 && (!Maps.NODES[e[0]] || !Maps.NODES[e[1]]); });
  T.ok("map: every electrostatics edge joins known ideas", bad.length === 0, JSON.stringify(bad));
  ["coulomb", "fieldlines", "capacitors"].forEach(function (id) {
    var ids = Maps.LAB_NODES[id] || [];
    T.ok("map: " + id + " has 6–8 ideas, all defined", ids.length >= 6 && ids.length <= 8 && ids.every(function (n) { return Maps.NODES[n]; }), ids.join(","));
    T.mount(id);
    T.ok("map: " + id + " renders its concept map", (T.text(".cmap-slot") || "").indexOf(Maps.NODES[ids[0]].label) !== -1);
  });
});
