import fs from "fs";
import path from "path";

const INPUT = path.resolve("src/assets/data/estonia-roads.json");
const OUTDIR = path.resolve("src/assets/tiles/road_tiles");
const OUTFILE = path.join(OUTDIR, "road_point_pool_z12.json");
const POOL_SIZE = 100000;

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

// Store segments as compact arrays:
// [lon1, lat1, lon2, lat2, len]
const segments = [];

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

      segments.push([a[0], a[1], b[0], b[1], len]);
      segmentCount++;
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

// Build prefix sums for weighted segment sampling
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

// Precompute road points
// Store as compact arrays: [lon, lat, dx, dy]
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

  // local direction vector of the source segment
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;

  points[i] = [lon, lat, dx, dy];

  if (i > 0 && i % 10000 === 0) {
    console.log(`Generated ${i}/${POOL_SIZE} road points`);
  }
}

const out = {
  poolSize: POOL_SIZE,
  points,
};

ensureDir(OUTDIR);
fs.writeFileSync(OUTFILE, JSON.stringify(out));

console.log("Wrote:", OUTFILE);
console.log("Done.");