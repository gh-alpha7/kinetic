/* Rotational motion: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    rotation_torque:  { label: "Torque τ = F d", lab: "torque", why: "A force's turning effect: force times the perpendicular distance from the pivot to its line of action." },
    rotation_cg:      { label: "Centre of gravity", lab: "torque", why: "The one point where the whole weight seems to act. Its lever arm decides which way a body tips." },
    rotation_equil:   { label: "Equilibrium: ΣF = 0, Στ = 0", lab: "torque", why: "Both must hold. ΣF = 0 alone still lets a body start spinning; take torques about the point with the most unknowns." },
    rotation_inertia: { label: "Moment of inertia I", lab: "inertia", why: "Rotational mass: Σmr². Mass far from the axis counts most, so a ring beats a disc of the same mass." },
    rotation_paxis:   { label: "Parallel-axis theorem", lab: "inertia", why: "I = I_cm + Md² moves the axis. The smallest I of all is always about the centre of mass." },
    rotation_n2rot:   { label: "τ = Iα", lab: "inertia", why: "Newton's second law for turning. Pair it with ΣF = ma and the string or rolling condition a = αr." },
    rotation_angmom:  { label: "Angular momentum L = Iω", lab: "inertia", why: "With no outside torque L is fixed: pull mass in, I drops, ω rises, and kinetic energy goes up." },
    rotation_rke:     { label: "Rotational KE ½Iω²", lab: "inertia", why: "Spinning stores energy too. Whatever goes into rotation isn't there to speed up the fall." },
    rotation_rolling: { label: "Rolling: v = ωr", lab: "rolling", why: "No slipping means the contact point is momentarily at rest, which locks the spin to the speed." },
    rotation_rollacc: { label: "a = g sinθ / (1 + I/mr²)", lab: "rolling", why: "The bigger I/mr², the slower it rolls. Mass and radius cancel: only the shape matters." },
    rotation_rollfric:{ label: "Friction for rolling", lab: "rolling", why: "Static friction supplies the torque that spins it up and does no work. Too little μ and it slips." }
  },
  edges: [
    ["force", "rotation_torque", "with a lever arm gives"], ["weight", "rotation_cg", "acts at"], ["rotation_cg", "rotation_torque", "sets the lever arm of"],
    ["rotation_torque", "rotation_equil", "summing to zero gives"], ["force", "rotation_equil", "summing to zero gives"],
    ["rotation_torque", "rotation_n2rot", "drives"], ["rotation_inertia", "rotation_n2rot", "resists in"], ["n2", "rotation_n2rot", "has a twin:"],
    ["rotation_paxis", "rotation_inertia", "shifts the axis of"], ["tension", "rotation_torque", "on a wheel gives"], ["rotation_n2rot", "acc", "with a = αr sets"],
    ["rotation_torque", "rotation_angmom", "changes"], ["rotation_inertia", "rotation_angmom", "times ω gives"], ["rotation_inertia", "rotation_rke", "sets"],
    ["rotation_rolling", "rotation_rollacc", "ties v to ω in"], ["rotation_n2rot", "rotation_rollacc", "with friction's torque gives"],
    ["rotation_rke", "rotation_rollacc", "takes a share, slowing"], ["comp", "rotation_rollacc", "mg sinθ drives"],
    ["rotation_rollacc", "rotation_rollfric", "needs"], ["fric", "rotation_rollfric", "supplies"], ["normal", "rotation_rollfric", "caps it at μN in"]
  ],
  labs: {
    torque: ["force", "weight", "rotation_cg", "rotation_torque", "rotation_equil", "rotation_n2rot"],
    inertia: ["tension", "rotation_torque", "rotation_inertia", "rotation_paxis", "rotation_n2rot", "rotation_angmom", "rotation_rke", "acc"],
    rolling: ["comp", "fric", "normal", "rotation_rolling", "rotation_n2rot", "rotation_rke", "rotation_rollacc", "rotation_rollfric"]
  }
});
