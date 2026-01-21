import React from 'react';
import { StyleSheet, Image, Pressable } from 'react-native';
import GearIcon from "../assets/icons/gear.png"

type Props = {
    onPress?: () => void;
}

export default function SettingsButton({ onPress }: Props) {
    return (
        <Pressable style={styles.circleButton} onPress={onPress}> 
            <Image source={GearIcon} style={styles.icon}/>
        </Pressable>
    );
}

const styles = StyleSheet.create({
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: '#333333',
  },
});