import React, { useMemo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Map from '../components/Map';
import SettingsButton from '../components/SettingsButton';
import SettingsOverlay from '../components/SettingsOverlay';
import { Particle, sampleRandomParticles } from '../services/particleFilter';
import { startGps, stopGps, onGpsFix } from "../services/sensors/gps";
import { RoadTileCache } from "../services/roads/roadTiles";
import { RoadTileSampler } from "../services/roads/roadTileSampler";
import {
  loadBaseLibertyStyle,
  buildStyleWithRoadOverrides,
  patchLibertyToLocalEstoniaTiles,
  getBundledEstoniaTilesTemplate,
  addBackgroundLandOceanAndCountryLabels,
  getBundledBackgroundTilesTemplate
} from "../services/maps/style";


type Props = {
  roadsGeoJSON: any;
};

export default function MapScreen({ roadsGeoJSON }: Props) {
  const [baseStyle, setBaseStyle] = useState<any | null>(null);

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

  useEffect(() => {
    (async () => {
      const liberty = await loadBaseLibertyStyle();

      // 1) Estonia detailed tiles (OpenMapTiles Estonia build)
      const estTiles = getBundledEstoniaTilesTemplate();
      const withEstonia = patchLibertyToLocalEstoniaTiles(liberty, estTiles);

      // 2) Background tiles (Natural Earth land/ocean + country labels)
      const bgTiles = getBundledBackgroundTilesTemplate();
      const withBackground = addBackgroundLandOceanAndCountryLabels(withEstonia, bgTiles);

      setBaseStyle(withBackground);
    })().catch(console.error);
  }, []);


  const mapStyle = useMemo(() => {
    if (!baseStyle) return "https://tiles.openfreemap.org/styles/liberty";
    return buildStyleWithRoadOverrides(baseStyle, {
      highlightRoads: showRoads,
      roadColor,
      roadWidth,
    });
  }, [baseStyle, showRoads, roadColor.r, roadColor.g, roadColor.b, roadWidth]);

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
        // Map
        mapStyle={mapStyle}
        // Particles
        particlesGeoJSON={particlesGeoJSON}
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