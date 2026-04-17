import RNFS from "react-native-fs";
import type { Particle } from "../particleFilter/types";

type SegmentEntry = [number, number, number, number, number]; // lon1, lat1, lon2, lat2, lenMeters

type SegmentTileFile = {
  segmentCount: number;
  segments: SegmentEntry[];
};

export type SnappedRoadPoint = {
  lon: number;
  lat: number;
  dirX: number;
  dirY: number;
  distanceM: number;
};

const TILE_Z = 12;
const MAX_CACHED_TILES = 64;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clampLat(lat: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(len) || len <= 1e-12) {
    return { x: 1, y: 0 };
  }
  return { x: dx / len, y: dy / len };
}

function metersPerDegLon(latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  return 111320 * Math.cos(latRad);
}

function toLocalMeters(
  lon: number,
  lat: number,
  originLon: number,
  originLat: number
): { x: number; y: number } {
  return {
    x: (lon - originLon) * metersPerDegLon(originLat),
    y: (lat - originLat) * 111320,
  };
}

function fromLocalMeters(
  x: number,
  y: number,
  originLon: number,
  originLat: number
): { lon: number; lat: number } {
  const lonScale = metersPerDegLon(originLat);
  return {
    lon: originLon + (lonScale !== 0 ? x / lonScale : 0),
    lat: originLat + y / 111320,
  };
}

function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const latClamped = clampLat(lat);
  const n = 2 ** z;

  const x = Math.floor(((lon + 180) / 360) * n);

  const latRad = (latClamped * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

function tileKey(x: number, y: number): string {
  return `${x}_${y}`;
}

export class RoadSegmentIndex {
  private baseDir = `${RNFS.MainBundlePath}/tiles/road_tiles/road_segments_z12`;
  private cache = new Map<string, SegmentEntry[]>();
  private loading = new Map<string, Promise<void>>();
  private lru: string[] = [];

  async init(): Promise<void> {
    // no global preload needed
  }

  private touch(key: string): void {
    const idx = this.lru.indexOf(key);
    if (idx >= 0) this.lru.splice(idx, 1);
    this.lru.push(key);

    while (this.lru.length > MAX_CACHED_TILES) {
      const oldKey = this.lru.shift();
      if (!oldKey) break;
      this.cache.delete(oldKey);
    }
  }

  private async ensureTileLoaded(x: number, y: number): Promise<void> {
    const key = tileKey(x, y);

    if (this.cache.has(key)) {
      this.touch(key);
      return;
    }

    const existing = this.loading.get(key);
    if (existing) {
      await existing;
      return;
    }

    const p = (async () => {
      const file = `${this.baseDir}/${key}.json`;

      try {
        const exists = await RNFS.exists(file);
        if (!exists) {
          this.cache.set(key, []);
          this.touch(key);
          return;
        }

        const txt = await RNFS.readFile(file, "utf8");
        const parsed = JSON.parse(txt) as SegmentTileFile;

        if (!parsed || !Array.isArray(parsed.segments)) {
          this.cache.set(key, []);
          this.touch(key);
          return;
        }

        this.cache.set(key, parsed.segments);
        this.touch(key);
      } catch {
        this.cache.set(key, []);
        this.touch(key);
      }
    })();

    this.loading.set(key, p);

    try {
      await p;
    } finally {
      this.loading.delete(key);
    }
  }

  async preloadAroundPoint(lon: number, lat: number, rings = 1): Promise<void> {
    const center = lonLatToTile(lon, lat, TILE_Z);
    const tasks: Promise<void>[] = [];

    for (let dx = -rings; dx <= rings; dx++) {
      for (let dy = -rings; dy <= rings; dy++) {
        tasks.push(this.ensureTileLoaded(center.x + dx, center.y + dy));
      }
    }

    await Promise.all(tasks);
  }

  async preloadForParticles(
    particles: Particle[],
    deltaDistanceM: number,
    rings = 1
  ): Promise<void> {
    const seen = new Set<string>();
    const tasks: Promise<void>[] = [];

    for (const p of particles) {
      const current = lonLatToTile(p.x, p.y, TILE_Z);

      const dxMeters = p.dirX * deltaDistanceM;
      const dyMeters = p.dirY * deltaDistanceM;

      const predLon =
        p.x + (metersPerDegLon(p.y) !== 0 ? dxMeters / metersPerDegLon(p.y) : 0);
      const predLat = p.y + dyMeters / 111320;

      const predicted = lonLatToTile(predLon, predLat, TILE_Z);

      for (const tile of [current, predicted]) {
        for (let ox = -rings; ox <= rings; ox++) {
          for (let oy = -rings; oy <= rings; oy++) {
            const tx = tile.x + ox;
            const ty = tile.y + oy;
            const key = tileKey(tx, ty);

            if (seen.has(key)) continue;
            seen.add(key);
            tasks.push(this.ensureTileLoaded(tx, ty));
          }
        }
      }
    }

    await Promise.all(tasks);
  }

  private getCachedSegmentsNear(lon: number, lat: number, rings = 1): SegmentEntry[] {
    const center = lonLatToTile(lon, lat, TILE_Z);
    const out: SegmentEntry[] = [];

    for (let dx = -rings; dx <= rings; dx++) {
      for (let dy = -rings; dy <= rings; dy++) {
        const key = tileKey(center.x + dx, center.y + dy);
        const segs = this.cache.get(key);
        if (!segs || !segs.length) continue;
        out.push(...segs);
        this.touch(key);
      }
    }

    return out;
  }

  private projectOntoSegment(
    lon: number,
    lat: number,
    seg: SegmentEntry
  ): { lon: number; lat: number; distanceM: number } {
    const [lon1, lat1, lon2, lat2] = seg;

    const b = toLocalMeters(lon2, lat2, lon1, lat1);
    const p = toLocalMeters(lon, lat, lon1, lat1);

    const abx = b.x;
    const aby = b.y;
    const ab2 = abx * abx + aby * aby;

    if (!Number.isFinite(ab2) || ab2 <= 1e-12) {
      return {
        lon: lon1,
        lat: lat1,
        distanceM: Math.sqrt(p.x * p.x + p.y * p.y),
      };
    }

    const t = clamp((p.x * abx + p.y * aby) / ab2, 0, 1);

    const qx = abx * t;
    const qy = aby * t;

    const snapped = fromLocalMeters(qx, qy, lon1, lat1);

    const dx = p.x - qx;
    const dy = p.y - qy;

    return {
      lon: snapped.lon,
      lat: snapped.lat,
      distanceM: Math.sqrt(dx * dx + dy * dy),
    };
  }

  findNearestCompatibleSegment(
    lon: number,
    lat: number,
    dirX: number,
    dirY: number,
    options?: {
      maxSnapDistanceM?: number;
      minHeadingDot?: number;
      searchRings?: number;
    }
  ): SnappedRoadPoint | null {
    const maxSnapDistanceM = options?.maxSnapDistanceM ?? 20;
    const minHeadingDot = options?.minHeadingDot ?? 0.2;
    const searchRings = options?.searchRings ?? 1;

    const heading = normalize(dirX, dirY);
    const candidates = this.getCachedSegmentsNear(lon, lat, searchRings);

    let best: SnappedRoadPoint | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const seg of candidates) {
      const [lon1, lat1, lon2, lat2] = seg;
      const unit = normalize(lon2 - lon1, lat2 - lat1);

      const rawDot = heading.x * unit.x + heading.y * unit.y;
      const alignment = Math.abs(rawDot);

      if (alignment < minHeadingDot) continue;

      const proj = this.projectOntoSegment(lon, lat, seg);
      if (proj.distanceM > maxSnapDistanceM) continue;

      // Keep the segment direction aligned with the current particle heading
      const outDirX = rawDot >= 0 ? unit.x : -unit.x;
      const outDirY = rawDot >= 0 ? unit.y : -unit.y;

      const score = proj.distanceM - alignment * 2;

      if (score < bestScore) {
        bestScore = score;
        best = {
          lon: proj.lon,
          lat: proj.lat,
          dirX: outDirX,
          dirY: outDirY,
          distanceM: proj.distanceM,
        };
      }
    }

    return best;
  }
}