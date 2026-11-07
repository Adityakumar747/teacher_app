import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, typography, shadows } from '../theme/colors';

/**
 * Custom Dropdown Select (.dd / .menu)
 * Authority: docs/Teacher_App_Design.html
 * Displays label, selected value, chevron rotating 180deg, and option list.
 */
export default function Dropdown({
  label = 'SELECT CLASS',
  value,
  options = [], // [{ id, label, subtitle }]
  onSelect,
  placeholder = 'Select an option',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    Animated.timing(rotateAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleSelect = (item) => {
    if (onSelect) onSelect(item);
    toggleOpen();
  };

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const selectedItem = options.find((o) => (o.id || o) === (value?.id || value));
  const displayText = selectedItem ? selectedItem.label || selectedItem.name || selectedItem : placeholder;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggleOpen}
        style={styles.headerButton}
        accessibilityRole="combobox"
        accessibilityExpanded={isOpen}
      >
        <View style={styles.textContainer}>
          <Text style={styles.smallLabel}>{label}</Text>
          <Text style={styles.valueText} numberOfLines={1}>
            {displayText}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Feather name="chevron-down" size={20} color={colors.navy} />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.menu}>
          {options.map((item) => {
            const itemId = item.id || item;
            const itemLabel = item.label || item.name || item;
            const isSelected = (value?.id || value) === itemId;

            return (
              <TouchableOpacity
                key={itemId}
                activeOpacity={0.7}
                onPress={() => handleSelect(item)}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionSelected,
                ]}
              >
                <Text style={styles.optionText}>{itemLabel}</Text>
                {item.subtitle && (
                  <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 50,
  },
  headerButton: {
    width: '100%',
    height: 56,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
    color: colors.muted,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: typography.fontFamily.extraBold,
    color: colors.navy,
  },
  menu: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 6,
    zIndex: 100,
    ...shadows.dropdownMenu,
  },
  optionButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: {
    backgroundColor: colors.soft,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
    color: colors.navy,
  },
  optionSubtitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
  },
});

