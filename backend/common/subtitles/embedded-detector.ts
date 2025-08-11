/**
 * Embedded subtitle detection using ffprobe
 * Analyzes MKV and other video files to detect embedded subtitle tracks
 *
 * NOTE: ffprobe only reads the metadata/header (first ~30MB) of video files,
 * it does NOT download the entire file. This makes it very fast and efficient.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface EmbeddedSubtitleTrack {
  index: number;
  language: string;
  languageName: string;
  codec: string;
  codecLongName: string;
  title?: string;
  forced: boolean;
  default: boolean;
  format: string;
  disposition: {
    default: number;
    forced: number;
    hearing_impaired: number;
    visual_impaired: number;
  };
}

export interface EmbeddedAudioTrack {
  index: number;
  language: string;
  languageName: string;
  codec: string;
  codecLongName: string;
  title?: string;
  channels: number;
  channelLayout: string;
  sampleRate: number;
  default: boolean;
  disposition: {
    default: number;
    forced: number;
  };
}

export interface VideoStreamInfo {
  hasEmbeddedSubtitles: boolean;
  hasMultipleAudioTracks: boolean;
  subtitleTracks: EmbeddedSubtitleTrack[];
  audioTracks: EmbeddedAudioTrack[];
  containerFormat: string;
  duration: number;
  fileSize?: number;
}

/**
 * Language code to name mapping for common languages
 */
const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English',
  nor: 'Norwegian',
  swe: 'Swedish',
  ara: 'Arabic',
  spa: 'Spanish',
  fre: 'French',
  ger: 'German',
  ita: 'Italian',
  dut: 'Dutch',
  por: 'Portuguese',
  rus: 'Russian',
  jpn: 'Japanese',
  kor: 'Korean',
  chi: 'Chinese',
  fin: 'Finnish',
  dan: 'Danish',
  pol: 'Polish',
  cze: 'Czech',
  hun: 'Hungarian',
  tur: 'Turkish',
};

/**
 * Detects embedded subtitle and audio tracks in a video file using ffprobe
 *
 * PERFORMANCE NOTES:
 * - Only reads metadata from the first 10-30MB of the file (not the entire file)
 * - For a 4GB MKV file, this typically reads <1% of the file
 * - Analysis completes in 1-10 seconds depending on network speed
 * - MKV container metadata is stored at the beginning, making this very efficient
 *
 * @param streamUrl - Direct URL to the video file
 * @param quickScan - If true, uses even smaller probe size (10MB vs 30MB)
 */
export async function detectEmbeddedTracks(
  streamUrl: string,
  quickScan = false
): Promise<VideoStreamInfo> {
  try {
    console.log(`🔍 Analyzing video stream for embedded tracks: ${streamUrl}`);

    // Use ffprobe to analyze the stream (only reads metadata, not full file)
    // For MKV files, metadata is typically in the first few MB
    const probeSize = quickScan ? '10M' : '30M'; // Quick scan reads even less
    const analyzeDuration = quickScan ? '10M' : '30M';

    const command = `ffprobe -v quiet -print_format json -show_streams -show_format -analyzeduration ${analyzeDuration} -probesize ${probeSize} "${streamUrl}"`;

    const { stdout } = await execAsync(command, {
      timeout: quickScan ? 10000 : 15000,
    });
    const probeData = JSON.parse(stdout);

    if (!probeData.streams || !Array.isArray(probeData.streams)) {
      throw new Error('No stream data found');
    }

    const subtitleTracks: EmbeddedSubtitleTrack[] = [];
    const audioTracks: EmbeddedAudioTrack[] = [];

    // Process each stream
    probeData.streams.forEach((stream: any, index: number) => {
      if (stream.codec_type === 'subtitle') {
        const language = stream.tags?.language || 'unknown';
        const title = stream.tags?.title || stream.tags?.name || '';

        subtitleTracks.push({
          index: stream.index || index,
          language,
          languageName: LANGUAGE_NAMES[language] || language.toUpperCase(),
          codec: stream.codec_name || 'unknown',
          codecLongName: stream.codec_long_name || 'Unknown',
          title,
          forced:
            stream.disposition?.forced === 1 ||
            title.toLowerCase().includes('forced'),
          default: stream.disposition?.default === 1,
          format: getSubtitleFormat(stream.codec_name),
          disposition: {
            default: stream.disposition?.default || 0,
            forced: stream.disposition?.forced || 0,
            hearing_impaired: stream.disposition?.hearing_impaired || 0,
            visual_impaired: stream.disposition?.visual_impaired || 0,
          },
        });
      }

      if (stream.codec_type === 'audio') {
        const language = stream.tags?.language || 'unknown';
        const title = stream.tags?.title || stream.tags?.name || '';

        audioTracks.push({
          index: stream.index || index,
          language,
          languageName: LANGUAGE_NAMES[language] || language.toUpperCase(),
          codec: stream.codec_name || 'unknown',
          codecLongName: stream.codec_long_name || 'Unknown',
          title,
          channels: stream.channels || 2,
          channelLayout: stream.channel_layout || 'stereo',
          sampleRate: parseInt(stream.sample_rate) || 48000,
          default: stream.disposition?.default === 1,
          disposition: {
            default: stream.disposition?.default || 0,
            forced: stream.disposition?.forced || 0,
          },
        });
      }
    });

    const result: VideoStreamInfo = {
      hasEmbeddedSubtitles: subtitleTracks.length > 0,
      hasMultipleAudioTracks: audioTracks.length > 1,
      subtitleTracks,
      audioTracks,
      containerFormat: probeData.format?.format_name || 'unknown',
      duration: parseFloat(probeData.format?.duration) || 0,
      fileSize: parseInt(probeData.format?.size) || undefined,
    };

    console.log(`✅ Embedded track analysis complete:`, {
      subtitles: subtitleTracks.length,
      audio: audioTracks.length,
      languages: [
        ...new Set([...subtitleTracks, ...audioTracks].map((t) => t.language)),
      ],
    });

    return result;
  } catch (error) {
    console.error('❌ Failed to analyze embedded tracks:', error);

    // Return empty result on failure
    return {
      hasEmbeddedSubtitles: false,
      hasMultipleAudioTracks: false,
      subtitleTracks: [],
      audioTracks: [],
      containerFormat: 'unknown',
      duration: 0,
    };
  }
}

/**
 * Maps subtitle codec names to human-readable formats
 */
function getSubtitleFormat(codecName: string): string {
  const formatMap: Record<string, string> = {
    subrip: 'SRT',
    srt: 'SRT',
    ass: 'ASS/SSA',
    ssa: 'ASS/SSA',
    webvtt: 'WebVTT',
    vtt: 'WebVTT',
    mov_text: 'TTXT',
    pgs: 'PGS',
    dvd_subtitle: 'VobSub',
    dvb_subtitle: 'DVB',
    xsub: 'XSUB',
    microdvd: 'MicroDVD',
    mpl2: 'MPL2',
    tmp: 'TMP',
    vobsub: 'VobSub',
  };

  return (
    formatMap[codecName?.toLowerCase()] || codecName?.toUpperCase() || 'Unknown'
  );
}

/**
 * Quick check if a URL is likely to contain embedded subtitles
 * Based on file extension and naming patterns
 */
export function likelyHasEmbeddedSubtitles(
  streamUrl: string,
  contentName?: string
): boolean {
  const url = streamUrl.toLowerCase();
  const name = contentName?.toLowerCase() || '';

  // MKV files are most likely to have embedded subtitles
  if (url.includes('.mkv')) return true;

  // Check for multi-language indicators in filename
  const multiLangIndicators = [
    'multi',
    'multilang',
    'multi-sub',
    'multi-lang',
    'dual',
    'dual-audio',
    'dual-lang',
    'nordic',
    'scandinavian',
    'arabic',
    'european',
  ];

  return multiLangIndicators.some(
    (indicator) => url.includes(indicator) || name.includes(indicator)
  );
}
