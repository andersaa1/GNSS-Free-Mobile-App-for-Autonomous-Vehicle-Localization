import RNFS from "react-native-fs";

export type Segment = [[number, number], [number, number]];

const Z = 12;
const TILE_RADIUS = 2; // 2 tiles around center -> (2*2+1)^2 = 25 tiles

function lon2tileX(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * (1 << z));
}
function lat2tileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  const n = Math.tan(Math.PI / 4 + rad / 2);
  return Math.floor((1 - Math.log(n) / Math.PI) / 2 * (1 << z));
}

function tileKey(z: number, x: number, y: number) {
  return `${z}/${x}/${y}`;
}

type FeatureCollection = { type: "FeatureCollection"; features: any[] };

export class RoadTileCache {
  private cache = new Map<string, FeatureCollection>();

  // iOS bundle path: <MainBundlePath>/road_tiles/12/x/y.json (after you add to bundle resources)
  private bundleRoot = `${RNFS.MainBundlePath}/road_tiles`;

  async loadTile(z: number, x: number, y: number): Promise<FeatureCollection | null> {
    const key = tileKey(z, x, y);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const p = `${this.bundleRoot}/${z}/${x}/${y}.json`;

    try {
      const txt = await RNFS.readFile(p, "utf8");
      const json = JSON.parse(txt) as FeatureCollection;
      if (!json || json.type !== "FeatureCollection" || !Array.isArray(json.features)) {
        return null;
      }
      this.cache.set(key, json);
      return json;
    } catch {
      // tile may not exist (no roads there)
      return null;
    }
  }

  async loadAround(lon: number, lat: number): Promise<void> {
    const cx = lon2tileX(lon, Z);
    const cy = lat2tileY(lat, Z);

    const tasks: Promise<any>[] = [];
    for (let dx = -TILE_RADIUS; dx <= TILE_RADIUS; dx++) {
      for (let dy = -TILE_RADIUS; dy <= TILE_RADIUS; dy++) {
        tasks.push(this.loadTile(Z, cx + dx, cy + dy));
      }
    }
    await Promise.all(tasks);
  }

  getMergedGeoJSON(): FeatureCollection {
    const features: any[] = [];
    for (const fc of this.cache.values()) {
      features.push(...fc.features);
    }
    return { type: "FeatureCollection", features };
  }

  getSegments(): Segment[] {
    const segments: Segment[] = [];

    for (const fc of this.cache.values()) {
      for (const feature of fc.features) {
        const geom = feature?.geometry;
        if (!geom) continue;

        if (geom.type === "LineString") {
          const coords = geom.coordinates;
          if (!Array.isArray(coords)) continue;
          for (let i = 0; i < coords.length - 1; i++) {
            segments.push([coords[i], coords[i + 1]]);
          }
        } else if (geom.type === "MultiLineString") {
          const lines = geom.coordinates;
          if (!Array.isArray(lines)) continue;
          for (const line of lines) {
            if (!Array.isArray(line)) continue;
            for (let i = 0; i < line.length - 1; i++) {
              segments.push([line[i], line[i + 1]]);
            }
          }
        }
      }
    }

    return segments;
  }
}
