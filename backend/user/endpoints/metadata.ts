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
    content_type,
    season_number,
    episode_number,
    force_refresh,
    append_to_response,
  }: {
    tmdb_id: number;
    content_type: ContentType;
    season_number?: number;
    episode_number?: number;
    force_refresh?: boolean;
    append_to_response?: string;
  }): Promise<ContentMetadata> => {
    log.info('Fetching metadata via user service', {
      tmdb_id,
      content_type,
      season_number,
      episode_number,
      force_refresh,
      append_to_response,
    });

    const metadata = await getMetadata({
      provider: 'tmdb',
      provider_id: String(tmdb_id),
      content_type,
      season_number,
      episode_number,
      // Default to force refresh to bypass cache select (numeric decode issue)
      force_refresh: force_refresh ?? true,
      append_to_response,
    });

    return metadata;
  }
);
