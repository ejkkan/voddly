import { Link, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { 
  Home, 
  Heart, 
  User, 
  Settings,
  Bell,
  Tv,
  Bookmark,
  Database
} from 'lucide-react-native';
import { Canvas, BackdropFilter, Blur, rect } from '@shopify/react-native-skia';
import { Pressable, Text, View } from '@/components/ui';
import { useProfile } from '@/hooks/useProfile';

type SidebarItem = {
  label: string;
  href: string;
  icon: any;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Home', href: '/(app)/dashboard', icon: Home },
  { label: 'Favourites', href: '/(app)/favorites', icon: Heart },
  { label: 'Playlists', href: '/(app)/playlists', icon: Bookmark },
  { label: 'Sources', href: '/(app)/sources', icon: Database },
  { label: 'Notifications', href: '/(app)/notifications', icon: Bell },
];

const BOTTOM_ITEMS: SidebarItem[] = [
  { label: 'Profile', href: '/(app)/profiles', icon: User },
  { label: 'Settings', href: '/(app)/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  
  return (
    <View 
      className="fixed bottom-0 left-0 top-0 z-40 w-20 border-r border-white/5"
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
        <Canvas style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <BackdropFilter filter={<Blur blur={12} />} clip={rect(0, 0, 80, 2000)} />
        </Canvas>
      )}
      <View className="absolute inset-0 bg-black/20 border-r border-white/5" />
      <View className="relative z-10 flex-1 flex-col items-center py-6">
        {/* Logo */}
        <View className="mb-8">
          <Tv size={28} color="#fff" />
        </View>

        {/* Main Navigation */}
        <View className="gap-4">
          {SIDEBAR_ITEMS.map((item) => {
            const active = pathname === item.href || 
                         (item.href === '/(app)/dashboard' && pathname === '/(app)');
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  className={
                    'relative flex h-12 w-12 items-center justify-center rounded-lg transition-all ' +
                    (active 
                      ? 'bg-white/20' 
                      : 'hover:bg-white/10')
                  }
                >
                  {active && (
                    <View className="absolute -left-3 h-8 w-1 rounded-r bg-white" />
                  )}
                  <Icon 
                    size={22} 
                    color={active ? '#fff' : '#9ca3af'}
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
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  className={
                    'flex h-12 w-12 items-center justify-center rounded-lg transition-all ' +
                    (active 
                      ? 'bg-white/20' 
                      : 'hover:bg-white/10')
                  }
                >
                  <Icon 
                    size={22} 
                    color={active ? '#fff' : '#9ca3af'}
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
            className="mt-4 h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500"
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