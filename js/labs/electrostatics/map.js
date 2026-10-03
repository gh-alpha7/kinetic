/* Electrostatics: concept-map ideas for the coulomb, fieldlines and capacitors labs. */
Maps.add({
  nodes: {
    electrostatics_charge:   { label: "Electric charge q", lab: "coulomb", why: "Comes in two signs, is conserved and quantised. Everything in this chapter starts from where the charges sit." },
    electrostatics_coulomb:  { label: "Coulomb's law kq₁q₂/r²", lab: "coulomb", why: "The force between two point charges: along the line joining them, falling as 1/r²." },
    electrostatics_superpos: { label: "Superposition", lab: "coulomb", why: "Each pair acts as if the others weren't there; forces and fields add as vectors, potentials as numbers." },
    electrostatics_equil:    { label: "Balance point & stability", lab: "coulomb", why: "Where the pulls cancel, a third charge balances whatever its value, but whether it stays depends on its sign and direction." },
    electrostatics_field:    { label: "Electric field E = F/q", lab: "fieldlines", why: "Force per unit positive charge at a point. Multiply by any q to get the force on it." },
    electrostatics_lines:    { label: "Field lines & equipotentials", lab: "fieldlines", why: "Lines show E's direction and crowd where it's strong; equipotentials cross them at right angles." },
    electrostatics_potential:{ label: "Potential V = kq/r", lab: "fieldlines", why: "Work per unit charge to bring a charge in. A plain number, so it adds without arrows; E = 0 doesn't mean V = 0." },
    electrostatics_energy:   { label: "qV + ½mv² conserved", lab: "fieldlines", why: "A free charge trades potential energy for kinetic energy: fastest where qV is lowest." },
    electrostatics_gauss:    { label: "Gauss's law Φ = q_enc/ε₀", lab: "fieldlines", why: "Flux out of a closed surface depends only on the charge inside, never on the surface's shape." },
    electrostatics_cap:      { label: "Capacitance C = ε₀A/d", lab: "capacitors", why: "Charge stored per volt. Set by geometry alone: bigger plates, smaller gap." },
    electrostatics_dielec:   { label: "Dielectric slab", lab: "capacitors", why: "Bound charges cut the field inside by K; a slab of thickness t makes the gap act like d − t + t/K." },
    electrostatics_qv:       { label: "Q fixed or V fixed?", lab: "capacitors", why: "Battery on: V fixed, Q = CV follows C. Battery off: Q fixed, V = Q/C moves the other way." },
    electrostatics_capU:     { label: "Energy ½CV² = Q²/2C", lab: "capacitors", why: "Pick the form with the fixed quantity in it. The battery supplies VΔQ, twice the change in stored energy." },
    electrostatics_combo:    { label: "Series & parallel", lab: "capacitors", why: "Series: same Q, 1/C_eq = Σ1/C. Parallel: same V, C_eq = ΣC." }
  },
  edges: [
    ["electrostatics_charge", "electrostatics_coulomb", "obeys"],
    ["electrostatics_coulomb", "electrostatics_superpos", "adds by"],
    ["electrostatics_superpos", "force", "gives the electric part of"],
    ["electrostatics_superpos", "electrostatics_equil", "cancels at"],
    ["n2", "electrostatics_equil", "decides stability of"],
    ["electrostatics_coulomb", "electrostatics_field", "per unit charge is"],
    ["electrostatics_superpos", "electrostatics_field", "adds up"],
    ["electrostatics_field", "electrostatics_lines", "drawn as"],
    ["electrostatics_field", "electrostatics_potential", "integrates to"],
    ["electrostatics_potential", "electrostatics_lines", "drawn as equipotentials in"],
    ["electrostatics_field", "acc", "qE/m sets"],
    ["electrostatics_potential", "electrostatics_energy", "times q is the PE in"],
    ["electrostatics_energy", "vel", "sets the speed"],
    ["electrostatics_field", "electrostatics_gauss", "has its flux fixed by"],
    ["electrostatics_charge", "electrostatics_gauss", "enclosed, sets"],
    ["electrostatics_gauss", "electrostatics_cap", "gives E = σ/ε₀ for"],
    ["electrostatics_potential", "electrostatics_cap", "V = Ed defines"],
    ["electrostatics_dielec", "electrostatics_cap", "multiplies"],
    ["electrostatics_cap", "electrostatics_qv", "changes Q or V by"],
    ["electrostatics_qv", "electrostatics_capU", "picks the formula for"],
    ["electrostatics_cap", "electrostatics_combo", "combines in"]
  ],
  labs: {
    coulomb: ["electrostatics_charge", "electrostatics_coulomb", "electrostatics_superpos", "electrostatics_equil", "force", "n2"],
    fieldlines: ["electrostatics_field", "electrostatics_lines", "electrostatics_potential", "electrostatics_energy", "electrostatics_gauss", "electrostatics_coulomb", "acc"],
    capacitors: ["electrostatics_cap", "electrostatics_dielec", "electrostatics_qv", "electrostatics_capU", "electrostatics_combo", "electrostatics_gauss", "electrostatics_potential"]
  }
});
