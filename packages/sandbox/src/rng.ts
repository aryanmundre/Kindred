import type { DeterministicRng } from "./types";

const DEFAULT_SEED = 1337;

export const normalizeSeed = (seed?: number | string): number => {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  if (typeof seed === "string" && seed.length) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      const chr = seed.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return hash >>> 0;
  }
  return DEFAULT_SEED;
};

export const createDeterministicRng = (seed?: number | string): DeterministicRng => {
  let s = normalizeSeed(seed);
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

