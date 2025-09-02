import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions } from 'react-native';

import { CastCarousel } from '@/components/media/CastCarousel';
import { ParallaxGallery } from '@/components/media/ParallaxGallery';
import { PlaylistModal } from '@/components/media/PlaylistModal';
import { RatingsDisplay } from '@/components/media/RatingsDisplay';
import { VideoGallery } from '@/components/media/VideoGallery';
import { ContentDebugButton } from '@/components/debug/ContentDebugButton';
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

  const { data: metadata, isLoading: metadataLoading } = useMovieMetadata(
    tmdbId || undefined,
    item?.title,
    {
      enabled: !!(tmdbId || item?.title),
      appendToResponse: 'videos,images,credits,external_ids',
    }
  );

  const displayData = useMemo(
    () => extractDisplayMetadata(metadata),
    [metadata]
  );

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
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

  const backdropImages = useMemo(() => {
    const images: string[] = [];

    if (displayData?.backdropUrl) {
      images.push(displayData.backdropUrl);
    }

    if (metadata?.images?.backdrops) {
      metadata.images.backdrops.slice(0, 5).forEach((backdrop: any) => {
        const url = `https://image.tmdb.org/t/p/original${backdrop.file_path}`;
        if (!images.includes(url)) {
          images.push(url);
        }
      });
    }

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

      await prepareContentPlayback({
        sourceId,
        contentId: movieId,
        contentType: 'movie',
        options: {
          title: 'Play Movie',
          message: 'Enter your passphrase to play the movie',
        },
      });

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

  if (loading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="white" />
        <Text className="mt-4 text-white/80">Loading movie details...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-xl text-white">Movie not found</Text>
        <Pressable
          className="mt-4 rounded-lg bg-white/20 px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Static Full Screen Background */}
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
        <View className="absolute inset-0 bg-black/60" />
        <View className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
      </View>

      {/* Fixed Navigation */}
      <SafeAreaView className="absolute left-0 right-0 top-0 z-50">
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl"
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color="white" />
          </Pressable>

          {backdropImages.length > 1 && (
            <View className="flex-row gap-2">
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl"
                onPress={() => {
                  const newIndex =
                    currentBackdropIndex === 0
                      ? backdropImages.length - 1
                      : currentBackdropIndex - 1;
                  setCurrentBackdropIndex(newIndex);
                }}
              >
                <ArrowLeft size={16} color="white" />
              </Pressable>

              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-xl"
                onPress={() => {
                  const newIndex =
                    (currentBackdropIndex + 1) % backdropImages.length;
                  setCurrentBackdropIndex(newIndex);
                }}
              >
                <ArrowRight size={16} color="white" />
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: screenHeight * 0.45 }}
      >
        <View className="px-6">
          {/* Netflix-style Layout: Left Content + Right Metadata */}
          <View className={`${isTablet ? 'flex-row gap-8' : 'flex-col'} mb-8`}>
            {/* Left Side - Main Content */}
            <View className={`${isTablet ? 'flex-1' : 'w-full'} mb-8`}>
              {/* Netflix Badge */}
              <View className="mb-4">
                <Text className="text-red-500 text-sm font-bold uppercase tracking-wider">
                  NETFLIX
                </Text>
              </View>

              {/* Title */}
              <Text className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                {displayData?.title || item.title}
              </Text>

              {/* Rating and Year */}
              <View className="flex-row items-center gap-4 mb-4">
                {metadata?.vote_average && (
                  <View className="flex-row items-center">
                    <Text className="text-green-400 text-lg font-bold">
                      ★ {((metadata.vote_average / 10) * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
                {(displayData?.releaseDate || item.release_date) && (
                  <Text className="text-white text-lg">
                    {String(
                      displayData?.releaseDate || item.release_date
                    ).slice(0, 4)}
                  </Text>
                )}
                {displayData?.runtime && (
                  <Text className="text-white text-lg">
                    {Math.floor(displayData.runtime / 60)}h{' '}
                    {displayData.runtime % 60}m
                  </Text>
                )}
              </View>

              {/* Metadata Tags */}
              <View className="flex-row items-center gap-2 mb-6 flex-wrap">
                {displayData?.genres &&
                  displayData.genres.slice(0, 3).map((genre) => (
                    <Text key={genre.id} className="text-white/80 text-sm">
                      {genre.name}
                    </Text>
                  ))}
              </View>

              {/* Description */}
              {(displayData?.overview || item.description) && (
                <Text className="text-white/90 text-base leading-relaxed mb-8 max-w-2xl">
                  {displayData?.overview || item.description}
                </Text>
              )}

              {/* Action Buttons */}
              <View className="flex-row gap-4 mb-8">
                <Pressable
                  className="flex-row items-center justify-center rounded-lg bg-white px-8 py-3 min-w-[120px]"
                  onPress={handlePlay}
                >
                  <Text className="text-black text-lg font-semibold mr-2">
                    ▶
                  </Text>
                  <Text className="text-black text-lg font-semibold">Play</Text>
                </Pressable>
                {item && (
                  <ContentDebugButton 
                    item={item}
                    contentType="movie"
                    metadata={displayData}
                  />
                )}

                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-xl border border-white/30"
                  onPress={() => setShowPlaylistModal(true)}
                >
                  <Playlist color="white" size={20} />
                </Pressable>

                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-xl border border-white/30"
                  onPress={() => item && toggleFavorite(item.id, 'movie')}
                >
                  <Heart
                    filled={item ? isFavorite(item.id) : false}
                    color={item && isFavorite(item.id) ? '#EF4444' : 'white'}
                    size={20}
                  />
                </Pressable>

                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-xl border border-white/30"
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
                  <Text className="text-white text-sm">
                    {isFetching ? '⟳' : '↓'}
                  </Text>
                </Pressable>
              </View>

              {/* Error messages */}
              {(error || fetchError) && (
                <View className="rounded-xl bg-red-500/20 backdrop-blur-xl p-4 border border-red-500/30 mb-6">
                  <Text className="text-red-200 text-center font-medium">
                    {error || fetchError}
                  </Text>
                </View>
              )}

              {/* Cast Section for Left Side */}
              {metadata?.credits?.cast && (
                <View className="mb-8">
                  <Text className="text-white text-xl font-semibold mb-4">
                    Cast
                  </Text>
                  <CastCarousel cast={metadata.credits.cast} />
                </View>
              )}
            </View>

            {/* Right Side - Bento Grid Metadata Panel */}
            <View className={`${isTablet ? 'w-80' : 'w-full'}`}>
              {/* Bento Grid Layout */}
              <View className="gap-3">
                {/* Row 1: Posters (Wide) + Cast (Square) */}
                <View className="flex-row gap-3">
                  {/* Posters Section - Wide Rectangle */}
                  <View className="flex-1 rounded-2xl bg-black/40 backdrop-blur-xl p-4 border border-white/10 h-32">
                    <Text className="text-white/60 text-xs font-medium mb-2 uppercase tracking-wide">
                      Posters
                    </Text>
                    <View className="flex-row gap-2 flex-1">
                      {normalizedPoster && (
                        <Image
                          source={{ uri: normalizedPoster }}
                          className="w-16 h-20 rounded-lg flex-shrink-0"
                          contentFit="cover"
                        />
                      )}
                      {metadata?.images?.posters
                        ?.slice(0, 2)
                        .map((poster: any, index: number) => (
                          <Image
                            key={index}
                            source={{
                              uri: `https://image.tmdb.org/t/p/w300${poster.file_path}`,
                            }}
                            className="w-16 h-20 rounded-lg flex-shrink-0"
                            contentFit="cover"
                          />
                        ))}
                    </View>
                  </View>

                  {/* Cast Grid - Square */}
                  {metadata?.credits?.cast && (
                    <View className="w-32 rounded-2xl bg-black/40 backdrop-blur-xl p-3 border border-white/10 h-32">
                      <Text className="text-white/60 text-xs font-medium mb-2 uppercase tracking-wide">
                        Cast
                      </Text>
                      <View className="flex-row flex-wrap gap-1 flex-1">
                        {metadata.credits.cast.slice(0, 4).map((actor: any) => (
                          <View key={actor.id} className="items-center w-12">
                            {actor.profile_path && (
                              <Image
                                source={{
                                  uri: `https://image.tmdb.org/t/p/w185${actor.profile_path}`,
                                }}
                                className="w-10 h-10 rounded-full mb-1"
                                contentFit="cover"
                              />
                            )}
                            <Text
                              className="text-white text-xs text-center leading-tight"
                              numberOfLines={1}
                            >
                              {actor.name.split(' ')[0]}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Row 2: Ratings (Full Width) */}
                <View className="rounded-2xl bg-black/40 backdrop-blur-xl p-4 border border-white/10">
                  <Text className="text-white/60 text-xs font-medium mb-3 uppercase tracking-wide">
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
                        ? (metadata as EnrichedMetadata)?.enrichment
                            ?.imdb_rating
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
                        ? (metadata as EnrichedMetadata)?.enrichment
                            ?.trakt_rating
                        : undefined
                    }
                    traktVotes={
                      typeof (metadata as EnrichedMetadata)?.enrichment
                        ?.trakt_votes === 'number'
                        ? (metadata as EnrichedMetadata)?.enrichment
                            ?.trakt_votes
                        : undefined
                    }
                    localRating={
                      typeof item.rating_5based === 'number'
                        ? item.rating_5based
                        : undefined
                    }
                  />
                </View>

                {/* Row 3: Release Date + Source (Two Squares) */}
                <View className="flex-row gap-3">
                  {/* Release Date - Square */}
                  {(displayData?.releaseDate || item.release_date) && (
                    <View className="flex-1 rounded-2xl bg-black/40 backdrop-blur-xl p-4 border border-white/10 h-24">
                      <Text className="text-white/60 text-xs font-medium mb-1 uppercase tracking-wide">
                        Release
                      </Text>
                      <Text className="text-white text-sm font-semibold">
                        {new Date(
                          displayData?.releaseDate || item.release_date!
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}

                  {/* Source - Square */}
                  <View className="flex-1 rounded-2xl bg-black/40 backdrop-blur-xl p-4 border border-white/10 h-24">
                    <Text className="text-white/60 text-xs font-medium mb-1 uppercase tracking-wide">
                      Source
                    </Text>
                    <Text
                      className="text-white text-sm font-semibold"
                      numberOfLines={2}
                    >
                      {item.source_id}
                    </Text>
                  </View>
                </View>

                {/* Row 4: Box Office + TMDB (Conditional) */}
                <View className="flex-row gap-3">
                  {/* Box Office - Rectangle */}
                  {(displayData?.budget || displayData?.revenue) && (
                    <View className="flex-1 rounded-2xl bg-black/40 backdrop-blur-xl p-4 border border-white/10 h-28">
                      <Text className="text-white/60 text-xs font-medium mb-2 uppercase tracking-wide">
                        Box Office
                      </Text>
                      <View className="gap-1">
                        {displayData?.budget && (
                          <View className="flex-row justify-between">
                            <Text className="text-white/70 text-xs">
                              Budget
                            </Text>
                            <Text className="text-white text-xs font-medium">
                              ${(displayData.budget / 1000000).toFixed(0)}M
                            </Text>
                          </View>
                        )}
                        {displayData?.revenue && (
                          <View className="flex-row justify-between">
                            <Text className="text-white/70 text-xs">
                              Revenue
                            </Text>
                            <Text className="text-white text-xs font-medium">
                              ${(displayData.revenue / 1000000).toFixed(0)}M
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* TMDB - Small Square */}
                  {tmdbId && (
                    <View className="w-24 rounded-2xl bg-black/40 backdrop-blur-xl p-3 border border-white/10 h-28 justify-center">
                      <Text className="text-white/60 text-xs font-medium mb-1 uppercase tracking-wide text-center">
                        TMDB
                      </Text>
                      <Text
                        className="text-white text-xs font-semibold text-center"
                        numberOfLines={2}
                      >
                        {tmdbId}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Videos Carousel - Full Width */}
          {(metadata?.videos?.results ||
            (metadata as EnrichedMetadata)?.enrichment?.trailer_url) && (
            <View className="mb-8">
              <Text className="text-white text-xl font-semibold mb-4">
                Trailers & Videos
              </Text>
              <VideoGallery
                videos={metadata?.videos?.results}
                trailerUrl={
                  (metadata as EnrichedMetadata)?.enrichment?.trailer_url
                }
              />
            </View>
          )}

          {/* Parallax Photo Gallery - Full Width */}
          {(metadata?.images?.posters || metadata?.images?.backdrops) && (
            <View className="mb-8">
              <Text className="text-white text-xl font-semibold mb-4">
                Photos
              </Text>
              <ParallaxGallery
                posters={metadata?.images?.posters}
                backdrops={metadata?.images?.backdrops}
              />
            </View>
          )}

          {metadataLoading && (
            <View className="rounded-xl bg-black/40 backdrop-blur-xl p-6 border border-white/10 mb-8">
              <View className="flex-row items-center justify-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="ml-3 text-white/60 text-sm">
                  Loading metadata...
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

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
  );
}
