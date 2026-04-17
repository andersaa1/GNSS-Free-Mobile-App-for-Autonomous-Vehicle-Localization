export type Particle = {
  id: number;
  x: number; // longtitute
  y: number; // latitute
  weight: number;
  dirX: number; // direction vector in longtitute axis
  dirY: number; // direction vector in latitute axis

  segLon1: number;
  segLat1: number;
  segLon2: number;
  segLat2: number;

  segT: number; // progress on segment in [0,1]
};