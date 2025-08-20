// Metadata Service exports
export { 
  getMetadata, 
  getMetadataByExternalId, 
  search, 
  getCachedMetadata, 
  clearCache 
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
  TMDBTVDetails
} from './types';