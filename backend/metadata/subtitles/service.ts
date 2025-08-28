import { metadataDB } from '../db';
import log from 'encore.dev/log';
import { OpenSubtitlesProvider } from '../../common/subtitles/providers/opensubtitles';
import { SubDLProvider } from '../../common/subtitles/providers/subdl';
import {
  type SubtitleProvider,
  type SubtitleSearchParams,
  type SubtitleMetadata,
  type SubtitleContent,
  type SubtitleLanguage,
  type StoredSubtitle,
} from '../../common/subtitles/types';

export class SubtitleService {
  private providers: SubtitleProvider[] = [];

  constructor(openSubsKey?: string, subDlKey?: string) {
    this.providers = [new OpenSubtitlesProvider(openSubsKey), new SubDLProvider(subDlKey)];
  }

  async getAvailableLanguages(movieId: string, searchParams: SubtitleSearchParams): Promise<SubtitleLanguage[]> {
    const existing = await this.getStoredSubtitles(movieId, searchParams.tmdb_id);
    if (existing.length > 0) {
      const languageMap = new Map<string, { count: number; name: string }>();
      for (const sub of existing) {
        const current = languageMap.get(sub.language_code) || { count: 0, name: sub.language_name };
        languageMap.set(sub.language_code, { count: current.count + 1, name: sub.language_name });
      }
      return Array.from(languageMap.entries())
        .map(([code, { name, count }]) => ({ code, name, count }))
        .sort((a, b) => (b.count || 0) - (a.count || 0));
    }

    log.info(`🌐 Fetching available languages from providers for ${movieId}`, {
      preferred_provider: searchParams.preferred_provider,
    });

    const allLanguages = new Map<string, SubtitleLanguage>();
    const allMetadata: SubtitleMetadata[] = [];
    const providersToUse = this.getProvidersForPreference(searchParams.preferred_provider);

    for (const provider of providersToUse) {
      try {
        const languages = await provider.getAvailableLanguages(searchParams);
        for (const lang of languages) {
          if (!lang || !lang.code) continue;
          const existingLang = allLanguages.get(lang.code);
          if (!existingLang || (lang.count || 0) > (existingLang.count || 0)) {
            allLanguages.set(lang.code, lang);
          }
        }
      } catch (error) {
        log.error(error, `Failed to fetch languages from ${provider.name}`);
      }

      try {
        const metadata = await provider.searchSubtitles(searchParams);
        allMetadata.push(...metadata);
      } catch (error) {
        log.error(error, `Failed to fetch metadata from ${provider.name}`);
      }
    }

    const tmdbId = searchParams.parent_tmdb_id || searchParams.tmdb_id;
    await this.storeSubtitleMetadata(movieId, tmdbId, allMetadata);

    return Array.from(allLanguages.values()).sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  async getSubtitleVariants(movieId: string, languageCode: string, tmdbId?: number): Promise<StoredSubtitle[]> {
    let query;
    if (tmdbId) {
      query = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles 
        WHERE tmdb_id = ${tmdbId} 
        AND language_code = ${languageCode}
        ORDER BY 
          CASE WHEN content IS NOT NULL THEN 0 ELSE 1 END,
          created_at DESC
      `;
    } else {
      query = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles 
        WHERE movie_id = ${movieId} 
        AND language_code = ${languageCode}
        ORDER BY 
          CASE WHEN content IS NOT NULL THEN 0 ELSE 1 END,
          created_at DESC
      `;
    }

    const variants: StoredSubtitle[] = [];
    for await (const subtitle of query) variants.push(subtitle);
    return variants;
  }

  async getSubtitleContentById(variantId: string): Promise<SubtitleContent | null> {
    const variant = await metadataDB.queryRow<StoredSubtitle>`
      SELECT * FROM subtitles WHERE id = ${variantId}
    `;
    if (!variant) return null;
    if (variant.content) {
      return {
        id: variant.id,
        language_code: variant.language_code,
        language_name: variant.language_name,
        source: variant.source as 'opensubs' | 'subdl',
        source_id: variant.source_id,
        content: variant.content,
      };
    }

    const provider = this.getProvidersForPreference('all').find(
      (p) =>
        p.name.toLowerCase() === variant.source ||
        (variant.source === 'opensubs' && p.name === 'OpenSubtitles') ||
        (variant.source === 'subdl' && p.name === 'SubDL')
    );
    if (!provider) return null;

    try {
      const content = await provider.downloadSubtitle(variant.id, {
        id: variant.id,
        language_code: variant.language_code,
        language_name: variant.language_name,
        source: variant.source as 'opensubs' | 'subdl',
        source_id: variant.source_id,
      });
      await this.updateSubtitleContent(variant.id, content);
      return {
        id: variant.id,
        language_code: variant.language_code,
        language_name: variant.language_name,
        source: variant.source as 'opensubs' | 'subdl',
        source_id: variant.source_id,
        content,
      };
    } catch (error) {
      log.error(error, `Failed to download content for variant ${variantId}`);
      return null;
    }
  }

  async getSubtitleContent(
    movieId: string,
    languageCode: string,
    searchParams: SubtitleSearchParams
  ): Promise<SubtitleContent | null> {
    const stored = await this.getStoredSubtitleWithContent(movieId, languageCode, searchParams.tmdb_id);
    if (stored) {
      return {
        id: stored.id,
        language_code: stored.language_code,
        language_name: stored.language_name,
        source: stored.source as 'opensubs' | 'subdl',
        source_id: stored.source_id,
        content: stored.content!,
      };
    }

    const metadataOnly = await this.getStoredSubtitleMetadata(movieId, languageCode, searchParams.tmdb_id);
    if (metadataOnly) {
      const provider = this.getProvidersForPreference('all').find(
        (p) =>
          p.name.toLowerCase() === metadataOnly.source ||
          (metadataOnly.source === 'opensubs' && p.name === 'OpenSubtitles') ||
          (metadataOnly.source === 'subdl' && p.name === 'SubDL')
      );
      if (!provider) return null;
      try {
        const content = await provider.downloadSubtitle(metadataOnly.id, {
          id: metadataOnly.id,
          language_code: metadataOnly.language_code,
          language_name: metadataOnly.language_name,
          source: metadataOnly.source as 'opensubs' | 'subdl',
          source_id: metadataOnly.source_id,
        });
        await this.updateSubtitleContent(metadataOnly.id, content);
        return {
          id: metadataOnly.id,
          language_code: metadataOnly.language_code,
          language_name: metadataOnly.language_name,
          source: metadataOnly.source as 'opensubs' | 'subdl',
          source_id: metadataOnly.source_id,
          content,
        };
      } catch (error) {
        log.error(error, `Failed to download subtitle content`);
        return null;
      }
    }

    const providersToUse = this.getProvidersForPreference(searchParams.preferred_provider);
    for (const provider of providersToUse) {
      try {
        const searchParamsWithLang = { ...searchParams, languages: languageCode.toUpperCase() };
        const metadata = await provider.searchSubtitles(searchParamsWithLang);
        const match = metadata.find((m) => m.language_code === languageCode);
        if (match) {
          const content = await provider.downloadSubtitle(match.id, match);
          await this.storeSubtitleWithContent(movieId, searchParams.tmdb_id, match, content);
          return { ...match, content };
        }
      } catch (error) {
        log.error(error, `Failed to search/download from ${provider.name}`);
      }
    }
    return null;
  }

  private getProvidersForPreference(preference?: 'opensubs' | 'subdl' | 'all'): SubtitleProvider[] {
    switch (preference) {
      case 'opensubs':
        return this.providers.filter((p) => p.name === 'OpenSubtitles');
      case 'subdl':
        return this.providers.filter((p) => p.name === 'SubDL');
      case 'all':
      default:
        return this.providers;
    }
  }

  private async getStoredSubtitles(movieId: string, tmdbId?: number): Promise<StoredSubtitle[]> {
    const subtitles: StoredSubtitle[] = [];
    if (tmdbId) {
      const tmdbResults = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles WHERE tmdb_id = ${tmdbId}
      `;
      for await (const subtitle of tmdbResults) subtitles.push(subtitle);
    }
    if (subtitles.length === 0) {
      const results = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles WHERE movie_id = ${movieId}
      `;
      for await (const subtitle of results) subtitles.push(subtitle);
    }
    return subtitles;
  }

  private async getStoredSubtitleWithContent(movieId: string, languageCode: string, tmdbId?: number): Promise<StoredSubtitle | null> {
    let query;
    if (tmdbId) {
      query = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles 
        WHERE tmdb_id = ${tmdbId} 
        AND language_code = ${languageCode} 
        AND content IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `;
    } else {
      query = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles 
        WHERE movie_id = ${movieId} 
        AND language_code = ${languageCode} 
        AND content IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `;
    }
    for await (const subtitle of query) return subtitle;
    return null;
  }

  private async getStoredSubtitleMetadata(movieId: string, languageCode: string, tmdbId?: number): Promise<StoredSubtitle | null> {
    let query;
    if (tmdbId) {
      query = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles 
        WHERE tmdb_id = ${tmdbId} 
        AND language_code = ${languageCode}
        ORDER BY created_at DESC
        LIMIT 1
      `;
    } else {
      query = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles 
        WHERE movie_id = ${movieId} 
        AND language_code = ${languageCode}
        ORDER BY created_at DESC
        LIMIT 1
      `;
    }
    for await (const subtitle of query) return subtitle;
    return null;
  }

  private async storeSubtitleMetadata(movieId: string, tmdbId: number | undefined, metadata: SubtitleMetadata[]): Promise<void> {
    for (const meta of metadata) {
      try {
        await metadataDB.exec`
          INSERT INTO subtitles (
            movie_id, tmdb_id, language_code, language_name, 
            source, source_id, metadata
          )
          VALUES (
            ${movieId}, ${tmdbId || null}, ${meta.language_code}, ${meta.language_name},
            ${meta.source}, ${meta.source_id}, ${JSON.stringify(meta)}
          )
          ON CONFLICT (movie_id, language_code, source) DO UPDATE SET
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
        `;
      } catch (error) {
        log.error(error, `Failed to store subtitle metadata for ${meta.language_code}`);
      }
    }
  }

  private async storeSubtitleWithContent(
    movieId: string,
    tmdbId: number | undefined,
    metadata: SubtitleMetadata,
    content: string
  ): Promise<void> {
    await metadataDB.exec`
      INSERT INTO subtitles (
        movie_id, tmdb_id, language_code, language_name, 
        source, source_id, content, metadata
      )
      VALUES (
        ${movieId}, ${tmdbId || null}, ${metadata.language_code}, ${metadata.language_name},
        ${metadata.source}, ${metadata.source_id}, ${content}, ${JSON.stringify(metadata)}
      )
      ON CONFLICT (movie_id, language_code, source) DO UPDATE SET
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `;
  }

  private async updateSubtitleContent(subtitleId: string, content: string): Promise<void> {
    await metadataDB.exec`
      UPDATE subtitles 
      SET content = ${content}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${subtitleId}
    `;
  }
}

export function createSubtitleService(openSubsKey?: string, subDlKey?: string): SubtitleService {
  return new SubtitleService(openSubsKey, subDlKey);
}

