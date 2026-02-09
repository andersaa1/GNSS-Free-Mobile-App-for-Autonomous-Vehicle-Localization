export type Particle = {
  id: number;
  x: number;
  y: number;
  weight: number;
};

export type Segment = [[number, number], [number, number]];

export function sampleRandomParticles(
  segments: Segment[],
  count: number
): Particle[] {
  if (!segments.length) {
    console.warn("No road segments available for particle sampling.");
    return [];
  }

  const particles: Particle[] = [];
  const n = Math.max(0, Math.floor(count));

  for (let i = 0; i < n; i++) {
    const segIndex = Math.floor(Math.random() * segments.length);
    const [a, b] = segments[segIndex];
    const t = Math.random();
    const lon = a[0] + (b[0] - a[0]) * t;
    const lat = a[1] + (b[1] - a[1]) * t;
    particles.push({ id: i, x: lon, y: lat, weight: 1 / n || 0 });
  }
  return particles;
}
