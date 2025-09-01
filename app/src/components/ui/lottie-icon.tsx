import React, { useEffect, useRef } from 'react';
import { Platform, type ViewStyle, View } from 'react-native';

// Dynamic imports for platform-specific Lottie libraries
let LottieViewNative: any = null;
let lottieWeb: any = null;

// Initialize platform-specific Lottie libraries
if (Platform.OS !== 'web') {
  try {
    LottieViewNative = require('lottie-react-native').default;
  } catch {
    // Fallback for web or if lottie-react-native is not available
  }
} else {
  try {
    lottieWeb = require('lottie-web');
  } catch {
    // Fallback for native or if lottie-web is not available
  }
}

export interface LottieIconProps {
  source: any; // Animation source (JSON object or require path)
  size?: number;
  color?: string; // Fill color for the animation
  loop?: boolean;
  autoPlay?: boolean;
  style?: ViewStyle;
  speed?: number;
  isActive?: boolean; // Whether this icon is in active state
}

export const LottieIcon: React.FC<LottieIconProps> = ({
  source,
  size = 24,
  color = '#ffffff',
  loop = false,
  autoPlay = true,
  style,
  speed = 1,
  isActive = false,
}) => {
  const webContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && lottieWeb && webContainerRef.current) {
      // Clean up previous animation
      if (animationRef.current) {
        animationRef.current.destroy();
      }

      // Clone and modify animation data for color changes
      const modifiedSource = JSON.parse(JSON.stringify(source));
      if (color !== '#ffffff') {
        modifyAnimationColors(modifiedSource, color);
      }

      // Create new animation
      animationRef.current = lottieWeb.loadAnimation({
        container: webContainerRef.current,
        renderer: 'svg',
        loop,
        autoplay: autoPlay,
        animationData: modifiedSource,
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
        },
      });

      // Set speed
      if (animationRef.current) {
        animationRef.current.setSpeed(speed);
      }

      return () => {
        if (animationRef.current) {
          animationRef.current.destroy();
        }
      };
    }
  }, [source, color, loop, autoPlay, speed, isActive]);

  if (Platform.OS === 'web') {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <div
          ref={webContainerRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </View>
    );
  }

  // Native implementation
  if (LottieViewNative) {
    // Create color filters for native
    const colorFilters =
      color !== '#ffffff'
        ? [
            {
              keypath: '**',
              color: color,
            },
            {
              keypath: '*.Fill 1',
              color: color,
            },
            {
              keypath: '*.Stroke 1',
              color: color,
            },
          ]
        : undefined;

    return (
      <View style={[{ width: size, height: size }, style]}>
        <LottieViewNative
          source={source}
          autoPlay={autoPlay}
          loop={loop}
          speed={speed}
          style={{
            width: '100%',
            height: '100%',
          }}
          colorFilters={colorFilters}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Fallback to empty view if Lottie is not available
  return <View style={[{ width: size, height: size }, style]} />;
};

// Helper function to modify animation colors in the source data
function modifyAnimationColors(animationData: any, color: string): void {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 1, g: 1, b: 1 };
  };

  const rgb = hexToRgb(color);

  // Recursively find and update fill colors in the animation data
  const updateColors = (obj: any) => {
    if (typeof obj !== 'object' || obj === null) return;

    if (Array.isArray(obj)) {
      obj.forEach(updateColors);
      return;
    }

    // Update fill colors
    if (obj.ty === 'fl' && obj.c && obj.c.k) {
      obj.c.k = [rgb.r, rgb.g, rgb.b, 1];
    }

    // Update stroke colors
    if (obj.ty === 'st' && obj.c && obj.c.k) {
      obj.c.k = [rgb.r, rgb.g, rgb.b, 1];
    }

    // Recursively process nested objects
    Object.values(obj).forEach(updateColors);
  };

  updateColors(animationData);
}