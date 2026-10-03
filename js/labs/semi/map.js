/* Semiconductors: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    semi_depletion: { label: "Depletion region", lab: "diode", why: "Carriers diffuse across and cancel, leaving fixed ions. Its width grows as √(V₀ − V)." },
    semi_barrier:   { label: "Barrier potential V₀", lab: "diode", why: "About 0.7 V for Si and 0.3 V for Ge. Bias lowers or raises it." },
    semi_bias:      { label: "Forward and reverse bias", lab: "diode", why: "Forward lowers the barrier and current flows; reverse raises it and only I_s leaks." },
    semi_iv:        { label: "Diode I–V: I = I_s(e^{V/ηV_T} − 1)", lab: "diode", why: "Exponential above the knee, a tiny constant I_s in reverse." },
    semi_rd:        { label: "Dynamic resistance r_d = ηV_T/I", lab: "diode", why: "The slope of the I–V curve, not V/I. What a small AC signal sees." },
    semi_zener:     { label: "Zener breakdown", lab: "diode", why: "Past −V_z the reverse current shoots up at an almost fixed voltage: a regulator." },
    semi_rect:      { label: "Rectifiers", lab: "diode", why: "One diode passes half the wave; a bridge of four flips the other half too, so f_r = 2f." },
    semi_ripple:    { label: "Filter capacitor ripple", lab: "diode", why: "The capacitor feeds the load between peaks: V_r ≈ V_p/(f_r R C)." },
    semi_gates:     { label: "Basic gates", lab: "logic", why: "AND, OR, NOT: the output is a fixed function of the inputs, built from transistors and diodes." },
    semi_truth:     { label: "Truth table", lab: "logic", why: "Every input combination and its output. 2ⁿ rows for n inputs: the complete description of a circuit." },
    semi_bool:      { label: "Boolean expression", lab: "logic", why: "A·B, A + B, Ā. Algebra that predicts the truth table without listing it." },
    semi_demorgan:  { label: "De Morgan's laws", lab: "logic", why: "NOT(A·B) = Ā + B̄ and NOT(A + B) = Ā·B̄: swap AND and OR by inverting everything." },
    semi_universal: { label: "NAND and NOR are universal", lab: "logic", why: "Tie a NAND's inputs together and it's a NOT. From there you can build every other gate." },
    semi_circuit:   { label: "Combining gates", lab: "logic", why: "Feed one gate into the next and work outwards: the circuit's truth table follows from the wiring." }
  },
  edges: [
    ["semi_depletion", "semi_barrier", "sets up"],
    ["semi_bias", "semi_barrier", "raises or lowers"], ["semi_bias", "semi_depletion", "widens or narrows"],
    ["semi_barrier", "semi_iv", "gives the knee in"], ["semi_iv", "semi_rd", "slope gives"],
    ["semi_iv", "semi_zener", "in reverse ends in"], ["semi_iv", "semi_rect", "one-way flow allows"],
    ["semi_rect", "semi_ripple", "smoothed with"],
    ["semi_iv", "semi_gates", "switching builds"],
    ["semi_gates", "semi_truth", "described by"], ["semi_gates", "semi_bool", "written as"],
    ["semi_bool", "semi_truth", "predicts"], ["semi_bool", "semi_demorgan", "simplified by"],
    ["semi_demorgan", "semi_universal", "explains"], ["semi_gates", "semi_circuit", "combine into"],
    ["semi_universal", "semi_circuit", "can build any"], ["semi_circuit", "semi_truth", "fills in"]
  ],
  labs: {
    diode: ["semi_depletion", "semi_barrier", "semi_bias", "semi_iv", "semi_rd", "semi_zener", "semi_rect", "semi_ripple"],
    logic: ["semi_gates", "semi_truth", "semi_bool", "semi_demorgan", "semi_universal", "semi_circuit"]
  }
});
