/**
 * GradientButton — Primary CTA button: purple→cyan gradient, pill shape.
 * Press animation via Animated API (scale 0.97 on press).
 */
import React, { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BLUE_GRADIENT = ['#1850B4', '#2D7DD2'];

export default function GradientButton({
  label,
  onPress,
  loading = false,
  gradient = BLUE_GRADIENT,
  style,
  textStyle,
  small = false,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={loading}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btn, small ? styles.small : styles.normal, styles.shadow]}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={[styles.label, small ? styles.smallLabel : styles.normalLabel, textStyle]}>
                {label}
              </Text>
          }
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normal: {
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  label: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  normalLabel: { fontSize: 15 },
  smallLabel: { fontSize: 13 },
  shadow: {
    shadowColor: '#1850B4',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
});
