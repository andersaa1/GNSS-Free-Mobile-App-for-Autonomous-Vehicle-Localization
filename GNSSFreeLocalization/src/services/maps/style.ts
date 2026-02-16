import RNFS from "react-native-fs";

export type Rgb = { r: number; g: number; b: number };

let cachedStyles: Record<string, any> = {};

/**
 * Function for returning the path of map tiles that are bundled inside the app.
 */
export function getMapTiles() {
  return `file://${RNFS.MainBundlePath}/tiles/map_tiles/estonia/{z}/{x}/{y}.pbf`;
}

/**
 * Function that reads the style JSON and returns it.
 * Extract: https://tiles.openfreemap.org/styles/liberty.
 * Expects: name of the style JSON (liberty/bright/positron)
 * Returns: style JSON
 */
export async function loadStyle(style: string): Promise<any> {
  if (cachedStyles[style]) return cachedStyles[style]; // returns the style object if it's already loaded  
  
  const path = `${RNFS.MainBundlePath}/styles/${style}.json`;
  const text = await RNFS.readFile(path, "utf8"); // reads the style JSON file into a string
  const styleJSON = JSON.parse(text); // converts the style string into a JSON file

  cachedStyles[style] = styleJSON;

  return cachedStyles[style];
}

/**  
 * Function that replaces source reference inside the style file with a new source definition that points to local tiles.
 * Expects: style's JSON & bundled map tiles.
 * Returns: updated style JSON with the source pointing to bundled map tiles.
 */
export function patchStyleToTiles(style: any, tiles: string) {
  // replaces all sources named "openmaptiles" with new source that uses local map tiles
  style.sources.openmaptiles = {
    type: "vector",
    tiles: [tiles],
    minzoom: 0,
    maxzoom: 12,
  };

  return style;
}

/**
 * Function that checks if a layer is the transportation (road) layer.
 * Expects: a map layer.
 * Returns: true or false.
 */
function isRoadLayer(layer: any): boolean {
  if (layer?.type !== "line") return false;
  if (layer?.["source-layer"] !== "transportation") return false;

  // allowed transportation layer classes
  const classes = ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "link"];

  const filter = layer.filter;

  return filterClass(filter, classes);
}

/**
 * Helper function for is RoadLayer function, that checks if a layer belongs to correct road layers.
 * Expects: filter layer and allowed transportation layer classes.
 * Returns: true or false, whether the transportation layer object belongs to allowed classes.
 */
function filterClass(filter: any, classes: string[]): boolean {
  if (!Array.isArray(filter)) return false;

  // ["==", ["get","class"], "primary"]
  if (
    filter[0] === "==" &&
    Array.isArray(filter[1]) &&
    filter[1][0] === "get" &&
    filter[1][1] === "class" &&
    typeof filter[2] === "string"
  ) {
    return classes.includes(filter[2]);
  }

  // ["in", ["get","class"], "primary","secondary",...]
  if (
    filter[0] === "in" &&
    Array.isArray(filter[1]) &&
    filter[1][0] === "get" &&
    filter[1][1] === "class"
  ) {
    return filter.slice(2).some((v) => typeof v === "string" && classes.includes(v));
  }

  // ["match", ["get","class"], ["primary","trunk"], true, false]
  if (
    filter[0] === "match" &&
    Array.isArray(filter[1]) &&
    filter[1][0] === "get" &&
    filter[1][1] === "class"
  ) {
    const candidates = filter[2];

    // candidates can be ["primary","trunk"] or sometimes a single string
    if (Array.isArray(candidates)) {
      return candidates.some((v) => typeof v === "string" && classes.includes(v));
    }
    if (typeof candidates === "string") {
      return classes.includes(candidates);
    }
  }

  // recurse through nested expressions like ["all", ...] / ["any", ...]
  return filter.some((x) => filterClass(x, classes));
}


/**
 * Function that creates a new array that multiplies the width which scales with the zoom.
 * Expects: reference to the "line-width" layer and the width multiplier.
 * Returns: a new array with multiplied width.
 */
function scaleRoadWidth(expr: any, mult: number): any {
  // if the style uses a plain number width (common in Positron style)
  if (typeof expr === "number") return expr * mult;

  const op = expr[0]; // "interpolate"

  // ["interpolate", ["linear"], ["zoom"], z0, v0, z1, v1, ...]
  const out = [...expr]; // makes a copy of the array
  for (let i = 4; i < out.length; i += 2) {
    out[i] = ["*", out[i], mult];
  }
  return out;
}

/**
 * Function that converts RGB object into a string.
 * Expects: RGB object and the step
 * Returns: RGB object as css string ("rgba(255, 120, 30, 0.5)")
 */
function rgbToRgba(c: Rgb, a = 1) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/**
 *  Function for painting roads and setting their width.
 *  Expects: style JSON & values from 'Settings'.
 *  Returns: new style JSON (copy with overrides) with custom options.
 */ 
export function buildStyleWithRoadOverrides(
  baseStyle: any,
  options: {
    roadColor: Rgb;
    roadWidth: number;
  }
) {
  
  const style = {
    ...baseStyle, // copies the baseStyle top-level keys into
    layers: baseStyle.layers.map((l: any) => ({ ...l })) // makes a new object for each layer
  };

  const color = rgbToRgba(options.roadColor, 1);

  // interpret slider as multiplier: slider=2 -> 1x
  const widthMult = Math.max(0.1, options.roadWidth / 2);

  for (const layer of style.layers) {
    if (!isRoadLayer(layer)) continue;

    // creates a new copy of paint object and store the reference
    const paint = (layer.paint = { ...(layer.paint ?? {}) });

    // color override
    paint["line-color"] = color;
    paint["line-opacity"] = 1;

    // width override without breaking zoom expressions
    const existing = paint["line-width"];
    paint["line-width"] = scaleRoadWidth(existing, widthMult);
  }

  return style;
}