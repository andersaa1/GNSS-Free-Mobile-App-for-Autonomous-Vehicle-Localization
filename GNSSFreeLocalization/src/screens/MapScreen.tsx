import proj4 from "proj4";
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Map from '../components/Map';
import SettingsButton from '../components/SettingsButton';
import SettingsOverlay from '../components/SettingsOverlay';
import { Particle } from '../services/particleFilter';
import { startGps, stopGps, onGpsFix } from "../services/sensors/gps";
import { RoadTileCache } from "../services/roads/roadTiles";
import { RoadTileSampler } from "../services/roads/roadTileSampler";
import { buildStyleWithRoadOverrides } from "../services/maps/style";
import milestoneBoardsJSON from "../assets/data/milestone-boards-cleaned.json";
import type { MapStyleId } from "../app/loadBaseStyle";
import type { MilestoneBoard, MilestoneBoardSign } from "../types/MilestoneBoard";

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

  const samplerRef = useRef(new RoadTileSampler());
  const tileCacheRef = useRef(new RoadTileCache());

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

  // For converting EPSG:3301 to WGS84 (lon/lat)
  // AI used
  const EPSG3301 =
  "+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 " +
  "+lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +units=m +no_defs";

  proj4.defs("EPSG:3301", EPSG3301);
  proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

  // Makes milestone boards usable inside the map
  const milestoneBoards = useMemo<MilestoneBoard[]>(() => {
    return milestoneBoardsJSON.features.map((feature: any) => {
      const [x, y] = feature.geometry.coordinates;
      const [lon, lat] = proj4("EPSG:3301", "EPSG:4326", [x, y]);

      return {
        oid: feature.properties.oid,
        roadNumber: feature.properties.tee_number,
        roadName: feature.properties.tee_nimi,
        direction: feature.properties.direction,
        signs: feature.properties.signs,
        lon,
        lat
      };
    });
  }, []);

  // Square for displaying milestone boards on the map
  const createSquarePolygon = (lon: number, lat: number, size = 0.00008) => {
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
  }, [milestoneBoards]);
  
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

  // Handler to generate random particles
  const generateParticles = async () => {
  if (isGeneratingParticles) return;

  setIsGeneratingParticles(true);
  await new Promise(r => setTimeout(() => r(undefined), 0));

  try {
    const pts = await samplerRef.current.sampleGlobalParticles(particleCount);

    const n = pts.length || 1;
    const sampledParticles: Particle[] = pts.map((p, i) => ({
      id: i,
      x: p.lon,
      y: p.lat,
      weight: 1 / n,
    }));

    setParticles(sampledParticles);
  } catch (e) {
    console.error("Particle generation failed:", e);
  } finally {
    setIsGeneratingParticles(false);
  }
};

  useEffect(() => {
    const unsub = onGpsFix(async (fix) => {
      await tileCacheRef.current.loadAround(fix.lon, fix.lat);
      console.log("GPS fix:", fix.lat, fix.lon);
    });

      startGps().catch(console.error);
      return () => { unsub(); stopGps(); };
  }, []);

  useEffect(() => {
    // Load tiles around Estonia center immediately so buttons work even before GPS fix
    tileCacheRef.current.loadAround(25.0, 58.6).catch(console.error);
  }, []);

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