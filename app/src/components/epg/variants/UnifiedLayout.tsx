import React from 'react';
import { Platform } from 'react-native';
import { ScrollView, Text, View } from '@/components/ui';
import { UnifiedLayoutProps } from '../types';
import { TIMELINE_HEIGHT } from '../constants';
import { DefaultRenderFunctions } from '../DefaultRenderFunctions';

export function UnifiedLayout({
  channels,
  programs,
  timeline,
  isSidebar,
  isTimeline,
  scrollRefs,
  onScroll,
  onVisibleChannelsChange,
  renderProgram,
  renderChannel,
  renderTimeline,
  calculateSidebarWidth,
}: UnifiedLayoutProps) {
  const { defaultRenderChannel, defaultRenderProgram, defaultRenderTimeline } =
    DefaultRenderFunctions({
      channels,
      programs,
      timeline,
      formatTime: (date: Date) => {
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      },
    });

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

  return (
    <View className="flex-1 bg-gradient-to-br from-neutral-50 to-neutral-100 p-4 dark:from-neutral-950 dark:to-neutral-900">
      {/* Timeline sticky header */}
      {isTimeline && (
        <View style={{ height: TIMELINE_HEIGHT + 16 }} className="z-10 mb-4 flex-row">
          {/* Empty corner for channel column */}
          {isSidebar && (
            <View
              style={{
                width: calculateSidebarWidth,
                height: TIMELINE_HEIGHT + 16,
                marginRight: 12,
              }}
              className="overflow-hidden rounded-2xl bg-white/70 shadow-xl backdrop-blur-2xl dark:bg-neutral-900/70"
            />
          )}
          {/* Timeline scroll area */}
          <ScrollView
            horizontal
            ref={(ref) => {
              scrollRefs.current.horizontalTimeline = ref;
            }}
            className="flex-1 overflow-hidden rounded-2xl bg-white/70 shadow-xl backdrop-blur-2xl dark:bg-neutral-900/70"
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
      <View className="flex-1 flex-row gap-3">
        {/* Sticky channel sidebar */}
        {isSidebar && (
          <View
            style={{ width: calculateSidebarWidth }}
            className="z-20 overflow-hidden rounded-2xl bg-white/70 shadow-xl backdrop-blur-2xl dark:bg-neutral-900/70"
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
          className="flex-1 overflow-hidden rounded-2xl bg-white/50 shadow-xl backdrop-blur-2xl dark:bg-neutral-900/50"
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
                    }}
                    className=""
                  >
                    {/* Render programs for this channel */}
                    {channelPrograms.map((program) => {
                      // Calculate dynamic opacity based on position and time
                      const timeBasedOpacity = Math.max(0.2, Math.min(1, 
                        0.3 + (program.position.left / totalWidth) * 0.7
                      ));
                      const rowBasedOpacity = Math.max(0.15, Math.min(0.9, 
                        0.2 + (channel.position.top / totalHeight) * 0.7
                      ));
                      const combinedOpacity = (timeBasedOpacity + rowBasedOpacity) / 2;

                      return (
                        <View 
                          key={program.id}
                          style={{ opacity: combinedOpacity }}
                        >
                          {renderProgram
                            ? renderProgram({ program })
                            : defaultRenderProgram({ program })}
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {/* Current time line across all channels */}
              {(() => {
                const now = new Date();
                // Use the same reference point as useEpg hook for consistency
                const startTime = new Date(
                  now.getTime() - 1 * 60 * 60 * 1000
                ); // 1 hour ago
                if (timeline.length === 0) return null;
                const currentPos =
                  ((now.getTime() - startTime.getTime()) / (1000 * 60 * 60)) *
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