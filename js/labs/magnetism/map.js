/* Magnetism: concept map. Moving charges feel a sideways force; currents make the fields that push them. */
Maps.add({
  nodes: {
    magnetism_lorentz:   { label: "Magnetic force F = qv × B", lab: "lorentz", why: "Only moving charges feel it, and always at 90° to v. Reverse q, v or B and it flips." },
    magnetism_nowork:    { label: "Magnetic force does no work", lab: "lorentz", why: "F ⊥ v, so the speed and kinetic energy never change; only the direction does." },
    magnetism_circle:    { label: "Circle: r = mv/qB", lab: "lorentz", why: "A sideways force of fixed size is a centripetal force: qvB = mv²/r." },
    magnetism_period:    { label: "Period T = 2πm/qB", lab: "lorentz", why: "Faster charges take bigger circles in the same time. No v in the period." },
    magnetism_helix:     { label: "Helix and pitch", lab: "lorentz", why: "The part of v along B is untouched, so the circle drifts: pitch = v cosθ · T." },
    magnetism_selector:  { label: "Velocity selector v = E/B", lab: "lorentz", why: "Crossed E and B cancel for one speed, whatever the charge or mass." },
    magnetism_cyclotron: { label: "Cyclotron", lab: "lorentz", why: "One AC frequency qB/2πm stays in step at every speed; KE max = q²B²R²/2m." },
    magnetism_bs:        { label: "Biot–Savart law", lab: "biotsavart", why: "Each bit of current adds dB = (μ₀/4π) I dl sinθ / r². Add the bits for any shape." },
    magnetism_wire:      { label: "Long wire B = μ₀I/2πr", lab: "biotsavart", why: "Circles round the wire, falling as 1/r. Right-hand grip gives the direction." },
    magnetism_loop:      { label: "Loop centre B = μ₀I/2R", lab: "biotsavart", why: "Every piece of the loop pushes the field the same way through the middle." },
    magnetism_solenoid:  { label: "Solenoid B = μ₀nI", lab: "biotsavart", why: "Uniform inside, nearly zero outside, half the value at an end." },
    magnetism_wires:     { label: "Parallel wires: μ₀I₁I₂/2πd", lab: "biotsavart", why: "Each wire sits in the other's field. Same direction attracts, opposite repels." },
    magnetism_ampere:    { label: "Ampère's law ∮B·dl = μ₀I", lab: "biotsavart", why: "Only the current threading the loop counts. With symmetry it gives B in one line." }
  },
  edges: [
    ["vel", "magnetism_lorentz", "sets"],
    ["magnetism_lorentz", "magnetism_nowork", "is ⊥ v, so"],
    ["n2", "magnetism_circle", "with F = mv²/r gives"],
    ["magnetism_nowork", "magnetism_circle", "keeps speed fixed in"],
    ["magnetism_circle", "magnetism_period", "gives"],
    ["magnetism_period", "magnetism_helix", "with v along B gives"],
    ["indep", "magnetism_helix", "splits v into"],
    ["magnetism_lorentz", "magnetism_selector", "balanced by qE in"],
    ["magnetism_period", "magnetism_cyclotron", "speed-free, so works in"],
    ["magnetism_bs", "magnetism_wire", "summed along a line gives"],
    ["magnetism_bs", "magnetism_loop", "summed round a ring gives"],
    ["magnetism_loop", "magnetism_solenoid", "stacked gives"],
    ["magnetism_wire", "magnetism_wires", "acting on a second wire gives"],
    ["magnetism_lorentz", "magnetism_wires", "on each charge gives"],
    ["magnetism_wire", "magnetism_ampere", "generalises to"],
    ["magnetism_ampere", "magnetism_solenoid", "quickly gives"],
    ["magnetism_wire", "magnetism_lorentz", "supplies the B in"]
  ],
  labs: {
    lorentz: ["magnetism_lorentz", "magnetism_nowork", "magnetism_circle", "magnetism_period", "magnetism_helix", "magnetism_selector", "magnetism_cyclotron", "n2"],
    biotsavart: ["magnetism_bs", "magnetism_wire", "magnetism_loop", "magnetism_solenoid", "magnetism_wires", "magnetism_ampere", "magnetism_lorentz"]
  }
});
