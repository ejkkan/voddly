import { BackdropFilter, Blur, Canvas, rect } from '@shopify/react-native-skia';
import { Link, usePathname, useRouter } from 'expo-router';
import { Tv } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { HybridIcon, Pressable, Text, View } from '@/components/ui';
import { type HybridIconName } from '@/components/ui/HybridIcon';
import { useProfile } from '@/hooks/useProfile';

type SidebarItem = {
  label: string;
  href: string;
  icon: HybridIconName;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  // { label: 'Home', href: '/(app)/dashboard', icon: 'home' },
  { label: 'Favourites', href: '/(app)/favorites', icon: 'heart' },
  { label: 'Playlists', href: '/(app)/playlists', icon: 'bookmark' },
  { label: 'Sources', href: '/(app)/sources', icon: 'folder' },
  {
    label: 'Notifications',
    href: '/(app)/notifications',
    icon: 'notification', // This will now use the Lordicon notification
  },
];

const BOTTOM_ITEMS: SidebarItem[] = [
  { label: 'Profile', href: '/(app)/profiles', icon: 'userPlus' },
  { label: 'Settings', href: '/(app)/settings', icon: 'settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();

  return (
    <View
      className="fixed inset-y-0 left-0 z-40 h-full w-20 border-r border-white/5"
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
          <Pressable
            onPress={() => router.push('/(app)/icon-creator' as any)}
            className="flex size-12 items-center justify-center rounded-lg transition-all hover:bg-white/10"
          >
            <Tv size={28} color="#fff" />
          </Pressable>
        </View>

        {/* Main Navigation */}
        <View className="gap-4">
          {SIDEBAR_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === '/(app)/dashboard' && pathname === '/(app)');

            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  className={
                    'relative flex h-12 w-12 items-center justify-center rounded-lg transition-all ' +
                    (active ? 'bg-white/20' : 'hover:bg-white/10')
                  }
                >
                  {active && (
                    <View className="absolute -left-3 h-8 w-1 rounded-r bg-white" />
                  )}
                  <HybridIcon
                    name={item.icon}
                    size={22}
                    strokeColor={active ? '#fff' : '#fff'}
                    animateOnHover={true}
                    active={active}
                  />
                </Pressable>
              </Link>
            );
          })}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Bottom Navigation */}
        <View className="gap-4">
          {BOTTOM_ITEMS.map((item) => {
            const active = pathname === item.href;

            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  className={
                    'flex h-12 w-12 items-center justify-center rounded-lg transition-all ' +
                    (active ? 'bg-white/20' : 'hover:bg-white/10')
                  }
                >
                  <HybridIcon
                    name={item.icon}
                    size={22}
                    strokeColor={active ? '#fff' : '#fff'}
                    animateOnHover={true}
                    active={active}
                  />
                </Pressable>
              </Link>
            );
          })}
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
