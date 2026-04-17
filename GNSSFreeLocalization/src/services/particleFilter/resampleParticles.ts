import type { Particle } from "./types";

export type ResampleParticlesOptions = {
  jitterPositionStd?: number;
  keepWeightsUniform?: boolean;
};

function gaussianRandom(mean = 0, std = 1): number {
  const u1 = Math.max(Math.random(), 1e-12);
  const u2 = Math.random();

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * std;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function metersPerDegreeLon(latDeg: number): number {
  return 111320 * Math.cos((latDeg * Math.PI) / 180);
}

function moveAlongSegmentWithMeters(
  particle: Particle,
  deltaMeters: number
): { segT: number; x: number; y: number } {
  const meanLatRad = (((particle.segLat1 + particle.segLat2) * 0.5) * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(meanLatRad);

  const dx = (particle.segLon2 - particle.segLon1) * metersPerDegLon;
  const dy = (particle.segLat2 - particle.segLat1) * metersPerDegLat;
  const segLen = Math.sqrt(dx * dx + dy * dy);

  if (!Number.isFinite(segLen) || segLen <= 1e-9) {
    return {
      segT: particle.segT,
      x: particle.x,
      y: particle.y,
    };
  }

  const forward =
    particle.dirX * (particle.segLon2 - particle.segLon1) +
    particle.dirY * (particle.segLat2 - particle.segLat1) >= 0;

  const dt = deltaMeters / segLen;
  const nextT = clamp(particle.segT + (forward ? dt : -dt), 0, 1);

  const x = particle.segLon1 + (particle.segLon2 - particle.segLon1) * nextT;
  const y = particle.segLat1 + (particle.segLat2 - particle.segLat1) * nextT;

  return { segT: nextT, x, y };
}

function sanitizeWeights(particles: Particle[]): Particle[] {
  if (!particles.length) return [];

  const cleaned = particles.map((p) => ({
    ...p,
    weight: Number.isFinite(p.weight) && p.weight > 0 ? p.weight : 0,
  }));

  const total = cleaned.reduce((sum, p) => sum + p.weight, 0);

  if (total <= 1e-12) {
    const uniform = 1 / cleaned.length;
    return cleaned.map((p) => ({ ...p, weight: uniform }));
  }

  return cleaned.map((p) => ({
    ...p,
    weight: p.weight / total,
  }));
}

export function resampleParticles(
  particles: Particle[],
  options?: ResampleParticlesOptions
): Particle[] {
  if (!particles.length) return [];

  const jitterPositionStd = options?.jitterPositionStd ?? 0.5;
  const keepWeightsUniform = options?.keepWeightsUniform ?? true;

  const normalized = sanitizeWeights(particles);
  const n = normalized.length;

  const cumulative = new Array<number>(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += normalized[i].weight;
    cumulative[i] = acc;
  }
  cumulative[n - 1] = 1;

  const step = 1 / n;
  let u = Math.random() * step;
  let i = 0;

  const out: Particle[] = new Array(n);
  const uniformWeight = 1 / n;

  for (let m = 0; m < n; m++) {
    while (i < n - 1 && u > cumulative[i]) {
      i++;
    }

    const parent = normalized[i];

    const jitterMeters =
      jitterPositionStd > 0 ? gaussianRandom(0, jitterPositionStd) : 0;

    const moved = moveAlongSegmentWithMeters(parent, jitterMeters);

    out[m] = {
      ...parent,
      id: m,
      segT: moved.segT,
      x: moved.x,
      y: moved.y,
      weight: keepWeightsUniform ? uniformWeight : parent.weight,
    };

    u += step;
  }

  return out;
}