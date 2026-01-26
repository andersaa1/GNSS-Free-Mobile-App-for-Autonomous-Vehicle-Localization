import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

type RGB = { r: number; g: number; b: number };

type Props = {
  label: string;
  color: RGB;
  onChangeColor: (color: RGB) => void;
};

export default function RGBSlider({ 
  label, 
  color, 
  onChangeColor 
}: Props) {
  const [localColor, setLocalColor] = useState<RGB>(color);

  useEffect(() => {
    setLocalColor(color);
  }, [color])

  // converts RGB to css string
  const colorPreview = `rgb(${localColor.r}, ${localColor.g}, ${localColor.b})`;

  const updateChannel = (channel: keyof RGB, value: number) => {
    setLocalColor(prev => ({
      ...prev,
      [channel]: Math.round(value),
    }));
  };

  const handleSlidingComplete = () => {
    onChangeColor(localColor);
  };

  return (
    <>
      {/* Color preview */}
      <View style={styles.colorRow}>
        <Text style={styles.label}>{label}</Text>
        <View
          style={[styles.colorPreview, { backgroundColor: colorPreview }]}
        />
      </View>

      {/* RGB sliders */}
      <View style={styles.sliderGroup}>
        <Text style={styles.sliderLabel}>R: {localColor.r}</Text>
        <Slider
          minimumValue={0}
          maximumValue={255}
          step={1}
          value={localColor.r}
          minimumTrackTintColor="#ff0000"
          onValueChange={value => updateChannel('r', value)}
          onSlidingComplete={handleSlidingComplete}
        />

        <Text style={styles.sliderLabel}>G: {localColor.g}</Text>
        <Slider
          minimumValue={0}
          maximumValue={255}
          step={1}
          value={localColor.g}
          minimumTrackTintColor="#00ff00ff"
          onValueChange={value => updateChannel('g', value)}
          onSlidingComplete={handleSlidingComplete}
        />

        <Text style={styles.sliderLabel}>B: {localColor.b}</Text>
        <Slider
          minimumValue={0}
          maximumValue={255}
          step={1}
          value={localColor.b}
          minimumTrackTintColor="#0000ffff"
          onValueChange={value => updateChannel('b', value)}
          onSlidingComplete={handleSlidingComplete}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorPreview: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000ff',
  },
  sliderGroup: {
    marginTop: 12,
  },
  sliderLabel: {
    fontSize: 14,
  },
});