'use client';

export type ContentType = 'movie' | 'series' | 'live';

export interface StreamUrlParams {
  server: string;
  username: string;
  password: string;
  contentId: number | string;
  contentType: ContentType;
  containerExtension?: string;
  videoCodec?: string;
  audioCodec?: string;
}

export function inferContainerExtension(
  videoCodec?: string,
  audioCodec?: string
): string {
  let extension = 'mkv';

  if (videoCodec && audioCodec) {
    if (audioCodec === 'dts' || audioCodec === 'ac3' || audioCodec === 'eac3') {
      extension = 'mkv';
    } else if (
      (videoCodec === 'h264' && audioCodec === 'aac') ||
      (videoCodec === 'h264' && audioCodec === 'mp3')
    ) {
      extension = 'mp4';
    } else if (videoCodec === 'hevc' || videoCodec === 'h265') {
      extension = 'mkv';
    } else if (videoCodec === 'vp8' || videoCodec === 'vp9') {
      extension = 'webm';
    }
  }

  return extension;
}

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

  if (
    containerExtension &&
    containerExtension !== 'undefined' &&
    containerExtension !== 'null' &&
    containerExtension.length > 0
  ) {
    finalExtension = containerExtension;
    source = 'provided';
  } else if (videoCodec || audioCodec) {
    finalExtension = inferContainerExtension(videoCodec, audioCodec);
    source = 'inferred';
  } else {
    // Default extension based on content type
    // Live TV streams typically use .m3u8 (HLS) format for browser playback
    finalExtension = contentType === 'live' ? 'm3u8' : 'mkv';
    source = 'default';
  }

  const base = server.endsWith('/') ? server.slice(0, -1) : server;

  let streamingUrl: string;
  switch (contentType) {
    case 'movie':
      streamingUrl = `${base}/movie/${username}/${password}/${contentId}.${finalExtension}`;
      break;
    case 'series':
      streamingUrl = `${base}/series/${username}/${password}/${contentId}.${finalExtension}`;
      break;
    case 'live':
      streamingUrl = `${base}/live/${username}/${password}/${contentId}.${finalExtension}`;
      break;
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }

  return { streamingUrl, extension: finalExtension, source };
}
