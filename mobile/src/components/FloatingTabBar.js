import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_ICONS = {
  HomeTab:    'home',
  SearchTab:  'search',
  ProfileTab: 'user',
};

const TAB_LABELS = {
  HomeTab:    'Home',
  SearchTab:  'Search',
  ProfileTab: 'Profile',
};

export default function FloatingTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconName = TAB_ICONS[route.name] || 'circle';
          const label = TAB_LABELS[route.name] || route.name;

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

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Feather
                  name={iconName}
                  size={21}
                  color={isFocused ? '#1850B4' : '#94A3C0'}
                />
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: '#E2EAF8',
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 6,
  },
  iconWrap: {
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  iconWrapActive: {
    backgroundColor: '#EEF4FF',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3C0',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#1850B4',
    fontWeight: '700',
  },
});
