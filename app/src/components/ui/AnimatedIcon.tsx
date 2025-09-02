import React, { useState } from 'react';
import { ViewStyle, Platform } from 'react-native';
import {
  UseAnimations,
  ANIMATED_ICONS,
  AnimatedIconName,
} from '@/lib/animated-icons';

interface AnimatedIconProps {
  /** The name of the animated icon to display */
  name: AnimatedIconName;
  /** Size of the icon in pixels */
  size?: number;
  /** Stroke color of the icon */
  strokeColor?: string;
  /** Fill color of the icon */
  fillColor?: string;
  /** Whether to animate on hover/press */
  animateOnHover?: boolean;
  /** Whether to reverse the animation */
  reverse?: boolean;
  /** Whether to autoplay the animation */
  autoplay?: boolean;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Animation speed multiplier */
  speed?: number;
  /** Additional styles for the wrapper */
  style?: ViewStyle;
  /** CSS string for the animation path element */
  pathCss?: string;
  /** Custom options to override defaults */
  options?: Record<string, any>;
  /** Callback when icon is pressed/clicked */
  onPress?: () => void;
  /** Whether the icon is in an active state */
  active?: boolean;
}

/**
 * AnimatedIcon - A wrapper component for react-useanimations icons
 *
 * Provides a consistent interface for using animated icons throughout the app
 * with hover animations, active states, and customizable styling.
 *
 * @example
 * ```tsx
 * <AnimatedIcon
 *   name="heart"
 *   size={24}
 *   animateOnHover
 *   strokeColor="#fff"
 *   onPress={() => console.log('Heart clicked!')}
 * />
 * ```
 */
export function AnimatedIcon({
  name,
  size = 24,
  strokeColor = 'inherit',
  fillColor = '',
  animateOnHover = false,
  reverse = false,
  autoplay = false,
  loop = false,
  speed = 1,
  style,
  pathCss = '',
  options = {},
  onPress,
  active = false,
}: AnimatedIconProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const animation = ANIMATED_ICONS[name];

  if (!animation) {
    console.warn(`AnimatedIcon: Animation "${name}" not found`);
    return null;
  }

  const handleMouseEnter = () => {
    if (animateOnHover) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (animateOnHover) {
      setIsHovered(false);
    }
  };

  const handlePressIn = () => {
    setIsPressed(true);
  };

  const handlePressOut = () => {
    setIsPressed(false);
    onPress?.();
  };

  // Determine if animation should be triggered
  const shouldAnimate =
    autoplay || (animateOnHover && (isHovered || isPressed)) || active;

  // If we need event handling, use the render prop pattern
  if (animateOnHover || onPress) {
    return (
      <UseAnimations
        animation={animation}
        size={size}
        strokeColor={strokeColor}
        fillColor={fillColor}
        reverse={reverse || shouldAnimate}
        autoplay={shouldAnimate}
        loop={loop}
        speed={speed}
        pathCss={pathCss}
        options={options}
        render={(eventProps, animationProps) => {
          // Create event handlers based on platform
          const customEventProps: any = {};

          if (Platform.OS === 'web') {
            // Web-specific hover events
            if (animateOnHover) {
              customEventProps.onMouseEnter = handleMouseEnter;
              customEventProps.onMouseLeave = handleMouseLeave;
            }
            if (onPress) {
              customEventProps.onClick = handlePressOut;
            }
          } else {
            // React Native touch events
            if (onPress || animateOnHover) {
              customEventProps.onTouchStart = handlePressIn;
              customEventProps.onTouchEnd = handlePressOut;
            }
          }

          // For web, wrap in a div; for React Native, use View-like wrapper
          if (Platform.OS === 'web') {
            return (
              <div
                {...customEventProps}
                style={{
                  display: 'inline-block',
                  cursor: onPress ? 'pointer' : 'default',
                  ...(style as any),
                }}
              >
                <div {...animationProps} />
              </div>
            );
          } else {
            // For React Native, we need to import View from react-native
            const { View } = require('react-native');
            return (
              <View {...customEventProps} style={style}>
                <View {...animationProps} />
              </View>
            );
          }
        }}
      />
    );
  }

  // Simple case without event handling
  return (
    <UseAnimations
      animation={animation}
      size={size}
      strokeColor={strokeColor}
      fillColor={fillColor}
      reverse={reverse || shouldAnimate}
      autoplay={shouldAnimate}
      loop={loop}
      speed={speed}
      pathCss={pathCss}
      options={options}
      wrapperStyle={style}
    />
  );
}

/**
 * Predefined animated icon components for common use cases
 */
export const AnimatedIcons = {
  Home: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="home" {...props} />
  ),
  Heart: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="heart" {...props} />
  ),
  Bookmark: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="bookmark" {...props} />
  ),
  Settings: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="settings" {...props} />
  ),
  Notification: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="notification" {...props} />
  ),
  Search: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="searchToX" {...props} />
  ),
  Video: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="video" {...props} />
  ),
  Video2: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="video2" {...props} />
  ),
  Airplay: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="airplay" {...props} />
  ),
  User: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="userPlus" {...props} />
  ),
  Folder: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="folder" {...props} />
  ),
  Menu: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="menu" {...props} />
  ),
  Loading: (props: Omit<AnimatedIconProps, 'name'>) => (
    <AnimatedIcon name="loading2" autoplay loop {...props} />
  ),
} as const;
