import fs from "fs";
import path from "path";

const INPUT = path.resolve("src/assets/data/estonia-roads.json");
const OUTDIR = path.resolve("src/assets/tiles/road_tiles");
const Z = 12;

// WebMercator tile math
// https://www.analyze.earth/posts/web-mercator-tiles/

function lon2tileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * (1 << z));
}

function lat2tileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  const n = Math.tan(Math.PI / 4 + rad / 2);
  return Math.floor(((1 - Math.log(n) / Math.PI) / 2) * (1 << z));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function forEachLine(geom, cb) {
  if (!geom) return;

  if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
    cb(geom.coordinates);
  } else if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
    for (const line of geom.coordinates) {
      if (Array.isArray(line)) cb(line);
    }
  }
}

// Distance approximation in meters for small segments
function segmentLengthMeters(a, b) {
  const lon1 = a[0];
  const lat1 = a[1];
  const lon2 = b[0];
  const lat2 = b[1];

  const meanLatRad = ((lat1 + lat2) * 0.5 * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(meanLatRad);

  const dx = (lon2 - lon1) * metersPerDegLon;
  const dy = (lat2 - lat1) * metersPerDegLat;

  return Math.sqrt(dx * dx + dy * dy);
}


function addToTile(tileMap, weights, z, x, y, coords, props) {
  const key = `${z}/${x}/${y}`;
  if (!tileMap.has(key)) tileMap.set(key, []);
  tileMap.get(key).push({
    type: "Feature",
    properties: props ?? {},
    geometry: { type: "LineString", coordinates: coords },
  });

  // weight by number of segments in this line
  const w = segCount(coords);
  weights.set(key, (weights.get(key) ?? 0) + w);
}

function tileKey(z, x, y) {
  return `${z}/${x}/${y}`;
}

console.log("Reading", INPUT);
const roads = JSON.parse(fs.readFileSync(INPUT, "utf8"));

if (!roads || roads.type !== "FeatureCollection" || !Array.isArray(roads.features)) {
  throw new Error("Expected FeatureCollection");
}

/**
 * tileMap key: "z/x/y"
 * value: {
 *   z, x, y,
 *   totalLength,
 *   segments: [{ a:[lon,lat], b:[lon,lat], len }]
 * }
 */
const tileMap = new Map();

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

      // Skip zero/near-zero segments
      if (!Number.isFinite(len) || len <= 0.01) {
        skippedSegments++;
        continue;
      }

      const midLon = (a[0] + b[0]) * 0.5;
      const midLat = (a[1] + b[1]) * 0.5;

      const x = lon2tileX(midLon, Z);
      const y = lat2tileY(midLat, Z);
      const key = tileKey(Z, x, y);

      if (!tileMap.has(key)) {
        tileMap.set(key, {
          z: Z,
          x,
          y,
          totalLength: 0,
          segments: [],
        });
      }

      const tile = tileMap.get(key);
      tile.segments.push({
        a: [a[0], a[1]],
        b: [b[0], b[1]],
        len,
      });
      tile.totalLength += len;
      segmentCount++;
    }
  });

  if (featureCount % 5000 === 0) {
    console.log(
      `Processed features: ${featureCount}, lines: ${lineCount}, segments: ${segmentCount}`
    );
  }
}

console.log("Tiles:", tileMap.size);
console.log("Valid segments:", segmentCount);
console.log("Skipped segments:", skippedSegments);

// Write tile files
for (const [key, tile] of tileMap.entries()) {
  let acc = 0;
  const outSegments = tile.segments.map((s) => {
    acc += s.len;
    return {
      a: s.a,
      b: s.b,
      len: s.len,
      cum: acc,
    };
  });

  const dir = path.join(OUTDIR, String(tile.z), String(tile.x));
  ensureDir(dir);

  const file = path.join(dir, `${tile.y}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({
      z: tile.z,
      x: tile.x,
      y: tile.y,
      totalLength: tile.totalLength,
      segmentCount: outSegments.length,
      segments: outSegments,
    })
  );
}

// Write global weighted index
const tiles = [];
let totalW = 0;

for (const tile of tileMap.values()) {
  if (!Number.isFinite(tile.totalLength) || tile.totalLength <= 0) continue;

  tiles.push({
    z: tile.z,
    x: tile.x,
    y: tile.y,
    w: tile.totalLength,
  });

  totalW += tile.totalLength;
}

const index = {
  z: Z,
  totalW,
  tileCount: tiles.length,
  tiles,
};

ensureDir(OUTDIR);
fs.writeFileSync(
  path.join(OUTDIR, `index_z${Z}.json`),
  JSON.stringify(index)
);

console.log("Wrote index:", path.join(OUTDIR, `index_z${Z}.json`));
console.log("Done.");