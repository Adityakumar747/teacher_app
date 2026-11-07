import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { colors, typography } from '../theme/colors';

/**
 * Animated Circular Progress Ring for Home Hero
 * Authority: docs/Teacher_App_Design.html (88x88 circular countdown with animated stroke)
 * Features:
 * - Dynamic green progress arc that fills up as class time elapses
 * - Entrance sweep animation on first mount (0% -> target% in 1.2s)
 * - Scaled center value and label
 * - Pixel-perfect matching with design HTML (#home)
 */
export default function ProgressRing({
  value = 32,
  label = 'min left',
  progress = 0.47, // 0.0 to 1.0 (elapsed ratio)
  size = 88,
  strokeWidth = 8,
  strokeColor = '#7FE0A8',
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius; // ~226.195
  const clampedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const targetOffset = circumference * (1 - clampedProgress);

  // Entrance animation state for Web SVG
  const [currentOffset, setCurrentOffset] = useState(circumference); // Starts empty
  const textScaleAnim = useRef(new Animated.Value(0.7)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance sweep animation for stroke
    const timer = setTimeout(() => {
      setCurrentOffset(targetOffset);
    }, 60);

    // 2. Center text spring animation
    Animated.parallel([
      Animated.spring(textScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    return () => clearTimeout(timer);
  }, []);

  // When progress updates live during runtime
  useEffect(() => {
    setCurrentOffset(targetOffset);
  }, [targetOffset]);

  const innerSize = size - strokeWidth * 2;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        {/* Native Web SVG for 60fps hardware accelerated stroke sweep */}
        <svg
          viewBox="0 0 88 88"
          width={size}
          height={size}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            overflow: 'visible',
          }}
        >
          {/* Subtle Outer Glow Filter */}
          <defs>
            <filter id="greenGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7FE0A8" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.16)"
            strokeWidth={strokeWidth}
          />

          {/* Animated Dynamic Green Arc */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={currentOffset}
            transform="rotate(-90 44 44)"
            filter="url(#greenGlow)"
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>

        {/* Centered Value & Label with Spring In */}
        <Animated.View
          style={[
            styles.content,
            {
              width: innerSize,
              height: innerSize,
              opacity: textOpacityAnim,
              transform: [{ scale: textScaleAnim }],
            },
          ]}
        >
          <Text style={styles.valueText}>{value}</Text>
          <Text style={styles.labelText}>{label}</Text>
        </Animated.View>
      </View>
    );
  }

  // Native Mobile Fallback using Animated View
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.trackRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'rgba(255, 255, 255, 0.16)',
          },
        ]}
      />

      <View
        style={[
          styles.accentRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: strokeColor,
            borderTopColor: 'transparent',
            borderRightColor: 'transparent',
            transform: [{ rotate: `${-90 + clampedProgress * 360}deg` }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            width: innerSize,
            height: innerSize,
            opacity: textOpacityAnim,
            transform: [{ scale: textScaleAnim }],
          },
        ]}
      >
        <Text style={styles.valueText}>{value}</Text>
        <Text style={styles.labelText}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trackRing: {
    position: 'absolute',
  },
  accentRing: {
    position: 'absolute',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  valueText: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 26,
    fontFamily: typography.fontFamily.extraBold,
    color: colors.white,
  },
  labelText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.onDarkMuted, // #C9D4F0
    marginTop: 1,
  },
});
