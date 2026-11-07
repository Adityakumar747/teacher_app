import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '../theme/colors';

/**
 * Animated SuccessToast
 * Displays a delightful floating success card on Web & Mobile
 * Features:
 * - Spring scale + slide down animation
 * - Green checkmark circle
 * - Title and Subtitle
 * - Auto-dismiss after durationMs (default 2600ms)
 * - Click/Tap to dismiss immediately
 */
export default function SuccessToast({
  visible = false,
  title = 'Success!',
  subtitle = '',
  durationMs = 2600,
  onDismiss,
  variant = 'success', // 'success' | 'info' | 'deleted'
}) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // Animate In
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 7,
        }),
      ]).start();

      // Auto dismiss timer
      const timer = setTimeout(() => {
        handleDismiss();
      }, durationMs);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-60);
      opacity.setValue(0);
      scale.setValue(0.9);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -40,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) {
        onDismiss();
      }
    });
  };

  if (!visible) return null;

  const isDelete = variant === 'deleted';
  const badgeBg = isDelete ? '#FEE2E2' : '#DCFCE7';
  const iconColor = isDelete ? colors.red : colors.green;
  const iconName = isDelete ? 'trash-2' : 'check';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastCard,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.innerRow}
          onPress={handleDismiss}
          accessibilityRole="alert"
        >
          {/* Animated Icon Circle */}
          <View style={[styles.iconCircle, { backgroundColor: badgeBg }]}>
            <Feather name={iconName} size={20} color={iconColor} />
          </View>

          {/* Texts */}
          <View style={styles.textColumn}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitleText} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Close tap icon */}
          <View style={styles.closeBtn}>
            <Feather name="x" size={16} color={colors.mut} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 24 : 54,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0B1F4F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: typography.fontFamily.extraBold,
    color: colors.navy,
  },
  subtitleText: {
    fontSize: 12,
    color: colors.mut,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 4,
  },
});

