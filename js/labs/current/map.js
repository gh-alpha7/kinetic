/* Current electricity: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    current_ohm:     { label: "Ohm's law V = IR", lab: "circuits", why: "The rule for one resistor: the current through it is proportional to the voltage across it." },
    current_kcl:     { label: "Junction rule (KCL)", lab: "circuits", why: "Charge doesn't pile up in a wire: current in = current out at every junction." },
    current_kvl:     { label: "Loop rule (KVL)", lab: "circuits", why: "Potential is like height: round any closed loop the rises at cells and the IR drops add to zero." },
    current_combine: { label: "Series and parallel", lab: "circuits", why: "Series: same current, R adds. Parallel: same voltage, 1/R adds. Spot them first to shrink a network." },
    current_emf:     { label: "EMF and internal resistance", lab: "circuits", why: "A real cell is E in series with r, so its terminal voltage is V = E − Ir, and E + Ir when it's being charged." },
    current_maxp:    { label: "Maximum power at R = r", lab: "circuits", why: "The load gets E²/4r when it matches the source's resistance, at only 50 % efficiency." },
    current_wheat:   { label: "Wheatstone balance P/Q = R/S", lab: "bridge", why: "No galvanometer current means equal potentials in the middle: a ratio of resistances, independent of E and G." },
    current_meter:   { label: "Meter bridge", lab: "bridge", why: "A Wheatstone bridge with a uniform wire for two arms: at the null, R/X = l/(100 − l)." },
    current_enderr:  { label: "End error", lab: "bridge", why: "The joins act like extra wire α, β at the ends. Two null readings let you solve for them." },
    current_charge:  { label: "RC charging and discharging", lab: "rc", why: "q = CE(1 − e^(−t/RC)) and q = q₀e^(−t/RC): the current decays exponentially as the capacitor fills or empties." },
    current_tau:     { label: "Time constant τ = RC", lab: "rc", why: "After τ the charge is 63 % of the way there and the current is down to 37 %. About 5τ counts as done." },
    current_rcenergy:{ label: "Half the work is stored", lab: "rc", why: "The battery does CE²; the capacitor keeps ½CE² and the resistor heats by ½CE², whatever R is." }
  },
  edges: [
    ["vel", "current_ohm", "drift of charges sets the current in"],
    ["current_ohm", "current_combine", "with KCL and KVL gives"], ["current_kcl", "current_combine", "adds currents for"], ["current_kvl", "current_combine", "adds voltages for"],
    ["current_ohm", "current_emf", "inside the cell gives"], ["current_kvl", "current_emf", "round the cell gives V = E − Ir"],
    ["current_emf", "current_maxp", "limits the load power to"],
    ["current_kvl", "current_wheat", "with no current in G gives"], ["current_kcl", "current_wheat", "keeps arm currents equal in"],
    ["current_wheat", "current_meter", "built from a wire becomes"], ["current_enderr", "current_meter", "shifts the null of"],
    ["current_kvl", "current_charge", "E = IR + q/C gives"], ["current_tau", "current_charge", "sets the pace of"],
    ["current_charge", "current_rcenergy", "integrated over time gives"]
  ],
  labs: {
    circuits: ["current_ohm", "current_kcl", "current_kvl", "current_combine", "current_emf", "current_maxp"],
    bridge: ["current_wheat", "current_meter", "current_enderr", "current_kvl", "current_kcl", "current_ohm"],
    rc: ["current_charge", "current_tau", "current_rcenergy", "current_kvl", "current_ohm"]
  }
});
