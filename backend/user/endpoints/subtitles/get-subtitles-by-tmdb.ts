import { api, APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { getAuthData } from '~encore/auth';

import { getMetadataSubtitlesByTmdb } from '../../../metadata/endpoints/subtitles/get-subtitles-by-tmdb';

export interface Subtitle {
  id: string;
  language_code: string;
  language_name: string;
  content: string;
  source?: string;
}

// GET /subtitles/tmdb/:tmdbId — auth user -> return all subtitles with content for tmdbId
export const getSubtitlesByTmdb = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/subtitles/tmdb/:tmdbId',
  },
  async ({ tmdbId, provider }: { tmdbId: number; provider?: 'opensubs' | 'subdl' | 'all' }): Promise<{ subtitles: Subtitle[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    try {
      const { subtitles } = await getMetadataSubtitlesByTmdb({ tmdbId, provider });
      return { subtitles };
    } catch (error) {
      log.error(error, 'Error fetching subtitles by TMDB');
      return { subtitles: [] };
    }
  }
);

