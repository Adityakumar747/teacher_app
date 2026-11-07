import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/colors';

export default function Chip({
  label,
  selected = false,
  onPress,
  color,
  textColor,
  count,
  icon,
  style,
}) {
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
        color && { backgroundColor: color },
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.label,
          selected ? styles.selectedText : styles.unselectedText,
          textColor && { color: textColor },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <View
          style={[
            styles.countBadge,
            selected ? styles.countBadgeSelected : styles.countBadgeUnselected,
          ]}
        >
          <Text
            style={[
              styles.countText,
              selected ? styles.countTextSelected : styles.countTextUnselected,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </Component>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: spacing.chipRadius,
  },
  unselected: {
    backgroundColor: '#F3F4F6',
  },
  selected: {
    backgroundColor: colors.primary,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  unselectedText: {
    color: colors.textSecondary,
  },
  selectedText: {
    color: '#FFFFFF',
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeUnselected: {
    backgroundColor: '#E5E7EB',
  },
  countBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countTextUnselected: {
    color: colors.textSecondary,
  },
  countTextSelected: {
    color: '#FFFFFF',
  },
});
