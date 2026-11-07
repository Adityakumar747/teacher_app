import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows } from '../theme/colors';

/**
 * Custom Floating Bottom Tab Bar
 * Strictly replicates .nav from docs/Teacher_App_Design.html:
 * height: 64, border-radius: 22, box-shadow: 0 6 24 rgba(11,31,79,.12)
 * Active pill: width 56, height 44, border-radius 16, background: var(--soft)
 */
export default function BottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const bottomMargin = Math.max(insets.bottom, 16);

  const icons = {
    Dashboard: 'home',
    Attendance: 'check-circle',
    Assignments: 'file-text',
    Profile: 'user',
  };

  return (
    <View style={[styles.wrapper, { bottom: bottomMargin }]} pointerEvents="box-none">
      <View style={styles.navContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const iconName = icons[route.name] || 'circle';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel || route.name}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.7}
              style={[
                styles.tabItem,
                isFocused && styles.tabItemActive,
              ]}
            >
              <Feather
                name={iconName}
                size={22}
                color={isFocused ? colors.navy : colors.muted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  navContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 64,
    backgroundColor: colors.white,
    borderRadius: radius.nav,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    ...shadows.nav,
  },
  tabItem: {
    width: 56,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: colors.soft,
  },
});

