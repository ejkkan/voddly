import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';

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
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { useFavoriteManager, useUiSections } from '@/hooks/ui';
import { useSimpleVirtualizedEpg } from '@/hooks/useCachedEpg';
import { useSourceCredentials } from '@/lib/source-credentials';
import { constructStreamUrl } from '@/lib/stream-url';

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
  onPress 
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
      y: event.pageY || event.clientY
    };
    isDragging.current = false;
  }, []);

  const handlePressOut = useCallback((e: any) => {
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
  }, [program, onPress]);

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
      items: c.items
        .map((i) => ({
          id: i.id,
          title: i.title,
          imageUrl: i.imageUrl ?? undefined,
          sourceId: i.sourceId ?? undefined,
          sourceItemId: i.sourceItemId ?? undefined,
        }))
        .sort((a, b) => {
          // Sort favorites first within category
          const aIsFav = isFavorite(a.id);
          const bIsFav = isFavorite(b.id);
          if (aIsFav && !bIsFav) return -1;
          if (!aIsFav && bIsFav) return 1;
          return 0;
        }),
    }));

    // Sort categories by favorites count (categories with more favorites first)
    const sortedMapped = mapped.sort((a, b) => {
      const aFavCount = a.items.filter((item) => isFavorite(item.id)).length;
      const bFavCount = b.items.filter((item) => isFavorite(item.id)).length;
      return bFavCount - aFavCount;
    });

    setCategories(sortedMapped);
    if (mapped.length > 0 && !selectedCategory) {
      console.log(
        'First category sample:',
        mapped[0]?.title,
        mapped[0]?.items.slice(0, 2)
      );
      setSelectedCategory(mapped[0]);
    }
  }, [sectionsQuery.data, selectedCategory]);

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

  // Transform data for EPG viewer - include ALL channels sorted by favorites first
  const epgChannels = useMemo<Channel[]>(() => {
    if (!selectedCategory) return [];

    return selectedCategory.items
      .sort((a, b) => {
        // Sort favorites first
        const aIsFav = isFavorite(a.id);
        const bIsFav = isFavorite(b.id);
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return 0;
      })
      .map((item) => ({
        uuid: item.id,
        type: 'live',
        title: item.title,
        logo: item.imageUrl || undefined,
        streamId: item.sourceItemId,
      }));
  }, [selectedCategory, isFavorite]);

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

  const handleProgramClick = useCallback(async (program: Program) => {
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
  }, [epgChannels, selectedSourceId, getCredentials]);

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
          <VideoPlayer
            key={`${backgroundVideo.channel.uuid}-${backgroundVideo.program.id}`}
            url={backgroundVideo.streamUrl}
            preferredPlayer="web"
            layout="netflix"
            theme="dark"
            constrainToContainer={true}
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
                      setSelectedCategory(category);
                      setVisibleChannelRange({ start: 0, end: 15 });
                    }}
                    className={`px-6 py-4  ${
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
                          {category.items.length} channels •{' '}
                          {
                            category.items.filter((item) => isFavorite(item.id))
                              .length
                          }{' '}
                          favorited
                        </Text>
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
                  setSelectedCategory(category);
                  setVisibleChannelRange({ start: 0, end: 15 });
                }}
                className={`px-6 py-4 dark:border-neutral-800 ${
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
                              className="relative flex items-center justify-center  border-white/10 bg-black/20 backdrop-blur-sm"
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
                    <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                      {epgQuery.fetchedCount}/{epgQuery.totalCount} channels
                      loaded
                    </Text>
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
