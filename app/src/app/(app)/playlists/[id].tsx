import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';

import { PosterCard } from '@/components/media/poster-card';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { ArrowLeft, Trash2 } from '@/components/ui/icons';
import { useFavoriteManager } from '@/hooks/ui';
import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';
import { openDb } from '@/lib/db';
import { useSourceCredentials } from '@/lib/source-credentials';

type ContentItem = {
  id: string;
  type: 'movie' | 'series' | 'live';
  title: string;
  imageUrl?: string | null;
};

type EpisodeItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
  sourceId: string;
  streamId: string;
};

// Helper to resolve content items from IDs
function useResolveContentItems(contentIds: string[]) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (contentIds.length === 0) {
        if (mounted) {
          setItems([]);
          setEpisodes([]);
        }
        return;
      }

      setIsLoading(true);
      try {
        const db = await openDb();

        // First, try to get regular content items
        const placeholders = contentIds.map(() => '?').join(',');
        const contentRows = await db.getAllAsync<any>(
          `SELECT id, title, poster_url, backdrop_url, type
           FROM content_items
           WHERE id IN (${placeholders})
           ORDER BY title ASC`,
          contentIds
        );

        // Then check for episodes that might not be in content_items
        const episodeRows = await db.getAllAsync<any>(
          `SELECT e.id, e.series_item_id, e.season_number, e.episode_number, 
                  e.title, e.stream_id, c.title as series_title, 
                  c.poster_url, c.backdrop_url, c.source_id
           FROM episodes_ext e
           LEFT JOIN content_items c ON c.id = e.series_item_id
           WHERE e.id IN (${placeholders})
           ORDER BY e.title ASC`,
          contentIds
        );

        if (!mounted) return;

        const contentItems = contentRows.map((r: any) => ({
          id: r.id,
          type: r.type === 'live' ? 'live' : r.type,
          title: r.title,
          imageUrl: r.poster_url || r.backdrop_url || null,
        }));

        const episodeItems = episodeRows.map((e: any) => {
          const title = (
            e.title && String(e.title).trim().length > 0
              ? String(e.title)
              : `S${String(e.season_number).padStart(2, '0')}E${String(e.episode_number).padStart(2, '0')}`
          ) as string;
          const imageUrl = e.poster_url || e.backdrop_url || null;
          const sourceId = e.source_id ? String(e.source_id) : '';
          const streamId = e.stream_id
            ? String(e.stream_id)
            : `${e.series_item_id}:${e.season_number}:${e.episode_number}`;

          return {
            id: String(e.id),
            title: e.series_title ? `${e.series_title} - ${title}` : title,
            imageUrl,
            sourceId,
            streamId,
          };
        });

        setItems(contentItems);
        setEpisodes(episodeItems);
      } catch (e) {
        console.warn('Failed to resolve content items', e);
        if (mounted) {
          setItems([]);
          setEpisodes([]);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [contentIds.join(',')]);

  return { items, episodes, isLoading };
}

export default function PlaylistDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isFavorite, toggleFavorite } = useFavoriteManager();
  const { prepareContentPlayback } = useSourceCredentials();
  const {
    playlists,
    isLoading: playlistsLoading,
    deletePlaylist,
    removeFromPlaylist,
    isInAnyPlaylist,
  } = usePlaylistManager();

  const playlist = useMemo(
    () => playlists.find((p) => p.id === id),
    [playlists, id]
  );

  const {
    items: contentItems,
    episodes,
    isLoading: itemsLoading,
  } = useResolveContentItems(playlist?.items || []);

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePlaylist = async () => {
    if (!playlist) return;

    setIsDeleting(true);
    try {
      await deletePlaylist.mutateAsync(playlist.id);
      router.back();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      setIsDeleting(false);
    }
  };

  const handleRemoveFromPlaylist = async (contentId: string) => {
    if (!playlist) return;

    try {
      await removeFromPlaylist.mutateAsync({
        playlistId: playlist.id,
        contentId,
      });
    } catch (error) {
      console.error('Failed to remove from playlist:', error);
    }
  };

  const handleOpenContent = (item: ContentItem) => {
    if (item.type === 'movie') {
      router.push(`/(app)/movies/${encodeURIComponent(item.id)}`);
    } else if (item.type === 'series') {
      router.push(`/(app)/series/${encodeURIComponent(item.id)}`);
    } else {
      router.push(`/(app)/tv/${encodeURIComponent(item.id)}`);
    }
  };

  const handlePlayEpisode = async (episode: EpisodeItem) => {
    try {
      if (!episode.sourceId) return;
      await prepareContentPlayback({
        sourceId: episode.sourceId,
        contentId: episode.streamId,
        contentType: 'series',
      });
      router.push({
        pathname: '/(app)/player',
        params: {
          playlist: episode.sourceId,
          series: episode.streamId,
        },
      });
    } catch (error) {
      console.error('Failed to play episode:', error);
    }
  };

  if (playlistsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-neutral-600 dark:text-neutral-400">
            Loading playlist...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!playlist) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-neutral-900 dark:text-neutral-50">
            Playlist not found
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2"
          >
            <Text className="text-white">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header */}
        <View className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center">
              <Pressable
                onPress={() => router.back()}
                className="mr-4 rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeft color="#6b7280" size={20} />
              </Pressable>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                  {playlist.name}
                </Text>
                <Text className="mt-1 text-neutral-600 dark:text-neutral-400">
                  {playlist.items.length}{' '}
                  {playlist.items.length === 1 ? 'item' : 'items'}
                  {playlist.created_at && (
                    <Text className="text-neutral-500">
                      {' • Created '}
                      {new Date(playlist.created_at).toLocaleDateString()}
                    </Text>
                  )}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View className="flex-row space-x-2">
              <Pressable
                onPress={handleDeletePlaylist}
                disabled={isDeleting}
                className="rounded-full p-2 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 color="#ef4444" size={20} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="p-6">
          {itemsLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" />
              <Text className="mt-4 text-neutral-600 dark:text-neutral-400">
                Loading playlist items...
              </Text>
            </View>
          ) : playlist.items.length === 0 ? (
            <View className="items-center py-12">
              <Text className="mb-2 text-lg font-medium text-neutral-900 dark:text-neutral-50">
                Empty Playlist
              </Text>
              <Text className="text-center text-neutral-600 dark:text-neutral-400">
                Add items to this playlist from movies, series, or TV shows
              </Text>
            </View>
          ) : (
            <>
              {/* Regular content items */}
              {contentItems.length > 0 && (
                <View className="mb-6">
                  <Text className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                    Content
                  </Text>
                  <View className="flex-row flex-wrap">
                    {contentItems.map((item) => (
                      <View
                        key={item.id}
                        className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
                      >
                        <PosterCard
                          id={item.id}
                          title={item.title}
                          posterUrl={item.imageUrl}
                          onPress={() => handleOpenContent(item)}
                          isFavorite={isFavorite(item.id)}
                          onToggleFavorite={() =>
                            toggleFavorite(item.id, item.type)
                          }
                          isInPlaylist={isInAnyPlaylist(item.id)}
                          onLongPress={() => handleRemoveFromPlaylist(item.id)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Episodes */}
              {episodes.length > 0 && (
                <View className="mb-6">
                  <Text className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                    Episodes
                  </Text>
                  <View className="flex-row flex-wrap">
                    {episodes.map((episode) => (
                      <View
                        key={episode.id}
                        className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
                      >
                        <PosterCard
                          id={episode.id}
                          title={episode.title}
                          posterUrl={episode.imageUrl}
                          onPress={() => handlePlayEpisode(episode)}
                          isFavorite={isFavorite(episode.id)}
                          onToggleFavorite={() =>
                            toggleFavorite(episode.id, 'episode')
                          }
                          isInPlaylist={isInAnyPlaylist(episode.id)}
                          onLongPress={() =>
                            handleRemoveFromPlaylist(episode.id)
                          }
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Help text */}
              <View className="mt-8 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <Text className="text-sm text-blue-800 dark:text-blue-200">
                  <Text className="font-medium">Tip:</Text> Long press on any
                  item to remove it from this playlist
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
