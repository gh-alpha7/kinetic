/* EMI & AC: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    emi_flux:     { label: "Magnetic flux Φ = BA cosθ", lab: "faraday", why: "How much field threads a loop. Change B, the area or the angle and you change Φ." },
    emi_faraday:  { label: "Faraday's law ε = −N dΦ/dt", lab: "faraday", why: "Any change of flux through a coil drives an emf, however the change is made." },
    emi_lenz:     { label: "Lenz's law", lab: "faraday", why: "The induced current opposes the change that caused it: the minus sign, and energy conservation in disguise." },
    emi_motional: { label: "Motional emf Blv", lab: "faraday", why: "A rod sweeping area lv each second cuts flux at Blv: the simplest way to make Φ change." },
    emi_brake:    { label: "Magnetic braking B²l²v/R", lab: "faraday", why: "The induced current feels a force against the motion, proportional to v, so speed decays exponentially." },
    emi_energy:   { label: "Work → heat I²R", lab: "faraday", why: "Kinetic energy lost plus work done comes out exactly as heat in the resistor." },
    emi_charge:   { label: "Charge Q = NΔΦ/R", lab: "faraday", why: "The charge that flows depends only on the change in flux, not on how fast it happens." },
    emi_self:     { label: "Self-inductance L", lab: "lcr", why: "A coil's own changing current changes its own flux, so it pushes back with ε = −L di/dt." },
    emi_rl:       { label: "RL growth and decay, τ = L/R", lab: "lcr", why: "An inductor won't let current jump: it rises as (E/R)(1 − e^(−t/τ)) and dies away as e^(−t/τ)." },
    emi_react:    { label: "Reactance X_L = ωL, X_C = 1/ωC", lab: "lcr", why: "AC 'resistance' of a coil grows with frequency; a capacitor's shrinks." },
    emi_phasor:   { label: "Phasors", lab: "lcr", why: "Rotating arrows: V_L leads the current by 90°, V_C lags by 90°, V_R is in phase. Add them as vectors." },
    emi_imp:      { label: "Impedance Z = √(R² + (X_L − X_C)²)", lab: "lcr", why: "Sets the current I = V/Z and the phase angle tanφ = (X_L − X_C)/R." },
    emi_res:      { label: "Resonance ω₀ = 1/√LC", lab: "lcr", why: "X_L = X_C, so Z = R and the current peaks. Q = ω₀L/R measures how sharp the peak is." },
    emi_power:    { label: "Power P = V I cosφ", lab: "lcr", why: "Only the resistor takes energy on average; L and C hand it back each cycle. cosφ = R/Z." }
  },
  edges: [
    ["emi_flux", "emi_faraday", "changing, drives"], ["emi_faraday", "emi_motional", "for a moving rod gives"], ["vel", "emi_motional", "sets"],
    ["emi_lenz", "emi_brake", "makes the force oppose v in"], ["emi_motional", "emi_brake", "drives the current behind"],
    ["emi_brake", "force", "adds to"], ["emi_brake", "emi_energy", "turns KE into"], ["emi_faraday", "emi_charge", "integrated gives"],
    ["emi_lenz", "emi_self", "explains the back-emf of"], ["emi_faraday", "emi_self", "for a coil's own current gives"],
    ["emi_self", "emi_rl", "slows current change in"], ["emi_self", "emi_react", "at frequency ω gives"],
    ["emi_react", "emi_phasor", "set the lengths of"], ["emi_phasor", "emi_imp", "add up to"], ["emi_imp", "emi_res", "is smallest at"],
    ["emi_imp", "emi_power", "sets cosφ in"], ["emi_power", "emi_energy", "is the rate of"]
  ],
  labs: {
    faraday: ["emi_flux", "emi_faraday", "emi_lenz", "emi_motional", "emi_brake", "emi_energy", "emi_charge", "vel"],
    lcr: ["emi_faraday", "emi_self", "emi_rl", "emi_react", "emi_phasor", "emi_imp", "emi_res", "emi_power"]
  }
});
