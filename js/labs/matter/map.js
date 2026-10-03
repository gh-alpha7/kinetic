/* Properties of matter: concept-map ideas for the elasticity, fluids and viscosity labs. */
Maps.add({
  nodes: {
    matter_stress:   { label: "Stress σ = F/A", lab: "elasticity", why: "Force per square metre of cross-section. A wire breaks at a fixed stress, so breaking load ∝ A." },
    matter_strain:   { label: "Strain ε = ΔL/L", lab: "elasticity", why: "Stretch per metre of length: a pure number. It's what the stress actually causes." },
    matter_young:    { label: "Young's modulus Y", lab: "elasticity", why: "Y = stress/strain in the Hooke region, a property of the material: ΔL = FL/AY." },
    matter_limits:   { label: "Proportional limit, yield, breaking", lab: "elasticity", why: "Past the yield point the wire keeps a permanent set; at the breaking stress it snaps." },
    matter_energy:   { label: "Elastic energy ½FΔL", lab: "elasticity", why: "The triangle under the F–ΔL line: ½ × stress × strain × volume." },
    matter_combo:    { label: "Wires in series & side by side", lab: "elasticity", why: "A wire is a spring with k = YA/L: in series the stretches add, side by side the stiffnesses add." },
    matter_pressure: { label: "Pressure p = p₀ + ρgh", lab: "fluids", why: "Depends only on depth in a connected liquid, never on the vessel's shape." },
    matter_pascal:   { label: "Pascal's law", lab: "fluids", why: "Extra pressure reaches every part of a closed liquid: F₂ = F₁A₂/A₁, paid for in distance." },
    matter_buoy:     { label: "Buoyancy B = ρ_f V_sub g", lab: "fluids", why: "Archimedes: the push up is the weight of liquid displaced, from the pressure difference top to bottom." },
    matter_appwt:    { label: "Apparent weight W − B", lab: "fluids", why: "What a spring balance reads under the liquid. The loss of weight gives the volume, then the density." },
    matter_float:    { label: "Floating: fraction under ρ_b/ρ_f", lab: "fluids", why: "A floater sinks just until buoyancy equals its weight." },
    matter_drag:     { label: "Stokes' drag 6πηrv", lab: "viscosity", why: "Viscous force on a small, slow sphere: grows with speed, radius and viscosity." },
    matter_terminal: { label: "Terminal velocity v_t", lab: "viscosity", why: "Weight = buoyancy + drag: v_t = 2r²(ρ − σ)g/9η, so v_t ∝ r²." },
    matter_tension:  { label: "Surface tension T", lab: "viscosity", why: "A liquid surface pulls along any line in it with T newtons per metre." },
    matter_capillary:{ label: "Capillary rise h = 2T cosθ/rρg", lab: "viscosity", why: "The rim's pull holds up the column: thinner tube, higher rise; mercury (θ > 90°) dips." }
  },
  edges: [
    ["force", "matter_stress", "spread over an area is"], ["weight", "matter_stress", "hung on a wire sets"],
    ["matter_stress", "matter_strain", "causes"], ["matter_young", "matter_strain", "sets how much"],
    ["matter_stress", "matter_limits", "too much passes"], ["matter_strain", "matter_energy", "stores"],
    ["matter_young", "matter_combo", "gives k = YA/L in"],
    ["weight", "matter_pressure", "of the liquid above makes"], ["matter_pressure", "matter_buoy", "differs top to bottom, giving"],
    ["matter_pressure", "matter_pascal", "is passed on by"], ["matter_buoy", "matter_appwt", "subtracts from W in"],
    ["weight", "matter_float", "balanced by B in"], ["matter_buoy", "matter_float", "balances weight in"],
    ["vel", "matter_drag", "sets the size of"], ["matter_drag", "matter_terminal", "grows until"],
    ["matter_buoy", "matter_terminal", "lowers"], ["n2", "matter_terminal", "a = 0 at"],
    ["matter_tension", "matter_capillary", "pulls the liquid up in"], ["weight", "matter_capillary", "limits"],
    ["matter_pressure", "matter_capillary", "explains the level inside"]
  ],
  labs: {
    elasticity: ["force", "matter_stress", "matter_strain", "matter_young", "matter_limits", "matter_energy", "matter_combo"],
    fluids: ["weight", "matter_pressure", "matter_pascal", "matter_buoy", "matter_appwt", "matter_float"],
    viscosity: ["vel", "matter_drag", "matter_terminal", "matter_buoy", "matter_tension", "matter_capillary", "n2"]
  }
});
