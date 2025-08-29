'use client';

import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

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
  title?: string; // 🆕 Add title parameter
  contentType: ContentType;
  seasonNumber?: number;
  episodeNumber?: number;
  forceRefresh?: boolean;
  appendToResponse?: string;
  enabled?: boolean;
}

// Fetch metadata from the backend via our API client wrapper
async function fetchContentMetadata(
  params: UseContentMetadataParams
): Promise<ContentMetadata> {
  const {
    tmdbId,
    title, // 🆕 Extract title
    contentType,
    seasonNumber,
    episodeNumber,
    forceRefresh = false,
    appendToResponse = 'videos,images,credits,external_ids',
  } = params;
  console.log('params', JSON.stringify(params, null, 2));
  // 🆕 Allow either TMDB ID or title
  if (!tmdbId && !title) {
    throw new Error('Either TMDB ID or title is required');
  }

  // Normalize title if an object was passed accidentally
  const normalizedTitle: string | undefined =
    typeof title === 'string'
      ? title
      : title && typeof title === 'object'
        ? ((title as any).title ??
          (title as any).name ??
          (title as any).original_title)
        : undefined;

  const data = await apiClient.getUserMetadata<ContentMetadata>({
    tmdbId:
      tmdbId !== undefined && tmdbId !== null ? Number(tmdbId) : undefined,
    title: normalizedTitle,
    contentType,
    seasonNumber,
    episodeNumber,
    forceRefresh,
    appendToResponse,
  });
  return data as ContentMetadata;
}

// Main hook for fetching content metadata
export function useContentMetadata<T extends ContentMetadata = ContentMetadata>(
  params: UseContentMetadataParams,
  queryOptions?: Partial<UseQueryOptions<T, Error>>
) {
  const {
    tmdbId,
    title, // 🆕 Extract title
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
      title || null, // 🆕 Include title in query key
      seasonNumber,
      episodeNumber,
    ],
    queryFn: () => fetchContentMetadata(params) as Promise<T>,
    enabled: enabled && (!!tmdbId || !!title), // 🆕 Enable if either exists
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
  titleOrOptions?:
    | string
    | ({
        enabled?: boolean;
        forceRefresh?: boolean;
        appendToResponse?: string;
      } & Partial<UseQueryOptions<MovieMetadata, Error>>),
  maybeOptions?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<MovieMetadata, Error>>
) {
  const hasTitle =
    typeof titleOrOptions === 'string' || titleOrOptions === undefined;
  const title: string | undefined = hasTitle
    ? (titleOrOptions as string | undefined)
    : undefined;
  const options = hasTitle
    ? maybeOptions
    : (titleOrOptions as {
        enabled?: boolean;
        forceRefresh?: boolean;
        appendToResponse?: string;
      } & Partial<UseQueryOptions<MovieMetadata, Error>>);

  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<MovieMetadata>(
    {
      tmdbId,
      title,
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
  titleOrOptions?:
    | string
    | ({
        enabled?: boolean;
        forceRefresh?: boolean;
        appendToResponse?: string;
      } & Partial<UseQueryOptions<TVMetadata, Error>>),
  maybeOptions?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<TVMetadata, Error>>
) {
  const hasTitle =
    typeof titleOrOptions === 'string' || titleOrOptions === undefined;
  const title: string | undefined = hasTitle
    ? (titleOrOptions as string | undefined)
    : undefined;
  const options = hasTitle
    ? maybeOptions
    : (titleOrOptions as {
        enabled?: boolean;
        forceRefresh?: boolean;
        appendToResponse?: string;
      } & Partial<UseQueryOptions<TVMetadata, Error>>);

  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<TVMetadata>(
    {
      tmdbId,
      title,
      contentType: 'tv',
      forceRefresh,
      appendToResponse,
      enabled,
    },
    queryOptions
  );
}

export function useSeasonMetadata(
  params: {
    tmdbId?: string | number;
    seasonNumber?: number;
    title?: string; // Add title support
  },
  options?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<SeasonMetadata, Error>>
) {
  const { tmdbId, seasonNumber, title } = params;
  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<SeasonMetadata>(
    {
      tmdbId,
      title,
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
    title?: string; // Add title support
  },
  options?: {
    enabled?: boolean;
    forceRefresh?: boolean;
    appendToResponse?: string;
  } & Partial<UseQueryOptions<EpisodeMetadata, Error>>
) {
  const { tmdbId, seasonNumber, episodeNumber, title } = params;
  const { enabled, forceRefresh, appendToResponse, ...queryOptions } =
    options || {};

  return useContentMetadata<EpisodeMetadata>(
    {
      tmdbId,
      title,
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

  // Helper function to safely parse stringified JSON arrays
  const parseJsonArrayField = (field: any): any[] => {
    if (Array.isArray(field)) {
      return field;
    }
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

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
    genres: parseJsonArrayField(metadata.genres),
    runtime: metadata.runtime,
    status: metadata.status,
    tagline: metadata.tagline,
    // Type-specific fields
    ...(metadata.content_type === 'movie' && {
      releaseDate: (metadata as MovieMetadata).release_date,
      budget: (metadata as MovieMetadata).budget,
      revenue: (metadata as MovieMetadata).revenue,
      productionCompanies: parseJsonArrayField(
        (metadata as MovieMetadata).production_companies
      ),
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
