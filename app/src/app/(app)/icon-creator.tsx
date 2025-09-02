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
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const { width: WindowWidth, height: WindowHeight } = Dimensions.get('window');

type BlurredCardProps = {
  blurredProgress: SharedValue<number>;
  showPlayIcon?: boolean | SharedValue<boolean>;
  playIconProgress?: SharedValue<number> | number;
};

// Square card for click activation
const SquareCard = ({
  blurredProgress,
  showPlayIcon,
  playIconProgress,
}: BlurredCardProps) => {
  const clipPath = useMemo(() => {
    const skPath = Skia.Path.Make();
    const size = 200;
    const x = WindowWidth / 2 - size / 2;
    const y = WindowHeight / 2 - size / 2;
    const r = 20;
    skPath.addRRect(rrect(rect(x, y, size, size), r, r));
    return skPath;
  }, []);

  const playIconPath = useMemo(() => {
    if (!showPlayIcon) return null;
    const skPath = Skia.Path.Make();
    const centerX = WindowWidth / 2;
    const centerY = WindowHeight / 2;
    const size = 100; // Made bigger

    // Create a simple triangle play icon
    skPath.moveTo(centerX - size / 2, centerY - size / 2);
    skPath.lineTo(centerX + size / 2, centerY);
    skPath.lineTo(centerX - size / 2, centerY + size / 2);
    skPath.close();
    return skPath;
  }, [showPlayIcon]);

  const blur = useDerivedValue(() => {
    return 5 * blurredProgress.value;
  });

  const playIconBlur = useDerivedValue(() => {
    if (
      typeof playIconProgress === 'object' &&
      playIconProgress?.value !== undefined
    ) {
      return 8 - 6 * playIconProgress.value;
    }
    return 8;
  });

  const playIconOpacity = useDerivedValue(() => {
    if (
      typeof playIconProgress === 'object' &&
      playIconProgress?.value !== undefined
    ) {
      return playIconProgress.value;
    }
    return typeof playIconProgress === 'number' ? playIconProgress : 0.3;
  });

  const shouldShow = useDerivedValue(() => {
    if (typeof showPlayIcon === 'object' && showPlayIcon?.value !== undefined) {
      return showPlayIcon.value;
    }
    return showPlayIcon || false;
  });

  return (
    <Group>
      <Path path={clipPath} color={'rgba(255, 255, 255, 0.1)'} />
      <Path
        path={clipPath}
        style={'stroke'}
        strokeWidth={2}
        opacity={blurredProgress}
        color={'rgba(255, 255, 255, 0.5)'}
      />
      <BackdropBlur blur={blur} clip={clipPath} />

      {/* Play Icon */}
      {shouldShow.value && playIconPath && (
        <Group>
          <Path path={playIconPath} color={'black'} opacity={playIconOpacity} />
          <Blur blur={playIconBlur} />
        </Group>
      )}
    </Group>
  );
};

// Animation 1: Square cards with rotation and spread
const Animation1 = () => {
  const progress = useSharedValue(0);

  const handleCanvasPress = () => {
    progress.value =
      progress.value === 0
        ? withTiming(1, { duration: 1000 })
        : withTiming(0, { duration: 1000 });
  };

  return (
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
        {new Array(6).fill(0).map((_, index) => {
          const transform = useDerivedValue(() => {
            return [
              {
                rotate: (-Math.PI / 2) * progress.value,
              },
              {
                translateX: 25 * index * progress.value,
              },
              { perspective: 10000 },
              {
                rotateY: (Math.PI / 3) * progress.value,
              },
              {
                rotate: (Math.PI / 4) * progress.value,
              },
            ];
          });

          return (
            <Group
              key={index}
              origin={vec(WindowWidth / 2, WindowHeight / 2)}
              transform={transform}
            >
              <SquareCard blurredProgress={progress} />
            </Group>
          );
        })}
      </Canvas>
    </Pressable>
  );
};

// Animation 4: Copy of sequential play icon fade-in
const Animation4 = () => {
  const progress = useSharedValue(0);
  const step = useSharedValue(0);
  const translateXProgress = useSharedValue(0);

  // Individual play icon opacity for each layer (4 layers total)
  const playIcon1Opacity = useSharedValue(0); // Layer 1 - always visible
  const playIcon2Opacity = useSharedValue(0); // Layer 2
  const playIcon3Opacity = useSharedValue(1); // Layer 3
  const playIcon4Opacity = useSharedValue(0); // Layer 4
  const playIcon5Opacity = useSharedValue(0); // Layer 5 - always visible

  const handleCanvasPress = () => {
    if (step.value === 0) {
      // Step 1: spread animation + fade in first play icon
      progress.value = withTiming(1, { duration: 1000 });
      translateXProgress.value = withTiming(1, { duration: 1000 });
      // playIcon1Opacity.value = withTiming(1, { duration: 600 });
      step.value = 1;
    } else if (step.value === 1) {
      // Step 2: fade in second play icon
      playIcon2Opacity.value = withDelay(200, withTiming(1, { duration: 600 }));
      playIcon4Opacity.value = withDelay(400, withTiming(1, { duration: 600 }));
      playIcon5Opacity.value = withDelay(600, withTiming(1, { duration: 600 }));
      playIcon1Opacity.value = withDelay(800, withTiming(1, { duration: 600 }));
      step.value = 2;
    } else if (step.value === 2) {
      // Step 3: collapse translateX to 0
      translateXProgress.value = withTiming(0, { duration: 800 });
      step.value = 3;
    } else if (step.value === 3) {
      // Reset everything
      progress.value = withTiming(0, { duration: 1000 });
      translateXProgress.value = withTiming(0, { duration: 1000 });
      playIcon1Opacity.value = withTiming(1, { duration: 500 }); // Keep layer 1 visible
      playIcon2Opacity.value = withTiming(0, { duration: 500 });
      playIcon3Opacity.value = withTiming(1, { duration: 500 }); // Keep layer 3 visible
      playIcon4Opacity.value = withTiming(0, { duration: 500 });
      playIcon5Opacity.value = withTiming(0, { duration: 500 });
      step.value = 0;
    }
    // else if (step.value === 2) {
    //   // Step 3: fade in third play icon
    //   playIcon3Opacity.value = withTiming(1, { duration: 600 });
    //   step.value = 3;
    // } else if (step.value === 3) {
    //   // Step 4: fade in fourth play icon
    //   playIcon4Opacity.value = withTiming(1, { duration: 600 });
    //   step.value = 4;
    // } else {
    //   // Reset everything
    //   progress.value = withTiming(0, { duration: 1000 });
    //   translateXProgress.value = withTiming(0, { duration: 1000 });
    //   playIcon1Opacity.value = withTiming(1, { duration: 500 }); // Keep layer 1 visible
    //   playIcon2Opacity.value = withTiming(0, { duration: 500 });
    //   playIcon3Opacity.value = withTiming(0, { duration: 500 });
    //   playIcon4Opacity.value = withTiming(0, { duration: 500 });
    //   playIcon5Opacity.value = withTiming(0, { duration: 500 });
    //   step.value = 0;
    // }
  };

  return (
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
          const transform = useDerivedValue(() => {
            return [
              {
                rotate: (-Math.PI / 2) * progress.value,
              },
              {
                translateX: 25 * index * translateXProgress.value,
              },
              { perspective: 10000 },
              {
                rotateY: (Math.PI / 3) * progress.value,
              },
              {
                rotate: (Math.PI / 4) * progress.value,
              },
            ];
          });

          // Get the appropriate play icon opacity for this layer
          let iconOpacity;
          switch (index) {
            case 0:
              iconOpacity = playIcon1Opacity;
              break;
            case 1:
              iconOpacity = playIcon2Opacity;
              break;
            case 2:
              iconOpacity = playIcon3Opacity;
              break;
            case 3:
              iconOpacity = playIcon4Opacity;
              break;
            default:
              iconOpacity = playIcon1Opacity; // Fallback
              break;
          }

          return (
            <Group
              key={index}
              origin={vec(WindowWidth / 2, WindowHeight / 2)}
              transform={transform}
            >
              <SquareCard
                blurredProgress={progress}
                showPlayIcon={true} // All layers have play icons
                playIconProgress={iconOpacity}
              />
            </Group>
          );
        })}
      </Canvas>
    </Pressable>
  );
};

function IconCreator() {
  const [activeTab, setActiveTab] = useState<
    'animation1' | 'animation2' | 'animation3' | 'animation4'
  >('animation1');

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'animation1' && styles.activeTab]}
          onPress={() => setActiveTab('animation1')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'animation1' && styles.activeTabText,
            ]}
          >
            Version 1
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'animation2' && styles.activeTab]}
          onPress={() => setActiveTab('animation2')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'animation2' && styles.activeTabText,
            ]}
          >
            Version 2
          </Text>
        </Pressable>
      </View>

      {/* Animation Content */}
      {activeTab === 'animation1' ? (
        <Animation1 />
      ) : activeTab === 'animation2' ? (
        <Animation4 />
      ) : (
        <Animation4 />
      )}
    </View>
  );
}

export default IconCreator;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  canvas: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
    fontWeight: '600',
  },
});
