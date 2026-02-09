import fs from "fs";
import path from "path";

const INPUT = path.resolve("src/assets/data/estonia-roads.json");
const OUTDIR = path.resolve("src/assets/road_tiles");
const Z = 12;

// WebMercator tile math
// https://www.analyze.earth/posts/web-mercator-tiles/

function lon2tileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * (1 << z));
}
function lat2tileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  const n = Math.tan(Math.PI / 4 + rad / 2);
  return Math.floor((1 - Math.log(n) / Math.PI) / 2 * (1 << z));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function bboxOfCoords(coords) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const c of coords) {
    const lon = c[0], lat = c[1];
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

function forEachLine(geom, cb) {
  if (!geom) return;
  if (geom.type === "LineString") cb(geom.coordinates);
  else if (geom.type === "MultiLineString") {
    for (const line of geom.coordinates) cb(line);
  }
}

function segCount(coords) {
  return Math.max(0, (Array.isArray(coords) ? coords.length : 0) - 1);
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

console.log("Reading", INPUT);
const roads = JSON.parse(fs.readFileSync(INPUT, "utf8"));
if (!roads || roads.type !== "FeatureCollection") throw new Error("Expected FeatureCollection");

const tileMap = new Map();
const weights = new Map();

let lineCount = 0;

for (const feature of roads.features) {
  const geom = feature.geometry;

  forEachLine(geom, (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return;

    const { minLon, minLat, maxLon, maxLat } = bboxOfCoords(coords);
    const minX = lon2tileX(minLon, Z);
    const maxX = lon2tileX(maxLon, Z);
    const minY = lat2tileY(maxLat, Z);
    const maxY = lat2tileY(minLat, Z);

    // Simple: include whole line in each overlapping tile (dup ok for now)
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        addToTile(tileMap, weights, Z, x, y, coords, feature.properties);
      }
    }

    lineCount++;
    if (lineCount % 5000 === 0) console.log("Processed lines:", lineCount);
  });
}

console.log("Tiles:", tileMap.size);

// Write tiles
for (const [key, feats] of tileMap.entries()) {
  const [z, x, y] = key.split("/");
  const dir = path.join(OUTDIR, z, x);
  ensureDir(dir);
  const file = path.join(dir, `${y}.json`);
  fs.writeFileSync(file, JSON.stringify({ type: "FeatureCollection", features: feats }));
}

// Write index
let totalW = 0;
const tiles = [];
for (const [key, w] of weights.entries()) {
  const [z, x, y] = key.split("/").map(Number);
  if (!w || w <= 0) continue;
  tiles.push({ z, x, y, w });
  totalW += w;
}

const index = { z: Z, totalW, tiles };
fs.writeFileSync(path.join(OUTDIR, `index_z${Z}.json`), JSON.stringify(index));

console.log("Wrote index:", path.join(OUTDIR, `index_z${Z}.json`));
console.log("Done.");