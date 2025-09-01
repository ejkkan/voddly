import { Link, usePathname } from 'expo-router';
import React from 'react';

import { Pressable, View } from 'react-native';
import {
  type AnimationKey,
  getAnimationByKey,
} from '@/components/ui/lottie-animations';
import { LottieIcon } from '@/components/ui/lottie-icon';

export interface SidebarItemProps {
  label: string;
  href: string;
  animationKey: AnimationKey;
  fallbackIcon?: any; // Lucide icon as fallback
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  label,
  href,
  animationKey,
  fallbackIcon: FallbackIcon,
}) => {
  const pathname = usePathname();
  const active =
    pathname === href || (href === '/(app)/dashboard' && pathname === '/(app)');

  const activeColor = '#ffffff';
  const inactiveColor = '#9ca3af';

  return (
    <Link href={href} asChild>
      <Pressable
        className={
          'relative flex h-12 w-12 items-center justify-center rounded-lg transition-all ' +
          (active ? 'bg-white/20' : 'hover:bg-white/10')
        }
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {active && (
          <View className="absolute -left-3 h-8 w-1 rounded-r bg-white" />
        )}

        <LottieIcon
          source={getAnimationByKey(animationKey)}
          size={22}
          color={active ? activeColor : inactiveColor}
          autoPlay={active}
          loop={active}
          speed={active ? 1 : 0.5}
          isActive={active}
        />

        {/* Fallback to Lucide icon if Lottie fails */}
        {FallbackIcon && (
          <View style={{ position: 'absolute', opacity: 0 }}>
            <FallbackIcon
              size={22}
              color={active ? activeColor : inactiveColor}
            />
          </View>
        )}
      </Pressable>
    </Link>
  );
};
