import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions } from 'react-native';

import { BackdropCarousel } from '@/components/media/BackdropCarousel';
import { CastCarousel } from '@/components/media/CastCarousel';
import { ImageGallery } from '@/components/media/ImageGallery';
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
  const { prepareContentPlayback } = useSourceCredentials();
  const { fetchRemote, isFetching, error: fetchError } = useFetchRemoteMovie();
  const sourceBase = useSourceBaseUrl(item?.source_id);

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
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-neutral-600 dark:text-neutral-400">
              Loading movie details...
            </Text>
          </View>
        ) : !item ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-xl text-neutral-900 dark:text-neutral-50">
              Movie not found
            </Text>
            <Pressable
              className="mt-4 rounded-lg bg-neutral-900 px-6 py-3"
              onPress={() => router.back()}
            >
              <Text className="text-white">Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {/* Backdrop Carousel */}
            {backdropImages.length > 0 && (
              <View className="relative">
                <BackdropCarousel backdrops={backdropImages} />

                {/* Back button overlay */}
                <Pressable
                  className="absolute left-4 top-12 rounded-full bg-black/50 p-3"
                  onPress={() => router.back()}
                >
                  <Text className="text-lg text-white">←</Text>
                </Pressable>
              </View>
            )}

            {/* Main Content */}
            <View className="px-4">
              {/* If no backdrop carousel, show back button */}
              {backdropImages.length === 0 && (
                <Pressable className="mb-3 mt-4" onPress={() => router.back()}>
                  <Text className="text-neutral-600 dark:text-neutral-300">
                    ← Back
                  </Text>
                </Pressable>
              )}

              {/* Main Info Section - Poster on left, details on right */}
              <View className={`mt-6 ${isTablet ? 'flex-row gap-6' : ''}`}>
                {/* Poster */}
                <View className={isTablet ? 'w-64' : 'mb-4'}>
                  <View className="aspect-[2/3] overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-800">
                    {displayData?.posterUrl || normalizedPoster ? (
                      <Image
                        source={{
                          uri: displayData?.posterUrl || normalizedPoster || '',
                        }}
                        contentFit="cover"
                        className="size-full"
                      />
                    ) : (
                      <View className="size-full items-center justify-center">
                        <Text className="text-6xl">🎬</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Details */}
                <View className="flex-1">
                  {/* Title and basic info */}
                  <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                    {displayData?.title || item.title}
                  </Text>

                  {displayData?.tagline ? (
                    <Text className="mt-2 italic text-neutral-600 dark:text-neutral-400">
                      &ldquo;{displayData.tagline}&rdquo;
                    </Text>
                  ) : null}

                  {/* Meta info */}
                  <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1">
                    {(displayData?.releaseDate || item.release_date) && (
                      <Text className="text-neutral-600 dark:text-neutral-400">
                        {String(
                          displayData?.releaseDate || item.release_date
                        ).slice(0, 4)}
                      </Text>
                    )}
                    {displayData?.runtime && (
                      <Text className="text-neutral-600 dark:text-neutral-400">
                        {Math.floor(displayData.runtime / 60)}h{' '}
                        {displayData.runtime % 60}m
                      </Text>
                    )}
                    <Text className="text-neutral-600 dark:text-neutral-400">
                      HD
                    </Text>
                    {displayData?.status && (
                      <View className="rounded-full bg-green-100 px-2 py-0.5 dark:bg-green-900">
                        <Text className="text-xs font-medium text-green-800 dark:text-green-200">
                          {displayData.status}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Genres */}
                  {displayData?.genres &&
                    Array.isArray(displayData.genres) &&
                    displayData.genres.length > 0 && (
                      <View className="mt-3 flex-row flex-wrap gap-2">
                        {displayData.genres.map((genre) => (
                          <View
                            key={genre.id}
                            className="rounded-full bg-neutral-200 px-3 py-1 dark:bg-neutral-800"
                          >
                            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                              {genre.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                  {/* Action Buttons */}
                  <View className="mt-6 flex-row flex-wrap gap-3">
                    <Pressable
                      className="flex-row items-center rounded-xl bg-blue-600 px-6 py-3"
                      onPress={handlePlay}
                    >
                      <Text className="mr-2 text-lg">▶</Text>
                      <Text className="font-semibold text-white">
                        Play Movie
                      </Text>
                    </Pressable>

                    <Pressable
                      className="rounded-xl border border-neutral-300 px-4 py-3 dark:border-neutral-700"
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
                      <Text className="text-neutral-900 dark:text-neutral-50">
                        {isFetching ? 'Updating...' : '🔄 Update'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Error messages */}
                  {(error || fetchError) && (
                    <Text className="mt-3 text-red-600 dark:text-red-400">
                      {error || fetchError}
                    </Text>
                  )}

                  {/* Overview */}
                  {(displayData?.overview || item.description) && (
                    <View className="mt-6">
                      <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                        Overview
                      </Text>
                      <Text className="leading-relaxed text-neutral-800 dark:text-neutral-200">
                        {displayData?.overview || item.description}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Ratings Section */}
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

              {/* Additional Metadata */}
              {(displayData?.budget ||
                displayData?.revenue ||
                displayData?.productionCompanies) && (
                <View className="mt-6">
                  <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                    Production Details
                  </Text>
                  <View className="rounded-lg bg-neutral-100 p-4 dark:bg-neutral-900">
                    {displayData?.budget && (
                      <View className="mb-2">
                        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                          Budget
                        </Text>
                        <Text className="text-neutral-900 dark:text-neutral-50">
                          ${displayData.budget.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {displayData?.revenue && (
                      <View className="mb-2">
                        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                          Revenue
                        </Text>
                        <Text className="text-neutral-900 dark:text-neutral-50">
                          ${displayData.revenue.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {displayData?.productionCompanies &&
                      displayData.productionCompanies.length > 0 && (
                        <View>
                          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                            Production Companies
                          </Text>
                          <Text className="text-neutral-900 dark:text-neutral-50">
                            {displayData.productionCompanies
                              .map((c: any) => c.name)
                              .join(', ')}
                          </Text>
                        </View>
                      )}
                  </View>
                </View>
              )}
            </View>
            {console.log('metadata?.credits?.cast', metadata)}
            {/* Cast Carousel */}
            <CastCarousel cast={metadata?.credits?.cast} />

            {/* Videos Section */}
            <VideoGallery
              videos={metadata?.videos?.results}
              trailerUrl={
                (metadata as EnrichedMetadata)?.enrichment?.trailer_url
              }
            />

            {/* Images Gallery */}
            <ImageGallery
              posters={metadata?.images?.posters}
              backdrops={metadata?.images?.backdrops}
            />

            {/* Loading overlay for metadata */}
            {metadataLoading && (
              <View className="mt-6 px-4">
                <View className="flex-row items-center rounded-lg bg-neutral-100 p-4 dark:bg-neutral-900">
                  <ActivityIndicator size="small" />
                  <Text className="ml-3 text-neutral-600 dark:text-neutral-400">
                    Loading additional metadata...
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
