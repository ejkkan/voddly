/**
 * Direct source fetching utilities for IPTV content
 * Fetches fresh data directly from the IPTV provider without using cached data
 */

import { apiClient } from "~/lib/api-client";

export interface SourceCredentials {
  server: string;
  username: string;
  password: string;
}

export interface DetailedVideoInfo {
  codec: string;
  codecLongName?: string;
  profile?: string;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  colorSpace?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  isHDR: boolean;
  pixelFormat?: string;
  aspectRatio?: string;
}

export interface DetailedAudioInfo {
  codec: string;
  codecLongName?: string;
  language: string;
  channels: number;
  channelLayout?: string;
  sampleRate: number;
  bitrate: number;
  sampleFormat?: string;
  default: boolean;
  index: number;
}

export interface DetailedSubtitleInfo {
  language: string;
  format: string;
  codec?: string;
  forced: boolean;
  default: boolean;
  index: number;
}

export interface ContainerInfo {
  format: string;
  formatLongName?: string;
  totalBitrate: number;
  duration: string;
  fileSize?: number;
  isMultiLanguage: boolean;
  encodingApp?: string;
  encodingDate?: string;
}

export interface FreshContentMetadata {
  // Basic content info from source
  contentId: string;
  contentType: "movie" | "series" | "live";
  title: string;
  description?: string;
  rating?: string;
  genre?: string;
  duration?: string | number;
  cover?: string;
  backdrop?: string;

  // Enhanced video information
  videoInfo?: DetailedVideoInfo;

  // Enhanced audio information (primary track)
  primaryAudioInfo?: DetailedAudioInfo;

  // All available tracks
  availableAudioTracks?: DetailedAudioInfo[];
  availableSubtitleTracks?: DetailedSubtitleInfo[];

  // Container information
  containerInfo?: ContainerInfo;

  // Source-specific data
  sourceData: any;

  // For series - episode information
  seasons?: any[];
  totalSeasons?: number;
  totalEpisodes?: number;

  // Stream metadata (from actual stream inspection)
  streamMetadata?: {
    url: string;
    format: string;
    audioTracks: any[];
    videoTracks: any[];
    subtitleTracks: any[];
    streamInfo: any;
  };

  // Timestamp when fetched
  fetchedAt: Date;
  fetchSource: "live" | "cache";
}

/**
 * Fetches fresh movie details directly from the IPTV source
 */
export async function fetchFreshMovieDetails(
  credentials: SourceCredentials,
  movieId: string,
  includeStreamMetadata = false,
): Promise<FreshContentMetadata> {
  console.log("🔄 Fetching fresh movie details from source:", movieId);

  try {
    // First, get the movie info from the VOD streams endpoint
    const vodStreamsResponse = await fetch(
      buildXtreamUrl(credentials, "get_vod_streams"),
      { credentials: "include" },
    );

    if (!vodStreamsResponse.ok) {
      throw new Error("Failed to fetch VOD streams");
    }

    const vodStreams = await vodStreamsResponse.json();
    const movieData = vodStreams.find(
      (movie: any) => String(movie.stream_id) === String(movieId),
    );

    if (!movieData) {
      throw new Error(`Movie ${movieId} not found in source`);
    }

    // Try to get additional details from the VOD info endpoint
    let detailedInfo = null;
    try {
      const vodInfoResponse = await fetch(
        buildXtreamUrl(credentials, "get_vod_info", { vod_id: movieId }),
        { credentials: "include" },
      );

      if (vodInfoResponse.ok) {
        detailedInfo = await vodInfoResponse.json();
      }
    } catch (error) {
      console.warn("Failed to fetch detailed VOD info:", error);
    }

    const result: FreshContentMetadata = {
      contentId: movieId,
      contentType: "movie",
      title: movieData.name || `Movie ${movieId}`,
      description: detailedInfo?.info?.plot || detailedInfo?.info?.description,
      rating: detailedInfo?.info?.rating,
      genre: detailedInfo?.info?.genre,
      duration: detailedInfo?.info?.duration || detailedInfo?.info?.episode_run_time,
      cover: detailedInfo?.info?.movie_image || movieData.stream_icon,
      backdrop: detailedInfo?.info?.backdrop_path?.[0],
      sourceData: {
        basic: movieData,
        detailed: detailedInfo,
      },
      fetchedAt: new Date(),
      fetchSource: "live",
    };

    // Parse detailed video information
    if (detailedInfo?.info?.video) {
      const video = detailedInfo.info.video;
      result.videoInfo = {
        codec: video.codec_name || "unknown",
        codecLongName: video.codec_long_name,
        profile: video.profile,
        width: video.width || 0,
        height: video.height || 0,
        frameRate: parseFloat(video.r_frame_rate?.split("/")[0]) || 0,
        bitrate: parseInt(video.tags?.BPS) || 0,
        colorSpace: video.color_space,
        colorTransfer: video.color_transfer,
        colorPrimaries: video.color_primaries,
        isHDR: video.color_transfer === "smpte2084" || video.color_primaries === "bt2020",
        pixelFormat: video.pix_fmt,
        aspectRatio: video.display_aspect_ratio,
      };
    }

    // Parse detailed audio information
    if (detailedInfo?.info?.audio) {
      const audio = detailedInfo.info.audio;
      result.primaryAudioInfo = {
        codec: audio.codec_name || "unknown",
        codecLongName: audio.codec_long_name,
        language: audio.tags?.language || "unknown",
        channels: audio.channels || 2,
        channelLayout: audio.channel_layout,
        sampleRate: parseInt(audio.sample_rate) || 48000,
        bitrate: parseInt(audio.bit_rate) || 0,
        sampleFormat: audio.sample_fmt,
        default: audio.disposition?.default === 1,
        index: audio.index || 1,
      };

      // Initialize available tracks with primary audio
      result.availableAudioTracks = [result.primaryAudioInfo];
    }

    // Parse container information
    if (detailedInfo?.info) {
      const info = detailedInfo.info;
      result.containerInfo = {
        format: movieData.container_extension || "unknown",
        totalBitrate: info.bitrate || 0,
        duration: info.duration || "",
        isMultiLanguage:
          movieData.name?.includes("[Multi") ||
          movieData.name?.includes("Multi-") ||
          false,
        encodingApp: info.video?.tags?._STATISTICS_WRITING_APP,
        encodingDate: info.video?.tags?._STATISTICS_WRITING_DATE_UTC,
      };
    }

    // Detect potential subtitle tracks based on naming
    if (
      result.containerInfo?.isMultiLanguage &&
      movieData.name?.includes("[Multi-Sub]")
    ) {
      result.availableSubtitleTracks = [
        { language: "eng", format: "srt", forced: false, default: true, index: 0 },
        { language: "spa", format: "srt", forced: false, default: false, index: 1 },
        { language: "fre", format: "srt", forced: false, default: false, index: 2 },
        { language: "ger", format: "srt", forced: false, default: false, index: 3 },
        { language: "ita", format: "srt", forced: false, default: false, index: 4 },
      ];
    }

    // Optionally fetch stream metadata
    if (includeStreamMetadata) {
      result.streamMetadata = await fetchStreamMetadata(credentials, movieId, "movie");
    }

    console.log("✅ Fresh movie details fetched:", result);
    return result;
  } catch (error) {
    console.error("❌ Failed to fetch fresh movie details:", error);
    throw error;
  }
}

/**
 * Fetches fresh series details directly from the IPTV source
 */
export async function fetchFreshSeriesDetails(
  credentials: SourceCredentials,
  seriesId: string,
  includeStreamMetadata = false,
): Promise<FreshContentMetadata> {
  console.log("🔄 Fetching fresh series details from source:", seriesId);

  try {
    // Use the existing API client for series details
    const detailedSeriesResponse = await apiClient.getSeriesDetails({
      server: credentials.server,
      username: credentials.username,
      password: credentials.password,
      seriesId: Number(seriesId),
    });

    if (!detailedSeriesResponse.found || !detailedSeriesResponse.seriesData) {
      throw new Error(`Series ${seriesId} not found in source`);
    }

    const seriesData = detailedSeriesResponse.seriesData;

    const result: FreshContentMetadata = {
      contentId: seriesId,
      contentType: "series",
      title: seriesData.basicInfo?.name || `Series ${seriesId}`,
      description: seriesData.basicInfo?.plot,
      rating: seriesData.basicInfo?.rating,
      genre: seriesData.basicInfo?.genre,
      cover: seriesData.basicInfo?.cover,
      backdrop: seriesData.basicInfo?.backdrop_path,
      seasons: seriesData.seasons,
      totalSeasons: seriesData.totalSeasons,
      totalEpisodes: seriesData.totalEpisodes,
      sourceData: {
        detailed: seriesData,
      },
      fetchedAt: new Date(),
      fetchSource: "live",
    };

    console.log("✅ Fresh series details fetched:", result);
    return result;
  } catch (error) {
    console.error("❌ Failed to fetch fresh series details:", error);
    throw error;
  }
}

/**
 * Fetches fresh live channel details directly from the IPTV source
 */
export async function fetchFreshLiveChannelDetails(
  credentials: SourceCredentials,
  channelId: string,
  includeStreamMetadata = false,
): Promise<FreshContentMetadata> {
  console.log("🔄 Fetching fresh live channel details from source:", channelId);

  try {
    // Get live streams from source
    const liveStreamsResponse = await fetch(
      buildXtreamUrl(credentials, "get_live_streams"),
      { credentials: "include" },
    );

    if (!liveStreamsResponse.ok) {
      throw new Error("Failed to fetch live streams");
    }

    const liveStreams = await liveStreamsResponse.json();
    const channelData = liveStreams.find(
      (channel: any) => String(channel.stream_id) === String(channelId),
    );

    if (!channelData) {
      throw new Error(`Channel ${channelId} not found in source`);
    }

    const result: FreshContentMetadata = {
      contentId: channelId,
      contentType: "live",
      title: channelData.name || `Channel ${channelId}`,
      description: channelData.description,
      cover: channelData.stream_icon,
      sourceData: {
        basic: channelData,
      },
      fetchedAt: new Date(),
      fetchSource: "live",
    };

    // Optionally fetch stream metadata
    if (includeStreamMetadata) {
      result.streamMetadata = await fetchStreamMetadata(credentials, channelId, "live");
    }

    console.log("✅ Fresh live channel details fetched:", result);
    return result;
  } catch (error) {
    console.error("❌ Failed to fetch fresh live channel details:", error);
    throw error;
  }
}

/**
 * Fetches stream metadata for a given content item
 */
async function fetchStreamMetadata(
  credentials: SourceCredentials,
  contentId: string,
  contentType: "movie" | "series" | "live",
): Promise<FreshContentMetadata["streamMetadata"]> {
  const { inspectContentMetadata } = await import("~/lib/metadata-inspector");
  const { constructStreamUrl } = await import("~/lib/stream-url");

  try {
    // Construct the stream URL
    const { streamingUrl } = constructStreamUrl({
      server: credentials.server,
      username: credentials.username,
      password: credentials.password,
      contentId: Number(contentId),
      contentType,
      containerExtension: credentials.containerExtension,
      videoCodec: credentials.videoCodec,
      audioCodec: credentials.audioCodec,
    });

    // Inspect the stream metadata
    const contentMetadata = await inspectContentMetadata(
      streamingUrl,
      contentType,
      `${contentType} ${contentId}`,
    );

    return {
      url: streamingUrl,
      format: contentMetadata.format,
      audioTracks: contentMetadata.audioTracks,
      videoTracks: contentMetadata.videoTracks,
      subtitleTracks: contentMetadata.subtitleTracks,
      streamInfo: contentMetadata.streamInfo,
    };
  } catch (error) {
    console.error("Failed to fetch stream metadata:", error);
    return undefined;
  }
}

/**
 * Helper function to build Xtream API URLs
 */
function buildXtreamUrl(
  credentials: SourceCredentials,
  action: string,
  additionalParams: Record<string, string> = {},
): string {
  const url = new URL(`${credentials.server}/player_api.php`);
  const search = new URLSearchParams({
    username: credentials.username,
    password: credentials.password,
    action,
    ...additionalParams,
  });
  url.search = search.toString();
  return url.toString();
}

/**
 * Analyzes multi-track capabilities of the content
 */
export function analyzeMultiTrackCapabilities(metadata: FreshContentMetadata): {
  hasMultipleAudioTracks: boolean;
  hasMultipleSubtitles: boolean;
  isHDR: boolean;
  is4K: boolean;
  isMultiLanguage: boolean;
  recommendedPlayer: "browser" | "external";
  trackSwitchingSupport: "full" | "limited" | "none";
  browserCompatibility: {
    canPlayAudio: boolean;
    canPlayVideo: boolean;
    canSwitchAudioTracks: boolean;
    canDisplaySubtitles: boolean;
  };
} {
  const hasMultipleAudio = (metadata.availableAudioTracks?.length || 0) > 1;
  const hasSubtitles = (metadata.availableSubtitleTracks?.length || 0) > 0;
  const isHDR = metadata.videoInfo?.isHDR || false;
  const is4K = (metadata.videoInfo?.width || 0) >= 3840;
  const isMultiLanguage = metadata.containerInfo?.isMultiLanguage || false;

  // Determine browser compatibility
  const format = metadata.containerInfo?.format?.toLowerCase();
  const videoCodec = metadata.videoInfo?.codec?.toLowerCase();
  const audioCodec = metadata.primaryAudioInfo?.codec?.toLowerCase();

  const browserCompatibility = {
    canPlayAudio: !!(audioCodec && ["aac", "mp3", "ac3", "eac3"].includes(audioCodec)),
    canPlayVideo: !!(videoCodec && ["h264", "h265", "hevc", "av1"].includes(videoCodec)),
    canSwitchAudioTracks: format !== "mkv" && hasMultipleAudio,
    canDisplaySubtitles: format !== "mkv" && hasSubtitles,
  };

  // Determine track switching support
  let trackSwitchingSupport: "full" | "limited" | "none" = "none";
  if (format === "mkv" && (hasMultipleAudio || hasSubtitles)) {
    trackSwitchingSupport = "none"; // Browser can't access embedded MKV tracks
  } else if (hasMultipleAudio || hasSubtitles) {
    trackSwitchingSupport = "limited"; // Some support depending on format
  } else {
    trackSwitchingSupport = "full"; // Single track, no switching needed
  }

  return {
    hasMultipleAudioTracks: hasMultipleAudio,
    hasMultipleSubtitles: hasSubtitles,
    isHDR,
    is4K,
    isMultiLanguage,
    recommendedPlayer:
      format === "mkv" && (hasMultipleAudio || hasSubtitles) ? "external" : "browser",
    trackSwitchingSupport,
    browserCompatibility,
  };
}

/**
 * Generic function to fetch fresh content details by type
 */
export async function fetchFreshContentDetails(
  credentials: SourceCredentials,
  contentId: string,
  contentType: "movie" | "series" | "live",
  includeStreamMetadata = false,
): Promise<FreshContentMetadata> {
  switch (contentType) {
    case "movie":
      return fetchFreshMovieDetails(credentials, contentId, includeStreamMetadata);
    case "series":
      return fetchFreshSeriesDetails(credentials, contentId, includeStreamMetadata);
    case "live":
      return fetchFreshLiveChannelDetails(credentials, contentId, includeStreamMetadata);
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}
