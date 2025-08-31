import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';

import { PosterCard } from '@/components/media/poster-card';
import {
  ActivityIndicator,
  Input,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Playlist, Plus, Trash2 } from '@/components/ui/icons';
import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';
import { openDb } from '@/lib/db';

type PlaylistItem = {
  id: string;
  name: string;
  created_at: string;
  items: string[];
};

type ContentItem = {
  id: string;
  type: 'movie' | 'series' | 'live';
  title: string;
  imageUrl?: string | null;
};

// Helper to resolve content items from IDs
function useResolveContentItems(contentIds: string[]) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (contentIds.length === 0) {
        if (mounted) setItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const db = await openDb();
        const placeholders = contentIds.map(() => '?').join(',');
        const rows = await db.getAllAsync<any>(
          `SELECT id, title, poster_url, backdrop_url, type
           FROM content_items
           WHERE id IN (${placeholders})
           ORDER BY title ASC`,
          contentIds
        );

        if (!mounted) return;

        setItems(
          rows.map((r: any) => ({
            id: r.id,
            type: r.type === 'live' ? 'live' : r.type,
            title: r.title,
            imageUrl: r.poster_url || r.backdrop_url || null,
          }))
        );
      } catch (e) {
        console.warn('Failed to resolve content items', e);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [contentIds.join(',')]);

  return { items, isLoading };
}

function PlaylistCard({
  playlist,
  onPress,
  onDelete,
}: {
  playlist: PlaylistItem;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { items: contentItems, isLoading } = useResolveContentItems(
    playlist.items.slice(0, 4)
  );

  return (
    <Pressable
      onPress={onPress}
      className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-900"
    >
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="mr-3 rounded-full bg-blue-100 p-2 dark:bg-blue-900">
            <Playlist color="#3b82f6" size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {playlist.name}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {playlist.items.length}{' '}
              {playlist.items.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Trash2 color="#ef4444" size={18} />
        </Pressable>
      </View>

      {/* Preview of playlist items */}
      {isLoading ? (
        <View className="h-20 items-center justify-center">
          <ActivityIndicator size="small" />
        </View>
      ) : contentItems.length > 0 ? (
        <View className="flex-row">
          {contentItems.slice(0, 4).map((item, index) => (
            <View key={item.id} className="mr-2 flex-1">
              <View className="relative overflow-hidden rounded-lg">
                {item.imageUrl ? (
                  <View className="h-20 w-full bg-neutral-200 dark:bg-neutral-800">
                    <Text className="p-2 text-xs text-neutral-600 dark:text-neutral-400">
                      {item.title}
                    </Text>
                  </View>
                ) : (
                  <View className="h-20 w-full items-center justify-center bg-neutral-200 dark:bg-neutral-800">
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                      No image
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
          {playlist.items.length > 4 && (
            <View className="mr-2 flex-1">
              <View className="h-20 w-full items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  +{playlist.items.length - 4} more
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View className="h-20 items-center justify-center rounded-lg bg-neutral-50 dark:bg-neutral-800">
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            Empty playlist
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function CreatePlaylistButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-4 items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <View className="mb-2 rounded-full bg-blue-100 p-3 dark:bg-blue-900">
        <Plus color="#3b82f6" size={24} />
      </View>
      <Text className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
        Create New Playlist
      </Text>
      <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Organize your favorite content
      </Text>
    </Pressable>
  );
}

export default function PlaylistsPage() {
  const router = useRouter();
  const { playlists, isLoading, createPlaylist, deletePlaylist } =
    usePlaylistManager();

  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      await createPlaylist.mutateAsync(newPlaylistName.trim());
      setNewPlaylistName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    try {
      await deletePlaylist.mutateAsync(playlistId);
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  };

  const handleOpenPlaylist = (playlist: PlaylistItem) => {
    router.push(`/(app)/playlists/${encodeURIComponent(playlist.id)}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-neutral-600 dark:text-neutral-400">
            Loading playlists...
          </Text>
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
        <View className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            My Playlists
          </Text>
          <Text className="mt-1 text-neutral-600 dark:text-neutral-400">
            {playlists.length}{' '}
            {playlists.length === 1 ? 'playlist' : 'playlists'}
          </Text>
        </View>

        <View className="p-6">
          {/* Create new playlist button */}
          <CreatePlaylistButton onPress={() => setIsCreating(true)} />

          {/* Create playlist form */}
          {isCreating && (
            <View className="mb-6 rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-900">
              <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Create New Playlist
              </Text>
              <Input
                label="Playlist Name"
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="Enter playlist name"
                autoFocus
              />
              <View className="flex-row justify-end space-x-3">
                <Pressable
                  onPress={() => {
                    setIsCreating(false);
                    setNewPlaylistName('');
                  }}
                  className="rounded-lg px-4 py-2"
                >
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || createPlaylist.isPending}
                  className={`rounded-lg px-4 py-2 ${
                    newPlaylistName.trim() && !createPlaylist.isPending
                      ? 'bg-blue-600'
                      : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      newPlaylistName.trim() && !createPlaylist.isPending
                        ? 'text-white'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {createPlaylist.isPending ? 'Creating...' : 'Create'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Playlists list */}
          {playlists.length === 0 ? (
            <View className="items-center py-12">
              <View className="mb-4 rounded-full bg-neutral-100 p-4 dark:bg-neutral-800">
                <Playlist color="#6b7280" size={32} />
              </View>
              <Text className="mb-2 text-lg font-medium text-neutral-900 dark:text-neutral-50">
                No playlists yet
              </Text>
              <Text className="text-center text-neutral-600 dark:text-neutral-400">
                Create your first playlist to organize your favorite content
              </Text>
            </View>
          ) : (
            playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onPress={() => handleOpenPlaylist(playlist)}
                onDelete={() => handleDeletePlaylist(playlist.id)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
