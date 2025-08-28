import log from 'encore.dev/log';
import { secret } from 'encore.dev/config';
import { metadataDB } from './db';
import { OMDBClient } from './providers/omdb-client';
import { TraktClient } from './providers/trakt-client';
import { FanArtClient } from './providers/fanart-client';
import { YouTubeClient } from './providers/youtube-client';
import { TMDBClient } from './providers/tmdb-client';

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

export interface EnrichmentParams {
  tmdb_id?: number; // 🆕 Make optional to support title-only requests
  content_type: 'movie' | 'tv';
  imdb_id?: string;
  title?: string;
  year?: string;
}

// Feature flag to enable/disable Trakt during enrichment
const ENABLE_TRAKT_ENRICHMENT = false;

export interface EnrichmentData {
  tmdb_id: number;
  content_type: 'movie' | 'tv';

  // OMDB
  imdb_id?: string;
  imdb_rating?: number;
  imdb_votes?: number;
  metascore?: number;
  rotten_tomatoes?: string;
  box_office?: string;
  awards?: string;
  rated?: string;

  // FanArt
  logo_url?: string;
  clearart_url?: string;
  banner_url?: string;
  thumb_url?: string;
  disc_url?: string;
  poster_url?: string;
  background_url?: string;

  // YouTube
  trailer_youtube_id?: string;
  trailer_title?: string;
  trailer_thumbnail_url?: string;
  trailer_channel_name?: string;
  trailer_published_at?: string;

  // Parsed numeric values for better querying
  box_office_amount?: number;
  rotten_tomatoes_score?: number;

  // Dynamic JSON responses for multi-item display
  fanart_response?: any; // Multiple artworks of each type
  youtube_response?: any; // Multiple videos/trailers
}

// Helpers to ensure only finite numbers are stored; convert invalid values to undefined (NULL in DB)
function parseFiniteNumberFromString(input: unknown): number | undefined {
  if (typeof input !== 'string') return undefined;
  const cleaned = input.trim().replace(/,/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Parse box office string to numeric value
 * Examples: "$141,340,178" -> 141340178
 */
function parseBoxOffice(value: string | undefined): number | undefined {
  if (!value || value === 'N/A') return undefined;
  // Remove $, commas, and any non-numeric characters
  const numStr = value.replace(/[^0-9]/g, '');
  const num = parseInt(numStr, 10);
  return isFinite(num) ? num : undefined;
}

/**
 * Parse Rotten Tomatoes percentage to numeric value
 * Examples: "84%" -> 84
 */
function parseRottenTomatoesScore(
  ratings: any[] | undefined
): number | undefined {
  if (!ratings) return undefined;
  const rtRating = ratings.find((r) => r.Source === 'Rotten Tomatoes');
  if (!rtRating?.Value) return undefined;
  const numStr = rtRating.Value.replace('%', '');
  const num = parseInt(numStr, 10);
  return isFinite(num) && num >= 0 && num <= 100 ? num : undefined;
}

function coerceFiniteNumber(input: unknown): number | undefined {
  if (typeof input !== 'number') return undefined;
  return Number.isFinite(input) ? input : undefined;
}

export async function enrichWithExternalAPIs(
  params: EnrichmentParams
): Promise<EnrichmentData> {
  let { tmdb_id, content_type, imdb_id, title, year } = params; // 🆕 Make tmdb_id mutable

  // 🆕 Enhanced logging for title-based requests
  log.info('🎬 ENRICHMENT CALLED FROM FRONTEND', {
    tmdb_id,
    content_type,
    imdb_id,
    title,
    year,
    timestamp: new Date().toISOString(),
    hasTitle: !!title,
    titleLength: title?.length || 0,
    requestType: tmdb_id ? 'TMDB_ID' : 'TITLE_ONLY',
  });

  // 🆕 If no TMDB ID but we have title, try to find TMDB ID first
  if (!tmdb_id && title) {
    log.info('🔍 No TMDB ID provided, attempting title search first', {
      title,
      content_type,
      year,
    });

    try {
      const client = await getTMDBClient();
      const cleanTitle = title.replace(/\[[^\]]*\]/g, '').trim();

      log.info('🧹 Title cleaning completed', {
        originalTitle: title,
        cleanTitle,
        content_type,
        year,
        regexRemoved: title.length - cleanTitle.length,
      });

      let searchResults;
      if (content_type === 'movie') {
        log.info('🎬 Searching TMDB for movie by title', { cleanTitle, year });
        searchResults = await client.searchMovies(
          cleanTitle,
          year ? parseInt(String(year)) : undefined,
          1,
          'en-US'
        );
      } else {
        log.info('📺 Searching TMDB for TV show by title', {
          cleanTitle,
          year,
        });
        searchResults = await client.searchTV(
          cleanTitle,
          year ? parseInt(String(year)) : undefined,
          1,
          'en-US'
        );
      }

      if (searchResults?.results && searchResults.results.length > 0) {
        const bestMatch = searchResults.results[0];
        log.info('🎯 Found TMDB ID via title search', {
          originalTitle: title,
          cleanTitle,
          foundTmdbId: bestMatch.id,
          foundTitle: bestMatch.title || bestMatch.name,
          confidence: 'high',
        });

        // 🆕 Update tmdb_id for the rest of enrichment
        params.tmdb_id = bestMatch.id;
        tmdb_id = bestMatch.id;
      } else {
        log.warn('❌ No TMDB ID found via title search', {
          title: cleanTitle,
          content_type,
          year,
        });
      }
    } catch (error: any) {
      // 🆕 Properly type the error
      log.error('💥 TMDB title search failed', {
        error: error.message,
        title,
        content_type,
      });
    }
  }

  // 🆕 Continue with existing enrichment logic (now with potentially found TMDB ID)
  const enrichment: EnrichmentData = {
    tmdb_id: tmdb_id || 0, // Use found TMDB ID or 0
    content_type,
  };

  // 🆕 Ensure tmdb_id is always a number for function calls
  const finalTmdbId = tmdb_id || 0;

  log.info('Starting content enrichment', {
    tmdb_id: finalTmdbId,
    content_type,
    imdb_id,
    title,
  });

  // Initialize clients
  const omdbClient = new OMDBClient();
  const traktClient = ENABLE_TRAKT_ENRICHMENT
    ? new TraktClient()
    : (null as unknown as TraktClient);
  const fanartClient = new FanArtClient();
  const youtubeClient = new YouTubeClient();

  // Fetch all data in parallel for maximum speed
  const promises: Promise<void>[] = [];

  // 1. OMDB - Fetch if we have IMDB ID
  if (imdb_id) {
    promises.push(
      (async () => {
        const start = Date.now();
        log.debug('Enrichment: OMDB fetchByIMDBId start', { tmdb_id, imdb_id });
        const data = await omdbClient.fetchByIMDBId(imdb_id);
        const durationMs = Date.now() - start;
        log.debug('Enrichment: OMDB fetchByIMDBId done', {
          tmdb_id,
          imdb_id,
          durationMs,
          hasPayload: !!data,
        });
        return data;
      })()
        .then((data) => {
          if (data) {
            enrichment.imdb_id = imdb_id;
            enrichment.imdb_rating = parseFiniteNumberFromString(
              data.imdbRating
            );
            enrichment.imdb_votes = parseFiniteNumberFromString(data.imdbVotes);
            enrichment.metascore = parseFiniteNumberFromString(data.Metascore);
            enrichment.rotten_tomatoes = data.Ratings?.find(
              (r) => r.Source === 'Rotten Tomatoes'
            )?.Value;
            enrichment.box_office = data.BoxOffice;
            enrichment.box_office_amount = parseBoxOffice(data.BoxOffice);
            enrichment.rotten_tomatoes_score = parseRottenTomatoesScore(
              data.Ratings
            );
            enrichment.awards = data.Awards;
            enrichment.rated = data.Rated;
            log.info('OMDB data fetched', { tmdb_id, imdb_id });
          }
        })
        .catch((err) => log.warn('OMDB fetch failed', { error: err, imdb_id }))
    );
  } else if (title) {
    // Fallback: Try to search by title if no IMDB ID
    promises.push(
      (async () => {
        const start = Date.now();
        const omdbType = content_type === 'tv' ? 'series' : 'movie';
        log.debug('Enrichment: OMDB searchByTitle start', {
          tmdb_id,
          title,
          year,
          omdbType,
        });
        const data = await omdbClient.searchByTitle(title, year, omdbType);
        const durationMs = Date.now() - start;
        log.debug('Enrichment: OMDB searchByTitle done', {
          tmdb_id,
          title,
          year,
          omdbType,
          durationMs,
          hasPayload: !!data,
        });
        return data;
      })()
        .then((data) => {
          if (data && data.imdbID) {
            enrichment.imdb_id = data.imdbID;
            enrichment.imdb_rating = parseFiniteNumberFromString(
              data.imdbRating
            );
            enrichment.imdb_votes = parseFiniteNumberFromString(data.imdbVotes);
            enrichment.metascore = parseFiniteNumberFromString(data.Metascore);
            enrichment.rotten_tomatoes = data.Ratings?.find(
              (r) => r.Source === 'Rotten Tomatoes'
            )?.Value;
            enrichment.box_office = data.BoxOffice;
            enrichment.box_office_amount = parseBoxOffice(data.BoxOffice);
            enrichment.rotten_tomatoes_score = parseRottenTomatoesScore(
              data.Ratings
            );
            enrichment.awards = data.Awards;
            enrichment.rated = data.Rated;
            log.info('OMDB data fetched via title search', { tmdb_id, title });
          }
        })
        .catch((err) =>
          log.warn('OMDB title search failed', { error: err, title })
        )
    );
  }

  // 2. Trakt - optional (disabled by feature flag)
  if (ENABLE_TRAKT_ENRICHMENT) {
    promises.push(
      (async () => {
        const start = Date.now();
        log.debug('Enrichment: Trakt getByTMDBId start', {
          tmdb_id,
          content_type,
        });
        const item = await traktClient.getByTMDBId(finalTmdbId, content_type);
        const durationMs = Date.now() - start;
        log.debug('Enrichment: Trakt getByTMDBId done', {
          tmdb_id,
          content_type,
          durationMs,
          found: !!item,
        });
        return item;
      })()
        .then(async (traktItem) => {
          if (traktItem) {
            // Trakt integration removed from enrichment
            // Will be used differently in the future
            log.info('Trakt data fetched (not stored in enrichment)', {
              tmdb_id,
            });
          }
        })
        .catch((err) => log.warn('Trakt fetch failed', { error: err, tmdb_id }))
    );
  } else {
    log.debug('Enrichment: Trakt disabled by feature flag', {
      tmdb_id,
      content_type,
    });
  }

  // 3. FanArt - Use TMDB ID
  promises.push(
    (async () => {
      const start = Date.now();
      log.debug('Enrichment: FanArt getArtwork start', {
        tmdb_id,
        content_type,
      });
      const artwork = await fanartClient.getArtwork(finalTmdbId, content_type);
      const durationMs = Date.now() - start;
      log.debug('Enrichment: FanArt getArtwork done', {
        tmdb_id,
        content_type,
        durationMs,
        hasPayload: !!artwork,
      });
      return artwork;
    })()
      .then((artwork) => {
        if (artwork) {
          const bestArtwork = fanartClient.getBestArtwork(
            artwork,
            content_type
          );
          enrichment.logo_url = bestArtwork.logo_url;
          enrichment.clearart_url = bestArtwork.clearart_url;
          enrichment.banner_url = bestArtwork.banner_url;
          enrichment.thumb_url = bestArtwork.thumb_url;
          enrichment.disc_url = bestArtwork.disc_url;
          enrichment.poster_url = bestArtwork.poster_url;
          enrichment.background_url = bestArtwork.background_url;
          enrichment.fanart_response = artwork; // Keep full response for multiple artwork options
          log.info('FanArt data fetched', {
            tmdb_id,
            hasLogo: !!enrichment.logo_url,
          });
        }
      })
      .catch((err) => log.warn('FanArt fetch failed', { error: err, tmdb_id }))
  );

  // 4. YouTube - Search for trailer
  if (title) {
    promises.push(
      (async () => {
        const start = Date.now();
        log.debug('Enrichment: YouTube search start', {
          tmdb_id,
          content_type,
          title,
          year,
        });
        const res = await (content_type === 'movie'
          ? youtubeClient.searchMovieTrailers(title, year)
          : youtubeClient.searchTVTrailers(title));
        const durationMs = Date.now() - start;
        log.debug('Enrichment: YouTube search done', {
          tmdb_id,
          content_type,
          durationMs,
          resultCount: res?.length || 0,
        });
        return res;
      })()
        .then((videos) => {
          if (videos && videos.length > 0) {
            const trailer = videos[0];
            enrichment.trailer_youtube_id = trailer.id;
            enrichment.trailer_title = trailer.title;
            enrichment.trailer_channel_name = trailer.channelTitle;
            enrichment.trailer_published_at = trailer.publishedAt;

            // Extract high-quality thumbnail URL
            // The YouTube client should provide this in the response
            const rawVideo = videos[0] as any;
            if (rawVideo.thumbnails) {
              enrichment.trailer_thumbnail_url =
                rawVideo.thumbnails.high?.url ||
                rawVideo.thumbnails.medium?.url ||
                rawVideo.thumbnails.default?.url;
            } else if (trailer.id) {
              // Fallback to standard YouTube thumbnail URL format
              enrichment.trailer_thumbnail_url = `https://img.youtube.com/vi/${trailer.id}/maxresdefault.jpg`;
            }

            enrichment.youtube_response = videos; // Keep all videos for dynamic display
            log.info('YouTube trailer found', {
              tmdb_id,
              trailer_id: enrichment.trailer_youtube_id,
              channel: enrichment.trailer_channel_name,
            });
          }
        })
        .catch((err) =>
          log.warn('YouTube search failed', { error: err, title })
        )
    );
  }

  // Wait for all enrichments to complete
  await Promise.allSettled(promises);

  log.info('Content enrichment completed', {
    tmdb_id,
    hasOMDB: !!enrichment.imdb_rating,
    hasFanArt: !!enrichment.logo_url,
    hasTrailer: !!enrichment.trailer_youtube_id,
  });

  // Store enrichment data in database
  log.debug('Enrichment: store start', { tmdb_id, content_type });
  await storeEnrichmentData(enrichment);
  log.debug('Enrichment: store done', { tmdb_id, content_type });

  return enrichment;
}

async function storeEnrichmentData(enrichment: EnrichmentData): Promise<void> {
  try {
    // Log a compact shape of values to be stored (types and sizes only)
    const shape = {
      tmdb_id: enrichment.tmdb_id,
      content_type: enrichment.content_type,
      imdb_id: !!enrichment.imdb_id,
      imdb_rating: typeof enrichment.imdb_rating,
      imdb_votes: typeof enrichment.imdb_votes,
      metascore: typeof enrichment.metascore,
      rotten_tomatoes: typeof enrichment.rotten_tomatoes,
      rotten_tomatoes_len: enrichment.rotten_tomatoes?.length || 0,
      box_office: typeof enrichment.box_office,
      box_office_len: enrichment.box_office?.length || 0,
      awards: typeof enrichment.awards,
      rated: typeof enrichment.rated,
      logo_url: typeof enrichment.logo_url,
      clearart_url: typeof enrichment.clearart_url,
      banner_url: typeof enrichment.banner_url,
      thumb_url: typeof enrichment.thumb_url,
      disc_url: typeof enrichment.disc_url,
      poster_url: typeof enrichment.poster_url,
      background_url: typeof enrichment.background_url,
      trailer_youtube_id: typeof enrichment.trailer_youtube_id,
      trailer_title: typeof enrichment.trailer_title,
      trailer_title_len: enrichment.trailer_title?.length || 0,
      fanart_response_len: enrichment.fanart_response
        ? JSON.stringify(enrichment.fanart_response).length
        : 0,
      youtube_response_len: enrichment.youtube_response
        ? JSON.stringify(enrichment.youtube_response).length
        : 0,
    };
    log.debug('Enrichment: store values shape', shape as any);

    // Step 1: Ensure row exists with minimal data
    await metadataDB.exec`
      INSERT INTO content_enrichment (tmdb_id, content_type, fetched_at, updated_at)
      VALUES (${enrichment.tmdb_id}, ${enrichment.content_type}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (tmdb_id, content_type) DO NOTHING
    `;

    // Step 2: Update OMDB fields - split to isolate numeric issues
    // 2a: Update string fields first
    try {
      await metadataDB.exec`
        UPDATE content_enrichment SET
          imdb_id = ${enrichment.imdb_id ?? null},
          rotten_tomatoes = ${enrichment.rotten_tomatoes ?? null},
          box_office = ${enrichment.box_office ?? null},
          awards = ${enrichment.awards ?? null},
          rated = ${enrichment.rated ?? null},
          box_office_amount = ${enrichment.box_office_amount ?? null},
          rotten_tomatoes_score = ${enrichment.rotten_tomatoes_score ?? null},
          updated_at = CURRENT_TIMESTAMP
        WHERE tmdb_id = ${enrichment.tmdb_id}
          AND content_type = ${enrichment.content_type}
      `;
      log.debug('OMDB string fields and parsed numerics updated successfully');
    } catch (e) {
      log.error('Failed to update OMDB string fields', {
        error: e,
        tmdb_id: enrichment.tmdb_id,
      });
    }

    // 2b: Update numeric fields - now using REAL type instead of DECIMAL
    if (
      enrichment.imdb_rating !== undefined &&
      enrichment.imdb_rating !== null
    ) {
      try {
        const rating = Number(enrichment.imdb_rating);
        if (!isNaN(rating) && rating >= 0 && rating <= 10) {
          await metadataDB.exec`
            UPDATE content_enrichment SET
              imdb_rating = ${rating},
              updated_at = CURRENT_TIMESTAMP
            WHERE tmdb_id = ${enrichment.tmdb_id}
              AND content_type = ${enrichment.content_type}
          `;
          log.debug('OMDB imdb_rating updated successfully', { value: rating });
        }
      } catch (e) {
        log.error('Failed to update imdb_rating', {
          error: e,
          tmdb_id: enrichment.tmdb_id,
          imdb_rating: enrichment.imdb_rating,
        });
      }
    }

    if (enrichment.imdb_votes !== undefined && enrichment.imdb_votes !== null) {
      try {
        const votes = Math.floor(Number(enrichment.imdb_votes));
        if (!isNaN(votes) && votes >= 0) {
          await metadataDB.exec`
            UPDATE content_enrichment SET
              imdb_votes = ${votes},
              updated_at = CURRENT_TIMESTAMP
            WHERE tmdb_id = ${enrichment.tmdb_id}
              AND content_type = ${enrichment.content_type}
          `;
          log.debug('OMDB imdb_votes updated successfully', { value: votes });
        }
      } catch (e) {
        log.error('Failed to update imdb_votes', {
          error: e,
          tmdb_id: enrichment.tmdb_id,
          imdb_votes: enrichment.imdb_votes,
        });
      }
    }

    if (enrichment.metascore !== undefined && enrichment.metascore !== null) {
      try {
        const score = Math.floor(Number(enrichment.metascore));
        if (!isNaN(score) && score >= 0 && score <= 100) {
          await metadataDB.exec`
            UPDATE content_enrichment SET
              metascore = ${score},
              updated_at = CURRENT_TIMESTAMP
            WHERE tmdb_id = ${enrichment.tmdb_id}
              AND content_type = ${enrichment.content_type}
          `;
          log.debug('OMDB metascore updated successfully', { value: score });
        }
      } catch (e) {
        log.error('Failed to update metascore', {
          error: e,
          tmdb_id: enrichment.tmdb_id,
          metascore: enrichment.metascore,
        });
      }
    }

    // Step 3: Trakt fields removed from enrichment - will be used differently in the future

    // Step 4: Update FanArt URLs
    try {
      await metadataDB.exec`
        UPDATE content_enrichment SET
          logo_url = ${enrichment.logo_url ?? null},
          clearart_url = ${enrichment.clearart_url ?? null},
          banner_url = ${enrichment.banner_url ?? null},
          thumb_url = ${enrichment.thumb_url ?? null},
          disc_url = ${enrichment.disc_url ?? null},
          poster_url = ${enrichment.poster_url ?? null},
          background_url = ${enrichment.background_url ?? null},
          updated_at = CURRENT_TIMESTAMP
        WHERE tmdb_id = ${enrichment.tmdb_id}
          AND content_type = ${enrichment.content_type}
      `;
      log.debug('FanArt fields updated successfully');
    } catch (e) {
      log.error('Failed to update FanArt fields', {
        error: e,
        tmdb_id: enrichment.tmdb_id,
      });
    }

    // Step 5: Update YouTube fields
    try {
      await metadataDB.exec`
        UPDATE content_enrichment SET
          trailer_youtube_id = ${enrichment.trailer_youtube_id ?? null},
          trailer_title = ${enrichment.trailer_title ?? null},
          trailer_thumbnail_url = ${enrichment.trailer_thumbnail_url ?? null},
          trailer_channel_name = ${enrichment.trailer_channel_name ?? null},
          trailer_published_at = ${
            enrichment.trailer_published_at
              ? new Date(enrichment.trailer_published_at)
              : null
          },
          updated_at = CURRENT_TIMESTAMP
        WHERE tmdb_id = ${enrichment.tmdb_id}
          AND content_type = ${enrichment.content_type}
      `;
      log.debug('YouTube fields updated successfully');
    } catch (e) {
      log.error('Failed to update YouTube fields', {
        error: e,
        tmdb_id: enrichment.tmdb_id,
      });
    }

    // Step 6: Store FanArt and YouTube raw responses for dynamic multi-item display
    try {
      await metadataDB.exec`
        UPDATE content_enrichment SET
          fanart_response = ${
            enrichment.fanart_response
              ? JSON.stringify(enrichment.fanart_response)
              : null
          },
          youtube_response = ${
            enrichment.youtube_response
              ? JSON.stringify(enrichment.youtube_response)
              : null
          },
          updated_at = CURRENT_TIMESTAMP
        WHERE tmdb_id = ${enrichment.tmdb_id}
          AND content_type = ${enrichment.content_type}
      `;
      log.debug('Dynamic JSON responses updated successfully');
    } catch (e) {
      log.error('Failed to update dynamic JSON responses', {
        error: e,
        tmdb_id: enrichment.tmdb_id,
      });
    }

    log.info('Enrichment data stored', { tmdb_id: enrichment.tmdb_id });
  } catch (error) {
    const err: any = error;
    log.error('Failed to store enrichment data', {
      tmdb_id: enrichment.tmdb_id,
      code: err?.code,
      message: err?.message || String(error),
      detail: err?.detail,
      hint: err?.hint,
      error: err,
    });
  }
}
