// import { usePathname } from 'expo-router';
import { Database, Heart, Home, List, Settings } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

import { View } from '@/components/ui';
import { type AnimationKey } from '@/components/ui/lottie-animations';

import { BottomTabItem } from './BottomTabItem';
import { MOBILE_TAB_ITEMS } from './navigation-types';

const ICON_MAP = {
  home: Home,
  heart: Heart,
  list: List,
  sources: Database,
  settings: Settings,
};

const ANIMATION_MAP: Record<string, AnimationKey> = {
  home: 'home',
  heart: 'heart',
  list: 'bookmark',
  sources: 'database',
  settings: 'settings',
};

export function BottomTabBar() {

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
            const animationKey = item.icon ? ANIMATION_MAP[item.icon] : null;
            const fallbackIcon = item.icon
              ? ICON_MAP[item.icon as keyof typeof ICON_MAP]
              : null;

            return animationKey ? (
              <BottomTabItem
                key={item.href}
                label={item.label}
                href={item.href}
                animationKey={animationKey}
                fallbackIcon={fallbackIcon}
              />
            ) : null;
          })}
        </View>
      </View>
    </View>
  );
}
