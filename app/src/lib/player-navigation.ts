'use client';

import { useRouter } from 'expo-router';
import { useSourceCredentials } from '@/lib/source-credentials';
import { getContainerInfoForContent } from '@/lib/container-extension';
import { constructStreamUrl } from '@/lib/stream-url';

export interface PlayerNavigationParams {
  playlist: string;
  contentId: string;
  contentType: 'movie' | 'series' | 'live';
  title?: string;
  tmdbId?: number | string;
}

export function usePlayerNavigation() {
  const router = useRouter();
  const { getCredentials } = useSourceCredentials();

  const navigateToPlayer = async (params: PlayerNavigationParams) => {
    try {
      const { playlist, contentId, contentType, title, tmdbId } = params;

      // Get source credentials
      const creds = await getCredentials(playlist, {
        title: 'Play Content',
        message: 'Enter your passphrase to decrypt the source',
      });

      // Get container info
      let containerExtension: string | undefined;
      let videoCodec: string | undefined = creds.videoCodec;
      let audioCodec: string | undefined = creds.audioCodec;
      let playbackContentId: number | string = Number(contentId);
      
      try {
        const info = await getContainerInfoForContent(contentType, playlist, contentId);
        containerExtension = info.containerExtension || containerExtension;
        videoCodec = info.videoCodec || videoCodec;
        audioCodec = info.audioCodec || audioCodec;
        if (info.playbackContentId) {
          playbackContentId = info.playbackContentId;
        }
      } catch {}

      // Construct streaming URL
      const { streamingUrl } = constructStreamUrl({
        server: creds.server,
        username: creds.username,
        password: creds.password,
        contentId: playbackContentId,
        contentType,
        containerExtension,
        videoCodec,
        audioCodec,
      });

      // Extract the path part after http:// to use as video parameter
      const videoPath = streamingUrl.replace(/^https?:\/\//, '');

      // Navigate to simplified player with direct video URL and TMDB info
      router.push({
        pathname: '/(app)/player',
        params: {
          video: videoPath,
          title: title || undefined,
          tmdb_id: tmdbId ? String(tmdbId) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to navigate to player:', error);
      throw error;
    }
  };

  return { navigateToPlayer };
}