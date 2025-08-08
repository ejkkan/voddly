import { api, APIError } from 'encore.dev/api';
import { constructStreamUrl, logUrlConstruction } from './stream-utils';

// ============================================================================
// CORE INTERFACES
// ============================================================================

interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

// Removed unsafe defaults. Credentials must be provided by the client per request.

// ============================================================================
// API INTERFACES
// ============================================================================

// GET PLAYLIST
interface GetPlaylistParams {
  server?: string;
  username?: string;
  password?: string;
  amount?: number; // Optional, number of items to include (default: 10, use 0 for all)
}

interface PlaylistResponse {
  totalSize: number;
  totalChannels: number;
  totalVOD: number;
  totalSeries: number;
  downloadTime: number;
  serverUsed: string;
  timestamp: string;
  breakdown: {
    channels: ChannelSummary[];
    vodItems: VODSummary[];
    seriesItems: SeriesSummary[];
  };
}

interface ChannelSummary {
  stream_id: number;
  name: string;
  category_id: string;
  stream_type: string;
}

interface VODSummary {
  stream_id: number;
  name: string;
  category_id: string;
  stream_type: string;
  container_extension: string;
}

interface SeriesSummary {
  series_id: number;
  name: string;
  category_id: string;
  cover: string;
}

// GET CATEGORIES
interface GetCategoriesParams {
  server?: string;
  username?: string;
  password?: string;
  type: 'live' | 'vod' | 'series';
}

interface Category {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

interface CategoriesResponse {
  type: 'live' | 'vod' | 'series';
  totalCategories: number;
  serverUsed: string;
  categories: Category[];
}

// GET CATEGORY (single category info)
interface GetCategoryParams {
  server?: string;
  username?: string;
  password?: string;
  categoryId: string;
  type: 'live' | 'vod' | 'series';
}

interface CategoryInfoResponse {
  found: boolean;
  categoryData?: {
    category_id: string;
    category_name: string;
    parent_id?: number;
    type: 'live' | 'vod' | 'series';
    serverUsed: string;
  };
  error?: string;
}

// GET CONTENT BY CATEGORY (renamed from GET BY CATEGORY)
interface GetContentByCategoryParams {
  server?: string;
  username?: string;
  password?: string;
  categoryId: string;
  type: 'live' | 'vod' | 'series';
  amount?: number; // Optional, number of items to return (default: 0 for all)
}

interface ContentByCategoryResponse {
  categoryId: string;
  type: 'live' | 'vod' | 'series';
  totalItems: number;
  serverUsed: string;
  items: (ChannelSummary | VODSummary | SeriesSummary)[];
}

// GET MOVIE
interface GetMovieParams {
  server?: string;
  username?: string;
  password?: string;
  movieId: number;
}

interface MovieResponse {
  found: boolean;
  movieData?: {
    basicInfo: {
      stream_id: number;
      name: string;
      stream_type: string;
      stream_icon: string;
      rating: string;
      rating_5based: number;
      added: string;
      category_id: string;
      container_extension: string;
      direct_source: string;
    };
    detailedInfo: {
      plot: string;
      cast: string;
      director: string;
      genre: string;
      release_date: string;
      duration: string;
      country: string;
      youtube_trailer: string;
      bitrate: number;
      audio: any;
      video: any;
    };
    streaming: {
      streamingUrl: string;
      directUrl?: string;
      containerExtension: string;
    };
    serverUsed: string;
  };
  error?: string;
}

// GET SERIES
interface GetSeriesParams {
  server?: string;
  username?: string;
  password?: string;
  seriesId: number;
}

interface SeriesResponse {
  found: boolean;
  seriesData?: {
    basicInfo: {
      series_id: number;
      name: string;
      cover: string;
      plot: string;
      cast: string;
      director: string;
      genre: string;
      release_date: string;
      rating: string;
      rating_5based: number;
      category_id: string;
      backdrop_path: string[];
    };
    seasons: SeasonInfo[];
    totalSeasons: number;
    totalEpisodes: number;
    serverUsed: string;
  };
  error?: string;
}

interface SeasonInfo {
  season_number: number;
  episode_count: number;
  episodes: EpisodeInfo[];
}

interface EpisodeInfo {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    movie_image: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    release_date: string;
    rating: string;
    duration: string;
    bitrate: number;
    audio: any;
    video: any;
  };
  streamingUrl: string;
}

// GET LIVE
interface GetLiveParams {
  server?: string;
  username?: string;
  password?: string;
  channelId: number;
}

interface EPGProgram {
  id: string;
  start: string;
  end: string;
  title: string;
  description: string;
  lang: string;
  now_playing?: boolean;
}

interface LiveResponse {
  found: boolean;
  channelData?: {
    basicInfo: {
      stream_id: number;
      num: number;
      name: string;
      stream_type: string;
      stream_icon: string;
      epg_channel_id: string;
      added: string;
      category_id: string;
      tv_archive: number;
      direct_source: string;
      tv_archive_duration: number;
    };
    streaming: {
      streamingUrl: string;
      directUrl?: string;
    };
    epg: {
      hasEPG: boolean;
      currentProgram?: EPGProgram;
      nextProgram?: EPGProgram;
      todaysSchedule: EPGProgram[];
      totalPrograms: number;
    };
    serverUsed: string;
  };
  error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function tryBothServers<T>(
  creds: XtreamCredentials,
  operation: (server: string) => Promise<T>
): Promise<T> {
  // No fallback: caller must provide the exact server to use.
  return operation(creds.server);
}

function getSlicedArray<T>(array: T[], amount?: number): T[] {
  if (!amount || amount === 0) return array;
  return array.slice(0, amount);
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// GET PLAYLIST - Complete server structure with optional limiting
export const getPlaylist = api(
  { expose: false, auth: true, method: 'POST', path: '/xtream/playlist' },
  async ({
    server,
    username,
    password,
    amount,
  }: GetPlaylistParams): Promise<PlaylistResponse> => {
    const startTime = Date.now();
    if (!server || !username || !password) {
      throw APIError.invalidArgument('Missing credentials');
    }
    const creds: XtreamCredentials = { server, username, password };

    try {
      console.log('Fetching playlist data...');

      const [channels, vodItems, seriesItems] = await tryBothServers(
        creds,
        async (serverUrl) => {
          creds.server = serverUrl;

          const [channelsResponse, vodResponse, seriesResponse] =
            await Promise.all([
              fetch(
                `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_live_streams`
              ),
              fetch(
                `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_streams`
              ),
              fetch(
                `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series`
              ),
            ]);

          if (!channelsResponse.ok || !vodResponse.ok || !seriesResponse.ok) {
            throw new Error('Failed to fetch data');
          }

          return Promise.all([
            channelsResponse.json(),
            vodResponse.json(),
            seriesResponse.json(),
          ]);
        }
      );

      const channelsArray = Array.isArray(channels) ? channels : [];
      const vodArray = Array.isArray(vodItems) ? vodItems : [];
      const seriesArray = Array.isArray(seriesItems) ? seriesItems : [];

      // Calculate total data size
      const totalSize =
        JSON.stringify(channelsArray).length +
        JSON.stringify(vodArray).length +
        JSON.stringify(seriesArray).length;

      return {
        totalSize,
        totalChannels: channelsArray.length,
        totalVOD: vodArray.length,
        totalSeries: seriesArray.length,
        downloadTime: Date.now() - startTime,
        serverUsed: creds.server,
        timestamp: new Date().toISOString(),
        breakdown: {
          channels: getSlicedArray(channelsArray, amount).map((ch: any) => ({
            stream_id: ch.stream_id,
            name: ch.name || 'Unknown',
            category_id: ch.category_id || 'unknown',
            stream_type: ch.stream_type || 'live',
          })),
          vodItems: getSlicedArray(vodArray, amount).map((vod: any) => ({
            stream_id: vod.stream_id,
            name: vod.name || 'Unknown',
            category_id: vod.category_id || 'unknown',
            stream_type: vod.stream_type || 'movie',
            container_extension: vod.container_extension || 'mp4',
          })),
          seriesItems: getSlicedArray(seriesArray, amount).map(
            (series: any) => ({
              series_id: series.series_id,
              name: series.name || 'Unknown',
              category_id: series.category_id || 'unknown',
              cover: series.cover || '',
            })
          ),
        },
      };
    } catch (error) {
      console.error('Error fetching playlist:', error);
      throw APIError.unavailable(
        `Failed to fetch playlist: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
);

// GET CATEGORIES - Get all categories with names
export const getCategories = api(
  { expose: false, auth: true, method: 'POST', path: '/xtream/categories' },
  async ({
    server,
    username,
    password,
    type,
  }: GetCategoriesParams): Promise<CategoriesResponse> => {
    if (!server || !username || !password) {
      throw APIError.invalidArgument('Missing credentials');
    }
    const creds: XtreamCredentials = { server, username, password };

    try {
      console.log(`Fetching ${type} categories...`);

      let action: string;
      switch (type) {
        case 'live':
          action = 'get_live_categories';
          break;
        case 'vod':
          action = 'get_vod_categories';
          break;
        case 'series':
          action = 'get_series_categories';
          break;
        default:
          throw APIError.invalidArgument('Type must be live, vod, or series');
      }

      const categories = await tryBothServers(creds, async (serverUrl) => {
        creds.server = serverUrl;

        const response = await fetch(
          `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=${action}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`);
        }

        return response.json() as Promise<any>;
      });

      const categoriesArray = Array.isArray(categories) ? categories : [];

      const mappedCategories: Category[] = categoriesArray.map((cat: any) => ({
        category_id: cat.category_id || cat.id || 'unknown',
        category_name: cat.category_name || cat.name || 'Unknown Category',
        parent_id: cat.parent_id || undefined,
      }));

      return {
        type,
        totalCategories: mappedCategories.length,
        serverUsed: creds.server,
        categories: mappedCategories,
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw APIError.unavailable(
        `Failed to fetch categories: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
);

// GET CATEGORY - Get info about a specific category
export const getCategory = api(
  { expose: false, auth: true, method: 'POST', path: '/xtream/category-info' },
  async ({
    server,
    username,
    password,
    categoryId,
    type,
  }: GetCategoryParams): Promise<CategoryInfoResponse> => {
    if (!server || !username || !password) {
      throw APIError.invalidArgument('Missing credentials');
    }
    const creds: XtreamCredentials = { server, username, password };

    try {
      console.log(`Fetching category ${categoryId} info...`);

      let action: string;
      switch (type) {
        case 'live':
          action = 'get_live_categories';
          break;
        case 'vod':
          action = 'get_vod_categories';
          break;
        case 'series':
          action = 'get_series_categories';
          break;
        default:
          throw APIError.invalidArgument('Type must be live, vod, or series');
      }

      const categories = await tryBothServers(creds, async (serverUrl) => {
        creds.server = serverUrl;

        const response = await fetch(
          `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=${action}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`);
        }

        return response.json() as Promise<any>;
      });

      const categoriesArray = Array.isArray(categories) ? categories : [];
      const category = categoriesArray.find(
        (cat: any) => (cat.category_id || cat.id) === categoryId
      );

      if (!category) {
        return {
          found: false,
          error: `Category ${categoryId} not found`,
        };
      }

      return {
        found: true,
        categoryData: {
          category_id: category.category_id || category.id || categoryId,
          category_name:
            category.category_name || category.name || 'Unknown Category',
          parent_id: category.parent_id || undefined,
          type,
          serverUsed: creds.server,
        },
      };
    } catch (error) {
      console.error('Error fetching category info:', error);
      return {
        found: false,
        error: `Failed to fetch category info: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }
);

// GET CONTENT BY CATEGORY - Get all items in a specific category (renamed from getByCategory)
export const getContentByCategory = api(
  {
    expose: false,
    auth: true,
    method: 'POST',
    path: '/xtream/content-by-category',
  },
  async ({
    server,
    username,
    password,
    categoryId,
    type,
    amount,
  }: GetContentByCategoryParams): Promise<ContentByCategoryResponse> => {
    if (!server || !username || !password) {
      throw APIError.invalidArgument('Missing credentials');
    }
    const creds: XtreamCredentials = { server, username, password };

    try {
      console.log(`Fetching ${type} items for category ${categoryId}...`);

      let action: string;
      switch (type) {
        case 'live':
          action = 'get_live_streams';
          break;
        case 'vod':
          action = 'get_vod_streams';
          break;
        case 'series':
          action = 'get_series';
          break;
        default:
          throw APIError.invalidArgument('Type must be live, vod, or series');
      }

      const items = await tryBothServers(creds, async (serverUrl) => {
        creds.server = serverUrl;

        let url = `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=${action}`;
        if (type !== 'live') {
          url += `&category_id=${categoryId}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        return response.json() as Promise<any>;
      });

      const itemsArray = Array.isArray(items) ? items : [];

      // Filter by category if needed (for live streams)
      const filteredItems =
        type === 'live'
          ? itemsArray.filter((item: any) => item.category_id === categoryId)
          : itemsArray;

      const limitedItems = getSlicedArray(filteredItems, amount);

      let mappedItems;
      switch (type) {
        case 'live':
          mappedItems = limitedItems.map((ch: any) => ({
            stream_id: ch.stream_id,
            name: ch.name || 'Unknown',
            category_id: ch.category_id || 'unknown',
            stream_type: ch.stream_type || 'live',
          }));
          break;
        case 'vod':
          mappedItems = limitedItems.map((vod: any) => ({
            stream_id: vod.stream_id,
            name: vod.name || 'Unknown',
            category_id: vod.category_id || 'unknown',
            stream_type: vod.stream_type || 'movie',
            container_extension: vod.container_extension || 'mp4',
          }));
          break;
        case 'series':
          mappedItems = limitedItems.map((series: any) => ({
            series_id: series.series_id,
            name: series.name || 'Unknown',
            category_id: series.category_id || 'unknown',
            cover: series.cover || '',
          }));
          break;
      }

      return {
        categoryId,
        type,
        totalItems: filteredItems.length,
        serverUsed: creds.server,
        items: mappedItems,
      };
    } catch (error) {
      console.error('Error fetching content by category:', error);
      throw APIError.unavailable(
        `Failed to fetch content by category: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
);

// GET MOVIE - Complete movie information and streaming URL
export const getMovie = api(
  { expose: false, auth: true, method: 'POST', path: '/xtream/movie' },
  async ({
    server,
    username,
    password,
    movieId,
  }: GetMovieParams): Promise<MovieResponse> => {
    if (!server || !username || !password) {
      throw APIError.invalidArgument('Missing credentials');
    }
    const creds: XtreamCredentials = { server, username, password };

    try {
      console.log(`Fetching movie details for ID ${movieId}...`);

      const movieData = await tryBothServers(creds, async (serverUrl) => {
        creds.server = serverUrl;

        const response = await fetch(
          `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_info&vod_id=${movieId}`
        );

        if (!response.ok) {
          throw new Error(`Movie not found: ${response.status}`);
        }

        return response.json() as Promise<any>;
      });

      if (!movieData.info || !movieData.movie_data) {
        return {
          found: false,
          error: 'Invalid movie data received from server',
        };
      }

      // Debug log to see what container extension we're getting
      console.log(
        `Movie ${movieId} container_extension:`,
        movieData.info.container_extension
      );
      console.log('Full movie info:', JSON.stringify(movieData.info, null, 2));

      // Use the new stream URL utility for consistent URL construction
      const containerExt = movieData.info.container_extension;
      const videoCodec = movieData.movie_data?.video?.codec_name;
      const audioCodec = movieData.movie_data?.audio?.codec_name;

      const streamResult = constructStreamUrl({
        server: creds.server,
        username: creds.username,
        password: creds.password,
        contentId: movieId,
        contentType: 'movie',
        containerExtension: containerExt,
        videoCodec,
        audioCodec,
      });

      // Log the construction process for debugging
      logUrlConstruction(
        movieId,
        'movie',
        containerExt,
        videoCodec,
        audioCodec,
        streamResult
      );

      const streamingUrl = streamResult.streamingUrl;

      return {
        found: true,
        movieData: {
          basicInfo: movieData.info,
          detailedInfo: movieData.movie_data,
          streaming: {
            streamingUrl,
            directUrl: movieData.info.direct_source || undefined,
            containerExtension: streamResult.extension,
          },
          serverUsed: creds.server,
        },
      };
    } catch (error) {
      console.error('Error fetching movie details:', error);
      return {
        found: false,
        error: `Failed to get movie details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }
);

// GET SERIES - Complete series information with seasons and episodes
export const getSeries = api(
  { expose: false, auth: true, method: 'POST', path: '/xtream/series' },
  async ({
    server,
    username,
    password,
    seriesId,
  }: GetSeriesParams): Promise<SeriesResponse> => {
    if (!server || !username || !password) {
      throw APIError.invalidArgument('Missing credentials');
    }
    const creds: XtreamCredentials = { server, username, password };

    try {
      console.log(`Fetching series details for ID ${seriesId}...`);

      const seriesData = await tryBothServers(creds, async (serverUrl) => {
        creds.server = serverUrl;

        const response = await fetch(
          `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series_info&series_id=${seriesId}`
        );

        if (!response.ok) {
          throw new Error(`Series not found: ${response.status}`);
        }

        return response.json() as Promise<any>;
      });

      // console.log('Series data received:', JSON.stringify(seriesData, null, 2));

      if (!seriesData.info) {
        return {
          found: false,
          error: 'No series info received from server',
        };
      }

      // Check if episodes exist and is an object (Xtream API uses 'episodes' not 'seasons')
      const episodesData = seriesData.episodes || seriesData.seasons;
      if (!episodesData || typeof episodesData !== 'object') {
        console.log('No episodes data available for this series');
        return {
          found: true,
          seriesData: {
            basicInfo: seriesData.info,
            seasons: [],
            totalSeasons: 0,
            totalEpisodes: 0,
            serverUsed: creds.server,
          },
        };
      }

      const seasons: SeasonInfo[] = [];
      let totalEpisodes = 0;

      // console.log('Processing episodes by season:', Object.keys(episodesData));

      // Process each season (episodes are grouped by season number)
      Object.keys(episodesData).forEach((seasonNum) => {
        const seasonData = episodesData[seasonNum];
        if (Array.isArray(seasonData)) {
          const episodes: EpisodeInfo[] = seasonData.map((episode: any) => {
            // Use the stream URL utility for consistent URL construction
            const streamResult = constructStreamUrl({
              server: creds.server,
              username: creds.username,
              password: creds.password,
              contentId: episode.id,
              contentType: 'series',
              containerExtension: episode.container_extension,
              // Note: Episodes don't typically have codec info, so we use defaults
            });
            const streamingUrl = streamResult.streamingUrl;
            return {
              id: episode.id,
              episode_num: episode.episode_num,
              title: episode.title,
              container_extension: episode.container_extension,
              info: episode.info || {},
              streamingUrl,
            };
          });

          seasons.push({
            season_number: parseInt(seasonNum),
            episode_count: episodes.length,
            episodes,
          });

          totalEpisodes += episodes.length;
        }
      });

      return {
        found: true,
        seriesData: {
          basicInfo: seriesData.info,
          seasons,
          totalSeasons: seasons.length,
          totalEpisodes,
          serverUsed: creds.server,
        },
      };
    } catch (error) {
      console.error('Error fetching series details:', error);
      return {
        found: false,
        error: `Failed to get series details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }
);

// GET LIVE - Complete live channel information
export const getLive = api(
  { expose: false, auth: true, method: 'POST', path: '/xtream/live' },
  async ({
    server,
    username,
    password,
    channelId,
  }: GetLiveParams): Promise<LiveResponse> => {
    if (!server || !username || !password) {
      throw APIError.invalidArgument('Missing credentials');
    }
    const creds: XtreamCredentials = { server, username, password };

    try {
      console.log(`Fetching live channel details for ID ${channelId}...`);

      const channels = await tryBothServers(creds, async (serverUrl) => {
        creds.server = serverUrl;

        const response = await fetch(
          `${serverUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_live_streams`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch channels: ${response.status}`);
        }

        return response.json() as Promise<any>;
      });

      const channelsArray = Array.isArray(channels) ? channels : [];
      const channel = channelsArray.find(
        (ch: any) => ch.stream_id === channelId
      );

      if (!channel) {
        return {
          found: false,
          error: 'Channel not found',
        };
      }

      // Use the stream URL utility for consistent URL construction
      const streamResult = constructStreamUrl({
        server: creds.server,
        username: creds.username,
        password: creds.password,
        contentId: channelId,
        contentType: 'live',
        // Live channels typically don't have container extension info, so we use defaults
      });
      const streamingUrl = streamResult.streamingUrl;

      // Fetch EPG data for this channel
      const epgData = await fetchEPGData(creds, channelId);

      return {
        found: true,
        channelData: {
          basicInfo: channel,
          streaming: {
            streamingUrl,
            directUrl: channel.direct_source || undefined,
          },
          epg: epgData,
          serverUsed: creds.server,
        },
      };
    } catch (error) {
      console.error('Error fetching live channel details:', error);
      return {
        found: false,
        error: `Failed to get channel details: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }
);

// Helper function to fetch EPG data for a channel
async function fetchEPGData(
  creds: XtreamCredentials,
  channelId: number
): Promise<{
  hasEPG: boolean;
  currentProgram?: EPGProgram;
  nextProgram?: EPGProgram;
  todaysSchedule: EPGProgram[];
  totalPrograms: number;
}> {
  try {
    // Try to fetch EPG data using multiple Xtream API endpoints
    const epgUrls = [
      `${creds.server}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_short_epg&stream_id=${channelId}`,
      `${creds.server}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_simple_data_table&stream_id=${channelId}`,
    ];

    for (const url of epgUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const epgData = (await response.json()) as any;

          if (
            epgData &&
            (epgData.epg_listings || epgData.epg || Array.isArray(epgData))
          ) {
            const programs = parseEPGData(epgData);

            if (programs.length > 0) {
              const now = new Date();
              const currentProgram = programs.find(
                (p) => new Date(p.start) <= now && new Date(p.end) > now
              );

              const nextProgram = programs.find((p) => new Date(p.start) > now);

              return {
                hasEPG: true,
                currentProgram,
                nextProgram,
                todaysSchedule: programs,
                totalPrograms: programs.length,
              };
            }
          }
        }
      } catch (error) {
        console.log(`EPG fetch failed for URL: ${url}`, error);
        continue;
      }
    }

    // No EPG data available
    return {
      hasEPG: false,
      todaysSchedule: [],
      totalPrograms: 0,
    };
  } catch (error) {
    console.error('Error fetching EPG data:', error);
    return {
      hasEPG: false,
      todaysSchedule: [],
      totalPrograms: 0,
    };
  }
}

// Helper function to parse EPG data from various response formats
function parseEPGData(epgData: any): EPGProgram[] {
  const programs: EPGProgram[] = [];

  try {
    let listings: any[] = [];

    // Handle different response formats
    if (epgData.epg_listings) {
      listings = Array.isArray(epgData.epg_listings)
        ? epgData.epg_listings
        : Object.values(epgData.epg_listings);
    } else if (epgData.epg) {
      listings = Array.isArray(epgData.epg)
        ? epgData.epg
        : Object.values(epgData.epg);
    } else if (Array.isArray(epgData)) {
      listings = epgData;
    }

    for (const item of listings) {
      if (item && item.start && item.title) {
        programs.push({
          id: item.id || `${item.start}_${item.title}`,
          start: item.start,
          end: item.stop || item.end || '',
          title: item.title || 'Unknown Program',
          description: item.description || item.desc || '',
          lang: item.lang || 'en',
          now_playing: false, // Will be determined in fetchEPGData
        });
      }
    }

    // Sort programs by start time
    programs.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  } catch (error) {
    console.error('Error parsing EPG data:', error);
  }

  return programs;
}
