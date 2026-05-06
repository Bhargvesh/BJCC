/**
 * GlassPill — 999px radius pill for language chips and tags.
 */
import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Colors, Radius } from '../theme';

export default function GlassPill({ label, active = false, onPress, style, small = false }) {
  return (
    <Pressable onPress={onPress} style={[
      styles.pill,
      small ? styles.small : styles.normal,
      active ? styles.active : styles.inactive,
      style,
    ]}>
      <Text style={[styles.text, small ? styles.smallText : styles.normalText, active && styles.activeText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normal:    { paddingVertical: 8, paddingHorizontal: 16 },
  small:     { paddingVertical: 5, paddingHorizontal: 12 },
  active:    { backgroundColor: Colors.accentBtnBg, borderColor: Colors.accentSoft },
  inactive:  { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.15)' },
  text:      { color: Colors.textSecondary, fontWeight: '500' },
  activeText:{ color: Colors.accentSoft },
  normalText:{ fontSize: 13 },
  smallText: { fontSize: 11 },
});
