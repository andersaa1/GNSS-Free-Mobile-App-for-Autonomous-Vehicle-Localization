import { onGpsFix } from "./gps";
import { milestoneBoards } from "../map/milestoneBoards";
import { distanceMeters } from "../../utils/geo";
import type { MilestoneBoard } from "../../types/MilestoneBoard";

type Listener = (board: MilestoneBoard) => void;

const listeners = new Set<Listener>();
let unsubscribeGps: (() => void) | null = null;
let lastBoardOid: number | null = null;

export function onMilestoneBoardDetected(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startCameraSensor(radius = 5): void {
  if (unsubscribeGps) return;

  unsubscribeGps = onGpsFix((fix) => {
    let foundNearby = false;

    for (const board of milestoneBoards) {
      const dist = distanceMeters(fix.lat, fix.lon, board.lat, board.lon);

      if (dist <= radius) {
        foundNearby = true;

        if (lastBoardOid !== board.oid) {
          lastBoardOid = board.oid;
          for (const listener of listeners) {
            listener(board);
          }
        }
      }
    }

    if (!foundNearby) {
      lastBoardOid = null;
    }
  });
}

export function stopCameraSensor(): void {
  if (!unsubscribeGps) return;
  unsubscribeGps();
  unsubscribeGps = null;
  lastBoardOid = null;
}