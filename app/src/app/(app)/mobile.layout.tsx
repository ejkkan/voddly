import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';

import { Pressable, Text, View, SafeAreaView } from '@/components/ui';
import {
  Feed as FeedIcon,
  Settings as SettingsIcon,
  Style as StyleIcon,
} from '@/components/ui/icons';
import { useAuth, useIsFirstTime } from '@/lib';

// Import content screens
import PlaylistsScreen from '@/components/content/PlaylistsScreen';
import MoviesScreen from '@/components/content/MoviesScreen';
import SeriesScreen from '@/components/content/SeriesScreen';
import LiveScreen from '@/components/content/LiveScreen';

// Simple top tabs component for home screen
function HomeScreen() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { label: 'Playlists', component: PlaylistsScreen },
    { label: 'Movies', component: MoviesScreen },
    { label: 'Series', component: SeriesScreen },
    { label: 'Live', component: LiveScreen },
  ];

  const ActiveComponent = tabs[activeTab].component;

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* Top Tabs */}
      <View className="flex-row border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.label}
            onPress={() => setActiveTab(index)}
            className={`flex-1 px-4 py-3 ${
              activeTab === index ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                activeTab === index
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View className="flex-1">
        <ActiveComponent />
      </View>
    </View>
  );
}

export default function MobileLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
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

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signOut') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <FeedIcon color={color} />,
          headerShown: true,
          header: () => <HomeHeader />,
          tabBarButtonTestID: 'home-tab',
        }}
      >
        {() => <HomeScreen />}
      </Tabs.Screen>

      <Tabs.Screen
        name="style"
        options={{
          title: 'Style',
          headerShown: false,
          tabBarIcon: ({ color }) => <StyleIcon color={color} />,
          tabBarButtonTestID: 'style-tab',
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
          tabBarButtonTestID: 'settings-tab',
        }}
      />

      {/* Hidden routes */}
      <Tabs.Screen
        name="movies/[id]"
        options={{
          href: null,
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="series/[id]"
        options={{
          href: null,
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="live/[id]"
        options={{
          href: null,
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          href: null,
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}

// Custom header for home screen
function HomeHeader() {
  return (
    <View className="bg-white px-4 pb-2 pt-12 dark:bg-black">
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          IPTV Test
        </Text>
        <Pressable className="rounded-full bg-gray-100 p-2 dark:bg-gray-800">
          <Text className="text-xl">👤</Text>
        </Pressable>
      </View>
    </View>
  );
}
