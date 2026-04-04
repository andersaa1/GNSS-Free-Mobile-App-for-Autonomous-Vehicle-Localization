import RNFS from "react-native-fs";

type RoadPointEntry = [number, number, number, number]; // lon, lat, dx, dy

type RoadPointPool = {
  poolSize: number;
  points: RoadPointEntry[];
};

export type SampledRoadPoint = {
  lon: number;
  lat: number;
};

export class RoadTileSampler {
  private poolFile = `${RNFS.MainBundlePath}/tiles/road_tiles/road_point_pool_z12.json`;
  private pool: RoadPointPool | null = null;

  async init(): Promise<void> {
    if (this.pool) return;

    const txt = await RNFS.readFile(this.poolFile, "utf8");
    const parsed = JSON.parse(txt) as RoadPointPool;

    if (
      !parsed ||
      typeof parsed.poolSize !== "number" ||
      !Array.isArray(parsed.points) ||
      parsed.points.length === 0
    ) {
      throw new Error("Invalid road point pool");
    }

    this.pool = parsed;
  }

  private pickPoint(): RoadPointEntry {
    if (!this.pool || !this.pool.points.length) {
      throw new Error("Road point pool not initialized");
    }

    const idx = Math.floor(Math.random() * this.pool.points.length);
    return this.pool.points[idx];
  }

  private sampleFromPoolEntry(entry: RoadPointEntry): SampledRoadPoint {
    const [lon, lat, dx, dy] = entry;

    // Tiny random jitter along the local road direction so repeated runs
    // do not always give exactly the same fixed pool points.
    const dirLen = Math.sqrt(dx * dx + dy * dy);

    if (!Number.isFinite(dirLen) || dirLen <= 0) {
      return { lon, lat };
    }

    const ux = dx / dirLen;
    const uy = dy / dirLen;

    // Small longitudinal jitter in degrees.
    // Particle stays near the original road segment.
    const jitter = (Math.random() - 0.5) * 0.00005;

    return {
      lon: lon + ux * jitter,
      lat: lat + uy * jitter,
    };
  }

  async sampleInitialParticles(count: number): Promise<SampledRoadPoint[]> {
    await this.init();

    const n = Math.max(0, Math.floor(count));
    if (n === 0) return [];

    const out: SampledRoadPoint[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const entry = this.pickPoint();
      out[i] = this.sampleFromPoolEntry(entry);
    }

    return out;
  }
}