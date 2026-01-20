import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  onClose: () => void;
};

export default function SettingsOverlay() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Put your settings controls here */}
      <Text style={styles.item}>• Option 1</Text>
      <Text style={styles.item}>• Option 2</Text>
      <Text style={styles.item}>• Option 3</Text>
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
  item: {
    fontSize: 16,
    marginVertical: 8,
  },
});
