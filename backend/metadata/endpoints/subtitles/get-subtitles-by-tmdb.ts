import { api } from 'encore.dev/api';
import log from 'encore.dev/log';
import { secret } from 'encore.dev/config';

import { createSubtitleService, type SubtitleSearchParams } from '../../subtitles/service';

const openSubtitlesApiKey = secret('OpenSubtitles');
const subDLApiKey = secret('SubDlApiKey');

export interface Subtitle {
  id: string;
  language_code: string;
  language_name: string;
  content: string;
  source?: string;
}

// Internal metadata endpoint: ensure subtitles exist (fetch if missing), return all with content
export const getMetadataSubtitlesByTmdb = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/metadata/subtitles/tmdb/:tmdbId',
  },
  async ({ tmdbId, provider }: { tmdbId: number; provider?: 'opensubs' | 'subdl' | 'all' }): Promise<{ subtitles: Subtitle[] }> => {
    const searchParams: SubtitleSearchParams = {
      tmdb_id: tmdbId,
      preferred_provider: provider || 'all',
    };

    try {
      const subtitleService = createSubtitleService(
        await openSubtitlesApiKey(),
        await subDLApiKey()
      );

      // 1) Ensure metadata exists and list languages
      const languages = await subtitleService.getAvailableLanguages(String(tmdbId), searchParams);

      // 2) For each language, ensure content exists and return it
      const subtitles: Subtitle[] = [];
      for (const lang of languages) {
        try {
          const content = await subtitleService.getSubtitleContent(String(tmdbId), lang.code.toLowerCase(), searchParams);
          if (content) {
            subtitles.push({
              id: content.id,
              language_code: content.language_code,
              language_name: content.language_name,
              content: content.content,
              source: content.source,
            });
          }
        } catch (e) {
          log.error(e, `Failed to get content for ${lang.code}`);
        }
      }

      return { subtitles };
    } catch (error) {
      log.error(error, 'metadata getSubtitlesByTmdb failed');
      return { subtitles: [] };
    }
  }
);

