/**
 * Embedded subtitle detection using ffprobe (moved from common to user service)
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
  disposition: { default: number; forced: number; hearing_impaired: number; visual_impaired: number };
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
  disposition: { default: number; forced: number };
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

const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English', nor: 'Norwegian', swe: 'Swedish', ara: 'Arabic', spa: 'Spanish', fre: 'French', ger: 'German',
  ita: 'Italian', dut: 'Dutch', por: 'Portuguese', rus: 'Russian', jpn: 'Japanese', kor: 'Korean', chi: 'Chinese',
  fin: 'Finnish', dan: 'Danish', pol: 'Polish', cze: 'Czech', hun: 'Hungarian', tur: 'Turkish',
};

export async function detectEmbeddedTracks(streamUrl: string, quickScan = false): Promise<VideoStreamInfo> {
  try {
    const probeSize = quickScan ? '10M' : '30M';
    const analyzeDuration = quickScan ? '10M' : '30M';
    const command = `ffprobe -v quiet -print_format json -show_streams -show_format -analyzeduration ${analyzeDuration} -probesize ${probeSize} "${streamUrl}"`;
    const { stdout } = await execAsync(command, { timeout: quickScan ? 10000 : 15000 });
    const probeData = JSON.parse(stdout);
    if (!probeData.streams || !Array.isArray(probeData.streams)) throw new Error('No stream data found');

    const subtitleTracks: EmbeddedSubtitleTrack[] = [];
    const audioTracks: EmbeddedAudioTrack[] = [];
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
          forced: stream.disposition?.forced === 1 || title.toLowerCase().includes('forced'),
          default: stream.disposition?.default === 1,
          format: getSubtitleFormat(stream.codec_name),
          disposition: { default: stream.disposition?.default || 0, forced: stream.disposition?.forced || 0, hearing_impaired: stream.disposition?.hearing_impaired || 0, visual_impaired: stream.disposition?.visual_impaired || 0 },
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
          disposition: { default: stream.disposition?.default || 0, forced: stream.disposition?.forced || 0 },
        });
      }
    });

    return { hasEmbeddedSubtitles: subtitleTracks.length > 0, hasMultipleAudioTracks: audioTracks.length > 1, subtitleTracks, audioTracks, containerFormat: probeData.format?.format_name || 'unknown', duration: parseFloat(probeData.format?.duration) || 0, fileSize: parseInt(probeData.format?.size) || undefined };
  } catch {
    return { hasEmbeddedSubtitles: false, hasMultipleAudioTracks: false, subtitleTracks: [], audioTracks: [], containerFormat: 'unknown', duration: 0 };
  }
}

function getSubtitleFormat(codecName: string): string {
  const map: Record<string, string> = { subrip: 'SRT', srt: 'SRT', ass: 'ASS/SSA', ssa: 'ASS/SSA', webvtt: 'WebVTT', vtt: 'WebVTT', mov_text: 'TTXT', pgs: 'PGS', dvd_subtitle: 'VobSub', dvb_subtitle: 'DVB', xsub: 'XSUB', microdvd: 'MicroDVD', mpl2: 'MPL2', tmp: 'TMP', vobsub: 'VobSub' };
  return map[codecName?.toLowerCase()] || codecName?.toUpperCase() || 'Unknown';
}

export function likelyHasEmbeddedSubtitles(streamUrl: string, contentName?: string): boolean {
  const url = streamUrl.toLowerCase();
  const name = contentName?.toLowerCase() || '';
  if (url.includes('.mkv')) return true;
  const indicators = ['multi', 'multilang', 'multi-sub', 'multi-lang', 'dual', 'dual-audio', 'dual-lang', 'nordic', 'scandinavian', 'arabic', 'european'];
  return indicators.some((i) => url.includes(i) || name.includes(i));
}

