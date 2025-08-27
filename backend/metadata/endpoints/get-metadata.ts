import { api, APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { secret } from 'encore.dev/config';
import { metadataDB } from '../db';
import { TMDBClient } from '../providers/tmdb-client';
import { enrichWithExternalAPIs, EnrichmentData } from '../enrichment';
import {
  ContentType,
  ContentMetadata,
  GetMetadataParams,
} from '../types';

// TMDB API configuration from secrets
const tmdbAccessToken = secret('TMDBAccessToken');

// Initialize TMDB client
let tmdbClient: TMDBClient;

async function getTMDBClient(): Promise<TMDBClient> {
  if (!tmdbClient) {
    const accessToken = await tmdbAccessToken();
    tmdbClient = new TMDBClient({
      accessToken,
    });
  }
  return tmdbClient;
}

// Cache duration in hours (24 hours by default)
const CACHE_DURATION_HOURS = 24;

function isCacheValid(fetchedAt: Date): boolean {
  const now = new Date();
  const diffHours = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);
  return diffHours < CACHE_DURATION_HOURS;
}

// Helper serializers to ensure proper SQL parameter types
function numOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value);
  return s.length ? s : null;
}

function jsonOrNull(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function transformTMDBResponse(
  apiResponse: any,
  contentType: ContentType,
  tmdbId: number,
  seasonNumber?: number,
  episodeNumber?: number,
  parentTmdbId?: number
): Promise<ContentMetadata> {
  const base: ContentMetadata = {
    id: 0, // Will be set by database
    provider: 'tmdb',
    provider_id: String(tmdbId),
    content_type: contentType,
    raw_response: apiResponse,
    fetched_at: new Date(),
    updated_at: new Date(),
    external_ids: {
      tmdb_id: tmdbId,
    },
  };

  // Common fields
  base.overview = apiResponse.overview;
  base.poster_path = apiResponse.poster_path;
  base.backdrop_path = apiResponse.backdrop_path;
  base.vote_average = apiResponse.vote_average;
  base.vote_count = apiResponse.vote_count;
  base.popularity = apiResponse.popularity;
  base.original_language = apiResponse.original_language;
  base.genres = apiResponse.genres;
  base.status = apiResponse.status;

  // Extract additional data if present
  if (apiResponse.videos) base.videos = apiResponse.videos;
  if (apiResponse.images) base.images = apiResponse.images;
  if (apiResponse.credits) {
    base.cast = apiResponse.credits.cast;
    base.crew = apiResponse.credits.crew;
  }
  if (apiResponse.keywords) base.keywords = apiResponse.keywords;

  // Merge external IDs
  if (apiResponse.external_ids) {
    base.external_ids = { ...base.external_ids, ...apiResponse.external_ids };
  }

  // Add IMDB ID if present
  if (apiResponse.imdb_id) {
    base.external_ids!.imdb_id = apiResponse.imdb_id;
  }

  // Content-specific fields
  switch (contentType) {
    case 'movie':
      base.title = apiResponse.title;
      base.original_title = apiResponse.original_title;
      base.release_date = apiResponse.release_date;
      base.runtime = apiResponse.runtime;
      base.tagline = apiResponse.tagline;
      base.production_companies = apiResponse.production_companies;
      break;

    case 'tv':
      base.title = apiResponse.name;
      base.original_title = apiResponse.original_name;
      base.first_air_date = apiResponse.first_air_date;
      base.last_air_date = apiResponse.last_air_date;
      base.number_of_seasons = apiResponse.number_of_seasons;
      base.number_of_episodes = apiResponse.number_of_episodes;
      base.episode_run_time = apiResponse.episode_run_time;
      base.networks = apiResponse.networks;
      base.created_by = apiResponse.created_by;
      break;

    case 'season':
      base.title = apiResponse.name;
      base.season_number = seasonNumber;
      base.air_date = apiResponse.air_date;
      base.parent_provider_id = parentTmdbId ? String(parentTmdbId) : undefined;
      break;

    case 'episode':
      base.title = apiResponse.name;
      base.season_number = seasonNumber;
      base.episode_number = episodeNumber;
      base.air_date = apiResponse.air_date;
      base.runtime = apiResponse.runtime;
      base.parent_provider_id = parentTmdbId ? String(parentTmdbId) : undefined;
      break;
  }

  return base;
}

// Get metadata for a specific content ID
export const getMetadata = api(
  { expose: true, auth: false, method: 'GET', path: '/metadata' },
  async (params: GetMetadataParams): Promise<ContentMetadata> => {
    const {
      provider,
      provider_id,
      content_type,
      season_number,
      episode_number,
      force_refresh,
      append_to_response,
    } = params;

    // Check cache first (unless force_refresh is true)
    if (!force_refresh) {
      const cached = await metadataDB.queryRow<ContentMetadata>`
        SELECT * FROM content_metadata
        WHERE provider = ${provider}
          AND provider_id = ${provider_id}
          AND content_type = ${content_type}
          AND (season_number = ${season_number} OR (season_number IS NULL AND ${
        season_number === undefined
      }))
          AND (episode_number = ${episode_number} OR (episode_number IS NULL AND ${
        episode_number === undefined
      }))
      `;

      if (cached && isCacheValid(cached.fetched_at!)) {
        // Also fetch enrichment data if it exists
        if (content_type === 'movie' || content_type === 'tv') {
          const enrichment = await metadataDB.queryRow<EnrichmentData>`
            SELECT * FROM content_enrichment 
            WHERE tmdb_id = ${parseInt(provider_id)} 
            AND content_type = ${content_type}
          `;
          
          if (enrichment) {
            (cached as any).enrichment = enrichment;
          }
        }
        
        // Strip numeric fields that may decode poorly in encore client
        cached.vote_average = undefined as any;
        cached.popularity = undefined as any;
        return cached;
      }
    }

    // Currently only TMDB is supported, but this can be extended
    if (provider !== 'tmdb') {
      throw APIError.badRequest(`Provider ${provider} is not yet supported`);
    }

    // Fetch from TMDB API
    const client = await getTMDBClient();
    let apiResponse: any;
    let parentTmdbId: number | undefined;

    try {
      const tmdbId = parseInt(provider_id);

      switch (content_type) {
        case 'movie':
          apiResponse = await client.getMovieDetails(tmdbId, append_to_response);
          break;

        case 'tv':
          apiResponse = await client.getTVDetails(tmdbId, append_to_response);
          break;

        case 'season':
          if (season_number === undefined) {
            throw APIError.badRequest(
              'season_number is required for season content type'
            );
          }
          parentTmdbId = tmdbId;
          apiResponse = await client.getSeasonDetails(
            tmdbId,
            season_number,
            append_to_response
          );
          break;

        case 'episode':
          if (season_number === undefined || episode_number === undefined) {
            throw APIError.badRequest(
              'season_number and episode_number are required for episode content type'
            );
          }
          parentTmdbId = tmdbId;
          apiResponse = await client.getEpisodeDetails(
            tmdbId,
            season_number,
            episode_number,
            append_to_response
          );
          break;

        default:
          throw APIError.badRequest(`Invalid content type: ${content_type}`);
      }
    } catch (error: any) {
      throw APIError.internal(
        `Failed to fetch from ${provider}: ${error.message}`
      );
    }

    // Transform API response to our format
    const metadata = await transformTMDBResponse(
      apiResponse,
      content_type,
      parseInt(provider_id),
      season_number,
      episode_number,
      parentTmdbId
    );

    // ✨ NEW: Enrich with external APIs (only for movies/tv, not episodes/seasons)
    if (content_type === 'movie' || content_type === 'tv') {
      try {
        const enrichmentData = await enrichWithExternalAPIs({
          tmdb_id: parseInt(provider_id),
          content_type,
          imdb_id: metadata.external_ids?.imdb_id,
          title: metadata.title,
          year: metadata.release_date?.substring(0, 4) || metadata.first_air_date?.substring(0, 4),
        });
        
        // Add enrichment to response
        (metadata as any).enrichment = enrichmentData;
      } catch (error) {
        // Don't fail the request if enrichment fails
        log.error('Enrichment failed but continuing', { error, tmdb_id: provider_id });
      }
    }

    // Store metadata in database
    await storeMetadata(metadata, content_type, season_number, episode_number, parentTmdbId);

    // Strip numeric fields that may decode poorly in encore client
    metadata.vote_average = undefined as any;
    metadata.popularity = undefined as any;

    return metadata;
  }
);

async function storeMetadata(
  metadata: ContentMetadata,
  content_type: ContentType,
  season_number?: number,
  episode_number?: number,
  parentTmdbId?: number
): Promise<void> {
  // Store based on content type with proper unique constraint handling
  if (content_type === 'movie' || content_type === 'tv') {
    // Top-level content
    const existing = await metadataDB.queryRow<{ id: number }>`
      SELECT id FROM content_metadata
      WHERE provider = ${metadata.provider}
        AND provider_id = ${metadata.provider_id}
        AND content_type = ${metadata.content_type}
        AND season_number IS NULL
        AND episode_number IS NULL
    `;

    if (existing) {
      await metadataDB.exec`
        UPDATE content_metadata SET
          title = ${strOrNull(metadata.title)},
          original_title = ${strOrNull(metadata.original_title)},
          overview = ${strOrNull(metadata.overview)},
          release_date = ${strOrNull(metadata.release_date)},
          poster_path = ${strOrNull(metadata.poster_path)},
          backdrop_path = ${strOrNull(metadata.backdrop_path)},
          vote_count = ${numOrNull(metadata.vote_count)},
          original_language = ${strOrNull(metadata.original_language)},
          genres = ${jsonOrNull(metadata.genres)},
          production_companies = ${jsonOrNull(metadata.production_companies)},
          runtime = ${numOrNull(metadata.runtime)},
          status = ${strOrNull(metadata.status)},
          tagline = ${strOrNull(metadata.tagline)},
          number_of_seasons = CAST(${numOrNull(metadata.number_of_seasons)} AS INTEGER),
          number_of_episodes = CAST(${numOrNull(metadata.number_of_episodes)} AS INTEGER),
          first_air_date = ${strOrNull(metadata.first_air_date)},
          last_air_date = ${strOrNull(metadata.last_air_date)},
          episode_run_time = ${jsonOrNull(metadata.episode_run_time)},
          networks = ${jsonOrNull(metadata.networks)},
          created_by = ${jsonOrNull(metadata.created_by)},
          external_ids = ${jsonOrNull(metadata.external_ids)},
          videos = ${jsonOrNull(metadata.videos)},
          images = ${jsonOrNull(metadata.images)},
          "cast" = ${jsonOrNull(metadata.cast)},
          crew = ${jsonOrNull(metadata.crew)},
          keywords = ${jsonOrNull(metadata.keywords)},
          raw_response = ${jsonOrNull(metadata.raw_response)},
          fetched_at = ${metadata.fetched_at},
          updated_at = ${metadata.updated_at}
        WHERE id = ${existing.id}
      `;
      metadata.id = existing.id;
    } else {
      const result = await metadataDB.queryRow<{ id: number }>`
        INSERT INTO content_metadata (
          provider, provider_id, content_type, title, original_title, overview,
          release_date, poster_path, backdrop_path, vote_average, vote_count,
          popularity, original_language, genres, production_companies, runtime,
          status, tagline, number_of_seasons, number_of_episodes, first_air_date,
          last_air_date, episode_run_time, networks, created_by, season_number,
          air_date, episode_number, parent_provider_id, external_ids, videos, images,
          "cast", crew, keywords, raw_response, fetched_at, updated_at
        ) VALUES (
          ${metadata.provider}, ${metadata.provider_id}, ${metadata.content_type},
          ${strOrNull(metadata.title)}, ${strOrNull(metadata.original_title)}, 
          ${strOrNull(metadata.overview)}, ${strOrNull(metadata.release_date)}, 
          ${strOrNull(metadata.poster_path)}, ${strOrNull(metadata.backdrop_path)},
          NULL, ${numOrNull(metadata.vote_count)}, NULL, 
          ${strOrNull(metadata.original_language)},
          ${jsonOrNull(metadata.genres)}, ${jsonOrNull(metadata.production_companies)}, 
          ${numOrNull(metadata.runtime)}, ${strOrNull(metadata.status)}, 
          ${strOrNull(metadata.tagline)},
          CAST(${numOrNull(metadata.number_of_seasons)} AS INTEGER),
          CAST(${numOrNull(metadata.number_of_episodes)} AS INTEGER),
          ${strOrNull(metadata.first_air_date)}, ${strOrNull(metadata.last_air_date)},
          ${jsonOrNull(metadata.episode_run_time)}, ${jsonOrNull(metadata.networks)}, 
          ${jsonOrNull(metadata.created_by)},
          NULL, NULL, NULL, NULL,
          ${jsonOrNull(metadata.external_ids)}, ${jsonOrNull(metadata.videos)}, 
          ${jsonOrNull(metadata.images)}, ${jsonOrNull(metadata.cast)}, 
          ${jsonOrNull(metadata.crew)}, ${jsonOrNull(metadata.keywords)},
          ${jsonOrNull(metadata.raw_response)}, ${metadata.fetched_at}, 
          ${metadata.updated_at}
        )
        RETURNING id
      `;
      metadata.id = result!.id;
    }
  } else if (content_type === 'season') {
    // Season-level content
    const existing = await metadataDB.queryRow<{ id: number }>`
      SELECT id FROM content_metadata
      WHERE provider = ${metadata.provider}
        AND content_type = 'season'
        AND parent_provider_id = ${strOrNull(metadata.parent_provider_id)}
        AND season_number = CAST(${numOrNull(season_number)} AS INTEGER)
    `;

    if (existing) {
      await metadataDB.exec`
        UPDATE content_metadata SET
          title = ${strOrNull(metadata.title)},
          overview = ${strOrNull(metadata.overview)},
          poster_path = ${strOrNull(metadata.poster_path)},
          air_date = ${strOrNull(metadata.air_date)},
          raw_response = ${jsonOrNull(metadata.raw_response)},
          fetched_at = ${metadata.fetched_at},
          updated_at = ${metadata.updated_at}
        WHERE id = ${existing.id}
      `;
      metadata.id = existing.id;
    } else {
      try {
        const result = await metadataDB.queryRow<{ id: number }>`
          INSERT INTO content_metadata (
            provider, provider_id, content_type, title, overview,
            poster_path, season_number, air_date, parent_provider_id,
            raw_response, fetched_at, updated_at
          ) VALUES (
            ${metadata.provider}, ${metadata.provider_id}, ${metadata.content_type},
            ${strOrNull(metadata.title)}, ${strOrNull(metadata.overview)},
            ${strOrNull(metadata.poster_path)}, 
            CAST(${numOrNull(season_number)} AS INTEGER),
            ${strOrNull(metadata.air_date)}, ${strOrNull(metadata.parent_provider_id)},
            ${jsonOrNull(metadata.raw_response)}, ${metadata.fetched_at}, 
            ${metadata.updated_at}
          )
          RETURNING id
        `;
        metadata.id = result!.id;
      } catch (e) {
        log.warn('Season insert failed, likely duplicate', { error: e });
      }
    }
  } else {
    // Episode-level content
    const existing = await metadataDB.queryRow<{ id: number }>`
      SELECT id FROM content_metadata
      WHERE provider = ${metadata.provider}
        AND content_type = 'episode'
        AND parent_provider_id = ${strOrNull(metadata.parent_provider_id)}
        AND season_number = CAST(${numOrNull(season_number)} AS INTEGER)
        AND episode_number = CAST(${numOrNull(episode_number)} AS INTEGER)
    `;

    if (existing) {
      await metadataDB.exec`
        UPDATE content_metadata SET
          title = ${strOrNull(metadata.title)},
          overview = ${strOrNull(metadata.overview)},
          air_date = ${strOrNull(metadata.air_date)},
          runtime = ${numOrNull(metadata.runtime)},
          raw_response = ${jsonOrNull(metadata.raw_response)},
          fetched_at = ${metadata.fetched_at},
          updated_at = ${metadata.updated_at}
        WHERE id = ${existing.id}
      `;
      metadata.id = existing.id;
    } else {
      try {
        const result = await metadataDB.queryRow<{ id: number }>`
          INSERT INTO content_metadata (
            provider, provider_id, content_type, title, overview,
            season_number, episode_number, air_date, runtime, parent_provider_id,
            raw_response, fetched_at, updated_at
          ) VALUES (
            ${metadata.provider}, ${metadata.provider_id}, ${metadata.content_type},
            ${strOrNull(metadata.title)}, ${strOrNull(metadata.overview)},
            CAST(${numOrNull(season_number)} AS INTEGER),
            CAST(${numOrNull(episode_number)} AS INTEGER),
            ${strOrNull(metadata.air_date)}, ${numOrNull(metadata.runtime)},
            ${strOrNull(metadata.parent_provider_id)},
            ${jsonOrNull(metadata.raw_response)}, ${metadata.fetched_at}, 
            ${metadata.updated_at}
          )
          RETURNING id
        `;
        metadata.id = result!.id;
      } catch (e) {
        log.warn('Episode insert failed, likely duplicate', { error: e });
      }
    }
  }
}