import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RadioButton } from 'react-native-radio-buttons-group';

type Props = {
  values: string[];
  labels: string[];
  selectedId: string;
  onChange: (id: string) => void;
}

export default function CustomRadio({
  values,
  labels,
  selectedId,
  onChange
}: Props) {
  return(
    <View style={styles.radioRow}>
      {values.map((value, i) => (
        <View key={value} style={styles.radioItem}>
          <RadioButton
            id={value}
            value={value}
            selected={selectedId === value}
            onPress={onChange}
            color="#41c60d"
            borderColor="#a9a9a9"
          />
          <Text style={styles.radioText}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  radioRow: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 8,
    justifyContent: 'space-between'
  },
  radioItem: {
    flex: 1,
    alignItems: "center"
  },
  radioText: {
    fontSize: 13,
  }
})