import type { Particle } from "./types";
import { RoadTileSampler } from "../roads/roadTileSampler";

function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);

  if (!Number.isFinite(len) || len <= 1e-12) {
    return { x: 1, y: 0 };
  }

  return {
    x: dx / len,
    y: dy / len,
  };
}

/**
 * Creates the initial particle distribution by sampling points on road tiles
 * and converting them into equally weighted particles.
 * 
 * Each particle gets a fixed random heading along the road:
 * either the segment direction or the reverse direction.
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

  return points.map((point, index) => {
    const unit = normalize(point.dx, point.dy);
    const sign = Math.random() < 0.5 ? -1 : 1;

    return {
      id: index,
      x: point.lon,
      y: point.lat,
      weight,
      dirX: unit.x * sign,
      dirY: unit.y * sign,
    };
  });
}