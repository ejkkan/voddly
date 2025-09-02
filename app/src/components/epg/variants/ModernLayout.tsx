import React, { useCallback } from 'react';
import { Platform } from 'react-native';

import { Image, Pressable, ScrollView, Text, View } from '@/components/ui';

import { TIMELINE_HEIGHT } from '../constants';
import { type ModernLayoutProps } from '../types';

// Memoized Program Item component for better performance
const ProgramItem = React.memo(
  ({
    program,
    isAiring,
    progress,
    onProgramClick,
    calculateSidebarWidth,
    formatTime,
  }: {
    program: any;
    isAiring: boolean;
    progress: number;
    onProgramClick?: (program: any) => void;
    calculateSidebarWidth: number;
    formatTime: (date: Date) => string;
  }) => {
    const handleBackgroundPlay = React.useCallback(() => {
      console.log('Playing in background:', program.title);
      if (onProgramClick) {
        onProgramClick(program);
      }
    }, [program, onProgramClick]);

    const handleFullPlayer = React.useCallback(() => {
      console.log('Navigate to player:', program.title);
      // Navigate to full player
      if (typeof window !== 'undefined' && program.channelUuid) {
        window.location.href = `/(app)/tv/${encodeURIComponent(program.channelUuid)}`;
      }
    }, [program]);

    return (
      <View
        style={{
          position: 'absolute',
          left: calculateSidebarWidth + program.position.left,
          width: program.position.width,
          top: 0,
          height: program.position.height,
          overflow: 'hidden',
          backgroundColor: 'rgb(255, 255, 255, 0.05)',
        }}
        className={`border-b border-l border-white/10 ${
          isAiring ? 'bg-transparent' : 'bg-transparent'
        }`}
      >
        {/* Content */}
        <View className="flex-1 p-4">
          {/* Title and time on same line */}
          <View className="flex-row items-center justify-between">
            <Text
              className={`flex-1 text-sm font-semibold ${
                isAiring ? 'text-blue-100' : 'text-white'
              }`}
              numberOfLines={1}
            >
              {program.title}
            </Text>
            <Text
              className={`ml-2 text-xs font-medium ${
                isAiring ? 'text-blue-200' : 'text-white/60'
              }`}
            >
              {formatTime(new Date(program.since))} -{' '}
              {formatTime(new Date(program.till))}
            </Text>
          </View>

          {/* Description underneath - can be hidden on overflow */}
          {program.description && (
            <Text
              className={`mt-1 text-xs ${
                isAiring ? 'text-blue-200/80' : 'text-white/80'
              }`}
              numberOfLines={2}
            >
              {program.description}
            </Text>
          )}

          {/* Action buttons for currently airing programs */}
          {isAiring && (
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={handleBackgroundPlay}
                className="rounded-md bg-blue-500/20 px-3 py-1.5 hover:bg-blue-500/30"
                style={{ cursor: 'pointer' as any }}
              >
                <Text className="text-xs font-medium text-blue-100">
                  ▶ Background
                </Text>
              </Pressable>
              <Pressable
                onPress={handleFullPlayer}
                className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/20"
                style={{ cursor: 'pointer' as any }}
              >
                <Text className="text-xs font-medium text-white">
                  ↗ Full Player
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Progress bar for current programs */}
        {isAiring && (
          <View className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <View
              className="h-full bg-blue-400"
              style={{ width: `${progress}%` }}
            />
          </View>
        )}
      </View>
    );
  }
);

export function ModernLayout({
  channels,
  programs,
  timeline,
  isTimeline,
  scrollRefs,
  onScroll,
  onVisibleChannelsChange,
  onProgramClick,
  renderChannel,
  calculateSidebarWidth,
}: ModernLayoutProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [scrollOffset, setScrollOffset] = React.useState({ x: 0, y: 0 });

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, []);

  const calculateProgress = useCallback((program: any) => {
    const now = new Date().getTime();
    const start = new Date(program.since).getTime();
    const end = new Date(program.till).getTime();

    if (now < start) return 0;
    if (now > end) return 100;

    return ((now - start) / (end - start)) * 100;
  }, []);

  const totalWidth =
    timeline.length > 0
      ? timeline[timeline.length - 1].position.left +
        timeline[timeline.length - 1].position.width
      : 0;

  const totalHeight =
    channels.length > 0
      ? channels[channels.length - 1].position.top +
        channels[channels.length - 1].position.height
      : 0;

  // Drag and drop handlers
  const handleMouseDown = (e: any) => {
    if (Platform.OS === 'web') {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: any) => {
    if (Platform.OS === 'web' && isDragging) {
      const deltaX = dragStart.x - e.clientX;
      const deltaY = dragStart.y - e.clientY;

      const newScrollX = Math.max(0, scrollOffset.x + deltaX);
      const newScrollY = Math.max(0, scrollOffset.y + deltaY);

      if (scrollRefs.current.horizontalMain) {
        scrollRefs.current.horizontalMain.scrollTo({
          x: newScrollX,
          animated: false,
        });
      }
      if (scrollRefs.current.verticalMain) {
        scrollRefs.current.verticalMain.scrollTo({
          y: newScrollY,
          animated: false,
        });
      }

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (Platform.OS === 'web') {
      setIsDragging(false);
    }
  };

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, scrollOffset]);

  // Default channel renderer for modern variant
  const defaultRenderChannel = useCallback(({ channel }: { channel: any }) => (
    <View
      style={{ height: channel.position.height }}
      className="flex-row items-center justify-center bg-black/20 px-2 backdrop-blur-sm"
    >
      {channel.logo?.startsWith('https') ? (
        <Image
          source={{ uri: channel.logo }}
          className="h-full flex-1"
          contentFit="contain"
        />
      ) : (
        <Text
          className="flex-1 text-center text-xs font-medium text-white"
          numberOfLines={3}
        >
          {channel.title}
        </Text>
      )}
    </View>
  ), []);

  return (
    <View
      className="flex-1 bg-black/40 backdrop-blur-md"
      style={
        Platform.OS === 'web'
          ? {
              cursor: (isDragging ? 'grabbing' : 'grab') as any,
              userSelect: 'none' as any,
            }
          : {}
      }
      onMouseDown={handleMouseDown}
    >
      {/* Timeline sticky header */}
      {isTimeline && (
        <View
          style={{ height: TIMELINE_HEIGHT }}
          className="z-10 flex-row bg-black/30 backdrop-blur-sm"
        >
          {/* Empty corner for channel column */}
          <View
            style={{ width: calculateSidebarWidth }}
            className="bg-black/30"
          />
          <ScrollView
            horizontal
            ref={(ref) => {
              scrollRefs.current.horizontalTimeline = ref;
            }}
            className="flex-1"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            scrollEnabled={!isDragging}
          >
            <View className="flex-row" style={{ width: totalWidth }}>
              {timeline.map((item, index) => (
                <View
                  key={index}
                  style={{
                    position: 'absolute',
                    left: item.position.left,
                    width: item.position.width,
                  }}
                  className=""
                >
                  <View className="h-full items-center justify-center">
                    <Text className="text-sm font-medium text-white">
                      {formatTime(item.time)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Main unified scrollable area */}
      <View className="flex-1">
        <ScrollView
          ref={(ref) => {
            scrollRefs.current.verticalMain = ref;
          }}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          scrollEnabled={!isDragging}
          onScroll={(event) => {
            const { contentOffset } = event.nativeEvent;
            setScrollOffset((prev) => ({ ...prev, y: contentOffset.y }));
            onScroll(event, 'vertical');

            // Calculate visible channels
            if (onVisibleChannelsChange && channels.length > 0) {
              const scrollY = contentOffset.y;
              const viewportHeight = event.nativeEvent.layoutMeasurement.height;
              const channelHeight = channels[0]?.position?.height || 80;

              const startIndex = Math.floor(scrollY / channelHeight);
              const endIndex = Math.ceil(
                (scrollY + viewportHeight) / channelHeight
              );

              onVisibleChannelsChange(
                Math.max(0, startIndex),
                Math.min(channels.length, endIndex)
              );
            }
          }}
        >
          <ScrollView
            horizontal
            ref={(ref) => {
              scrollRefs.current.horizontalMain = ref;
            }}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            scrollEnabled={!isDragging}
            onScroll={(event) => {
              const { contentOffset } = event.nativeEvent;
              setScrollOffset((prev) => ({ ...prev, x: contentOffset.x }));

              // Sync with timeline
              if (scrollRefs.current.horizontalTimeline) {
                scrollRefs.current.horizontalTimeline.scrollTo({
                  x: contentOffset.x,
                  animated: false,
                });
              }

              onScroll(event, 'horizontal');
            }}
          >
            <View
              style={{
                width: calculateSidebarWidth + totalWidth,
                height: totalHeight,
                position: 'relative',
              }}
            >
              {/* Channel rows with programs */}
              {channels.map((channel) => {
                const channelPrograms = programs.filter(
                  (p) => p.channelUuid === channel.uuid
                );

                return (
                  <View
                    key={channel.uuid}
                    style={{
                      position: 'absolute',
                      top: channel.position.top,
                      left: 0,
                      width: calculateSidebarWidth + totalWidth,
                      height: channel.position.height,
                    }}
                    className=""
                  >
                    {/* Sticky channel column */}
                    <View
                      style={{
                        position: 'sticky',
                        left: 0,
                        width: calculateSidebarWidth,
                        height: channel.position.height,
                        zIndex: 10,
                      }}
                      className="bg-black/30 backdrop-blur-md"
                    >
                      {renderChannel
                        ? renderChannel({ channel })
                        : defaultRenderChannel({ channel })}
                    </View>

                    {/* Programs for this channel */}
                    {channelPrograms.map((program) => {
                      const progress = calculateProgress(program);
                      const isAiring = progress > 0 && progress < 100;

                      // Calculate dynamic opacity based on position and time
                      const timeBasedOpacity = Math.max(
                        0.2,
                        Math.min(
                          1,
                          0.3 + (program.position.left / totalWidth) * 0.7
                        )
                      );
                      const rowBasedOpacity = Math.max(
                        0.15,
                        Math.min(
                          0.9,
                          0.2 + (channel.position.top / totalHeight) * 0.7
                        )
                      );
                      const combinedOpacity =
                        (timeBasedOpacity + rowBasedOpacity) / 2;

                      return (
                        <ProgramItem
                          key={program.id}
                          program={program}
                          isAiring={isAiring}
                          progress={progress}
                          onProgramClick={onProgramClick}
                          calculateSidebarWidth={calculateSidebarWidth}
                          formatTime={formatTime}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}
