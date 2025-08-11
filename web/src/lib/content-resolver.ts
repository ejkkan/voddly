/**
 * Content resolver implementation
 * Handles the logic of resolving content IDs to proper player context
 */

import { CatalogStorage } from "./catalog-storage";
import type {
  ContentResolver,
  EpisodeInfo,
  PlayerContext,
  SubtitleSearchParams,
} from "./content-types";

export class DefaultContentResolver implements ContentResolver {
  private storage: CatalogStorage;

  constructor() {
    this.storage = new CatalogStorage();
  }

  async resolveContent(
    playlistId: string,
    contentType: "movie" | "series" | "live",
    contentId: string,
    tmdbId?: number,
  ): Promise<PlayerContext> {
    await this.storage.init();

    switch (contentType) {
      case "movie":
        return this.resolveMovie(playlistId, contentId, tmdbId);

      case "series":
        return this.resolveSeries(playlistId, contentId, tmdbId);

      case "live":
        return this.resolveLive(playlistId, contentId, tmdbId);

      default:
        throw new Error(`Unknown content type: ${contentType}`);
    }
  }

  private async resolveMovie(
    playlistId: string,
    movieId: string,
    tmdbId?: number,
  ): Promise<PlayerContext> {
    const contentItem = await this.storage.getContentItem(playlistId, "movie", movieId);

    if (!contentItem) {
      throw new Error(`Movie ${movieId} not found`);
    }

    return {
      contentType: "movie",
      contentId: movieId,
      playlistId,
      title: contentItem.title,
      tmdbId: tmdbId || contentItem.tmdbId,
      movieInfo: {
        movieTitle: contentItem.title,
      },
    };
  }

  private async resolveSeries(
    playlistId: string,
    episodeId: string,
    tmdbId?: number,
  ): Promise<PlayerContext> {
    console.log("🔍 Resolving series for episode ID:", episodeId);

    // Find the parent series by looking through all series for this episode
    const allSeries = await this.storage.queryContent(playlistId, { type: "series" });
    console.log("📺 Found", allSeries.length, "series in storage");

    let parentSeries = null;
    let episodeInfo: EpisodeInfo | null = null;
    let seasonNumber = 1;
    let episodeNumber = 1;

    // Quick search through series with detailed episode data
    for (const series of allSeries) {
      if (series.data?.seasons) {
        for (const season of series.data.seasons) {
          if (season.episodes) {
            const foundEpisode = season.episodes.find(
              (episode: any) =>
                String(episode.id) === String(episodeId) ||
                String(episode.stream_id) === String(episodeId),
            );

            if (foundEpisode) {
              parentSeries = series;
              episodeInfo = foundEpisode;
              seasonNumber = season.season_number || foundEpisode.season_number || 1;
              episodeNumber = foundEpisode.episode_num || 1;
              console.log("✅ Found episode in detailed series data:", {
                seriesTitle: series.title,
                seasonNumber,
                episodeNumber,
                episodeTitle: foundEpisode.title,
              });
              break;
            }
          }
        }
      }
      if (parentSeries) break;
    }

    if (!parentSeries) {
      // Fallback: try to get episode directly (might be stored as individual item)
      const contentItem = await this.storage.getContentItem(
        playlistId,
        "series",
        episodeId,
      );
      if (contentItem) {
        return {
          contentType: "series",
          contentId: episodeId,
          playlistId,
          title: contentItem.title,
          tmdbId: tmdbId || contentItem.tmdbId,
          seriesInfo: {
            seriesId: episodeId,
            seriesTitle: contentItem.title,
            seasonNumber: 1,
            episodeNumber: 1,
            episodeTitle: contentItem.title,
          },
        };
      }
      // If no content item found either, create a minimal fallback context
      console.log("⚠️ Episode not found in storage, creating minimal fallback context");
      return {
        contentType: "series",
        contentId: episodeId, // This is the episode stream ID for playback
        playlistId,
        title: `Episode ${episodeId}`,
        tmdbId: tmdbId,
        seriesInfo: {
          seriesId: episodeId, // Fallback to episode ID
          seriesTitle: `Series for Episode ${episodeId}`,
          seasonNumber: 1, // Default values - subtitles may not work perfectly but playback will
          episodeNumber: 1,
          episodeTitle: `Episode ${episodeId}`,
        },
      };
    }

    // Get TMDB ID priority: URL param > episode > series
    const resolvedTmdbId = tmdbId || episodeInfo?.info?.tmdb_id || parentSeries.tmdbId;

    return {
      contentType: "series",
      contentId: episodeId, // This is the episode stream ID for playback
      playlistId,
      title: parentSeries.title,
      tmdbId: resolvedTmdbId,
      seriesInfo: {
        seriesId: parentSeries.contentId,
        seriesTitle: parentSeries.title,
        seasonNumber,
        episodeNumber,
        episodeTitle: episodeInfo?.title || `Episode ${episodeNumber}`,
      },
    };
  }

  private async resolveLive(
    playlistId: string,
    channelId: string,
    tmdbId?: number,
  ): Promise<PlayerContext> {
    const contentItem = await this.storage.getContentItem(playlistId, "live", channelId);

    if (!contentItem) {
      throw new Error(`Live channel ${channelId} not found`);
    }

    return {
      contentType: "live",
      contentId: channelId,
      playlistId,
      title: contentItem.title,
      tmdbId: tmdbId || contentItem.tmdbId,
      liveInfo: {
        channelTitle: contentItem.title,
      },
    };
  }

  getSubtitleParams(context: PlayerContext): SubtitleSearchParams {
    const baseParams: SubtitleSearchParams = {
      contentId: context.contentId,
      contentType: context.contentType,
      title: context.title,
      tmdbId: context.tmdbId,
    };

    switch (context.contentType) {
      case "movie":
        return {
          ...baseParams,
          // Only include query if we don't have TMDB ID - prefer TMDB-based search
          query: context.tmdbId ? undefined : context.movieInfo?.movieTitle,
          type: "movie",
        };

      case "series":
        return {
          ...baseParams,
          title: context.seriesInfo?.seriesTitle || context.title,
          seasonNumber: context.seriesInfo?.seasonNumber,
          episodeNumber: context.seriesInfo?.episodeNumber,
          seriesTitle: context.seriesInfo?.seriesTitle,
          // Only include query if we don't have TMDB ID - prefer TMDB-based search
          query: context.tmdbId ? undefined : context.seriesInfo?.seriesTitle,
          type: "episode",
        };

      case "live":
        return {
          ...baseParams,
          query: context.liveInfo?.channelTitle,
          type: undefined, // Live channels don't have a specific type
        };

      default:
        return baseParams;
    }
  }
}

// Singleton instance
export const contentResolver = new DefaultContentResolver();
