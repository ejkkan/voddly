/**
 * Comprehensive content type definitions for movies, series, and live channels
 * This provides a clear separation of concerns and proper typing
 */

// Base content information
export interface BaseContentInfo {
  id: string;
  title: string;
  description?: string;
  rating?: string | number;
  genre?: string;
  cover?: string;
  backdrop?: string;
  tmdbId?: number;
}

// Episode information
export interface EpisodeInfo {
  id: string;
  stream_id?: string;
  episode_num: number;
  season_number: number;
  title?: string;
  duration?: string;
  plot?: string;
  rating?: number;
  release_date?: string;
  container_extension?: string;
  streamingUrl?: string;
  info?: {
    tmdb_id?: number;
    duration?: string;
    duration_secs?: number;
    plot?: string;
    rating?: number;
    releasedate?: string;
    season?: number;
    movie_image?: string;
    audio?: any;
    video?: any;
  };
}

// Season information
export interface SeasonInfo {
  season_number: number;
  episode_count: number;
  episodes: EpisodeInfo[];
}

// Series-specific information
export interface SeriesInfo extends BaseContentInfo {
  type: "series";
  series_id: string;
  seasons: SeasonInfo[];
  totalSeasons: number;
  totalEpisodes: number;
}

// Movie-specific information
export interface MovieInfo extends BaseContentInfo {
  type: "movie";
  stream_id: string;
  duration?: string | number;
  container_extension?: string;
}

// Live channel information
export interface LiveChannelInfo extends BaseContentInfo {
  type: "live";
  stream_id: string;
  category_id?: string;
  stream_icon?: string;
  epg?: {
    hasEPG: boolean;
    currentProgram?: any;
    nextProgram?: any;
  };
}

// Union type for all content
export type ContentInfo = SeriesInfo | MovieInfo | LiveChannelInfo;

// Subtitle search parameters
export interface SubtitleSearchParams {
  contentId: string;
  contentType: "movie" | "series" | "live";
  title: string;
  tmdbId?: number;

  // Series-specific params
  seasonNumber?: number;
  episodeNumber?: number;
  seriesTitle?: string;

  // Search options
  query?: string;
  preferred_provider?: "opensubs" | "subdl";
  type?: "movie" | "episode";
}

// Player context - what the player needs to know
export interface PlayerContext {
  contentType: "movie" | "series" | "live";
  contentId: string; // The actual stream ID for playback
  playlistId: string;

  // Display information
  title: string;
  tmdbId?: number;

  // Series-specific context
  seriesInfo?: {
    seriesId: string;
    seriesTitle: string;
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle?: string;
  };

  // Movie-specific context
  movieInfo?: {
    movieTitle: string;
  };

  // Live-specific context
  liveInfo?: {
    channelTitle: string;
  };
}

// Content resolver - maps URL params to player context
export interface ContentResolver {
  resolveContent(
    playlistId: string,
    contentType: "movie" | "series" | "live",
    contentId: string,
    tmdbId?: number,
  ): Promise<PlayerContext>;

  getSubtitleParams(context: PlayerContext): SubtitleSearchParams;
}
