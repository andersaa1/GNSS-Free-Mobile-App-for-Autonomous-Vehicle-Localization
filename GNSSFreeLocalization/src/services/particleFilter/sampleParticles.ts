import type { Particle } from "./types";
import { RoadTileSampler } from "../roads/roadTileSampler";

export type SampleParticlesOptions = {
  distanceNoiseStdM?: number;
  maxTransitionsPerStep?: number;
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

function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(len) || len <= 1e-12) {
    return { x: 1, y: 0 };
  }
  return { x: dx / len, y: dy / len };
}

function moveParticleAcrossSegments(
  particle: Particle,
  distanceM: number,
  sampler: RoadTileSampler,
  maxTransitionsPerStep: number
): Particle {
  let segLon1 = particle.segLon1;
  let segLat1 = particle.segLat1;
  let segLon2 = particle.segLon2;
  let segLat2 = particle.segLat2;
  let segT = particle.segT;

  const forward =
    particle.dirX * (particle.segLon2 - particle.segLon1) +
      particle.dirY * (particle.segLat2 - particle.segLat1) >=
    0;

  let remaining = Math.max(0, distanceM);
  let transitions = 0;

  while (remaining > 1e-6) {
    const segLen = segmentLengthMeters(segLon1, segLat1, segLon2, segLat2);
    if (!Number.isFinite(segLen) || segLen <= 1e-6) {
      break;
    }

    const available = forward ? (1 - segT) * segLen : segT * segLen;

    if (remaining <= available + 1e-9) {
      const dt = remaining / segLen;
      segT = forward ? segT + dt : segT - dt;
      segT = clamp(segT, 0, 1);
      remaining = 0;
      break;
    }

    remaining -= available;
    const exitLon = forward ? segLon2 : segLon1;
    const exitLat = forward ? segLat2 : segLat1;

    if (transitions >= maxTransitionsPerStep) {
      segT = forward ? 1 : 0;
      remaining = 0;
      break;
    }

    const next = sampler.pickConnectedSegment(
      { lon1: segLon1, lat1: segLat1, lon2: segLon2, lat2: segLat2 },
      exitLon,
      exitLat
    );

    if (!next) {
      segT = forward ? 1 : 0;
      remaining = 0;
      break;
    }

    if (forward) {
      segLon1 = next.lon1;
      segLat1 = next.lat1;
      segLon2 = next.lon2;
      segLat2 = next.lat2;
      segT = 0;
    } else {
      // reverse the new segment so backward motion can continue away from the junction
      segLon1 = next.lon2;
      segLat1 = next.lat2;
      segLon2 = next.lon1;
      segLat2 = next.lat1;
      segT = 1;
    }

    transitions++;
  }

  const unit = normalize(segLon2 - segLon1, segLat2 - segLat1);
  const dirSign = forward ? 1 : -1;

  return {
    ...particle,
    segLon1,
    segLat1,
    segLon2,
    segLat2,
    segT,
    x: lerp(segLon1, segLon2, segT),
    y: lerp(segLat1, segLat2, segT),
    dirX: unit.x * dirSign,
    dirY: unit.y * dirSign,
  };
}

export function sampleParticles(
  particles: Particle[],
  deltaDistanceM: number,
  sampler: RoadTileSampler,
  options?: SampleParticlesOptions
): Particle[] {
  if (!particles.length) return [];
  if (!Number.isFinite(deltaDistanceM) || deltaDistanceM === 0) {
    return particles;
  }

  const distanceNoiseStdM = options?.distanceNoiseStdM ?? 1.5;
  const maxTransitionsPerStep = options?.maxTransitionsPerStep ?? 8;

  return particles.map((particle) => {
    const noisyDistance = Math.max(0, deltaDistanceM + gaussianRandom(0, distanceNoiseStdM));

    if (!Number.isFinite(noisyDistance) || noisyDistance === 0) {
      return particle;
    }

    return moveParticleAcrossSegments(
      particle,
      noisyDistance,
      sampler,
      maxTransitionsPerStep
    );
  });
}