/**
 * Common utilities for constructing streaming URLs across all content types
 */

export interface StreamUrlParams {
  server: string;
  username: string;
  password: string;
  contentId: number;
  contentType: 'movie' | 'series' | 'live';
  containerExtension?: string;
  videoCodec?: string;
  audioCodec?: string;
}

/**
 * Infers the best container extension based on video/audio codecs
 * Defaults to 'mkv' for maximum compatibility with IPTV streams
 */
export function inferContainerExtension(
  videoCodec?: string,
  audioCodec?: string
): string {
  // Default to MKV for IPTV streams - it's the most versatile container
  let extension = 'mkv';

  if (videoCodec && audioCodec) {
    // High-compatibility audio codecs that work well in MKV
    if (audioCodec === 'dts' || audioCodec === 'ac3' || audioCodec === 'eac3') {
      extension = 'mkv'; // DTS/AC3 audio works best in MKV
    }
    // Only use MP4 for very specific codec combinations
    else if (
      (videoCodec === 'h264' && audioCodec === 'aac') ||
      (videoCodec === 'h264' && audioCodec === 'mp3')
    ) {
      extension = 'mp4';
    }
    // HEVC can work in both, but MKV is more reliable for IPTV
    else if (videoCodec === 'hevc' || videoCodec === 'h265') {
      extension = 'mkv';
    }
    // WebM for VP8/VP9
    else if (videoCodec === 'vp8' || videoCodec === 'vp9') {
      extension = 'webm';
    }
  }

  return extension;
}

/**
 * Constructs a streaming URL using Xtream Codes standard format
 * Always defaults to MKV when container extension is unknown
 */
export function constructStreamUrl(params: StreamUrlParams): {
  streamingUrl: string;
  extension: string;
  source: 'provided' | 'inferred' | 'default';
} {
  const {
    server,
    username,
    password,
    contentId,
    contentType,
    containerExtension,
    videoCodec,
    audioCodec,
  } = params;

  let finalExtension: string;
  let source: 'provided' | 'inferred' | 'default';

  // 1. Use provided container extension if valid
  if (
    containerExtension &&
    containerExtension !== 'undefined' &&
    containerExtension !== 'null' &&
    containerExtension.length > 0
  ) {
    finalExtension = containerExtension;
    source = 'provided';
  }
  // 2. Infer from codecs if available
  else if (videoCodec || audioCodec) {
    finalExtension = inferContainerExtension(videoCodec, audioCodec);
    source = 'inferred';
  }
  // 3. Default to MKV for maximum IPTV compatibility
  else {
    finalExtension = 'mkv';
    source = 'default';
  }

  // Construct URL based on content type
  let streamingUrl: string;
  switch (contentType) {
    case 'movie':
      streamingUrl = `${server}/movie/${username}/${password}/${contentId}.${finalExtension}`;
      break;
    case 'series':
      streamingUrl = `${server}/series/${username}/${password}/${contentId}.${finalExtension}`;
      break;
    case 'live':
      streamingUrl = `${server}/live/${username}/${password}/${contentId}.${finalExtension}`;
      break;
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }

  return {
    streamingUrl,
    extension: finalExtension,
    source,
  };
}

/**
 * Logs the URL construction process for debugging
 */
export function logUrlConstruction(
  contentId: number,
  contentType: string,
  containerExt: string | undefined,
  videoCodec: string | undefined,
  audioCodec: string | undefined,
  result: { streamingUrl: string; extension: string; source: string }
): void {
  console.log(
    `=== Stream URL Construction for ${contentType} ${contentId} ===`
  );
  console.log(`Container extension provided: ${containerExt || 'none'}`);
  console.log(`Video codec: ${videoCodec || 'unknown'}`);
  console.log(`Audio codec: ${audioCodec || 'unknown'}`);
  console.log(`Final extension: ${result.extension} (${result.source})`);
  console.log(`Generated URL: ${result.streamingUrl}`);
  console.log('========================================');
}

