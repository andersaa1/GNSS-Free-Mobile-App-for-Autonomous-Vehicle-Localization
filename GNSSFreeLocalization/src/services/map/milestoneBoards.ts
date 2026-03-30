import proj4 from "proj4";
import milestoneBoardsJSON from "../../assets/data/milestone-boards-cleaned.json";
import type { MilestoneBoard } from "../../types/MilestoneBoard";

// For converting EPSG:3301 to WGS84 (lon/lat)
  // AI used
  const EPSG3301 =
  "+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 " +
  "+lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +units=m +no_defs";

  proj4.defs("EPSG:3301", EPSG3301);
  proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

  // Makes milestone boards usable inside the map
  export const milestoneBoards: MilestoneBoard[] = milestoneBoardsJSON.features.map((feature: any) => {
  const [x, y] = feature.geometry.coordinates;
  const [lon, lat] = proj4("EPSG:3301", "EPSG:4326", [x, y]);

  return {
    oid: feature.properties.oid,
    roadNumber: feature.properties.tee_number,
    roadName: feature.properties.tee_nimi,
    direction: feature.properties.direction,
    signs: feature.properties.signs,
    lon,
    lat,
  };
});