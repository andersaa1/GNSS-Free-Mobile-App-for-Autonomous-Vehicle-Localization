import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import RGBSlider from './RGBSlider';
import CustomSlider from './CustomSlider';

type RoadRGB = { r: number; g: number; b: number };

type Props = {
  showRoads: boolean;
  onToggleRoads: (value: boolean) => void;
  roadColor: RoadRGB;
  onChangeRoadColor: (channel: keyof RoadRGB, value: number) => void;
  roadWidth: number;
  onChangeRoadWidth: (value: number) => void;
};

export default function SettingsOverlay({
  showRoads,
  onToggleRoads,
  roadColor,
  onChangeRoadColor,
  roadWidth,
  onChangeRoadWidth,
}: Props) {
  const colorPreview = `rgb(${roadColor.r}, ${roadColor.g}, ${roadColor.b})`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Show roads toggle */}
      <View style={styles.row}>
        <Text style={styles.label}>Highlight Roads</Text>
        <Switch value={showRoads} onValueChange={onToggleRoads} />
      </View>

      {/* Additional road settings when roads are highlighted */}
      {showRoads && (
        <>
          {/* Road color picker */}
          <RGBSlider
            label="Road Highlight Color"
            color={roadColor}
            onChangeColor={onChangeRoadColor}
          />

          {/* Road width slider */}
          <CustomSlider
            label="Road Highlight Width"
            minimumValue={0.5}
            maximumValue={5}
            step={0.5}
            value={roadWidth}
            onChangeValue={onChangeRoadWidth}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 125,
    left: 20,
    width: '60%', // side panel width
    backgroundColor: '#ffffffff',
    paddingTop: 15,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderRadius: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  label: {
    fontSize: 16,
  },
});
