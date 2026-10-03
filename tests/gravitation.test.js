// Gravitation: orbits, escape, gvariation against their textbook formulas.
T.run(function () {
  ["orbits", "escape", "gvariation"].forEach(function (id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) {} });
  function doneTries(id) { return [].slice.call(document.querySelectorAll(".try.done")).length; }
  var has = function (id) { return K.labs.some(function (l) { return l.id === id; }); };

  /* ---------- orbits ---------- */
  if (has("orbits")) {
    var t = T.mount("orbits"), L = window.__lab_orbits, sim = t.sim;
    var GM = 6.674e-11 * 1.989e30, AU = 1.496e11;
    T.ok("orbits: readouts render", T.text(".readouts").length > 40);
    T.ok("orbits: 4 tries, 3 practice", t.root.querySelectorAll(".try").length === 4 && t.root.querySelectorAll(".qcard").length === 3);
    T.ok("orbits: maths rendered", t.root.querySelectorAll(".eq .katex").length >= 4);
    var stepsFor = function (yr) { return Math.ceil(yr / (K.DT * 0.4)); };
    // easy: circular orbit at 4 AU
    L.apply({ r0: 4, v: "circ", phi: 0 });
    T.check("orbits easy: v_c(4 AU) km/s", L.state().p.v, Math.sqrt(GM / (4 * AU)) / 1000, 0.006);
    T.check("orbits easy: answer 14.9 km/s", L.state().p.v, 14.9, 0.05);
    L.launch(); T.steps(sim, stepsFor(8.2));
    var s = L.state(), lap = s.fl.laps[0];
    T.check("orbits circle: T = 2π√(a³/GM) at 4 AU (yr)", lap.T, s.el.T, 0.001);
    T.check("orbits circle: T ≈ 8.00 yr", lap.T, 8.0, 0.01);
    T.ok("orbits circle: r stays constant", (lap.rmax - lap.rmin) / 4 < 0.002, lap.rmin + " " + lap.rmax);
    T.check("orbits circle: sim speed = v_c", Math.hypot(s.fl.vx, s.fl.vy) * 1.496e11 / 3.156e7 / 1000, 14.89, 0.01);
    // medium: perihelion 1 AU, v = 36.48 → a = 2 AU, T = 2.83 yr
    L.apply({ r0: 1, v: 36.48, phi: 0 }); L.launch(); T.steps(sim, stepsFor(3));
    s = L.state(); lap = s.fl.laps[0];
    T.check("orbits medium: measured a vs −GM/2E", lap.a, s.el.a, 0.001);
    T.check("orbits medium: measured T vs 2π√(a³/GM)", lap.T, s.el.T, 0.001);
    T.check("orbits medium: answer 2.83 yr", lap.T, 2.83, 0.006);
    T.check("orbits medium: aphelion 3 AU", lap.rmax, 3, 0.01);
    T.check("orbits: energy conserved (MJ/kg)", s.fl.rec.e[s.fl.rec.e.length - 1], s.fl.rec.e[0], 0.01);
    T.ok("orbits areas: sectors equal (<0.2%)", s.sec && s.sec.spread < 0.002, s.sec && s.sec.spread);
    T.check("orbits areas: sector area = ½hτ", s.sec.last, Math.abs(s.el.h) / 2 * s.fl.tau, 1e-4);
    // hard: 1.2 v_c → r_max 2.57 AU
    L.apply({ r0: 1, v: 35.75, phi: 0 }); L.launch(); T.steps(sim, stepsFor(2.5));
    s = L.state(); lap = s.fl.laps[0];
    T.check("orbits hard: r_max vs r/(2/k²−1)", lap.rmax, 1 / (2 / Math.pow(35.75 / s.vc, 2) - 1), 0.005);
    T.check("orbits hard: answer 2.57 AU", lap.rmax, 2.57, 0.006);
    // tilted launch, elliptical: period still matches
    L.apply({ r0: 1.5, v: 20, phi: 30 }); L.launch(); T.steps(sim, stepsFor(2.2));
    s = L.state();
    T.check("orbits tilted: T vs formula", s.fl.laps[0].T, s.el.T, 0.002);
    // circle at 1 AU
    L.apply({ r0: 1, v: "circ", phi: 0 }); L.launch(); T.steps(sim, stepsFor(1.1));
    s = L.state();
    T.check("orbits: Earth's year (yr)", s.fl.laps[0].T, 1.0, 0.002);
    // escape
    L.apply({ r0: 1, v: 42.2, phi: 0 }); L.launch(); sim.play(); T.steps(sim, stepsFor(10)); sim.pause();
    s = L.state();
    T.ok("orbits escape: left the stage", s.fl.done === "away", s.fl.done);
    T.ok("orbits: all tries triggered", doneTries() === 4, doneTries());
  }

  /* ---------- escape ---------- */
  if (has("escape")) {
    var t2 = T.mount("escape"), E = window.__lab_escape, sim2 = t2.sim;
    var GME = 6.674e-11 * 5.972e24, RE = 6.371e6;
    T.ok("escape: 4 tries, 3 practice", t2.root.querySelectorAll(".try").length === 4 && t2.root.querySelectorAll(".qcard").length === 3);
    T.ok("escape: maths rendered", t2.root.querySelectorAll(".eq .katex").length >= 4);
    var run = function (max) { sim2.play(); for (var i = 0; i < max && !E.state().st.done; i++) sim2.stepOnce(); sim2.pause(); return E.state(); };
    // easy: 2M, 2R → same v_esc
    E.apply({ mode: "launch", M: 2, R: 2, v: 11.19, m: 1000 });
    var es = E.state();
    T.check("escape easy: v_esc(2M, 2R) = 11.19 km/s", es.vesc, Math.sqrt(2 * GME / RE) / 1000, 0.006);
    T.check("escape easy: answer 11.2", es.vesc, 11.2, 0.05);
    es = run(20000);
    T.ok("escape easy: v = v_esc escapes", es.st.done === "escaped", es.st.done);
    // medium: half v_esc → R/3
    E.apply({ mode: "launch", M: 1, R: 1, v: 5.59, m: 1000 });
    es = run(20000);
    T.check("escape medium: peak vs energy formula (km)", es.st.peak.h / 1e3, es.t.hmax / 1e3, 0.5);
    T.check("escape medium: peak ≈ R/3 (km)", es.st.peak.h / 1e3, 2124, 6);
    T.check("escape medium: constant-g guess = R/4 (km)", es.t.hg / 1e3, 1593, 3);
    T.ok("escape medium: lands again", es.st.done === "landed", es.st.done);
    T.check("escape: energy conserved (GJ)", es.st.E / 1e9, es.st.rec.e[0], 0.001);
    T.check("escape: lands at launch speed (km/s)", -es.st.v / 1000, 5.59, 0.01);
    // same flight, other mass → same peak (mass try)
    E.apply({ mode: "launch", M: 1, R: 1, v: 5.59, m: 3000 }); es = run(20000);
    T.check("escape: peak independent of m", es.st.peak.h / 1e3, es.t.hmax / 1e3, 0.5);
    // a fast launch: 9 km/s on Earth
    E.apply({ mode: "launch", M: 1, R: 1, v: 9, m: 1000 }); es = run(40000);
    T.check("escape 9 km/s: peak vs R/((ve/v)²−1)", es.st.peak.h, RE / (Math.pow(es.vesc / 9, 2) - 1), 2000);
    // other planet: 5 M, 1.5 R, 10 km/s
    E.apply({ mode: "launch", M: 5, R: 1.5, v: 10, m: 1000 }); es = run(40000);
    T.check("escape 5M,1.5R: peak vs energy formula (km)", es.st.peak.h / 1e3, es.t.hmax / 1e3, 1);
    // hard: orbit at h = R, 500 kg
    E.apply({ mode: "orbit", M: 1, R: 1, h: 6371, m: 500 });
    es = E.state();
    T.check("escape hard: ΔE from ground (GJ)", es.o.dE / 1e9, 0.75 * GME * 500 / RE / 1e9, 0.01);
    T.check("escape hard: answer 23.5 GJ", es.o.dE / 1e9, 23.5, 0.06);
    T.check("escape hard: sim ΔE (GJ)", (es.st.E + GME * 500 / RE) / 1e9, 23.46, 0.01);
    sim2.play(); for (var k = 0; k < 2600 && E.state().st.laps.length < 1; k++) sim2.stepOnce(); sim2.pause();
    es = E.state();
    T.check("escape orbit: period vs 2πr/v (s)", es.st.laps[0], es.o.T, 1);
    T.check("escape orbit: KE = −E", es.st.KE, -es.st.E, Math.abs(es.st.E) * 1e-5);
    T.check("escape orbit: E = U/2", es.st.E, es.st.U / 2, Math.abs(es.st.E) * 1e-5);
    T.check("escape orbit: speed √(GM/r)", Math.hypot(es.st.vx, es.st.vy), Math.sqrt(GME / (2 * RE)), 1);
    // trap try: 9 km/s gives h far above v²/2g
    T.ok("escape: all tries triggered", doneTries() === 4, doneTries());
  }

  /* ---------- g variation ---------- */
  if (has("gvariation")) {
    var t3 = T.mount("gvariation"), Gv = window.__lab_gvariation, sim3 = t3.sim;
    T.ok("gvar: 4 tries, 3 practice", t3.root.querySelectorAll(".try").length === 4 && t3.root.querySelectorAll(".qcard").length === 3);
    T.ok("gvar: maths rendered", t3.root.querySelectorAll(".eq .katex").length >= 4);
    var gread = function () { return parseFloat(/g at the probe\s*([\d.]+)/.exec(T.text(".readouts"))[1]); };
    Gv.apply({ r: 0.75 });
    T.check("gvar easy: g at d = R/4", gread(), 7.35, 0.005);
    Gv.apply({ r: 1.414 });
    T.check("gvar medium: g at h = 0.414R", gread(), 4.90, 0.005);
    T.check("gvar medium: g at h = 0.414R matches g/2 (exact)", Gv.state().g, 9.8 / 2, 0.01);
    Gv.probe(0.5); T.check("gvar: g at depth R/2", gread(), 4.90, 0.005);
    Gv.probe(2); T.check("gvar: g at h = R", gread(), 2.45, 0.005);
    Gv.probe(1.1); T.check("gvar: g at h = 0.1R", gread(), 9.8 / 1.21, 0.006);
    Gv.probe(0);
    var runT = function () { sim3.play(); for (var i = 0; i < 20000 && Gv.state().st.turns.length < 2; i++) sim3.stepOnce(); sim3.pause(); return Gv.state(); };
    Gv.apply({ r: 1.5, b: 0, A: 1 });
    var gs = runT();
    T.check("gvar tunnel: period vs 2π√(R/g) (min)", gs.st.turns[1] / 60, 2 * Math.PI * Math.sqrt(6.371e6 / 9.8) / 60, 0.05);
    T.check("gvar tunnel: period ≈ 84.4 min", gs.st.turns[1] / 60, 84.4, 0.05);
    var vmax = gs.st.rec.v.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0);
    T.check("gvar tunnel: v_max = √(gR) (km/s)", vmax, Math.sqrt(9.8 * 6.371e6) / 1000, 0.01);
    Gv.apply({ r: 1.5, b: 0.5, A: 1 }); gs = runT();
    T.check("gvar hard: chord end to end (min)", gs.st.turns[0] / 60, 42.2, 0.05);
    T.check("gvar hard: chord period = diameter period", gs.st.turns[1] / 60, 84.4, 0.05);
    Gv.apply({ planet: "moon", r: 1, b: 0, A: 0.5 }); gs = runT();
    T.check("gvar Moon tunnel period (min)", gs.st.turns[1] / 60, 2 * Math.PI * Math.sqrt(1.737e6 / 1.62) / 60, 0.05);
    T.ok("gvar: all tries triggered", doneTries() === 4, doneTries());
  }
});
