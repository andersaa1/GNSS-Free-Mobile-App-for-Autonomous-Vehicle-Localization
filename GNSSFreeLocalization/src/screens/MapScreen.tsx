import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Map from '../components/Map';
import SettingsButton from '../components/SettingsButton';
import SettingsOverlay from '../components/SettingsOverlay';

type Props = {
  roadsGeoJSON: any;
}

export default function MapScreen({ roadsGeoJSON }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [showRoads, setShowRoads] = useState(true);
  const [roadColor, setRoadColor] = useState({ r: 255, g: 0, b: 0 });
  const [roadWidth, setRoadWidth] = useState(2);

  return (
    <View style={{ flex: 1 }}>
      <Map 
        roadsGeoJSON={roadsGeoJSON}
        showRoads={showRoads}
        roadColor={roadColor}
        roadWidth={roadWidth}
      />

      {/* HUD layer */}
      <View style={styles.overlayContainer}>
        <SettingsButton onPress={() => setSettingsOpen(prev => !prev)}/>
      </View>

      {settingsOpen && (
        <SettingsOverlay
          showRoads={showRoads}
          onToggleRoads={setShowRoads}
          roadColor={roadColor}
          onChangeRoadColor={(chan, value) => 
            setRoadColor(prev => ({ ...prev, [chan]: value }))
          }
          roadWidth={roadWidth}
          onChangeRoadWidth={setRoadWidth}
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
