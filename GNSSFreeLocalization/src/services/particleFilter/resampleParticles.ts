import type { Particle } from "./types";

export type ResampleParticlesOptions = {
  jitterPositionStd?: number;
  keepWeightsUniform?: boolean;
  minDuplicateSpacingM?: number;
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

function segmentLengthMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const meanLatRad = (((lat1 + lat2) * 0.5) * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(meanLatRad);

  const dx = (lon2 - lon1) * metersPerDegLon;
  const dy = (lat2 - lat1) * metersPerDegLat;

  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function reflectedClamp01(t: number): number {
  if (!Number.isFinite(t)) return 0.5;

  let value = t;

  while (value < 0 || value > 1) {
    if (value < 0) value = -value;
    if (value > 1) value = 2 - value;
  }

  return clamp(value, 0.000001, 0.999999);
}

function moveAlongSegmentWithMeters(
  particle: Particle,
  deltaMeters: number
): { segT: number; x: number; y: number } {
  const segLen = segmentLengthMeters(
    particle.segLon1,
    particle.segLat1,
    particle.segLon2,
    particle.segLat2
  );

  if (!Number.isFinite(segLen) || segLen <= 1e-9) {
    return {
      segT: particle.segT,
      x: particle.x,
      y: particle.y,
    };
  }

  const forward =
    particle.dirX * (particle.segLon2 - particle.segLon1) +
      particle.dirY * (particle.segLat2 - particle.segLat1) >=
    0;

  const dt = deltaMeters / segLen;

  // Important:
  // Do not clamp directly to 0 or 1.
  // Direct clamping causes many duplicated particles to collapse onto endpoints.
  const nextT = reflectedClamp01(particle.segT + (forward ? dt : -dt));

  const x = lerp(particle.segLon1, particle.segLon2, nextT);
  const y = lerp(particle.segLat1, particle.segLat2, nextT);

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

function positionKey(p: Particle): string {
  return `${p.x.toFixed(8)},${p.y.toFixed(8)}`;
}

function nudgeParticleAlongSegment(
  particle: Particle,
  offsetMeters: number
): Particle {
  const segLen = segmentLengthMeters(
    particle.segLon1,
    particle.segLat1,
    particle.segLon2,
    particle.segLat2
  );

  if (!Number.isFinite(segLen) || segLen <= 1e-9) {
    return particle;
  }

  const dt = offsetMeters / segLen;
  const nextT = reflectedClamp01(particle.segT + dt);

  return {
    ...particle,
    segT: nextT,
    x: lerp(particle.segLon1, particle.segLon2, nextT),
    y: lerp(particle.segLat1, particle.segLat2, nextT),
  };
}

function dedupeExactPositions(
  particles: Particle[],
  minDuplicateSpacingM: number
): Particle[] {
  const groups = new Map<string, Particle[]>();

  for (const particle of particles) {
    const key = positionKey(particle);
    const group = groups.get(key) ?? [];
    group.push(particle);
    groups.set(key, group);
  }

  const result: Particle[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    const center = (group.length - 1) / 2;

    for (let i = 0; i < group.length; i++) {
      const offsetMeters = (i - center) * minDuplicateSpacingM;

      result.push(
        nudgeParticleAlongSegment(group[i], offsetMeters)
      );
    }
  }

  return result.map((p, index) => ({
    ...p,
    id: index,
  }));
}

export function resampleParticles(
  particles: Particle[],
  options?: ResampleParticlesOptions
): Particle[] {
  if (!particles.length) return [];

  const jitterPositionStd = options?.jitterPositionStd ?? 15;
  const keepWeightsUniform = options?.keepWeightsUniform ?? true;
  const minDuplicateSpacingM = options?.minDuplicateSpacingM ?? 1.5;

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

  const deduped = dedupeExactPositions(out, minDuplicateSpacingM);

  return deduped.map((p, index) => ({
    ...p,
    id: index,
    weight: keepWeightsUniform ? uniformWeight : p.weight,
  }));
}