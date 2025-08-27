'use client';

export interface ParsedEpisode {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description?: string | null;
  airDate?: string | null;
  streamId: string;
  containerExtension?: string | null;
  lastModified?: string | null;
  originalPayload: any;
}

export interface ParsedSeason {
  seasonNumber: number;
  episodeCount?: number;
  name?: string;
  overview?: string;
  airDate?: string;
  cover?: string;
}

interface V1Episode {
  id: string;
  episode_num: number;
  title: string;
  container_extension?: string;
  info?: {
    plot?: string;
    air_date?: string;
    release_date?: string;
    [key: string]: any;
  };
  custom_sid?: string | null;
  added?: string | number;
  season?: number;
  [key: string]: any;
}

interface V2Season {
  season_number: number;
  episode_count?: number;
  name?: string;
  overview?: string;
  air_date?: string;
  cover?: string;
  cover_big?: string;
  id?: number;
}

export function parseSeriesData(data: any): {
  episodes: ParsedEpisode[];
  seasons: ParsedSeason[];
} {
  const episodes: ParsedEpisode[] = [];
  const seasons: ParsedSeason[] = [];

  if (!data) {
    return { episodes, seasons };
  }

  const seriesItemId = data.seriesItemId || '';

  // Check for V1 format (episodes object with season keys)
  if (
    data.episodes &&
    typeof data.episodes === 'object' &&
    !Array.isArray(data.episodes)
  ) {
    // V1 format
    const episodesObj = data.episodes;
    const seasonNumbers = new Set<number>();

    for (const [seasonKey, seasonEpisodes] of Object.entries(episodesObj)) {
      const seasonNum = parseInt(seasonKey, 10);
      if (isNaN(seasonNum)) continue;

      seasonNumbers.add(seasonNum);

      if (Array.isArray(seasonEpisodes)) {
        for (const ep of seasonEpisodes as V1Episode[]) {
          try {
            const episodeNumber =
              Number(ep.episode_num || ep.episode || 0) || 0;
            const episodeId = seriesItemId
              ? `${seriesItemId}:${seasonNum}:${episodeNumber}`
              : `${seasonNum}:${episodeNumber}`;

            const parsedEpisode: ParsedEpisode = {
              id: episodeId,
              seasonNumber: seasonNum,
              episodeNumber,
              title: String(ep.title || `Episode ${episodeNumber}`),
              description: ep.info?.plot ? String(ep.info.plot) : null,
              airDate: ep.info?.air_date || ep.info?.release_date || null,
              streamId: String(ep.id || ''),
              containerExtension: ep.container_extension
                ? String(ep.container_extension).trim()
                : null,
              lastModified: ep.added
                ? new Date(Number(ep.added) * 1000).toISOString()
                : null,
              originalPayload: ep,
            };

            episodes.push(parsedEpisode);
          } catch (error) {
            console.error(
              `Error parsing episode in season ${seasonNum}:`,
              error
            );
          }
        }
      }
    }

    // Create season metadata from episode data
    for (const seasonNum of Array.from(seasonNumbers).sort((a, b) => a - b)) {
      const seasonEpisodes = episodes.filter(
        (ep) => ep.seasonNumber === seasonNum
      );
      seasons.push({
        seasonNumber: seasonNum,
        episodeCount: seasonEpisodes.length,
        name: `Season ${seasonNum}`,
      });
    }
  }

  // Check for V2 format (seasons array)
  if (Array.isArray(data.seasons)) {
    // V2 format - we have season metadata
    for (const season of data.seasons as V2Season[]) {
      const seasonNum = Number(season.season_number || 0);
      if (seasonNum === 0) continue; // Skip specials season for now

      seasons.push({
        seasonNumber: seasonNum,
        episodeCount: season.episode_count,
        name: season.name || `Season ${seasonNum}`,
        overview: season.overview || undefined,
        airDate: season.air_date || undefined,
        cover: season.cover || season.cover_big || undefined,
      });
    }

    // For V2, episodes might be in a separate 'episodes' field or need to be fetched separately
    // If episodes are provided in a different format, parse them
    if (data.episodes && Array.isArray(data.episodes)) {
      // V2 might have episodes as a flat array with season info embedded
      for (const ep of data.episodes) {
        try {
          const seasonNum = Number(ep.season || ep.season_number || 1);
          const episodeNumber = Number(
            ep.episode || ep.episode_num || ep.episode_number || 0
          );
          const episodeId = seriesItemId
            ? `${seriesItemId}:${seasonNum}:${episodeNumber}`
            : `${seasonNum}:${episodeNumber}`;

          const parsedEpisode: ParsedEpisode = {
            id: episodeId,
            seasonNumber: seasonNum,
            episodeNumber,
            title: String(ep.title || ep.name || `Episode ${episodeNumber}`),
            description: ep.plot || ep.overview || ep.info?.plot || null,
            airDate:
              ep.air_date || ep.release_date || ep.info?.air_date || null,
            streamId: String(ep.id || ep.stream_id || ''),
            containerExtension: ep.container_extension
              ? String(ep.container_extension).trim()
              : null,
            lastModified:
              ep.added || ep.last_modified
                ? new Date(
                    Number(ep.added || ep.last_modified) * 1000
                  ).toISOString()
                : null,
            originalPayload: ep,
          };

          episodes.push(parsedEpisode);
        } catch (error) {
          console.error('Error parsing episode in v2 format:', error);
        }
      }
    }
  }

  return { episodes, seasons };
}

export async function fetchAndParseEpisodes(
  getSeriesInfo: (seriesId: string | number) => Promise<any>,
  seriesId: string | number,
  seriesItemId?: string,
  getSeasonEpisodes?: (
    seriesId: string | number,
    seasonNumber: number
  ) => Promise<any>
): Promise<{ episodes: ParsedEpisode[]; seasons: ParsedSeason[] }> {
  try {
    const data = await getSeriesInfo(seriesId);
    if (!data) {
      return { episodes: [], seasons: [] };
    }

    const extendedData = {
      ...data,
      seriesItemId,
    };

    const result = parseSeriesData(extendedData);

    // If we have seasons but no episodes and a season episode fetcher is provided,
    // fetch episodes for each season (V2 format that requires separate calls)
    if (
      result.seasons.length > 0 &&
      result.episodes.length === 0 &&
      getSeasonEpisodes
    ) {
      const allEpisodes: ParsedEpisode[] = [];

      for (const season of result.seasons) {
        try {
          const seasonData = await getSeasonEpisodes(
            seriesId,
            season.seasonNumber
          );
          if (seasonData && Array.isArray(seasonData)) {
            // Parse episodes from the season-specific response
            for (const ep of seasonData) {
              const episodeNumber = Number(
                ep.episode || ep.episode_num || ep.episode_number || 0
              );
              const episodeId = seriesItemId
                ? `${seriesItemId}:${season.seasonNumber}:${episodeNumber}`
                : `${season.seasonNumber}:${episodeNumber}`;

              const parsedEpisode: ParsedEpisode = {
                id: episodeId,
                seasonNumber: season.seasonNumber,
                episodeNumber,
                title: String(
                  ep.title ||
                    ep.name ||
                    `S${season.seasonNumber}E${episodeNumber}`
                ),
                description: ep.plot || ep.overview || ep.info?.plot || null,
                airDate:
                  ep.air_date || ep.release_date || ep.info?.air_date || null,
                streamId: String(ep.id || ep.stream_id || ''),
                containerExtension: ep.container_extension
                  ? String(ep.container_extension).trim()
                  : null,
                lastModified:
                  ep.added || ep.last_modified
                    ? new Date(
                        Number(ep.added || ep.last_modified) * 1000
                      ).toISOString()
                    : null,
                originalPayload: ep,
              };

              allEpisodes.push(parsedEpisode);
            }
          }
        } catch (error) {
          console.error(
            `Failed to fetch episodes for season ${season.seasonNumber}:`,
            error
          );
        }
      }

      return { episodes: allEpisodes, seasons: result.seasons };
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch and parse episodes:', error);
    return { episodes: [], seasons: [] };
  }
}
