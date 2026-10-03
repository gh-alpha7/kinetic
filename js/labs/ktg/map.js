/* Kinetic theory: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    ktg_hits:    { label: "Molecules hit the walls", lab: "gasbox", why: "Each bounce flips v⊥ and hands the wall 2mv⊥ of momentum. Pressure is nothing more than that, added up." },
    ktg_press:   { label: "Pressure P = ⅓ρ⟨v²⟩", lab: "gasbox", why: "Momentum per second per area of wall. Averaging over the molecules gives PV = ⅓Nm⟨v²⟩ (PA = ½Nm⟨v²⟩ in a flat 2D box)." },
    ktg_temp:    { label: "Temperature = mean KE", lab: "gasbox", why: "⟨½mv²⟩ = ³⁄₂kT per molecule in 3D. Equal temperature means equal mean KE, not equal speed." },
    ktg_gaslaw:  { label: "Ideal gas law PV = nRT", lab: "gasbox", why: "Kinetic theory plus T as mean KE. Boyle, Charles and Gay-Lussac are three slices of this one equation." },
    ktg_real:    { label: "Real molecules take up room", lab: "gasbox", why: "Finite size pushes P above NkT/V, the b term of van der Waals. Small when the gas is dilute." },
    ktg_mb:      { label: "Maxwell–Boltzmann distribution", lab: "speeds", why: "Collisions share energy until speeds spread as f(v) ∝ v²e^(−mv²/2kT) in 3D. Hotter or lighter: wider and faster." },
    ktg_speeds:  { label: "v_mp < v_avg < v_rms", lab: "speeds", why: "√(2RT/M) : √(8RT/πM) : √(3RT/M) = 1 : 1.13 : 1.22. All scale as √(T/M)." },
    ktg_equip:   { label: "Equipartition, ½kT per term", lab: "speeds", why: "Every quadratic energy term gets ½kT on average: f = 3 for monatomic, 5 for diatomic gases." },
    ktg_gamma:   { label: "C_v = f R/2, γ = 1 + 2/f", lab: "speeds", why: "Count the degrees of freedom and you have the heat capacities: γ = 5/3 monatomic, 7/5 diatomic." }
  },
  edges: [
    ["vel", "ktg_hits", "sets the momentum of"], ["force", "ktg_press", "per unit area is"], ["n2", "ktg_hits", "F = Δp/Δt turns into a force"],
    ["ktg_hits", "ktg_press", "add up to"], ["ktg_press", "ktg_gaslaw", "with T = mean KE gives"], ["ktg_temp", "ktg_gaslaw", "gives"],
    ["ktg_gaslaw", "ktg_real", "corrected by"], ["ktg_temp", "ktg_mb", "sets the width of"], ["ktg_mb", "ktg_speeds", "has three typical"],
    ["ktg_temp", "ktg_speeds", "√T in"], ["ktg_equip", "ktg_temp", "½kT per direction defines"], ["ktg_equip", "ktg_gamma", "counts f for"]
  ],
  labs: {
    gasbox: ["ktg_hits", "ktg_press", "ktg_temp", "ktg_gaslaw", "ktg_real", "vel", "force", "n2"],
    speeds: ["ktg_mb", "ktg_speeds", "ktg_equip", "ktg_gamma", "ktg_temp", "vel"]
  }
});
