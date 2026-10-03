/* Thermodynamics: the ideas behind the processes and engines labs, as cause -> effect. */
Maps.add({
  nodes: {
    thermo_state:    { label: "Ideal gas PV = nRT", lab: "processes", why: "Fix any two of P, V, T and the third follows. With P in kPa and V in L, PV is in joules." },
    thermo_u:        { label: "Internal energy U = nCᵥT", lab: "processes", why: "For an ideal gas U depends on temperature alone, whatever the path. Cᵥ = 3R/2 monatomic, 5R/2 diatomic." },
    thermo_work:     { label: "Work = area under P–V", lab: "processes", why: "W = ∫P dV, done by the gas. Positive when it expands, negative when it's squeezed, zero at constant volume." },
    thermo_first:    { label: "First law Q = ΔU + W", lab: "processes", why: "Energy bookkeeping: heat in goes into internal energy or out as work. JEE takes W as work done by the gas." },
    thermo_cpcv:     { label: "Cₚ − Cᵥ = R", lab: "processes", why: "At constant pressure the gas also does work PΔV = nRΔT, so it needs R more heat per mole per kelvin." },
    thermo_isotherm: { label: "Isothermal: Q = W", lab: "processes", why: "T fixed means ΔU = 0, so all the heat leaves as work: W = nRT ln(V₂/V₁)." },
    thermo_adiabat:  { label: "Adiabatic: PV^γ = const", lab: "processes", why: "No heat, so the work comes out of U: the gas cools as it expands. Steeper than the isotherm by a factor γ." },
    thermo_cycle:    { label: "Cycle: W = enclosed area", lab: "engines", why: "Back to the start means ΔU = 0 per lap, so W = Q_in − Q_out: the area inside the loop." },
    thermo_eff:      { label: "Efficiency η = W/Q_in", lab: "engines", why: "What you get over what you pay. Some heat must always be dumped, so η < 1." },
    thermo_otto:     { label: "Otto cycle η = 1 − 1/r^(γ−1)", lab: "engines", why: "Two adiabats and two isochores. Only the compression ratio and γ set the efficiency, not the fuel." },
    thermo_carnot:   { label: "Carnot limit η = 1 − T_c/T_h", lab: "engines", why: "Two isotherms and two adiabats: the best any engine between the same two temperatures can do. Kelvin only." },
    thermo_fridge:   { label: "Refrigerator COP", lab: "engines", why: "Run the loop backwards: work pulls Q_c out of the cold side. Carnot COP = T_c/(T_h − T_c), often above 1." }
  },
  edges: [
    ["thermo_state", "thermo_u", "its T sets"],
    ["force", "thermo_work", "on a moving piston does"],
    ["graphs", "thermo_work", "area under a curve, again:"],
    ["thermo_u", "thermo_first", "ΔU enters"],
    ["thermo_work", "thermo_first", "W enters"],
    ["thermo_first", "thermo_cpcv", "at constant P adds PΔV:"],
    ["thermo_first", "thermo_isotherm", "with ΔU = 0 gives"],
    ["thermo_first", "thermo_adiabat", "with Q = 0 gives"],
    ["thermo_cpcv", "thermo_adiabat", "γ = Cₚ/Cᵥ sets"],
    ["thermo_work", "thermo_cycle", "round a closed loop is"],
    ["thermo_first", "thermo_cycle", "with ΔU = 0 per lap gives"],
    ["thermo_cycle", "thermo_eff", "divided by Q_in is"],
    ["thermo_adiabat", "thermo_otto", "two adiabats make"],
    ["thermo_eff", "thermo_otto", "for a petrol engine is"],
    ["thermo_isotherm", "thermo_carnot", "two isotherms + two adiabats make"],
    ["thermo_eff", "thermo_carnot", "is capped by"],
    ["thermo_cycle", "thermo_fridge", "run backwards is"],
    ["thermo_carnot", "thermo_fridge", "also limits"]
  ],
  labs: {
    processes: ["thermo_state", "thermo_u", "thermo_work", "thermo_first", "thermo_cpcv", "thermo_isotherm", "thermo_adiabat"],
    engines: ["thermo_first", "thermo_isotherm", "thermo_adiabat", "thermo_cycle", "thermo_eff", "thermo_otto", "thermo_carnot", "thermo_fridge"]
  }
});
