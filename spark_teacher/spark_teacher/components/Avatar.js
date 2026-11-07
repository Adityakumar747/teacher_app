import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography } from '../theme/colors';

/**
 * Avatar Component (.av / .ava / .pav)
 * Authority: docs/Teacher_App_Design.html
 * Sizes: 'sm' (40px, list row), 'md' (44px, header), 'lg' (88px, profile)
 */
export default function Avatar({
  uri,
  name = 'User',
  size = 40,
  variant = 'soft', // 'soft' (blue tint) | 'navy' (dark header) | 'profile' (ring)
  style,
}) {
  const getInitials = (n) => {
    if (!n) return 'U';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isProfile = variant === 'profile' || size >= 80;
  const isNavy = variant === 'navy';

  const bgColor = isNavy ? colors.navy : colors.soft;
  const textColor = isNavy ? colors.white : colors.navy;
  const fontSize = size >= 80 ? 28 : size >= 44 ? 14 : 13;

  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: bgColor,
    },
    isProfile && styles.profileRing,
    style,
  ];

  if (uri) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={[styles.initials, { fontSize, color: textColor }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  profileRing: {
    borderWidth: 3,
    borderColor: colors.blueBright, // #4C7DFF
  },
  initials: {
    fontWeight: '800',
    fontFamily: typography.fontFamily.extraBold,
  },
});
