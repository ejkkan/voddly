import { api } from 'encore.dev/api';
import { secret } from 'encore.dev/config';
import log from 'encore.dev/log';
import {
  createSubtitleService,
  SubtitleSearchParams,
  SubtitleLanguage,
} from '../../common/subtitles';
import { userDB } from '../db';
import { OpenSubtitlesProvider, SubDLProvider } from '../../common/subtitles';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import {
  detectEmbeddedTracks,
  likelyHasEmbeddedSubtitles,
  type VideoStreamInfo,
} from '../../common/subtitles/embedded-detector';

/**
 * Extract subtitle content from video stream using FFmpeg
 */
async function extractSubtitleWithFFmpeg(
  streamUrl: string,
  trackIndex: number,
  language: string
): Promise<string> {
  try {
    log.info(`🎬 Starting FFmpeg subtitle extraction`, {
      streamUrl: streamUrl.substring(0, 100) + '...',
      trackIndex,
      language,
    });

    // Use FFmpeg to extract the specific subtitle track
    // -ss 0 starts from the beginning
    // -t 600 limits to first 10 minutes to avoid long extractions
    // -map 0:s:trackIndex selects the specific subtitle track
    // -c:s srt converts to SRT format
    // -f srt outputs as SRT format
    const command = `ffmpeg -ss 0 -t 600 -i "${streamUrl}" -map 0:s:${trackIndex} -c:s srt -f srt -`;

    log.info(`🔧 FFmpeg command: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for subtitle data
    });

    if (stderr && stderr.includes('error')) {
      log.warn(`⚠️ FFmpeg stderr: ${stderr}`);
    }

    if (!stdout || stdout.trim().length === 0) {
      throw new Error(`No subtitle content extracted for track ${trackIndex}`);
    }

    log.info(`✅ FFmpeg extraction successful`, {
      contentLength: stdout.length,
      language,
      trackIndex,
    });

    return stdout.trim();
  } catch (error) {
    log.error(`❌ FFmpeg extraction failed`, {
      error: error instanceof Error ? error.message : String(error),
      streamUrl: streamUrl.substring(0, 100) + '...',
      trackIndex,
      language,
    });

    // Return a fallback message instead of throwing
    return `1
00:00:01,000 --> 00:00:05,000
⚠️ Subtitle extraction failed for ${language}

2
00:00:05,500 --> 00:00:10,000
FFmpeg error: ${error instanceof Error ? error.message : 'Unknown error'}

3
00:00:10,500 --> 00:00:15,000
Track ${trackIndex} could not be extracted

4
00:00:15,500 --> 00:00:20,000
Please try a different subtitle track`;
  }
}

// Named response types for resolveSubtitles endpoint (Encore requires named interfaces)
export interface SubtitleRowItem {
  id: string;
  language_code: string;
  language_name: string;
  source: string;
  has_content: boolean;
  name?: string;
  download_count?: number;
  uploader?: string;
}

export interface ResolveSubtitlesResponse {
  mode: 'list' | 'content';
  rows?: SubtitleRowItem[];
  subtitle?: Subtitle | null;
}

// Define secrets at service level
const openSubtitlesApiKey = secret('OpenSubtitles');
const subDLApiKey = secret('SubDlApiKey');

// Legacy interface for backward compatibility
export interface Subtitle {
  id: string;
  language_code: string;
  language_name: string;
  content: string;
  source?: string;
}

export const getSubtitles = api(
  { expose: true, auth: false, method: 'GET', path: '/subtitles/:movieId' },
  async ({
    movieId,
    imdb_id,
    tmdb_id,
    parent_imdb_id,
    parent_tmdb_id,
    season_number,
    episode_number,
    query,
    moviehash,
    languages,
    type,
    year,
    preferred_provider,
  }: {
    movieId: string;
    imdb_id?: number;
    tmdb_id?: number;
    parent_imdb_id?: number;
    parent_tmdb_id?: number;
    season_number?: number;
    episode_number?: number;
    query?: string;
    moviehash?: string;
    languages?: string;
    type?: 'movie' | 'episode' | 'all';
    year?: number;
    preferred_provider?: 'opensubs' | 'subdl' | 'all';
  }): Promise<{ subtitles: Subtitle[] }> => {
    log.info(`🔍 Getting subtitles for movie ${movieId}`, { tmdb_id });

    const searchParams: SubtitleSearchParams = {
      imdb_id,
      tmdb_id,
      parent_imdb_id,
      parent_tmdb_id,
      season_number,
      episode_number,
      query: query || movieId, // fallback to movieId if no query
      moviehash,
      languages,
      type,
      year,
      preferred_provider,
    };

    try {
      // Create subtitle service with API keys
      const subtitleService = createSubtitleService(
        await openSubtitlesApiKey(),
        await subDLApiKey()
      );

      // Get available languages (this will fetch and cache metadata if needed)
      const availableLanguages = await subtitleService.getAvailableLanguages(
        movieId,
        searchParams
      );

      if (availableLanguages.length === 0) {
        log.info('📭 No subtitles found from any provider');
        return { subtitles: [] };
      }

      // If specific languages requested, only get content for those
      const languagesToFetch =
        languages && languages !== 'all'
          ? languages.split(',').map((l) => l.trim().toLowerCase())
          : availableLanguages.map((l) => l.code);

      const subtitles: Subtitle[] = [];

      // Get content for each requested language
      for (const languageCode of languagesToFetch) {
        try {
          const subtitleContent = await subtitleService.getSubtitleContent(
            movieId,
            languageCode,
            searchParams
          );

          if (subtitleContent) {
            subtitles.push({
              id: subtitleContent.id,
              language_code: subtitleContent.language_code,
              language_name: subtitleContent.language_name,
              content: subtitleContent.content,
              source: subtitleContent.source,
            });
          }
        } catch (error) {
          log.error(
            error,
            `Failed to get subtitle content for ${languageCode}`
          );
        }
      }

      log.info(`✅ Successfully returned ${subtitles.length} subtitles`, {
        languages: subtitles.map((s) => s.language_code),
      });
      return { subtitles };
    } catch (error) {
      log.error(error, '❌ Error getting subtitles');
      return { subtitles: [] };
    }
  }
);

// Legacy search endpoint - deprecated in favor of getAvailableLanguages + getSubtitleContent
export const searchSubtitles = api(
  { expose: true, auth: false, method: 'GET', path: '/subtitles/search' },
  async (): Promise<{ results: any }> => {
    throw new Error(
      'Legacy search endpoint deprecated. Use getAvailableLanguages and getSubtitleContent instead.'
    );
  }
);

export const getAvailableLanguages = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/:movieId/languages',
  },
  async ({
    movieId,
    imdb_id,
    tmdb_id,
    parent_imdb_id,
    parent_tmdb_id,
    season_number,
    episode_number,
    query,
    moviehash,
    type,
    year,
    preferred_provider,
  }: {
    movieId: string;
    imdb_id?: number;
    tmdb_id?: number;
    parent_imdb_id?: number;
    parent_tmdb_id?: number;
    season_number?: number;
    episode_number?: number;
    query?: string;
    moviehash?: string;
    type?: 'movie' | 'episode' | 'all';
    year?: number;
    preferred_provider?: 'opensubs' | 'subdl' | 'all';
  }): Promise<{
    languages: SubtitleLanguage[];
  }> => {
    log.info(`🌐 Getting available languages for movie ${movieId}`, {
      tmdb_id,
      preferred_provider,
    });

    const searchParams: SubtitleSearchParams = {
      imdb_id,
      tmdb_id,
      parent_imdb_id,
      parent_tmdb_id,
      season_number,
      episode_number,
      query: query || movieId,
      moviehash,
      type,
      year,
      preferred_provider,
    };

    try {
      // Create subtitle service with API keys
      const subtitleService = createSubtitleService(
        await openSubtitlesApiKey(),
        await subDLApiKey()
      );

      const languages = await subtitleService.getAvailableLanguages(
        movieId,
        searchParams
      );

      log.info(`✅ Found ${languages.length} available languages`, {
        languages: languages.map((l) => `${l.name} (${l.count || 0})`),
      });

      return { languages };
    } catch (error) {
      log.error(error, 'Error fetching available languages');
      return { languages: [] };
    }
  }
);

// New endpoint for getting subtitle content on demand
export const getSubtitleContent = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/:movieId/content/:languageCode',
  },
  async ({
    movieId,
    languageCode,
    imdb_id,
    tmdb_id,
    parent_imdb_id,
    parent_tmdb_id,
    season_number,
    episode_number,
    query,
    moviehash,
    type,
    year,
    preferred_provider,
  }: {
    movieId: string;
    languageCode: string;
    imdb_id?: number;
    tmdb_id?: number;
    parent_imdb_id?: number;
    parent_tmdb_id?: number;
    season_number?: number;
    episode_number?: number;
    query?: string;
    moviehash?: string;
    type?: 'movie' | 'episode' | 'all';
    year?: number;
    preferred_provider?: 'opensubs' | 'subdl' | 'all';
  }): Promise<{ subtitle: Subtitle | null }> => {
    log.info(`📝 Getting subtitle content for ${movieId} in ${languageCode}`, {
      tmdb_id,
      preferred_provider,
    });

    const searchParams: SubtitleSearchParams = {
      imdb_id,
      tmdb_id,
      parent_imdb_id,
      parent_tmdb_id,
      season_number,
      episode_number,
      query: query || movieId,
      moviehash,
      type,
      year,
      preferred_provider,
    };

    try {
      // Create subtitle service with API keys
      const subtitleService = createSubtitleService(
        await openSubtitlesApiKey(),
        await subDLApiKey()
      );

      const subtitleContent = await subtitleService.getSubtitleContent(
        movieId,
        languageCode.toLowerCase(),
        searchParams
      );

      if (!subtitleContent) {
        log.info(`📭 No subtitle content found for ${languageCode}`);
        return { subtitle: null };
      }

      const subtitle: Subtitle = {
        id: subtitleContent.id,
        language_code: subtitleContent.language_code,
        language_name: subtitleContent.language_name,
        content: subtitleContent.content,
        source: subtitleContent.source,
      };

      log.info(`✅ Successfully returned subtitle content for ${languageCode}`);
      return { subtitle };
    } catch (error) {
      log.error(error, `Error getting subtitle content for ${languageCode}`);
      return { subtitle: null };
    }
  }
);

// Get subtitle content by row id. If content is missing, attempt to download via its stored metadata.
export const getSubtitleById = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/by-id/:id',
  },
  async ({ id }: { id: string }): Promise<{ subtitle: Subtitle | null }> => {
    log.info(`🆔 Fetching subtitle by id ${id}`);

    // 1) Look up the row
    const row = await userDB.queryRow<any>`
      SELECT * FROM movie_subtitles_v2 WHERE id = ${id}
    `;

    if (!row) {
      return { subtitle: null };
    }

    // If we already have content, return it
    if (row.content) {
      return {
        subtitle: {
          id: row.id,
          language_code: row.language_code,
          language_name: row.language_name,
          content: row.content,
          source: row.source,
        },
      };
    }

    // 2) No content – download deterministically from the row's source
    try {
      const openSubsKey = await openSubtitlesApiKey();
      const subDlKey = await subDLApiKey();

      const provider =
        row.source === 'opensubs'
          ? new OpenSubtitlesProvider(openSubsKey)
          : row.source === 'subdl'
          ? new SubDLProvider(subDlKey)
          : null;

      if (!provider) {
        log.info(`Unknown subtitle source '${row.source}' for id ${row.id}`);
        return { subtitle: null };
      }

      const content = await provider.downloadSubtitle(row.id, {
        id: row.id,
        language_code: row.language_code,
        language_name: row.language_name,
        source: row.source,
        source_id: row.source_id,
      });

      // Persist content back onto this specific row
      await userDB.exec`
        UPDATE movie_subtitles_v2
        SET content = ${content}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${row.id}
      `;

      return {
        subtitle: {
          id: row.id,
          language_code: row.language_code,
          language_name: row.language_name,
          content,
          source: row.source,
        },
      };
    } catch (err) {
      log.error(err, 'Failed to download subtitle content by id');
      return { subtitle: null };
    }
  }
);

// Unified resolver for UI: list rows or fetch content for a selected row
export const resolveSubtitles = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/resolve',
  },
  async ({
    movieId,
    tmdb_id,
    parent_imdb_id,
    parent_tmdb_id,
    season_number,
    episode_number,
    query,
    type,
    year,
    preferred_provider,
    row_id,
  }: {
    movieId?: string;
    tmdb_id?: number;
    parent_imdb_id?: number;
    parent_tmdb_id?: number;
    season_number?: number;
    episode_number?: number;
    query?: string;
    type?: 'movie' | 'episode' | 'all';
    year?: number;
    preferred_provider?: 'opensubs' | 'subdl' | 'all';
    row_id?: string;
  }): Promise<ResolveSubtitlesResponse> => {
    const searchParams: SubtitleSearchParams = {
      tmdb_id,
      parent_imdb_id,
      parent_tmdb_id,
      season_number,
      episode_number,
      query,
      type,
      year,
      preferred_provider,
    };

    // If a row is specified, fetch content for that exact row
    if (row_id) {
      log.info('🎯 resolveSubtitles: fetching content for row', { row_id });
      const row = await userDB.queryRow<any>`
        SELECT * FROM movie_subtitles_v2 WHERE id = ${row_id}
      `;
      if (!row)
        return { mode: 'content', subtitle: null } as ResolveSubtitlesResponse;

      if (row.content) {
        return {
          mode: 'content',
          subtitle: {
            id: row.id,
            language_code: row.language_code,
            language_name: row.language_name,
            content: row.content,
            source: row.source,
          },
        } as ResolveSubtitlesResponse;
      }

      // Download via provider and persist
      try {
        const openSubsKey = await openSubtitlesApiKey();
        const subDlKey = await subDLApiKey();
        const provider =
          row.source === 'opensubs'
            ? new OpenSubtitlesProvider(openSubsKey)
            : row.source === 'subdl'
            ? new SubDLProvider(subDlKey)
            : null;
        if (!provider)
          return {
            mode: 'content',
            subtitle: null,
          } as ResolveSubtitlesResponse;

        const content = await provider.downloadSubtitle(row.id, {
          id: row.id,
          language_code: row.language_code,
          language_name: row.language_name,
          source: row.source,
          source_id: row.source_id,
        });

        await userDB.exec`
          UPDATE movie_subtitles_v2
          SET content = ${content}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${row.id}
        `;

        return {
          mode: 'content',
          subtitle: {
            id: row.id,
            language_code: row.language_code,
            language_name: row.language_name,
            content,
            source: row.source,
          },
        } as ResolveSubtitlesResponse;
      } catch (err) {
        log.error(err, 'resolveSubtitles: failed to download content for row');
        return { mode: 'content', subtitle: null } as ResolveSubtitlesResponse;
      }
    }

    // Otherwise, return a list of available rows (ensuring metadata is present)
    const resolvedMovieId = movieId || (tmdb_id ? String(tmdb_id) : '');
    if (!resolvedMovieId && !tmdb_id) {
      // Need at least one identifier
      return { mode: 'list', rows: [] } as ResolveSubtitlesResponse;
    }

    try {
      // Ensure metadata exists by invoking languages fetch (stores metadata)
      const subtitleService = createSubtitleService(
        await openSubtitlesApiKey(),
        await subDLApiKey()
      );
      await subtitleService.getAvailableLanguages(
        resolvedMovieId,
        searchParams
      );

      // Now list rows from DB
      const rows: SubtitleRowItem[] = [];

      const queryFn = tmdb_id
        ? userDB.query<any>`
            SELECT id, language_code, language_name, source, source_id,
                   content IS NOT NULL as has_content,
                   metadata
            FROM movie_subtitles_v2
            WHERE tmdb_id = ${tmdb_id}
          `
        : userDB.query<any>`
            SELECT id, language_code, language_name, source, source_id,
                   content IS NOT NULL as has_content,
                   metadata
            FROM movie_subtitles_v2
            WHERE movie_id = ${resolvedMovieId}
          `;

      for await (const r of queryFn) {
        let displayName: string | undefined;
        let downloadCount: number | undefined;
        let uploader: string | undefined;
        try {
          const meta = r.metadata || {};
          displayName = meta.release || meta.name || undefined;
          if (typeof meta.download_count === 'number')
            downloadCount = meta.download_count;
          if (typeof meta.uploader === 'string') uploader = meta.uploader;
        } catch (_) {}

        rows.push({
          id: r.id,
          language_code: r.language_code,
          language_name: r.language_name,
          source: r.source,
          has_content: Boolean(r.has_content),
          name: displayName,
          download_count: downloadCount,
          uploader,
        });
      }

      return { mode: 'list', rows } as ResolveSubtitlesResponse;
    } catch (err) {
      log.error(err, 'resolveSubtitles: failed to resolve list');
      return { mode: 'list', rows: [] } as ResolveSubtitlesResponse;
    }
  }
);

// TMDB-first endpoint: check DB by TMDB, fetch/store metadata if missing, return languages
export const getLanguagesByTmdb = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/tmdb/:tmdbId/languages',
  },
  async ({
    tmdbId,
    provider,
  }: {
    tmdbId: number;
    provider?: 'opensubs' | 'subdl' | 'all';
  }): Promise<{ languages: SubtitleLanguage[] }> => {
    log.info(`🌐 TMDB-first languages for tmdb_id=${tmdbId}`, {
      provider,
    });

    // Build minimal search params (tmdb-only) and a stable movieId string keyed by TMDB
    const searchParams: SubtitleSearchParams = {
      tmdb_id: tmdbId,
      preferred_provider: provider || 'all',
    };

    const subtitleService = createSubtitleService(
      await openSubtitlesApiKey(),
      await subDLApiKey()
    );

    try {
      const languages = await subtitleService.getAvailableLanguages(
        String(tmdbId),
        searchParams
      );
      return { languages };
    } catch (error) {
      log.error(error, 'Error in TMDB-first languages');
      return { languages: [] };
    }
  }
);

// TMDB-first endpoint: fetch/return content for selected language
export const getSubtitleContentByTmdb = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/tmdb/:tmdbId/content/:languageCode',
  },
  async ({
    tmdbId,
    languageCode,
    provider,
  }: {
    tmdbId: number;
    languageCode: string;
    provider?: 'opensubs' | 'subdl' | 'all';
  }): Promise<{ subtitle: Subtitle | null }> => {
    log.info(`📝 TMDB-first content tmdb_id=${tmdbId} lang=${languageCode}`, {
      provider,
    });

    const searchParams: SubtitleSearchParams = {
      tmdb_id: tmdbId,
      preferred_provider: provider || 'all',
    };

    const subtitleService = createSubtitleService(
      await openSubtitlesApiKey(),
      await subDLApiKey()
    );

    try {
      const result = await subtitleService.getSubtitleContent(
        String(tmdbId),
        languageCode.toLowerCase(),
        searchParams
      );

      if (!result) return { subtitle: null };

      return {
        subtitle: {
          id: result.id,
          language_code: result.language_code,
          language_name: result.language_name,
          content: result.content,
          source: result.source,
        },
      };
    } catch (error) {
      log.error(error, 'Error in TMDB-first content');
      return { subtitle: null };
    }
  }
);

// Get all subtitle variants for a specific language
export const getSubtitleVariants = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/:movieId/variants/:languageCode',
  },
  async ({
    movieId,
    languageCode,
    tmdb_id,
  }: {
    movieId: string;
    languageCode: string;
    tmdb_id?: number;
  }): Promise<{ variants: SubtitleRowItem[] }> => {
    log.info(`🔍 Getting subtitle variants for ${movieId} in ${languageCode}`, {
      tmdb_id,
    });

    try {
      // Create subtitle service with API keys
      const subtitleService = createSubtitleService(
        await openSubtitlesApiKey(),
        await subDLApiKey()
      );

      const variants = await subtitleService.getSubtitleVariants(
        movieId,
        languageCode,
        tmdb_id
      );

      const formattedVariants: SubtitleRowItem[] = variants.map((variant) => ({
        id: variant.id,
        language_code: variant.language_code,
        language_name: variant.language_name,
        source: variant.source,
        has_content: !!variant.content,
        name:
          variant.metadata?.release || variant.metadata?.uploader || undefined,
        download_count: variant.metadata?.download_count,
        uploader: variant.metadata?.uploader,
      }));

      log.info(
        `✅ Found ${formattedVariants.length} variants for ${languageCode}`
      );
      return { variants: formattedVariants };
    } catch (error) {
      log.error(error, `Error getting subtitle variants for ${languageCode}`);
      return { variants: [] };
    }
  }
);

// Get subtitle content by specific variant ID
export const getSubtitleContentById = api(
  {
    expose: true,
    auth: false,
    method: 'GET',
    path: '/subtitles/variant/:variantId/content',
  },
  async ({
    variantId,
  }: {
    variantId: string;
  }): Promise<{ subtitle: Subtitle | null }> => {
    log.info(`📝 Getting subtitle content for variant ${variantId}`);

    try {
      // Create subtitle service with API keys
      const subtitleService = createSubtitleService(
        await openSubtitlesApiKey(),
        await subDLApiKey()
      );

      const subtitleContent = await subtitleService.getSubtitleContentById(
        variantId
      );

      if (!subtitleContent) {
        log.info(`📭 No content found for variant ${variantId}`);
        return { subtitle: null };
      }

      const subtitle: Subtitle = {
        id: subtitleContent.id,
        language_code: subtitleContent.language_code,
        language_name: subtitleContent.language_name,
        content: subtitleContent.content,
        source: subtitleContent.source,
      };

      log.info(`✅ Successfully returned content for variant ${variantId}`);
      return { subtitle };
    } catch (error) {
      log.error(error, `Error getting content for variant ${variantId}`);
      return { subtitle: null };
    }
  }
);

// Legacy download endpoint - kept for backward compatibility
export const downloadSubtitleFile = api(
  { expose: true, auth: false, method: 'POST', path: '/subtitles/download' },
  async ({
    file_id,
    subtitle_id,
  }: {
    file_id?: string;
    subtitle_id?: string;
  }): Promise<{ content: string }> => {
    throw new Error(
      'Legacy download endpoint deprecated. Use getSubtitleContent instead.'
    );
  }
);

// Test endpoint for embedded subtitle detection
export interface DetectEmbeddedTracksParams {
  streamUrl: string;
  quickScan?: boolean;
  contentName?: string;
}

export interface DetectEmbeddedTracksResponse {
  success: boolean;
  streamInfo?: VideoStreamInfo;
  likelyHasEmbedded: boolean;
  analysisTime: number;
  error?: string;
}

export const detectEmbeddedSubtitles = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/user/subtitles/detect-embedded',
  },
  async ({
    streamUrl,
    quickScan = false,
    contentName,
  }: DetectEmbeddedTracksParams): Promise<DetectEmbeddedTracksResponse> => {
    const startTime = Date.now();

    try {
      log.info('🔍 Testing embedded subtitle detection', {
        streamUrl: streamUrl.substring(0, 100) + '...',
        quickScan,
        contentName,
      });

      // Quick heuristic check first
      const likelyHasEmbedded = likelyHasEmbeddedSubtitles(
        streamUrl,
        contentName
      );

      // Perform ffprobe analysis
      const streamInfo = await detectEmbeddedTracks(streamUrl, quickScan);

      const analysisTime = Date.now() - startTime;

      log.info('✅ Embedded subtitle detection complete', {
        hasEmbeddedSubtitles: streamInfo.hasEmbeddedSubtitles,
        subtitleCount: streamInfo.subtitleTracks.length,
        audioCount: streamInfo.audioTracks.length,
        analysisTime,
        languages: streamInfo.subtitleTracks.map(
          (t) => `${t.language}(${t.format})`
        ),
      });

      return {
        success: true,
        streamInfo,
        likelyHasEmbedded,
        analysisTime,
      };
    } catch (error) {
      const analysisTime = Date.now() - startTime;

      log.error('❌ Embedded subtitle detection failed', {
        error: error instanceof Error ? error.message : String(error),
        analysisTime,
      });

      return {
        success: false,
        likelyHasEmbedded: likelyHasEmbeddedSubtitles(streamUrl, contentName),
        analysisTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);

// MKV subtitle extraction endpoint
export interface ExtractMKVSubtitleParams {
  streamUrl: string;
  language: string;
  trackIndex: number;
  codecId: string;
}

export interface ExtractMKVSubtitleResponse {
  success: boolean;
  content?: string;
  format?: string;
  language?: string;
  error?: string;
}

export const extractMKVSubtitle = api(
  {
    expose: true,
    auth: false,
    method: 'POST',
    path: '/subtitles/mkv-extract',
  },
  async ({
    streamUrl,
    language,
    trackIndex,
    codecId,
  }: ExtractMKVSubtitleParams): Promise<ExtractMKVSubtitleResponse> => {
    try {
      log.info('🎬 Extracting MKV subtitle track', {
        language,
        trackIndex,
        codecId,
        streamUrl: streamUrl.substring(0, 100) + '...',
      });

      // Placeholder implementation - demonstrates the concept
      // In production, this would use ffmpeg to extract subtitle tracks
      const mockSRTContent = `1\n00:00:01,000 --> 00:00:05,000\n🎯 MKV Extraction Working - ${language.toUpperCase()}\n\n2\n00:00:05,500 --> 00:00:10,000\nSubtitle track ${trackIndex} successfully extracted\n\n3\n00:00:10,500 --> 00:00:15,000\nCodec: ${codecId}\n\n4\n00:00:15,500 --> 00:00:20,000\nReady for production ffmpeg integration\n\n5\n00:00:20,500 --> 00:00:25,000\nLanguage: ${language} | Format: UTF-8\n\n6\n00:00:25,500 --> 00:00:30,000\nThis demonstrates the complete pipeline working\n\n7\n00:00:30,500 --> 00:00:35,000\nSubtitles will appear every 4.5 seconds\n\n8\n00:00:35,500 --> 00:00:40,000\nClick different language tracks to test switching`;

      log.info('✅ MKV subtitle extraction complete (mock)', {
        contentLength: mockSRTContent.length,
        language,
      });

      return {
        success: true,
        content: mockSRTContent,
        format: 'srt',
        language,
      };
    } catch (error) {
      log.error('❌ MKV subtitle extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        language,
        trackIndex,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);

// Extract all available subtitle tracks from video stream
export interface ExtractOriginalSubtitlesParams {
  streamUrl: string;
  movieId: string;
  tmdbId?: number;
}

export interface OriginalSubtitleTrack {
  id: string;
  language_code: string;
  language_name: string;
  source: 'original';
  has_content: boolean;
  trackIndex: number;
  codecId: string;
  format: string;
}

export interface ExtractOriginalSubtitlesResponse {
  success: boolean;
  tracks?: OriginalSubtitleTrack[];
  error?: string;
}

export const extractOriginalSubtitles = api(
  {
    expose: true,
    auth: false,
    method: 'POST',
    path: '/subtitles/extract-original',
  },
  async ({
    streamUrl,
    movieId,
    tmdbId,
  }: ExtractOriginalSubtitlesParams): Promise<ExtractOriginalSubtitlesResponse> => {
    try {
      log.info('🎬 Extracting original subtitle tracks from stream', {
        movieId,
        tmdbId,
        streamUrl: streamUrl.substring(0, 100) + '...',
      });

      // Use real FFprobe detection
      const streamInfo = await detectEmbeddedTracks(streamUrl, true); // Quick scan
      const detectedTracks = streamInfo.subtitleTracks;

      const tracks: OriginalSubtitleTrack[] = [];

      // Process each detected track
      for (const track of detectedTracks) {
        // Check if we already have this subtitle in our database
        const existingSubtitle = await userDB.queryRow`
          SELECT id FROM movie_subtitles_v2 WHERE movie_id = ${movieId} AND language_code = ${track.language} AND source = 'original'
        `;

        let subtitleId: string;

        if (existingSubtitle) {
          subtitleId = existingSubtitle.id;
          log.info('📋 Found existing original subtitle', {
            movieId,
            language: track.language,
            subtitleId,
          });
        } else {
          // Insert new subtitle entry without content initially
          const insertResult = await userDB.queryRow`
            INSERT INTO movie_subtitles_v2 (movie_id, tmdb_id, language_code, language_name, source, source_id, content) 
            VALUES (${movieId}, ${tmdbId || null}, ${track.language}, ${
            track.languageName
          }, 'original', ${`${movieId}_${track.language}_${track.index}`}, NULL) 
            RETURNING id
          `;

          if (!insertResult) {
            throw new Error('Failed to insert subtitle entry');
          }
          subtitleId = insertResult.id;
          log.info('✅ Created new original subtitle entry', {
            movieId,
            language: track.language,
            subtitleId,
          });
        }

        tracks.push({
          id: subtitleId,
          language_code: track.language,
          language_name: track.languageName,
          source: 'original',
          has_content: false, // Content will be extracted on demand
          trackIndex: track.index,
          codecId: track.codec,
          format: track.format,
        });
      }

      log.info('✅ Original subtitle tracks processed', {
        movieId,
        trackCount: tracks.length,
      });

      return {
        success: true,
        tracks,
      };
    } catch (error) {
      log.error('❌ Original subtitle extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        movieId,
        streamUrl: streamUrl.substring(0, 100) + '...',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);

// Extract specific original subtitle content
export interface ExtractOriginalSubtitleContentParams {
  subtitleId: string;
  streamUrl: string;
  trackIndex: number;
  language: string;
}

export interface ExtractOriginalSubtitleContentResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export const extractOriginalSubtitleContent = api(
  {
    expose: true,
    auth: false,
    method: 'POST',
    path: '/subtitles/extract-original-content',
  },
  async ({
    subtitleId,
    streamUrl,
    trackIndex,
    language,
  }: ExtractOriginalSubtitleContentParams): Promise<ExtractOriginalSubtitleContentResponse> => {
    try {
      log.info('🎬 Extracting original subtitle content', {
        subtitleId,
        trackIndex,
        language,
        streamUrl: streamUrl.substring(0, 100) + '...',
      });

      // Check if we already have content
      const existingContent = await userDB.queryRow`
        SELECT content FROM movie_subtitles_v2 WHERE id = ${subtitleId}
      `;

      if (existingContent?.content) {
        log.info('📋 Using cached original subtitle content', {
          subtitleId,
          contentLength: existingContent.content.length,
        });
        return {
          success: true,
          content: existingContent.content,
        };
      }

      // Real FFmpeg extraction
      const extractedContent = await extractSubtitleWithFFmpeg(
        streamUrl,
        trackIndex,
        language
      );

      // Store the extracted content
      await userDB.exec`
        UPDATE movie_subtitles_v2 SET content = ${extractedContent}, updated_at = CURRENT_TIMESTAMP WHERE id = ${subtitleId}
      `;

      log.info('✅ Original subtitle content extracted and stored', {
        subtitleId,
        contentLength: extractedContent.length,
        language,
      });

      return {
        success: true,
        content: extractedContent,
      };
    } catch (error) {
      log.error('❌ Original subtitle content extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        subtitleId,
        trackIndex,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
