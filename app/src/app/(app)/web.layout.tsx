import { Redirect, SplashScreen, useRouter, usePathname } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { useAuth, useIsFirstTime } from '@/lib';

// Import content screens
import PlaylistsScreen from '@/components/content/PlaylistsScreen';
import MoviesScreen from '@/components/content/MoviesScreen';
import SeriesScreen from '@/components/content/SeriesScreen';
import LiveScreen from '@/components/content/LiveScreen';

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  path: string;
  component: React.ComponentType;
};

const menuItems: MenuItem[] = [
  {
    id: 'playlists',
    label: 'Playlists',
    icon: '📋',
    path: '/playlists',
    component: PlaylistsScreen,
  },
  {
    id: 'movies',
    label: 'Movies',
    icon: '🎬',
    path: '/movies',
    component: MoviesScreen,
  },
  {
    id: 'series',
    label: 'TV Series',
    icon: '📺',
    path: '/series',
    component: SeriesScreen,
  },
  {
    id: 'live',
    label: 'Live TV',
    icon: '🔴',
    path: '/live',
    component: LiveScreen,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    path: '/settings',
    component: () => <SettingsScreen />,
  },
];

// Settings Screen Component
function SettingsScreen() {
  return (
    <View className="flex-1 bg-white p-8 dark:bg-black">
      <Text className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
        Settings
      </Text>
      <View className="space-y-4">
        <SettingItem label="Account" icon="👤" />
        <SettingItem label="Preferences" icon="🎨" />
        <SettingItem label="Playback Quality" icon="🎥" />
        <SettingItem label="Parental Controls" icon="🔒" />
        <SettingItem label="About" icon="ℹ️" />
      </View>
    </View>
  );
}

function SettingItem({ label, icon }: { label: string; icon: string }) {
  return (
    <Pressable className="flex-row items-center rounded-lg bg-gray-100 p-4 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
      <Text className="mr-3 text-2xl">{icon}</Text>
      <Text className="text-lg text-gray-900 dark:text-white">{label}</Text>
    </Pressable>
  );
}

export default function WebLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedMenuItem, setSelectedMenuItem] = useState(0);

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

  // Update selected menu item based on current path
  useEffect(() => {
    const currentIndex = menuItems.findIndex((item) =>
      pathname.includes(item.id)
    );
    if (currentIndex !== -1) {
      setSelectedMenuItem(currentIndex);
    }
  }, [pathname]);

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signOut') {
    return <Redirect href="/login" />;
  }

  const CurrentComponent = menuItems[selectedMenuItem].component;

  return (
    <View className="flex h-screen flex-row bg-gray-50 dark:bg-gray-900">
      {/* Fixed Sidebar */}
      <View className="w-64 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Logo */}
        <View className="border-b border-gray-200 p-6 dark:border-gray-700">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            IPTV Test
          </Text>
          <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Desktop Dashboard
          </Text>
        </View>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          {menuItems.map((item, index) => (
            <SidebarMenuItem
              key={item.id}
              item={item}
              isSelected={selectedMenuItem === index}
              onPress={() => {
                setSelectedMenuItem(index);
                router.push(item.path);
              }}
            />
          ))}
        </nav>

        {/* User Section */}
        <View className="border-t border-gray-200 p-4 dark:border-gray-700">
          <Pressable className="flex-row items-center rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600">
              <Text className="text-xl">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-900 dark:text-white">
                User Account
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                user@example.com
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              router.push('/login');
            }}
            className="mt-2 rounded-lg bg-red-50 p-3 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
          >
            <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 overflow-hidden">
        {/* Top Bar */}
        <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-8 py-4 dark:border-gray-700 dark:bg-gray-800">
          <Text className="text-xl font-semibold text-gray-900 dark:text-white">
            {menuItems[selectedMenuItem].label}
          </Text>

          {/* Search and Actions */}
          <View className="flex-row items-center space-x-4">
            <Pressable className="rounded-lg bg-gray-100 px-4 py-2 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">
              <Text className="text-gray-700 dark:text-gray-300">
                🔍 Search
              </Text>
            </Pressable>
            <Pressable className="rounded-lg bg-gray-100 px-4 py-2 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">
              <Text className="text-gray-700 dark:text-gray-300">🔔</Text>
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1 overflow-auto">
          <CurrentComponent />
        </View>
      </View>
    </View>
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
      className={`mb-1 flex-row items-center rounded-lg px-4 py-3 transition-colors ${
        isSelected
          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      <Text className="mr-3 text-xl">{item.icon}</Text>
      <Text
        className={`font-medium ${
          isSelected
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}
