import RNFS from "react-native-fs";

export type Rgb = { r: number; g: number; b: number };

let cachedBaseStyle: any | null = null;

type StyleJSON = any;

export function getBundledEstoniaTilesTemplate() {
  // Bundled as: <MainBundlePath>/tiles/map_tiles/estonia
  return `file://${RNFS.MainBundlePath}/tiles/map_tiles/estonia/{z}/{x}/{y}.pbf`;
}

export function getBundledBackgroundTilesTemplate() {
  return `file://${RNFS.MainBundlePath}/tiles/background_tiles/background/{z}/{x}/{y}.pbf`;
}

export function patchLibertyToLocalEstoniaTiles(base: StyleJSON, tilesTemplate: string) {
  const style = JSON.parse(JSON.stringify(base));

  style.sources = style.sources ?? {};
  style.sources.openmaptiles = {
    type: "vector",
    tiles: [tilesTemplate],
    minzoom: 0,
    maxzoom: 12,
  };

  return style;
}

function absolutizeStyleUrls(style: any) {
  const origin = "https://tiles.openfreemap.org";

  if (typeof style?.sprite === "string") {
    if (style.sprite.startsWith("/")) style.sprite = origin + style.sprite;
  }

  if (typeof style?.glyphs === "string") {
    if (style.glyphs.startsWith("/")) style.glyphs = origin + style.glyphs;
  }

  if (style?.sources && typeof style.sources === "object") {
    for (const k of Object.keys(style.sources)) {
      const src = style.sources[k];
      if (!src) continue;

      if (typeof src.url === "string" && src.url.startsWith("/")) {
        src.url = origin + src.url;
      }

      if (Array.isArray(src.tiles)) {
        src.tiles = src.tiles.map((t: any) =>
          typeof t === "string" && t.startsWith("/") ? origin + t : t
        );
      }
    }
  }
}

export async function loadBaseLibertyStyle(): Promise<any> {
  if (cachedBaseStyle) return cachedBaseStyle;

  // you added assets/styles as a BLUE folder reference in Xcode
  const p = `${RNFS.MainBundlePath}/styles/liberty.json`;
  const txt = await RNFS.readFile(p, "utf8");
  const s = JSON.parse(txt);

  absolutizeStyleUrls(s);
  cachedBaseStyle = s;

  return cachedBaseStyle;
}

function rgbToRgba(c: Rgb, a = 1) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

// IMPORTANT: Liberty roads live in OpenMapTiles "transportation" source-layer.
// We only touch LINE layers there.
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

export function buildStyleWithRoadOverrides(
  baseStyle: any,
  opts: {
    highlightRoads: boolean;
    roadColor: Rgb;
    roadWidth: number; // your slider value
  }
) {
  // shallow clone + clone layers/paint objects we modify
  const style = {
    ...baseStyle,
    layers: Array.isArray(baseStyle.layers) ? baseStyle.layers.map((l: any) => ({ ...l })) : [],
  };

  if (!opts.highlightRoads) return style;

  const color = rgbToRgba(opts.roadColor, 1);

  // interpret your slider as multiplier: slider=2 -> 1x
  const widthMult = Math.max(0.1, opts.roadWidth / 2);

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

export function addBackgroundLandOceanAndCountryLabels(style: any, backgroundTilesTemplate: string) {
  const s = JSON.parse(JSON.stringify(style));

  // 1) add background source
  s.sources = s.sources ?? {};
  s.sources.background = {
    type: "vector",
    tiles: [backgroundTilesTemplate],
    minzoom: 0,
    maxzoom: 7,
  };

  // 2) create background layers (very simple)
  const bgOcean = {
    id: "bg-ocean",
    type: "fill",
    source: "background",
    "source-layer": "ocean",
    paint: { "fill-color": "#a0c8f0" }, // you can change later
  };

  const bgLand = {
    id: "bg-land",
    type: "fill",
    source: "background",
    "source-layer": "land",
    paint: { "fill-color": "#e7e3d6" },
  };

  const bgCountryLabels = {
    id: "bg-country-labels",
    type: "symbol",
    source: "background",
    "source-layer": "country_labels",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-font": ["Noto Sans Regular"], // matches Liberty-ish; can tweak
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#2b2b2b",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1,
    },
  };

  // 3) Place bg ocean/land at bottom; labels above them.
  // Put them BEFORE existing layers so Estonia details draw above.
  s.layers = [bgOcean, bgLand, bgCountryLabels, ...(s.layers ?? [])];

  return s;
}
