import { loadLibertyStyle, getMapTiles, patchStyleToTiles } from "../services/maps/style";

// Function that loads the base style JSON, gets the location of map tiles and patches the style's JSON with the map tiles location
export default async function loadBaseStyle(): Promise<any> {
    const style = await loadLibertyStyle();
    const tiles = getMapTiles();
    const styledTiles = patchStyleToTiles(style, tiles);

    return styledTiles;
}