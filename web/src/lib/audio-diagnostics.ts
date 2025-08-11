/**
 * Audio diagnostics utilities for troubleshooting video playback issues
 */

export interface AudioDiagnosticResult {
  hasAudio: boolean;
  audioCodecs: string[];
  audioLanguages: string[];
  audioTracks: number;
  browserSupport: {
    webkitAudioContext: boolean;
    audioContext: boolean;
    webAudio: boolean;
  };
  videoElement: {
    hasAudioTracks: boolean;
    audioTrackCount: number;
    muted: boolean;
    volume: number;
  };
  recommendations: string[];
}

/**
 * Runs comprehensive audio diagnostics on a video element and Shaka Player
 */
export function runAudioDiagnostics(
  videoElement: HTMLVideoElement,
  shakaPlayer?: any,
): AudioDiagnosticResult {
  const recommendations: string[] = [];

  // Check browser audio support
  const browserSupport = {
    webkitAudioContext: typeof (window as any).webkitAudioContext !== "undefined",
    audioContext: typeof AudioContext !== "undefined",
    webAudio:
      typeof (window as any).webkitAudioContext !== "undefined" ||
      typeof AudioContext !== "undefined",
  };

  // Check video element audio
  const videoElement_diagnostics = {
    hasAudioTracks: Boolean(
      videoElement.audioTracks && videoElement.audioTracks.length > 0,
    ),
    audioTrackCount: videoElement.audioTracks ? videoElement.audioTracks.length : 0,
    muted: videoElement.muted,
    volume: videoElement.volume,
  };

  // Check Shaka Player tracks
  let audioCodecs: string[] = [];
  let audioLanguages: string[] = [];
  let audioTracks = 0;
  let hasAudio = false;

  if (shakaPlayer) {
    try {
      const variantTracks = shakaPlayer.getVariantTracks();
      audioCodecs = [
        ...new Set(variantTracks.map((t: any) => t.audioCodec).filter(Boolean)),
      ];
      audioLanguages = [
        ...new Set(variantTracks.map((t: any) => t.language).filter(Boolean)),
      ];
      audioTracks = variantTracks.filter((t: any) => t.audioCodec).length;
      hasAudio = audioTracks > 0;
    } catch (error) {
      console.warn("Failed to get Shaka Player tracks:", error);
    }
  }

  // Generate recommendations
  if (!hasAudio) {
    recommendations.push("Stream may not contain audio tracks");
    recommendations.push("Try different container format (MP4 vs MKV)");
    recommendations.push("Check if source URL has audio parameter");
  }

  if (videoElement.muted) {
    recommendations.push("Video is muted - unmute to hear audio");
  }

  if (videoElement.volume === 0) {
    recommendations.push("Volume is set to 0 - increase volume");
  }

  if (!browserSupport.webAudio) {
    recommendations.push("Browser may not support Web Audio API");
  }

  if (audioCodecs.length === 0) {
    recommendations.push("No audio codecs detected in stream");
  } else if (audioCodecs.includes("ac3") || audioCodecs.includes("eac3")) {
    recommendations.push("AC3/E-AC3 audio may need different container format");
  }

  return {
    hasAudio,
    audioCodecs,
    audioLanguages,
    audioTracks,
    browserSupport,
    videoElement: videoElement_diagnostics,
    recommendations,
  };
}

/**
 * Suggests alternative container formats based on codecs
 */
export function suggestContainerFormats(
  videoCodec?: string,
  audioCodec?: string,
): { format: string; reason: string }[] {
  const suggestions: { format: string; reason: string }[] = [];

  if (!audioCodec) {
    suggestions.push({
      format: "mkv",
      reason: "Default format for IPTV streams",
    });
    suggestions.push({
      format: "mp4",
      reason: "Better browser compatibility",
    });
    suggestions.push({
      format: "ts",
      reason: "Original transport stream format",
    });
    return suggestions;
  }

  // AC3/E-AC3 audio
  if (audioCodec === "ac3" || audioCodec === "eac3") {
    suggestions.push({
      format: "mkv",
      reason: "Best support for AC3/E-AC3 audio",
    });
    suggestions.push({
      format: "ts",
      reason: "Transport stream may preserve AC3 audio",
    });
  }

  // AAC audio
  else if (audioCodec === "aac") {
    suggestions.push({
      format: "mp4",
      reason: "Optimal for AAC audio",
    });
    suggestions.push({
      format: "mkv",
      reason: "Fallback for AAC audio",
    });
  }

  // DTS audio
  else if (audioCodec === "dts") {
    suggestions.push({
      format: "mkv",
      reason: "Best support for DTS audio",
    });
  }

  // Generic fallbacks
  else {
    suggestions.push({
      format: "mkv",
      reason: "Universal container format",
    });
    suggestions.push({
      format: "mp4",
      reason: "Better browser support",
    });
  }

  return suggestions;
}

/**
 * Tests multiple container formats for the same stream
 */
export async function testMultipleFormats(
  baseUrl: string,
  contentId: string,
  formats: string[] = ["mkv", "mp4", "ts", "avi"],
): Promise<{ format: string; success: boolean; error?: string }[]> {
  const results: { format: string; success: boolean; error?: string }[] = [];

  for (const format of formats) {
    try {
      const testUrl = baseUrl.replace(/\.[^.]+$/, `.${format}`);

      // Create a test video element
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true; // Avoid autoplay issues

      const result = await new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, error: "Timeout" });
          }, 5000);

          video.addEventListener("loadedmetadata", () => {
            clearTimeout(timeout);
            resolve({ success: true });
          });

          video.addEventListener("error", (e) => {
            clearTimeout(timeout);
            resolve({
              success: false,
              error: video.error?.message || "Failed to load",
            });
          });

          video.src = testUrl;
        },
      );

      results.push({
        format,
        ...result,
      });

      // Clean up
      video.remove();
    } catch (error) {
      results.push({
        format,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
