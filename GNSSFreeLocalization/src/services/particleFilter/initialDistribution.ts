import type { Particle } from "./types";
import { RoadTileSampler } from "../roads/roadTileSampler";

/**
 * Creates the initial particle distribution by sampling points on road tiles
 * and converting them into equally weighted particles.
 */
export async function createInitialDistribution(
  sampler: RoadTileSampler,
  count: number
): Promise<Particle[]> {
  const points = await sampler.sampleInitialParticles(count);

  if (!points.length) {
    return [];
  }

  const weight = 1 / points.length;

  return points.map((point, index) => ({
    id: index,
    x: point.lon,
    y: point.lat,
    weight,
  }));
}