import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

type RGB = { r: number; g: number; b: number };

type Props = {
  label: string;
  color: RGB;
  onChangeColor: (channel: keyof RGB, value: number) => void;
};

export default function RGBSlider({ label, color, onChangeColor }: Props) {
  const colorPreview = `rgb(${color.r}, ${color.g}, ${color.b})`;

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
        <Text style={styles.sliderLabel}>R: {color.r}</Text>
        <Slider
          minimumValue={0}
          maximumValue={255}
          step={1}
          value={color.r}
          onValueChange={value => onChangeColor('r', value)}
        />

        <Text style={styles.sliderLabel}>G: {color.g}</Text>
        <Slider
          minimumValue={0}
          maximumValue={255}
          step={1}
          value={color.g}
          onValueChange={value => onChangeColor('g', value)}
        />

        <Text style={styles.sliderLabel}>B: {color.b}</Text>
        <Slider
          minimumValue={0}
          maximumValue={255}
          step={1}
          value={color.b}
          onValueChange={value => onChangeColor('b', value)}
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
    marginTop: 16,
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
    marginTop: 8,
  },
});
