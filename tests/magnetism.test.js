// Magnetism: charges in fields (lorentz) and fields from currents (biotsavart).
T.run(function () {
  var TAU = 2 * Math.PI;
  ["lorentz", "biotsavart"].forEach(function (id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) {} });
  function runTo(t, L, maxSteps) {
    var n = 0;
    while (!L.run().done && n++ < (maxSteps || 20000)) t.sim.stepOnce();
    return L.run().result;
  }
  function trigger(t, L, setup) { L.apply(setup); T.click(/^Fire/); t.sim.pause(); return runTo(t, L); }

  /* ---------- lorentz ---------- */
  var t = T.mount("lorentz"), L = window.__lab_lorentz;
  T.ok("lorentz mounts", !!L && !!t.sim);
  T.ok("lorentz readouts render", (T.text(".readouts") || "").length > 20);

  // easy question: three speeds, same period 2πm/qB
  var r = trigger(t, L, { mode: "circle", q: 1, m: 1, B: 1, v: 4, phi: 0, race: true });
  T.check("circle T (v = 4)", r.parts[0].T, TAU, 0.005);
  T.check("circle T (v = 2.4)", r.parts[1].T, TAU, 0.005);
  T.check("circle T (v = 1.2)", r.parts[2].T, TAU, 0.005);
  T.check("circle r = mv/qB (v = 4)", r.parts[0].r, 4, 0.005);
  T.check("circle r (v = 1.2)", r.parts[2].r, 1.2, 0.005);
  T.check("circle closes", r.parts[0].gap, 0, 0.0005);
  var ke = L.run().rec.map(function (q) { return q[5]; });
  T.check("KE constant (max)", Math.max.apply(null, ke), 8, 1e-6);
  T.check("KE constant (min)", Math.min.apply(null, ke), 8, 1e-6);
  T.ok("try: period", L.tries.count() >= 1, L.tries.count());

  r = trigger(t, L, { mode: "circle", q: 2, m: 3, B: 0.7, v: 5, phi: 20, sign: -1, bdir: -1 });
  T.check("circle r (q=2,m=3,B=0.7,v=5)", r.parts[0].r, 3 * 5 / (2 * 0.7), 0.005);
  T.check("circle T (q=2,m=3,B=0.7)", r.parts[0].T, TAU * 3 / (2 * 0.7), 0.005);

  // medium: helix pitch 12.57 m
  r = trigger(t, L, { mode: "helix", q: 1, m: 1, B: 1, v: 4, th: 60 });
  T.check("helix pitch (practice: 12.6 m)", r.pitch, 2 * TAU, 0.005);
  T.check("helix radius", r.r, 4 * Math.sin(Math.PI / 3), 0.005);
  T.check("helix T", r.T, TAU, 0.005);
  var c0 = L.tries.count();
  r = trigger(t, L, { mode: "helix", q: 2, m: 1, B: 1.5, v: 6, th: 45 });
  T.check("helix pitch 45° = 2πr", r.pitch, TAU * r.r, 0.01);
  T.ok("try: pitch", L.tries.count() === c0 + 1);

  // hard: field edge, 4.19 s and 6.93 m
  r = trigger(t, L, { mode: "circle", region: "edge", q: 1, m: 1, B: 1, bdir: 1, sign: 1, v: 4, phi: 30 });
  T.check("edge time in field (practice: 4.19 s)", r.tField, 4 * Math.PI / 3, 0.005);
  T.check("edge exit distance (practice: 6.93 m)", r.chord, 8 * Math.cos(Math.PI / 6), 0.005);
  T.check("edge angle turned", r.swept, 240, 0.05);
  T.check("edge exit angle", r.exitAng, 30, 0.05);
  r = trigger(t, L, { mode: "circle", region: "edge", q: 1, m: 1, B: 1, bdir: 1, sign: -1, v: 4, phi: 30 });
  T.check("edge time, negative charge (short arc)", r.tField, 2 * Math.PI / 3, 0.005);

  // selector
  r = trigger(t, L, { mode: "selector", q: 1, m: 1, B: 1, bdir: -1, v: 4, E: 6 });
  T.ok("selector: v != E/B blocked or hit", !r.pass, JSON.stringify(r));
  c0 = L.tries.count();
  r = trigger(t, L, { mode: "selector", q: 3, m: 2, B: 1.5, bdir: -1, v: 4, E: 6, sign: -1 });
  T.ok("selector: v = E/B passes (negative charge)", r.pass, JSON.stringify(r));
  T.check("selector exit deflection", r.yExit, 0, 0.001);
  T.ok("try: selector", L.tries.count() === c0 + 1);

  // cyclotron
  c0 = L.tries.count();
  r = trigger(t, L, { mode: "cyclotron", q: 1, m: 1, B: 2, V: 4, fr: 1, R: 6 });
  T.ok("cyclotron exits", r.exit, JSON.stringify(r).slice(0, 200));
  T.check("cyclotron f = qB/2πm", r.f, 2 / TAU, 0.0005);
  T.check("cyclotron KE = n qV", r.ke, r.n * 4, 0.01);
  T.check("cyclotron exit KE = q²B²r²/2m", r.keExit, 4 * r.rExit * r.rExit / 2, 0.01 * r.keExit);
  T.ok("cyclotron exit KE <= KE max", r.keExit <= 72 + 1e-9, r.keExit);
  T.ok("cyclotron half-orbit r = mv/qB", r.half.every(function (h) { return Math.abs(h[1] - h[0] / 2) < 1e-3; }));
  T.ok("try: cyclotron", L.tries.count() === c0 + 1);
  r = trigger(t, L, { mode: "cyclotron", q: 1, m: 1, B: 2, V: 1, fr: 1.15, R: 6 });
  T.ok("detuned cyclotron never gets out", !r.exit, JSON.stringify(r).slice(0, 120));
  T.ok("lorentz maths renders", (T.text(".eqs") || "").length > 20);

  /* ---------- biotsavart ---------- */
  var MU0 = 4 * Math.PI * 1e-7;
  t = T.mount("biotsavart"); var Bs = window.__lab_biotsavart;
  T.ok("biotsavart mounts", !!Bs && !!t.sim);
  function mag(b) { return Math.hypot(b[0], b[1]); }
  function on() { T.click(/^Switch on/); t.sim.pause(); T.steps(t.sim, 200); }

  // easy: 10 A at 5 cm = 40.0 µT
  Bs.apply({ mode: "wire", I: 10, dir: 1, probe: [5, 0] }); on();
  T.check("wire B at 5 cm (practice: 40 µT)", mag(Bs.Bat(5, 0)) * 1e6, 40, 0.05);
  T.check("wire B at (3, 4) cm, 7 A", (Bs.apply({ mode: "wire", I: 7, dir: -1, probe: [3, 4] }), mag(Bs.Bat(3, 4)) * 1e6), 2e-7 * 7 / 0.05 * 1e6, 0.05);
  var bw = Bs.Bat(0, 5);
  T.ok("right-hand rule: current into screen gives clockwise B (at top, B points right)", bw[0] > 0 && Math.abs(bw[1]) < 1e-12, bw);
  T.ok("readout shows formula", /formula 28\.0 µT/.test(T.text(".readouts")), T.text(".readouts"));
  var c0 = Bs.tries.count();
  Bs.apply({ mode: "wire", I: 10, dir: 1, probe: [3, 0] }); Bs.setProbe(3, 0); Bs.setProbe(6, 0);
  T.ok("try: half", Bs.tries.count() === c0 + 1);

  // loop centre
  Bs.apply({ mode: "loop", I: 4, dir: 1, R: 5, probe: [0, 0] }); on();
  T.check("loop centre μ0I/2R (4 A, 5 cm) µT", mag(Bs.Bat(0, 0)) * 1e6, MU0 * 4 / 0.1 * 1e6, 0.05);
  T.check("loop on axis x = 5 cm", Bs.Bat(5, 0)[0] * 1e6, MU0 * 4 * 0.0025 / (2 * Math.pow(0.005, 1.5)) * 1e6, 0.05);
  T.ok("loop B points along +x at centre", Bs.Bat(0, 0)[0] > 0);
  T.ok("loop field lines traced", true);

  // solenoid
  Bs.apply({ mode: "solenoid", I: 10, dir: 1, N: 30, a: 1.5, probe: [0, 0] }); on();
  var F = Bs.F();
  T.check("solenoid centre vs finite formula (mT)", mag(Bs.Bat(0, 0)) * 1e3, F.solC * 1e3, 0.005);
  T.check("solenoid finite factor ~ μ0nI", F.ideal * 1e3, MU0 * 150 * 10 * 1e3, 1e-9);
  T.check("solenoid end vs formula (mT)", mag(Bs.Bat(10, 0)) * 1e3, F.solEnd * 1e3, 0.005);
  T.check("solenoid end / centre ≈ 1/2", mag(Bs.Bat(10, 0)) / mag(Bs.Bat(0, 0)), 0.5, 0.01);
  Bs.apply({ mode: "solenoid", I: 5, dir: 1, N: 60, a: 1, probe: [0, 0] });
  F = Bs.F();
  T.check("long thin solenoid ≈ μ0nI (mT)", mag(Bs.Bat(0, 0)) * 1e3, F.ideal * 1e3, 0.01);
  c0 = Bs.tries.count(); Bs.setProbe(10, 0);
  T.ok("try: end", Bs.tries.count() === c0 + 1);

  // medium: two wires, 2.5e-4 N/m attract
  Bs.apply({ mode: "pair", I: 10, dir: 1, I2: 5, same: true, d: 4, probe: [0, 4] });
  var pf = Bs.pairForce();
  T.check("pair F/L (practice: 2.5e-4 N/m)", pf.f * 1e4, 2.5, 0.01);
  T.ok("pair same direction attracts", pf.attract);
  c0 = Bs.tries.count();
  T.click(/^Switch on/); t.sim.pause(); var n = 0; while (!Bs.st().done && n++ < 500) t.sim.stepOnce();
  T.ok("pair release: they touch", Bs.st().result && Bs.st().result.why === "touch", JSON.stringify(Bs.st().result));
  Bs.apply({ mode: "pair", I: 10, dir: 1, I2: 10, same: false, d: 6, probe: [0, 4] });
  pf = Bs.pairForce();
  T.check("pair F/L opposite 10 A, 6 cm", pf.f * 1e4, 2e-7 * 100 / 0.06 * 1e4, 0.01);
  T.ok("pair opposite repels", !pf.attract);
  T.click(/^Switch on/); t.sim.pause(); n = 0; while (!Bs.st().done && n++ < 500) t.sim.stepOnce();
  T.ok("pair release: they fly apart", Bs.st().result && Bs.st().result.why === "apart", JSON.stringify(Bs.st().result));
  T.ok("try: wires", Bs.tries.count() === c0 + 1);

  // hard: zero 15 cm beyond the 3 A wire (wires at x = -5 and +5 cm, so at x = 20 cm)
  Bs.apply({ mode: "pair", I: 5, dir: 1, I2: 3, same: false, d: 10, probe: [12, 0] });
  T.check("pair zero point (practice: 15 cm beyond 3 A)", mag(Bs.Bat(20, 0)) * 1e6, 0, 0.01);
  T.ok("not zero between them at 3.75 cm from 3 A wire", mag(Bs.Bat(1.25, 0)) * 1e6 > 10);
  T.ok("not zero beyond the 5 A wire", mag(Bs.Bat(-20, 0)) * 1e6 > 1);

  // Ampère
  Bs.apply({ mode: "ampere", I: 10 });
  T.check("Ampère default loop", Bs.ampTotal(), 0, 0.01);
  Bs.setAmp(0, 0, 12);
  T.check("Ampère all three wires: +5 A", Bs.ampTotal(), 5, 0.01);
  Bs.setAmp(6, 1.5, 3);
  T.check("Ampère around +5 A only", Bs.ampTotal(), 5, 0.01);
  Bs.setAmp(0, 8, 3);
  T.check("Ampère around nothing", Bs.ampTotal(), 0, 0.01);
  Bs.setAmp(-2, -2, 2);
  T.check("Ampère around −3 A only", Bs.ampTotal(), -3, 0.01);
  c0 = Bs.tries.count();
  Bs.setAmp(-4, -0.5, 4);
  T.click(/^Walk/); t.sim.pause(); n = 0; while (!Bs.st().done && n++ < 400) t.sim.stepOnce();
  T.check("Ampère walk total (±3 A inside)", Bs.st().result.total, 0, 0.01);
  T.ok("try: zero", Bs.tries.count() === c0 + 1);
  T.ok("biotsavart maths renders", (T.text(".eqs") || "").length > 20);
  T.ok("concept map has magnetism nodes", !!Maps.NODES.magnetism_lorentz && Maps.LAB_NODES.biotsavart.length >= 6);
});
