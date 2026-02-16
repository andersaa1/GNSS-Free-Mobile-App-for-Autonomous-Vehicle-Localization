import { loadStyle, getMapTiles, patchStyleToTiles } from "../services/maps/style";

export type MapStyleId = "liberty" | "bright" | "positron";

// Function that loads the base style JSON, gets the location of map tiles and patches the style's JSON with the map tiles location
export default async function loadBaseStyle(styleName: MapStyleId): Promise<any> {
    const style = await loadStyle(styleName);
    const tiles = getMapTiles();
    return patchStyleToTiles(style, tiles);
}