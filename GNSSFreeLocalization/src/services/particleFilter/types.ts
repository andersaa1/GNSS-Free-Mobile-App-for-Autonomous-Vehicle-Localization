export type Particle = {
  id: number;
  x: number; // longtitute
  y: number; // latitute
  weight: number;
  dirX: number; // direction vector in longtitute axis
  dirY: number; // direction vector in latitute axis
};