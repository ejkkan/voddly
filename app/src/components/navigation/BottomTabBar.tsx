import { Link, usePathname } from 'expo-router';
import { Database, Heart, Home, List, Settings } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';

import { MOBILE_TAB_ITEMS } from './navigation-types';

const ICON_MAP = {
  home: Home,
  heart: Heart,
  list: List,
  sources: Database,
  settings: Settings,
};

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <View
      className="absolute inset-x-0 bottom-0 z-50 border-t border-white/5 bg-black/60"
      style={{
        backdropFilter: Platform.OS === 'web' ? 'blur(30px)' : undefined,
        WebkitBackdropFilter: Platform.OS === 'web' ? 'blur(30px)' : undefined,
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
      }}
    >
      <View>
        <View className="flex-row items-center justify-around py-2">
          {MOBILE_TAB_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === '/(app)/dashboard' && pathname === '/(app)');
            const Icon = item.icon
              ? ICON_MAP[item.icon as keyof typeof ICON_MAP]
              : null;

            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable className="flex-1 items-center py-2">
                  {Icon && (
                    <Icon size={24} color={active ? '#fff' : '#6b7280'} />
                  )}
                  <Text
                    className={
                      'text-xs ' +
                      (active ? 'font-semibold text-white' : 'text-gray-500')
                    }
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>
    </View>
  );
}
