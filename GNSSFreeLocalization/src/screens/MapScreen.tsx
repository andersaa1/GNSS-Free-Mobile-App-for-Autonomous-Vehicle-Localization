import React, { useMemo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Map from '../components/Map';
import SettingsButton from '../components/SettingsButton';
import SettingsOverlay from '../components/SettingsOverlay';
import type { Particle } from "../services/particleFilter/types";
import { createInitialDistribution } from "../services/particleFilter/initialDistribution";
import { sampleParticles } from "../services/particleFilter/sampleParticles";
import { startGps, stopGps } from "../services/sensors/gps";
import {
  onMilestoneBoardDetected,
  startCameraSensor,
  stopCameraSensor,
} from "../services/sensors/cameraSensor";
import { 
  onSpeedChanged,
  startSpeedSensor,
  stopSpeedSensor,
 } from "../services/sensors/speedSensor"; 
import {
  startDistanceTracker,
  stopDistanceTracker,
  onDistanceChanged,
} from "../services/navigation/distanceTracker";
import { milestoneBoards } from "../services/map/milestoneBoards";
import { RoadTileSampler } from "../services/roads/roadTileSampler";
import { buildStyleWithRoadOverrides } from "../services/map/style";
import type { MapStyleId } from "../app/loadBaseStyle";

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
    const unsubBoard = onMilestoneBoardDetected((board) => {
      console.log(`Detected milestone board ${board.oid}`);
      board.signs.forEach((sign, index) => {
        console.log(`${index + 1}. ${sign.destination} ${sign.distance} km`);
      });
    });

    const unsubSpeed = onSpeedChanged((sample) => {
      //console.log(
        //`Speed: ${sample.speed.toFixed(2)} m/s at ${new Date(sample.timestamp).toISOString()}`
      //);
    });

    const unsubDistance = onDistanceChanged((sample) => { 
      setParticles((prev) => {
        if (!prev.length) return prev;
        
        const next = sampleParticles(prev, sample.deltaDistance, {
          distanceNoiseStdM: 1.5,
        });

        return next;
      });

      //console.log(
        //`Δd=${sample.deltaDistance.toFixed(2)} m, total=${sample.totalDistance.toFixed(2)} m`
      //);
    });

    startGps().catch(console.error);
    startCameraSensor(5);
    startSpeedSensor(2);
    startDistanceTracker();

    return () => {
      unsubBoard();
      unsubSpeed();
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

  // Preloads indexes for speed
  const samplerRef = useRef(new RoadTileSampler());
  useEffect(() => {
    samplerRef.current.init().catch((e) => {
      console.error("Road tile sampler init failed:", e);
    });
  }, []);

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