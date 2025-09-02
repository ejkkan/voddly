import { Player } from '@lordicon/react';
import React, { useRef } from 'react';
import { Platform, type ViewStyle } from 'react-native';

import NOTIFICATION_ICON from '@/assets/lordicons/notification.js';

interface LordIconProps {
  /** The JSON icon data */
  icon: any;
  /** Size of the icon in pixels */
  size?: number;
  /** Whether to animate on hover/press */
  animateOnHover?: boolean;
  /** Whether the icon is in an active state */
  active?: boolean;
  /** Additional styles for the wrapper */
  style?: ViewStyle;
  /** Callback when icon is pressed/clicked */
  onPress?: () => void;
  /** Colors to apply to the icon */
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

/**
 * LordIcon - A wrapper component for Lordicon animated icons
 *
 * Provides a consistent interface for using Lordicon animations with hover effects
 * and active states, similar to the AnimatedIcon component.
 *
 * @example
 * ```tsx
 * import notificationIcon from '@/assets/icons/notification.json';
 *
 * <LordIcon
 *   icon={notificationIcon}
 *   size={24}
 *   animateOnHover
 *   colors={{ primary: '#fff' }}
 * />
 * ```
 */
export function LordIcon({
  icon,
  size = 24,
  animateOnHover = false,
  active = false,
  style,
  onPress,
  colors = { primary: '#ffffff' },
}: LordIconProps) {
  const playerRef = useRef<Player>(null);

  const handleMouseEnter = () => {
    if (animateOnHover && playerRef.current) {
      playerRef.current.playFromBeginning();
    }
  };

  const handlePress = () => {
    if (playerRef.current) {
      playerRef.current.playFromBeginning();
    }
    onPress?.();
  };

  // Trigger animation when active
  React.useEffect(() => {
    if (active && playerRef.current) {
      playerRef.current.playFromBeginning();
    }
  }, [active]);

  // Add error handling for missing icon data
  if (!icon) {
    console.error('LordIcon: icon prop is required but was not provided');
    return null;
  }

  // For web, we can use hover events directly
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          cursor: onPress ? 'pointer' : 'default',
          ...(style as any),
        }}
        onMouseEnter={handleMouseEnter}
        onClick={handlePress}
      >
        <Player
          ref={playerRef}
          icon={icon}
          size={size}
          colors={`primary:${colors.primary || '#ffffff'}${colors.secondary ? `,secondary:${colors.secondary}` : ''}`}
        />
      </div>
    );
  }

  // For React Native, Lordicon Player doesn't work directly
  // Return a fallback placeholder
  const { View, Pressable } = require('react-native');

  return (
    <Pressable onPress={handlePress} style={style}>
      <View
        style={{
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Fallback: Simple bell icon placeholder */}
        <View
          style={{
            width: size * 0.8,
            height: size * 0.8,
            backgroundColor: colors.primary || '#ffffff',
            borderRadius: size * 0.1,
            opacity: 0.8,
          }}
        />
      </View>
    </Pressable>
  );
}

// Assets are now imported at the top of the file

/**
 * Predefined Lordicon components for common use cases
 */
export const LordIcons = {
  Notification: (props: Omit<LordIconProps, 'icon'>) => {
    return <LordIcon icon={NOTIFICATION_ICON} {...props} />;
  },
} as const;
