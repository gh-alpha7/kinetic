/* Waves & sound: the chapter's ideas for the concept map. */
Maps.add({
  nodes: {
    sound_speed:    { label: "Wave speed v = √(T/μ)", lab: "travelling", why: "The medium alone sets how fast a wave travels: tighter is faster, heavier is slower." },
    sound_vfl:      { label: "v = fλ, ω = vk", lab: "travelling", why: "The source sets f, the medium sets v, and the wavelength is whatever fits: λ = v/f." },
    sound_wave:     { label: "Travelling wave y = A sin(kx − ωt)", lab: "travelling", why: "A shape sliding along at v. The sign between kx and ωt tells you which way it goes." },
    sound_partvel:  { label: "Particle velocity ≠ wave velocity", lab: "travelling", why: "Each particle only oscillates, at up to Aω. It's linked to the wave speed by the slope: v_p = −v ∂y/∂x." },
    sound_reflect:  { label: "Reflection at an end", lab: "travelling", why: "A fixed end sends the wave back inverted (phase π); a free end sends it back upright." },
    sound_super:    { label: "Superposition", lab: "standing", why: "Overlapping waves simply add their displacements. Standing waves and beats both come from this." },
    sound_standing: { label: "Standing wave: nodes & antinodes", lab: "standing", why: "Two equal waves going opposite ways give A sin kx cos ωt: nothing travels, nodes never move." },
    sound_harm:     { label: "String harmonics f = nv/2L", lab: "standing", why: "Fixed ends must be nodes, so only whole numbers of half-wavelengths fit." },
    sound_pipes:    { label: "Organ pipes: open vs closed", lab: "standing", why: "Open–open gives every harmonic nv/2L; closed–open gives only odd ones, (2n−1)v/4L." },
    sound_reson:    { label: "Resonance", lab: "standing", why: "Drive at a natural frequency and the reflections add up in step: the amplitude grows huge." },
    sound_beats:    { label: "Beats f = |f₁ − f₂|", lab: "beatsdoppler", why: "Two close frequencies drift in and out of step, so the loudness rises and falls |f₁ − f₂| times a second." },
    sound_doppler:  { label: "Doppler effect", lab: "beatsdoppler", why: "f' = f(v + v_o)/(v − v_s): a moving observer meets crests faster, a moving source squeezes them closer." },
    sound_shock:    { label: "Shock waves (v_s > v)", lab: "beatsdoppler", why: "A source faster than sound outruns its own wavefronts; they pile up on a cone with sin θ = v/v_s." }
  },
  edges: [
    ["tension", "sound_speed", "sets"], ["sound_speed", "sound_vfl", "with f fixes λ in"], ["sound_vfl", "sound_wave", "sets k and ω of"],
    ["sound_wave", "sound_partvel", "∂y/∂t gives"], ["vel", "sound_partvel", "is measured as"],
    ["sound_wave", "sound_reflect", "at an end gives"], ["sound_reflect", "sound_super", "overlaps by"],
    ["sound_super", "sound_standing", "of opposite waves gives"], ["sound_standing", "sound_harm", "with fixed ends gives"],
    ["sound_standing", "sound_pipes", "in an air column gives"], ["sound_speed", "sound_harm", "sets"],
    ["sound_harm", "sound_reson", "driven at f_n gives"], ["sound_pipes", "sound_reson", "driven at f_n gives"],
    ["sound_super", "sound_beats", "of close frequencies gives"],
    ["frames", "sound_doppler", "observer vs medium explains"], ["vecadd", "sound_doppler", "v ± v_o comes from"],
    ["sound_vfl", "sound_doppler", "squeezed λ changes f in"], ["sound_doppler", "sound_shock", "when v_s > v becomes"]
  ],
  labs: {
    travelling: ["sound_speed", "sound_vfl", "sound_wave", "sound_partvel", "sound_reflect", "tension", "vel"],
    standing: ["sound_super", "sound_standing", "sound_harm", "sound_pipes", "sound_reson", "sound_speed", "sound_reflect"],
    beatsdoppler: ["sound_super", "sound_beats", "sound_doppler", "sound_shock", "sound_vfl", "frames", "vecadd"]
  }
});
