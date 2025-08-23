import { metadataDB } from '../../metadata/db';
import log from 'encore.dev/log';
import { OpenSubtitlesProvider } from './providers/opensubtitles';
import { SubDLProvider } from './providers/subdl';
import {
  SubtitleProvider,
  SubtitleSearchParams,
  SubtitleMetadata,
  SubtitleContent,
  SubtitleLanguage,
  StoredSubtitle,
} from './types';

export class SubtitleService {
  private providers: SubtitleProvider[] = [];

  constructor(openSubsKey?: string, subDlKey?: string) {
    // Initialize providers with API keys passed from service layer
    this.providers = [
      new OpenSubtitlesProvider(openSubsKey),
      new SubDLProvider(subDlKey),
    ];
  }

  /**
   * Check if providers are available
   */
  private hasProvidersAvailable(): boolean {
    return this.providers.some(
      (p) => p instanceof OpenSubtitlesProvider || p instanceof SubDLProvider
    );
  }

  /**
   * Get available languages for a movie/show - checks DB first, fetches from providers if empty
   */
  async getAvailableLanguages(
    movieId: string,
    searchParams: SubtitleSearchParams
  ): Promise<SubtitleLanguage[]> {
    const cacheKey = this.getCacheKey(movieId, searchParams);

    // Check if we have any subtitles (with or without content) in DB
    const existing = await this.getStoredSubtitles(
      movieId,
      searchParams.tmdb_id
    );

    if (existing.length > 0) {
      // Return languages from stored subtitles
      const languageMap = new Map<string, { count: number; name: string }>();

      for (const sub of existing) {
        const current = languageMap.get(sub.language_code) || {
          count: 0,
          name: sub.language_name,
        };
        languageMap.set(sub.language_code, {
          count: current.count + 1,
          name: sub.language_name,
        });
      }

      return Array.from(languageMap.entries())
        .map(([code, { name, count }]) => ({ code, name, count }))
        .sort((a, b) => b.count - a.count);
    }

    // No stored subtitles, fetch from providers based on preference
    log.info(`🌐 Fetching available languages from providers for ${movieId}`, {
      preferred_provider: searchParams.preferred_provider,
    });

    const allLanguages = new Map<string, SubtitleLanguage>();
    const allMetadata: SubtitleMetadata[] = [];

    // Filter providers based on preference
    const providersToUse = this.getProvidersForPreference(
      searchParams.preferred_provider
    );

    for (const provider of providersToUse) {
      log.info(`🔍 Fetching from ${provider.name}...`);
      // 1) Always try to fetch and merge languages first
      try {
        const languages = await provider.getAvailableLanguages(searchParams);
        for (const lang of languages) {
          if (!lang || !lang.code) continue;
          const existing = allLanguages.get(lang.code);
          if (!existing || (lang.count || 0) > (existing.count || 0)) {
            allLanguages.set(lang.code, lang);
          }
        }
      } catch (error) {
        log.error(error, `Failed to fetch languages from ${provider.name}`);
      }

      // 2) Then try to fetch metadata (non-fatal for language list)
      try {
        const metadata = await provider.searchSubtitles(searchParams);
        allMetadata.push(...metadata);
      } catch (error) {
        log.error(error, `Failed to fetch metadata from ${provider.name}`);
      }
    }

    // Store metadata without content for future use
    // Use parent_tmdb_id for episodes, tmdb_id for movies
    const tmdbId = searchParams.parent_tmdb_id || searchParams.tmdb_id;
    await this.storeSubtitleMetadata(movieId, tmdbId, allMetadata);

    return Array.from(allLanguages.values()).sort(
      (a, b) => (b.count || 0) - (a.count || 0)
    );
  }

  /**
   * Get all available subtitle variants for a specific language
   */
  async getSubtitleVariants(
    movieId: string,
    languageCode: string,
    tmdbId?: number
  ): Promise<StoredSubtitle[]> {
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
    for await (const subtitle of query) {
      variants.push(subtitle);
    }

    return variants;
  }

  /**
   * Get subtitle content by specific variant ID
   */
  async getSubtitleContentById(
    variantId: string
  ): Promise<SubtitleContent | null> {
    // Get the specific variant from database
    const variant = await metadataDB.queryRow<StoredSubtitle>`
      SELECT * FROM subtitles WHERE id = ${variantId}
    `;

    if (!variant) {
      return null;
    }

    // If we already have content, return it
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

    // No content, need to download it
    const provider = this.providers.find(
      (p) =>
        p.name.toLowerCase() === variant.source ||
        (variant.source === 'opensubs' && p.name === 'OpenSubtitles') ||
        (variant.source === 'subdl' && p.name === 'SubDL')
    );

    if (!provider) {
      log.error(`Provider not found for source: ${variant.source}`);
      return null;
    }

    try {
      const content = await provider.downloadSubtitle(variant.id, {
        id: variant.id,
        language_code: variant.language_code,
        language_name: variant.language_name,
        source: variant.source as 'opensubs' | 'subdl',
        source_id: variant.source_id,
      });

      // Update DB with content
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

  /**
   * Get subtitle content for a specific language - downloads if not cached
   */
  async getSubtitleContent(
    movieId: string,
    languageCode: string,
    searchParams: SubtitleSearchParams
  ): Promise<SubtitleContent | null> {
    log.info(`📝 Getting subtitle content for ${movieId} in ${languageCode}`, {
      preferred_provider: searchParams.preferred_provider,
    });

    // Check if we have content in DB
    const stored = await this.getStoredSubtitleWithContent(
      movieId,
      languageCode,
      searchParams.tmdb_id
    );

    if (stored) {
      log.info(`✅ Found stored content for ${languageCode}`);
      return {
        id: stored.id,
        language_code: stored.language_code,
        language_name: stored.language_name,
        source: stored.source as 'opensubs' | 'subdl',
        source_id: stored.source_id,
        content: stored.content!,
      };
    }

    // No content, check if we have metadata
    const metadataOnly = await this.getStoredSubtitleMetadata(
      movieId,
      languageCode,
      searchParams.tmdb_id
    );

    if (metadataOnly) {
      // We have metadata, download content
      log.info(
        `⬇️ Downloading content for ${languageCode} from ${metadataOnly.source}`
      );

      const provider = this.providers.find(
        (p) =>
          p.name.toLowerCase() === metadataOnly.source ||
          (metadataOnly.source === 'opensubs' && p.name === 'OpenSubtitles') ||
          (metadataOnly.source === 'subdl' && p.name === 'SubDL')
      );

      if (!provider) {
        log.error(`Provider not found for source: ${metadataOnly.source}`);
        return null;
      }

      try {
        const content = await provider.downloadSubtitle(metadataOnly.id, {
          id: metadataOnly.id,
          language_code: metadataOnly.language_code,
          language_name: metadataOnly.language_name,
          source: metadataOnly.source as 'opensubs' | 'subdl',
          source_id: metadataOnly.source_id,
        });

        // Update DB with content
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
        log.error(
          error,
          `Failed to download subtitle content from ${provider.name}`
        );
        return null;
      }
    }

    // No metadata either, search and download
    log.info(`🔍 Searching for ${languageCode} subtitle for ${movieId}`, {
      preferred_provider: searchParams.preferred_provider,
    });

    const providersToUse = this.getProvidersForPreference(
      searchParams.preferred_provider
    );

    for (const provider of providersToUse) {
      try {
        const searchParamsWithLang = {
          ...searchParams,
          languages: languageCode.toUpperCase(),
        };

        const metadata = await provider.searchSubtitles(searchParamsWithLang);
        const match = metadata.find((m) => m.language_code === languageCode);

        if (match) {
          const content = await provider.downloadSubtitle(match.id, match);

          // Store both metadata and content
          await this.storeSubtitleWithContent(
            movieId,
            searchParams.tmdb_id,
            match,
            content
          );

          return {
            ...match,
            content,
          };
        }
      } catch (error) {
        log.error(error, `Failed to search/download from ${provider.name}`);
      }
    }

    return null;
  }

  /**
   * Get providers based on preference
   */
  private getProvidersForPreference(
    preference?: 'opensubs' | 'subdl' | 'all'
  ): SubtitleProvider[] {
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

  private getCacheKey(
    movieId: string,
    searchParams: SubtitleSearchParams
  ): string {
    return (
      movieId +
      JSON.stringify({
        imdb_id: searchParams.imdb_id,
        tmdb_id: searchParams.tmdb_id,
        parent_imdb_id: searchParams.parent_imdb_id,
        parent_tmdb_id: searchParams.parent_tmdb_id,
        season_number: searchParams.season_number,
        episode_number: searchParams.episode_number,
        type: searchParams.type,
        year: searchParams.year,
        preferred_provider: searchParams.preferred_provider || 'all',
      })
    );
  }

  private async getStoredSubtitles(
    movieId: string,
    tmdbId?: number
  ): Promise<StoredSubtitle[]> {
    const subtitles: StoredSubtitle[] = [];

    if (tmdbId) {
      const tmdbResults = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles WHERE tmdb_id = ${tmdbId}
      `;

      for await (const subtitle of tmdbResults) {
        subtitles.push(subtitle);
      }
    }

    if (subtitles.length === 0) {
      const results = metadataDB.query<StoredSubtitle>`
        SELECT * FROM subtitles WHERE movie_id = ${movieId}
      `;

      for await (const subtitle of results) {
        subtitles.push(subtitle);
      }
    }

    return subtitles;
  }

  private async getStoredSubtitleWithContent(
    movieId: string,
    languageCode: string,
    tmdbId?: number
  ): Promise<StoredSubtitle | null> {
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

    for await (const subtitle of query) {
      return subtitle;
    }

    return null;
  }

  private async getStoredSubtitleMetadata(
    movieId: string,
    languageCode: string,
    tmdbId?: number
  ): Promise<StoredSubtitle | null> {
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

    for await (const subtitle of query) {
      return subtitle;
    }

    return null;
  }

  private async storeSubtitleMetadata(
    movieId: string,
    tmdbId: number | undefined,
    metadata: SubtitleMetadata[]
  ): Promise<void> {
    for (const meta of metadata) {
      try {
        await metadataDB.exec`
          INSERT INTO subtitles (
            movie_id, tmdb_id, language_code, language_name, 
            source, source_id, metadata
          )
          VALUES (
            ${movieId}, ${tmdbId || null}, ${meta.language_code}, ${
          meta.language_name
        },
            ${meta.source}, ${meta.source_id}, ${JSON.stringify(meta)}
          )
          ON CONFLICT (movie_id, language_code, source) DO UPDATE SET
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
        `;
      } catch (error) {
        log.error(
          error,
          `Failed to store subtitle metadata for ${meta.language_code}`
        );
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
        ${movieId}, ${tmdbId || null}, ${metadata.language_code}, ${
      metadata.language_name
    },
        ${metadata.source}, ${metadata.source_id}, ${content}, ${JSON.stringify(
      metadata
    )}
      )
      ON CONFLICT (movie_id, language_code, source) DO UPDATE SET
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `;
  }

  private async updateSubtitleContent(
    subtitleId: string,
    content: string
  ): Promise<void> {
    await metadataDB.exec`
      UPDATE subtitles 
      SET content = ${content}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${subtitleId}
    `;
  }
}

// Export a factory function instead of a singleton
export function createSubtitleService(
  openSubsKey?: string,
  subDlKey?: string
): SubtitleService {
  return new SubtitleService(openSubsKey, subDlKey);
}
