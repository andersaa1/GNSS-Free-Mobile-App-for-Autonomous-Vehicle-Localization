import { onSpeedChanged, type Speed } from "../sensors/speedSensor";

export type Distance = {
    totalDistance: number; // distance in meters
    deltaDistance: number;
    speed: number; // speed in m/s
    timestamp: number;
};

type DistanceListener = (sample: Distance) => void;

const listeners = new Set<DistanceListener>();

let unsubscribeFromSpeed: (() => void) | null = null;
let running = false;

let totalDistance = 0; // total distance in meters
let last: Speed | null = null;

function emit(distance: Distance) {
    for (const listener of listeners) {
        listener(distance);
    }
}

export function onDistanceChanged(listener: DistanceListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function resetDistanceTracker(): void {
    totalDistance = 0;
    last = null;
}

export function startDistanceTracker(): void {
    if (running) return;
    running = true;

    unsubscribeFromSpeed = onSpeedChanged((current) => {
        if (!last) {
            last = current;
            return;
        }

        const deltaSeconds = (current.timestamp - last.timestamp) / 1000;

        if (deltaSeconds <= 0) {
            last = current;
            return;
        }

        const avgSpeed = (last.speed + current.speed) / 2;

        const deltaDistance = avgSpeed * deltaSeconds;
        totalDistance += deltaDistance;

        emit({
            totalDistance,
            deltaDistance,
            speed: current.speed,
            timestamp: current.timestamp,
        });

        last = current;
    });
}

export function stopDistanceTracker(): void {
    running = false;

    if (unsubscribeFromSpeed) {
        unsubscribeFromSpeed();
        unsubscribeFromSpeed = null;
    }

    last = null;
}