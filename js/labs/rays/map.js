/* Ray optics: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    rays_index:   { label: "Refractive index n = c/v", lab: "refraction", why: "How much a medium slows light. Everything about bending comes from it." },
    rays_reflect: { label: "Law of reflection", lab: "refraction", why: "Angle of reflection = angle of incidence, measured from the normal. The rule behind every mirror." },
    rays_snell:   { label: "Snell's law", lab: "refraction", why: "n₁ sinθ₁ = n₂ sinθ₂: light bends towards the normal entering a denser medium, away leaving it." },
    rays_tir:     { label: "Critical angle & TIR", lab: "refraction", why: "Denser to rarer beyond sinθc = n₂/n₁, nothing gets out. Fibres, diamonds and prisms that trap light." },
    rays_depth:   { label: "Apparent depth", lab: "refraction", why: "Real / apparent = n, looking straight down. Pools look shallower than they are." },
    rays_slab:    { label: "Lateral shift in a slab", lab: "refraction", why: "Light leaves a parallel slab parallel to how it entered, shifted by t sin(θ₁ − θ₂)/cosθ₂." },
    rays_sign:    { label: "Cartesian sign convention", lab: "lenses", why: "Distances from the pole or centre: along the light +, against −, up +. One formula then covers every case." },
    rays_mirror:  { label: "Mirror formula", lab: "lenses", why: "1/v + 1/u = 1/f with f = R/2. Concave mirrors have f < 0 in this convention." },
    rays_lens:    { label: "Lens formula", lab: "lenses", why: "1/v − 1/u = 1/f. Note the minus sign: the classic swap with the mirror formula." },
    rays_mag:     { label: "Magnification & image nature", lab: "lenses", why: "m = v/u for lenses, −v/u for mirrors. Its sign says upright or inverted, its size bigger or smaller." },
    rays_maker:   { label: "Lens maker's formula", lab: "lenses", why: "1/f = (n − 1)(1/R₁ − 1/R₂): the focal length comes from the glass and the shape of its faces." },
    rays_power:   { label: "Power & lenses in contact", lab: "lenses", why: "P = 1/f in dioptres. Thin lenses in contact simply add their powers." },
    rays_prism:   { label: "Deviation by a prism", lab: "prism", why: "δ = i + e − A, with r₁ + r₂ = A inside. Both faces bend the light towards the base." },
    rays_mindev:  { label: "Minimum deviation", lab: "prism", why: "Symmetric passage, i = e. Gives n = sin((A + δm)/2) / sin(A/2), the standard way to measure n." },
    rays_thin:    { label: "Thin prism δ = (n − 1)A", lab: "prism", why: "Small angles make the prism linear: the deviation doesn't depend on the angle of incidence." },
    rays_disp:    { label: "Dispersion", lab: "prism", why: "n depends on wavelength (violet more than red), so white light fans out into a spectrum." }
  },
  edges: [
    ["vel", "rays_index", "ratio c/v gives"],
    ["rays_index", "rays_snell", "sets the bending in"],
    ["rays_snell", "rays_tir", "fails beyond θc:"], ["rays_snell", "rays_depth", "traced back gives"], ["rays_snell", "rays_slab", "twice gives"],
    ["rays_reflect", "rays_mirror", "on a curved surface gives"], ["rays_reflect", "rays_tir", "takes all the light in"],
    ["rays_sign", "rays_mirror", "signs u, v, f in"], ["rays_sign", "rays_lens", "signs u, v, f in"],
    ["rays_snell", "rays_maker", "at two curved faces gives"], ["rays_maker", "rays_lens", "supplies f for"],
    ["rays_mirror", "rays_mag", "gives v for"], ["rays_lens", "rays_mag", "gives v for"], ["rays_lens", "rays_power", "adds up as"],
    ["rays_snell", "rays_prism", "at two faces gives"], ["rays_prism", "rays_mindev", "is least at"], ["rays_prism", "rays_thin", "for small A becomes"],
    ["rays_tir", "rays_prism", "can block light in"], ["rays_index", "rays_disp", "varies with λ in"], ["rays_disp", "rays_prism", "gives each colour its own"]
  ],
  labs: {
    refraction: ["rays_index", "rays_reflect", "rays_snell", "rays_tir", "rays_depth", "rays_slab"],
    lenses: ["rays_reflect", "rays_sign", "rays_mirror", "rays_lens", "rays_mag", "rays_maker", "rays_power"],
    prism: ["rays_index", "rays_snell", "rays_prism", "rays_mindev", "rays_thin", "rays_disp", "rays_tir"]
  }
});
