// SHM chapter: spring–mass, pendulums, damping & resonance against the textbook formulas.
T.run(function () {
  ["springmass", "pendulum", "resonance"].forEach(function (id) { localStorage.removeItem("kinetic:tries:" + id); });
  function done(id) { return [].slice.call(document.querySelectorAll(".tries li.done")).length; }
  function tried(t, i) { return t.root.querySelectorAll(".tries li")[i].classList.contains("done"); }
  var TWO_PI = 2 * Math.PI;

  /* ---------- spring–mass ---------- */
  if (K.labs.some(function (l) { return l.id === "springmass"; })) {
    var t = T.mount("springmass"), L = window.__lab_springmass;
    T.ok("springmass mounts", t.sim && L, "");
    T.click(/^Release/); t.sim.pause();
    T.steps(t.sim, 600);
    var st = L.state(), p = L.params();
    T.check("spring T (1 kg, 40 N/m)", st.T, TWO_PI * Math.sqrt(1 / 40), 1e-4);
    T.check("spring x(t) = A cos ωt at 10 s", st.s - st.seq, 0.2 * Math.cos(Math.sqrt(40) * 10), 1e-5);
    T.check("energy stays ½kA²", L.energies().E, 0.5 * 40 * 0.04, 1e-6);
    // with a kick: A = √(x0² + (v0/ω)²)
    L.setStart(0.1, 1); T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 300);
    var w = Math.sqrt(40), A = Math.hypot(0.1, 1 / w), phi = Math.atan2(-1 / w, 0.1);
    st = L.state();
    T.check("kicked: x = A cos(ωt + φ) at 5 s", st.s - st.seq, A * Math.cos(w * 5 + phi), 1e-5);
    T.check("kicked: amplitude formula", L.params().A, A, 1e-9);

    var qs = t.lab.mount && t.root.querySelectorAll(".qcard");
    T.ok("springmass has 3 practice questions", qs.length === 3, qs.length);
    // easy: T = 0.628 s
    L.apply({ mode: "horiz", combo: "one", m: 1, k1: 100, x0: 0.2 });
    T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 200);
    T.check("Q easy: T = 0.628 s", L.state().T, 0.628, 0.0005);
    // medium: series 1.405 s, parallel 0.702 s, ratio 2
    L.apply({ mode: "horiz", combo: "series", m: 1, k1: 40, k2: 40, x0: 0.2 });
    T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 300);
    var Ts = L.state().T;
    T.check("Q medium: series T", Ts, TWO_PI * Math.sqrt(1 / 20), 1e-4);
    L.apply({ mode: "horiz", combo: "parallel", m: 1, k1: 40, k2: 40, x0: 0.2 });
    T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 300);
    var Tp = L.state().T;
    T.check("Q medium: parallel T", Tp, TWO_PI * Math.sqrt(1 / 80), 1e-4);
    T.check("Q medium: ratio 2", Ts / Tp, 2, 1e-4);
    T.ok("try combo triggered", tried(t, 2), "");
    // hard: vertical release from natural length, max stretch 2mg/k = 0.196 m, T 0.628 s
    L.apply({ mode: "vert", combo: "one", m: 1, k1: 100, natural: true });
    T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 200);
    T.check("Q hard: max stretch 0.196 m", L.state().maxStretch, 0.196, 0.0005);
    T.check("Q hard: vertical T 0.628 s", L.state().T, 0.628, 0.0005);
    // vert try: horizontal run with same m, k
    L.apply({ mode: "horiz", combo: "one", m: 1, k1: 100, x0: 0.2 });
    T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 200);
    T.ok("try vert triggered", tried(t, 1), "");
    // amp try: same set-up, amplitude 0.45 m
    L.apply({ mode: "horiz", combo: "one", m: 1, k1: 100, x0: 0.45 });
    T.click(/^Release/); t.sim.pause(); T.steps(t.sim, 200);
    T.ok("try amp triggered", tried(t, 0), "");
    // energy try: run until KE ≈ PE, then press Pause
    L.apply({ mode: "horiz", combo: "one", m: 1, k1: 40, x0: 0.3 });
    T.click(/^Release/);
    for (var i = 0; i < 300; i++) { t.sim.stepOnce(); var e = L.energies(); if (Math.abs(e.KE - e.PE) < 0.03 * e.E) break; }
    T.click(/Pause/);
    T.ok("try energy triggered", tried(t, 3), "");
    T.ok("springmass maths rendered", /rad\/s/.test(T.text(".eqs")), "");
  }

  /* ---------- pendulum ---------- */
  if (K.labs.some(function (l) { return l.id === "pendulum"; })) {
    var tp = T.mount("pendulum"), PL = window.__lab_pendulum;
    T.ok("pendulum mounts", tp.sim && PL, "");
    // small angle: T ≈ 2π√(L/g) (exact via AGM)
    PL.apply({ mode: "simple", L: 1, th0: 5, g: 9.8, lift: 0 });
    T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 300);
    var T0 = TWO_PI * Math.sqrt(1 / 9.8);
    T.check("pendulum 5°: T ≈ 2π√(L/g)", PL.state().T, T0, 0.002);
    T.check("pendulum 5°: matches exact", PL.state().T, PL.exactT(), 1e-4);
    // large angle 90°: exact T = 1.18034 T0
    PL.apply({ mode: "simple", L: 1, th0: 90, g: 9.8, lift: 0 });
    T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 400);
    T.check("pendulum 90°: T = 1.18034 × 2π√(L/g)", PL.state().T, 1.18034 * T0, 3e-4);
    PL.apply({ mode: "simple", L: 1, th0: 150, g: 9.8, lift: 0 });
    T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 700);
    T.check("pendulum 150°: T = 1.76220 × 2π√(L/g)", PL.state().T, 1.76220 * T0, 5e-4);
    T.check("pendulum 150°: energy kept", PL.energyDrift(), 0, 1e-7);
    // easy: Moon 1 m, 4.94 s
    PL.apply({ mode: "simple", L: 1, th0: 5, g: 1.62, lift: 0 });
    T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 700);
    T.check("Q easy: Moon T = 4.94 s", PL.state().T, 4.94, 0.006);
    // medium: L 0.99, lift up 4.9 → 1.63 s
    PL.apply({ mode: "simple", L: 0.99, th0: 5, g: 9.8, lift: 4.9 });
    T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 300);
    T.check("Q medium: lift T = 1.63 s", PL.state().T, 1.63, 0.006);
    // hard: rod 1.2 m, d = 0.35 m, T ≈ 1.67 s
    PL.apply({ mode: "rod", L: 1.2, d: 0.35, th0: 5, g: 9.8, lift: 0 });
    T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 300);
    T.check("Q hard: rod T_min = 1.67 s", PL.state().T, 1.6706, 0.006);
    T.check("rod formula 2π√(I/mgd)", PL.smallT(), TWO_PI * Math.sqrt((1.44 / 12 + 0.35 * 0.35) / (9.8 * 0.35)), 1e-6);
    // tries
    PL.apply({ mode: "simple", L: 1, th0: 10, g: 9.8, lift: 0 }); T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 300);
    PL.apply({ mode: "simple", L: 1, th0: 4, g: 9.8, lift: 0 }); T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 300);
    T.ok("try amp triggered", tried(tp, 0), "");
    PL.apply({ mode: "simple", L: 1, th0: 75, g: 9.8, lift: 0 }); T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 300);
    T.ok("try big triggered", tried(tp, 1), "");
    PL.apply({ mode: "simple", L: 1, th0: 10, g: 9.8, lift: 6 }); T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 200);
    T.ok("try lift triggered", tried(tp, 2), "");
    [0.2, 0.29, 0.45].forEach(function (d) {
      PL.apply({ mode: "rod", L: 1, d: d, th0: 5, g: 9.8, lift: 0 }); T.click(/^Release/); tp.sim.pause(); T.steps(tp.sim, 200);
    });
    T.ok("try rod triggered", tried(tp, 3), "");
  }

  /* ---------- damping & resonance ---------- */
  if (K.labs.some(function (l) { return l.id === "resonance"; })) {
    var tr = T.mount("resonance"), R = window.__lab_resonance;
    T.ok("resonance mounts", tr.sim && R, "");
    // free, underdamped: ω' and envelope
    R.apply({ mode: "free", m: 1, k: 100, b: 0.4, x0: 0.4 });
    T.click(/^Release/); tr.sim.pause(); T.steps(tr.sim, 400);
    var s = R.state();
    T.check("damped period 2π/√(ω0² − γ²)", s.T, TWO_PI / Math.sqrt(100 - 0.04), 1e-4);
    T.check("Q medium: decay rate b/2m from peaks", s.gammaMeas, 0.2, 1e-4);
    T.check("Q medium: half-life 3.47 s", Math.LN2 / s.gammaMeas, 3.466, 0.005);
    T.ok("try under triggered", tried(tr, 0), "");
    // easy: critical b = 20
    R.apply({ mode: "free", m: 1, k: 100, b: 20, x0: 0.4 });
    T.click(/^Release/); tr.sim.pause(); T.steps(tr.sim, 300);
    T.check("Q easy: critical b = 2√(km)", R.params().bc, 20, 1e-9);
    T.ok("critical: no overshoot", R.state().crossings === 0, R.state().crossings);
    T.check("critical x(t) = x0(1 + ω0 t)e^(−ω0 t) at 0.5 s", R.xAt(0.5), 0.4 * (1 + 5) * Math.exp(-5), 1e-6);
    T.ok("try critical triggered", tried(tr, 1), "");
    // driven from rest, hard question: b = 4, ω_d = 9.6 → A = 0.1276 m
    R.apply({ mode: "driven", m: 1, k: 100, b: 4, F0: 5, wd: 9.6, steady: false });
    T.click(/^Release/); tr.sim.pause(); T.steps(tr.sim, 900);
    s = R.state();
    T.check("Q hard: steady amplitude at 9.6 rad/s", s.Ameas, 5 / Math.sqrt(Math.pow(100 - 92.16, 2) + Math.pow(4 * 9.6, 2)), 2e-4);
    T.check("Q hard: peak frequency √(ω0² − b²/2m²)", R.params().wpeak, Math.sqrt(92), 1e-9);
    T.check("Q hard: peak amplitude", R.params().Apeak, 5 / (4 * Math.sqrt(96)), 1e-6);
    T.check("phase lag at 9.6 rad/s", s.dMeas, Math.atan2(38.4, 100 - 92.16) * 180 / Math.PI, 0.1);
    T.ok("try resonance triggered", tried(tr, 2), "");
    // resonance: ω_d = ω0 → δ = 90°, A = F0/(bω0)
    R.apply({ mode: "driven", m: 1, k: 100, b: 2, F0: 5, wd: 10, steady: false });
    T.click(/^Release/); tr.sim.pause(); T.steps(tr.sim, 1200);
    s = R.state();
    T.check("at ω0: A = F0/(bω0) = 0.25 m", s.Ameas, 0.25, 3e-4);
    T.check("at ω0: phase lag 90°", s.dMeas, 90, 0.1);
    T.ok("try phase triggered", tried(tr, 3), "");
    // far below and above resonance
    R.apply({ mode: "driven", m: 1, k: 100, b: 2, F0: 5, wd: 5, steady: true });
    T.click(/^Release/); tr.sim.pause(); T.steps(tr.sim, 300);
    T.check("ω_d = 5: A", R.state().Ameas, 5 / Math.sqrt(75 * 75 + 100), 1e-4);
    R.apply({ mode: "driven", m: 1, k: 100, b: 2, F0: 5, wd: 20, steady: true });
    T.click(/^Release/); tr.sim.pause(); T.steps(tr.sim, 300);
    T.check("ω_d = 20: A", R.state().Ameas, 5 / Math.sqrt(300 * 300 + 1600), 1e-4);
    T.check("ω_d = 20: phase lag", R.state().dMeas, 180 - Math.atan2(40, 300) * 180 / Math.PI, 0.1);
  }
  void done;
});
