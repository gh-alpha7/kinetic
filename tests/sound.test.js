// Waves & sound: travelling waves, standing waves, beats & Doppler, each checked against the textbook formula.
T.run(function () {
  function clearTries(id) { try { localStorage.removeItem("kinetic:tries:" + id); } catch (e) { /* ignore */ } }
  function done(t, id) {
    var ids = t.lab.tries.map(function (x) { return x.id; }), li = t.root.querySelectorAll(".try")[ids.indexOf(id)];
    return !!(li && li.classList.contains("done"));
  }
  function run(t, n) { t.sim.play(); T.steps(t.sim, n); t.sim.pause(); }

  /* ---------- travelling waves ---------- */
  ["travelling", "standing", "beatsdoppler"].forEach(clearTries);
  var t = T.mount("travelling"), H = window.__lab_travelling;
  T.ok("travelling: hook", !!H);
  T.ok("travelling: readouts render", T.text(".readouts").length > 20);
  T.ok("travelling: 3 practice questions", t.root.querySelectorAll(".qcard").length === 3);
  run(t, 360);
  var s = H.state();
  T.check("travelling default v = √(4/0.25) (crest tracker)", s.vMeas, 4, 0.01);
  T.check("travelling default λ = v/f", s.lamMeas, 4, 0.01);
  T.check("travelling default period 1/f", s.Tmeas, 1, 0.002);
  T.check("travelling default top particle speed Aω", s.vpMax, 0.5 * 2 * Math.PI, 0.01);
  T.check("travelling v_p measured = formula", s.vp, s.vpF, 0.005);

  // easy: T = 9 N, μ = 0.25, f = 1.5 Hz -> v = 6, λ = 4
  H.apply({ mode: "sine", T: 9, mu: 0.25, f: 1.5, A: 0.4, phi: 0, xp: 6 });
  run(t, 240); s = H.state();
  T.check("travelling easy: v = 6 m/s", s.vMeas, 6, 0.015);
  T.check("travelling easy: λ = 4.0 m", s.lamMeas, 4, 0.01);

  // medium: pulse, fixed end, echo 2(12 - 6)/6 = 2.0 s upside down
  H.apply({ mode: "pulse", end: "fixed", T: 9, mu: 0.25, A: 0.5, xp: 6 });
  run(t, 300); s = H.state();
  T.ok("travelling medium: echo seen", !!s.echo, JSON.stringify(s.peaks));
  T.check("travelling medium: echo time 2.00 s", s.echo && s.echo.dt, 2, 0.005);
  T.ok("travelling medium: echo inverted", s.echo && s.echo.sign < 0);
  T.check("travelling fixed end never moves", s.endPeak, 0, 1e-6);
  T.ok("try invert", done(t, "invert"));

  // hard: φ = 60°, x_p = 1 m: y = 0.25 m and moving up at Aω sin60° = 2.72 m/s
  H.apply({ mode: "sine", T: 4, mu: 0.25, f: 1, A: 0.5, phi: 60, xp: 1, dir: 1 });
  s = H.state();
  T.check("travelling hard: y_p(0) = 0.25 m", s.y, 0.25, 1e-3);
  T.check("travelling hard: v_p(0) = +2.72 m/s", s.vp, 0.5 * 2 * Math.PI * Math.sin(Math.PI / 3), 0.005);
  H.apply({ mode: "sine", T: 4, mu: 0.25, f: 1, A: 0.5, phi: 300, xp: 1, dir: 1 });
  T.ok("travelling hard distractor 300°: moving down", H.state().vp < 0);

  // tries
  H.apply({ mode: "sine", T: 4, mu: 0.25, f: 2, A: 0.8, phi: 0, xp: 6 });
  run(t, 120);
  T.ok("try outrun", done(t, "outrun"), JSON.stringify(H.state()));
  H.apply({ mode: "sine", T: 1, mu: 0.25, f: 1, A: 0.5, phi: 0, xp: 6 });
  run(t, 120); s = H.state();
  T.check("travelling λ try: λ = 2 m", s.lamMeas, 2, 0.01);
  T.ok("try lambda", done(t, "lambda"));
  H.apply({ mode: "pulse", end: "free", T: 4, mu: 0.25, A: 0.5, xp: 6 });
  run(t, 400); s = H.state();
  T.check("travelling free end peak 2A", s.endPeak, 1.0, 0.005);
  T.ok("travelling free end: echo upright", s.echo && s.echo.sign > 0);
  T.check("travelling free echo time 2(12-6)/4", s.echo && s.echo.dt, 3, 0.005);
  T.ok("try free", done(t, "free"));
  T.ok("travelling: no NaN in readouts", !/NaN/.test(T.text(".readouts")));
  // direction -x: crest tracker still gives v
  H.apply({ mode: "sine", T: 16, mu: 0.25, f: 1, A: 0.5, phi: 0, xp: 6, dir: -1 });
  run(t, 200);
  T.check("travelling −x: v = 8 m/s", H.state().vMeas, 8, 0.02);

  function has(id) { return K.labs.some(function (l) { return l.id === id; }); }
  if (has("standing")) standingTests();
  if (has("beatsdoppler")) beatsTests();

  function standingTests() {
    var t = T.mount("standing"), S = window.__lab_standing, s;
    T.ok("standing: readouts render", T.text(".readouts").length > 20);
    T.ok("standing: 3 practice questions", t.root.querySelectorAll(".qcard").length === 3);
    function peak(lo, hi, step) {   // where the simulated resonance curve actually peaks
      var best = lo, ba = -1;
      for (var f = lo; f <= hi + 1e-9; f += step) { var a = S.amp(f); if (a > ba) { ba = a; best = f; } }
      return best;
    }
    // string: L = 4 m, v = 4 m/s -> f_n = 0.5 n
    S.apply({ mode: "string", L: 4, T: 4, mu: 0.25, f: 0.9 });
    T.ok("standing default not ringing at 0.9 Hz", !S.state().ringing);
    T.check("standing string peak 2: 2v/2L = 1.000 Hz", peak(0.9, 1.1, 0.0005), 1.0, 0.001);
    T.check("standing string peak 5: 2.500 Hz", peak(2.4, 2.6, 0.0005), 2.5, 0.001);
    // auto-sweep across harmonic 2 and read the peak found
    S.sweep(true); run(t, 330); S.sweep(false);
    s = S.state();
    T.check("standing sweep finds peak at f_2 = 1.000 Hz", s.best, 1.0, 0.006);
    S.set("f", 1.0); run(t, 120); s = S.state();
    T.ok("standing ringing at 1.0 Hz: harmonic 2", s.ringing && s.ringing.h === 2);
    var mx = Math.max.apply(null, s.env);
    T.ok("standing h=2: midpoint is a node", s.env[50] < 0.08 * mx, s.env[50] + " vs " + mx);
    T.ok("standing h=2: quarter point is an antinode", s.env[25] > 0.95 * mx);
    T.check("standing envelope max = resonance amplitude", mx, S.amp(1.0), 0.01 * S.amp(1.0));
    // easy: L = 5, T = 9 -> f_3 = 1.8 Hz
    S.apply({ mode: "string", L: 5, T: 9, mu: 0.25, f: 1.8 });
    s = S.state();
    T.check("standing easy: f_1 = 0.6 Hz", s.f1, 0.6, 1e-9);
    T.check("standing easy: peak at 1.800 Hz", peak(1.7, 1.9, 0.0005), 1.8, 0.001);
    T.ok("standing easy: rings in harmonic 3", s.ringing && s.ringing.h === 3);
    T.ok("try third", done(t, "third"));
    // Melde: f fixed at 1.0 Hz, raise T to 16 N -> v = 8, f_1 = 1.0
    S.apply({ mode: "string", L: 4, T: 5, mu: 0.25, f: 1.0 });
    T.ok("standing Melde: not ringing before", !S.state().ringing);
    S.set("T", 16); s = S.state();
    T.ok("standing Melde: rings at harmonic 1 after T change", s.ringing && s.ringing.h === 1, JSON.stringify(s.nearest));
    T.ok("try melde", done(t, "melde"));
    // open pipe L = 0.5, v = 340: 340, 680
    S.apply({ mode: "open", pL: 0.5, v: 340, pf: 340 });
    T.check("standing open f_1 = v/2L = 340 Hz", peak(300, 380, 0.5), 340, 0.5);
    T.check("standing open f_2 = 680 Hz", peak(640, 720, 0.5), 680, 0.5);
    S.set("pf", 680);
    T.ok("try open", done(t, "open"));
    run(t, 120); s = S.state();
    var me = Math.max.apply(null, s.env), mp = Math.max.apply(null, s.penv);
    T.ok("standing open: displacement antinodes at both ends", s.env[0] > 0.95 * me && s.env[100] > 0.95 * me);
    T.ok("standing open: pressure nodes at both ends", s.penv[0] < 0.15 * mp && s.penv[100] < 0.02 * mp, s.penv[0] + "," + s.penv[100]);
    // closed pipe: 170, 510, nothing at 340
    S.apply({ mode: "closed", pL: 0.5, v: 340, pf: 170 });
    T.check("standing closed f_1 = v/4L = 170 Hz", peak(140, 200, 0.5), 170, 0.5);
    T.ok("standing closed: no resonance at 2f_1", S.amp(340) < 0.2 * S.amp(170), S.amp(340) + " vs " + S.amp(170));
    S.set("pf", 510); s = S.state();
    T.ok("standing medium: 510 Hz is harmonic 3", s.ringing && s.ringing.h === 3);
    T.ok("try closed", done(t, "closed"));
    S.set("pf", 850); s = S.state();
    T.ok("standing medium: 850 Hz is harmonic 5", s.ringing && s.ringing.h === 5);
    T.check("standing closed f_5 peak 850 Hz", peak(820, 880, 0.5), 850, 0.5);
    run(t, 120); s = S.state();
    me = Math.max.apply(null, s.env); mp = Math.max.apply(null, s.penv);
    T.ok("standing closed: displacement node at the closed end", s.env[0] < 0.15 * me);
    T.ok("standing closed: pressure antinode at the closed end", s.penv[0] > 0.95 * mp);
    // hard: closed 15 cm -> 566.7 Hz = open 60 cm, harmonic 2
    S.apply({ mode: "closed", pL: 0.15, v: 340, pf: 567 });
    s = S.state();
    T.check("standing hard: closed 15 cm f_1", s.f1, 340 / 0.6, 1e-6);
    T.ok("standing hard: rings at 567 Hz", s.ringing && s.ringing.h === 1);
    S.mode("open"); S.set("pL", 0.6); s = S.state();
    T.ok("standing hard: open 60 cm rings at 567 Hz in harmonic 2", s.ringing && s.ringing.h === 2, JSON.stringify(s.nearest));
    T.ok("standing: no NaN in readouts", !/NaN/.test(T.text(".readouts")));
  }
  function beatsTests() {
    var t = T.mount("beatsdoppler"), Bd = window.__lab_beatsdoppler, s;
    T.ok("beatsdoppler: readouts render", T.text(".readouts").length > 20);
    T.ok("beatsdoppler: 3 practice questions", t.root.querySelectorAll(".qcard").length === 3);
    run(t, 360); s = Bd.state();
    T.check("beats 256 & 260: counted beat f = 4 Hz", s.beat, 4, 0.01);
    T.ok("try four", done(t, "four"));
    // easy: 256 & 262 -> 6 Hz
    Bd.apply({ mode: "beats", f1: 256, f2: 262, r: 1 }); run(t, 300); s = Bd.state();
    T.check("beats easy: 6 Hz", s.beat, 6, 0.01);
    // medium: B = 252 gives 4, waxed to 250 gives 6
    Bd.apply({ mode: "beats", f1: 256, f2: 252, r: 1 }); run(t, 300);
    T.check("beats medium: 256 & 252 -> 4 Hz", Bd.state().beat, 4, 0.01);
    Bd.set("f2", 250); run(t, 300);
    T.check("beats medium: waxed to 250 -> 6 Hz", Bd.state().beat, 6, 0.01);
    Bd.set("f2", 258); run(t, 300);
    T.check("beats medium distractor: 260 waxed to 258 -> 2 Hz", Bd.state().beat, 2, 0.01);
    // amplitude ratio 0.5 -> I_max/I_min = 9
    Bd.apply({ mode: "beats", f1: 300, f2: 303.5, r: 0.5 }); run(t, 300); s = Bd.state();
    T.check("beats A2/A1 = 0.5: I_max/I_min = 9", Math.pow(s.eMax / s.eMin, 2), 9, 0.05);
    T.check("beats 3.5 Hz with unequal amplitudes", s.beat, 3.5, 0.01);
    Bd.apply({ mode: "beats", f1: 256, f2: 256, r: 1 }); run(t, 200);
    T.ok("beats unison: no beats", Bd.state().beat === null);

    // hard (i): source approaching at 34 m/s -> 500 * 340 / 306 = 555.6 Hz
    Bd.apply({ mode: "doppler", f: 500, v: 340, vs: 34, vo: 0, xs: 150, xo: 700 }); run(t, 480); s = Bd.state();
    T.check("doppler hard (i) measured f' = 555.6 Hz", s.fMeas, 500 * 340 / 306, 0.05);
    T.check("doppler hard (i) formula f'", s.formula.f, 500 * 340 / 306, 1e-6);
    // hard (ii): observer approaching at 34 m/s -> 500 * 374 / 340 = 550.0 Hz
    Bd.set("vs", 0); Bd.set("vo", -34); run(t, 480); s = Bd.state();
    T.check("doppler hard (ii) measured f' = 550.0 Hz", s.fMeas, 550, 0.05);
    T.check("doppler hard (ii) formula", s.formula.f, 550, 1e-6);
    T.ok("try asym", done(t, "asym"));
    // receding observer: 500 * (340 - 20) / 340
    Bd.set("vo", 20); run(t, 480);
    T.check("doppler observer receding: 470.6 Hz", Bd.state().fMeas, 500 * 320 / 340, 0.05);
    // default: source at 60 m/s drives past the observer: 607.1 Hz then 425.0 Hz
    Bd.apply({ mode: "doppler", f: 500, v: 340, vs: 60, vo: 0, xs: 150, xo: 700 }); run(t, 420); s = Bd.state();
    T.check("doppler approaching at 60: 607.1 Hz", s.fMeas, 500 * 340 / 280, 0.05);
    run(t, 300); s = Bd.state();
    T.check("doppler receding at 60: 425.0 Hz", s.fMeas, 500 * 340 / 400, 0.05);
    T.check("doppler receding formula", s.formula.f, 425, 1e-6);
    T.ok("try pass", done(t, "pass"));
    // both moving: S at 30 towards, O at 10 towards: 500 (350)/(310)
    Bd.apply({ mode: "doppler", f: 500, v: 340, vs: 30, vo: -10, xs: 150, xo: 800 }); run(t, 480);
    T.check("doppler both moving: 564.5 Hz", Bd.state().fMeas, 500 * 350 / 310, 0.05);
    // off the line: measured close to the line-of-sight formula
    Bd.place(0, 900, 200); Bd.set("vs", 40); run(t, 240); s = Bd.state();
    T.check("doppler off-axis: measured ≈ formula (cos θ)", s.fMeas, s.formula.f, 0.005 * s.formula.f);
    // shock
    Bd.apply({ mode: "doppler", f: 500, v: 340, vs: 500, vo: 0, xs: 100, xo: 900 }); run(t, 90);
    T.ok("try shock", done(t, "shock"));
    T.ok("doppler shock: observer ahead hears nothing", Bd.state().fMeas === null);
    T.ok("beatsdoppler: no NaN in readouts", !/NaN/.test(T.text(".readouts")));
  }
});
