export type Speed = {
    speed: number; // speed in m/s
    timestamp: number;
}

type SpeedListenter = (speed: Speed) => void;

const listeners = new Set<SpeedListenter>();

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

// Mock state
let currentSpeed = 0;

function emit(speed: Speed) {
    for (const listener of listeners) {
        listener(speed)
    }
}

// Subscribe to speed updates and returns an unsubscribe function
export function onSpeedChanged(listener: SpeedListenter): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

// Returns the most recent speed value
export function getCurrentSpeed(): number {
  return currentSpeed;
}

// Starts the mock speed sensor
export function startSpeedSensor(updateHz = 2): void {
    if (running) return;

    running = true;
    const interval = 1000 / updateHz;

    intervalId = setInterval(() => {
        // small random variation between 0 and -8 m/s
        const nextSpeed = Math.max(
            0,
            Math.min(8, currentSpeed + (Math.random() - 0.5) * 1.2)
        );

        currentSpeed = nextSpeed;

        emit({
            speed: currentSpeed,
            timestamp: Date.now(),
        });
    }, interval);
}

// Stops the speed sensor
export function stopSpeedSensor(): void {
    running = false;

    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}