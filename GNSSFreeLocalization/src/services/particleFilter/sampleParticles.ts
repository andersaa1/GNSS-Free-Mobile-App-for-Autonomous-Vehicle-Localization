import type { Particle } from "./types";

function gaussianRandom(mean = 0, std = 1): number {
  const u1 = Math.max(Math.random(), 1e-12);
  const u2 = Math.random();

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * std;
}

export type RouteMotionOptions = {
  distanceNoiseStdM?: number;
  headingNoiseDeg?: number;
  direction?: "forward" | "backward";
};

type Coordinate = {
  lat: number;
  lon: number;
};

const TEST_ROUTE_START: Coordinate = {
  lat: 58.41080004416583,
  lon: 26.639977828941134,
};

const TEST_ROUTE_END: Coordinate = {
  lat: 58.656549087321984,
  lon: 26.00953510482076,
};

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function calculateBearingRad(from: Coordinate, to: Coordinate): number {
  const lat1 = degToRad(from.lat);
  const lat2 = degToRad(to.lat);
  const deltaLon = degToRad(to.lon - from.lon);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return Math.atan2(y, x);
}

function moveByBearing(
  lon: number,
  lat: number,
  distanceM: number,
  bearingRad: number
): { lon: number; lat: number } {
  const meanLatRad = degToRad(lat);

  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(meanLatRad);

  const northM = Math.cos(bearingRad) * distanceM;
  const eastM = Math.sin(bearingRad) * distanceM;

  return {
    lon: lon + eastM / metersPerDegLon,
    lat: lat + northM / metersPerDegLat,
  };
}

export function sampleParticlesRouteMotion(
  particles: Particle[],
  deltaDistanceM: number,
  options?: RouteMotionOptions
): Particle[] {
  if (!particles.length) return [];
  if (!Number.isFinite(deltaDistanceM) || deltaDistanceM <= 0) {
    return particles;
  }

  const distanceNoiseStdM = options?.distanceNoiseStdM ?? 1.5;
  const headingNoiseDeg = options?.headingNoiseDeg ?? 3;
  const direction = options?.direction ?? "forward";

  const from = direction === "forward" ? TEST_ROUTE_START : TEST_ROUTE_END;
  const to = direction === "forward" ? TEST_ROUTE_END : TEST_ROUTE_START;

  const baseBearingRad = calculateBearingRad(from, to);

  return particles.map((particle) => {
    const noisyDistance = Math.max(
      0,
      deltaDistanceM + gaussianRandom(0, distanceNoiseStdM)
    );

    const noisyBearingRad =
      baseBearingRad + degToRad(gaussianRandom(0, headingNoiseDeg));

    const moved = moveByBearing(
      particle.x,
      particle.y,
      noisyDistance,
      noisyBearingRad
    );

    const dirX = Math.sin(noisyBearingRad);
    const dirY = Math.cos(noisyBearingRad);

    return {
      ...particle,
      x: moved.lon,
      y: moved.lat,
      dirX,
      dirY,
    };
  });
}

export function getTestRouteBearingDeg(
  direction: "forward" | "backward" = "forward"
): number {
  const from = direction === "forward" ? TEST_ROUTE_START : TEST_ROUTE_END;
  const to = direction === "forward" ? TEST_ROUTE_END : TEST_ROUTE_START;

  const bearingRad = calculateBearingRad(from, to);
  return (radToDeg(bearingRad) + 360) % 360;
}