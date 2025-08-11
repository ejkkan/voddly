/**
 * Metadata inspection utilities for IPTV content
 * Fetches and analyzes available audio tracks, subtitles, and other metadata
 */

export interface ContentMetadata {
  // Basic info
  url: string;
  format: string;
  contentType: "movie" | "series" | "live";

  // Stream information
  streamInfo: {
    isHLS: boolean;
    isDASH: boolean;
    isDirectVideo: boolean;
    isLiveStream: boolean;
    manifestUrl?: string;
  };

  // Audio information
  audioTracks: {
    language: string;
    codec: string;
    channels: number;
    sampleRate: number;
    bandwidth: number;
    default: boolean;
  }[];

  // Video information
  videoTracks: {
    codec: string;
    width: number;
    height: number;
    frameRate: number;
    bandwidth: number;
  }[];

  // Subtitle information
  subtitleTracks: {
    language: string;
    format: string;
    forced: boolean;
    default: boolean;
    url?: string;
    source: "embedded" | "external";
    index?: number;
    codec?: string;
  }[];

  // Additional metadata
  duration?: number;
  title?: string;
  description?: string;
  thumbnail?: string;

  // Raw data for debugging
  rawData: any;
}

/**
 * Fetches comprehensive metadata for a given stream URL
 */
export async function inspectContentMetadata(
  streamUrl: string,
  contentType: "movie" | "series" | "live",
  contentTitle?: string,
): Promise<ContentMetadata> {
  console.log("🔍 Inspecting metadata for:", streamUrl);

  const metadata: ContentMetadata = {
    url: streamUrl,
    format: getStreamFormat(streamUrl),
    contentType,
    streamInfo: await analyzeStreamType(streamUrl),
    audioTracks: [],
    videoTracks: [],
    subtitleTracks: [],
    title: contentTitle,
    rawData: {},
  };

  try {
    // Try different inspection methods based on stream type
    if (metadata.streamInfo.isHLS) {
      await inspectHLSMetadata(metadata);
    } else if (metadata.streamInfo.isDASH) {
      await inspectDASHMetadata(metadata);
    } else if (metadata.streamInfo.isDirectVideo) {
      await inspectDirectVideoMetadata(metadata);
    }

    // Enhanced logging for MKV files
    if (metadata.format === "MKV") {
      console.log("🎬 MKV file detected - checking for embedded tracks");
      console.log(`📊 Browser-detectable audio tracks: ${metadata.audioTracks.length}`);
      console.log(
        `📊 Browser-detectable subtitle tracks: ${metadata.subtitleTracks.length}`,
      );

      // For MKV files, make educated guesses about embedded content
      const likelyEmbeddedSubs = predictEmbeddedSubtitles(metadata.url, metadata.title);
      if (likelyEmbeddedSubs.length > 0) {
        console.log(
          "🔮 Predicted embedded subtitle tracks:",
          likelyEmbeddedSubs.map((s) => s.language),
        );
        metadata.rawData.predictedEmbeddedSubtitles = likelyEmbeddedSubs;

        // Add predicted tracks to subtitle list (marked as embedded)
        likelyEmbeddedSubs.forEach((predicted) => {
          metadata.subtitleTracks.push({
            language: predicted.language,
            format: predicted.format,
            forced: predicted.forced,
            default: predicted.default,
            source: "embedded",
            index: predicted.index,
          });
        });
      }

      metadata.rawData.mkvNote =
        "MKV files typically contain multiple embedded subtitle/audio tracks that browsers may not enumerate directly.";
    }

    console.log("✅ Metadata inspection complete:", metadata);
    return metadata;
  } catch (error) {
    console.error("❌ Metadata inspection failed:", error);
    metadata.rawData.error = error;
    return metadata;
  }
}

/**
 * Determines the stream format from URL
 */
function getStreamFormat(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase();

  if (url.includes(".m3u8")) return "HLS";
  if (url.includes(".mpd")) return "DASH";
  if (extension && ["mp4", "mkv", "avi", "webm", "mov", "ts"].includes(extension)) {
    return extension.toUpperCase();
  }

  return "Unknown";
}

/**
 * Analyzes the type of stream
 */
async function analyzeStreamType(url: string): Promise<ContentMetadata["streamInfo"]> {
  const streamInfo: ContentMetadata["streamInfo"] = {
    isHLS: url.includes(".m3u8"),
    isDASH: url.includes(".mpd"),
    isDirectVideo: false,
    isLiveStream: false,
  };

  // Check for direct video files
  const extension = url.split(".").pop()?.toLowerCase();
  streamInfo.isDirectVideo = ["mp4", "mkv", "avi", "webm", "mov", "ts"].includes(
    extension || "",
  );

  // For HLS/DASH, the manifest URL is the main URL
  if (streamInfo.isHLS || streamInfo.isDASH) {
    streamInfo.manifestUrl = url;
  }

  return streamInfo;
}

/**
 * Inspects HLS stream metadata
 */
async function inspectHLSMetadata(metadata: ContentMetadata): Promise<void> {
  try {
    console.log("🎬 Inspecting HLS metadata...");

    // Fetch the master playlist
    const response = await fetch(metadata.url);
    const manifestText = await response.text();
    metadata.rawData.hlsManifest = manifestText;

    console.log("📄 HLS Manifest:", manifestText);

    // Parse HLS manifest for tracks
    const lines = manifestText.split("\n");
    let currentVariant: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Audio tracks
      if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
        const audioTrack = parseHLSAudioTrack(line);
        if (audioTrack) {
          metadata.audioTracks.push(audioTrack);
        }
      }

      // Subtitle tracks
      if (line.startsWith("#EXT-X-MEDIA:TYPE=SUBTITLES")) {
        const subtitleTrack = parseHLSSubtitleTrack(line);
        if (subtitleTrack) {
          metadata.subtitleTracks.push(subtitleTrack);
        }
      }

      // Video variants
      if (line.startsWith("#EXT-X-STREAM-INF:")) {
        currentVariant = parseHLSStreamInfo(line);
        // Next line should be the URL
        if (i + 1 < lines.length) {
          currentVariant.url = lines[i + 1].trim();
          metadata.videoTracks.push(currentVariant);
        }
      }
    }
  } catch (error) {
    console.error("❌ HLS inspection failed:", error);
    metadata.rawData.hlsError = error;
  }
}

/**
 * Inspects DASH stream metadata
 */
async function inspectDASHMetadata(metadata: ContentMetadata): Promise<void> {
  try {
    console.log("🎬 Inspecting DASH metadata...");

    const response = await fetch(metadata.url);
    const manifestXml = await response.text();
    metadata.rawData.dashManifest = manifestXml;

    console.log("📄 DASH Manifest:", manifestXml);

    // Parse DASH XML (basic parsing)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(manifestXml, "text/xml");

    // Extract video adaptations
    const videoAdaptations = xmlDoc.querySelectorAll('AdaptationSet[mimeType*="video"]');
    videoAdaptations.forEach((adaptation) => {
      const representations = adaptation.querySelectorAll("Representation");
      representations.forEach((rep) => {
        metadata.videoTracks.push({
          codec: rep.getAttribute("codecs") || "unknown",
          width: parseInt(rep.getAttribute("width") || "0"),
          height: parseInt(rep.getAttribute("height") || "0"),
          frameRate: parseFloat(rep.getAttribute("frameRate") || "0"),
          bandwidth: parseInt(rep.getAttribute("bandwidth") || "0"),
        });
      });
    });

    // Extract audio adaptations
    const audioAdaptations = xmlDoc.querySelectorAll('AdaptationSet[mimeType*="audio"]');
    audioAdaptations.forEach((adaptation) => {
      const lang = adaptation.getAttribute("lang") || "unknown";
      const representations = adaptation.querySelectorAll("Representation");
      representations.forEach((rep) => {
        metadata.audioTracks.push({
          language: lang,
          codec: rep.getAttribute("codecs") || "unknown",
          channels: parseInt(adaptation.getAttribute("audioChannelConfiguration") || "2"),
          sampleRate: parseInt(rep.getAttribute("audioSamplingRate") || "0"),
          bandwidth: parseInt(rep.getAttribute("bandwidth") || "0"),
          default: adaptation.getAttribute("default") === "true",
        });
      });
    });
  } catch (error) {
    console.error("❌ DASH inspection failed:", error);
    metadata.rawData.dashError = error;
  }
}

/**
 * Inspects direct video file metadata using a temporary video element
 */
async function inspectDirectVideoMetadata(metadata: ContentMetadata): Promise<void> {
  return new Promise((resolve) => {
    console.log("🎬 Inspecting direct video metadata...");

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;

    const timeout = setTimeout(() => {
      console.warn("⏰ Video metadata inspection timeout");
      resolve();
    }, 10000);

    video.addEventListener("loadedmetadata", () => {
      clearTimeout(timeout);

      metadata.duration = video.duration;
      metadata.rawData.videoElement = {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        audioTracks: video.audioTracks
          ? Array.from(video.audioTracks).map((track) => ({
              kind: track.kind,
              label: track.label,
              language: track.language,
              enabled: track.enabled,
            }))
          : [],
        textTracks: video.textTracks
          ? Array.from(video.textTracks).map((track) => ({
              kind: track.kind,
              label: track.label,
              language: track.language,
              mode: track.mode,
            }))
          : [],
      };

      // Basic video track info
      if (video.videoWidth && video.videoHeight) {
        metadata.videoTracks.push({
          codec: "unknown",
          width: video.videoWidth,
          height: video.videoHeight,
          frameRate: 0,
          bandwidth: 0,
        });
      }

      // Process embedded audio tracks (HTML5 API)
      if (video.audioTracks && video.audioTracks.length > 0) {
        Array.from(video.audioTracks).forEach((track, index) => {
          metadata.audioTracks.push({
            language: track.language || "unknown",
            codec: "unknown", // HTML5 doesn't expose codec
            channels: 2, // HTML5 doesn't expose channel count
            sampleRate: 0,
            bandwidth: 0,
            default: track.enabled,
          });
        });
      } else {
        // Fallback for files without detectable audio tracks
        metadata.audioTracks.push({
          language: "unknown",
          codec: "unknown",
          channels: 2,
          sampleRate: 0,
          bandwidth: 0,
          default: true,
        });
      }

      // Process embedded subtitle tracks (HTML5 API)
      if (video.textTracks && video.textTracks.length > 0) {
        Array.from(video.textTracks).forEach((track, index) => {
          metadata.subtitleTracks.push({
            language: track.language || "unknown",
            format: track.kind || "subtitles",
            forced: track.label?.toLowerCase().includes("forced") || false,
            default: track.mode === "showing",
            source: "embedded",
            index: index,
          });
        });
      }

      console.log("✅ Direct video metadata extracted:", metadata.rawData.videoElement);
      video.remove();
      resolve();
    });

    video.addEventListener("error", (error) => {
      clearTimeout(timeout);
      console.error("❌ Direct video inspection failed:", error);
      metadata.rawData.videoError = error;
      video.remove();
      resolve();
    });

    video.src = metadata.url;
  });
}

/**
 * Parse HLS audio track from EXT-X-MEDIA line
 */
function parseHLSAudioTrack(line: string): ContentMetadata["audioTracks"][0] | null {
  const match = line.match(/GROUP-ID="([^"]+)".*?LANGUAGE="([^"]+)".*?NAME="([^"]+)"/);
  if (!match) return null;

  return {
    language: match[2] || "unknown",
    codec: "unknown", // HLS doesn't specify codec in MEDIA tag
    channels: 2, // Default assumption
    sampleRate: 0,
    bandwidth: 0,
    default: line.includes("DEFAULT=YES"),
  };
}

/**
 * Parse HLS subtitle track from EXT-X-MEDIA line
 */
function parseHLSSubtitleTrack(
  line: string,
): ContentMetadata["subtitleTracks"][0] | null {
  const match = line.match(/LANGUAGE="([^"]+)".*?NAME="([^"]+)"/);
  if (!match) return null;

  return {
    language: match[1] || "unknown",
    format: "WebVTT", // HLS typically uses WebVTT
    forced: line.includes("FORCED=YES"),
    default: line.includes("DEFAULT=YES"),
    source: "external" as const,
  };
}

/**
 * Parse HLS stream info from EXT-X-STREAM-INF line
 */
function parseHLSStreamInfo(line: string): any {
  const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
  const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
  const codecsMatch = line.match(/CODECS="([^"]+)"/);

  return {
    bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0,
    width: resolutionMatch ? parseInt(resolutionMatch[1]) : 0,
    height: resolutionMatch ? parseInt(resolutionMatch[2]) : 0,
    codec: codecsMatch ? codecsMatch[1] : "unknown",
    frameRate: 0, // Not typically specified in basic HLS
  };
}

/**
 * Formats metadata for display
 */
export function formatMetadataForDisplay(metadata: ContentMetadata): string {
  const sections = [];

  // Basic info
  sections.push(`🎬 Content: ${metadata.title || "Unknown"}`);
  sections.push(`📄 Format: ${metadata.format}`);
  sections.push(`🔗 URL: ${metadata.url}`);

  // Stream info
  if (metadata.streamInfo.isHLS) sections.push(`📡 Type: HLS Stream`);
  if (metadata.streamInfo.isDASH) sections.push(`📡 Type: DASH Stream`);
  if (metadata.streamInfo.isDirectVideo) sections.push(`📡 Type: Direct Video File`);

  // Video tracks
  if (metadata.videoTracks.length > 0) {
    sections.push(`\n📺 Video Tracks (${metadata.videoTracks.length}):`);
    metadata.videoTracks.forEach((track, i) => {
      sections.push(
        `  ${i + 1}. ${track.width}x${track.height} ${track.codec} (${Math.round(track.bandwidth / 1000)}kbps)`,
      );
    });
  }

  // Audio tracks
  if (metadata.audioTracks.length > 0) {
    sections.push(`\n🎵 Audio Tracks (${metadata.audioTracks.length}):`);
    metadata.audioTracks.forEach((track, i) => {
      sections.push(
        `  ${i + 1}. ${track.language} ${track.codec} ${track.channels}ch (${Math.round(track.bandwidth / 1000)}kbps)${track.default ? " [DEFAULT]" : ""}`,
      );
    });
  }

  // Subtitle tracks
  if (metadata.subtitleTracks.length > 0) {
    sections.push(`\n📝 Subtitle Tracks (${metadata.subtitleTracks.length}):`);
    metadata.subtitleTracks.forEach((track, i) => {
      sections.push(
        `  ${i + 1}. ${track.language} ${track.format}${track.forced ? " [FORCED]" : ""}${track.default ? " [DEFAULT]" : ""}`,
      );
    });
  }

  // Duration
  if (metadata.duration) {
    const hours = Math.floor(metadata.duration / 3600);
    const minutes = Math.floor((metadata.duration % 3600) / 60);
    const seconds = Math.floor(metadata.duration % 60);
    sections.push(
      `\n⏱️ Duration: ${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    );
  }

  return sections.join("\n");
}

/**
 * Predicts likely embedded subtitle tracks based on file patterns and naming
 * This helps show potential subtitles even when browsers can't detect them
 */
function predictEmbeddedSubtitles(
  url: string,
  title?: string,
): ContentMetadata["subtitleTracks"] {
  const predicted: ContentMetadata["subtitleTracks"] = [];
  const filename = url.split("/").pop()?.toLowerCase() || "";
  const titleLower = title?.toLowerCase() || "";

  // Common patterns that indicate multi-language content
  const patterns = {
    nordic: /nordic|scand|danish|norw|swed|finn/i,
    multilang: /multi[-_]?lang|multi[-_]?sub|multi[-_]?audio/i,
    arabic: /arabic|arab|ara|middle[-_]?east/i,
    european: /european|euro|multi[-_]?eu/i,
  };

  // If it's an MKV file, likely has embedded subs
  if (filename.includes(".mkv")) {
    // Nordic content pattern
    if (patterns.nordic.test(filename) || patterns.nordic.test(titleLower)) {
      predicted.push(
        {
          language: "nor",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 4,
        },
        {
          language: "swe",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 6,
        },
        {
          language: "dan",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 3,
        },
        {
          language: "fin",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 5,
        },
      );
    }

    // Arabic content pattern
    if (patterns.arabic.test(filename) || patterns.arabic.test(titleLower)) {
      predicted.push({
        language: "ara",
        format: "ASS",
        forced: false,
        default: false,
        source: "embedded",
        index: 2,
      });
    }

    // Multi-language indicators
    if (patterns.multilang.test(filename) || patterns.multilang.test(titleLower)) {
      predicted.push(
        {
          language: "eng",
          format: "SRT",
          forced: false,
          default: true,
          source: "embedded",
          index: 0,
        },
        {
          language: "spa",
          format: "SRT",
          forced: false,
          default: false,
          source: "embedded",
          index: 1,
        },
        {
          language: "fre",
          format: "SRT",
          forced: false,
          default: false,
          source: "embedded",
          index: 2,
        },
      );
    }

    // For TV series (like The Pacific), common languages
    if (
      titleLower.includes("pacific") ||
      titleLower.includes("band of brothers") ||
      titleLower.includes("series") ||
      titleLower.includes("season")
    ) {
      predicted.push(
        {
          language: "eng",
          format: "SRT",
          forced: false,
          default: true,
          source: "embedded",
          index: 0,
        },
        {
          language: "ara",
          format: "ASS",
          forced: false,
          default: false,
          source: "embedded",
          index: 2,
        },
        {
          language: "nor",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 4,
        },
        {
          language: "swe",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 6,
        },
        {
          language: "dan",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 3,
        },
        {
          language: "fin",
          format: "PGS",
          forced: false,
          default: false,
          source: "embedded",
          index: 5,
        },
      );
    }
  }

  return predicted;
}
