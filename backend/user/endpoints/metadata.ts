import { api } from 'encore.dev/api';
import log from 'encore.dev/log';
import { getMetadata, ContentMetadata } from '../../metadata';

type ContentType = 'movie' | 'tv' | 'season' | 'episode';

export const getMetadataForContent = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/user/metadata',
  },
  async ({
    tmdb_id,
    title, // 🆕 Add title parameter
    content_type,
    season_number,
    episode_number,
    force_refresh,
    append_to_response,
  }: {
    tmdb_id?: number; // 🆕 Make optional
    title?: string; // 🆕 Add title
    content_type: ContentType;
    season_number?: number;
    episode_number?: number;
    force_refresh?: boolean;
    append_to_response?: string;
  }): Promise<ContentMetadata> => {
    // 🆕 Enhanced logging for title-based requests
    log.info('🎬 METADATA REQUEST FROM FRONTEND', {
      tmdb_id,
      title,
      content_type,
      season_number,
      episode_number,
      force_refresh,
      append_to_response,
      hasTmdbId: !!tmdb_id,
      hasTitle: !!title,
      requestType: tmdb_id ? 'TMDB_ID' : 'TITLE_ONLY',
    });

    // 🆕 Handle title-based requests
    if (!tmdb_id && title) {
      log.info('📝 Processing title-based metadata request', {
        title,
        content_type,
      });

      // 🆕 Try to enrich with title-based search first
      try {
        log.info('🔍 Attempting title-based enrichment', {
          title,
          content_type,
        });

        // Import enrichment function
        const { enrichWithExternalAPIs } = await import(
          '../../metadata/enrichment'
        );

        // Call enrichment with title - this will search TMDB and enrich
        const enrichmentData = await enrichWithExternalAPIs({
          content_type: content_type as 'movie' | 'tv',
          title: title,
        });

        // If enrichment found a TMDB ID, fetch full metadata
        if (enrichmentData.tmdb_id && enrichmentData.tmdb_id > 0) {
          log.info(
            '🎯 Found TMDB ID via title search, fetching full metadata',
            {
              title,
              found_tmdb_id: enrichmentData.tmdb_id,
            }
          );

          // Fetch full metadata using the found TMDB ID
          const metadata = await getMetadata({
            provider: 'tmdb',
            provider_id: String(enrichmentData.tmdb_id),
            content_type,
            force_refresh: force_refresh ?? false,
            append_to_response,
          });

          // Add enrichment data to the response
          (metadata as any).enrichment = enrichmentData;
          return metadata;
        } else {
          // No TMDB ID found, return basic metadata with enrichment
          log.info(
            '📝 No TMDB ID found, returning basic metadata with enrichment',
            {
              title,
              content_type,
            }
          );

          const basicMetadata: ContentMetadata = {
            id: 0,
            provider: 'custom',
            provider_id: title,
            content_type,
            title: title,
              fetched_at: new Date(),
            updated_at: new Date(),
            external_ids: {},
          };

          // Add enrichment data
          (basicMetadata as any).enrichment = enrichmentData;
          return basicMetadata;
        }
      } catch (error) {
        log.warn('Title-based enrichment failed, returning basic metadata', {
          error,
          title,
        });

        // Return basic metadata without enrichment
        const basicMetadata: ContentMetadata = {
          id: 0,
          provider: 'custom',
          provider_id: title,
          content_type,
          title: title,
          fetched_at: new Date(),
          updated_at: new Date(),
          external_ids: {},
        };

        return basicMetadata;
      }
    }

    // 🆕 Handle TMDB ID requests (existing flow)
    if (tmdb_id) {
      log.info('🎯 Processing TMDB ID-based metadata request', {
        tmdb_id,
        content_type,
      });

      const metadata = await getMetadata({
        provider: 'tmdb',
        provider_id: String(tmdb_id),
        content_type,
        season_number,
        episode_number,
        force_refresh: force_refresh ?? false,
        append_to_response,
      });

      return metadata;
    }

    // 🆕 Neither TMDB ID nor title provided
    throw new Error('Either tmdb_id or title is required');
  }
);
