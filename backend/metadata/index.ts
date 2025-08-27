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

// Ensure cron jobs are registered by importing their modules for side effects
import './cron/trends';
