import type { Particle } from "./types";

export type SampleParticlesOptions = {
  distanceNoiseStdM?: number;
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

export function sampleParticles(
  particles: Particle[],
  deltaDistanceM: number,
  options?: SampleParticlesOptions
): Particle[] {
  if (!particles.length) return [];
  if (!Number.isFinite(deltaDistanceM) || deltaDistanceM === 0) {
    return particles;
  }

  const distanceNoiseStdM = options?.distanceNoiseStdM ?? 1.5;

  return particles.map((particle) => {
    const noisyDistance = deltaDistanceM + gaussianRandom(0, distanceNoiseStdM);

    const segLen = segmentLengthMeters(
      particle.segLon1,
      particle.segLat1,
      particle.segLon2,
      particle.segLat2
    );

    if (!Number.isFinite(segLen) || segLen <= 1e-6) {
      return particle;
    }

    const forward =
      particle.dirX * (particle.segLon2 - particle.segLon1) +
      particle.dirY * (particle.segLat2 - particle.segLat1) >= 0;

    const dt = noisyDistance / segLen;
    const nextT = clamp(particle.segT + (forward ? dt : -dt), 0, 1);

    return {
      ...particle,
      segT: nextT,
      x: lerp(particle.segLon1, particle.segLon2, nextT),
      y: lerp(particle.segLat1, particle.segLat2, nextT),
    };
  });
}