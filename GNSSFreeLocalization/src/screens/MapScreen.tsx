import React, { useMemo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Map from '../components/Map';
import SettingsButton from '../components/SettingsButton';
import SettingsOverlay from '../components/SettingsOverlay';
import { Particle, sampleRandomParticles } from '../services/particleFilter';
import { startGps, stopGps, onGpsFix } from "../services/sensors/gps";
import { RoadTileCache } from "../services/roads/roadTiles";
import { RoadTileSampler } from "../services/roads/roadTileSampler";

import RNFS from "react-native-fs"; // temporary

type Props = {
  roadsGeoJSON: any;
};

export default function MapScreen({ roadsGeoJSON }: Props) {
  const samplerRef = useRef(new RoadTileSampler());
  const tileCacheRef = useRef(new RoadTileCache());
  const [roadsForDebug, setRoadsForDebug] = useState<any>(null);

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
    (async () => {
      const base = `${RNFS.MainBundlePath}/road_tiles/12`;
      const exists = await RNFS.exists(base);
      console.log("Tiles base exists:", base, exists);
      if (exists) {
        const xs = await RNFS.readDir(base);
        console.log("Some x dirs:", xs.slice(0, 3).map(x => x.name));
      }
    })();
  }, []);

  // When toggling showRoads on, materialize debug geojson once
  useEffect(() => {
    if (showRoads) setRoadsForDebug(tileCacheRef.current.getMergedGeoJSON());
    else setRoadsForDebug(null);
  }, [showRoads])

  useEffect(() => {
    const unsub = onGpsFix(async (fix) => {
      await tileCacheRef.current.loadAround(fix.lon, fix.lat);
      console.log("GPS fix:", fix.lat, fix.lon);

      if (showRoads) {
        setRoadsForDebug(tileCacheRef.current.getMergedGeoJSON());
      }
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
        // Data
        roadsGeoJSON={roadsForDebug} // Disable if memory issues (this is mainly for debugging)
        particlesGeoJSON={particlesGeoJSON}
        // Road display
        showRoads={showRoads}
        roadColor={roadColor}
        roadWidth={roadWidth}
        // Particles display
        particlesColor={particlesColor}
        particlesRadius={particlesRadius}
      />

      {/* HUD layer */}
      <View style={styles.overlayContainer}>
        <SettingsButton onPress={() => setSettingsOpen(prev => !prev)} />
      </View>

      {settingsOpen && (
        <SettingsOverlay
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