// @ts-ignore
import { Redirect, useRouter, Slot, usePathname } from 'expo-router';
// @ts-ignore
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Animated, Dimensions, View as RNView, Platform } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

import { Pressable, Text, SafeAreaView } from '@/components/ui';
import { useAuth, useIsFirstTime } from '@/lib';

// Import content screens
import PlaylistsScreen from '@/components/content/PlaylistsScreen';
import MoviesScreen from '@/components/content/MoviesScreen';
import SeriesScreen from '@/components/content/SeriesScreen';
import LiveScreen from '@/components/content/LiveScreen';
import Settings from './settings'; // Import the existing settings screen

const { width: screenWidth } = Dimensions.get('window');
const SIDEBAR_WIDTH = 360;

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
};

const menuItems: MenuItem[] = [
  {
    id: 'playlists',
    label: 'Playlists',
    icon: '📋',
    component: PlaylistsScreen,
  },
  { id: 'movies', label: 'Movies', icon: '🎬', component: MoviesScreen },
  { id: 'series', label: 'TV Series', icon: '📺', component: SeriesScreen },
  { id: 'live', label: 'Live TV', icon: '🔴', component: LiveScreen },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    component: Settings, // Use the existing settings screen
  },
];

export default function TVOSLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarVisible, setSidebarVisible] = useState(false); // Start with sidebar hidden
  // Default to Movies section instead of Playlists/Feed
  const [selectedMenuItem, setSelectedMenuItem] = useState(1);
  const sidebarAnimation = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current; // Start at -SIDEBAR_WIDTH (hidden)
  // tvOS remote event handler

  // Debug logging
  console.log(
    'TVOSLayout render - status:',
    status,
    'isFirstTime:',
    isFirstTime
  );

  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (status !== 'idle') {
      setTimeout(() => {
        hideSplash();
      }, 1000);
    }
  }, [hideSplash, status]);

  const showSidebar = () => {
    console.log('Showing sidebar');
    setSidebarVisible(true);
    Animated.timing(sidebarAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideSidebar = () => {
    console.log('Hiding sidebar');
    Animated.timing(sidebarAnimation, {
      toValue: -SIDEBAR_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSidebarVisible(false);
    });
  };

  const handleMenuItemPress = (index: number) => {
    console.log('Menu item pressed:', index, menuItems[index].label);
    setSelectedMenuItem(index);
    // Don't hide sidebar on tvOS - keep it visible for navigation
  };

  // No tv-remote arrow handling – keep navigation minimal and explicit via select/click

  // Gesture handler for swipe to open/close sidebar
  const onPanHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      const translationX = nativeEvent.translationX as number;
      // Swipe right should open, swipe left should close
      if (translationX > 30 && !sidebarVisible) {
        showSidebar();
      } else if (translationX < -30 && sidebarVisible) {
        hideSidebar();
      }
    }
  };

  // If first time, show onboarding for tvOS app too
  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }

  const CurrentComponent = menuItems[selectedMenuItem].component;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
      {/* Main Content - No header */}
      <PanGestureHandler onHandlerStateChange={onPanHandlerStateChange}>
        <RNView style={{ flex: 1 }}>
          {/* Content Area */}
          <RNView style={{ flex: 1 }}>
            <CurrentComponent />
            {/* Only overlay detail routes (movies/series/live/player), not index/feed */}
            {pathname &&
            (pathname.includes('/movies/') ||
              pathname.includes('/(app)/movies/') ||
              pathname.includes('/series/') ||
              pathname.includes('/(app)/series/') ||
              pathname.includes('/live/') ||
              pathname.includes('/(app)/live/') ||
              pathname.endsWith('/player') ||
              pathname.includes('/(app)/player')) ? (
              <RNView
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
              >
                <Slot />
              </RNView>
            ) : null}
          </RNView>
        </RNView>
      </PanGestureHandler>

      {/* Animated Sidebar - Opens with left arrow, closes with right arrow */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          transform: [{ translateX: sidebarAnimation }],
          backgroundColor: '#111827',
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 10,
          elevation: 10,
          zIndex: 1000,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* Sidebar Header */}
          <RNView
            style={{
              borderBottomWidth: 1,
              borderBottomColor: '#374151',
              padding: 24,
            }}
          >
            <Text style={{ fontSize: 30, fontWeight: 'bold', color: 'white' }}>
              Menu
            </Text>
            <Text style={{ marginTop: 8, fontSize: 16, color: '#9CA3AF' }}>
              Swipe right to open, left to close
            </Text>
          </RNView>

          {/* Menu Items */}
          <RNView style={{ flex: 1, padding: 16 }}>
            {menuItems.map((item, index) => (
              <SidebarMenuItem
                key={item.id}
                item={item}
                isSelected={selectedMenuItem === index}
                onPress={() => handleMenuItemPress(index)}
              />
            ))}
          </RNView>

          {/* Sidebar Footer */}
          <RNView
            style={{
              borderTopWidth: 1,
              borderTopColor: '#374151',
              padding: 24,
            }}
          >
            <Text style={{ color: '#6B7280' }}>
              Swipe: right=open, left=close
            </Text>
          </RNView>
        </SafeAreaView>
      </Animated.View>

      {/* Overlay when sidebar is visible */}
      {sidebarVisible && (
        <Pressable
          style={{
            position: 'absolute',
            left: SIDEBAR_WIDTH,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 999,
          }}
          onPress={hideSidebar}
        />
      )}
    </SafeAreaView>
  );
}

// Sidebar Menu Item Component
function SidebarMenuItem({
  item,
  isSelected,
  onPress,
}: {
  item: MenuItem;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => {}} // Simple focus handling
      style={{
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 20,
        backgroundColor: isSelected ? '#2563EB' : 'transparent',
      }}
    >
      <Text style={{ marginRight: 16, fontSize: 30 }}>{item.icon}</Text>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '500',
          color: isSelected ? 'white' : '#D1D5DB',
        }}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}
