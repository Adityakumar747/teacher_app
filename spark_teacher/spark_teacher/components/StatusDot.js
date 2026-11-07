import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Status Dot Component (.sd)
 * Authority: docs/Teacher_App_Design.html
 * 4 States:
 * - completed: Green (#12794A) with #12794A33 halo
 * - missed:    Red (#E5484D) with #E5484D33 halo
 * - ongoing:   Amber (#E8A317) with #E8A31733 halo
 * - upcoming:  Grey (#B7C0D3) with #B7C0D333 halo
 */
export default function StatusDot({
  status = 'upcoming', // 'completed' | 'ongoing' | 'upcoming' | 'missed'
  size = 10,
  withHalo = true,
  style,
}) {
  const getDotMeta = () => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'taken':
      case 'done':
        return { color: colors.green, halo: 'rgba(18, 121, 74, 0.20)' };
      case 'ongoing':
      case 'now':
        return { color: colors.amber, halo: 'rgba(232, 163, 23, 0.20)' };
      case 'missed':
        return { color: colors.redDot, halo: 'rgba(229, 72, 77, 0.20)' };
      case 'upcoming':
      default:
        return { color: colors.greyDot, halo: 'rgba(183, 192, 211, 0.20)' };
    }
  };

  const { color, halo } = getDotMeta();
  const radius = size / 2;
  const haloPadding = withHalo ? 2.5 : 0;

  return (
    <View
      style={[
        styles.dotContainer,
        withHalo && {
          padding: haloPadding,
          backgroundColor: halo,
          borderRadius: (size + haloPadding * 2) / 2,
        },
        style,
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
