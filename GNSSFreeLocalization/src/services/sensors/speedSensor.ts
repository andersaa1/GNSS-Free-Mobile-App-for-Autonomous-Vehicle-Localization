import { onGpsFix, type GpsFix } from "./gps";
import { distanceMeters } from "../../utils/geo";

export type Speed = {
    speed: number; // speed in m/s
    timestamp: number;
}

type SpeedListenter = (speed: Speed) => void;

const listeners = new Set<SpeedListenter>();

let running = false;
let unsubscribeFromGps: (() => void) | null = null;

let currentSpeed = 0;
let lastGpsFix: GpsFix | null = null;
let lastPrintTime = 0;

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

// Starts the speed sensor by listening to gps fixes
export function startSpeedSensor(printIntervalSeconds = 2): void {
  if (running) return;

  running = true;

  unsubscribeFromGps = onGpsFix((currentGpsFix) => {
    if (!lastGpsFix) {
      lastGpsFix = currentGpsFix;
      return;
    }

    const deltaSeconds =
      (currentGpsFix.timestamp - lastGpsFix.timestamp) / 1000;

    if (deltaSeconds <= 0) {
      lastGpsFix = currentGpsFix;
      return;
    }

    const distance = distanceMeters(
      lastGpsFix.lat,
      lastGpsFix.lon,
      currentGpsFix.lat,
      currentGpsFix.lon
    );

    currentSpeed = distance / deltaSeconds;

    const speedSample: Speed = {
      speed: currentSpeed,
      timestamp: currentGpsFix.timestamp,
    };

    emit(speedSample);

    if (
      currentGpsFix.timestamp - lastPrintTime >=
      printIntervalSeconds * 1000
    ) {
      console.log(
        `Current speed: ${currentSpeed.toFixed(2)} m/s (${(
          currentSpeed * 3.6
        ).toFixed(2)} km/h)`
      );

      lastPrintTime = currentGpsFix.timestamp;
    }

    lastGpsFix = currentGpsFix;
  });
}

// Stops the speed sensor
export function stopSpeedSensor(): void {
  running = false;

  if (unsubscribeFromGps) {
    unsubscribeFromGps();
    unsubscribeFromGps = null;
  }

  currentSpeed = 0;
  lastGpsFix = null;
  lastPrintTime = 0;
}