import React, { useMemo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Map from '../components/Map';
import SettingsButton from '../components/SettingsButton';
import SettingsOverlay from '../components/SettingsOverlay';

import type { Particle } from "../services/particleFilter/types";
import { createInitialDistribution } from "../services/particleFilter/initialDistribution";
import {
  sampleParticlesRouteMotion,
  getTestRouteBearingDeg,
} from "../services/particleFilter/sampleParticles";
import { RoadTileSampler } from "../services/roads/roadTileSampler";
import { weightParticles } from "../services/particleFilter/weightParticles";
import { resampleParticles } from "../services/particleFilter/resampleParticles";

import { startGps, stopGps, onGpsFix, type GpsFix } from "../services/sensors/gps";
import {
  onMilestoneBoardDetected,
  startCameraSensor,
  stopCameraSensor,
} from "../services/sensors/cameraSensor";
import {
  startSpeedSensor,
  stopSpeedSensor,
} from "../services/sensors/speedSensor";
import {
  startDistanceTracker,
  stopDistanceTracker,
  onDistanceChanged,
} from "../services/navigation/distanceTracker";

import { milestoneBoards } from "../services/map/milestoneBoards";
import { buildStyleWithRoadOverrides } from "../services/map/style";
import type { MapStyleId } from "../app/loadBaseStyle";

import { distanceMeters } from "../utils/geo";

type ExperimentDirection = "forward" | "backward";

const EXPERIMENT_CONFIG = {
  runId: "backward_real_001",

  direction: "backward" as ExperimentDirection,
  particleCount: 500,

  summaryLogIntervalMs: 2000,
  particleSnapshotIntervalMs: 30000,
};

function estimateParticlePosition(particles: Particle[]): {
  lat: number;
  lon: number;
} | null {
  if (!particles.length) return null;

  let weightSum = 0;
  let latSum = 0;
  let lonSum = 0;

  for (const particle of particles) {
    const weight =
      Number.isFinite(particle.weight) && particle.weight > 0
        ? particle.weight
        : 0;

    weightSum += weight;
    latSum += particle.y * weight;
    lonSum += particle.x * weight;
  }

  // If weights are invalid for any reason, fall back to plain average.
  if (!Number.isFinite(weightSum) || weightSum <= 1e-12) {
    const plainLat =
      particles.reduce((sum, particle) => sum + particle.y, 0) /
      particles.length;

    const plainLon =
      particles.reduce((sum, particle) => sum + particle.x, 0) /
      particles.length;

    return {
      lat: plainLat,
      lon: plainLon,
    };
  }

  return {
    lat: latSum / weightSum,
    lon: lonSum / weightSum,
  };
}

function calculatePositionErrorM(
  actual: GpsFix | null,
  estimate: { lat: number; lon: number } | null
): number | null {
  if (!actual || !estimate) return null;

  return distanceMeters(
    actual.lat,
    actual.lon,
    estimate.lat,
    estimate.lon
  );
}

function logExperimentEvent(eventName: string, payload: Record<string, unknown>) {
  console.log(
    `PF_EVENT ${JSON.stringify({
      eventName,
      runId: EXPERIMENT_CONFIG.runId,
      direction: EXPERIMENT_CONFIG.direction,
      configuredParticleCount: EXPERIMENT_CONFIG.particleCount,
      timestamp: Date.now(),
      ...payload,
    })}`
  );
}

function logParticleSnapshot(
  snapshotType: string,
  particles: Particle[],
  actualGps: GpsFix | null,
  extra?: Record<string, unknown>
) {
  const estimate = estimateParticlePosition(particles);
  const errorM = calculatePositionErrorM(actualGps, estimate);

  console.log(
    `PF_SNAPSHOT ${JSON.stringify({
      runId: EXPERIMENT_CONFIG.runId,
      direction: EXPERIMENT_CONFIG.direction,
      snapshotType,
      timestamp: Date.now(),

      actualLat: actualGps?.lat ?? null,
      actualLon: actualGps?.lon ?? null,

      estimatedLat: estimate?.lat ?? null,
      estimatedLon: estimate?.lon ?? null,
      errorM,
      errorKm: errorM === null ? null : errorM / 1000,

      particleCount: particles.length,

      particles: particles.map((particle) => ({
        id: particle.id,
        lat: particle.y,
        lon: particle.x,
        weight: particle.weight,
        dirX: particle.dirX,
        dirY: particle.dirY,
      })),

      ...extra,
    })}`
  );
}

export default function MapScreen({ 
  initialStyle,
  mapStyleId,
  onChangeMapStyleId 
}: {
  initialStyle: any;
  mapStyleId: MapStyleId;
  onChangeMapStyleId: (id: MapStyleId) => void;  
}) {
  // Map base style (before any custom options)
  const [baseStyle, setBaseStyle] = useState(initialStyle);

  useEffect(() => {
    setBaseStyle(initialStyle);
  }, [initialStyle]);

  // Settings overlay state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Road display settings
  const [showRoads, setShowRoads] = useState(false);
  const [roadColor, setRoadColor] = useState({ r: 255, g: 0, b: 0 });
  const [roadWidth, setRoadWidth] = useState(2);

  // Particle display settings
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isGeneratingParticles, setIsGeneratingParticles] = useState(false);
  const [particlesColor, setParticlesColor] = useState({ r: 0, g: 0, b: 255 });
  const [particlesRadius, setParticlesRadius] = useState(4);
  const [particleCount, setParticleCount] = useState(200);

  // Map styling
  const mapStyle = useMemo(() => {
    if (!showRoads) return baseStyle; // uses the base style if roads are not highlighted
    return buildStyleWithRoadOverrides(baseStyle, { roadColor, roadWidth });
  }, [baseStyle, showRoads, roadColor.r, roadColor.g, roadColor.b, roadWidth]);

  // refs for logging and testing
  const actualGpsRef = useRef<GpsFix | null>(null);
  const experimentStartTimeRef = useRef<number | null>(null);
  const lastSummaryLogTimeRef = useRef(0);
  const lastParticleSnapshotTimeRef = useRef(0);

  // Preloads indexes for speed
  const samplerRef = useRef(new RoadTileSampler());
  const particlesRef = useRef<Particle[]>([]);
  const isSamplingRef = useRef(false);

  // Square for displaying milestone boards on the map
  const createSquarePolygon = (lon: number, lat: number, size = 0.0001) => {
    return [
        [lon - size, lat - size],
        [lon + size, lat - size],
        [lon + size, lat + size],
        [lon - size, lat + size],
        [lon - size, lat - size],
    ];
  };
  
  const milestoneBoardGeoJSON = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: milestoneBoards.map((board) => ({
        type: "Feature",
        properties: {
          oid: board.oid,
          roadNumber: board.roadNumber,
          roadName: board.roadName,
          direction: board.direction,
          signs: board.signs,
        },
        geometry: {
          type: "Polygon",
          coordinates: [createSquarePolygon(board.lon, board.lat)],
        },
      })),
    };
  }, []);

  // Subscribes to the sensors
  useEffect(() => {
    experimentStartTimeRef.current = Date.now();
    logExperimentEvent("experiment_started", {
      config: EXPERIMENT_CONFIG,
    });

    console.log(
      `Test route bearing: ${getTestRouteBearingDeg(
        EXPERIMENT_CONFIG.direction
      ).toFixed(2)}°`
    );

    const unsubGps = onGpsFix((fix) => {
      actualGpsRef.current = fix;
    });

    const unsubBoard = onMilestoneBoardDetected((board) => {
      console.log(`Detected milestone board ${board.oid}`);
      board.signs.forEach((sign, index) => {
        console.log(`${index + 1}. ${sign.destination} ${sign.distance} km`);
      });

      setParticles((prev) => {
        if (!prev.length) return prev;

        const actualGps = actualGpsRef.current;
        const estimateBefore = estimateParticlePosition(prev);
        const errorBeforeM = calculatePositionErrorM(actualGps, estimateBefore);

        logExperimentEvent("milestone_detected", {
          milestoneOid: board.oid,
          milestoneLat: board.lat,
          milestoneLon: board.lon,
          signs: board.signs,

          actualLat: actualGps?.lat ?? null,
          actualLon: actualGps?.lon ?? null,

          estimatedLatBefore: estimateBefore?.lat ?? null,
          estimatedLonBefore: estimateBefore?.lon ?? null,
          errorBeforeM,
          errorBeforeKm: errorBeforeM === null ? null : errorBeforeM / 1000,
        })

        logParticleSnapshot("before_weighting", prev, actualGps, {
          milestoneOid: board.oid,
        });

        const weighted = weightParticles(prev, board, {
          distanceSigmaM: 5000, // very high since the initial distribution is wide and there are low amount of particles
          minLikelihood: 1e-6,
          backwardsPenalty: 0.15,
          exactBoardMatchBonus: 1.0,
        });

        const best = weighted.reduce((a, b) => (a.weight >= b.weight ? a : b));
        const estimateAfterWeighting = estimateParticlePosition(weighted);
        const errorAfterWeightingM = calculatePositionErrorM(actualGps, estimateAfterWeighting);

        logExperimentEvent("weighting_finished", {
          milestoneOid: board.oid,

          bestParticleId: best.id,
          bestParticleLat: best.y,
          bestParticleLon: best.x,
          bestParticleWeight: best.weight,

          estimatedLatAfterWeighting: estimateAfterWeighting?.lat ?? null,
          estimatedLonAfterWeighting: estimateAfterWeighting?.lon ?? null,
          errorAfterWeightingM,
          errorAfterWeightingKm: errorAfterWeightingM === null ? null : errorAfterWeightingM / 1000,
        });

        logParticleSnapshot("after_weighting", weighted, actualGps, {
          milestoneOid: board.oid,
          bestParticleId: best.id,
          bestParticleWeight: best.weight,
        });

        const resampled = resampleParticles(weighted, {
          jitterPositionStd: 100, // adds some noise
          keepWeightsUniform: true,
          minDuplicateSpacingM: 1.5, // prevents particles from collapsing into the same position
        });

        const estimateAfterResampling = estimateParticlePosition(resampled);
        const errorAfterResamplingM = calculatePositionErrorM(actualGps, estimateAfterResampling);

        logExperimentEvent("resampling_finished", {
          milestoneOid: board.oid,

          estimatedLatAfterResampling: estimateAfterResampling?.lat ?? null,
          estimatedLonAfterResampling: estimateAfterResampling?.lon ?? null,
          errorAfterResamplingM,
          errorAfterResamplingKm: errorAfterResamplingM === null ? null : errorAfterResamplingM / 1000,

          correctionM:
            errorBeforeM !== null && errorAfterResamplingM !== null
              ? errorBeforeM - errorAfterResamplingM
              : null,
        });

        logParticleSnapshot("after_resampling", resampled, actualGps, {
          milestoneOid: board.oid,
        });

        particlesRef.current = resampled;
        return resampled;
      });
    });

    const unsubDistance = onDistanceChanged((sample) => {
      if (isSamplingRef.current) return;

      if (!Number.isFinite(sample.deltaDistance) || sample.deltaDistance <= 0) {
        return;
      }

      isSamplingRef.current = true;

      try {
        setParticles((prev) => {
          if (!prev.length) return prev;

          const next = sampleParticlesRouteMotion(prev, sample.deltaDistance, {
            distanceNoiseStdM: 2.0, // adds noise to the distance measurement
            headingNoiseDeg: 5, // adds noise to the heading
            direction: EXPERIMENT_CONFIG.direction,
          });

          particlesRef.current = next;

          const now = Date.now();
          const actualGps = actualGpsRef.current;
          const estimate = estimateParticlePosition(next);
          const errorM = calculatePositionErrorM(actualGps, estimate);
          const experimentStartTime = experimentStartTimeRef.current ?? now;
          const timeSeconds = (now - experimentStartTime) / 1000;

          if (
            now - lastSummaryLogTimeRef.current >=
            EXPERIMENT_CONFIG.summaryLogIntervalMs
          ) {
            lastSummaryLogTimeRef.current = now;

            console.log(
              `PF_SUMMARY ${JSON.stringify({
                runId: EXPERIMENT_CONFIG.runId,
                direction: EXPERIMENT_CONFIG.direction,
                timestamp: now,
                timeSeconds,

                actualLat: actualGps?.lat ?? null,
                actualLon: actualGps?.lon ?? null,

                estimatedLat: estimate?.lat ?? null,
                estimatedLon: estimate?.lon ?? null,

                errorM,
                errorKm: errorM === null ? null : errorM / 1000,

                speedMs: sample.speed,
                speedKmh: sample.speed * 3.6,
                deltaDistanceM: sample.deltaDistance,
                totalDistanceM: sample.totalDistance,

                particleCount: next.length,
              })}`
            );
          }

          if (
            now - lastParticleSnapshotTimeRef.current >=
            EXPERIMENT_CONFIG.particleSnapshotIntervalMs
          ) {
            lastParticleSnapshotTimeRef.current = now;

            logParticleSnapshot("regular", next, actualGps, {
              timeSeconds,
              speedMs: sample.speed,
              speedKmh: sample.speed * 3.6,
              deltaDistanceM: sample.deltaDistance,
              totalDistanceM: sample.totalDistance,
            });
          }

          return next;
        });
      } finally {
        isSamplingRef.current = false;
      }
    });

    startGps().catch(console.error);
    startCameraSensor(50);

    startSpeedSensor();

    startDistanceTracker();

    return () => {
      logExperimentEvent("experiment_stopped", {});
      unsubGps();

      unsubBoard();
      stopCameraSensor();

      unsubDistance();
      stopDistanceTracker();

      stopSpeedSensor();
      stopGps();
    };
  }, []);

  // Convert particles to GeoJSON
  const particlesGeoJSON = useMemo(() => {
    if (!particles.length) return null;
    return {
      type: 'FeatureCollection',
      features: particles.map(particle => ({
        type: 'Feature',
        properties: {
          id: particle.id,
          weight: particle.weight,
        },
        geometry: {
          type: 'Point',
          coordinates: [particle.x, particle.y],
        },
      })),
    };
  }, [particles]);

  useEffect(() => {
    samplerRef.current.init().catch((e) => {
      console.error("Road tile sampler init failed:", e);
    });
  }, []);
  useEffect(() => {
    particlesRef.current = particles;
  }, [particles]);

  // Handler for the inital distribution step
  const generateParticles = async () => {
    if (isGeneratingParticles) return;

    setIsGeneratingParticles(true);
    await new Promise(r => setTimeout(() => r(undefined), 0));

    try {
      const t0 = Date.now();

      const sampledParticles = await createInitialDistribution(
        samplerRef.current,
        particleCount
      );

      const t1 = Date.now();
      console.log(`Initial distribution took ${t1 - t0} ms`);

      logExperimentEvent("initial_distribution_completed", {
        particleCount: sampledParticles.length,
        durationMs: t1 - t0,
      });

      logParticleSnapshot(
        "initial_distribution",
        sampledParticles,
        actualGpsRef.current,
        {
          durationMs: t1 - t0,
        }
      );

      particlesRef.current = sampledParticles;
      setParticles(sampledParticles);
    } catch (e) {
      console.error("Initial distribution failed:", e);
    } finally {
      setIsGeneratingParticles(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Map
        // Map style
        mapStyle={mapStyle}
        // Particles
        particlesGeoJSON={particlesGeoJSON}
        particlesColor={particlesColor}
        particlesRadius={particlesRadius}
        // Milestone boards
        milestoneBoardsGeoJSON={milestoneBoardGeoJSON}
        onPressMilestoneBoard={(feature) => {
          const props = feature?.properties;
          if (!props) return;
          const signs = Array.isArray(props.signs) ? props.signs : [];
          console.log(props.oid)
          signs.forEach((sign: any, index: number) => {
            console.log(`${index + 1}. ${sign.destination} ${sign.distance} km`);
          });
        }}
      />

      {/* HUD layer */}
      <View style={styles.overlayContainer}>
        <SettingsButton onPress={() => setSettingsOpen(prev => !prev)} />
      </View>

      {settingsOpen && (
        <SettingsOverlay
          // Map style settings
          mapStyleId={mapStyleId}
          onChangeMapStyleId={onChangeMapStyleId}
          // Road display settings
          showRoads={showRoads}
          onToggleRoads={setShowRoads}
          roadColor={roadColor}
          onChangeRoadColor={setRoadColor}
          roadWidth={roadWidth}
          onChangeRoadWidth={setRoadWidth}
          onGenerateParticles={generateParticles}
          // Particles display settings
          isGeneratingParticles={isGeneratingParticles}
          particlesColor={particlesColor}
          onChangeParticlesColor={setParticlesColor}
          particlesRadius={particlesRadius}
          onChangeParticlesRadius={setParticlesRadius}
          particleCount={particleCount}
          onChangeParticleCount={setParticleCount}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
  },
});