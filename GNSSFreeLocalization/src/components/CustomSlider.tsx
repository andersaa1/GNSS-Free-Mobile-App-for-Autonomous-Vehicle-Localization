import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

type Props = {
  label: string;
  minimumValue: number;
  maximumValue: number;
  step: number;
  value: number;
  onChangeValue: (value: number) => void;
};

export default function CustomSlider({
  label,
  minimumValue,
  maximumValue,
  step,
  value,
  onChangeValue,
}: Props) {
  return (
    <>
      <View style={styles.sliderGroup}>
        <Text style={styles.sliderLabel}>
          {label} {value.toFixed(1)}
        </Text>
        <Slider
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          value={value}
          onValueChange={onChangeValue}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sliderGroup: {
    marginTop: 12,
  },
  sliderLabel: {
    fontSize: 14,
    marginTop: 8,
  },
});
