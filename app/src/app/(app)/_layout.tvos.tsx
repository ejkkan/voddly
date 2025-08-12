import { Redirect, SplashScreen, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';

import { Pressable, Text, View, SafeAreaView } from '@/components/ui';
import { useAuth, useIsFirstTime } from '@/lib';
import { useTVOSFocus } from '@/lib/tvos-focus';

// Import content screens
import PlaylistsScreen from '@/components/content/PlaylistsScreen';
import MoviesScreen from '@/components/content/MoviesScreen';
import SeriesScreen from '@/components/content/SeriesScreen';
import LiveScreen from '@/components/content/LiveScreen';

const { width: screenWidth } = Dimensions.get('window');
const SIDEBAR_WIDTH = 280;

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
    component: () => <Text>Settings Screen</Text>,
  },
];

export default function TVOSLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  const router = useRouter();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(0);
  const sidebarAnimation = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

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
    setSidebarVisible(true);
    Animated.timing(sidebarAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideSidebar = () => {
    Animated.timing(sidebarAnimation, {
      toValue: -SIDEBAR_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSidebarVisible(false);
    });
  };

  const handleMenuItemPress = (index: number) => {
    setSelectedMenuItem(index);
    hideSidebar();
  };

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signOut') {
    return <Redirect href="/login" />;
  }

  const CurrentComponent = menuItems[selectedMenuItem].component;

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {/* Main Content */}
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between bg-gray-800 px-8 py-4">
          <Pressable onPress={showSidebar} className="flex-row items-center">
            <Text className="mr-3 text-2xl">☰</Text>
            <Text className="text-3xl font-bold text-white">IPTV Test</Text>
          </Pressable>
          <Text className="text-xl text-gray-400">
            {menuItems[selectedMenuItem].label}
          </Text>
        </View>

        {/* Content Area */}
        <View className="flex-1">
          <CurrentComponent />
        </View>
      </View>

      {/* Animated Sidebar */}
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
        }}
      >
        <SafeAreaView className="flex-1">
          {/* Sidebar Header */}
          <View className="border-b border-gray-700 p-6">
            <Text className="text-3xl font-bold text-white">Menu</Text>
            <Text className="mt-2 text-gray-400">Navigate with remote</Text>
          </View>

          {/* Menu Items */}
          <View className="flex-1 p-4">
            {menuItems.map((item, index) => (
              <SidebarMenuItem
                key={item.id}
                item={item}
                isSelected={selectedMenuItem === index}
                onPress={() => handleMenuItemPress(index)}
              />
            ))}
          </View>

          {/* Sidebar Footer */}
          <View className="border-t border-gray-700 p-6">
            <Text className="text-gray-500">Swipe right to close</Text>
          </View>
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
            backgroundColor: 'rgba(0,0,0,0.5)',
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
  const focusHandler = useTVOSFocus(onPress);

  return (
    <Pressable
      {...focusHandler.focusProps}
      onPress={onPress}
      className={`mb-3 flex-row items-center rounded-xl p-5 ${
        isSelected
          ? 'bg-blue-600'
          : focusHandler.isFocused
            ? 'bg-gray-700'
            : 'bg-transparent'
      }`}
    >
      <Text className="mr-4 text-3xl">{item.icon}</Text>
      <Text
        className={`text-xl font-medium ${
          isSelected ? 'text-white' : 'text-gray-300'
        }`}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}
