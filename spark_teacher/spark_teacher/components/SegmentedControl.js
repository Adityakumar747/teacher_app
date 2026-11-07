import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { colors, radius, typography } from '../theme/colors';

/**
 * 2-State Segmented Control (Present | Absent)
 * Authority: docs/Teacher_App_Design.html (.seg button.p.on / button.a.on)
 * Requirements:
 * - Default marked Present
 * - Smooth sliding pill animation between Present and Absent
 * - Green (#12794A) for Present, Red (#C0392B) for Absent
 * - 44px min touch target for accessibility
 */
export default function SegmentedControl({
  value = 'P', // 'P' or 'A'
  onChange,
  disabled = false,
}) {
  const isPresent = value === 'P' || value === 'present';
  const slideAnim = useRef(new Animated.Value(isPresent ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isPresent ? 0 : 1,
      useNativeDriver: true,
      bounciness: 4,
      speed: 18,
    }).start();
  }, [isPresent, slideAnim]);

  const buttonWidth = 74;
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, buttonWidth],
  });

  const handleSelect = (nextVal) => {
    if (disabled || nextVal === value) return;
    if (onChange) {
      onChange(nextVal);
    }
  };

  const activeColor = isPresent ? colors.green : colors.red;

  return (
    <View style={styles.track}>
      {/* Sliding Animated Pill Background */}
      <Animated.View
        style={[
          styles.activeSlider,
          {
            width: buttonWidth,
            backgroundColor: activeColor,
            transform: [{ translateX }],
          },
        ]}
      />

      {/* Present Option */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => handleSelect('P')}
        style={[styles.button, { width: buttonWidth }]}
        accessibilityRole="button"
        accessibilityLabel="Mark Present"
        accessibilityState={{ selected: isPresent }}
      >
        <Text
          style={[
            styles.label,
            isPresent ? styles.labelActive : styles.labelInactive,
          ]}
        >
          Present
        </Text>
      </TouchableOpacity>

      {/* Absent Option */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => handleSelect('A')}
        style={[styles.button, { width: buttonWidth }]}
        accessibilityRole="button"
        accessibilityLabel="Mark Absent"
        accessibilityState={{ selected: !isPresent }}
      >
        <Text
          style={[
            styles.label,
            !isPresent ? styles.labelActive : styles.labelInactive,
          ]}
        >
          Absent
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: colors.divider, // #EEF1F7
    borderRadius: 14,
    padding: 3,
    height: 44, // 44px accessible touch target
    alignItems: 'center',
  },
  activeSlider: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 11,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  labelActive: {
    color: colors.white,
  },
  labelInactive: {
    color: colors.muted,
  },
});

