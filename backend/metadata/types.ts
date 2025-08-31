// Content metadata types and interfaces

export type ContentType = 'movie' | 'tv' | 'season' | 'episode';
export type MetadataProvider = 'tmdb' | 'imdb' | 'tvdb' | 'custom';

export interface ContentMetadata {
  id: number;
  provider: MetadataProvider;
  provider_id: string;
  content_type: ContentType;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  genres?: any[];
  production_companies?: any[];
  runtime?: number;
  status?: string;
  tagline?: string;
  
  // TV Show specific
  number_of_seasons?: number;
  number_of_episodes?: number;
  first_air_date?: string;
  last_air_date?: string;
  episode_run_time?: number[];
  networks?: any[];
  created_by?: any[];
  
  // Season specific
  season_number?: number;
  air_date?: string;
  
  // Episode specific
  episode_number?: number;
  
  // Parent references
  parent_provider_id?: string;
  
  // Cross-reference IDs
  external_ids?: Record<string, any>;
  
  // Additional metadata
  videos?: any;
  images?: any;
  cast?: any[];
  crew?: any[];
  
  // Enrichment fields
  ratings?: any;
  awards?: string;
  rated?: string;
  box_office?: string;
  box_office_amount?: number;
  
  // Cache management
  fetched_at?: Date;
  updated_at?: Date;
}

export interface GetMetadataParams {
  provider: MetadataProvider;
  provider_id: string;
  content_type: ContentType;
  season_number?: number;
  episode_number?: number;
  append_to_response?: string; // TMDB-specific: "videos,images,credits"
}

export interface GetMetadataByExternalIdParams {
  tmdb_id?: number;
  imdb_id?: string;
  tvdb_id?: number;
  content_type: ContentType;
}

export interface SearchParams {
  query: string;
  content_type: ContentType;
  provider?: MetadataProvider;
  year?: number;
  page?: number;
  language?: string;
}

export interface SearchResult {
  provider: MetadataProvider;
  page: number;
  results: any[];
  total_pages: number;
  total_results: number;
}

// TMDB-specific types (kept for compatibility)
export interface TMDBConfig {
  apiKey?: string;
  accessToken: string;
  baseUrl?: string;
}

export interface TMDBMovieDetails {
  adult: boolean;
  backdrop_path: string | null;
  belongs_to_collection: any | null;
  budget: number;
  genres: Array<{ id: number; name: string }>;
  homepage: string | null;
  id: number;
  imdb_id: string | null;
  original_language: string;
  original_title: string;
  overview: string | null;
  popularity: number;
  poster_path: string | null;
  production_companies: Array<{
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
  }>;
  production_countries: Array<{
    iso_3166_1: string;
    name: string;
  }>;
  release_date: string;
  revenue: number;
  runtime: number | null;
  spoken_languages: Array<{
    english_name: string;
    iso_639_1: string;
    name: string;
  }>;
  status: string;
  tagline: string | null;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  videos?: any;
  images?: any;
  credits?: any;
  keywords?: any;
  external_ids?: any;
}

export interface TMDBTVDetails {
  adult: boolean;
  backdrop_path: string | null;
  created_by: Array<{
    id: number;
    credit_id: string;
    name: string;
    gender: number;
    profile_path: string | null;
  }>;
  episode_run_time: number[];
  first_air_date: string;
  genres: Array<{ id: number; name: string }>;
  homepage: string;
  id: number;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air: any;
  name: string;
  next_episode_to_air: any | null;
  networks: Array<{
    id: number;
    logo_path: string;
    name: string;
    origin_country: string;
  }>;
  number_of_episodes: number;
  number_of_seasons: number;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  production_companies: Array<{
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
  }>;
  production_countries: Array<{
    iso_3166_1: string;
    name: string;
  }>;
  seasons: Array<{
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
  }>;
  spoken_languages: Array<{
    english_name: string;
    iso_639_1: string;
    name: string;
  }>;
  status: string;
  tagline: string;
  type: string;
  vote_average: number;
  vote_count: number;
  videos?: any;
  images?: any;
  credits?: any;
  keywords?: any;
  external_ids?: any;
}