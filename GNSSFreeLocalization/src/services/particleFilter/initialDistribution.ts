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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function projectT(
  lon: number,
  lat: number,
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const meanLatRad = (((lat1 + lat2) * 0.5) * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(meanLatRad);

  const ax = 0;
  const ay = 0;
  const bx = (lon2 - lon1) * metersPerDegLon;
  const by = (lat2 - lat1) * metersPerDegLat;
  const px = (lon - lon1) * metersPerDegLon;
  const py = (lat - lat1) * metersPerDegLat;

  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;

  if (!Number.isFinite(ab2) || ab2 <= 1e-12) return 0;

  const t = (px * abx + py * aby) / ab2;
  return clamp(t, 0, 1);
}

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
    const unit = normalize(point.lon2 - point.lon1, point.lat2 - point.lat1);
    const reverse = Math.random() < 0.5;
    const sign = reverse ? -1 : 1;

    const segT = projectT(
      point.lon,
      point.lat,
      point.lon1,
      point.lat1,
      point.lon2,
      point.lat2
    );

    return {
      id: index,
      x: point.lon,
      y: point.lat,
      weight,
      dirX: unit.x * sign,
      dirY: unit.y * sign,
      segLon1: point.lon1,
      segLat1: point.lat1,
      segLon2: point.lon2,
      segLat2: point.lat2,
      segT,
    };
  });
}