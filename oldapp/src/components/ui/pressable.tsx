import React from 'react';
import { Pressable as RNPressable, type PressableProps } from 'react-native';

import { getTVOSFocusStyles, useTVOSFocus } from '@/lib/tvos-focus';

interface EnhancedPressableProps extends PressableProps {
  className?: string;
  enableTVOSFocus?: boolean;
}

/**
 * Enhanced Pressable component with automatic tvOS focus support
 */
export const Pressable = React.forwardRef<
  React.ElementRef<typeof RNPressable>,
  EnhancedPressableProps
>(({ className, enableTVOSFocus = true, ...props }, ref) => {
  const { isFocused, focusProps } = useTVOSFocus();

  // For now, just pass through the props without className handling
  // The className will be handled by nativewind or the parent component
  const finalProps = enableTVOSFocus ? { ...props, ...focusProps } : props;

  return <RNPressable ref={ref} {...finalProps} />;
});

Pressable.displayName = 'Pressable';
