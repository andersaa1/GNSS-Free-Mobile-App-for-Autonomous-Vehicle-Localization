import { Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';

type Props = {
  label: string;
  disabled: boolean;
  onButtonPressed: () => void;
};

export default function CustomButton({
  label,
  disabled,
  onButtonPressed,
}: Props) {
  return (
    <Pressable
      style={[
        styles.button,
        disabled && { backgroundColor: '#A0A0A0', borderColor: '#808080' },
      ]}
      disabled={disabled}
      onPress={onButtonPressed}
    >
      {disabled ? (
        <ActivityIndicator
          size="small"
          color="#ffffff"
          style={styles.spinner}
        />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
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
    width: '100%',
    height: 40,
    borderWidth: 2,
    borderColor: '#005BBB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
});
