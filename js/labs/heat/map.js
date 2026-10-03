/* Thermal properties: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    heat_temp:    { label: "Temperature change ΔT", lab: "expansion", why: "The cause of everything in this chapter: lengths, phases and heat flow all respond to it." },
    heat_linear:  { label: "Linear expansion ΔL = αLΔT", lab: "expansion", why: "Every length grows by the same fraction αΔT, holes and gaps included." },
    heat_areavol: { label: "β = 2α, γ = 3α", lab: "expansion", why: "Two or three lengths multiply, so areas and volumes grow two or three times as fast." },
    heat_bimetal: { label: "Bimetallic strip", lab: "expansion", why: "Two α's bonded together curl with R = d/(Δα ΔT), toward the lower-α metal on heating." },
    heat_stress:  { label: "Thermal stress σ = YαΔT", lab: "expansion", why: "Blocked expansion becomes strain αΔT, so the stress has no length in it." },
    heat_spec:    { label: "Specific heat Q = mcΔT", lab: "calorimetry", why: "How much heat it takes to change a body's temperature: the slope of the heating curve is P/mc." },
    heat_latent:  { label: "Latent heat Q = mL", lab: "calorimetry", why: "Heat that changes phase without changing temperature: the flat parts of the heating curve." },
    heat_mix:     { label: "Heat lost = heat gained", lab: "calorimetry", why: "In an insulated calorimeter energy only moves around, so the sums balance at one final temperature." },
    heat_curve:   { label: "Heating curve", lab: "calorimetry", why: "Under a steady heater the sloped parts are mcΔT and the flat parts are mL. Each plateau lasts mL/P." },
    heat_ice0:    { label: "Not all the ice melts", lab: "calorimetry", why: "If the warm water can't supply mL, the mixture stops at 0 °C with ice left over. Check before you solve." },
    heat_cond:    { label: "Conduction H = kAΔT/L", lab: "conduction", why: "Heat current through a slab, like electric current through a resistor." },
    heat_res:     { label: "Thermal resistance L/kA", lab: "conduction", why: "Series resistances add, parallel conductances add, and the junction temperature follows from H." },
    heat_steady:  { label: "Steady state", lab: "conduction", why: "Once nothing is warming up, the same heat current crosses every section in series." },
    heat_stefan:  { label: "Stefan–Boltzmann P = eσAT⁴", lab: "conduction", why: "Radiated power climbs as the fourth power of absolute temperature: double T, 16× the power." },
    heat_wien:    { label: "Wien's law λₘT = b", lab: "conduction", why: "Hotter bodies peak at shorter wavelengths: red-hot, then white-hot." },
    heat_newton:  { label: "Newton's law of cooling", lab: "conduction", why: "For small excess temperatures the cooling rate is k(T − T₀), so the excess decays exponentially." }
  },
  edges: [
    ["heat_temp", "heat_linear", "stretches by"], ["heat_linear", "heat_areavol", "squared, cubed gives"],
    ["heat_linear", "heat_bimetal", "unequal α bends"], ["heat_linear", "heat_stress", "if blocked becomes"],
    ["heat_stress", "normal", "walls push back with"],
    ["heat_spec", "heat_temp", "Q/mc gives"], ["heat_spec", "heat_mix", "fills in"], ["heat_latent", "heat_mix", "fills in"],
    ["heat_latent", "heat_ice0", "too big leaves"],
    ["heat_spec", "heat_curve", "sets the slopes of"], ["heat_latent", "heat_curve", "sets the plateaus of"], ["heat_mix", "heat_ice0", "checked first for"],
    ["heat_temp", "heat_cond", "drives"], ["heat_cond", "heat_res", "rewritten as"], ["heat_res", "heat_steady", "sets the current in"],
    ["heat_temp", "heat_stefan", "to the fourth power sets"], ["heat_temp", "heat_wien", "sets the peak in"],
    ["heat_stefan", "heat_newton", "for small ΔT becomes"]
  ],
  labs: {
    expansion: ["heat_temp", "heat_linear", "heat_areavol", "heat_bimetal", "heat_stress", "normal"],
    calorimetry: ["heat_temp", "heat_spec", "heat_latent", "heat_mix", "heat_curve", "heat_ice0"],
    conduction: ["heat_temp", "heat_cond", "heat_res", "heat_steady", "heat_stefan", "heat_wien", "heat_newton"]
  }
});
