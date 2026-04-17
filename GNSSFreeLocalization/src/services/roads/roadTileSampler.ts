import RNFS from "react-native-fs";

type RoadPointEntry = [number, number, number, number, number, number];
// [lon, lat, lon1, lat1, lon2, lat2]

type RoadPointPool = {
  poolSize: number;
  points: RoadPointEntry[];
};

export type SampledRoadPoint = {
  lon: number;
  lat: number;
  lon1: number;
  lat1: number;
  lon2: number;
  lat2: number;
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

  async sampleInitialParticles(count: number): Promise<SampledRoadPoint[]> {
    await this.init();

    const n = Math.max(0, Math.floor(count));
    if (n === 0) return [];

    const out: SampledRoadPoint[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const [lon, lat, lon1, lat1, lon2, lat2] = this.pickPoint();
      out[i] = { lon, lat, lon1, lat1, lon2, lat2 };
    }

    return out;
  }
}