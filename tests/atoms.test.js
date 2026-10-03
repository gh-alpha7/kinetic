// Atoms & nuclei: Bohr model against r = 0.529 n²/Z, E = −13.6 Z²/n², Rydberg; decay against N₀e^(−λt) and the mass-defect energies.
T.run(function () {
  try { Object.keys(localStorage).forEach(function (k) { if (/kinetic:tries:(bohr|decay)/.test(k)) localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
  function doneTries(ids) {
    var lis = [].slice.call(document.querySelectorAll("#app .tries li"));
    return lis.map(function (li, i) { return li.classList.contains("done") ? ids[i] : null; }).filter(Boolean);
  }
  function readout(label) {
    var r = [].slice.call(document.querySelectorAll("#app .readout")).filter(function (n) { return n.querySelector("span").textContent === label; })[0];
    return r ? r.querySelector("b").textContent + " | " + r.querySelector("small").textContent : null;
  }

  /* ================= Bohr ================= */
  var t = T.mount("bohr"), B = window.__lab_bohr, sim = B.sim;
  T.ok("bohr mounts with its hook", !!B && !!sim);
  var R_SI = 1.097e7;                          // textbook Rydberg constant, m⁻¹
  function lamTextbook(n2, n1, Z) { return 1e9 / (R_SI * Z * Z * (1 / (n1 * n1) - 1 / (n2 * n2))); }
  // radii, energies, speeds vs the formulas, for each Z
  [1, 2, 3].forEach(function (Z) {
    T.check("r_2 (Z=" + Z + ") Å", B.rn(2, Z), 0.529 * 4 / Z, 1e-9);
    T.check("E_3 (Z=" + Z + ") eV", B.En(3, Z), -13.6 * Z * Z / 9, 1e-9);
    T.check("v_1 (Z=" + Z + ") m/s", B.vn(1, Z), 2.19e6 * Z, 1);
    // every line among n ≤ 6: the photon's λ (from ΔE) prints the same 3 s.f. as the textbook Rydberg formula
    var bad = [];
    for (var a = 2; a <= 6; a++) for (var b = 1; b < a; b++) {
      var l1 = B.lamFromEnergy(a, b, Z), l2 = lamTextbook(a, b, Z);
      if (Math.abs(l1 - l2) / l2 > 2e-4) bad.push(a + "-" + b + ": " + l1 + " vs " + l2);
    }
    T.ok("all 15 lines match Rydberg within 0.02% (Z=" + Z + ")", !bad.length, bad.join("; "));
  });
  T.ok("H-alpha prints 656 nm", B.sig3(B.lamFromEnergy(3, 2, 1)) === "656" && B.sig3(lamTextbook(3, 2, 1)) === "656");
  T.ok("Lyman limit H prints 91.2 nm", B.sig3(1e9 / R_SI) === "91.2", B.sig3(1e9 / R_SI));

  // excite H to 3, step down one level at a time: 3 → 2 then 2 → 1
  B.setZ(1); B.setWay("step"); B.excite(3);
  sim.pause(); T.steps(sim, 30);
  T.check("absorbed photon 1 → 3 (eV)", B.state().absorbed.dE, 13.6 * (1 - 1 / 9), 1e-9);
  T.check("electron now in n = 3", B.state().n, 3, 0);
  T.steps(sim, 50);
  var ph = B.state().last;
  T.ok("first photon is 3 → 2", ph && ph.n2 === 3 && ph.n1 === 2, ph && ph.n2 + "-" + ph.n1);
  T.check("3 → 2 wavelength (nm)", ph.lam, 656.3, 0.15);
  T.ok("readout shows 656 nm", /^656 nm/.test(readout("last photon emitted")), readout("last photon emitted"));
  T.steps(sim, 50);
  T.ok("then 2 → 1 (Lyman alpha 122 nm)", B.state().last.n1 === 1 && B.sig3(B.state().last.lam) === "122", B.state().last.lam);
  T.check("energy readout in ground state", parseFloat(readout("energy Eₙ")), -13.6, 1e-9);
  T.steps(sim, 60);
  T.ok("clock stops back in the ground state", !sim.running);

  // easy practice: ionise Li²⁺ from n = 1
  B.apply({ Z: 3, ionise: true });
  T.check("easy: Li²⁺ ionisation energy (eV)", B.state().ionE.E, 122.4, 0.05);
  T.ok("easy: readout shows 122.40 eV", /^122\.40 eV/.test(readout("ionisation energy")), readout("ionisation energy"));

  // medium practice: H to n = 5, random cascades until no new lines: 10 lines, 3 Balmer
  B.apply({ Z: 1, n: 5, way: "random" });
  sim.pause();
  for (var run = 0; run < 60; run++) {
    T.steps(sim, 300);
    if (B.state().n === 1 && !B.state().absorb) B.excite(5);
    sim.pause();
  }
  var seen = Object.keys(B.state().seen).map(function (k) { return B.state().seen[k]; });
  T.check("medium: distinct lines from n = 5", seen.length, 10, 0);
  T.check("medium: visible (380–750 nm) lines", seen.filter(function (p) { return p.lam >= 380 && p.lam <= 750; }).length, 3, 0);
  T.ok("medium: lines readout 10 of 10", /^10 of 10/.test(readout("lines seen")), readout("lines seen"));

  // hard practice: He⁺ to n = 4, straight down
  B.apply({ Z: 2, n: 4, way: "direct" });
  sim.pause(); T.steps(sim, 30);
  T.check("hard: absorbed energy (eV)", B.state().absorbed.dE, 51.0, 0.005);
  T.steps(sim, 50);
  T.check("hard: shortest wavelength 4 → 1 (nm)", B.state().last.lam, 1240 / 51.0, 0.05);
  T.ok("hard: prints 24.3 nm", B.sig3(B.state().last.lam) === "24.3");
  T.ok("hard: 6 lines possible", /of 6/.test(readout("lines seen")), readout("lines seen"));

  // tries
  var bIds = t.lab.tries.map(function (x) { return x.id; });
  B.apply({ Z: 1, n: 3, way: "step" }); sim.pause(); T.steps(sim, 200);            // 3 → 2 is visible
  B.apply({ Z: 1, n: 4, way: "random" }); sim.pause();
  for (var r2 = 0; r2 < 40; r2++) { T.steps(sim, 300); if (B.state().n === 1) B.excite(4); sim.pause(); }
  B.apply({ Z: 2, ionise: true }); sim.pause();
  B.apply({ Z: 2, n: 4, way: "step" }); sim.pause(); T.steps(sim, 30); B.excite(2); sim.pause(); T.steps(sim, 10);   // He⁺ 4 → 2 = H 2 → 1
  T.ok("bohr: every try can be triggered", doneTries(bIds).length === 4, doneTries(bIds).join(","));
  T.ok("bohr: graphs and maths render", document.querySelectorAll("#app .graphs canvas").length === 3 && document.querySelectorAll("#app .eq .katex").length >= 4);

  /* ================= Decay ================= */
  t = T.mount("decay");
  var D = window.__lab_decay; sim = D.sim;
  T.ok("decay mounts with its hook", !!D && !!sim);
  var LN2 = Math.LN2;
  T.check("Rn-222 λ (per day)", D.lam(), LN2 / 3.82, 1e-12);
  T.steps(sim, 120);
  T.check("model time at one half-life (d)", D.tModel(), 3.82, 1e-9);
  T.check("formula N at t½", D.stats().Nf, 800, 1e-6);
  T.check("simulated N at t½ (1600, seed 1) within 3σ = 60", D.state().N, 800, 60);
  T.ok("readout N shows formula ± scatter", /formula 800 ± 20/.test(readout("nuclei left N")), readout("nuclei left N"));
  // reproducible: same seed, same run
  var a1 = D.state().N; D.reset(); T.steps(sim, 120);
  T.check("same seed replays exactly", D.state().N, a1, 0);
  // unbiased: mean of 10 seeds at t½ within 3σ/√10
  var sum = 0, sumT = 0, sumA = 0;
  for (var s = 1; s <= 10; s++) {
    D.setSeed(100 + s); T.steps(sim, 120); sum += D.state().N;
    sumA += D.state().bins[0][2];
  }
  T.check("mean N at t½ over 10 seeds (± 19)", sum / 10, 800, 19);
  // activity: first bin (0 to t½/4) counts N₀(1 − 2^(−1/4)) decays over 0.955 d
  var w = 3.82 / 4, aExp = 1600 * (1 - Math.pow(2, -0.25)) / w;
  T.check("mean activity in first bin (per d), ± 3σ/√10", sumA / 10, aExp, 3 * Math.sqrt(1600 * 0.159 * 0.841) / w / Math.sqrt(10));
  T.check("activity formula λN₀ (per d)", LN2 / 3.82 * 1600, 290.3, 0.1);
  // ln N is a straight line with slope −λ: fit the run
  D.setSeed(1); T.steps(sim, 480);
  var rec = D.state().rec.filter(function (p) { return p[1] > 0; }), n = rec.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
  rec.forEach(function (p) { var y = Math.log(p[1]); sx += p[0]; sy += y; sxx += p[0] * p[0]; sxy += p[0] * y; });
  var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  T.check("fitted slope of ln N vs t ≈ −λ (±5%)", slope, -LN2 / 3.82, 0.05 * LN2 / 3.82);
  T.steps(sim, 240);
  T.ok("run stops after 6 half-lives", !sim.running && D.state().done && Math.abs(D.tModel() - 6 * 3.82) < 1e-6, D.tModel());
  var nEnd = D.state().N; T.steps(sim, 60);
  T.check("no decays after the run ends", D.state().N, nEnd, 0);

  // easy practice: I-131 after 24 d
  D.apply({ iso: "i131", N0: 1600, seed: 3 }); T.steps(sim, 360);
  T.check("easy: t = 3 half-lives (d)", D.tModel(), 24.06, 1e-9);
  T.check("easy: N after 24 d ≈ 1600/8 (± 3σ = 40)", D.state().N, 200, 40);
  // medium practice: t½ = 5 s, mean life 7.21 s, 1/16 left at 20 s
  D.apply({ iso: "custom", half: 5, N0: 1600, seed: 2 });
  T.check("medium: τ = 5/ln2 (s)", 1 / D.lam(), 7.213, 0.001);
  T.ok("medium: readout τ = 7.21 s", /τ = 1\/λ = 7\.21 s/.test(readout("decay constant λ")), readout("decay constant λ"));
  T.steps(sim, 480);
  T.check("medium: t = 20 s", D.tModel(), 20, 1e-9);
  T.check("medium: N at 20 s ≈ 100 (± 3σ = 30)", D.state().N, 100, 30);
  // hard practice: D + T fusion
  D.apply({ reaction: "fusion", sel: "He-4" });
  var q = D.reactionQ("fusion");
  T.check("hard: Q from masses (MeV)", q.Q, 17.59, 0.01);
  T.check("hard: B/A ²H", D.nuc("H-2").BA, 1.112, 0.0006);
  T.check("hard: B/A ³H", D.nuc("H-3").BA, 2.827, 0.0006);
  T.check("hard: B/A ⁴He", D.nuc("He-4").BA, 7.074, 0.0006);
  T.check("hard: Q from B/A = 4(7.074) − 2(1.112) − 3(2.827)", 4 * D.nuc("He-4").BA - 2 * D.nuc("H-2").BA - 3 * D.nuc("H-3").BA, q.Q, 1e-6);
  T.ok("hard: readout Q = 17.6 MeV", /^17\.6 MeV/.test(readout("energy released Q")), readout("energy released Q"));
  T.check("fission Q, U-235 → Ba-141 + Kr-92 + 3n (MeV)", D.reactionQ("fission").Q, 173.3, 0.1);
  T.check("B/A Fe-56", D.nuc("Fe-56").BA, 8.790, 0.001);
  T.check("B/A U-238", D.nuc("U-238").BA, 7.570, 0.001);
  T.ok("Ni-62 is the most tightly bound in the table", D.nuc("Ni-62").BA > D.nuc("Fe-56").BA);
  var best = 0, bestA = 0;
  for (var A = 10; A <= 240; A++) { var v = D.semf(A); if (v > best) { best = v; bestA = A; } }
  T.ok("semi-empirical curve peaks near A ≈ 50–70 at ≈ 8.8 MeV", bestA >= 45 && bestA <= 75 && Math.abs(best - 8.8) < 0.25, bestA + " / " + best);
  T.check("He-4 binding energy (MeV)", D.nuc("He-4").B, 28.30, 0.005);

  // tries
  var dIds = t.lab.tries.map(function (x) { return x.id; });
  D.apply({ iso: "rn222", N0: 100, seed: 1, reaction: "none" }); T.steps(sim, 120);
  D.setSeed(2); T.steps(sim, 120);
  D.apply({ N0: 1600, seed: 1 }); T.steps(sim, 360);
  T.ok("smooth run stayed within 3%", D.state().maxDev <= 0.03, D.state().maxDev);
  D.reset(); T.click(/^Play/); T.steps(sim, 173); T.click(/^Pause/);
  D.select("Ni-62", true);
  T.ok("decay: every try can be triggered", doneTries(dIds).length === 4, doneTries(dIds).join(","));
  // follow a nucleus until it decays
  D.reset(); D.follow(0); sim.pause(); T.steps(sim, 700);
  T.ok("a followed nucleus reports its lifetime", D.lives.length >= 1 || D.state().alive[0] === 1, D.lives.join(","));
  T.ok("decay: graphs and maths render", document.querySelectorAll("#app .graphs canvas").length === 3 && document.querySelectorAll("#app .eq .katex").length >= 4);
});
