/**
 * GlassCard — White-theme card replacing the old glassmorphism dark card.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function GlassCard({ children, style, borderRadius = 16 }) {
  return (
    <View style={[styles.card, { borderRadius }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0EAFC',
    shadowColor: '#1850B4',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    overflow: 'hidden',
  },
});
