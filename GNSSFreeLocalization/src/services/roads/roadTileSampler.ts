import RNFS from "react-native-fs";

export type Segment = [[number, number], [number, number]];

type IndexTile = { z: number; x: number; y: number; w: number };
type TileIndex = { z: number; totalW: number; tiles: IndexTile[] };

function segmentsFromFeatureCollection(fc: any): Segment[] {
  const segments: Segment[] = [];
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return segments;

  for (const feature of fc.features) {
    const g = feature?.geometry;
    if (!g) continue;

    if (g.type === "LineString" && Array.isArray(g.coordinates)) {
      const c = g.coordinates;
      for (let i = 0; i < c.length - 1; i++) segments.push([c[i], c[i + 1]]);
    } else if (g.type === "MultiLineString" && Array.isArray(g.coordinates)) {
      for (const line of g.coordinates) {
        if (!Array.isArray(line)) continue;
        for (let i = 0; i < line.length - 1; i++) segments.push([line[i], line[i + 1]]);
      }
    }
  }
  return segments;
}

export class RoadTileSampler {
  private bundleRoot = `${RNFS.MainBundlePath}/tiles/road_tiles`;
  private index: TileIndex | null = null;

  private cumW: number[] = []; // prefix sums aligned to index.tiles
  private totalW = 0;

  // Cache segments per tile (NOT whole Estonia)
  private segCache = new Map<string, Segment[]>();
  private maxCachedTiles = 40;

  async init(z = 12) {
    if (this.index) return;

    const p = `${this.bundleRoot}/index_z${z}.json`;
    const txt = await RNFS.readFile(p, "utf8");
    const idx = JSON.parse(txt) as TileIndex;

    if (!idx || idx.z !== z || !Array.isArray(idx.tiles) || typeof idx.totalW !== "number") {
      throw new Error("Invalid tile index");
    }

    this.index = idx;

    // Build prefix sums
    this.cumW = new Array(idx.tiles.length);
    let acc = 0;
    for (let i = 0; i < idx.tiles.length; i++) {
      acc += idx.tiles[i].w;
      this.cumW[i] = acc;
    }
    this.totalW = acc;
  }

  private pickTile(): IndexTile {
    if (!this.index) throw new Error("RoadTileSampler not initialized");

    const r = Math.random() * this.totalW;

    // binary search in cumW
    let lo = 0;
    let hi = this.cumW.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (r <= this.cumW[mid]) hi = mid;
      else lo = mid + 1;
    }
    return this.index.tiles[lo];
  }

  private cacheSet(key: string, segs: Segment[]) {
    this.segCache.set(key, segs);
    if (this.segCache.size > this.maxCachedTiles) {
      const oldestKey = this.segCache.keys().next().value;
      if (oldestKey !== undefined) this.segCache.delete(oldestKey);
    }
  }

  private async loadTileSegments(t: IndexTile): Promise<Segment[] | null> {
    const key = `${t.z}/${t.x}/${t.y}`;
    if (this.segCache.has(key)) return this.segCache.get(key)!;

    const p = `${this.bundleRoot}/${t.z}/${t.x}/${t.y}.json`;
    try {
      const txt = await RNFS.readFile(p, "utf8");
      const fc = JSON.parse(txt);
      const segs = segmentsFromFeatureCollection(fc);
      this.cacheSet(key, segs);
      return segs;
    } catch {
      return null;
    }
  }

  async sampleGlobalParticles(count: number): Promise<Array<{ lon: number; lat: number }>> {
    await this.init(12);

    const n = Math.max(0, Math.floor(count));
    const out: Array<{ lon: number; lat: number }> = [];

    for (let i = 0; i < n; i++) {
      // pick a fresh tile for each particle (spread!)
      let segs: Segment[] | null = null;

      // retry a few times in case we picked an empty/missing tile
      for (let tries = 0; tries < 6 && !segs; tries++) {
        const tile = this.pickTile();
        const loaded = await this.loadTileSegments(tile);
        if (loaded && loaded.length) segs = loaded;
      }

      if (!segs || !segs.length) continue;

      const segIndex = Math.floor(Math.random() * segs.length);
      const [a, b] = segs[segIndex];
      const t = Math.random();

      const lon = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;

      out.push({ lon, lat });
    }

    return out;
  }
}
