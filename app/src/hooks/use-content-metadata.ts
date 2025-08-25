'use client';

import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getApiRoot } from '@/lib/auth/auth-client';

// Type definitions for content metadata
export type ContentType = 'movie' | 'tv' | 'season' | 'episode';

// Core metadata structure that's common to all content
export interface BaseMetadata {
  id: number;
  provider: 'tmdb' | 'imdb' | 'tvdb' | 'custom';
  provider_id: string;
  content_type: ContentType;
  title?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  external_ids?: Record<string, any>;
  fetched_at?: string;
  updated_at?: string;
}

// Movie-specific metadata
export interface MovieMetadata extends BaseMetadata {
  content_type: 'movie';
  release_date?: string;
  production_companies?: {
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
  }[];
  budget?: number;
  revenue?: number;
  videos?: any;
  images?: any;
  credits?: any;
  keywords?: any;
}

// TV Show-specific metadata
export interface TVMetadata extends BaseMetadata {
  content_type: 'tv';
  number_of_seasons?: number;
  number_of_episodes?: number;
  first_air_date?: string;
  last_air_date?: string;
  episode_run_time?: number[];
  networks?: {
    id: number;
    logo_path: string;
    name: string;
    origin_country: string;
  }[];
  created_by?: {
    id: number;
    name: string;
    profile_path: string | null;
  }[];
  seasons?: {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
  }[];
  videos?: any;
  images?: any;
  credits?: any;
  keywords?: any;
}

// Season-specific metadata
export interface SeasonMetadata extends BaseMetadata {
  content_type: 'season';
  season_number?: number;
  air_date?: string;
  parent_provider_id?: string;
  episodes?: {
    id: number;
    episode_number: number;
    name: string;
    overview: string;
    air_date: string;
    still_path: string | null;
  }[];
}

// Episode-specific metadata
export interface EpisodeMetadata extends BaseMetadata {
  content_type: 'episode';
  season_number?: number;
  episode_number?: number;
  air_date?: string;
  parent_provider_id?: string;
  still_path?: string | null;
}

// Union type for all metadata types
export type ContentMetadata =
  | MovieMetadata
  | TVMetadata
  | SeasonMetadata
  | EpisodeMetadata;

// Enrichment data from additional providers
export interface EnrichmentData {
  tmdb_id: number;
  content_type: string;
  imdb_rating?: number;
  imdb_votes?: number;
  rotten_tomatoes_rating?: number;
  metacritic_rating?: number;
  trakt_rating?: number;
  trakt_votes?: number;
  trakt_watchers?: number;
  fanart_tv_id?: string;
  tvdb_id?: string;
  trailer_url?: string;
  fetched_at?: string;
}

// Extended metadata with enrichment
export type EnrichedMetadata = ContentMetadata & {
  enrichment?: EnrichmentData;
};

// Parameters for fetching metadata
export interface UseContentMetadataParams {
  tmdbId?: string | number;
  contentType: ContentType;
  seasonNumber?: number;
  episodeNumber?: number;
  forceRefresh?: boolean;
  appendToResponse?: string;
  enabled?: boolean;
}

// Fetch metadata from the backend
async function fetchContentMetadata(
  params: UseContentMetadataParams
): Promise<ContentMetadata> {
  const {
    tmdbId,
    contentType,
    seasonNumber,
    episodeNumber,
    forceRefresh = false,
    appendToResponse = 'videos,images,credits,external_ids',
  } = params;

  if (!tmdbId) {
    throw new Error('TMDB ID is required');
  }

  const baseApi = getApiRoot();
  const queryParams = new URLSearchParams({
    tmdb_id: String(tmdbId),
    content_type: contentType,
    ...(forceRefresh && { force_refresh: 'true' }),
    ...(appendToResponse && { append_to_response: appendToResponse }),
    ...(seasonNumber !== undefined && { season_number: String(seasonNumber) }),
    ...(episodeNumber !== undefined && {
      episode_number: String(episodeNumber),
    }),
  });

  const url = `${baseApi}/user/metadata?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch metadata: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data;
}

// Main hook for fetching content metadata
export function useContentMetadata<T extends ContentMetadata = ContentMetadata>(
  params: UseContentMetadataParams,
  queryOptions?: Partial<UseQueryOptions<T, Error>>
) {
  const {
    tmdbId,
    contentType,
    seasonNumber,
    episodeNumber,
    enabled = true,
  } = params;

  return useQuery<T, Error>({
    queryKey: [
      'metadata',
      contentType,
      tmdbId ? String(tmdbId) : null,
      seasonNumber,
      episodeNumber,
    ],
    queryFn: () => fetchContentMetadata(params) as Promise<T>,
    enabled: enabled && !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });
}

// Convenience hooks for specific content types
export function useMovieMetadata(
  tmdbId?: string | number,
  options?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<MovieMetadata, Error>>
) {
  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<MovieMetadata>(
    {
      tmdbId,
      contentType: 'movie',
      forceRefresh,
      appendToResponse,
      enabled,
    },
    queryOptions
  );
}

export function useTVMetadata(
  tmdbId?: string | number,
  options?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<TVMetadata, Error>>
) {
  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<TVMetadata>(
    {
      tmdbId,
      contentType: 'tv',
      forceRefresh,
      appendToResponse,
      enabled,
    },
    queryOptions
  );
}

export function useSeasonMetadata(
  tmdbId?: string | number,
  seasonNumber?: number,
  options?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<SeasonMetadata, Error>>
) {
  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<SeasonMetadata>(
    {
      tmdbId,
      contentType: 'season',
      seasonNumber,
      forceRefresh,
      appendToResponse,
      enabled,
    },
    queryOptions
  );
}

export function useEpisodeMetadata(
  params: {
    tmdbId?: string | number;
    seasonNumber?: number;
    episodeNumber?: number;
  },
  options?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<EpisodeMetadata, Error>>
) {
  const { tmdbId, seasonNumber, episodeNumber } = params;
  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<EpisodeMetadata>(
    {
      tmdbId,
      contentType: 'episode',
      seasonNumber,
      episodeNumber,
      forceRefresh,
      appendToResponse,
      enabled,
    },
    queryOptions
  );
}

// Utility to extract clean metadata for display
export function extractDisplayMetadata(metadata?: ContentMetadata) {
  if (!metadata) return null;

  return {
    title: metadata.title || metadata.original_title,
    overview: metadata.overview,
    posterUrl: metadata.poster_path
      ? `https://image.tmdb.org/t/p/w500${metadata.poster_path}`
      : null,
    backdropUrl: metadata.backdrop_path
      ? `https://image.tmdb.org/t/p/original${metadata.backdrop_path}`
      : null,
    rating: metadata.vote_average,
    voteCount: metadata.vote_count,
    genres: metadata.genres,
    runtime: metadata.runtime,
    status: metadata.status,
    tagline: metadata.tagline,
    // Type-specific fields
    ...(metadata.content_type === 'movie' && {
      releaseDate: (metadata as MovieMetadata).release_date,
      budget: (metadata as MovieMetadata).budget,
      revenue: (metadata as MovieMetadata).revenue,
    }),
    ...(metadata.content_type === 'tv' && {
      firstAirDate: (metadata as TVMetadata).first_air_date,
      lastAirDate: (metadata as TVMetadata).last_air_date,
      numberOfSeasons: (metadata as TVMetadata).number_of_seasons,
      numberOfEpisodes: (metadata as TVMetadata).number_of_episodes,
      seasons: (metadata as TVMetadata).seasons,
      networks: (metadata as TVMetadata).networks,
    }),
  };
}
