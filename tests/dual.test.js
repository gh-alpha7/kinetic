// Dual nature: photoelectric effect and matter waves against the textbook formulas.
// Constants used by both labs: h = 6.626e-34 J s, e = 1.602e-19 C, hc = 1240 eV nm, me = 9.109e-31 kg.
T.run(function () {
  try { localStorage.clear(); } catch (e) { /* ignore */ }
  var H = 6.626e-34, E = 1.602e-19, ME = 9.109e-31, MP = 1.673e-27, MA = 6.645e-27;
  function triesDone(labId) {
    var lab = K.labs.filter(function (l) { return l.id === labId; })[0];
    var lis = document.querySelectorAll("#app .tries li");
    var out = {};
    lab.tries.forEach(function (tr, i) { out[tr.id] = lis[i] && lis[i].classList.contains("done"); });
    return out;
  }

  /* ---------- photoelectric ---------- */
  var t = T.mount("photoelectric"), L = window.__lab_photoelectric, sim = t.sim;
  T.ok("photoelectric mounts with hook", !!L && !!sim);
  function measure() { L.measure(); var n = 0; while (L.sweeping() && n < 2000) { T.steps(sim, 10); n += 10; } return L.state().runs[L.state().runs.length - 1]; }

  // easy: Na, 400 nm -> 3.10 eV - 2.75 = 0.35 V
  L.apply({ metal: "Na", lam: 400, P: 2, V: 0 });
  T.check("photon energy 400 nm = 1240/400", L.state().s.E, 3.10, 1e-9);
  T.check("f at 400 nm = c/λ", L.state().s.f, 7.495e14, 0.002e14);
  var r = measure();
  T.check("easy: Na 400 nm V0 (sim sweep)", r.V0, 0.35, 0.002);
  T.ok("easy: readout shows 0.35 V", /0\.35 V/.test(T.text(".readouts")), T.text(".readouts"));
  T.check("Na threshold λ0 = 1240/2.75", L.state().s.lam0, 450.9, 0.1);
  T.check("Na threshold f0 = φ/h", L.state().s.f0, 2.75 * E / H, 1e11);
  L.setV(-0.175);
  T.check("retarding current (ensemble) at V0/2 = 0.75 Isat", L.state().I, 0.75 * L.state().s.Isat, 0.002);
  L.setV(2);
  T.check("saturation current at +2 V = 10 P/E μA", L.state().I, 10 * 2 / 3.1, 0.001);
  T.steps(sim, 120);
  T.ok("photons and electrons animate", L.state().photons > 0 && L.state().electrons > 0, JSON.stringify([L.state().photons, L.state().electrons]));

  // medium: Zn, 250 nm -> 0.66 V; Isat doubles with intensity
  L.apply({ metal: "Zn", lam: 250, P: 2, V: 0 });
  r = measure();
  T.check("medium: Zn 250 nm V0", r.V0, 0.66, 0.002);
  T.check("medium: Isat at 2 mW", r.Isat, 10 * 2 / 4.96, 0.001);
  L.setP(4);
  var r2 = measure();
  T.check("medium: V0 unchanged at 4 mW", r2.V0, 0.66, 0.002);
  T.check("medium: Isat doubles at 4 mW", r2.Isat, 2 * r.Isat, 0.001);
  T.steps(sim, 90);
  var d = triesDone("photoelectric");
  T.ok("try 'bright' triggered", d.bright);
  T.ok("try 'stop' triggered", d.stop);

  // hard: metal X at 250 nm and 350 nm
  L.apply({ metal: "X", lam: 250, P: 2, V: 0 });
  r = measure();
  T.check("hard: X 250 nm V0", r.V0, 1.76, 0.002);
  L.setLam(350); r = measure();
  T.check("hard: X 350 nm V0", r.V0, 1240 / 350 - 3.2, 0.002);
  var fit = L.state().fit;
  T.check("hard: fitted φ", fit.phi, 3.20, 0.002);
  T.check("hard: fitted λ0", fit.lam0, 387.5, 0.3);
  T.check("V0–f slope = h/e", fit.m, H / E, 0.01e-15);
  T.check("h from slope", fit.h, H, 0.01e-34);
  L.setLam(300); measure();
  T.ok("try 'planck' triggered", triesDone("photoelectric").planck);

  // below threshold: no current however bright
  L.apply({ metal: "Na", lam: 600, P: 4.5, V: 2 });
  T.steps(sim, 120);
  T.check("below threshold current", L.state().I, 0, 1e-12);
  T.ok("try 'dark' triggered", triesDone("photoelectric").dark);
  // Cs at 150 nm, the largest V0 in range
  L.apply({ metal: "Cs", lam: 150, P: 1, V: 0 });
  r = measure();
  T.check("Cs 150 nm V0 = 1240/150 - 2.14", r.V0, 1240 / 150 - 2.14, 0.002);

  if (window.__lab_debroglie === undefined && !K.labs.some(function (l) { return l.id === "debroglie"; })) return;

  /* ---------- matter waves ---------- */
  t = T.mount("debroglie"); var D = window.__lab_debroglie; sim = t.sim;
  T.ok("debroglie mounts with hook", !!D && !!sim);
  function lamOf(m, q, V) { return H / Math.sqrt(2 * m * q * V) * 1e9; }
  function fire() { D.fire(); var n = 0; while (D.flying() && n < 3000) { T.steps(sim, 10); n += 10; } return D.state().last; }
  function scan() { D.scan(); var n = 0; while (D.scanning() && n < 3000) { T.steps(sim, 10); n += 10; } return D.state().lastScan; }

  // easy: electron through 100 V
  D.apply({ mode: "gun", particle: "e", V: 100, compare: "V" });
  var f1 = fire();
  T.check("easy: electron 100 V λ (from simulated speed)", f1.lam, 0.1227, 0.00005);
  T.check("electron speed √(2eV/m)", f1.v, Math.sqrt(2 * E * 100 / ME), 1);
  T.check("1.227/√V shortcut at 100 V", lamOf(ME, E, 100), 0.1227, 0.0001);
  T.check("photon of same energy λ = 1240/100", D.state().s.lamPhoton, 12.4, 1e-9);
  T.ok("try 'heavy' not yet", !triesDone("debroglie").heavy);
  T.ok("easy: readouts show 0.123 nm and p in ×10⁻²⁴", /0.123 nm/.test(T.text(".readouts")) && /×10⁻²⁴/.test(T.text(".readouts")), T.text(".readouts"));
  T.ok("maths renders without errors", !/katex-error/.test(document.querySelector("#app .eqs").innerHTML));

  // medium: proton vs alpha at the same V
  D.apply({ mode: "gun", particle: "p", V: 100, compare: "V" });
  var fp = fire();
  T.check("proton 100 V λ", fp.lam, lamOf(MP, E, 100), 1e-7);
  D.apply({ mode: "gun", particle: "a", V: 100, compare: "V" });
  var fa = fire();
  T.check("alpha 100 V λ (charge 2e)", fa.lam, lamOf(MA, 2 * E, 100), 1e-7);
  T.check("medium: λp/λα ≈ 2√2", fp.lam / fa.lam, 2.818, 0.005);
  T.ok("try 'heavy' triggered", triesDone("debroglie").heavy);
  D.apply({ mode: "gun", particle: "a", V: 100, compare: "K" });
  T.check("alpha at same KE (100 eV)", D.state().s.lam, lamOf(MA, E, 100), 1e-7);

  // 0.1 nm try
  D.apply({ mode: "gun", particle: "e", V: 150, compare: "V" });
  fire();
  T.ok("try 'tenth' triggered at 150 V", triesDone("debroglie").tenth, D.state().s.lam);

  // Davisson–Germer: 54 V peak at 50°
  D.apply({ mode: "dg", particle: "e", V: 54 });
  var sc = scan();
  T.check("DG 54 V peak angle", sc.peak, 50, 0.1);
  T.check("DG measured λ = d sinφ", sc.lam, lamOf(ME, E, 54), 0.0005);
  T.check("λ at 54 V = 0.167 nm", lamOf(ME, E, 54), 0.1669, 0.0001);
  T.check("Bragg: 2d sin65° = λ(54 V)", 2 * D.state().d * Math.sin(65 * Math.PI / 180), lamOf(ME, E, 54), 0.0003);
  T.ok("try 'dg' triggered", triesDone("debroglie").dg);
  T.ok("DG readout shows 50.0° and 0.167 nm", /50.0°/.test(T.text(".readouts")) && /0.167 nm/.test(T.text(".readouts")), T.text(".readouts"));
  T.ok("DG maths renders", !/katex-error/.test(document.querySelector("#app .eqs").innerHTML));
  // hard: raise V until the peak is at 30°
  D.setV(127);
  sc = scan();
  T.check("hard: 127 V peak at 30°", sc.peak, 30, 0.3);
  T.check("hard: V for 30° = 54 (sin50/sin30)²", 54 * Math.pow(Math.sin(50 * Math.PI / 180) / 0.5, 2), 126.7, 0.1);
  T.ok("try 'shift' triggered", triesDone("debroglie").shift);
  // intensity at 50° vs V peaks at 54 V
  var best = 0, bestV = 0;
  for (var v = 30; v <= 90; v += 0.5) { var I = D.countsAt(50, v); if (I > best) { best = I; bestV = v; } }
  T.check("counts at 50° peak near 54 V", bestV, 54, 1);
});
