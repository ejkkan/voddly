import React from 'react';
import { Platform } from 'react-native';

import { Image, ScrollView, Text, View } from '@/components/ui';

interface LayoutProps {
  channels: any[];
  programs: any[];
  timeline: any[];
  isSidebar: boolean;
  isTimeline: boolean;
  isBaseTimeFormat: boolean;
  scrollRefs: any;
  variant?: 'separate' | 'unified';
  onScroll: (event: any, type: 'horizontal' | 'vertical') => void;
  onVisibleChannelsChange?: (startIndex: number, endIndex: number) => void;
  renderProgram?: (props: { program: any }) => React.ReactNode;
  renderChannel?: (props: { channel: any }) => React.ReactNode;
  renderTimeline?: (props: { time: Date }) => React.ReactNode;
}

const TIMELINE_HEIGHT = 50;
const SIDEBAR_WIDTH = 200;

export function Layout({
  channels,
  programs,
  timeline,
  isSidebar,
  isTimeline,
  isBaseTimeFormat,
  scrollRefs,
  variant = 'separate',
  onScroll,
  onVisibleChannelsChange,
  renderProgram,
  renderChannel,
  renderTimeline,
}: LayoutProps) {
  // Add a hint at the top of the EPG
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      console.log(
        '💡 EPG Debug: Double-click on any channel or program to see debug info'
      );
    }
  }, []);
  const formatTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };
    if (!isBaseTimeFormat) {
      options.hour12 = false;
    }
    return date.toLocaleTimeString([], options);
  };

  const isCurrentlyAiring = (program: any) => {
    const now = new Date().getTime();
    const start = new Date(program.since).getTime();
    const end = new Date(program.till).getTime();
    return now >= start && now <= end;
  };

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

  // Default render functions
  const defaultRenderChannel = ({ channel }: { channel: any }) => {
    const handleDebug = () => {
      console.log('=== Channel Debug Info ===');
      console.log('Channel:', {
        uuid: channel.uuid,
        title: channel.title,
        position: channel.position,
        logo: channel.logo,
        ...channel,
      });
      const channelPrograms = programs.filter(
        (p) => p.channelUuid === channel.uuid
      );
      console.log('Programs for this channel:', channelPrograms.length);
      console.log(
        'Programs:',
        channelPrograms.map((p) => ({
          id: p.id,
          title: p.title,
          since: p.since,
          till: p.till,
          position: p.position,
        }))
      );
      console.log('========================');
    };

    return (
      <View
        className="flex-row items-center border-b border-neutral-200 px-3 dark:border-neutral-700"
        style={{
          height: channel.position.height,
          ...(Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {}),
        }}
      >
        {channel.logo && Platform.OS === 'web' ? (
          <img
            src={channel.logo}
            alt={channel.title}
            className="mr-3 size-10 object-contain"
          />
        ) : channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            className="mr-3 size-10"
            contentFit="contain"
          />
        ) : null}
        <Text
          className="flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100"
          numberOfLines={2}
        >
          {channel.title || ''}
        </Text>
      </View>
    );
  };

  const defaultRenderProgram = ({ program }: { program: any }) => {
    const isAiring = isCurrentlyAiring(program);

    const handleDebug = () => {
      console.log('=== Program Debug Info ===');
      console.log('Program:', {
        id: program.id,
        title: program.title,
        description: program.description,
        channelUuid: program.channelUuid,
        position: program.position,
        since: program.since,
        till: program.till,
        isCurrentlyAiring: isAiring,
        duration: `${Math.round((new Date(program.till).getTime() - new Date(program.since).getTime()) / 60000)} minutes`,
        ...program,
      });
      const channel = channels.find((c) => c.uuid === program.channelUuid);
      if (channel) {
        console.log('Parent channel:', {
          title: channel.title,
          uuid: channel.uuid,
          position: channel.position,
        });
      }
      console.log('========================');
    };

    return (
      <View
        style={{
          position: 'absolute',
          left: program.position.left,
          width: program.position.width,
          top: 4,
          height: program.position.height - 8,
          overflow: 'hidden',
          ...(Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {}),
        }}
        className={`rounded-md border px-2 py-1 ${
          isAiring
            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
            : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800'
        }`}
      >
        <Text
          className={`text-xs font-medium ${
            isAiring
              ? 'text-blue-900 dark:text-blue-100'
              : 'text-neutral-900 dark:text-neutral-100'
          }`}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {program.title || ''}
        </Text>
        {program.description && (
          <Text
            className={`mt-0.5 text-xs ${
              isAiring
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {program.description || ''}
          </Text>
        )}
      </View>
    );
  };

  const defaultRenderTimeline = ({ time }: { time: Date }) => (
    <View
      className="items-center justify-center border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
      style={{ height: TIMELINE_HEIGHT }}
    >
      <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {formatTime(time) || ''}
      </Text>
    </View>
  );

  // Unified layout - everything in one scrollable container
  if (variant === 'unified') {
    return (
      <View className="flex-1">
        {/* Timeline sticky header */}
        {isTimeline && (
          <View style={{ height: TIMELINE_HEIGHT }} className="z-10 flex-row">
            {/* Empty corner for channel column */}
            {isSidebar && (
              <View
                style={{ width: SIDEBAR_WIDTH, height: TIMELINE_HEIGHT }}
                className="border-b border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
              />
            )}
            {/* Timeline scroll area */}
            <ScrollView
              horizontal
              ref={(ref) => {
                scrollRefs.current.horizontalTimeline = ref;
              }}
              className="flex-1"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              scrollEnabled={false} // Will be controlled by main scroll
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
                  >
                    {renderTimeline
                      ? renderTimeline({ time: item.time })
                      : defaultRenderTimeline({ time: item.time })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Main content with both scrolls */}
        <View className="flex-1 flex-row">
          {/* Sticky channel sidebar */}
          {isSidebar && (
            <View
              style={{ width: SIDEBAR_WIDTH }}
              className="z-20 border-r border-neutral-200 bg-white dark:border-neutral-700 dark:bg-black"
            >
              <ScrollView
                ref={(ref) => {
                  scrollRefs.current.verticalSidebar = ref;
                }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                scrollEnabled={false} // Controlled by main scroll
              >
                {channels.map((channel) => (
                  <View key={channel.uuid}>
                    {renderChannel
                      ? renderChannel({ channel })
                      : defaultRenderChannel({ channel })}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Programs grid - vertical wrapper */}
          <ScrollView
            ref={(ref) => {
              scrollRefs.current.verticalMain = ref;
            }}
            className="flex-1"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              const { contentOffset } = event.nativeEvent;

              // Sync vertical scroll with sidebar
              if (scrollRefs.current.verticalSidebar) {
                scrollRefs.current.verticalSidebar.scrollTo({
                  y: contentOffset.y,
                  animated: false,
                });
              }

              onScroll(event, 'vertical');

              // Calculate visible channels
              if (onVisibleChannelsChange && channels.length > 0) {
                const scrollY = contentOffset.y;
                const viewportHeight =
                  event.nativeEvent.layoutMeasurement.height;
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
            {/* Horizontal scroll wrapper */}
            <ScrollView
              horizontal
              ref={(ref) => {
                scrollRefs.current.main = ref;
              }}
              showsHorizontalScrollIndicator={true}
              scrollEventThrottle={16}
              onScroll={(event) => {
                const { contentOffset } = event.nativeEvent;

                // Sync horizontal scroll with timeline
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
                  width: totalWidth,
                  height: totalHeight,
                  position: 'relative',
                }}
              >
                {/* Render programs for all channels */}
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
                        width: totalWidth,
                        height: channel.position.height,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(0,0,0,0.1)',
                      }}
                      className="border-b border-neutral-200 dark:border-neutral-700"
                    >
                      {/* Render programs for this channel */}
                      {channelPrograms.map((program) => (
                        <View key={program.id}>
                          {renderProgram
                            ? renderProgram({ program })
                            : defaultRenderProgram({ program })}
                        </View>
                      ))}
                    </View>
                  );
                })}

                {/* Current time line across all channels */}
                {(() => {
                  const now = new Date();
                  const firstHour = timeline[0]?.time;
                  if (!firstHour) return null;
                  const currentPos =
                    ((now.getTime() - firstHour.getTime()) / (1000 * 60 * 60)) *
                    (timeline[0]?.position.width || 300);

                  if (currentPos < 0 || currentPos > totalWidth) return null;

                  return (
                    <View
                      style={{
                        position: 'absolute',
                        left: currentPos,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        backgroundColor: '#ef4444',
                        zIndex: 100,
                      }}
                    />
                  );
                })()}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Original separate layout (current implementation)
  return (
    <View className="flex-1 flex-row">
      {/* Sidebar with channels */}
      {isSidebar && (
        <View
          style={{ width: SIDEBAR_WIDTH }}
          className="z-20 border-r border-neutral-200 bg-white dark:border-neutral-700 dark:bg-black"
        >
          {/* Empty corner above channels */}
          {isTimeline && (
            <View
              style={{ height: TIMELINE_HEIGHT }}
              className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
            />
          )}

          {/* Channel list */}
          <ScrollView
            ref={(ref) => {
              scrollRefs.current.vertical = ref;
            }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => onScroll(event, 'vertical')}
          >
            {channels.map((channel) => (
              <View key={channel.uuid}>
                {renderChannel
                  ? renderChannel({ channel })
                  : defaultRenderChannel({ channel })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main content area */}
      <View className="flex-1">
        {/* Timeline */}
        {isTimeline && (
          <View style={{ height: TIMELINE_HEIGHT }} className="z-10">
            <ScrollView
              horizontal
              ref={(ref) => {
                scrollRefs.current.horizontal = ref;
              }}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(event) => onScroll(event, 'horizontal')}
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
                  >
                    {renderTimeline
                      ? renderTimeline({ time: item.time })
                      : defaultRenderTimeline({ time: item.time })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Programs grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            // Sync with channel sidebar
            if (scrollRefs.current.vertical) {
              scrollRefs.current.vertical.scrollTo({
                y: event.nativeEvent.contentOffset.y,
                animated: false,
              });
            }
            onScroll(event, 'vertical');

            // Calculate visible channels
            if (onVisibleChannelsChange && channels.length > 0) {
              const scrollY = event.nativeEvent.contentOffset.y;
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
          {/* Render each channel row */}
          {channels.map((channel, channelIndex) => {
            const channelPrograms = programs.filter(
              (p) => p.channelUuid === channel.uuid
            );

            return (
              <View
                key={channel.uuid}
                style={{ height: channel.position.height }}
                className="border-b border-neutral-200 dark:border-neutral-700"
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(event) => {
                    // Sync all horizontal scrolls
                    if (scrollRefs.current.horizontal) {
                      scrollRefs.current.horizontal.scrollTo({
                        x: event.nativeEvent.contentOffset.x,
                        animated: false,
                      });
                    }
                    onScroll(event, 'horizontal');
                  }}
                >
                  <View
                    style={{
                      width: totalWidth,
                      height: channel.position.height,
                      position: 'relative',
                    }}
                  >
                    {/* Render programs for this channel */}
                    {channelPrograms.map((program) => (
                      <View key={program.id}>
                        {renderProgram
                          ? renderProgram({ program })
                          : defaultRenderProgram({ program })}
                      </View>
                    ))}

                    {/* Current time line for this channel */}
                    {(() => {
                      const now = new Date();
                      const firstHour = timeline[0]?.time;
                      if (!firstHour) return null;
                      const currentPos =
                        ((now.getTime() - firstHour.getTime()) /
                          (1000 * 60 * 60)) *
                        (timeline[0]?.position.width || 300);

                      if (currentPos < 0 || currentPos > totalWidth)
                        return null;

                      return (
                        <View
                          style={{
                            position: 'absolute',
                            left: currentPos,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            backgroundColor: '#ef4444',
                            zIndex: 100,
                          }}
                        />
                      );
                    })()}
                  </View>
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
