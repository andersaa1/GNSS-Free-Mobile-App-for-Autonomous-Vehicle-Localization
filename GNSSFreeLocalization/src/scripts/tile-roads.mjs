import fs from "fs";
import path from "path";

const INPUT = path.resolve("src/assets/data/estonia-roads.json");
const OUTDIR = path.resolve("src/assets/tiles/road_tiles");

const POINT_POOL_FILE = path.join(OUTDIR, "road_point_pool_z12.json");
const SEGMENT_TILE_DIR = path.join(OUTDIR, "road_segments_z12");

const POOL_SIZE = 100000;
const TILE_Z = 12;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function forEachLine(geom, cb) {
  if (!geom) return;

  if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
    cb(geom.coordinates);
    return;
  }

  if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
    for (const line of geom.coordinates) {
      if (Array.isArray(line)) cb(line);
    }
  }
}

function clampLat(lat) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

function lonLatToTile(lon, lat, z) {
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

function segmentLengthMeters(a, b) {
  const lon1 = a[0];
  const lat1 = a[1];
  const lon2 = b[0];
  const lat2 = b[1];

  const meanLatRad = (((lat1 + lat2) * 0.5) * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(meanLatRad);

  const dx = (lon2 - lon1) * metersPerDegLon;
  const dy = (lat2 - lat1) * metersPerDegLat;

  return Math.sqrt(dx * dx + dy * dy);
}

console.log("Reading", INPUT);
const roads = JSON.parse(fs.readFileSync(INPUT, "utf8"));

if (!roads || roads.type !== "FeatureCollection" || !Array.isArray(roads.features)) {
  throw new Error("Expected GeoJSON FeatureCollection");
}

// compact segment format: [lon1, lat1, lon2, lat2, lenMeters]
const segments = [];
const tileSegments = new Map();

let featureCount = 0;
let lineCount = 0;
let segmentCount = 0;
let skippedSegments = 0;

for (const feature of roads.features) {
  featureCount++;

  forEachLine(feature.geometry, (coords) => {
    lineCount++;

    if (!Array.isArray(coords) || coords.length < 2) return;

    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];

      if (
        !Array.isArray(a) ||
        !Array.isArray(b) ||
        a.length < 2 ||
        b.length < 2 ||
        !Number.isFinite(a[0]) ||
        !Number.isFinite(a[1]) ||
        !Number.isFinite(b[0]) ||
        !Number.isFinite(b[1])
      ) {
        skippedSegments++;
        continue;
      }

      const len = segmentLengthMeters(a, b);
      if (!Number.isFinite(len) || len <= 0.01) {
        skippedSegments++;
        continue;
      }

      const seg = [a[0], a[1], b[0], b[1], len];
      segments.push(seg);
      segmentCount++;

      // assign to tiles overlapped by segment bbox
      const minLon = Math.min(a[0], b[0]);
      const maxLon = Math.max(a[0], b[0]);
      const minLat = Math.min(a[1], b[1]);
      const maxLat = Math.max(a[1], b[1]);

      const tMin = lonLatToTile(minLon, maxLat, TILE_Z);
      const tMax = lonLatToTile(maxLon, minLat, TILE_Z);

      for (let tx = tMin.x; tx <= tMax.x; tx++) {
        for (let ty = tMin.y; ty <= tMax.y; ty++) {
          const key = `${tx}_${ty}`;
          let arr = tileSegments.get(key);
          if (!arr) {
            arr = [];
            tileSegments.set(key, arr);
          }
          arr.push(seg);
        }
      }
    }
  });

  if (featureCount % 5000 === 0) {
    console.log(
      `Processed features=${featureCount}, lines=${lineCount}, segments=${segmentCount}`
    );
  }
}

if (!segments.length) {
  throw new Error("No valid road segments found");
}

console.log("Valid segments:", segmentCount);
console.log("Skipped segments:", skippedSegments);

// weighted sampling by segment length
const cum = new Array(segments.length);
let totalW = 0;

for (let i = 0; i < segments.length; i++) {
  totalW += segments[i][4];
  cum[i] = totalW;
}

function pickWeightedSegment() {
  const r = Math.random() * totalW;

  let lo = 0;
  let hi = cum.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r <= cum[mid]) hi = mid;
    else lo = mid + 1;
  }

  return segments[lo];
}

// compact point format: [lon, lat, lon1, lat1, lon2, lat2]
const points = new Array(POOL_SIZE);

for (let i = 0; i < POOL_SIZE; i++) {
  const seg = pickWeightedSegment();

  const lon1 = seg[0];
  const lat1 = seg[1];
  const lon2 = seg[2];
  const lat2 = seg[3];

  const t = Math.random();
  const lon = lon1 + (lon2 - lon1) * t;
  const lat = lat1 + (lat2 - lat1) * t;

  points[i] = [lon, lat, lon1, lat1, lon2, lat2];

  if (i > 0 && i % 10000 === 0) {
    console.log(`Generated ${i}/${POOL_SIZE} road points`);
  }
}

ensureDir(OUTDIR);
ensureDir(SEGMENT_TILE_DIR);

fs.writeFileSync(
  POINT_POOL_FILE,
  JSON.stringify({
    poolSize: POOL_SIZE,
    points,
  })
);

for (const [key, segs] of tileSegments.entries()) {
  const file = path.join(SEGMENT_TILE_DIR, `${key}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({
      segmentCount: segs.length,
      segments: segs,
    })
  );
}

console.log("Wrote:", POINT_POOL_FILE);
console.log("Wrote segment tiles:", tileSegments.size);
console.log("Done.");