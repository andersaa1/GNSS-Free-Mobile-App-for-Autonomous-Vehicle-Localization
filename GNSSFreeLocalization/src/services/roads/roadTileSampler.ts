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

export type RoadSegment = {
  lon1: number;
  lat1: number;
  lon2: number;
  lat2: number;
};

type SegmentRecord = RoadSegment & {
  id: number;
  key: string;
  aKey: string;
  bKey: string;
};

function endpointKey(lon: number, lat: number): string {
  return `${lon.toFixed(7)},${lat.toFixed(7)}`;
}

function canonicalSegmentKey(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): string {
  const a = endpointKey(lon1, lat1);
  const b = endpointKey(lon2, lat2);
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

function samePoint(
  lonA: number,
  latA: number,
  lonB: number,
  latB: number
): boolean {
  return endpointKey(lonA, latA) === endpointKey(lonB, latB);
}

function metersPerDegreeLon(latDeg: number): number {
  return 111320 * Math.cos((latDeg * Math.PI) / 180);
}

function distanceMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const meanLat = (lat1 + lat2) * 0.5;
  const dx = (lon2 - lon1) * metersPerDegreeLon(meanLat);
  const dy = (lat2 - lat1) * 111320;
  return Math.sqrt(dx * dx + dy * dy);
}

export class RoadTileSampler {
  private poolFile = `${RNFS.MainBundlePath}/tiles/road_tiles/road_point_pool_z12.json`;
  private pool: RoadPointPool | null = null;

  private segments: SegmentRecord[] = [];
  private byEndpoint = new Map<string, number[]>();

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
    this.buildSegmentIndex();
  }

  private findNearbyConnectedSegments(
    current: RoadSegment,
    exitLon: number,
    exitLat: number,
    maxDistanceM = 3
  ): SegmentRecord[] {
    const currentKey = canonicalSegmentKey(
      current.lon1,
      current.lat1,
      current.lon2,
      current.lat2
    );

    const candidates: SegmentRecord[] = [];

    for (const seg of this.segments) {
      if (seg.key === currentKey) continue;

      const da = distanceMeters(exitLon, exitLat, seg.lon1, seg.lat1);
      const db = distanceMeters(exitLon, exitLat, seg.lon2, seg.lat2);

      if (da <= maxDistanceM || db <= maxDistanceM) {
        candidates.push(seg);
      }
    }

    return candidates;
  }

  private buildSegmentIndex(): void {
    if (!this.pool) {
      throw new Error("Road point pool not initialized");
    }

    const seen = new Map<string, SegmentRecord>();
    let nextId = 0;

    for (const [, , lon1, lat1, lon2, lat2] of this.pool.points) {
      const key = canonicalSegmentKey(lon1, lat1, lon2, lat2);
      if (seen.has(key)) continue;

      const aKey = endpointKey(lon1, lat1);
      const bKey = endpointKey(lon2, lat2);

      const seg: SegmentRecord = {
        id: nextId++,
        key,
        lon1,
        lat1,
        lon2,
        lat2,
        aKey,
        bKey,
      };

      seen.set(key, seg);
    }

    this.segments = Array.from(seen.values());
    this.byEndpoint.clear();

    for (const seg of this.segments) {
      const aList = this.byEndpoint.get(seg.aKey) ?? [];
      aList.push(seg.id);
      this.byEndpoint.set(seg.aKey, aList);

      const bList = this.byEndpoint.get(seg.bKey) ?? [];
      bList.push(seg.id);
      this.byEndpoint.set(seg.bKey, bList);
    }
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

  pickConnectedSegment(
    current: RoadSegment,
    exitLon: number,
    exitLat: number
  ): RoadSegment | null {
    const key = endpointKey(exitLon, exitLat);
    const ids = this.byEndpoint.get(key);

    const currentKey = canonicalSegmentKey(
      current.lon1,
      current.lat1,
      current.lon2,
      current.lat2
    );

    let candidates: SegmentRecord[] = [];

    if (ids && ids.length > 0) {
      candidates = ids
        .map((id) => this.segments[id])
        .filter((seg) => seg.key !== currentKey);
    }

    if (!candidates.length) {
      candidates = this.findNearbyConnectedSegments(
        current,
        exitLon,
        exitLat,
        3
      );
    }

    if (!candidates.length) {
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    const d1 = distanceMeters(exitLon, exitLat, chosen.lon1, chosen.lat1);
    const d2 = distanceMeters(exitLon, exitLat, chosen.lon2, chosen.lat2);

    if (d1 <= d2) {
      return {
        lon1: chosen.lon1,
        lat1: chosen.lat1,
        lon2: chosen.lon2,
        lat2: chosen.lat2,
      };
    }

    return {
      lon1: chosen.lon2,
      lat1: chosen.lat2,
      lon2: chosen.lon1,
      lat2: chosen.lat1,
    };
  }
}