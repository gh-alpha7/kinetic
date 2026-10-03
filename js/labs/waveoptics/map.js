/* Wave optics: the ideas behind Young's double slit, single-slit diffraction and polarisation. */
Maps.add({
  nodes: {
    waveoptics_coherent: { label: "Coherent sources", lab: "ydse", why: "Two sources with a fixed phase relation. Only then does the pattern stay still long enough to see." },
    waveoptics_path:     { label: "Path difference Δ", lab: "ydse", why: "Δ = nλ gives bright, Δ = (n + ½)λ gives dark. Every interference question starts here." },
    waveoptics_superpos: { label: "Amplitudes add, then square", lab: "ydse", why: "I = I₁ + I₂ + 2√(I₁I₂)cos φ: intensities never simply add for coherent light." },
    waveoptics_fringe:   { label: "Fringe width β = λD/d", lab: "ydse", why: "Evenly spaced stripes. Bigger λ or D spreads them, bigger d squeezes them." },
    waveoptics_film:     { label: "Film shift (μ−1)tD/d", lab: "ydse", why: "Extra optical path moves the whole pattern towards the covered slit, without changing β." },
    waveoptics_contrast: { label: "Unequal slits lose contrast", lab: "ydse", why: "I_max/I_min = ((√I₁+√I₂)/(√I₁−√I₂))². Dark fringes are only dark if the slits match." },
    waveoptics_huygens:  { label: "Huygens wavelets", lab: "diffraction", why: "Every point of a wavefront is a new source. Add them up and you get diffraction." },
    waveoptics_single:   { label: "Single-slit minima a sinθ = nλ", lab: "diffraction", why: "Pair up strips half a slit apart: they cancel when the edges differ by a whole λ." },
    waveoptics_central:  { label: "Central maximum 2λD/a", lab: "diffraction", why: "Twice as wide as the others, and wider for a narrower slit." },
    waveoptics_transverse: { label: "Light is transverse", lab: "diffraction", why: "E oscillates across the direction of travel, so it has a direction a filter can pick out." },
    waveoptics_malus:    { label: "Malus's law I₀cos²θ", lab: "diffraction", why: "A polariser keeps only the component along its axis; unpolarised light loses exactly half." },
    waveoptics_brewster: { label: "Brewster's angle tan θ_B = n", lab: "diffraction", why: "Reflected light is fully polarised, and reflected ⟂ refracted." }
  },
  edges: [
    ["waveoptics_coherent", "waveoptics_superpos", "lets you"],
    ["waveoptics_path", "waveoptics_superpos", "sets the phase in"],
    ["waveoptics_superpos", "waveoptics_fringe", "gives stripes spaced by"],
    ["waveoptics_superpos", "waveoptics_contrast", "with I₁ ≠ I₂ means"],
    ["waveoptics_path", "waveoptics_film", "plus (μ−1)t gives"],
    ["waveoptics_fringe", "waveoptics_film", "measures the shift in"],
    ["waveoptics_huygens", "waveoptics_coherent", "explains slits as"],
    ["waveoptics_huygens", "waveoptics_single", "added across a slit give"],
    ["waveoptics_path", "waveoptics_single", "across the slit sets"],
    ["waveoptics_single", "waveoptics_central", "first minima bound"],
    ["waveoptics_transverse", "waveoptics_malus", "explains"],
    ["waveoptics_transverse", "waveoptics_brewster", "explains"]
  ],
  labs: {
    ydse: ["waveoptics_coherent", "waveoptics_path", "waveoptics_superpos", "waveoptics_fringe", "waveoptics_film", "waveoptics_contrast", "waveoptics_huygens"],
    diffraction: ["waveoptics_huygens", "waveoptics_path", "waveoptics_single", "waveoptics_central", "waveoptics_transverse", "waveoptics_malus", "waveoptics_brewster"]
  }
});
