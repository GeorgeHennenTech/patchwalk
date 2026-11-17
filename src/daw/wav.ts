// A sound as a WAV file: the plain, uncompressed format every DAW opens. Pure: bytes in, bytes out.
/** Two sides of sound (numbers from -1 to 1) as a 16-bit stereo WAV file. Anything louder than full level is clipped. */
export function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const frames = Math.min(left.length, right.length), out = new Uint8Array(44 + frames * 4), v = new DataView(out.buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  text(0, "RIFF"); v.setUint32(4, 36 + frames * 4, true); text(8, "WAVE"); text(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); text(36, "data"); v.setUint32(40, frames * 4, true);
  const pcm = (x: number) => Math.round(Math.min(1, Math.max(-1, x)) * 32767);
  for (let i = 0; i < frames; i++) { v.setInt16(44 + i * 4, pcm(left[i]!), true); v.setInt16(46 + i * 4, pcm(right[i]!), true); }
  return out;
}
/** The loudest moment of a sound, in dB (0 is full level). */
export function peakDb(...sides: Float32Array[]): number { let m = 0; for (const s of sides) for (const x of s) { const a = Math.abs(x); if (a > m) m = a; } return 20 * Math.log10(m + 1e-9); }
