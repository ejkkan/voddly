import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions } from 'react-native';

import { CastCarousel } from '@/components/media/CastCarousel';
import { ImageGallery } from '@/components/media/ImageGallery';
import { PlaylistModal } from '@/components/media/PlaylistModal';
import { RatingsDisplay } from '@/components/media/RatingsDisplay';
import { VideoGallery } from '@/components/media/VideoGallery';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { ArrowLeft, ArrowRight, Heart, Playlist } from '@/components/ui/icons';
import { useFavoriteManager } from '@/hooks/ui/useFavoriteManager';
import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';
import {
  type EnrichedMetadata,
  extractDisplayMetadata,
  useMovieMetadata,
} from '@/hooks/use-content-metadata';
import { useFetchRemoteMovie } from '@/hooks/useFetchRemoteMovie';
import { useSourceBaseUrl } from '@/hooks/useSourceInfo';
import { openDb } from '@/lib/db';
import { useSourceCredentials } from '@/lib/source-credentials';
import { normalizeImageUrl } from '@/lib/url-utils';

type ItemRow = {
  id: string;
  source_id: string;
  source_item_id: string;
  type: string;
  title: string;
  description?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  release_date?: string | null;
  rating?: number | null;
  rating_5based?: number | null;
  tmdb_id?: string | null;
  original_payload_json?: string | null;
};

export default function MovieDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tmdbId, setTmdbId] = useState<string | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [currentBackdropIndex, setCurrentBackdropIndex] = useState(0);
  const { prepareContentPlayback } = useSourceCredentials();
  const { fetchRemote, isFetching, error: fetchError } = useFetchRemoteMovie();
  const sourceBase = useSourceBaseUrl(item?.source_id);
  const { isFavorite, toggleFavorite } = useFavoriteManager();
  const { isInAnyPlaylist } = usePlaylistManager();

  // Use the new metadata hook - pass both tmdbId and title
  const { data: metadata, isLoading: metadataLoading } = useMovieMetadata(
    tmdbId || undefined,
    item?.title, // Pass the item title for enrichment when TMDB ID is not available
    {
      enabled: !!(tmdbId || item?.title), // Enable if we have either TMDB ID or title
      appendToResponse: 'videos,images,credits,external_ids',
    }
  );

  // Extract display-ready metadata
  const displayData = useMemo(
    () => extractDisplayMetadata(metadata),
    [metadata]
  );

  const { width: screenWidth } = Dimensions.get('window');
  const isTablet = screenWidth >= 768;

  const normalizedBackdrop = useMemo(() => {
    if (!item) return null;
    const base = sourceBase.baseUrl as string | undefined;
    return normalizeImageUrl(
      item.backdrop_url || item.poster_url || null,
      base
    );
  }, [item, sourceBase.baseUrl]);

  const normalizedPoster = useMemo(() => {
    if (!item) return null;
    const base = sourceBase.baseUrl as string | undefined;
    return normalizeImageUrl(item.poster_url || null, base);
  }, [item, sourceBase.baseUrl]);

  // Prepare backdrop images for carousel
  const backdropImages = useMemo(() => {
    const images: string[] = [];

    // Add backdrop from metadata
    if (displayData?.backdropUrl) {
      images.push(displayData.backdropUrl);
    }

    // Add additional backdrops from images
    if (metadata?.images?.backdrops) {
      metadata.images.backdrops.slice(0, 5).forEach((backdrop: any) => {
        const url = `https://image.tmdb.org/t/p/original${backdrop.file_path}`;
        if (!images.includes(url)) {
          images.push(url);
        }
      });
    }

    // Fallback to normalized backdrop
    if (images.length === 0 && normalizedBackdrop) {
      images.push(normalizedBackdrop);
    }

    return images;
  }, [displayData?.backdropUrl, metadata?.images, normalizedBackdrop]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        if (!id) {
          if (mounted) setLoading(false);
          return;
        }
        const db = await openDb();
        const row = await db.getFirstAsync<ItemRow>(
          `SELECT i.* FROM content_items i WHERE i.id = $id`,
          { $id: String(id) }
        );
        if (mounted) setItem(row ?? null);
        if (mounted) setLoading(false);
        if (row) {
          // Extract TMDB ID from row data
          try {
            const fromCol = String((row as any)?.tmdb_id || '').trim();
            const fromPayload = (() => {
              try {
                const raw = row?.original_payload_json
                  ? JSON.parse(String(row.original_payload_json))
                  : null;
                const info = raw?.info || {};
                return String(info?.tmdb_id ?? info?.tmdb ?? '').trim();
              } catch {
                return '';
              }
            })();
            const tmdb = fromCol || fromPayload;
            if (tmdb && mounted) {
              setTmdbId(tmdb);
            }
          } catch {}
          fetchRemote({
            id: row.id,
            sourceId: row.source_id,
            sourceItemId: row.source_item_id,
          }).then(async (ok) => {
            try {
              if (!ok || !mounted) return;
              const db2 = await openDb();
              const updated = await db2.getFirstAsync<ItemRow>(
                `SELECT i.* FROM content_items i WHERE i.id = $id`,
                { $id: String(row.id) }
              );
              if (mounted) setItem(updated ?? row);
              // After background update, check if tmdb_id became available
              try {
                const tmdbPost = String((updated as any)?.tmdb_id || '').trim();
                if (tmdbPost && mounted && tmdbPost !== tmdbId) {
                  setTmdbId(tmdbPost);
                }
              } catch {}
            } catch {
              // ignore refresh errors
            }
          });
        }
      } finally {
        // done
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handlePlay = async () => {
    try {
      if (!item) return;
      const sourceId = item.source_id;
      const movieId = item.source_item_id;
      console.log('[MovieDetails] handlePlay called with:', {
        sourceId,
        movieId,
      });

      await prepareContentPlayback({
        sourceId,
        contentId: movieId,
        contentType: 'movie',
        options: {
          title: 'Play Movie',
          message: 'Enter your passphrase to play the movie',
        },
      });

      console.log(
        '[MovieDetails] prepareContentPlayback succeeded, navigating to player'
      );
      router.push({
        pathname: '/(app)/player',
        params: {
          playlist: sourceId,
          movie: String(movieId),
          tmdb_id: tmdbId || undefined,
          title: item.title || undefined,
        },
      });
    } catch (e) {
      console.error('[MovieDetails] handlePlay error:', e);
      setError(e instanceof Error ? e.message : 'Failed to prepare playback');
    }
  };

  return (
    <View className="flex-1">
      {/* Static Background */}
      <View className="absolute inset-0">
        {backdropImages.length > 0 ? (
          <Image
            source={{ uri: backdropImages[currentBackdropIndex] }}
            contentFit="cover"
            className="size-full"
          />
        ) : (
          <View className="size-full bg-neutral-900" />
        )}
        {/* Dark overlay */}
        <View className="absolute inset-0 bg-black/40" />
      </View>
      
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {loading ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="white" />
              <Text className="mt-4 text-white/80">
                Loading movie details...
              </Text>
            </View>
          ) : !item ? (
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-xl text-white">
                Movie not found
              </Text>
              <Pressable
                className="mt-4 rounded-lg bg-white/20 px-6 py-3 backdrop-blur-sm"
                onPress={() => router.back()}
              >
                <Text className="text-white">Go Back</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-1">
              {/* Top Navigation */}
              <View className="absolute left-4 top-4 z-20">
                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20"
                  onPress={() => router.back()}
                >
                  <ArrowLeft size={20} color="white" />
                </Pressable>
              </View>
              
              {/* Carousel Navigation - Top Right */}
              {backdropImages.length > 1 && (
                <View className="absolute right-4 top-4 z-20 flex-row gap-2">
                  <Pressable
                    className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20"
                    onPress={() => {
                      const newIndex = currentBackdropIndex === 0 
                        ? backdropImages.length - 1 
                        : currentBackdropIndex - 1;
                      setCurrentBackdropIndex(newIndex);
                    }}
                  >
                    <ArrowLeft size={18} color="white" />
                  </Pressable>
                  
                  <Pressable
                    className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20"
                    onPress={() => {
                      const newIndex = (currentBackdropIndex + 1) % backdropImages.length;
                      setCurrentBackdropIndex(newIndex);
                    }}
                  >
                    <ArrowRight size={18} color="white" />
                  </Pressable>
                </View>
              )}
              
              {/* Main Content Area */}
              <View className="flex-1 px-6 pt-20">
                {/* Title Section */}
                <View className="mb-8">
                  <Text className="text-6xl font-bold text-white mb-4" style={{ fontFamily: isTablet ? 'System' : undefined }}>
                    {(displayData?.title || item.title)?.toUpperCase()}
                  </Text>
                  
                  {/* Meta Tags Row */}
                  <View className="flex-row flex-wrap gap-3 mb-6">
                    {(displayData?.releaseDate || item.release_date) && (
                      <View className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-md border border-white/20">
                        <Text className="text-white font-medium">
                          {String(displayData?.releaseDate || item.release_date).slice(0, 4)}
                        </Text>
                      </View>
                    )}
                    {displayData?.runtime && (
                      <View className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-md border border-white/20">
                        <Text className="text-white font-medium">
                          {Math.floor(displayData.runtime / 60)}h {displayData.runtime % 60}m
                        </Text>
                      </View>
                    )}
                    <View className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-md border border-white/20">
                      <Text className="text-white font-medium">HD</Text>
                    </View>
                    {displayData?.genres && displayData.genres.slice(0, 3).map((genre) => (
                      <View key={genre.id} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-md border border-white/20">
                        <Text className="text-white font-medium">{genre.name}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Description */}
                  {(displayData?.overview || item.description) && (
                    <Text className="text-white/90 text-lg leading-relaxed mb-8 max-w-3xl">
                      {(displayData?.overview || item.description)?.slice(0, 200)}...
                    </Text>
                  )}
                  
                  {/* Action Buttons */}
                  <View className="flex-row gap-4 mb-8">
                    {/* Play Button */}
                    <Pressable
                      className="flex-row items-center rounded-2xl bg-blue-600/90 px-8 py-4 backdrop-blur-md"
                      onPress={handlePlay}
                    >
                      <Text className="mr-3 text-xl text-white">▶</Text>
                      <Text className="text-lg font-semibold text-white">Play Movie</Text>
                    </Pressable>
                    
                    {/* Secondary Buttons */}
                    <Pressable
                      className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20"
                      onPress={() => item && toggleFavorite(item.id, 'movie')}
                    >
                      <Heart 
                        filled={item ? isFavorite(item.id) : false} 
                        color={item && isFavorite(item.id) ? "#EF4444" : "white"}
                        size={24} 
                      />
                    </Pressable>
                    
                    <Pressable
                      className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20"
                      onPress={() => setShowPlaylistModal(true)}
                    >
                      <Playlist color="white" size={24} />
                    </Pressable>
                    
                    <Pressable
                      className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20"
                      onPress={async () => {
                        if (!item) return;
                        const ok = await fetchRemote({
                          id: item.id,
                          sourceId: item.source_id,
                          sourceItemId: item.source_item_id,
                        });
                        if (ok) {
                          const db = await openDb();
                          const row = await db.getFirstAsync<ItemRow>(
                            `SELECT * FROM content_items WHERE id = $id`,
                            { $id: String(item.id) }
                          );
                          setItem(row ?? null);
                        }
                      }}
                    >
                      <Text className="text-white text-lg">
                        {isFetching ? '⟳' : '🔄'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Grid Layout for Content */}
                <View className="gap-4">
                  {/* Error messages */}
                  {(error || fetchError) && (
                    <View className="rounded-2xl bg-red-500/15 p-4 backdrop-blur-md border border-red-500/30">
                      <Text className="text-red-200 text-center font-medium">
                        {error || fetchError}
                      </Text>
                    </View>
                  )}

                  {/* Info Grid */}
                  <View className="flex-row gap-4">
                    {/* Ratings Card */}
                    <View className="flex-1 rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/20">
                      <Text className="text-white/70 text-sm font-medium mb-2 uppercase tracking-wide">
                        Ratings
                      </Text>
                      <RatingsDisplay
                        tmdbRating={
                          typeof metadata?.vote_average === 'number'
                            ? metadata.vote_average
                            : undefined
                        }
                        tmdbVotes={
                          typeof metadata?.vote_count === 'number'
                            ? metadata.vote_count
                            : undefined
                        }
                        imdbRating={
                          typeof (metadata as EnrichedMetadata)?.enrichment
                            ?.imdb_rating === 'number'
                            ? (metadata as EnrichedMetadata)?.enrichment?.imdb_rating
                            : undefined
                        }
                        imdbVotes={
                          typeof (metadata as EnrichedMetadata)?.enrichment
                            ?.imdb_votes === 'number'
                            ? (metadata as EnrichedMetadata)?.enrichment?.imdb_votes
                            : undefined
                        }
                        rottenTomatoesRating={
                          typeof (metadata as EnrichedMetadata)?.enrichment
                            ?.rotten_tomatoes_rating === 'number'
                            ? (metadata as EnrichedMetadata)?.enrichment
                                ?.rotten_tomatoes_rating
                            : undefined
                        }
                        metacriticRating={
                          typeof (metadata as EnrichedMetadata)?.enrichment
                            ?.metacritic_rating === 'number'
                            ? (metadata as EnrichedMetadata)?.enrichment
                                ?.metacritic_rating
                            : undefined
                        }
                        traktRating={
                          typeof (metadata as EnrichedMetadata)?.enrichment
                            ?.trakt_rating === 'number'
                            ? (metadata as EnrichedMetadata)?.enrichment?.trakt_rating
                            : undefined
                        }
                        traktVotes={
                          typeof (metadata as EnrichedMetadata)?.enrichment
                            ?.trakt_votes === 'number'
                            ? (metadata as EnrichedMetadata)?.enrichment?.trakt_votes
                            : undefined
                        }
                        localRating={
                          typeof item.rating_5based === 'number'
                            ? item.rating_5based
                            : undefined
                        }
                      />
                    </View>
                    
                    {/* Production Details Card */}
                    {(displayData?.budget || displayData?.revenue) && (
                      <View className="flex-1 rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/20">
                        <Text className="text-white/70 text-sm font-medium mb-3 uppercase tracking-wide">
                          Production
                        </Text>
                        {displayData?.budget && (
                          <View className="mb-2">
                            <Text className="text-white/70 text-xs">Budget</Text>
                            <Text className="text-white font-semibold">
                              ${(displayData.budget / 1000000).toFixed(0)}M
                            </Text>
                          </View>
                        )}
                        {displayData?.revenue && (
                          <View>
                            <Text className="text-white/70 text-xs">Revenue</Text>
                            <Text className="text-white font-semibold">
                              ${(displayData.revenue / 1000000).toFixed(0)}M
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  
                  {/* Cast Section */}
                  {metadata?.credits?.cast && (
                    <View className="rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/20">
                      <Text className="text-white/70 text-sm font-medium mb-4 uppercase tracking-wide">
                        Cast
                      </Text>
                      <CastCarousel cast={metadata.credits.cast} />
                    </View>
                  )}

                  {/* Videos Section */}
                  {(metadata?.videos?.results || (metadata as EnrichedMetadata)?.enrichment?.trailer_url) && (
                    <View className="rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/20">
                      <Text className="text-white/70 text-sm font-medium mb-4 uppercase tracking-wide">
                        Videos
                      </Text>
                      <VideoGallery
                        videos={metadata?.videos?.results}
                        trailerUrl={
                          (metadata as EnrichedMetadata)?.enrichment?.trailer_url
                        }
                      />
                    </View>
                  )}

                  {/* Images Gallery */}
                  {(metadata?.images?.posters || metadata?.images?.backdrops) && (
                    <View className="rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/20">
                      <Text className="text-white/70 text-sm font-medium mb-4 uppercase tracking-wide">
                        Gallery
                      </Text>
                      <ImageGallery
                        posters={metadata?.images?.posters}
                        backdrops={metadata?.images?.backdrops}
                      />
                    </View>
                  )}
                  
                  {/* Loading State */}
                  {metadataLoading && (
                    <View className="rounded-2xl bg-white/10 p-6 backdrop-blur-md border border-white/20">
                      <View className="flex-row items-center justify-center">
                        <ActivityIndicator size="small" color="white" />
                        <Text className="ml-3 text-white/80 font-medium">
                          Loading metadata...
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
              
              
              {/* Playlist Modal */}
              {item && (
                <PlaylistModal
                  visible={showPlaylistModal}
                  onClose={() => setShowPlaylistModal(false)}
                  contentId={item.id}
                  contentType="movie"
                  contentTitle={displayData?.title || item.title}
                />
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}