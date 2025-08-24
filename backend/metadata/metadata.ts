import { api, APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { SQLDatabase } from 'encore.dev/storage/sqldb';
import { secret } from 'encore.dev/config';
import { TMDBClient } from './tmdb-client';
import {
  ContentType,
  MetadataProvider,
  ContentMetadata,
  GetMetadataParams,
  GetMetadataByExternalIdParams,
  SearchParams,
  SearchResult,
} from './types';

// Database for storing cached content metadata
const db = new SQLDatabase('metadata', { migrations: './migrations' });

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

function decStrOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return String(n);
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
      const cached = await db.queryRow<ContentMetadata>`
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
        // Strip numeric fields that may decode poorly in encore client
        cached.vote_average = undefined as any;
        cached.popularity = undefined as any;
        return cached;
      }
    }

    // Currently only TMDB is supported, but this can be extended
    if (provider !== 'tmdb') {
      throw APIError.invalidArgument(
        `Provider ${provider} is not yet supported`
      );
    }

    // Fetch from TMDB API
    const client = await getTMDBClient();
    let apiResponse: any;
    let parentTmdbId: number | undefined;

    try {
      const tmdbId = parseInt(provider_id);

      switch (content_type) {
        case 'movie':
          apiResponse = await client.getMovieDetails(
            tmdbId,
            append_to_response
          );
          break;

        case 'tv':
          apiResponse = await client.getTVDetails(tmdbId, append_to_response);
          break;

        case 'season':
          if (season_number === undefined) {
            throw APIError.invalidArgument(
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
            throw APIError.invalidArgument(
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
          throw APIError.invalidArgument(
            `Invalid content type: ${content_type}`
          );
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

    // Store in database
    try {
      log.info('Preparing metadata insert diagnostics', {
        provider: metadata.provider,
        provider_id: metadata.provider_id,
        content_type,
        vote_average: metadata.vote_average,
        vote_average_type: typeof (metadata as any).vote_average,
        vote_count: metadata.vote_count,
        vote_count_type: typeof (metadata as any).vote_count,
        popularity: metadata.popularity,
        popularity_type: typeof (metadata as any).popularity,
        runtime: metadata.runtime,
        runtime_type: typeof (metadata as any).runtime,
        season_number: metadata.season_number,
        episode_number: metadata.episode_number,
      });
    } catch {}

    if (content_type === 'movie' || content_type === 'tv') {
      const existing = await db.queryRow<{ id: number }>`
        SELECT id FROM content_metadata
        WHERE provider = ${metadata.provider}
          AND provider_id = ${metadata.provider_id}
          AND content_type = ${metadata.content_type}
          AND season_number IS NULL
          AND episode_number IS NULL
      `;

      if (existing) {
        await db.exec`
          UPDATE content_metadata SET
            title = ${strOrNull(metadata.title)},
            original_title = ${strOrNull(metadata.original_title)},
            overview = ${strOrNull(metadata.overview)},
            release_date = ${strOrNull(metadata.release_date)},
            poster_path = ${strOrNull(metadata.poster_path)},
            backdrop_path = ${strOrNull(metadata.backdrop_path)},
            vote_average = NULL,
            vote_count = ${numOrNull(metadata.vote_count)},
            popularity = NULL,
            original_language = ${strOrNull(metadata.original_language)},
            genres = ${jsonOrNull(metadata.genres)},
            production_companies = ${jsonOrNull(metadata.production_companies)},
            runtime = ${numOrNull(metadata.runtime)},
            status = ${strOrNull(metadata.status)},
            tagline = ${strOrNull(metadata.tagline)},
            number_of_seasons = CAST(${numOrNull(
              metadata.number_of_seasons
            )} AS INTEGER),
            number_of_episodes = CAST(${numOrNull(
              metadata.number_of_episodes
            )} AS INTEGER),
            first_air_date = ${strOrNull(metadata.first_air_date)},
            last_air_date = ${strOrNull(metadata.last_air_date)},
            episode_run_time = ${jsonOrNull(metadata.episode_run_time)},
            networks = ${jsonOrNull(metadata.networks)},
            created_by = ${jsonOrNull(metadata.created_by)},
            season_number = CAST(${numOrNull(
              metadata.season_number
            )} AS INTEGER),
            air_date = ${strOrNull(metadata.air_date)},
            episode_number = CAST(${numOrNull(
              metadata.episode_number
            )} AS INTEGER),
            parent_provider_id = ${strOrNull(metadata.parent_provider_id)},
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
      } else {
        try {
          await db.exec`
            INSERT INTO content_metadata (
              provider, provider_id, content_type, title, original_title, overview,
              release_date, poster_path, backdrop_path, vote_average, vote_count,
              popularity, original_language, genres, production_companies, runtime,
              status, tagline, number_of_seasons, number_of_episodes, first_air_date,
              last_air_date, episode_run_time, networks, created_by, season_number,
              air_date, episode_number, parent_provider_id, external_ids, videos, images,
              "cast", crew, keywords, raw_response, fetched_at, updated_at
            ) VALUES (
              ${metadata.provider}, ${metadata.provider_id}, ${
            metadata.content_type
          },
              ${strOrNull(metadata.title)}, ${strOrNull(
            metadata.original_title
          )}, ${strOrNull(metadata.overview)},
              ${strOrNull(metadata.release_date)}, ${strOrNull(
            metadata.poster_path
          )}, ${strOrNull(metadata.backdrop_path)},
              NULL, ${numOrNull(metadata.vote_count)}, NULL, ${strOrNull(
            metadata.original_language
          )},
              ${jsonOrNull(metadata.genres)}, ${jsonOrNull(
            metadata.production_companies
          )}, ${numOrNull(metadata.runtime)},
              ${strOrNull(metadata.status)}, ${strOrNull(metadata.tagline)},
              CAST(${numOrNull(metadata.number_of_seasons)} AS INTEGER),
              CAST(${numOrNull(metadata.number_of_episodes)} AS INTEGER),
              ${strOrNull(metadata.first_air_date)}, ${strOrNull(
            metadata.last_air_date
          )},
              ${jsonOrNull(metadata.episode_run_time)}, ${jsonOrNull(
            metadata.networks
          )}, ${jsonOrNull(metadata.created_by)},
              CAST(${numOrNull(
                metadata.season_number
              )} AS INTEGER), ${strOrNull(metadata.air_date)},
              CAST(${numOrNull(
                metadata.episode_number
              )} AS INTEGER), ${strOrNull(metadata.parent_provider_id)},
              ${jsonOrNull(metadata.external_ids)}, ${jsonOrNull(
            metadata.videos
          )}, ${jsonOrNull(metadata.images)},
              ${jsonOrNull(metadata.cast)}, ${jsonOrNull(
            metadata.crew
          )}, ${jsonOrNull(metadata.keywords)},
              ${jsonOrNull(metadata.raw_response)}, ${metadata.fetched_at}, ${
            metadata.updated_at
          }
            )
          `;
        } catch (e) {
          // In case of a concurrent insert, fall back to update
          const existing2 = await db.queryRow<{ id: number }>`
            SELECT id FROM content_metadata
            WHERE provider = ${metadata.provider}
              AND provider_id = ${metadata.provider_id}
              AND content_type = ${metadata.content_type}
              AND season_number IS NULL
              AND episode_number IS NULL
          `;
          if (existing2) {
            await db.exec`UPDATE content_metadata SET updated_at = ${metadata.updated_at} WHERE id = ${existing2.id}`;
          }
        }
      }
    } else if (content_type === 'season') {
      const existing = await db.queryRow<{ id: number }>`
        SELECT id FROM content_metadata
        WHERE provider = ${metadata.provider}
          AND content_type = 'season'
          AND parent_provider_id = ${strOrNull(metadata.parent_provider_id)}
          AND season_number = CAST(${numOrNull(
            metadata.season_number
          )} AS INTEGER)
      `;

      if (existing) {
        await db.exec`
          UPDATE content_metadata SET
            title = ${strOrNull(metadata.title)},
            original_title = ${strOrNull(metadata.original_title)},
            overview = ${strOrNull(metadata.overview)},
            release_date = ${strOrNull(metadata.release_date)},
            poster_path = ${strOrNull(metadata.poster_path)},
            backdrop_path = ${strOrNull(metadata.backdrop_path)},
            vote_average = NULL,
            vote_count = ${numOrNull(metadata.vote_count)},
            popularity = NULL,
            original_language = ${strOrNull(metadata.original_language)},
            genres = ${jsonOrNull(metadata.genres)},
            production_companies = ${jsonOrNull(metadata.production_companies)},
            runtime = ${numOrNull(metadata.runtime)},
            status = ${strOrNull(metadata.status)},
            tagline = ${strOrNull(metadata.tagline)},
            number_of_seasons = CAST(${numOrNull(
              metadata.number_of_seasons
            )} AS INTEGER),
            number_of_episodes = CAST(${numOrNull(
              metadata.number_of_episodes
            )} AS INTEGER),
            first_air_date = ${strOrNull(metadata.first_air_date)},
            last_air_date = ${strOrNull(metadata.last_air_date)},
            episode_run_time = ${jsonOrNull(metadata.episode_run_time)},
            networks = ${jsonOrNull(metadata.networks)},
            created_by = ${jsonOrNull(metadata.created_by)},
            season_number = CAST(${numOrNull(
              metadata.season_number
            )} AS INTEGER),
            air_date = ${strOrNull(metadata.air_date)},
            episode_number = CAST(${numOrNull(
              metadata.episode_number
            )} AS INTEGER),
            parent_provider_id = ${strOrNull(metadata.parent_provider_id)},
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
      } else {
        try {
          await db.exec`
            INSERT INTO content_metadata (
              provider, provider_id, content_type, title, original_title, overview,
              release_date, poster_path, backdrop_path, vote_average, vote_count,
              popularity, original_language, genres, production_companies, runtime,
              status, tagline, number_of_seasons, number_of_episodes, first_air_date,
              last_air_date, episode_run_time, networks, created_by, season_number,
              air_date, episode_number, parent_provider_id, external_ids, videos, images,
              "cast", crew, keywords, raw_response, fetched_at, updated_at
            ) VALUES (
              ${metadata.provider}, ${metadata.provider_id}, ${
            metadata.content_type
          },
              ${strOrNull(metadata.title)}, ${strOrNull(
            metadata.original_title
          )}, ${strOrNull(metadata.overview)},
              ${strOrNull(metadata.release_date)}, ${strOrNull(
            metadata.poster_path
          )}, ${strOrNull(metadata.backdrop_path)},
              NULL, ${numOrNull(metadata.vote_count)}, NULL, ${strOrNull(
            metadata.original_language
          )},
              ${jsonOrNull(metadata.genres)}, ${jsonOrNull(
            metadata.production_companies
          )}, ${numOrNull(metadata.runtime)},
              ${strOrNull(metadata.status)}, ${strOrNull(metadata.tagline)},
              CAST(${numOrNull(metadata.number_of_seasons)} AS INTEGER),
              CAST(${numOrNull(metadata.number_of_episodes)} AS INTEGER),
              ${strOrNull(metadata.first_air_date)}, ${strOrNull(
            metadata.last_air_date
          )},
              ${jsonOrNull(metadata.episode_run_time)}, ${jsonOrNull(
            metadata.networks
          )}, ${jsonOrNull(metadata.created_by)},
              CAST(${numOrNull(
                metadata.season_number
              )} AS INTEGER), ${strOrNull(metadata.air_date)},
              CAST(${numOrNull(
                metadata.episode_number
              )} AS INTEGER), ${strOrNull(metadata.parent_provider_id)},
              ${jsonOrNull(metadata.external_ids)}, ${jsonOrNull(
            metadata.videos
          )}, ${jsonOrNull(metadata.images)},
              ${jsonOrNull(metadata.cast)}, ${jsonOrNull(
            metadata.crew
          )}, ${jsonOrNull(metadata.keywords)},
              ${jsonOrNull(metadata.raw_response)}, ${metadata.fetched_at}, ${
            metadata.updated_at
          }
            )
          `;
        } catch (e) {
          const existing2 = await db.queryRow<{ id: number }>`
            SELECT id FROM content_metadata
            WHERE provider = ${metadata.provider}
              AND content_type = 'season'
              AND parent_provider_id = ${strOrNull(metadata.parent_provider_id)}
              AND season_number = CAST(${numOrNull(
                metadata.season_number
              )} AS INTEGER)
          `;
          if (existing2) {
            await db.exec`UPDATE content_metadata SET updated_at = ${metadata.updated_at} WHERE id = ${existing2.id}`;
          }
        }
      }
    } else {
      // episode
      const existing = await db.queryRow<{ id: number }>`
        SELECT id FROM content_metadata
        WHERE provider = ${metadata.provider}
          AND content_type = 'episode'
          AND parent_provider_id = ${strOrNull(metadata.parent_provider_id)}
          AND season_number = CAST(${numOrNull(
            metadata.season_number
          )} AS INTEGER)
          AND episode_number = CAST(${numOrNull(
            metadata.episode_number
          )} AS INTEGER)
      `;

      if (existing) {
        await db.exec`
          UPDATE content_metadata SET
            title = ${strOrNull(metadata.title)},
            original_title = ${strOrNull(metadata.original_title)},
            overview = ${strOrNull(metadata.overview)},
            release_date = ${strOrNull(metadata.release_date)},
            poster_path = ${strOrNull(metadata.poster_path)},
            backdrop_path = ${strOrNull(metadata.backdrop_path)},
            vote_average = NULL,
            vote_count = ${numOrNull(metadata.vote_count)},
            popularity = NULL,
            original_language = ${strOrNull(metadata.original_language)},
            genres = ${jsonOrNull(metadata.genres)},
            production_companies = ${jsonOrNull(metadata.production_companies)},
            runtime = ${numOrNull(metadata.runtime)},
            status = ${strOrNull(metadata.status)},
            tagline = ${strOrNull(metadata.tagline)},
            number_of_seasons = CAST(${numOrNull(
              metadata.number_of_seasons
            )} AS INTEGER),
            number_of_episodes = CAST(${numOrNull(
              metadata.number_of_episodes
            )} AS INTEGER),
            first_air_date = ${strOrNull(metadata.first_air_date)},
            last_air_date = ${strOrNull(metadata.last_air_date)},
            episode_run_time = ${jsonOrNull(metadata.episode_run_time)},
            networks = ${jsonOrNull(metadata.networks)},
            created_by = ${jsonOrNull(metadata.created_by)},
            season_number = CAST(${numOrNull(
              metadata.season_number
            )} AS INTEGER),
            air_date = ${strOrNull(metadata.air_date)},
            episode_number = CAST(${numOrNull(
              metadata.episode_number
            )} AS INTEGER),
            parent_provider_id = ${strOrNull(metadata.parent_provider_id)},
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
      } else {
        try {
          await db.exec`
            INSERT INTO content_metadata (
              provider, provider_id, content_type, title, original_title, overview,
              release_date, poster_path, backdrop_path, vote_average, vote_count,
              popularity, original_language, genres, production_companies, runtime,
              status, tagline, number_of_seasons, number_of_episodes, first_air_date,
              last_air_date, episode_run_time, networks, created_by, season_number,
              air_date, episode_number, parent_provider_id, external_ids, videos, images,
              "cast", crew, keywords, raw_response, fetched_at, updated_at
            ) VALUES (
              ${metadata.provider}, ${metadata.provider_id}, ${
            metadata.content_type
          },
              ${strOrNull(metadata.title)}, ${strOrNull(
            metadata.original_title
          )}, ${strOrNull(metadata.overview)},
              ${strOrNull(metadata.release_date)}, ${strOrNull(
            metadata.poster_path
          )}, ${strOrNull(metadata.backdrop_path)},
              NULL, ${numOrNull(metadata.vote_count)}, NULL, ${strOrNull(
            metadata.original_language
          )},
              ${jsonOrNull(metadata.genres)}, ${jsonOrNull(
            metadata.production_companies
          )}, ${numOrNull(metadata.runtime)},
              ${strOrNull(metadata.status)}, ${strOrNull(metadata.tagline)},
              CAST(${numOrNull(metadata.number_of_seasons)} AS INTEGER),
              CAST(${numOrNull(metadata.number_of_episodes)} AS INTEGER),
              ${strOrNull(metadata.first_air_date)}, ${strOrNull(
            metadata.last_air_date
          )},
              ${jsonOrNull(metadata.episode_run_time)}, ${jsonOrNull(
            metadata.networks
          )}, ${jsonOrNull(metadata.created_by)},
              CAST(${numOrNull(
                metadata.season_number
              )} AS INTEGER), ${strOrNull(metadata.air_date)},
              CAST(${numOrNull(
                metadata.episode_number
              )} AS INTEGER), ${strOrNull(metadata.parent_provider_id)},
              ${jsonOrNull(metadata.external_ids)}, ${jsonOrNull(
            metadata.videos
          )}, ${jsonOrNull(metadata.images)},
              ${jsonOrNull(metadata.cast)}, ${jsonOrNull(
            metadata.crew
          )}, ${jsonOrNull(metadata.keywords)},
              ${jsonOrNull(metadata.raw_response)}, ${metadata.fetched_at}, ${
            metadata.updated_at
          }
            )
          `;
        } catch (e) {
          const existing2 = await db.queryRow<{ id: number }>`
            SELECT id FROM content_metadata
            WHERE provider = ${metadata.provider}
              AND content_type = 'episode'
              AND parent_provider_id = ${strOrNull(metadata.parent_provider_id)}
              AND season_number = CAST(${numOrNull(
                metadata.season_number
              )} AS INTEGER)
              AND episode_number = CAST(${numOrNull(
                metadata.episode_number
              )} AS INTEGER)
          `;
          if (existing2) {
            await db.exec`UPDATE content_metadata SET updated_at = ${metadata.updated_at} WHERE id = ${existing2.id}`;
          }
        }
      }
    }
    return metadata;
  }
);

// Get metadata by external ID (TMDB, IMDB, etc.)
export const getMetadataByExternalId = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/metadata/by-external-id',
  },
  async (params: GetMetadataByExternalIdParams): Promise<ContentMetadata> => {
    const { tmdb_id, imdb_id, tvdb_id, content_type, force_refresh } = params;

    // First, try to find in cache by external ID
    if (!force_refresh) {
      let cached: ContentMetadata | null = null;

      if (tmdb_id) {
        cached = await db.queryRow<ContentMetadata>`
          SELECT * FROM content_metadata
          WHERE external_ids->>'tmdb_id' = ${String(tmdb_id)}
            AND content_type = ${content_type}
        `;
      } else if (imdb_id) {
        cached = await db.queryRow<ContentMetadata>`
          SELECT * FROM content_metadata
          WHERE external_ids->>'imdb_id' = ${imdb_id}
            AND content_type = ${content_type}
        `;
      } else if (tvdb_id) {
        cached = await db.queryRow<ContentMetadata>`
          SELECT * FROM content_metadata
          WHERE external_ids->>'tvdb_id' = ${String(tvdb_id)}
            AND content_type = ${content_type}
        `;
      }

      if (cached && isCacheValid(cached.fetched_at!)) {
        return cached;
      }
    }

    // If not in cache or expired, fetch from provider
    if (tmdb_id) {
      return getMetadata({
        provider: 'tmdb',
        provider_id: String(tmdb_id),
        content_type,
        force_refresh,
      });
    }

    // For IMDB/TVDB, we'd need to implement search or mapping logic
    throw APIError.invalidArgument(
      'Currently only TMDB ID lookups are supported'
    );
  }
);

// Search for content
export const search = api(
  { expose: true, auth: false, method: 'GET', path: '/metadata/search' },
  async (params: SearchParams): Promise<SearchResult> => {
    const {
      query,
      content_type,
      provider = 'tmdb',
      year,
      page,
      language,
    } = params;

    if (provider !== 'tmdb') {
      throw APIError.invalidArgument(
        `Provider ${provider} is not yet supported for search`
      );
    }

    const client = await getTMDBClient();

    try {
      let result: any;

      switch (content_type) {
        case 'movie':
          result = await client.searchMovies(query, year, page, language);
          break;

        case 'tv':
          result = await client.searchTV(query, year, page, language);
          break;

        default:
          result = await client.searchMulti(query, page, language);
      }

      return {
        provider,
        page: result.page,
        results: result.results,
        total_pages: result.total_pages,
        total_results: result.total_results,
      };
    } catch (error: any) {
      throw APIError.internal(`Failed to search ${provider}: ${error.message}`);
    }
  }
);

// Get cached metadata by various criteria
export const getCachedMetadata = api(
  { expose: false, method: 'GET', path: '/metadata/cached' },
  async (params: {
    provider?: MetadataProvider;
    content_type?: ContentType;
    title?: string;
    limit?: number;
  }): Promise<{ items: ContentMetadata[] }> => {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.provider) {
      conditions.push(`provider = $${values.length + 1}`);
      values.push(params.provider);
    }

    if (params.content_type) {
      conditions.push(`content_type = $${values.length + 1}`);
      values.push(params.content_type);
    }

    if (params.title) {
      conditions.push(`title ILIKE $${values.length + 1}`);
      values.push(`%${params.title}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = params.limit ? `LIMIT ${params.limit}` : 'LIMIT 100';

    const rows = db.query<ContentMetadata>`
      SELECT * FROM content_metadata
      ${whereClause}
      ORDER BY updated_at DESC
      ${limitClause}
    `;

    const items: ContentMetadata[] = [];
    for await (const row of rows) {
      items.push(row);
    }

    return { items };
  }
);

// Clear cache for specific content
export const clearCache = api(
  { expose: false, method: 'DELETE', path: '/metadata/cache' },
  async (params: {
    provider?: MetadataProvider;
    provider_id?: string;
    content_type?: ContentType;
    older_than_days?: number;
  }): Promise<{ deleted: number }> => {
    let deleteQuery = `DELETE FROM content_metadata WHERE 1=1`;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.provider) {
      conditions.push(`provider = $${values.length + 1}`);
      values.push(params.provider);
    }

    if (params.provider_id) {
      conditions.push(`provider_id = $${values.length + 1}`);
      values.push(params.provider_id);
    }

    if (params.content_type) {
      conditions.push(`content_type = $${values.length + 1}`);
      values.push(params.content_type);
    }

    if (params.older_than_days) {
      // Use parameterized interval by concatenation to avoid template type error
      const paramIndex = values.length + 1;
      conditions.push(
        `fetched_at < NOW() - ($${paramIndex} || ' days')::interval`
      );
      values.push(String(params.older_than_days));
    }

    if (conditions.length > 0) {
      deleteQuery += ` AND ${conditions.join(' AND ')}`;
    }

    // @ts-ignore encore sqldb exec expects a tagged template; this dynamic build is safe here
    await db.exec(deleteQuery, ...values);
    return { deleted: 0 };
  }
);
