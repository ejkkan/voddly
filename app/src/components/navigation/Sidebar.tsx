import { BackdropFilter, Blur, Canvas, rect } from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import {
  Bell,
  Bookmark,
  Database,
  Heart,
  Home,
  Settings,
  Tv,
  User,
} from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';
import { type AnimationKey } from '@/components/ui/lottie-animations';
import { useProfile } from '@/hooks/useProfile';

import { SidebarItem } from './SidebarItem';

type SidebarItemConfig = {
  label: string;
  href: string;
  animationKey: AnimationKey;
  fallbackIcon: any;
};

const SIDEBAR_ITEMS: SidebarItemConfig[] = [
  {
    label: 'Home',
    href: '/(app)/dashboard',
    animationKey: 'home',
    fallbackIcon: Home,
  },
  {
    label: 'Favourites',
    href: '/(app)/favorites',
    animationKey: 'heart',
    fallbackIcon: Heart,
  },
  {
    label: 'Playlists',
    href: '/(app)/playlists',
    animationKey: 'bookmark',
    fallbackIcon: Bookmark,
  },
  {
    label: 'Sources',
    href: '/(app)/sources',
    animationKey: 'database',
    fallbackIcon: Database,
  },
  {
    label: 'Notifications',
    href: '/(app)/notifications',
    animationKey: 'bell',
    fallbackIcon: Bell,
  },
];

const BOTTOM_ITEMS: SidebarItemConfig[] = [
  {
    label: 'Profile',
    href: '/(app)/profiles',
    animationKey: 'user',
    fallbackIcon: User,
  },
  {
    label: 'Settings',
    href: '/(app)/settings',
    animationKey: 'settings',
    fallbackIcon: Settings,
  },
];

export function Sidebar() {
  const router = useRouter();
  const { profile } = useProfile();

  return (
    <View
      className="fixed inset-y-0 left-0 z-40 w-20 border-r border-white/5"
      style={{ position: 'relative' }}
    >
      {Platform.OS === 'web' ? (
        <View
          className="absolute inset-0 bg-black/20"
          style={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        />
      ) : (
        <Canvas
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <BackdropFilter
            filter={<Blur blur={12} />}
            clip={rect(0, 0, 80, 2000)}
          />
        </Canvas>
      )}
      <View className="absolute inset-0 border-r border-white/5 bg-black/20" />
      <View className="relative z-10 flex-1 flex-col items-center py-6">
        {/* Logo */}
        <View className="mb-8">
          <Tv size={28} color="#fff" />
        </View>

        {/* Main Navigation */}
        <View className="gap-4">
          {SIDEBAR_ITEMS.map((item) => (
            <SidebarItem
              key={item.href}
              label={item.label}
              href={item.href}
              animationKey={item.animationKey}
              fallbackIcon={item.fallbackIcon}
            />
          ))}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Bottom Navigation */}
        <View className="gap-4">
          {BOTTOM_ITEMS.map((item) => (
            <SidebarItem
              key={item.href}
              label={item.label}
              href={item.href}
              animationKey={item.animationKey}
              fallbackIcon={item.fallbackIcon}
            />
          ))}
        </View>

        {/* User Avatar */}
        {profile && (
          <Pressable
            onPress={() => router.push('/(app)/profiles')}
            className="mt-4 size-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500"
          >
            <Text className="text-lg font-bold text-white">
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
