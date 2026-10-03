/* Work, energy & power: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    work_work:    { label: "Work W = F·s", lab: "workenergy", why: "A force does work only along the motion. Perpendicular forces, like the normal force on a floor, do none." },
    work_area:    { label: "Work = area under F–x", lab: "workenergy", why: "For a force that changes with position, add up F dx. Area below the axis is negative work." },
    work_ke:      { label: "Kinetic energy ½mv²", lab: "workenergy", why: "The energy of motion. It changes only when net work is done on the body." },
    work_thm:     { label: "Work–energy theorem", lab: "workenergy", why: "W_net = ΔK: Newton's second law added up along the path. Often the quickest way to a speed." },
    work_power:   { label: "Power P = Fv", lab: "workenergy", why: "How fast work is done. Same work, less time, more power." },
    work_spring:  { label: "Spring energy ½kx²", lab: "workenergy", why: "The area under kx. Stored when you stretch or squash a spring, either way." },
    work_pe:      { label: "Potential energy mgh", lab: "energy", why: "Gravity's work stored as height. Only the height difference matters, not the path." },
    work_cons:    { label: "Energy conservation", lab: "energy", why: "With only gravity and springs doing work, K + U stays constant. Count heat and it always does." },
    work_heat:    { label: "Friction makes heat", lab: "energy", why: "Friction's negative work −μNs turns mechanical energy into thermal energy: gone from K + U, not from the total." },
    work_loop:    { label: "Vertical loop: h ≥ 2.5R", lab: "energy", why: "At the top N ≥ 0 needs v² ≥ gR; energy then needs h ≥ 2.5R (2.7R for a rolling ball)." },
    work_mom:     { label: "Momentum p = mv", lab: "collisions", why: "Mass times velocity, a vector. Forces change it at the rate ΣF = dp/dt." },
    work_impulse: { label: "Impulse J = Δp", lab: "collisions", why: "Force × time, the area under F–t. A soft bump spreads the same impulse over a longer time." },
    work_pcons:   { label: "Momentum conservation", lab: "collisions", why: "Internal forces cancel in pairs, so with no outside push the total momentum never changes." },
    work_rest:    { label: "Coefficient of restitution e", lab: "collisions", why: "Separation speed = e × approach speed. e = 1 keeps KE; e below 1 loses ½μ(1 − e²)u²." },
    work_cm:      { label: "Centre-of-mass velocity", lab: "collisions", why: "v_cm = Σmv / Σm stays constant through any collision. Its KE can never be lost." },
    work_glance:  { label: "Glancing elastic hit: 90°", lab: "collisions", why: "Equal masses, elastic: momentum is a vector sum and energy is Pythagoras, so the paths split at 90°." }
  },
  edges: [
    ["force", "work_work", "moving its point does"], ["work_work", "work_area", "for a varying F is"],
    ["work_work", "work_thm", "summed over forces gives"], ["n2", "work_thm", "integrated over x gives"],
    ["work_thm", "work_ke", "changes"], ["vel", "work_ke", "squared sets"],
    ["work_work", "work_power", "per second is"], ["vel", "work_power", "times F gives"],
    ["work_area", "work_spring", "under kx gives"], ["weight", "work_pe", "does work stored as"],
    ["fric", "work_heat", "does negative work as"], ["normal", "work_heat", "sets the size of"],
    ["work_ke", "work_cons", "trades in"], ["work_pe", "work_cons", "trades in"], ["work_spring", "work_cons", "trades in"],
    ["work_heat", "work_cons", "is the missing share of"],
    ["work_cons", "work_loop", "gives v at the top for"], ["normal", "work_loop", "must stay ≥ 0 in"],
    ["vel", "work_mom", "times m gives"], ["force", "work_impulse", "over a time gives"], ["work_impulse", "work_mom", "changes"],
    ["system", "work_pcons", "internal forces cancel:"], ["work_mom", "work_pcons", "adds up in"],
    ["work_pcons", "work_cm", "keeps constant"], ["work_rest", "work_ke", "decides how much survives of"],
    ["work_pcons", "work_glance", "as a vector gives"], ["work_rest", "work_glance", "with e = 1 gives"], ["vecadd", "work_glance", "arrows add in"]
  ],
  labs: {
    workenergy: ["force", "work_work", "work_area", "work_thm", "work_ke", "work_power", "work_spring", "fric"],
    energy: ["weight", "work_pe", "work_spring", "work_ke", "work_cons", "work_heat", "work_loop", "normal"],
    collisions: ["force", "work_impulse", "work_mom", "work_pcons", "work_rest", "work_cm", "work_glance", "work_ke"]
  }
});
