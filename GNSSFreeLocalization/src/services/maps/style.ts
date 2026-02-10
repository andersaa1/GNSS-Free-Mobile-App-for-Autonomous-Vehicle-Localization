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
 * Function that reads the liberty style file and returns it.
 * Extract: https://tiles.openfreemap.org/styles/liberty.
 * Returns: Liberty style JSON
 */
export async function loadLibertyStyle(): Promise<any> {
  if (cachedStyle) return cachedStyle; // returns the style object if it's already loaded  
  
  const path = `${RNFS.MainBundlePath}/styles/liberty.json`;
  const text = await RNFS.readFile(path, "utf8"); // reads the style JSON file into a string
  const styleJSON = JSON.parse(text); // converts the style string into a JSON file

  cachedStyle = styleJSON;

  return cachedStyle;
}

/**  
 * Function that overrides OpenMapTiles source inside the style file to read local tile files instead.
 * Takes in: style's JSON & bundled map tiles.
 * Returns: updated style JSON with the source pointing to bundled map tiles.
 */
export function patchStyleToTiles(style: any, tiles: string) {
  // replaces all sources named "openmaptiles" with new source
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
 * Takes in: a layer
 * Returns: true or false.
 */
function isTransportationLineLayer(layer: any): boolean {
  return layer?.type === "line" && layer["source-layer"] === "transportation";
}

/**
 * Fix for the MapLibre warning:
 * You cannot nest ["zoom"] under ["*", ...].
 * So if line-width is a zoom-based interpolate/step, we multiply the OUTPUTS.
 */
function scaleWidthExpression(expr: any, mult: number): any {
  if (typeof expr === "number") return expr * mult;

  if (!Array.isArray(expr) || expr.length < 2) {
    // Unknown structure. This may still fail if it contains ["zoom"] deep inside,
    // but in practice liberty road widths are interpolate/step.
    return ["*", expr, mult];
  }

  const op = expr[0];

  // ["interpolate", ["linear"], ["zoom"], z0, v0, z1, v1, ...]
  if (op === "interpolate" && Array.isArray(expr[2]) && expr[2][0] === "zoom") {
    const out = [...expr];
    for (let i = 4; i < out.length; i += 2) {
      if (typeof out[i] === "number") out[i] = out[i] * mult;
      else out[i] = ["*", out[i], mult];
    }
    return out;
  }

  // ["step", ["zoom"], default, stop1, out1, stop2, out2, ...]
  if (op === "step" && Array.isArray(expr[1]) && expr[1][0] === "zoom") {
    const out = [...expr];

    // default output
    if (typeof out[2] === "number") out[2] = out[2] * mult;
    else out[2] = ["*", out[2], mult];

    // step outputs at 4,6,8...
    for (let i = 4; i < out.length; i += 2) {
      if (typeof out[i] === "number") out[i] = out[i] * mult;
      else out[i] = ["*", out[i], mult];
    }
    return out;
  }

  // If it isn't zoom-based step/interpolate, multiplying is usually fine.
  return ["*", expr, mult];
}

function rgbToRgba(c: Rgb, a = 1) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

/**
 *  Function for painting roads and setting their width.
 *  Takes in: style JSON & values from 'Settings'.
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
    ...baseStyle, // copies the baseStyle top-level keys
    layers: baseStyle.layers.map((l: any) => ({ ...l })) 
  };

  const color = rgbToRgba(options.roadColor, 1);

  // interpret your slider as multiplier: slider=2 -> 1x
  const widthMult = Math.max(0.1, options.roadWidth / 2);

  for (const layer of style.layers) {
    if (!isTransportationLineLayer(layer)) continue;

    const paint = (layer.paint = { ...(layer.paint ?? {}) });

    // color override
    paint["line-color"] = color;
    paint["line-opacity"] = 1;

    // width override without breaking zoom expressions
    const existing = paint["line-width"];
    if (existing == null) paint["line-width"] = 1 * widthMult;
    else paint["line-width"] = scaleWidthExpression(existing, widthMult);
  }

  return style;
}