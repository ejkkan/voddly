import React from 'react';
import { type ViewStyle } from 'react-native';

import notificationIcon from '@/assets/lordicons/notification.js';

import { AnimatedIcon, type AnimatedIconName } from './AnimatedIcon';
import { LordIcon } from './LordIcon';

// Define available Lordicon types
export type LordIconName = 'notification';

// Union type for all available icons
export type HybridIconName = AnimatedIconName | LordIconName;

interface HybridIconProps {
  /** The name of the icon to display */
  name: HybridIconName;
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
 * HybridIcon - A unified component that can render both react-useanimations and Lordicon icons
 *
 * This component automatically detects the icon type and renders the appropriate component.
 * It provides a consistent API for both icon libraries.
 *
 * @example
 * ```tsx
 * // React-useanimations icon
 * <HybridIcon name="heart" size={24} animateOnHover strokeColor="#fff" />
 *
 * // Lordicon icon
 * <HybridIcon name="notification" size={24} animateOnHover strokeColor="#fff" />
 * ```
 */
export function HybridIcon({
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
}: HybridIconProps) {
  // Check if this is a Lordicon
  const isLordIcon = (iconName: string): iconName is LordIconName => {
    return ['notification'].includes(iconName);
  };

  if (isLordIcon(name)) {
    // Try to render Lordicon, but fallback to react-useanimations if it fails
    try {
      const iconData = getLordIconData(name);
      if (!iconData) {
        throw new Error('Icon data not found');
      }

      return (
        <LordIcon
          icon={iconData}
          size={size}
          animateOnHover={animateOnHover}
          active={active}
          onPress={onPress}
          style={style}
          colors={{
            primary: strokeColor !== 'inherit' ? strokeColor : '#ffffff',
            secondary: fillColor || undefined,
          }}
        />
      );
    } catch (error) {
      console.warn(
        `Failed to load Lordicon ${name}, falling back to react-useanimations:`,
        error
      );
      // Fallback to react-useanimations notification icon
      return (
        <AnimatedIcon
          name="notification"
          size={size}
          strokeColor={strokeColor}
          fillColor={fillColor}
          animateOnHover={animateOnHover}
          reverse={reverse}
          autoplay={autoplay}
          loop={loop}
          speed={speed}
          style={style}
          pathCss={pathCss}
          options={options}
          onPress={onPress}
          active={active}
        />
      );
    }
  } else {
    // Render react-useanimations icon
    return (
      <AnimatedIcon
        name={name as AnimatedIconName}
        size={size}
        strokeColor={strokeColor}
        fillColor={fillColor}
        animateOnHover={animateOnHover}
        reverse={reverse}
        autoplay={autoplay}
        loop={loop}
        speed={speed}
        style={style}
        pathCss={pathCss}
        options={options}
        onPress={onPress}
        active={active}
      />
    );
  }
}

// Assets are now imported at the top of the file

const LORDICON_ASSETS = {
  notification: notificationIcon,
} as const;

/**
 * Get Lordicon data by name
 */
function getLordIconData(name: LordIconName) {
  const iconData = LORDICON_ASSETS[name];
  if (!iconData) {
    console.error(`Lordicon asset not found: ${name}`);
    throw new Error(`Unknown Lordicon: ${name}`);
  }
  return iconData;
}

/**
 * Predefined hybrid icon components for common use cases
 */
export const HybridIcons = {
  Home: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="home" {...props} />
  ),
  Heart: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="heart" {...props} />
  ),
  Bookmark: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="bookmark" {...props} />
  ),
  Settings: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="settings" {...props} />
  ),
  Notification: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="notification" {...props} />
  ),
  Search: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="searchToX" {...props} />
  ),
  Video: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="video" {...props} />
  ),
  Video2: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="video2" {...props} />
  ),
  Airplay: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="airplay" {...props} />
  ),
  User: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="userPlus" {...props} />
  ),
  Folder: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="folder" {...props} />
  ),
  Loading: (props: Omit<HybridIconProps, 'name'>) => (
    <HybridIcon name="loading2" autoplay loop {...props} />
  ),
} as const;
