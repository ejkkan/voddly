import {
  BackdropBlur,
  Blur,
  Canvas,
  Group,
  Path,
  RadialGradient,
  Rect,
  rect,
  rrect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Pressable, Text } from '@/components/ui';

const { width: WindowWidth, height: WindowHeight } = Dimensions.get('window');

type BlurredCardProps = {
  blurredProgress: SharedValue<number>;
  isSquare?: boolean;
};

// Original rectangular card
const OriginalCard = ({ blurredProgress }: BlurredCardProps) => {
  const clipPath = useMemo(() => {
    const skPath = Skia.Path.Make();
    const x = WindowWidth / 2 - 150;
    const y = WindowHeight / 2 - 100;
    const width = 300;
    const height = 200;
    const r = 20;
    skPath.addRRect(rrect(rect(x, y, width, height), r, r));
    return skPath;
  }, []);

  const blur = useDerivedValue(() => {
    return 5 * blurredProgress.value;
  });

  return (
    <Group>
      <Path path={clipPath} color={'rgba(255, 255, 255, 0.1)'} />
      <Path
        path={clipPath}
        style={'stroke'}
        strokeWidth={2}
        opacity={blurredProgress}
        color={'rgba(255, 255, 255, 0.2)'}
      />
      <BackdropBlur blur={blur} clip={clipPath} />
    </Group>
  );
};

// Square card for click activation
const SquareCard = ({ blurredProgress }: BlurredCardProps) => {
  const clipPath = useMemo(() => {
    const skPath = Skia.Path.Make();
    const size = 200;
    const x = WindowWidth / 2 - size / 2;
    const y = WindowHeight / 2 - size / 2;
    const r = 20;
    skPath.addRRect(rrect(rect(x, y, size, size), r, r));
    return skPath;
  }, []);

  const blur = useDerivedValue(() => {
    return 5 * blurredProgress.value;
  });

  return (
    <Group>
      <Path path={clipPath} color={'rgba(255, 255, 255, 0.1)'} />
      <Path
        path={clipPath}
        style={'stroke'}
        strokeWidth={2}
        opacity={blurredProgress}
        color={'rgba(255, 255, 255, 0.2)'}
      />
      <BackdropBlur blur={blur} clip={clipPath} />
    </Group>
  );
};

// 3D cursor following card
const CursorFollowCard = ({ blurredProgress }: BlurredCardProps) => {
  const clipPath = useMemo(() => {
    const skPath = Skia.Path.Make();
    const size = 180;
    const x = WindowWidth / 2 - size / 2;
    const y = WindowHeight / 2 - size / 2;
    const r = 25;
    skPath.addRRect(rrect(rect(x, y, size, size), r, r));
    return skPath;
  }, []);

  const blur = useDerivedValue(() => {
    return 8 * blurredProgress.value;
  });

  return (
    <Group>
      <Path path={clipPath} color={'rgba(255, 255, 255, 0.15)'} />
      <Path
        path={clipPath}
        style={'stroke'}
        strokeWidth={3}
        opacity={blurredProgress}
        color={'rgba(255, 255, 255, 0.3)'}
      />
      <BackdropBlur blur={blur} clip={clipPath} />
    </Group>
  );
};

type TabType = 'original' | 'click' | 'cursor';

const tabs: { id: TabType; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'click', label: 'Click to Activate' },
  { id: 'cursor', label: '3D Cursor Follow' },
];

export default function IconCreator() {
  const [activeTab, setActiveTab] = useState<TabType>('original');
  const progress = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const cursorProgress = useSharedValue(0);

  // Original tab - auto hover/touch
  const handleOriginalTouch = () => {
    if (activeTab === 'original' && Platform.OS !== 'web') {
      progress.value =
        progress.value === 0
          ? withTiming(1, { duration: 800 })
          : withTiming(0, { duration: 800 });
    }
  };

  useEffect(() => {
    if (activeTab === 'original' && Platform.OS === 'web') {
      const handleMouseEnter = () => {
        progress.value = withTiming(1, { duration: 800 });
      };
      const handleMouseLeave = () => {
        progress.value = withTiming(0, { duration: 800 });
      };

      document.addEventListener('mouseenter', handleMouseEnter);
      document.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        document.removeEventListener('mouseenter', handleMouseEnter);
        document.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [activeTab, progress]);

  // 3D Cursor follow tab - Full 360 degree tracking
  useEffect(() => {
    if (activeTab === 'cursor' && Platform.OS === 'web') {
      const handleMouseMove = (event: MouseEvent) => {
        const x = event.clientX;
        const y = event.clientY;
        const centerX = WindowWidth / 2;
        const centerY = WindowHeight / 2;

        // Calculate full 360-degree rotation based on mouse position
        const deltaX = x - centerX;
        const deltaY = y - centerY;

        // Convert to polar coordinates for full rotation
        const angle = Math.atan2(deltaY, deltaX);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
        const normalizedDistance = Math.min(distance / maxDistance, 1);

        // Full 360-degree rotation on Y axis
        tiltX.value = withSpring(angle, { damping: 12, stiffness: 100 });

        // Tilt on X axis based on vertical position
        tiltY.value = withSpring((deltaY / centerY) * Math.PI * 0.5, {
          damping: 12,
          stiffness: 100,
        });

        // Activate based on distance from center
        cursorProgress.value = withSpring(normalizedDistance, { damping: 15 });
      };

      const handleMouseEnter = () => {
        cursorProgress.value = withSpring(1, { damping: 20 });
      };

      const handleMouseLeave = () => {
        tiltX.value = withSpring(0, { damping: 15 });
        tiltY.value = withSpring(0, { damping: 15 });
        cursorProgress.value = withSpring(0, { damping: 20 });
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseenter', handleMouseEnter);
      document.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseenter', handleMouseEnter);
        document.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [activeTab, tiltX, tiltY, cursorProgress]);

  const handleCanvasPress = () => {
    if (activeTab === 'click') {
      progress.value =
        progress.value === 0
          ? withTiming(1, { duration: 1000 })
          : withTiming(0, { duration: 1000 });
    } else if (activeTab === 'original') {
      handleOriginalTouch();
    }
  };

  const getCardComponent = () => {
    switch (activeTab) {
      case 'original':
        return OriginalCard;
      case 'click':
        return SquareCard;
      case 'cursor':
        return CursorFollowCard;
      default:
        return OriginalCard;
    }
  };

  const CardComponent = getCardComponent();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => {
              setActiveTab(tab.id);
              progress.value = 0;
              tiltX.value = 0;
              tiltY.value = 0;
              cursorProgress.value = 0;
            }}
            className={`mx-1 rounded-lg px-4 py-2 ${
              activeTab === tab.id
                ? 'border border-white/30 bg-white/20'
                : 'border border-white/10 bg-white/5'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.id ? 'text-white' : 'text-white/70'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.canvas} onPress={handleCanvasPress}>
        <Canvas style={styles.canvas}>
          <Rect x={0} y={0} width={WindowWidth} height={WindowHeight}>
            <RadialGradient
              c={vec(WindowWidth / 2, WindowHeight / 2)}
              r={Math.min(WindowWidth, WindowHeight) / 2}
              colors={['violet', 'black']}
            />
            <Blur blur={100} />
          </Rect>
          {new Array(5).fill(0).map((_, index) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const transform = useDerivedValue(() => {
              if (activeTab === 'cursor') {
                // Full 3D cursor following mode with proper layered spacing
                const baseRotation = (-Math.PI / 2) * cursorProgress.value;
                const baseTranslateX = 25 * index * cursorProgress.value;
                const baseRotateY = (Math.PI / 3) * cursorProgress.value;
                const baseRotateZ = (Math.PI / 4) * cursorProgress.value;

                // Add proper Z-depth for layered effect
                const zDepth = -index * 40; // Space cards 40 units apart in depth

                return [
                  { perspective: 4000 },
                  {
                    rotate: baseRotation,
                  },
                  {
                    translateX: baseTranslateX,
                  },
                  {
                    translateZ: zDepth, // Create proper depth layers
                  },
                  {
                    rotateY: baseRotateY + tiltX.value, // Original fan + cursor tracking
                  },
                  {
                    rotateX: tiltY.value, // Full cursor tilt
                  },
                  {
                    rotate: baseRotateZ,
                  },
                  {
                    scale: 1 - index * 0.05, // Slightly smaller cards in back for depth
                  },
                ];
              } else {
                // Original and click modes - restore original structure
                const currentProgress = progress.value;

                return [
                  {
                    rotate: (-Math.PI / 2) * currentProgress,
                  },
                  {
                    translateX: 25 * index * currentProgress,
                  },
                  { perspective: 10000 },
                  {
                    rotateY: (Math.PI / 3) * currentProgress,
                  },
                  {
                    rotate: (Math.PI / 4) * currentProgress,
                  },
                ];
              }
            });

            return (
              <Group
                key={index}
                origin={vec(WindowWidth / 2, WindowHeight / 2)}
                transform={transform}
              >
                <CardComponent
                  blurredProgress={
                    activeTab === 'cursor' ? cursorProgress : progress
                  }
                />
              </Group>
            );
          })}
        </Canvas>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  tabContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: 20,
  },
  canvas: {
    flex: 1,
  },
});
