import RNFS from "react-native-fs";

export type Rgb = { r: number; g: number; b: number };

let cachedStyle: any | null = null;

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
  if (cachedStyle) return cachedStyle; // returns the style object if it's already loaded  
  
  const path = `${RNFS.MainBundlePath}/styles/${style}.json`;
  const text = await RNFS.readFile(path, "utf8"); // reads the style JSON file into a string
  const styleJSON = JSON.parse(text); // converts the style string into a JSON file

  cachedStyle = styleJSON;

  return cachedStyle;
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
 * Expects: a layer
 * Returns: true or false.
 */
function isTransportationLineLayer(layer: any): boolean {
  // filters to layers only drawn as lines with internal layer named "transportation"
  return layer.type === "line" && layer["source-layer"] === "transportation";
}

/**
 * Function that creates a new array that multiplies the width which scales with the zoom.
 * Expects: reference to the "line-width" layer and the width multiplier.
 * Returns: a new array with multiplied width.
 */
function scaleRoadWidth(expr: any, mult: number): any {
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
 * Returns: RGB object as string
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
    if (!isTransportationLineLayer(layer)) continue;

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