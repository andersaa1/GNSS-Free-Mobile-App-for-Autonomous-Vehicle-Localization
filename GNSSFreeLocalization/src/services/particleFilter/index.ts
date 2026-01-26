export type Particle = {
    id: number;
    x: number;
    y: number;
    weight: number;
};

// Sampler for testing purposes that picks random points along road segments.
export function sampleRandomParticles(
    roadsGeoJSON: any,
    count: number
): Particle[] {
    const segments: Array<[[number, number], [number, number]]> = [];

    if (
        roadsGeoJSON &&
        typeof roadsGeoJSON.type === 'string' &&
        roadsGeoJSON.type == 'FeatureCollection' &&
        Array.isArray(roadsGeoJSON.features)
    ) {
        for (const feature of roadsGeoJSON.features) {
            const geom = feature.geometry;
            if (!geom) continue;

            if (geom.type === 'LineString') {
                const coords = geom.coordinates;
                if (!Array.isArray(coords)) continue;

                for (let i = 0; i < coords.length - 1; i++) {
                    segments.push([coords[i], coords[i + 1]]);
                }
            } else if (geom.type === 'MultiLineString') {
                const lines = geom.coordinates;
                if (!Array.isArray(lines)) continue;

                for (const line of lines) {
                    if (!Array.isArray(line)) continue;
                    for (let i = 0; i < line.length - 1; i++) {
                        segments.push([line[i], line[i +1]]);
                    }
                }
            }
        }
    }

    if (segments.length == 0) {
        console.warn('No road segments found in GeoJSON for particle sampling.');
        return [];
    }

    const particles: Particle[] = [];
    const n = Math.max(0, Math.floor(count));

    for (let i = 0; i < n; i++) {
        // Pick a random segment
        const segIndex = Math.floor(Math.random() * segments.length);
        const [a, b] = segments[segIndex];
        const t = Math.random();
        
        // Interpolate along the segment
        const lon = a[0] + (b[0] - a[0]) * t;
        const lat = a[1] + (b[1] - a[1]) * t;

        particles.push({
            id: i,
            x: lon,
            y: lat,
            weight: 1 / n || 0,
        });
    }

    return particles;
}