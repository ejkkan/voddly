import { useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';

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
import { PlainPlayer } from '@/components/video/PlainPlayer';
import { useFavoriteManager, useUiSections } from '@/hooks/ui';
import { useSimpleVirtualizedEpg } from '@/hooks/useCachedEpg';
import { useSourceCredentials } from '@/lib/source-credentials';
import { constructStreamUrl } from '@/lib/stream-url';
import { sortChannelsWithClustering } from '@/utils/channel-grouping';
import { EpgLoadingSkeleton } from '@/components/epg/EpgLoadingSkeleton';

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

// Separate component for program items with proper drag detection
const ProgramItem = React.memo(function ProgramItem({
  program,
  isAiring,
  isPlaceholder,
  onPress,
}: {
  program: Program;
  isAiring: boolean;
  isPlaceholder: boolean;
  onPress: (program: Program) => void;
}) {
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const handlePressIn = useCallback((e: any) => {
    const event = e.nativeEvent || e;
    dragStartPos.current = {
      x: event.pageX || event.clientX,
      y: event.pageY || event.clientY,
    };
    isDragging.current = false;
  }, []);

  const handlePressOut = useCallback(
    (e: any) => {
      const event = e.nativeEvent || e;
      if (dragStartPos.current) {
        const endX = event.pageX || event.clientX;
        const endY = event.pageY || event.clientY;
        const deltaX = Math.abs(endX - dragStartPos.current.x);
        const deltaY = Math.abs(endY - dragStartPos.current.y);

        // Disabled program box navigation - only buttons should trigger actions
        // if (deltaX < 5 && deltaY < 5 && !isDragging.current) {
        //   onPress(program);
        // }
      }
      dragStartPos.current = null;
      isDragging.current = false;
    },
    [program, onPress]
  );

  const handleMouseMove = useCallback((e: any) => {
    if (dragStartPos.current) {
      const event = e.nativeEvent || e;
      const currentX = event.pageX || event.clientX;
      const currentY = event.pageY || event.clientY;
      const deltaX = Math.abs(currentX - dragStartPos.current.x);
      const deltaY = Math.abs(currentY - dragStartPos.current.y);

      // Mark as dragging if movement exceeds threshold
      if (deltaX > 5 || deltaY > 5) {
        isDragging.current = true;
      }
    }
  }, []);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute',
        left: program.position?.left || 0,
        width: program.position?.width || 100,
        top: 4,
        height: (program.position?.height || 80) - 8,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      className={`flex-row items-center justify-between rounded-md border px-4 py-3 ${
        isPlaceholder
          ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900'
          : isAiring
            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
            : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800'
      }`}
    >
      <View className="flex-1">
        <Text
          className={`text-base ${
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
        {!isPlaceholder && (
          <Text
            className={`mt-1 text-sm ${
              isAiring
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {new Date(program.since).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

export default function LiveTV() {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavoriteManager();
  const { prepareContentPlayback, getCredentials } = useSourceCredentials();
  const [categories, setCategories] = useState<CategorySection[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<CategorySection | null>(null);
  const [visibleChannelRange, setVisibleChannelRange] = useState({
    start: 0,
    end: 15,
  });
  const [backgroundVideo, setBackgroundVideo] = useState<{
    channel: Channel;
    program: Program;
    streamUrl: string;
  } | null>(null);
  const scrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // First load: Get only category metadata with minimal channels to get category list
  const categoriesQuery = useUiSections('live', {
    limitPerCategory: 1, // Load just 1 channel per category to get the category list
    maxCategories: 1000, // Get ALL categories
    categoryOffset: 0,
  });

  // Second load: Get channels for selected category only
  const selectedCategoryChannelsQuery = useUiSections('live', {
    limitPerCategory: 999999, // Get ALL channels for selected category (no limit)
    maxCategories: 999999, // Get ALL categories to ensure we get the right category
    categoryOffset: 0, // Start from beginning to ensure we get the right category
    enabled: !!selectedCategory, // Only run when we have a selected category
  });

  useEffect(() => {
    console.log('Categories query state:', {
      isPending: categoriesQuery.isPending,
      isError: categoriesQuery.isError,
      data: categoriesQuery.data,
      dataLength: categoriesQuery.data?.length,
    });

    if (!categoriesQuery.data) return;

    // PERFORMANCE FIX: Only store basic category info, no channels
    const mapped: CategorySection[] = categoriesQuery.data.map((c) => ({
      categoryId: c.categoryId,
      title: c.name,
      items: [], // No items initially - will be loaded separately
    }));

    console.log('Mapped categories:', mapped.length);

    // Simple category sorting by name
    const sortedMapped = mapped.sort((a, b) => a.title.localeCompare(b.title));

    setCategories(sortedMapped);
    if (mapped.length > 0 && !selectedCategory) {
      // Auto-select first category
      setSelectedCategory(mapped[0]);
    }
  }, [categoriesQuery.data]);

  // Split categories into favorited and non-favorited
  const { favoritedCategories, otherCategories } = useMemo(() => {
    const favorited = categories.filter(
      (cat) => cat.categoryId && isFavorite(cat.categoryId)
    );

    const others = categories.filter(
      (cat) => !cat.categoryId || !isFavorite(cat.categoryId)
    );

    return { favoritedCategories: favorited, otherCategories: others };
  }, [categories, isFavorite]);

  // Get source ID and channel IDs for EPG fetching
  const selectedSourceId = useMemo(() => {
    if (
      !selectedCategoryChannelsQuery.data ||
      selectedCategoryChannelsQuery.data.length === 0 ||
      !selectedCategory
    )
      return undefined;
    // Find the selected category from all loaded categories
    const selectedCategoryData = selectedCategoryChannelsQuery.data.find(
      (cat) => cat.categoryId === selectedCategory.categoryId
    );
    const sourceId = selectedCategoryData?.items[0]?.sourceId;
    console.log('Selected Source ID:', sourceId);
    return sourceId;
  }, [selectedCategoryChannelsQuery.data, selectedCategory]);

  // Use simple virtualized EPG fetching - only fetch visible channels from processed channels
  const channelsForEpg = useMemo(() => {
    if (
      !selectedCategoryChannelsQuery.data ||
      selectedCategoryChannelsQuery.data.length === 0 ||
      !selectedCategory
    )
      return [];
    // Find the selected category from all loaded categories
    const selectedCategoryData = selectedCategoryChannelsQuery.data.find(
      (cat) => cat.categoryId === selectedCategory.categoryId
    );
    return selectedCategoryData?.items || [];
  }, [selectedCategoryChannelsQuery.data, selectedCategory]);

  const epgQuery = useSimpleVirtualizedEpg(
    selectedSourceId,
    channelsForEpg,
    visibleChannelRange
  );

  // State to track processed channels for the selected category
  const [processedChannels, setProcessedChannels] = useState<Channel[]>([]);

  // Process channels when selected category's channel data is loaded
  useEffect(() => {
    if (
      !selectedCategoryChannelsQuery.data ||
      selectedCategoryChannelsQuery.data.length === 0 ||
      !selectedCategory
    ) {
      setProcessedChannels([]);
      return;
    }

    // Find the selected category from all loaded categories
    const categoryData = selectedCategoryChannelsQuery.data.find(
      (cat) => cat.categoryId === selectedCategory.categoryId
    );
    if (!categoryData) return;

    console.time(
      `Processing ${categoryData.items.length} channels for category: ${categoryData.name}`
    );

    // LOG ALL CHANNELS FOUND FROM DATABASE FOR THIS CATEGORY
    console.log(
      `=== ALL CHANNELS FROM DB FOR CATEGORY: ${categoryData.name} ===`
    );
    console.log(`Total channels found in DB: ${categoryData.items.length}`);
    categoryData.items.forEach((item, index) => {
      console.log(
        `${index + 1}. ${item.title} (ID: ${item.id}, Source: ${item.sourceId}/${item.sourceItemId})`
      );
    });
    console.log(`=== END CHANNEL LIST FOR: ${categoryData.name} ===`);

    // Apply expensive channel sorting/clustering logic here
    const sortedItems = sortChannelsWithClustering(
      categoryData.items,
      (id: string) => isFavorite(id)
    );

    const channels = sortedItems.map((item) => ({
      uuid: item.id,
      type: 'live',
      title: item.title,
      logo: item.imageUrl || undefined,
      streamId: item.sourceItemId,
    }));

    setProcessedChannels(channels);
    console.timeEnd(
      `Processing ${categoryData.items.length} channels for category: ${categoryData.name}`
    );
  }, [selectedCategoryChannelsQuery.data, selectedCategory]);

  // Create a stable reference to the current favorite state
  const currentFavoritesRef = useRef<Set<string>>(new Set());

  // Re-process channels when favorites actually change
  useEffect(() => {
    if (
      !selectedCategoryChannelsQuery.data ||
      selectedCategoryChannelsQuery.data.length === 0 ||
      !selectedCategory
    )
      return;

    // Find the selected category from all loaded categories
    const categoryData = selectedCategoryChannelsQuery.data.find(
      (cat) => cat.categoryId === selectedCategory.categoryId
    );
    if (!categoryData) return;

    // Get current favorites for this category's channels
    const newFavorites = new Set(
      categoryData.items
        .filter((item) => isFavorite(item.id))
        .map((item) => item.id)
    );

    // Check if favorites actually changed
    const oldFavorites = currentFavoritesRef.current;
    const favoritesChanged =
      newFavorites.size !== oldFavorites.size ||
      [...newFavorites].some((id) => !oldFavorites.has(id)) ||
      [...oldFavorites].some((id) => !newFavorites.has(id));

    if (favoritesChanged || currentFavoritesRef.current.size === 0) {
      console.log('Re-processing channels due to favorite change');
      currentFavoritesRef.current = newFavorites;

      // Re-apply sorting
      const sortedItems = sortChannelsWithClustering(
        categoryData.items,
        (id: string) => isFavorite(id)
      );

      const channels = sortedItems.map((item) => ({
        uuid: item.id,
        type: 'live',
        title: item.title,
        logo: item.imageUrl || undefined,
        streamId: item.sourceItemId,
      }));

      setProcessedChannels(channels);
    }
  }, [selectedCategoryChannelsQuery.data, selectedCategory, categories]); // categories will change when favorites change

  // Use processed channels for EPG viewer
  const epgChannels = useMemo<Channel[]>(() => {
    return processedChannels;
  }, [processedChannels]);

  const epgPrograms = useMemo<Program[]>(() => {
    // Use the programs from virtualized EPG (now includes placeholders)
    return epgQuery.programs;
  }, [epgQuery.programs, epgQuery.fetchedCount, epgQuery.totalCount]);

  // Call useEpg at the top level, not conditionally
  const epgProps = useEpg({
    channels: epgChannels,
    epg: epgPrograms,
    width: typeof window !== 'undefined' ? window.innerWidth - 280 : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight - 160 : 600, // Account for TopNav and bottom info panel
    sidebarWidth: 160, // Doubled from 80
    itemHeight: 200, // Doubled from default 100
    dayWidth: 14400, // Doubled from default 7200 (pixels per day)
    isSidebar: true,
    isTimeline: true,
    isLine: true,
    variant: 'modern-grid', // Modern Netflix-style EPG with grab/drag
  });

  const handleChannelClick = (channel: Channel) => {
    // Disabled navigation - stay on EPG page
    console.log('Channel clicked:', channel.title);
  };

  const handleProgramClick = useCallback(
    async (program: Program) => {
      // Start background video player for this program
      const channel = epgChannels.find((ch) => ch.uuid === program.channelUuid);
      if (channel) {
        try {
          console.log('Starting background video for program:', {
            channel: channel.title,
            program: program.title,
            streamId: channel.streamId,
          });

          const sourceId = selectedSourceId;
          const channelId = channel.streamId;

          if (sourceId && channelId) {
            // Get credentials and construct stream URL
            const creds = await getCredentials(sourceId, {
              title: 'Watch TV',
              message: 'Starting background video...',
            });

            const { streamingUrl } = constructStreamUrl({
              server: creds.server,
              username: creds.username,
              password: creds.password,
              contentId: channelId,
              contentType: 'live',
              containerExtension: creds.containerExtension,
              videoCodec: creds.videoCodec,
              audioCodec: creds.audioCodec,
            });

            setBackgroundVideo({
              channel,
              program,
              streamUrl: streamingUrl,
            });
          }
        } catch (e) {
          console.error('Failed to start background video:', e);
        }
      }
    },
    [epgChannels, selectedSourceId, getCredentials]
  );

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

  // Show loading skeleton while categories are loading
  if (
    categoriesQuery.isPending ||
    (!categoriesQuery.data && !categoriesQuery.isError)
  ) {
    return <EpgLoadingSkeleton />;
  }

  // Show error state
  if (categoriesQuery.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <View className="items-center space-y-4 p-6">
          <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Failed to load categories
          </Text>
          <Text className="text-center text-neutral-600 dark:text-neutral-400">
            There was an error loading your TV categories. Please try again.
          </Text>
          <Pressable
            onPress={() => categoriesQuery.refetch()}
            className="rounded-lg bg-blue-500 px-6 py-3"
          >
            <Text className="font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="relative flex-1"
      style={{
        height: typeof window !== 'undefined' ? window.innerHeight : '100%',
        paddingTop: 80, // Account for TopNav space
      }}
    >
      {/* Background Video */}
      {backgroundVideo && (
        <View
          className="absolute inset-0 z-0"
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <PlainPlayer
            key={`${backgroundVideo.channel.uuid}-${backgroundVideo.program.id}`}
            url={backgroundVideo.streamUrl}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />

          {/* Close button */}
          <Pressable
            onPress={() => setBackgroundVideo(null)}
            className="absolute right-4 top-4 z-50 rounded-full bg-black/60 p-2"
          >
            <Text className="text-lg text-white">✕</Text>
          </Pressable>
        </View>
      )}
      <View className="flex-1 flex-row" style={{ height: '100%' }}>
        {/* Categories Sidebar */}
        <View
          className="z-20 min-w-80 shrink-0"
          style={{
            height: '100%',
            backgroundColor: backgroundVideo ? 'rgba(0,0,0,0.85)' : undefined,
          }}
        >
          <View className=" px-6 py-4">
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              Categories ({categories.length})
            </Text>
          </View>
          <ScrollView className="flex-1">
            {/* Favorited Categories Section */}
            {favoritedCategories.length > 0 && (
              <>
                <View className=" px-6 py-3 ">
                  <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                    Favorited ({favoritedCategories.length})
                  </Text>
                </View>
                {favoritedCategories.map((category) => (
                  <Pressable
                    key={category.categoryId || category.title}
                    onPress={() => {
                      console.log(
                        `Category clicked: ${category.title} (${category.items.length} channels)`
                      );
                      setSelectedCategory(category);
                      setVisibleChannelRange({ start: 0, end: 15 });
                      // Reset EPG scroll position to start from beginning
                      epgProps.onScrollReset();
                    }}
                    className={`px-6 py-4  ${
                      selectedCategory?.categoryId === category.categoryId
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`text-sm ${
                            selectedCategory?.categoryId === category.categoryId
                              ? 'font-semibold text-blue-600 dark:text-blue-400'
                              : 'text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {category.title}
                        </Text>
                        {selectedCategory?.categoryId === category.categoryId &&
                          processedChannels.length > 0 && (
                            <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                              {processedChannels.length} channels •{' '}
                              {
                                processedChannels.filter((ch) =>
                                  isFavorite(ch.uuid)
                                ).length
                              }{' '}
                              favorited
                            </Text>
                          )}
                      </View>
                      {category.categoryId && (
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
                      )}
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {/* Separator */}
            {favoritedCategories.length > 0 && otherCategories.length > 0 && (
              <View className=" px-6 py-3 dark:border-neutral-700">
                <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  All Categories ({otherCategories.length})
                </Text>
              </View>
            )}

            {/* Other Categories */}
            {otherCategories.map((category) => (
              <Pressable
                key={category.categoryId || category.title}
                onPress={() => {
                  console.log(
                    `Category clicked: ${category.title} (${category.items.length} channels)`
                  );
                  setSelectedCategory(category);
                  setVisibleChannelRange({ start: 0, end: 15 });
                  // Reset EPG scroll position to start from beginning
                  epgProps.onScrollReset();
                }}
                className={`px-6 py-4 dark:border-neutral-800 ${
                  selectedCategory?.categoryId === category.categoryId
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text
                      className={`text-sm ${
                        selectedCategory?.categoryId === category.categoryId
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {category.title}
                    </Text>
                    {selectedCategory?.categoryId === category.categoryId &&
                      processedChannels.length > 0 && (
                        <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                          {processedChannels.length} channels
                        </Text>
                      )}
                  </View>
                  {category.categoryId && (
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
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* EPG Viewer */}
        <View
          className="z-20 flex-1 flex-col"
          style={{
            height: '100%',
            backgroundColor: backgroundVideo ? 'rgba(0,0,0,0.4)' : undefined,
          }}
        >
          {selectedCategory ? (
            <View className="flex-1 flex-col" style={{ height: '100%' }}>
              {/* EPG Grid - Takes most of the space */}
              <View className="flex-1" style={{ minHeight: 0 }}>
                {epgChannels.length > 0 && (
                  <View className="flex-1 flex-col" style={{ height: '100%' }}>
                    {/* Control buttons at top */}
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

                    {/* EPG Grid */}
                    <View className="flex-1" style={{ minHeight: 0 }}>
                      <Epg {...epgProps.getEpgProps()}>
                        <Layout
                          {...epgProps.getLayoutProps()}
                          onVisibleChannelsChange={handleVisibleChannelsChange}
                          onProgramClick={handleProgramClick}
                          renderChannel={({ channel }) => (
                            <Pressable
                              onPress={() => {
                                handleChannelClick(channel);
                              }}
                              className="relative flex items-center justify-center border-white/10 bg-black/20 backdrop-blur-sm"
                              style={{ height: '100%', cursor: 'pointer' }}
                            >
                              {channel.logo ? (
                                <img
                                  src={channel.logo}
                                  alt={channel.title}
                                  className="size-20 object-contain"
                                />
                              ) : (
                                <Text
                                  className="px-2 text-center text-[20px] font-medium text-white"
                                  numberOfLines={3}
                                  style={{ maxWidth: 140 }}
                                >
                                  {channel.title || ''}
                                </Text>
                              )}
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(channel.uuid, 'channel');
                                }}
                                className="absolute right-2 top-2 rounded-full p-1 hover:bg-white/20"
                                style={{ zIndex: 10 }}
                              >
                                <Heart
                                  filled={isFavorite(channel.uuid)}
                                  color={
                                    isFavorite(channel.uuid)
                                      ? '#ef4444'
                                      : '#9ca3af'
                                  }
                                  size={24}
                                />
                              </Pressable>
                            </Pressable>
                          )}
                          renderProgram={({ program }) => {
                            // The modern-grid variant handles its own rendering
                            // This fallback is for other variants
                            if (
                              epgProps.getLayoutProps().variant ===
                              'modern-grid'
                            ) {
                              return null;
                            }

                            // Original render logic for other variants
                            const isAiring = (() => {
                              const now = new Date().getTime();
                              const start = new Date(program.since).getTime();
                              const end = new Date(program.till).getTime();
                              return now >= start && now <= end;
                            })();

                            const isPlaceholder = program.title === '';

                            return (
                              <ProgramItem
                                program={program}
                                isAiring={isAiring}
                                isPlaceholder={isPlaceholder}
                                onPress={handleProgramClick}
                              />
                            );
                          }}
                        />
                      </Epg>
                    </View>
                  </View>
                )}
              </View>

              {/* Bottom Information Panel */}
              <View className="border-t border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-black">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
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
                    {selectedCategoryChannelsQuery.isLoading && (
                      <Text className="text-xs text-blue-600 dark:text-blue-400">
                        Loading channels...
                      </Text>
                    )}
                    {processedChannels.length > 0 && (
                      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                        {epgQuery.fetchedCount}/{epgQuery.totalCount} EPG loaded
                      </Text>
                    )}
                    {epgQuery.isLoading && (
                      <Text className="text-xs text-blue-600 dark:text-blue-400">
                        Loading EPG data...
                      </Text>
                    )}
                    {epgQuery.isError && (
                      <Text className="text-xs text-red-600 dark:text-red-400">
                        Error loading EPG data
                      </Text>
                    )}
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
              </View>
            </View>
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
