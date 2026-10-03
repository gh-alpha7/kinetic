/* Atoms & nuclei: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    atoms_quant:   { label: "Quantised angular momentum", lab: "bohr", why: "Bohr's one new rule: mvr = nh/2π. Only certain orbits are allowed, and everything else follows from it." },
    atoms_orbit:   { label: "Orbit radius and speed", lab: "bohr", why: "Coulomb pull = mv²/r plus the quantum rule gives r = 0.529 n²/Z Å and v = 2.19 × 10⁶ Z/n m/s." },
    atoms_levels:  { label: "Energy levels Eₙ = −13.6 Z²/n²", lab: "bohr", why: "Bound means negative energy. KE = −E, PE = 2E, and the levels crowd together towards E = 0." },
    atoms_photon:  { label: "Photon from a jump: hν = ΔE", lab: "bohr", why: "An electron changes level only by emitting or absorbing exactly the energy difference, so atoms give lines." },
    atoms_series:  { label: "Spectral series & limits", lab: "bohr", why: "1/λ = RZ²(1/n₁² − 1/n₂²). Lyman (UV), Balmer (visible), Paschen (IR); ∞ → n₁ is the series limit." },
    atoms_ion:     { label: "Ionisation energy", lab: "bohr", why: "Lifting the electron from Eₙ to 0 costs 13.6 Z²/n² eV: 13.6 eV for hydrogen from the ground state." },
    atoms_lines:   { label: "Number of lines n(n−1)/2", lab: "bohr", why: "A sample in level n gives n(n−1)/2 lines; a single atom gives at most n − 1." },
    atoms_random:  { label: "Random decay, λ per second", lab: "decay", why: "Every nucleus has the same chance λ dt of decaying in the next instant, whatever its age." },
    atoms_law:     { label: "Decay law N = N₀e^(−λt)", lab: "decay", why: "dN/dt = −λN: the number that decay is proportional to the number left." },
    atoms_half:    { label: "Half-life & mean life", lab: "decay", why: "t½ = ln2/λ, τ = 1/λ = 1.44 t½. After n half-lives (½)ⁿ is left; at τ, 37%." },
    atoms_activity:{ label: "Activity A = λN", lab: "decay", why: "What a counter measures. It falls with the same half-life as N." },
    atoms_defect:  { label: "Mass defect → B = Δm c²", lab: "decay", why: "A nucleus is lighter than its parts. 1 u of missing mass is 931.5 MeV of binding energy." },
    atoms_bea:     { label: "Binding energy per nucleon", lab: "decay", why: "Peaks near iron (≈ 8.8 MeV). Moving towards the peak releases energy." },
    atoms_fission: { label: "Fission & fusion release energy", lab: "decay", why: "Splitting heavy or fusing light nuclei both raise total binding energy; the rise comes out as Q." }
  },
  edges: [
    ["atoms_quant", "atoms_orbit", "fixes"], ["force", "atoms_orbit", "as Coulomb pull = mv²/r, sets"],
    ["atoms_orbit", "atoms_levels", "sets"], ["atoms_levels", "atoms_photon", "differences give"],
    ["atoms_photon", "atoms_series", "grouped by n₁ into"], ["atoms_levels", "atoms_ion", "|E| is the"],
    ["atoms_levels", "atoms_lines", "pairs of levels give"],
    ["atoms_random", "atoms_law", "averages into"], ["atoms_law", "atoms_half", "defines"], ["atoms_law", "atoms_activity", "times λ gives"],
    ["atoms_defect", "atoms_bea", "divided by A gives"], ["atoms_bea", "atoms_fission", "peak at iron explains"]
  ],
  labs: {
    bohr: ["atoms_quant", "atoms_orbit", "atoms_levels", "atoms_photon", "atoms_series", "atoms_ion", "atoms_lines"],
    decay: ["atoms_random", "atoms_law", "atoms_half", "atoms_activity", "atoms_defect", "atoms_bea", "atoms_fission"]
  }
});
