import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, shadows } from '../theme/colors';

/**
 * Base Card Component (.card / .wc)
 * Authority: docs/Teacher_App_Design.html
 */
export default function Card({ children, style, noPadding = false }) {
  return (
    <View style={[styles.card, noPadding && styles.noPadding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 16,
    overflow: 'hidden',
    ...shadows.card,
  },
  noPadding: {
    padding: 0,
  },
});
