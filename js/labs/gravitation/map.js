/* Gravitation: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    gravitation_law:      { label: "Newton's gravitation F = GMm/r²", lab: "orbits", why: "Every mass pulls every other, weakening as 1/r². Orbits, tides and your weight all come from this one rule." },
    gravitation_orbit:    { label: "Circular orbit v = √(GM/r)", lab: "orbits", why: "Gravity supplies the centripetal force mv²/r. Farther out is slower; the satellite's own mass cancels." },
    gravitation_kepler2:  { label: "Equal areas (Kepler 2)", lab: "orbits", why: "A pull aimed at the star has no torque, so angular momentum is conserved: r₁v₁ = r₂v₂ at perihelion and aphelion." },
    gravitation_kepler3:  { label: "T² ∝ a³ (Kepler 3)", lab: "orbits", why: "T² = 4π²a³/GM, with a the semi-major axis. The slope depends only on the central mass." },
    gravitation_potential:{ label: "Potential energy U = −GMm/r", lab: "escape", why: "Zero at infinity, most negative at the surface. Use it, not mgh, whenever the height is a fair fraction of R." },
    gravitation_bound:    { label: "Sign of E: bound or free", lab: "escape", why: "E = ½mv² − GMm/r. E < 0 always comes back (ellipse); E ≥ 0 escapes (parabola or hyperbola)." },
    gravitation_escape:   { label: "Escape speed √(2GM/R)", lab: "escape", why: "The launch speed that makes E = 0: 11.2 km/s for Earth, √2 times the orbital speed at the surface, any mass, any direction." },
    gravitation_energy:   { label: "Orbital & binding energy", lab: "escape", why: "In a circular orbit E = −GMm/2r = −KE = U/2. The binding energy GMm/2r is what it takes to set the satellite free." },
    gravitation_field:    { label: "Field g = GM/r²", lab: "gvariation", why: "The force per kilogram. At the surface it's g₀ = GM/R² = 9.8 m/s²." },
    gravitation_height:   { label: "g with height", lab: "gvariation", why: "g = g₀/(1 + h/R)², about g₀(1 − 2h/R) only while h ≪ R." },
    gravitation_depth:    { label: "g with depth", lab: "gvariation", why: "Inside a uniform planet only the inner mass pulls: g = g₀(1 − d/R), zero at the centre." },
    gravitation_tunnel:   { label: "Tunnel SHM, T = 84 min", lab: "gvariation", why: "A pull proportional to distance from the centre gives SHM with T = 2π√(R/g), for any straight chord." }
  },
  edges: [
    ["gravitation_law", "gravitation_field", "per kg is"],
    ["gravitation_field", "weight", "times m is"],
    ["gravitation_field", "gconst", "at the surface is"],
    ["gravitation_field", "gravitation_height", "falls as 1/r² giving"],
    ["gravitation_field", "gravitation_depth", "from inner mass only gives"],
    ["gravitation_depth", "gravitation_tunnel", "g ∝ r makes"],
    ["gravitation_law", "force", "is a"],
    ["gravitation_law", "gravitation_orbit", "supplies mv²/r for"],
    ["n2", "gravitation_orbit", "with a = v²/r gives"],
    ["gravitation_law", "gravitation_kepler2", "is central, so"],
    ["vel", "gravitation_kepler2", "r × v sets the rate in"],
    ["gravitation_orbit", "gravitation_kepler3", "with T = 2πr/v gives"],
    ["gravitation_law", "gravitation_potential", "integrates to"],
    ["gravitation_potential", "gravitation_bound", "plus KE decides"],
    ["gravitation_bound", "gravitation_escape", "E = 0 gives"],
    ["gravitation_orbit", "gravitation_escape", "× √2 is"],
    ["gravitation_orbit", "gravitation_energy", "sets KE in"],
    ["gravitation_potential", "gravitation_energy", "sets U in"],
    ["gravitation_bound", "gravitation_kepler3", "if E < 0, a = GMm/2|E| in"]
  ],
  labs: {
    orbits: ["gravitation_law", "gravitation_orbit", "gravitation_kepler2", "gravitation_kepler3", "gravitation_bound", "n2", "vel"],
    escape: ["gravitation_potential", "gravitation_bound", "gravitation_escape", "gravitation_energy", "gravitation_orbit", "gravitation_law"],
    gvariation: ["gravitation_law", "gravitation_field", "gravitation_height", "gravitation_depth", "gravitation_tunnel", "weight", "gconst"]
  }
});
