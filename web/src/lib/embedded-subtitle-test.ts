/**
 * Test utilities for embedded subtitle detection
 */

import { apiClient } from "./api-client";

export interface EmbeddedSubtitleTestResult {
  success: boolean;
  streamInfo?: {
    hasEmbeddedSubtitles: boolean;
    hasMultipleAudioTracks: boolean;
    subtitleTracks: Array<{
      index: number;
      language: string;
      languageName: string;
      codec: string;
      format: string;
      forced: boolean;
      default: boolean;
      title?: string;
    }>;
    audioTracks: Array<{
      index: number;
      language: string;
      languageName: string;
      codec: string;
      channels: number;
      default: boolean;
      title?: string;
    }>;
    containerFormat: string;
    duration: number;
  };
  likelyHasEmbedded: boolean;
  analysisTime: number;
  error?: string;
}

/**
 * Test embedded subtitle detection with a stream URL
 */
export async function testEmbeddedSubtitleDetection(
  streamUrl: string,
  contentName?: string,
  quickScan = false
): Promise<EmbeddedSubtitleTestResult> {
  try {
    console.log(`🧪 Testing embedded subtitle detection for: ${contentName || 'Unknown'}`);
    console.log(`📺 Stream URL: ${streamUrl.substring(0, 100)}...`);
    console.log(`⚡ Quick scan: ${quickScan}`);

    const result = await apiClient.user.detectEmbeddedSubtitles({
      streamUrl,
      contentName,
      quickScan,
    });

    console.log(`✅ Detection completed in ${result.analysisTime}ms`);
    
    if (result.success && result.streamInfo) {
      console.log(`📊 Results:`);
      console.log(`  - Container: ${result.streamInfo.containerFormat}`);
      console.log(`  - Duration: ${Math.round(result.streamInfo.duration / 60)}min`);
      console.log(`  - Embedded subtitles: ${result.streamInfo.hasEmbeddedSubtitles ? '✅' : '❌'}`);
      console.log(`  - Multiple audio tracks: ${result.streamInfo.hasMultipleAudioTracks ? '✅' : '❌'}`);
      
      if (result.streamInfo.subtitleTracks.length > 0) {
        console.log(`📝 Subtitle tracks (${result.streamInfo.subtitleTracks.length}):`);
        result.streamInfo.subtitleTracks.forEach((track, i) => {
          console.log(`  ${i + 1}. ${track.languageName} (${track.language}) - ${track.format} ${track.forced ? '[FORCED]' : ''} ${track.default ? '[DEFAULT]' : ''}`);
        });
      }

      if (result.streamInfo.audioTracks.length > 0) {
        console.log(`🎵 Audio tracks (${result.streamInfo.audioTracks.length}):`);
        result.streamInfo.audioTracks.forEach((track, i) => {
          console.log(`  ${i + 1}. ${track.languageName} (${track.language}) - ${track.codec} ${track.channels}ch ${track.default ? '[DEFAULT]' : ''}`);
        });
      }
    } else {
      console.log(`❌ Detection failed: ${result.error}`);
    }

    return result;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      likelyHasEmbedded: false,
      analysisTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test with The Pacific episode 1 from your example
 */
export async function testPacificEpisode(): Promise<EmbeddedSubtitleTestResult> {
  const streamUrl = "http://89.37.117.6:2095/series/ngArk2Up/aSh3J7M/87393.mkv";
  const contentName = "The Pacific - S01E01";
  
  return testEmbeddedSubtitleDetection(streamUrl, contentName, false);
}

/**
 * Test with quick scan for faster results
 */
export async function testPacificEpisodeQuick(): Promise<EmbeddedSubtitleTestResult> {
  const streamUrl = "http://89.37.117.6:2095/series/ngArk2Up/aSh3J7M/87393.mkv";
  const contentName = "The Pacific - S01E01";
  
  return testEmbeddedSubtitleDetection(streamUrl, contentName, true);
}

/**
 * Test batch - multiple episodes
 */
export async function testMultipleEpisodes(): Promise<EmbeddedSubtitleTestResult[]> {
  const episodes = [
    {
      url: "http://89.37.117.6:2095/series/ngArk2Up/aSh3J7M/87393.mkv",
      name: "The Pacific - S01E01"
    },
    {
      url: "http://89.37.117.6:2095/series/ngArk2Up/aSh3J7M/87394.mkv", 
      name: "The Pacific - S01E02"
    }
  ];

  console.log(`🧪 Testing ${episodes.length} episodes...`);
  
  const results: EmbeddedSubtitleTestResult[] = [];
  
  for (const episode of episodes) {
    console.log(`\n--- Testing ${episode.name} ---`);
    const result = await testEmbeddedSubtitleDetection(episode.url, episode.name, true);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 Batch test summary:`);
  results.forEach((result, i) => {
    const episode = episodes[i];
    console.log(`${episode.name}: ${result.success ? '✅' : '❌'} (${result.analysisTime}ms)`);
    if (result.success && result.streamInfo) {
      console.log(`  Subtitles: ${result.streamInfo.subtitleTracks.length}, Audio: ${result.streamInfo.audioTracks.length}`);
    }
  });
  
  return results;
}
