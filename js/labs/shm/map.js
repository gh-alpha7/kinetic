/* Simple harmonic motion: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    shm_restoring: { label: "Restoring force F = −kx", lab: "springmass", why: "Any force that pulls back in proportion to displacement makes SHM. Spot it and you know the motion." },
    shm_omega:     { label: "ω = √(k/m), T = 2π/ω", lab: "springmass", why: "Stiffness speeds it up, mass slows it down. Amplitude never appears." },
    shm_phasor:    { label: "Reference circle", lab: "springmass", why: "A point going round a circle at ω casts a shadow that is the SHM. Phase φ is where it starts." },
    shm_phase:     { label: "x, v, a a quarter cycle apart", lab: "springmass", why: "v leads x by 90°, and a = −ω²x is always opposite to x." },
    shm_energy:    { label: "KE ⇄ PE, total ½kA²", lab: "springmass", why: "Energy swaps between the block and the spring; KE = PE at x = A/√2." },
    shm_combo:     { label: "Springs in series and parallel", lab: "springmass", why: "Parallel: k₁ + k₂. Series: 1/k = 1/k₁ + 1/k₂. Then use ω = √(k/m)." },
    shm_vertical:  { label: "Vertical spring: shifted centre", lab: "springmass", why: "Gravity moves equilibrium down by mg/k but leaves ω unchanged." },
    shm_pendulum:  { label: "Simple pendulum T = 2π√(L/g)", lab: "pendulum", why: "Gravity's component along the arc is the restoring force. No mass in the formula." },
    shm_smallangle:{ label: "Small angles: sin θ ≈ θ", lab: "pendulum", why: "Only then is the pendulum's restoring force proportional to θ. Big swings take longer." },
    shm_geff:      { label: "Effective g", lab: "pendulum", why: "In a lift accelerating up at a, g_eff = g + a. Planets and lifts both change T through g_eff." },
    shm_physical:  { label: "Physical pendulum T = 2π√(I/mgd)", lab: "pendulum", why: "A swinging rigid body: moment of inertia about the pivot replaces mL²." },
    shm_damping:   { label: "Damping: envelope e^(−bt/2m)", lab: "resonance", why: "A drag force −bv shrinks the amplitude by the same factor every swing." },
    shm_critical:  { label: "Critical damping b = 2√(km)", lab: "resonance", why: "The fastest return to rest without overshooting. More damping is slower, not faster." },
    shm_driven:    { label: "Driven oscillator, steady state", lab: "resonance", why: "After the transient dies, it moves at the driving frequency, not its own." },
    shm_resonance: { label: "Resonance curve A(ω_d)", lab: "resonance", why: "Amplitude peaks when driving near ω₀; less damping makes the peak taller and sharper." },
    shm_phaselag:  { label: "Phase lag δ", lab: "resonance", why: "The response lags the force by 0 to 180°, exactly 90° at ω_d = ω₀." }
  },
  edges: [
    ["force", "shm_restoring", "proportional to −x is a"],
    ["pos", "shm_restoring", "sets"],
    ["shm_restoring", "shm_omega", "with ΣF = ma fixes"],
    ["n2", "shm_omega", "turns −kx into a = −ω²x:"],
    ["shm_omega", "shm_phasor", "is the spin rate of"],
    ["shm_phasor", "shm_phase", "projects into"],
    ["shm_phase", "shm_energy", "trades"],
    ["shm_combo", "shm_omega", "sets the k in"],
    ["weight", "shm_vertical", "shifts the centre of"],
    ["shm_vertical", "shm_omega", "leaves unchanged"],
    ["weight", "shm_pendulum", "restores"],
    ["shm_smallangle", "shm_pendulum", "makes SHM of"],
    ["shm_restoring", "shm_smallangle", "needs"],
    ["frames", "shm_geff", "accelerating ones change"],
    ["shm_geff", "shm_pendulum", "sets T of"],
    ["shm_pendulum", "shm_physical", "generalises to"],
    ["vel", "shm_damping", "drag −bv causes"],
    ["shm_damping", "shm_energy", "drains"],
    ["shm_damping", "shm_critical", "too much gives"],
    ["shm_driven", "shm_resonance", "traces"],
    ["shm_omega", "shm_resonance", "places the peak of"],
    ["shm_damping", "shm_resonance", "flattens"],
    ["shm_driven", "shm_phaselag", "lags by"]
  ],
  labs: {
    springmass: ["shm_restoring", "shm_omega", "shm_phasor", "shm_phase", "shm_energy", "shm_combo", "shm_vertical"],
    pendulum: ["shm_pendulum", "shm_smallangle", "shm_geff", "shm_physical", "shm_restoring", "shm_omega"],
    resonance: ["shm_damping", "shm_critical", "shm_driven", "shm_resonance", "shm_phaselag", "shm_omega", "shm_energy"]
  }
});
