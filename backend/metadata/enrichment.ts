import log from 'encore.dev/log';
import { metadataDB } from './db';
import { OMDBClient } from './providers/omdb-client';
import { TraktClient } from './providers/trakt-client';
import { FanArtClient } from './providers/fanart-client';
import { YouTubeClient } from './providers/youtube-client';

export interface EnrichmentParams {
  tmdb_id: number;
  content_type: 'movie' | 'tv';
  imdb_id?: string;
  title?: string;
  year?: string;
}

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
  
  // Trakt
  trakt_id?: string;
  trakt_slug?: string;
  trakt_rating?: number;
  trakt_votes?: number;
  watchers?: number;
  plays?: number;
  collected_count?: number;
  watched_count?: number;
  trending_rank?: number;
  
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
  
  // Raw responses
  omdb_response?: any;
  trakt_response?: any;
  fanart_response?: any;
  youtube_response?: any;
}

export async function enrichWithExternalAPIs(params: EnrichmentParams): Promise<EnrichmentData> {
  const { tmdb_id, content_type, imdb_id, title, year } = params;
  
  log.info('Starting content enrichment', { tmdb_id, content_type, imdb_id, title });
  
  const enrichment: EnrichmentData = {
    tmdb_id,
    content_type,
  };

  // Initialize clients
  const omdbClient = new OMDBClient();
  const traktClient = new TraktClient();
  const fanartClient = new FanArtClient();
  const youtubeClient = new YouTubeClient();

  // Fetch all data in parallel for maximum speed
  const promises: Promise<void>[] = [];

  // 1. OMDB - Fetch if we have IMDB ID
  if (imdb_id) {
    promises.push(
      omdbClient.fetchByIMDBId(imdb_id)
        .then(data => {
          if (data) {
            enrichment.imdb_id = imdb_id;
            enrichment.imdb_rating = data.imdbRating ? parseFloat(data.imdbRating) : undefined;
            enrichment.imdb_votes = data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, '')) : undefined;
            enrichment.metascore = data.Metascore ? parseInt(data.Metascore) : undefined;
            enrichment.rotten_tomatoes = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value;
            enrichment.box_office = data.BoxOffice;
            enrichment.awards = data.Awards;
            enrichment.rated = data.Rated;
            enrichment.omdb_response = data;
            log.info('OMDB data fetched', { tmdb_id, imdb_id });
          }
        })
        .catch(err => log.warn('OMDB fetch failed', { error: err, imdb_id }))
    );
  } else if (title) {
    // Fallback: Try to search by title if no IMDB ID
    promises.push(
      omdbClient.searchByTitle(title, year, content_type === 'tv' ? 'series' : 'movie')
        .then(data => {
          if (data && data.imdbID) {
            enrichment.imdb_id = data.imdbID;
            enrichment.imdb_rating = data.imdbRating ? parseFloat(data.imdbRating) : undefined;
            enrichment.imdb_votes = data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, '')) : undefined;
            enrichment.metascore = data.Metascore ? parseInt(data.Metascore) : undefined;
            enrichment.box_office = data.BoxOffice;
            enrichment.awards = data.Awards;
            enrichment.rated = data.Rated;
            enrichment.omdb_response = data;
            log.info('OMDB data fetched via title search', { tmdb_id, title });
          }
        })
        .catch(err => log.warn('OMDB title search failed', { error: err, title }))
    );
  }

  // 2. Trakt - Use TMDB ID directly
  promises.push(
    traktClient.getByTMDBId(tmdb_id, content_type)
      .then(async (traktItem) => {
        if (traktItem) {
          enrichment.trakt_id = String(traktItem.ids.trakt);
          enrichment.trakt_slug = traktItem.ids.slug;
          enrichment.trakt_response = traktItem;
          
          // Get additional stats and ratings in parallel
          const [stats, ratings, trending] = await Promise.all([
            traktClient.getStats(traktItem.ids.trakt, content_type),
            traktClient.getRatings(traktItem.ids.trakt, content_type),
            traktClient.getTrendingRank(traktItem.ids.trakt, content_type)
          ]);
          
          if (stats) {
            enrichment.watchers = stats.watchers;
            enrichment.plays = stats.plays;
            enrichment.collected_count = stats.collectors;
            enrichment.watched_count = stats.favorited;
          }
          
          if (ratings) {
            enrichment.trakt_rating = ratings.rating;
            enrichment.trakt_votes = ratings.votes;
          }
          
          if (trending) {
            enrichment.trending_rank = trending.rank;
          }
          
          log.info('Trakt data fetched', { tmdb_id, trakt_id: enrichment.trakt_id });
        }
      })
      .catch(err => log.warn('Trakt fetch failed', { error: err, tmdb_id }))
  );

  // 3. FanArt - Use TMDB ID
  promises.push(
    fanartClient.getArtwork(tmdb_id, content_type)
      .then(artwork => {
        if (artwork) {
          const bestArtwork = fanartClient.getBestArtwork(artwork, content_type);
          enrichment.logo_url = bestArtwork.logo_url;
          enrichment.clearart_url = bestArtwork.clearart_url;
          enrichment.banner_url = bestArtwork.banner_url;
          enrichment.thumb_url = bestArtwork.thumb_url;
          enrichment.disc_url = bestArtwork.disc_url;
          enrichment.poster_url = bestArtwork.poster_url;
          enrichment.background_url = bestArtwork.background_url;
          enrichment.fanart_response = artwork;
          log.info('FanArt data fetched', { tmdb_id, hasLogo: !!enrichment.logo_url });
        }
      })
      .catch(err => log.warn('FanArt fetch failed', { error: err, tmdb_id }))
  );

  // 4. YouTube - Search for trailer
  if (title) {
    promises.push(
      (content_type === 'movie' 
        ? youtubeClient.searchMovieTrailers(title, year)
        : youtubeClient.searchTVTrailers(title)
      )
        .then(videos => {
          if (videos && videos.length > 0) {
            enrichment.trailer_youtube_id = videos[0].id;
            enrichment.trailer_title = videos[0].title;
            enrichment.youtube_response = videos;
            log.info('YouTube trailer found', { tmdb_id, trailer_id: enrichment.trailer_youtube_id });
          }
        })
        .catch(err => log.warn('YouTube search failed', { error: err, title }))
    );
  }

  // Wait for all enrichments to complete
  await Promise.allSettled(promises);
  
  log.info('Content enrichment completed', { 
    tmdb_id, 
    hasOMDB: !!enrichment.imdb_rating,
    hasTrakt: !!enrichment.trakt_id,
    hasFanArt: !!enrichment.logo_url,
    hasTrailer: !!enrichment.trailer_youtube_id
  });

  // Store enrichment data in database
  await storeEnrichmentData(enrichment);

  return enrichment;
}

async function storeEnrichmentData(enrichment: EnrichmentData): Promise<void> {
  try {
    await metadataDB.exec`
      INSERT INTO content_enrichment (
        tmdb_id, content_type, 
        imdb_id, imdb_rating, imdb_votes, metascore, rotten_tomatoes, box_office, awards, rated,
        trakt_id, trakt_slug, trakt_rating, trakt_votes, watchers, plays, collected_count, watched_count, trending_rank,
        logo_url, clearart_url, banner_url, thumb_url, disc_url, poster_url, background_url,
        trailer_youtube_id, trailer_title,
        omdb_response, trakt_response, fanart_response, youtube_response,
        fetched_at, updated_at
      ) VALUES (
        ${enrichment.tmdb_id}, ${enrichment.content_type},
        ${enrichment.imdb_id}, ${enrichment.imdb_rating}, ${enrichment.imdb_votes}, 
        ${enrichment.metascore}, ${enrichment.rotten_tomatoes}, ${enrichment.box_office}, 
        ${enrichment.awards}, ${enrichment.rated},
        ${enrichment.trakt_id}, ${enrichment.trakt_slug}, ${enrichment.trakt_rating}, 
        ${enrichment.trakt_votes}, ${enrichment.watchers}, ${enrichment.plays}, 
        ${enrichment.collected_count}, ${enrichment.watched_count}, ${enrichment.trending_rank},
        ${enrichment.logo_url}, ${enrichment.clearart_url}, ${enrichment.banner_url}, 
        ${enrichment.thumb_url}, ${enrichment.disc_url}, ${enrichment.poster_url}, 
        ${enrichment.background_url},
        ${enrichment.trailer_youtube_id}, ${enrichment.trailer_title},
        ${JSON.stringify(enrichment.omdb_response)}, ${JSON.stringify(enrichment.trakt_response)}, 
        ${JSON.stringify(enrichment.fanart_response)}, ${JSON.stringify(enrichment.youtube_response)},
        NOW(), NOW()
      )
      ON CONFLICT (tmdb_id, content_type) 
      DO UPDATE SET
        imdb_id = EXCLUDED.imdb_id,
        imdb_rating = EXCLUDED.imdb_rating,
        imdb_votes = EXCLUDED.imdb_votes,
        metascore = EXCLUDED.metascore,
        rotten_tomatoes = EXCLUDED.rotten_tomatoes,
        box_office = EXCLUDED.box_office,
        awards = EXCLUDED.awards,
        rated = EXCLUDED.rated,
        trakt_id = EXCLUDED.trakt_id,
        trakt_slug = EXCLUDED.trakt_slug,
        trakt_rating = EXCLUDED.trakt_rating,
        trakt_votes = EXCLUDED.trakt_votes,
        watchers = EXCLUDED.watchers,
        plays = EXCLUDED.plays,
        collected_count = EXCLUDED.collected_count,
        watched_count = EXCLUDED.watched_count,
        trending_rank = EXCLUDED.trending_rank,
        logo_url = EXCLUDED.logo_url,
        clearart_url = EXCLUDED.clearart_url,
        banner_url = EXCLUDED.banner_url,
        thumb_url = EXCLUDED.thumb_url,
        disc_url = EXCLUDED.disc_url,
        poster_url = EXCLUDED.poster_url,
        background_url = EXCLUDED.background_url,
        trailer_youtube_id = EXCLUDED.trailer_youtube_id,
        trailer_title = EXCLUDED.trailer_title,
        omdb_response = EXCLUDED.omdb_response,
        trakt_response = EXCLUDED.trakt_response,
        fanart_response = EXCLUDED.fanart_response,
        youtube_response = EXCLUDED.youtube_response,
        updated_at = NOW()
    `;
    
    log.info('Enrichment data stored', { tmdb_id: enrichment.tmdb_id });
  } catch (error) {
    log.error('Failed to store enrichment data', { error, tmdb_id: enrichment.tmdb_id });
  }
}