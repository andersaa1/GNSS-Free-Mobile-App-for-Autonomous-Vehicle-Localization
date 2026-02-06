import React, { useMemo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Map from '../components/Map';
import SettingsButton from '../components/SettingsButton';
import SettingsOverlay from '../components/SettingsOverlay';
import {
  Particle,
  sampleRandomParticles
} from '../services/particleFilter';
import { startGps, stopGps, onGpsFix } from "../services/sensors/gps";

type Props = {
  roadsGeoJSON: any;
};

export default function MapScreen({ roadsGeoJSON }: Props) {
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
    if (isGeneratingParticles) return; // Prevents simultaneous calls

    setIsGeneratingParticles(true);
    // Waits one tick to ensure UI updates before heavy computation
    await new Promise(resolve => setTimeout(() => resolve(undefined), 0));

    const sampledParticles = sampleRandomParticles(roadsGeoJSON, particleCount);
    setParticles(sampledParticles);

    setIsGeneratingParticles(false);
  };

  useEffect(() => {
    const unsub = onGpsFix((fix) => {
      console.log("GPS fix:", fix.lat, fix.lon);
    });

      startGps().catch(console.error);

      return () => {
        unsub();
        stopGps();
      };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Map
        // Data
        roadsGeoJSON={null} // Disable if memory issues (this is mainly for debugging)
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