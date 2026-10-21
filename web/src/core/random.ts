/**
 * Seeded random numbers for the simulators: mulberry32 uniforms and
 * Box–Muller normals.  Runs are reproducible, but not bit-identical to
 * NumPy's generator (the parity fixtures never depend on simulated noise).
 */

/** Uniform numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal numbers drawn from `uniform` (two per pair of uniforms). */
export function normalGenerator(seed: number, uniform: () => number = mulberry32(seed)): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    const r = Math.sqrt(-2 * Math.log(1 - uniform())); // 1 − u ∈ (0, 1], so log is finite
    const theta = 2 * Math.PI * uniform();
    spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  };
}
