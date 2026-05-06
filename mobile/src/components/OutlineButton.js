/**
 * OutlineButton — Secondary action button: transparent bg, white border.
 */
import React, { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../theme';

export default function OutlineButton({
  label, onPress, style, textStyle, small = false, color = Colors.textPrimary,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.btn, small ? styles.small : styles.normal, { borderColor: color }]}
      >
        <Text style={[styles.label, small ? styles.smallLabel : styles.normalLabel,
          { color }, textStyle]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normal: { paddingVertical: 13, paddingHorizontal: 26 },
  small:  { paddingVertical: 7,  paddingHorizontal: 16 },
  label: { fontWeight: '600', letterSpacing: 0.3 },
  normalLabel: { fontSize: 15 },
  smallLabel:  { fontSize: 13 },
});
