import { api } from 'encore.dev/api';
import log from 'encore.dev/log';
import { metadataDB } from '../db';
import { ContentMetadata } from '../types';
import { getMetadata } from './get-metadata';

interface GetContentParams {
  tmdb_id?: number;
  title?: string;
  content_type?: 'movie' | 'tv';
}

interface GetContentResponse {
  metadata: ContentMetadata | null;
  enrichment: any | null;
}

// Simplified endpoint - just pass TMDB ID or title, get everything we have
export const getContent = api(
  { expose: true, auth: false, method: 'GET', path: '/content' },
  async (params: GetContentParams): Promise<GetContentResponse> => {
    const { tmdb_id, title, content_type = 'movie' } = params;

    if (!tmdb_id && !title) {
      throw new Error('Either tmdb_id or title must be provided');
    }

    // First try to find by TMDB ID
    if (tmdb_id) {
      const cached = await metadataDB.queryRow<ContentMetadata>`
        SELECT * FROM content_metadata
        WHERE (external_ids->>'tmdb_id')::INTEGER = ${tmdb_id}
          AND content_type = ${content_type}
        LIMIT 1
      `;

      if (cached) {
        log.info('Found content by TMDB ID', { tmdb_id, content_type });
        
        // Get enrichment data if it exists
        const enrichment = await metadataDB.queryRow`
          SELECT * FROM content_enrichment
          WHERE tmdb_id = ${tmdb_id}
            AND content_type = ${content_type}
        `;

        return {
          metadata: parseMetadataFields(cached),
          enrichment,
        };
      }

      // Not in cache, fetch from TMDB
      try {
        const metadata = await getMetadata({
          provider: 'tmdb',
          provider_id: String(tmdb_id),
          content_type,
        });

        return {
          metadata,
          enrichment: (metadata as any).enrichment || null,
        };
      } catch (error) {
        log.error('Failed to fetch from TMDB', { error, tmdb_id });
      }
    }

    // Try to find by title
    if (title) {
      const cached = await metadataDB.queryRow<ContentMetadata>`
        SELECT * FROM content_metadata
        WHERE LOWER(title) = LOWER(${title})
          AND content_type = ${content_type}
        ORDER BY fetched_at DESC
        LIMIT 1
      `;

      if (cached) {
        log.info('Found content by title', { title, content_type });
        
        // Get enrichment data if it exists
        const tmdbId = cached.external_ids?.tmdb_id;
        let enrichment = null;
        
        if (tmdbId) {
          enrichment = await metadataDB.queryRow`
            SELECT * FROM content_enrichment
            WHERE tmdb_id = ${tmdbId}
              AND content_type = ${content_type}
          `;
        }

        return {
          metadata: parseMetadataFields(cached),
          enrichment,
        };
      }
    }

    // Nothing found
    return {
      metadata: null,
      enrichment: null,
    };
  }
);

// Helper to parse JSONB fields properly
function parseMetadataFields(metadata: ContentMetadata): ContentMetadata {
  const parseJsonField = (field: any): any => {
    if (field === null || field === undefined) return field;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    }
    return field;
  };

  // Parse numeric fields
  if (metadata.vote_average !== null && metadata.vote_average !== undefined) {
    metadata.vote_average = Number(metadata.vote_average);
  }
  if (metadata.popularity !== null && metadata.popularity !== undefined) {
    metadata.popularity = Number(metadata.popularity);
  }

  // Parse JSONB fields
  metadata.genres = parseJsonField(metadata.genres);
  metadata.production_companies = parseJsonField(metadata.production_companies);
  metadata.episode_run_time = parseJsonField(metadata.episode_run_time);
  metadata.networks = parseJsonField(metadata.networks);
  metadata.created_by = parseJsonField(metadata.created_by);
  metadata.external_ids = parseJsonField(metadata.external_ids);
  metadata.videos = parseJsonField(metadata.videos);
  metadata.images = parseJsonField(metadata.images);
  metadata.cast = parseJsonField(metadata.cast);
  metadata.crew = parseJsonField(metadata.crew);
  metadata.keywords = parseJsonField(metadata.keywords);
  metadata.ratings = parseJsonField((metadata as any).ratings);
  
  // Don't return raw_response - it's huge and not needed
  delete (metadata as any).raw_response;

  // Reconstruct credits for backward compatibility
  if (metadata.cast || metadata.crew) {
    (metadata as any).credits = {
      cast: metadata.cast || [],
      crew: metadata.crew || [],
    };
  }

  return metadata;
}