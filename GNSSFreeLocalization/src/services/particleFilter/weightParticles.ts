import type { Particle } from "./types";
import type { MilestoneBoard } from "../../types/MilestoneBoard";

export type WeightParticlesOptions = {
  distanceSigmaM?: number;
  minLikelihood?: number;
  backwardsPenalty?: number;
  exactBoardMatchBonus?: number;
};

type BoardSign = {
  destination: string;
  distance: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function metersPerDegreeLon(latDeg: number): number {
  return 111320 * Math.cos((latDeg * Math.PI) / 180);
}

function deltaMeters(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number
): { dx: number; dy: number; dist: number } {
  const meanLat = (fromLat + toLat) * 0.5;
  const dx = (toLon - fromLon) * metersPerDegreeLon(meanLat);
  const dy = (toLat - fromLat) * 111320;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return { dx, dy, dist };
}

function gaussianScore(distanceM: number, sigmaM: number): number {
  if (!Number.isFinite(distanceM)) return 0;
  if (!Number.isFinite(sigmaM) || sigmaM <= 0) return 0;
  return Math.exp(-(distanceM * distanceM) / (2 * sigmaM * sigmaM));
}

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

function signMatchScore(
  observedSigns: BoardSign[] | undefined,
  candidateSigns: BoardSign[] | undefined
): number {
  const obs = Array.isArray(observedSigns) ? observedSigns : [];
  const cand = Array.isArray(candidateSigns) ? candidateSigns : [];

  if (obs.length === 0 || cand.length === 0) {
    return 1;
  }

  let matched = 0;

  for (const o of obs) {
    const od = normalizeText(String(o.destination ?? ""));
    const okm = Number(o.distance);

    const found = cand.some((c) => {
      const cd = normalizeText(String(c.destination ?? ""));
      const ckm = Number(c.distance);

      return od === cd && okm === ckm;
    });

    if (found) matched++;
  }

  return clamp(matched / obs.length, 0, 1);
}

function computeLikelihood(
  particle: Particle,
  observedBoard: MilestoneBoard,
  options: Required<WeightParticlesOptions>
): number {
  const { dx, dy, dist } = deltaMeters(
    particle.x,
    particle.y,
    observedBoard.lon,
    observedBoard.lat
  );

  const distanceScore = gaussianScore(dist, options.distanceSigmaM);

  const toBoardLen = Math.sqrt(dx * dx + dy * dy);
  const dirLen = Math.sqrt(
    particle.dirX * particle.dirX + particle.dirY * particle.dirY
  );

  let directionScore = 1;

  if (toBoardLen > 1e-9 && dirLen > 1e-9) {
    const dirDot =
      dot(
        particle.dirX / dirLen,
        particle.dirY / dirLen,
        dx / toBoardLen,
        dy / toBoardLen
      );

    directionScore = dirDot >= 0 ? 1 : options.backwardsPenalty;
  }

  const textScore = signMatchScore(
    observedBoard.signs as BoardSign[] | undefined,
    observedBoard.signs as BoardSign[] | undefined
  );

  let likelihood = distanceScore * directionScore * textScore;

  if (likelihood > 0 && options.exactBoardMatchBonus > 1) {
    likelihood *= options.exactBoardMatchBonus;
  }

  return Math.max(options.minLikelihood, likelihood);
}

export function normalizeParticleWeights(particles: Particle[]): Particle[] {
  if (!particles.length) return [];

  const total = particles.reduce((sum, p) => sum + p.weight, 0);

  if (!Number.isFinite(total) || total <= 1e-12) {
    const uniform = 1 / particles.length;
    return particles.map((p) => ({
      ...p,
      weight: uniform,
    }));
  }

  return particles.map((p) => ({
    ...p,
    weight: p.weight / total,
  }));
}

export function weightParticles(
  particles: Particle[],
  observedBoard: MilestoneBoard,
  options?: WeightParticlesOptions
): Particle[] {
  if (!particles.length) return [];

  const resolved: Required<WeightParticlesOptions> = {
    distanceSigmaM: options?.distanceSigmaM ?? 20,
    minLikelihood: options?.minLikelihood ?? 1e-6,
    backwardsPenalty: options?.backwardsPenalty ?? 0.15,
    exactBoardMatchBonus: options?.exactBoardMatchBonus ?? 1.0,
  };

  const weighted = particles.map((particle) => {
    const likelihood = computeLikelihood(particle, observedBoard, resolved);

    return {
      ...particle,
      weight: particle.weight * likelihood,
    };
  });

  return normalizeParticleWeights(weighted);
}