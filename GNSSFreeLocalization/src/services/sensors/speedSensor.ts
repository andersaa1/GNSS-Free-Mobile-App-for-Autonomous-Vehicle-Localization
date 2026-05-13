import { onGpsFix, type GpsFix } from "./gps";
import { distanceMeters } from "../../utils/geo";

export type Speed = {
  speed: number; // speed in m/s
  timestamp: number;
};

type SpeedListener = (speed: Speed) => void;

const listeners = new Set<SpeedListener>();

let running = false;
let unsubscribeFromGps: (() => void) | null = null;

let currentSpeed = 0;
let lastGpsFix: GpsFix | null = null;

function emit(speed: Speed) {
  for (const listener of listeners) {
    listener(speed);
  }
}

// Subscribe to speed updates and return an unsubscribe function
export function onSpeedChanged(listener: SpeedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Returns the most recent speed value
export function getCurrentSpeed(): number {
  return currentSpeed;
}

// Starts the speed sensor
export function startSpeedSensor(): void {
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
}