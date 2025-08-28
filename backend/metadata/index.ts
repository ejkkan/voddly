// Metadata Service exports
export {
  getMetadata,
  getMetadataByExternalId,
  search,
  getCachedMetadata,
  clearCache,
} from './metadata';

export type {
  ContentType,
  MetadataProvider,
  ContentMetadata,
  GetMetadataParams,
  GetMetadataByExternalIdParams,
  SearchParams,
  SearchResult,
  TMDBMovieDetails,
  TMDBTVDetails,
} from './types';

export type {
  TrendFeed,
  TrendsContentType,
  TrendItem,
  TrendsResponse,
} from './endpoints/trends';

// Ensure cron jobs are registered by importing their modules for side effects
import './cron/trends';

// Import endpoints for side-effects (route registration)
import './endpoints/subtitles/get-subtitles-by-tmdb';
