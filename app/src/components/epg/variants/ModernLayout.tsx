import React, { useCallback, useMemo } from 'react';

import { Image, Pressable, ScrollView, Text, View } from '@/components/ui';

import { TIMELINE_HEIGHT } from '../constants';
import { DebugButton } from '../DebugButton';
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
    isFirstProgram,
    isLastProgram,
    allPrograms,
    calculateProgressWidth,
  }: {
    program: any;
    isAiring: boolean;
    progress: number;
    onProgramClick?: (program: any) => void;
    calculateSidebarWidth: number;
    formatTime: (date: Date) => string;
    isFirstProgram?: boolean;
    isLastProgram?: boolean;
    allPrograms?: any[];
    calculateProgressWidth?: (
      program: any,
      progress: number
    ) => number | string;
  }) => {
    const handleBackgroundPlay = React.useCallback(() => {
      console.log('Playing in background:', program.title);
      if (onProgramClick) {
        onProgramClick(program);
      }
    }, [program, onProgramClick]);

    const handleNavigateToPlayer = React.useCallback(() => {
      console.log('Navigate to player:', program.title);
      // Navigate to full player
      if (typeof window !== 'undefined' && program.channelUuid) {
        window.location.href = `/player?channelId=${encodeURIComponent(program.channelUuid)}`;
      }
    }, [program]);
    const hasPassed = program.computed.startTime < new Date().getTime();

    // Debug logging for progress bar overlap issue
    if (isAiring) {
      // console.log('=== AIRING PROGRAM DEBUG ===');
      // console.log('Program:', program.title);
      // console.log('Program ID:', program.id);
      // console.log('Position:', {
      //   left: calculateSidebarWidth + program.position.left,
      //   width: program.position.width,
      //   top: 0,
      //   height: program.position.height,
      // });
      // console.log('Progress:', progress + '%');
      // console.log('Is First Program:', isFirstProgram);
      // console.log('Is Last Program:', isLastProgram);
      // console.log('===========================');
    }

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
        className={`relative border-b border-l border-white/10 ${
          isAiring ? 'bg-transparent' : 'bg-transparent'
        }`}
      >
        {/* Content */}
        <View className="relative flex-1 p-6">
          {/* Title and Time on same line */}
          <View
            className={`flex-row items-baseline gap-3 ${isFirstProgram ? 'justify-start' : 'justify-start'}`}
          >
            {allPrograms && (
              <DebugButton
                program={program}
                allPrograms={allPrograms}
                size={3}
                progress={progress}
                calculateSidebarWidth={calculateSidebarWidth}
                isAiring={isAiring}
                isFirstProgram={isFirstProgram}
                isLastProgram={isLastProgram}
              />
            )}
            <Text
              className={`flex-1 text-lg font-semibold ${
                isAiring ? 'text-white' : 'text-white/90'
              }`}
              style={{ textAlign: isFirstProgram ? 'left' : 'left' }}
              numberOfLines={1}
            >
              {program.computed?.trimmedTitle ||
                (() => {
                  const channelPrograms =
                    allPrograms?.filter(
                      (p) => p.channelUuid === program.channelUuid
                    ) || [];
                  const nextProgram = channelPrograms
                    .filter(
                      (p) => p.computed?.startTime >= program.computed?.endTime
                    )
                    .sort((a, b) => a.computed?.startTime - b.computed?.startTime)
                    .find((p) => p.computed?.hasContent);

                  if (hasPassed) {
                    return 'No information';
                  }

                  return nextProgram
                    ? `Next program starts at ${formatTime(new Date(nextProgram.since))}: ${nextProgram.computed?.trimmedTitle}`
                    : 'No information';
                })()}
            </Text>
            {!hasPassed ? (
              <Text
                className={`text-sm ${
                  isAiring ? 'text-white/70' : 'text-white/60'
                }`}
                style={{ textAlign: isFirstProgram ? 'left' : 'left' }}
              >
                {formatTime(new Date(program.since))}
              </Text>
            ) : null}
          </View>

          {/* Description below - extends full height, text renders behind buttons */}
          {program.description ? (
            <Text
              className={`mt-2 text-sm leading-relaxed ${
                isAiring ? 'text-white/70' : 'text-white/60'
              }`}
              style={{
                paddingBottom: isAiring ? 72 : 0,
                textAlign: isFirstProgram ? 'left' : 'left',
              }}
            >
              {program.description}
            </Text>
          ) : null}

          {/* Circular action buttons at bottom-left */}
          {isAiring && (
            <View
              className="absolute bottom-6 left-6 flex-row gap-3"
              style={{ zIndex: 10 }}
            >
              <Pressable
                onPress={handleBackgroundPlay}
                className="size-12 items-center justify-center rounded-full bg-white/40 backdrop-blur-2xl hover:bg-white/50"
                style={{
                  cursor: 'pointer' as any,
                  boxShadow:
                    '0 8px 32px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <Text className="text-lg text-white">⛶</Text>
              </Pressable>
              <Pressable
                onPress={handleNavigateToPlayer}
                className="size-12 items-center justify-center rounded-full bg-white/40 backdrop-blur-2xl hover:bg-white/50"
                style={{
                  cursor: 'pointer' as any,
                  boxShadow:
                    '0 8px 32px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <Text className="text-lg text-white">▶</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Progress bar for currently airing programs only (exclude placeholders) */}
        {isAiring && program.computed?.hasContent && (
            <View className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <View
                className="h-full bg-blue-400"
                style={{
                  width: calculateProgressWidth
                    ? calculateProgressWidth(program, progress)
                    : `${Math.min(progress, 100)}%`,
                }}
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
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, []);

  const calculateProgress = useCallback((program: any) => {
    const now = new Date().getTime();
    const { startTime, endTime } = program.computed;

    if (now < startTime) return 0;
    if (now > endTime) return 100;

    return ((now - startTime) / (endTime - startTime)) * 100;
  }, []);

  const calculateProgressWidth = useCallback(
    (program: any, progress: number) => {
      const now = new Date().getTime();
      const { startTime, endTime } = program.computed;
      const rangeStart = now - 0.5 * 60 * 60 * 1000; // 30 min ago

      // If program starts before visible range (originalLeft < 0), calculate visible progress
      if (program.position.originalLeft < 0) {
        // Program started before our visible range
        const visibleStart = Math.max(startTime, rangeStart);
        const visibleDuration = endTime - visibleStart;
        const timeElapsed = now - visibleStart;
        const visibleProgress = Math.min(
          100,
          (timeElapsed / visibleDuration) * 100
        );

        const progressWidth = (visibleProgress / 100) * program.position.width;
        return Math.min(progressWidth, program.position.width);
      }

      // Standard progress calculation for programs fully within visible range
      const progressWidth = (progress / 100) * program.position.width;
      return Math.min(progressWidth, program.position.width);
    },
    []
  );

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

  // Calculate current time position for "now" line
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const rangeStart = now.getTime() - 0.5 * 60 * 60 * 1000; // 30 minutes ago
    return (
      ((now.getTime() - rangeStart) / (1000 * 60 * 60)) * (totalWidth / 12.5)
    );
  }, [totalWidth]);

  // Default channel renderer for modern variant
  const defaultRenderChannel = useCallback(
    ({ channel }: { channel: any }) => (
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
    ),
    []
  );

  return (
    <View className="flex-1 bg-black/40 backdrop-blur-md">
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
                  <View className="h-full items-start justify-center">
                    <Text className="text-lg font-medium text-white">
                      {formatTime(item.time).split(':')[0]}
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
          onScroll={(event) => {
            const { contentOffset } = event.nativeEvent;
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
            onScroll={(event) => {
              const { contentOffset } = event.nativeEvent;

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
              {/* Vertical "now" line */}
              <View
                style={{
                  position: 'absolute',
                  left: calculateSidebarWidth + currentTimePosition,
                  top: 0,
                  width: 2,
                  height: totalHeight,
                  backgroundColor: '#ef4444', // red-500
                  zIndex: 20,
                  opacity: 0.8,
                }}
              />

              {/* Channel rows with programs */}
              {channels
                // .filter(
                //   (channel) =>
                //     channel.uuid === '4a89a49d-f832-428b-83f1-7d28e665b6d2'
                // )
                .map((channel) => {
                  const channelPrograms = programs.filter(
                    (p) => p.channelUuid === channel.uuid
                  );
                  // console.log('Channel Programs UUID:', channel.uuid);
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
                      {channelPrograms.map((program, programIndex) => {
                        const progress = calculateProgress(program);
                        const now = new Date().getTime();

                        // Find the most recent program that's currently airing on this channel
                        const currentAiringPrograms = channelPrograms.filter(
                          (p) => {
                            return now >= p.computed.startTime && now < p.computed.endTime;
                          }
                        );

                        // Sort by start time descending to get the most recent one
                        const mostRecentAiring = currentAiringPrograms.sort(
                          (a, b) => b.computed.startTime - a.computed.startTime
                        )[0];

                        // Only mark as airing if this is the most recent airing program
                        const isAiring =
                          mostRecentAiring &&
                          program.id === mostRecentAiring.id;
                        // if (isAiring) {
                        //   console.log('Program:', program);
                        // }

                        const isFirstProgram = programIndex === 0;
                        const isLastProgram =
                          programIndex === channelPrograms.length - 1;

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
                            isFirstProgram={isFirstProgram}
                            isLastProgram={isLastProgram}
                            allPrograms={programs}
                            calculateProgressWidth={calculateProgressWidth}
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
