import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import RGBSlider from './RGBSlider';
import CustomSlider from './CustomSlider';
import CustomButton from './CustomButton';

type RGB = { r: number; g: number; b: number };

type Props = {
  // Road display settings and handler
  showRoads: boolean;
  onToggleRoads: (value: boolean) => void;
  roadColor: RGB;
  onChangeRoadColor: (value: RGB) => void;
  roadWidth: number;
  onChangeRoadWidth: (value: number) => void;
  // Particle display settings and handler
  onGenerateParticles: () => void;
  particlesColor: RGB;
  onChangeParticlesColor: (value: RGB) => void;
  particlesRadius: number;
  onChangeParticlesRadius: (value: number) => void;
};

export default function SettingsOverlay({
  // Road display settings and handler
  showRoads,
  onToggleRoads,
  roadColor,
  onChangeRoadColor,
  roadWidth,
  onChangeRoadWidth,
  // Particles display settings and handler
  onGenerateParticles,
  particlesColor,
  onChangeParticlesColor,
  particlesRadius,
  onChangeParticlesRadius
}: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <Text style={styles.title}>Settings & Tools</Text>
      </View>

      {/* START OF ROAD SETTINGS */}
      <View style={styles.header}>
        <Text style={styles.title2}>Road Settings</Text>
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

      {/* START OF PARTICLE SETTINGS */}
      <View style={styles.header}>
        <Text style={styles.title2}>Particle Settings</Text>
      </View>

      {/* Particle color picker */}
      <RGBSlider
        label="Particle Color"
        color={particlesColor}
        onChangeColor={onChangeParticlesColor}
      />
      {/* Particle radius slider */}
      <CustomSlider
        label="Particle Radius"
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={particlesRadius}
        onChangeValue={onChangeParticlesRadius}
      />
      {/* Generate random particles button */}
      <CustomButton
        label="Generate Random Particles"
        onButtonPressed={onGenerateParticles}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 125,
    left: 20,
    width: '60%',
    maxHeight: '70%',
    backgroundColor: '#ffffffff',
    paddingHorizontal: 16,
    borderRadius: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
  },
  scrollContent: {
    paddingBottom: 20,
    paddingTop: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  title2: {
    fontSize: 18,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  }
});