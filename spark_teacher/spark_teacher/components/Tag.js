import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../theme/colors';

/**
 * Status Tag / Badge (.tag)
 * Authority: docs/Teacher_App_Design.html
 * Variants: amber, red, blue, green
 */
export default function Tag({
  label,
  variant = 'blue', // 'amber' | 'red' | 'blue' | 'green'
  customBg,
  customColor,
  style,
  textStyle,
}) {
  const token = colors.tags[variant] || colors.tags.blue;
  const bg = customBg || token.bg;
  const color = customColor || token.text;

  return (
    <View style={[styles.tag, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.tag,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
});

