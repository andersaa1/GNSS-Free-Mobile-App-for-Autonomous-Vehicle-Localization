import type { Particle } from "./types";

export type SampleParticlesOptions = {
  distanceNoiseStdM?: number;
};

/**
 * Converts meters in east-west direction to longitude degrees
 * at the provided latitude.
 */
function metersToLonDegrees(meters: number, latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  const metersPerDegLon = 111320 * Math.cos(latRad);

  if (!Number.isFinite(metersPerDegLon) || Math.abs(metersPerDegLon) < 1e-9) {
    return 0;
  }

  return meters / metersPerDegLon;
}

/**
 * Converts meters in north-south direction to latitude degrees.
 */
function metersToLatDegrees(meters: number): number {
  const metersPerDegLat = 111320;
  return meters / metersPerDegLat;
}

/**
 * Gaussian random number using Box-Muller transform.
 */
function gaussianRandom(mean = 0, std = 1): number {
  const u1 = Math.max(Math.random(), 1e-12);
  const u2 = Math.random();

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * std;
}

/**
 * Sampling / motion update step.
 *
 * Moves each particle forward by deltaDistance along its fixed heading.
 * The heading is NOT flipped during propagation.
 *
 * Note:
 * This first version preserves heading, but it does not yet snap particles
 * back to the road geometry, so it is only "heading constrained", not fully
 * road-graph constrained on curved roads/intersections.
 */
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
    const noisyDistance =
      deltaDistanceM + gaussianRandom(0, distanceNoiseStdM);

    const dxMeters = particle.dirX * noisyDistance;
    const dyMeters = particle.dirY * noisyDistance;

    const dLon = metersToLonDegrees(dxMeters, particle.y);
    const dLat = metersToLatDegrees(dyMeters);

    return {
      ...particle,
      x: particle.x + dLon,
      y: particle.y + dLat,
    };
  });
}