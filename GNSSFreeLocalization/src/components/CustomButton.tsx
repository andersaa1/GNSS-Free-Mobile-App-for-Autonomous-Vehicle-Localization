import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';

type Props = {
  label: string;
  onButtonPressed: () => void;
};

export default function CustomButton({ 
    label, 
    onButtonPressed
}: Props) {
    return (
        <Pressable style={styles.button} onPress={onButtonPressed}>
            <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  }
});