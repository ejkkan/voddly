import { Link, usePathname } from 'expo-router';
import React from 'react';

import { Pressable, Text, View } from 'react-native';
import {
  type AnimationKey,
  getAnimationByKey,
} from '@/components/ui/lottie-animations';
import { LottieIcon } from '@/components/ui/lottie-icon';

export interface BottomTabItemProps {
  label: string;
  href: string;
  animationKey: AnimationKey;
  fallbackIcon?: any; // Lucide icon as fallback
}

export const BottomTabItem: React.FC<BottomTabItemProps> = ({
  label,
  href,
  animationKey,
  fallbackIcon: FallbackIcon,
}) => {
  const pathname = usePathname();
  const active =
    pathname === href || (href === '/(app)/dashboard' && pathname === '/(app)');

  const activeColor = '#ffffff';
  const inactiveColor = '#6b7280';

  return (
    <Link href={href} asChild>
      <Pressable className="flex-1 items-center py-2">
        <LottieIcon
          source={getAnimationByKey(animationKey)}
          size={24}
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
              size={24}
              color={active ? activeColor : inactiveColor}
            />
          </View>
        )}

        <Text
          className={
            'text-xs ' + (active ? 'font-semibold text-white' : 'text-gray-500')
          }
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
};
