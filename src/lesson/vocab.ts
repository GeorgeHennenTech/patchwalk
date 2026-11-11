// Synth terms the validator watches for. If lesson text uses one and the patch has nothing to do
// with it, the text is describing a setting that is not in the patch.
export interface VocabEntry {
  term: string;
  re: RegExp;
  /** Fact tags (module types or param keys) that make this term legitimate. */
  tags: string[];
}

export const VOCAB: VocabEntry[] = [
  { term: "unison", re: /\bunison\b/i, tags: ["kParamUnison", "kParamUnisonStereo", "kParamUnisonBlend", "kParamDetune"] },
  { term: "detune", re: /\bdetun/i, tags: ["kParamDetune", "kParamFine", "kParamUnison"] },
  { term: "warp", re: /\bwarp/i, tags: ["kParamWarpMenu", "kParamWarp", "kParamWarpMenu2", "kParamWarp2"] },
  { term: "wavetable", re: /\bwavetable/i, tags: ["WTOsc", "wavetable"] },
  { term: "filter", re: /\bfilter/i, tags: ["VoiceFilter", "FXFilter"] },
  { term: "cutoff", re: /\bcut-?off/i, tags: ["VoiceFilter.kParamFreq", "FXFilter.kParamFreq"] },
  { term: "resonance", re: /\breson/i, tags: ["kParamReso"] },
  { term: "drive", re: /\b(over)?driv(e|en|ing)\b/i, tags: ["kParamDrive", "FXDistortion"] },
  { term: "distortion", re: /\b(distort|saturat|clipp)/i, tags: ["FXDistortion", "kParamDrive"] },
  { term: "attack", re: /\battack\b/i, tags: ["kParamAttack"] },
  { term: "decay", re: /\bdecay/i, tags: ["kParamDecay"] },
  { term: "sustain", re: /\bsustain/i, tags: ["kParamSustain"] },
  { term: "release", re: /\brelease\b/i, tags: ["kParamRelease"] },
  { term: "envelope", re: /\benvelope/i, tags: ["Env", "env"] },
  { term: "LFO", re: /\blfos?\b/i, tags: ["LFO", "lfo"] },
  { term: "macro", re: /\bmacros?\b/i, tags: ["Macro", "macro"] },
  { term: "mod wheel", re: /\bmod(ulation)? ?wheel/i, tags: ["modwheel"] },
  { term: "reverb", re: /\breverb/i, tags: ["FXReverb"] },
  { term: "delay", re: /\b(delay|echo)/i, tags: ["FXDelay", "LFO.kParamDelay"] },
  { term: "chorus", re: /\bchorus/i, tags: ["FXChorus"] },
  { term: "compressor", re: /\bcompress/i, tags: ["FXComp"] },
  { term: "EQ", re: /\b(eq|equali[sz])/i, tags: ["FXEQ"] },
  { term: "flanger", re: /\bflang/i, tags: ["FXFlanger"] },
  { term: "phaser", re: /\bphaser/i, tags: ["FXPhaser"] },
  { term: "bitcrush", re: /\b(bit ?crush|downsampl)/i, tags: [] },
  { term: "portamento", re: /\b(portamento|glide)/i, tags: ["kParamPortamentoTime", "kParamPortaAlways"] },
  { term: "legato", re: /\blegato/i, tags: ["kParamLegato"] },
  { term: "mono", re: /\bmono(phonic)?\b/i, tags: ["kParamMonoToggle", "kParamMono"] },
  { term: "noise", re: /\bnoise\b/i, tags: ["NoiseOsc"] },
  { term: "sub oscillator", re: /\bsub\b/i, tags: ["SubOsc"] },
  { term: "octave", re: /\boctave/i, tags: ["kParamOctave"] },
  { term: "semitone", re: /\bsemitone/i, tags: ["kParamPitch", "kParamTranspose", "kParamBendRangeUp", "kParamBendRangeDn"] },
  { term: "pan", re: /\bpan(ning|ned)?\b/i, tags: ["kParamPan"] },
  { term: "FM", re: /\bFM\b|frequency modulation/, tags: [] },
  { term: "ring mod", re: /\bring ?mod/i, tags: [] },
  { term: "sync", re: /\b(hard )?sync/i, tags: ["kParamBeatSync"] },
  { term: "arpeggiator", re: /\barp(eggiat\w*)?\b/i, tags: [] },
  { term: "granular", re: /\bgranular/i, tags: [] },
  { term: "spectral", re: /\bspectral/i, tags: [] },
  { term: "pitch bend", re: /\bpitch ?bend/i, tags: ["kParamBendRangeUp", "kParamBendRangeDn"] },
  { term: "stereo width", re: /\b(stereo )?width\b/i, tags: ["kParamWidth", "kParamUnisonStereo"] },
];
