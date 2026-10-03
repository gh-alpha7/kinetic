/* Dual nature: concept-map ideas for the photoelectric and matter-wave labs. */
Maps.add({
  nodes: {
    dual_photon:    { label: "Photon E = hf = hc/λ", lab: "photoelectric", why: "Light comes in packets. One photon's energy depends only on its frequency, never on brightness." },
    dual_work:      { label: "Work function φ", lab: "photoelectric", why: "The least energy an electron needs to escape the metal. Each metal has its own." },
    dual_threshold: { label: "Threshold f₀ = φ/h", lab: "photoelectric", why: "Below it no photon is strong enough, so no electrons come out however bright the light." },
    dual_einstein:  { label: "KE max = hf − φ", lab: "photoelectric", why: "Einstein's equation: one photon, one electron, energy conserved. The heart of every photoelectric question." },
    dual_stopping:  { label: "Stopping potential eV₀ = KE max", lab: "photoelectric", why: "The retarding voltage that turns back the fastest electron. Set by frequency, not intensity." },
    dual_intensity: { label: "Intensity → saturation current", lab: "photoelectric", why: "More photons per second free more electrons per second. Intensity changes the current, not the energy." },
    dual_hslope:    { label: "V₀–f slope = h/e", lab: "photoelectric", why: "A straight line for every metal, all parallel. The intercept on the f axis is the threshold." },
    dual_debroglie: { label: "de Broglie λ = h/p", lab: "debroglie", why: "Anything with momentum has a wavelength. Big momentum, tiny wavelength." },
    dual_accel:     { label: "λ = 1.227/√V nm", lab: "debroglie", why: "For an electron accelerated from rest through V volts: p = √(2meV). The most-used shortcut in the chapter." },
    dual_mass:      { label: "λ = h/√(2mK)", lab: "debroglie", why: "At the same kinetic energy, heavier means shorter λ; at the same voltage, charge matters too (alpha: 2e)." },
    dual_bragg:     { label: "Bragg 2d sinθ = nλ", lab: "debroglie", why: "Waves reflected from crystal planes add up only at angles where the path difference is a whole number of wavelengths." },
    dual_diffraction: { label: "Electron diffraction", lab: "debroglie", why: "Davisson and Germer: 54 V electrons off nickel peak at 50°, exactly where waves of λ = h/p would." }
  },
  edges: [
    ["dual_photon", "dual_einstein", "pays for"], ["dual_work", "dual_einstein", "is subtracted in"], ["dual_work", "dual_threshold", "sets"],
    ["dual_einstein", "dual_threshold", "KE = 0 at"], ["dual_einstein", "dual_stopping", "is measured by"], ["dual_stopping", "dual_hslope", "against f gives"],
    ["dual_photon", "dual_intensity", "counted per second as"], ["dual_photon", "dual_debroglie", "p = h/λ inspires"],
    ["vel", "dual_debroglie", "p = mv sets"], ["dual_debroglie", "dual_mass", "with p = √(2mK) gives"], ["dual_mass", "dual_accel", "for an electron, K = eV:"],
    ["dual_accel", "dual_diffraction", "is tested by"], ["dual_bragg", "dual_diffraction", "places the peak in"]
  ],
  labs: {
    photoelectric: ["dual_photon", "dual_work", "dual_threshold", "dual_einstein", "dual_stopping", "dual_intensity", "dual_hslope"],
    debroglie: ["dual_debroglie", "dual_accel", "dual_mass", "dual_bragg", "dual_diffraction", "dual_photon", "vel"]
  }
});
