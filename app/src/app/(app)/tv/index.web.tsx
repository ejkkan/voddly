/* eslint-disable max-lines-per-function */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type Channel,
  Epg,
  Layout,
  type Program,
  useEpg,
} from '@/components/epg';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Heart } from '@/components/ui/icons';
import { useFavoriteManager, useUiSections } from '@/hooks/ui';
import { useSimpleVirtualizedEpg } from '@/hooks/useCachedEpg';

type CategorySection = {
  categoryId?: string;
  title: string;
  items: {
    id: string;
    title: string;
    imageUrl?: string | null;
    sourceId?: string;
    sourceItemId?: string;
  }[];
};
export default function LiveTV() {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavoriteManager();
  const [categories, setCategories] = useState<CategorySection[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<CategorySection | null>(null);
  const [visibleChannelRange, setVisibleChannelRange] = useState({
    start: 0,
    end: 15,
  });
  const scrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const sectionsQuery = useUiSections('live', {
    limitPerCategory: 1000, // Get ALL channels per category
    maxCategories: 1000, // Get ALL categories
    categoryOffset: 0,
  });

  useEffect(() => {
    if (!sectionsQuery.data) return;

    const mapped: CategorySection[] = sectionsQuery.data.map((c) => ({
      categoryId: c.categoryId,
      title: c.name,
      items: c.items.map((i) => ({
        id: i.id,
        title: i.title,
        imageUrl: i.imageUrl ?? undefined,
        sourceId: i.sourceId ?? undefined,
        sourceItemId: i.sourceItemId ?? undefined,
      })),
    }));

    setCategories(mapped);
    if (mapped.length > 0 && !selectedCategory) {
      console.log(
        'First category sample:',
        mapped[0]?.title,
        mapped[0]?.items.slice(0, 2)
      );
      setSelectedCategory(mapped[0]);
    }
  }, [sectionsQuery.data, selectedCategory]);

  // Get source ID and channel IDs for EPG fetching
  const selectedSourceId = useMemo(() => {
    const sourceId = selectedCategory?.items[0]?.sourceId;
    console.log('Selected Source ID:', sourceId);
    return sourceId;
  }, [selectedCategory]);

  // Note: We rely on useSimpleVirtualizedEpg for fetching visible channels

  // Use simple virtualized EPG fetching - only fetch visible channels
  const epgQuery = useSimpleVirtualizedEpg(
    selectedSourceId,
    selectedCategory?.items || [],
    visibleChannelRange
  );

  // Transform data for EPG viewer - include ALL channels
  const epgChannels = useMemo<Channel[]>(() => {
    if (!selectedCategory) return [];

    return selectedCategory.items.map((item) => ({
      uuid: item.id,
      type: 'live',
      title: item.title,
      logo: item.imageUrl || undefined,
      streamId: item.sourceItemId,
    }));
  }, [selectedCategory]);

  const epgPrograms = useMemo<Program[]>(() => {
    // Use the programs from virtualized EPG (now includes placeholders)
    console.log(
      `Loaded ${epgQuery.programs.length} EPG programs (${epgQuery.fetchedCount}/${epgQuery.totalCount} channels with data)`
    );
    return epgQuery.programs;
  }, [epgQuery.programs, epgQuery.fetchedCount, epgQuery.totalCount]);

  // Call useEpg at the top level, not conditionally
  const epgProps = useEpg({
    channels: epgChannels,
    epg: epgPrograms,
    width: typeof window !== 'undefined' ? window.innerWidth - 280 : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight - 200 : 600,
    isSidebar: true,
    isTimeline: true,
    isLine: true,
    variant: 'unified', //'separate', //'unified', // Use 'unified' for better performance, 'separate' for the original layout
  });

  const handleChannelClick = (channel: Channel) => {
    // Navigate to the channel detail/player
    router.push(`/(app)/tv/${encodeURIComponent(channel.uuid)}`);
  };

  const handleProgramClick = (program: Program) => {
    // Could show program details or navigate to the channel
    const channel = epgChannels.find((ch) => ch.uuid === program.channelUuid);
    if (channel) {
      handleChannelClick(channel);
    }
  };

  // Debounced handler for scroll updates
  const handleVisibleChannelsChange = useCallback(
    (start: number, end: number) => {
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set new timeout for debounced update
      scrollTimeoutRef.current = setTimeout(() => {
        setVisibleChannelRange({ start, end });
      }, 300); // 300ms debounce
    },
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="flex-1 flex-row">
        {/* Categories Sidebar */}
        <View className="w-64 border-r border-neutral-200 dark:border-neutral-800">
          <View className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              Live TV Categories({categories.length})
            </Text>
          </View>
          <ScrollView className="flex-1">
            {categories.map((category) => (
              <Pressable
                key={category.categoryId || category.title}
                onPress={() => {
                  setSelectedCategory(category);
                  setVisibleChannelRange({ start: 0, end: 15 }); // Reset range when switching
                }}
                className={`border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 ${
                  selectedCategory?.categoryId === category.categoryId
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text
                      className={`text-sm ${
                        selectedCategory?.categoryId === category.categoryId
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {category.title}
                    </Text>
                    <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                      {category.items.length} channels
                    </Text>
                  </View>
                  {category.categoryId ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFavorite(
                          category.categoryId as string,
                          'category'
                        );
                      }}
                      className="rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <Heart
                        filled={isFavorite(category.categoryId)}
                        color={
                          isFavorite(category.categoryId)
                            ? '#ef4444'
                            : '#6b7280'
                        }
                      />
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* EPG Viewer */}
        <View className="flex-1 p-4">
          {selectedCategory ? (
            <>
              <View className="mb-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                      {selectedCategory.title}
                    </Text>
                    {selectedCategory.categoryId ? (
                      <Pressable
                        onPress={() =>
                          toggleFavorite(
                            selectedCategory.categoryId!,
                            'category'
                          )
                        }
                        className="rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <Heart
                          filled={isFavorite(selectedCategory.categoryId!)}
                          color={
                            isFavorite(selectedCategory.categoryId!)
                              ? '#ef4444'
                              : '#6b7280'
                          }
                        />
                      </Pressable>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                      {epgQuery.fetchedCount}/{epgQuery.totalCount} channels
                      loaded
                    </Text>
                    <Pressable
                      onPress={() => {
                        console.log('Manual EPG refetch triggered');
                        epgQuery.refetch();
                      }}
                      className="rounded bg-blue-500 px-3 py-1"
                    >
                      <Text className="text-sm text-white">Refresh</Text>
                    </Pressable>
                  </View>
                </View>
                {epgQuery.isLoading && (
                  <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    Loading EPG data...
                  </Text>
                )}
                {epgQuery.isError && (
                  <Text className="mt-1 text-sm text-red-600 dark:text-red-400">
                    Error loading EPG data
                  </Text>
                )}
              </View>
              {epgChannels.length > 0 && (
                <>
                  {/* Control buttons */}
                  <View className="mb-2 flex-row justify-end gap-2">
                    <Pressable
                      onPress={epgProps.onScrollLeft}
                      className="rounded-md bg-neutral-100 px-3 py-1 dark:bg-neutral-800"
                    >
                      <Text className="text-sm">← Earlier</Text>
                    </Pressable>
                    <Pressable
                      onPress={epgProps.onScrollToNow}
                      className="rounded-md bg-blue-500 px-3 py-1"
                    >
                      <Text className="text-sm text-white">Now</Text>
                    </Pressable>
                    <Pressable
                      onPress={epgProps.onScrollRight}
                      className="rounded-md bg-neutral-100 px-3 py-1 dark:bg-neutral-800"
                    >
                      <Text className="text-sm">Later →</Text>
                    </Pressable>
                  </View>

                  <Epg {...epgProps.getEpgProps()}>
                    <Layout
                      {...epgProps.getLayoutProps()}
                      onVisibleChannelsChange={handleVisibleChannelsChange}
                      renderChannel={({ channel }) => (
                        <Pressable
                          onPress={() => {
                            console.log('=== Channel Debug Info ===');
                            console.log('Channel:', {
                              uuid: channel.uuid,
                              title: channel.title,
                              streamId: channel.streamId,
                              logo: channel.logo,
                              ...channel,
                            });
                            console.log('========================');
                            handleChannelClick(channel);
                          }}
                          className="flex-row items-center border-b border-neutral-200 px-3 dark:border-neutral-700"
                          style={{ height: 80, cursor: 'pointer' }}
                        >
                          {channel.logo && (
                            <img
                              src={channel.logo}
                              alt={channel.title}
                              className="mr-3 size-10 object-contain"
                            />
                          )}
                          <Text
                            className="flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100"
                            numberOfLines={2}
                          >
                            {channel.title || ''}
                          </Text>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleFavorite(channel.uuid, 'channel');
                            }}
                            className="ml-2 rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10"
                          >
                            <Heart
                              filled={isFavorite(channel.uuid)}
                              color={
                                isFavorite(channel.uuid) ? '#ef4444' : '#6b7280'
                              }
                            />
                          </Pressable>
                        </Pressable>
                      )}
                      renderProgram={({ program }) => {
                        // Check if program is currently airing
                        // But if there's a later program that has started, this one is not airing
                        const isAiring = (() => {
                          const now = new Date().getTime();
                          const start = new Date(program.since).getTime();
                          const end = new Date(program.till).getTime();

                          // Basic check: is current time within program's time range
                          if (!(now >= start && now <= end)) {
                            return false;
                          }

                          // Additional check: if there's a later program on the same channel that has started
                          // then this program is not currently airing
                          const allPrograms = (
                            epgProps.getLayoutProps().programs ?? epgPrograms
                          ).filter(Boolean) as Program[];
                          const laterPrograms = allPrograms.filter(
                            (p) =>
                              p.channelUuid === program.channelUuid &&
                              p.id !== program.id &&
                              new Date(p.since).getTime() > start &&
                              new Date(p.since).getTime() <= now
                          );

                          // If any later program has started, this one is not airing
                          return laterPrograms.length === 0;
                        })();

                        const isPlaceholder =
                          program.title === 'No information';

                        // Adjust width to prevent visual overlaps - only if needed
                        let adjustedWidth = program.position?.width || 0;
                        let adjustedLeft = program.position?.left || 0;

                        // Only run adjustment logic if we have position data
                        if (program.position && epgPrograms.length > 0) {
                          // Get all programs and do adjustment calculation
                          const allPrograms = (
                            epgProps.getLayoutProps().programs ?? epgPrograms
                          ).filter(Boolean) as Program[];

                          // Find programs on the same channel that might overlap
                          const channelPrograms = allPrograms.filter(
                            (p) =>
                              p.channelUuid === program.channelUuid &&
                              p.position &&
                              p.id !== program.id &&
                              p.position.left > adjustedLeft &&
                              p.position.left < adjustedLeft + adjustedWidth
                          );

                          // If there are potential conflicts, find the earliest one
                          if (channelPrograms.length > 0) {
                            const earliestConflict = channelPrograms.reduce(
                              (earliest, current) => {
                                if (!earliest) return current;
                                return current.position.left <
                                  earliest.position.left
                                  ? current
                                  : earliest;
                              },
                              null as (typeof channelPrograms)[number] | null
                            );

                            if (earliestConflict) {
                              const newWidth =
                                earliestConflict.position.left -
                                adjustedLeft -
                                2;
                              adjustedWidth = Math.max(20, newWidth);
                            }
                          }
                        }

                        return (
                          <Pressable
                            onPress={() => {
                              console.log('=== Program Debug Info ===');
                              console.log('Program:', {
                                id: program.id,
                                title: program.title,
                                description: program.description,
                                channelUuid: program.channelUuid,
                                since: program.since,
                                till: program.till,
                                isCurrentlyAiring: isAiring,
                                isPlaceholder,
                                duration: `${Math.round((new Date(program.till).getTime() - new Date(program.since).getTime()) / 60000)} minutes`,
                                originalPosition: program.position
                                  ? `${program.position.left} to ${program.position.left + program.position.width}`
                                  : 'no position',
                                adjustedPosition:
                                  adjustedWidth > 0
                                    ? `${adjustedLeft} to ${adjustedLeft + adjustedWidth}`
                                    : 'no position',
                                wasAdjusted:
                                  program.position &&
                                  adjustedWidth !== program.position.width,
                                ...program,
                              });
                              console.log('========================');
                              handleProgramClick(program);
                            }}
                            style={{
                              position: 'absolute',
                              left: adjustedLeft,
                              width: adjustedWidth,
                              top: 4,
                              height: program.position?.height
                                ? program.position.height - 8
                                : 72,
                              cursor: 'pointer',
                              overflow: 'hidden',
                            }}
                            className={`rounded-md border px-2 py-1 ${
                              isPlaceholder
                                ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900'
                                : isAiring
                                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                                  : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800'
                            }`}
                          >
                            <View>
                              <Text
                                className={`text-xs ${
                                  isPlaceholder
                                    ? 'italic text-neutral-400 dark:text-neutral-500'
                                    : `font-medium ${
                                        isAiring
                                          ? 'text-blue-900 dark:text-blue-100'
                                          : 'text-neutral-900 dark:text-neutral-100'
                                      }`
                                }`}
                                numberOfLines={1}
                              >
                                {program.title || ''}
                              </Text>
                            </View>
                            <View>
                              {program.description && !isPlaceholder ? (
                                <Text
                                  className={`mt-0.5 text-xs ${
                                    isAiring
                                      ? 'text-blue-700 dark:text-blue-300'
                                      : 'text-neutral-600 dark:text-neutral-400'
                                  }`}
                                >
                                  {program.description || ''}
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      }}
                    />
                  </Epg>
                </>
              )}
            </>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-neutral-600 dark:text-neutral-400">
                Select a category to view channels and EPG
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
