import React, { useEffect, useState } from 'react';
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
  const [localValue, setLocalValue] = useState<number>(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);  

  return (
    <>
      <View style={styles.sliderGroup}>
        <Text style={styles.sliderLabel}>
          {label} {localValue.toFixed(1)}
        </Text>
        <Slider
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          value={localValue}
          onValueChange={setLocalValue}
          onSlidingComplete={onChangeValue}
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