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

  return (
    <View style={{ flex: 1 }}>
      <Map roadsGeoJSON={roadsGeoJSON}/>

      {/* HUD layer */}
      <View style={styles.overlayContainer}>
        <SettingsButton onPress={() => setSettingsOpen(prev => !prev)}/>
      </View>

      {settingsOpen && (
        <SettingsOverlay/>
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
