import { useCallback, useEffect, useState } from 'react';

import apiClient from '@/lib/api-client';

export interface FormatSupportInfo {
  containerFormat: string;
  hasEmbeddedSubtitles: boolean;
  hasMultipleAudioTracks: boolean;
  subtitleTracks: {
    index: number;
    language: string;
    languageName: string;
    codec: string;
    format: string;
    forced: boolean;
    default: boolean;
  }[];
  audioTracks: {
    index: number;
    language: string;
    languageName: string;
    codec: string;
    channels: number;
    default: boolean;
  }[];
  supportLevel: 'excellent' | 'good' | 'limited' | 'poor';
  supportDetails: {
    subtitleSupport: string;
    audioSupport: string;
    recommendations: string[];
  };
}

export interface FormatSupportHookResult {
  formatInfo: FormatSupportInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshSupport: () => void;
}

export function useFormatSupport(streamUrl: string): FormatSupportHookResult {
  const [formatInfo, setFormatInfo] = useState<FormatSupportInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeFormatSupport = useCallback(async () => {
    if (!streamUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use your existing backend endpoint to detect embedded tracks
      const response = await apiClient.user.detectEmbeddedSubtitles({
        streamUrl,
        quickScan: true, // Quick scan for UI responsiveness
      });

      // Check if the response was successful and has stream info
      if (!response.success || !response.streamInfo) {
        throw new Error(response.error || 'Failed to analyze stream');
      }

      const streamInfo = response.streamInfo;

      // Determine support level based on container format and available tracks
      const supportLevel = determineSupportLevel(
        streamInfo.containerFormat,
        streamInfo.subtitleTracks.length,
        streamInfo.audioTracks.length
      );

      // Generate support details and recommendations
      const supportDetails = generateSupportDetails(
        streamInfo.containerFormat,
        streamInfo.subtitleTracks,
        streamInfo.audioTracks
      );

      setFormatInfo({
        containerFormat: streamInfo.containerFormat,
        hasEmbeddedSubtitles: streamInfo.hasEmbeddedSubtitles,
        hasMultipleAudioTracks: streamInfo.hasMultipleAudioTracks,
        subtitleTracks: streamInfo.subtitleTracks,
        audioTracks: streamInfo.audioTracks,
        supportLevel,
        supportDetails,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to analyze format support'
      );
      console.error('Format support analysis failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [streamUrl]);

  const refreshSupport = useCallback(() => {
    analyzeFormatSupport();
  }, [analyzeFormatSupport]);

  useEffect(() => {
    analyzeFormatSupport();
  }, [analyzeFormatSupport]);

  return {
    formatInfo,
    isLoading,
    error,
    refreshSupport,
  };
}

function determineSupportLevel(
  containerFormat: string,
  subtitleTrackCount: number,
  audioTrackCount: number
): 'excellent' | 'good' | 'limited' | 'poor' {
  const format = containerFormat.toLowerCase();

  // MKV has excellent support
  if (format === 'mkv') {
    return 'excellent';
  }

  // MP4 has good support
  if (format === 'mp4' || format === 'm4v') {
    if (subtitleTrackCount > 0 || audioTrackCount > 1) {
      return 'good';
    }
    return 'limited';
  }

  // AVI has poor support
  if (format === 'avi') {
    return 'poor';
  }

  // WebM has good support
  if (format === 'webm') {
    return 'good';
  }

  return 'limited';
}

function generateSupportDetails(
  containerFormat: string,
  subtitleTracks: any[],
  audioTracks: any[]
): {
  subtitleSupport: string;
  audioSupport: string;
  recommendations: string[];
} {
  const format = containerFormat.toLowerCase();
  const recommendations: string[] = [];

  let subtitleSupport = '';
  let audioSupport = '';

  // Determine subtitle support description
  if (subtitleTracks.length > 0) {
    const languages = [...new Set(subtitleTracks.map((t) => t.languageName))];
    subtitleSupport = `${subtitleTracks.length} subtitle track${subtitleTracks.length > 1 ? 's' : ''} (${languages.join(', ')})`;
  } else {
    subtitleSupport = 'No embedded subtitles';
  }

  // Determine audio support description
  if (audioTracks.length > 1) {
    const languages = [...new Set(audioTracks.map((t) => t.languageName))];
    audioSupport = `${audioTracks.length} audio track${audioTracks.length > 1 ? 's' : ''} (${languages.join(', ')})`;
  } else if (audioTracks.length === 1) {
    audioSupport = `1 audio track (${audioTracks[0].languageName})`;
  } else {
    audioSupport = 'No audio tracks detected';
  }

  // Generate format-specific recommendations
  switch (format) {
    case 'mkv':
      recommendations.push(
        '✅ MKV provides excellent subtitle and audio track support'
      );
      recommendations.push(
        '🎯 All embedded tracks are accessible and switchable'
      );
      break;

    case 'mp4':
    case 'm4v':
      if (subtitleTracks.length > 0) {
        recommendations.push(
          '✅ MP4 supports embedded subtitles (MPEG-4 Timed Text)'
        );
      } else {
        recommendations.push(
          'ℹ️ MP4 supports external subtitle files (.srt, .vtt)'
        );
      }
      if (audioTracks.length > 1) {
        recommendations.push('✅ MP4 supports multiple audio tracks');
      }
      recommendations.push('🌐 Universal compatibility across all devices');
      break;

    case 'avi':
      recommendations.push(
        '⚠️ AVI has limited subtitle and audio track support'
      );
      recommendations.push(
        '📁 Consider external subtitle files for better experience'
      );
      recommendations.push(
        '🔄 Converting to MKV would provide better track support'
      );
      break;

    case 'webm':
      recommendations.push(
        '✅ WebM supports embedded subtitles and multiple audio tracks'
      );
      recommendations.push('🌐 Modern web-optimized format');
      break;

    default:
      recommendations.push('ℹ️ Format support varies by container type');
      break;
  }

  // Add general recommendations for limited formats
  if (format === 'avi' || format === 'unknown') {
    recommendations.push('🔧 Consider using external subtitle files');
    recommendations.push('🔄 Converting to MKV would improve track support');
  }

  return {
    subtitleSupport,
    audioSupport,
    recommendations,
  };
}
