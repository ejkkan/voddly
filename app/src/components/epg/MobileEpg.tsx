import Constants from "expo-constants";
import * as React from "react";
import {
  Dimensions,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { useChannelEpg } from "@/hooks/useCachedEpg";
import type { Program } from "./hooks/useEpg";

const { height, width } = Dimensions.get("window");

const _itemHeight = Math.floor(height / 8);
const _spacing = 8;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

interface MobileEpgProps {
  sourceId: string;
  channelId: string;
  channelTitle?: string;
  channelLogo?: string;
}

interface EpgProgram extends Program {
  startTime: string;
  endTime: string;
  duration: number;
  isCurrentlyAiring: boolean;
}

const ProgramItem = React.memo(({ item, scrollY, index }: {
  item: EpgProgram;
  scrollY: Animated.SharedValue<number>;
  index: number;
}) => {
  const stylez = useAnimatedStyle(() => {
    const midIndex = index;
    return {
      opacity: interpolate(
        scrollY.value,
        [
          (midIndex - 0.8) * _itemHeight,
          midIndex * _itemHeight,
          (midIndex + 0.8) * _itemHeight,
        ],
        [0, 1, 0]
      ),
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [
              (midIndex - 0.8) * _itemHeight,
              midIndex * _itemHeight,
              (midIndex + 0.8) * _itemHeight,
            ],
            [-_itemHeight * 0.6, 0, _itemHeight * 0.6]
          ),
        },
      ],
    };
  });

  const lineStylez = useAnimatedStyle(() => {
    const midIndex = index;
    return {
      opacity: interpolate(
        scrollY.value,
        [
          (midIndex - 1) * _itemHeight,
          midIndex * _itemHeight,
          (midIndex + 1) * _itemHeight,
        ],
        [0, 1, 0]
      ),
    };
  });

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <View style={{ flexDirection: "row", height: _itemHeight }}>
      <View style={[styles.left, item.isCurrentlyAiring && styles.leftActive]}>
        <Text style={[styles.timeText, item.isCurrentlyAiring && styles.timeTextActive]}>
          {item.startTime}
        </Text>
        <Text style={[styles.endTimeText, item.isCurrentlyAiring && styles.endTimeTextActive]}>
          {item.endTime}
        </Text>
      </View>
      <Animated.View
        style={[
          {
            paddingHorizontal: _spacing * 3,
            alignItems: "flex-start",
            flex: 1,
            justifyContent: "center",
            backgroundColor: item.isCurrentlyAiring ? "#e3f2fd" : "#ecf0f1",
          },
          stylez,
        ]}>
        <Text style={[styles.titleText, item.isCurrentlyAiring && styles.titleTextActive]}>
          {item.title}
        </Text>
        <Text style={[styles.durationText, item.isCurrentlyAiring && styles.durationTextActive]}>
          {formatDuration(item.duration)}
        </Text>
        {item.description && (
          <Text 
            style={[styles.descriptionText, item.isCurrentlyAiring && styles.descriptionTextActive]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.description}
          </Text>
        )}
        <Animated.View
          style={[
            {
              backgroundColor: item.isCurrentlyAiring ? "#2196f3" : "#d0d0d0",
              width: 10,
              height: 10,
              position: "absolute",
              left: -Math.sqrt(10 * 2),
              transform: [{ rotate: "45deg" }],
            },
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: item.isCurrentlyAiring ? "rgba(33, 150, 243, 0.1)" : "rgba(0,0,0,0.05)" },
          lineStylez,
        ]}
      />
    </View>
  );
});

export function MobileEpg({ sourceId, channelId, channelTitle, channelLogo }: MobileEpgProps) {
  const scrollY = useSharedValue(0);
  const { data: epgData, isLoading, isError } = useChannelEpg(sourceId, channelId);

  const onScroll = useAnimatedScrollHandler((ev) => {
    scrollY.value = ev.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: interpolate(
        scrollY.value,
        [0, height / 2 - _itemHeight / 2, height / 2],
        [0, 0, 0.2],
        Extrapolation.CLAMP
      ),
    };
  });

  // Transform EPG data to match the expected format
  const programs: EpgProgram[] = React.useMemo(() => {
    if (!epgData || !Array.isArray(epgData)) return [];

    const now = new Date();
    
    return epgData.map((program) => {
      const startDate = new Date(program.start);
      const endDate = new Date(program.end);
      const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)); // duration in minutes
      const isCurrentlyAiring = now >= startDate && now <= endDate;

      return {
        ...program,
        channelUuid: channelId,
        since: program.start,
        till: program.end,
        startTime: startDate.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        endTime: endDate.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        duration,
        isCurrentlyAiring,
      };
    });
  }, [epgData, channelId]);

  // Find current program index to scroll to it initially
  const currentProgramIndex = React.useMemo(() => {
    return programs.findIndex(program => program.isCurrentlyAiring);
  }, [programs]);

  // Auto-scroll to current program
  const flatListRef = React.useRef<FlatList>(null);
  React.useEffect(() => {
    if (currentProgramIndex >= 0 && flatListRef.current) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: currentProgramIndex,
          animated: true,
          viewPosition: 0.5, // Center the current program
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentProgramIndex]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading EPG...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !programs.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No EPG data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedFlatList
        ref={flatListRef}
        data={programs}
        keyExtractor={(item) => item.id}
        stickyHeaderIndices={[0]}
        bounces={false}
        snapToInterval={_itemHeight}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingVertical:
            (height - Constants.statusBarHeight) / 2 - _itemHeight / 2,
        }}
        getItemLayout={(data, index) => ({
          length: _itemHeight,
          offset: _itemHeight * index,
          index,
        })}
        ListHeaderComponent={() => {
          return (
            <Animated.View style={[styles.listHeader, headerStyle]}>
              <View style={styles.left}>
                <Text style={[styles.headerText]}>Time</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.channelTitle}>
                  {channelTitle || "Channel EPG"}
                </Text>
              </View>
            </Animated.View>
          );
        }}
        renderItem={({ item, index }) => {
          return <ProgramItem item={item} index={index} scrollY={scrollY} />;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  left: {
    backgroundColor: "#d0d0d0",
    width: "35%",
    padding: _spacing,
    alignItems: "center",
    justifyContent: "center",
  },
  leftActive: {
    backgroundColor: "#2196f3",
  },
  right: {
    backgroundColor: "#ecf0f1",
    flex: 1,
    alignItems: "flex-end",
    padding: _spacing,
  },
  timeText: {
    color: "rgba(0,0,0,0.7)",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  timeTextActive: {
    color: "white",
  },
  endTimeText: {
    color: "rgba(0,0,0,0.5)",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 2,
  },
  endTimeTextActive: {
    color: "rgba(255,255,255,0.8)",
  },
  titleText: {
    color: "rgba(0,0,0,0.8)",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "left",
  },
  titleTextActive: {
    color: "#1976d2",
    fontWeight: "700",
  },
  durationText: {
    color: "rgba(0,0,0,0.6)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  durationTextActive: {
    color: "#1976d2",
  },
  descriptionText: {
    color: "rgba(0,0,0,0.5)",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  descriptionTextActive: {
    color: "rgba(25, 118, 210, 0.8)",
  },
  headerText: {
    color: "rgba(0,0,0,0.7)",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  channelTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    color: "rgba(0,0,0,0.8)",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#ecf0f1",
  },
  listHeader: {
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.6)",
  },
  errorText: {
    fontSize: 16,
    color: "rgba(220, 38, 38, 0.8)",
  },
});