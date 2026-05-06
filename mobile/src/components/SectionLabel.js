/**
 * SectionLabel — uppercase blue category label.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';

export default function SectionLabel({ children, style }) {
  return (
    <Text style={[styles.label, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#1850B4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
