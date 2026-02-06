import Geolocation, { GeoPosition } from "react-native-geolocation-service"

export type GpsFix = {
    lat: number;
    lon: number;
    timestamp: number;
}

type Listener = (fix: GpsFix) => void;

let watchId: number | null = null;
const listeners = new Set<Listener>();

export function onGpsFix(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export async function startGps(options?: {
    enableHighAccuracy?: boolean;
    distanceFilterM?: number;
    intervalMs?: number;
    fastestIntervalMs?: number;
}): Promise<void> {
    if (watchId !== null) return;

    watchId = Geolocation.watchPosition(
        (pos: GeoPosition) => {
            const c = pos.coords;
            const fix: GpsFix = {
                lat: c.latitude,
                lon: c.longitude,
                timestamp: pos.timestamp ?? Date.now(),
            };
            for (const l of listeners) l(fix);
        },
        (err) => {
            console.warn("GPS error:", err)
        },
        {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            distanceFilter: options?.distanceFilterM ?? 1,
            interval: options?.intervalMs ?? 1000,
            fastestInterval: options?.fastestIntervalMs ?? 500,
            forceRequestLocation: true,
            showLocationDialog: true
        }
    );
}

export function stopGps(): void {
    if (watchId === null) return;
    Geolocation.clearWatch(watchId);
    watchId = null;
}