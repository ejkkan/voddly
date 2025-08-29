'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export interface Subtitle {
  id: string;
  language_code: string;
  language_name: string;
  content: string;
  source?: string;
}

export interface SubtitleLanguage {
  code: string;
  name: string;
  count?: number;
}

export interface UseSubtitlesParams {
  movieId?: string;
  tmdbId?: number;
  imdbId?: number;
  title?: string;
  contentType?: 'movie' | 'episode' | 'all';
  seasonNumber?: number;
  episodeNumber?: number;
  year?: number;
  enabled?: boolean;
}

export interface UseSubtitlesResult {
  languages: SubtitleLanguage[];
  subtitles: Subtitle[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching available subtitle languages for a movie/episode
 */
export function useSubtitleLanguages(params: UseSubtitlesParams) {
  const {
    movieId,
    tmdbId,
    imdbId,
    title,
    contentType = 'movie',
    seasonNumber,
    episodeNumber,
    year,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      'subtitles',
      'languages',
      movieId || tmdbId,
      contentType,
      seasonNumber,
      episodeNumber,
    ],
    queryFn: async (): Promise<SubtitleLanguage[]> => {
      if (!movieId && !tmdbId) {
        throw new Error('Either movieId or tmdbId is required');
      }

      // Use TMDB-first endpoint if we have tmdbId
      if (tmdbId) {
        const response = await apiClient.user.getLanguagesByTmdb(tmdbId, {
          provider: 'all',
        });
        return response.languages;
      }

      // Fallback to movieId-based endpoint
      const response = await apiClient.user.getAvailableLanguages(movieId!, {
        imdb_id: imdbId,
        tmdb_id: tmdbId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        query: title,
        type: contentType,
        year,
        preferred_provider: 'all',
      });
      return response.languages;
    },
    enabled: enabled && (!!movieId || !!tmdbId),
    staleTime: 10 * 24 * 60 * 60 * 1000, // 10 days
    gcTime: 10 * 24 * 60 * 60 * 1000, // 10 days
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });
}

/**
 * Hook for fetching subtitle content for specific languages
 */
export function useSubtitleContent(
  params: UseSubtitlesParams,
  languages: string[] = []
) {
  const {
    movieId,
    tmdbId,
    imdbId,
    title,
    contentType = 'movie',
    seasonNumber,
    episodeNumber,
    year,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      'subtitles',
      'content',
      movieId || tmdbId,
      contentType,
      seasonNumber,
      episodeNumber,
      languages.sort().join(','),
    ],
    queryFn: async (): Promise<Subtitle[]> => {
      if (!movieId && !tmdbId) {
        throw new Error('Either movieId or tmdbId is required');
      }

      if (languages.length === 0) {
        return [];
      }

      const subtitles: Subtitle[] = [];

      // Fetch content for each language
      for (const languageCode of languages) {
        try {
          let response;

          // Use TMDB-first endpoint if we have tmdbId
          if (tmdbId) {
            response = await apiClient.user.getSubtitleContentByTmdb(
              tmdbId,
              languageCode,
              {
                provider: 'all',
              }
            );
          } else {
            // Fallback to movieId-based endpoint
            response = await apiClient.user.getSubtitleContent(
              movieId!,
              languageCode,
              {
                imdb_id: imdbId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                query: title,
                type: contentType,
                year,
                preferred_provider: 'all',
              }
            );
          }

          if (response.subtitle) {
            subtitles.push(response.subtitle);
          }
        } catch (error) {
          console.warn(`Failed to fetch subtitle for ${languageCode}:`, error);
        }
      }

      return subtitles;
    },
    enabled: enabled && (!!movieId || !!tmdbId) && languages.length > 0,
    staleTime: 10 * 24 * 60 * 60 * 1000, // 10 days
    gcTime: 10 * 24 * 60 * 60 * 1000, // 10 days
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });
}

/**
 * Main hook that combines language fetching and content fetching
 */
export function useSubtitles(
  params: UseSubtitlesParams,
  autoFetchLanguages: string[] = ['en', 'es', 'fr', 'de'] // Common languages to auto-fetch
): UseSubtitlesResult {
  const languagesQuery = useSubtitleLanguages(params);

  // Auto-fetch content for available languages that match our auto-fetch list
  const availableAutoFetchLanguages =
    languagesQuery.data
      ?.filter((lang) => autoFetchLanguages.includes(lang.code))
      .map((lang) => lang.code) || [];

  const contentQuery = useSubtitleContent(params, availableAutoFetchLanguages);

  return {
    languages: languagesQuery.data || [],
    subtitles: contentQuery.data || [],
    isLoading: languagesQuery.isLoading || contentQuery.isLoading,
    error: languagesQuery.error || contentQuery.error,
    refetch: () => {
      languagesQuery.refetch();
      contentQuery.refetch();
    },
  };
}

/**
 * Hook for fetching subtitle content for a specific language on demand
 */
export function useSubtitleForLanguage(
  params: UseSubtitlesParams,
  languageCode?: string
) {
  return useQuery({
    queryKey: [
      'subtitles',
      'single',
      params.movieId || params.tmdbId,
      params.contentType,
      params.seasonNumber,
      params.episodeNumber,
      languageCode,
    ],
    queryFn: async (): Promise<Subtitle | null> => {
      console.log('useSubtitleForLanguage', JSON.stringify(params, null, 2));
      if (!params.movieId && !params.tmdbId) {
        throw new Error('Either movieId or tmdbId is required');
      }

      if (!languageCode) {
        return null;
      }

      try {
        console.log('useSubtitleForLanguage', JSON.stringify(params, null, 2));
        let response;

        // Use TMDB-first endpoint if we have tmdbId
        if (params.tmdbId) {
          console.log('useSubtitleForLanguage tmdbId', params.tmdbId);
          response = await apiClient.user.getSubtitleContentByTmdb(
            params.tmdbId,
            languageCode,
            {
              provider: 'all',
            }
          );
        } else {
          // Fallback to movieId-based endpoint
          response = await apiClient.user.getSubtitleContent(
            params.movieId!,
            languageCode,
            {
              imdb_id: params.imdbId,
              tmdb_id: params.tmdbId,
              season_number: params.seasonNumber,
              episode_number: params.episodeNumber,
              query: params.title,
              type: params.contentType,
              year: params.year,
              preferred_provider: 'all',
            }
          );
        }

        return response.subtitle;
      } catch (error) {
        console.warn(`Failed to fetch subtitle for ${languageCode}:`, error);
        return null;
      }
    },
    enabled: !!(params.movieId || params.tmdbId) && !!languageCode,
    staleTime: 10 * 24 * 60 * 60 * 1000, // 10 days
    gcTime: 10 * 24 * 60 * 60 * 1000, // 10 days
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });
}
