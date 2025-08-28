// Shared interfaces for subtitle providers (scoped to metadata service)

export interface SubtitleLanguage {
  code: string;
  name: string;
  count?: number;
}

export interface SubtitleMetadata {
  id: string;
  language_code: string;
  language_name: string;
  source: 'opensubs' | 'subdl';
  source_id: string;
  download_count?: number;
  hearing_impaired?: boolean;
  ai_translated?: boolean;
  machine_translated?: boolean;
  quality_score?: number;
  release?: string;
  uploader?: string;
}

export interface SubtitleContent extends SubtitleMetadata {
  content: string;
}

export interface SubtitleSearchParams {
  imdb_id?: number;
  tmdb_id?: number;
  parent_imdb_id?: number;
  parent_tmdb_id?: number;
  season_number?: number;
  episode_number?: number;
  query?: string;
  moviehash?: string;
  type?: 'movie' | 'episode' | 'tv' | 'all';
  year?: number;
  preferred_provider?: 'opensubs' | 'subdl' | 'all';
  languages?: string;
}

export interface SubtitleProvider {
  name: string;
  searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleMetadata[]>;
  downloadSubtitle(
    subtitleId: string,
    metadata: SubtitleMetadata
  ): Promise<string>;
  getAvailableLanguages(
    params: SubtitleSearchParams
  ): Promise<SubtitleLanguage[]>;
}

export interface StoredSubtitle {
  id: string;
  movie_id: string;
  tmdb_id?: number;
  language_code: string;
  language_name: string;
  source: string;
  source_id: string;
  content?: string; // null when only metadata is stored
  metadata?: any; // JSON metadata from provider
  created_at: Date;
  updated_at: Date;
}

