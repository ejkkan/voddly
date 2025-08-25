/* eslint-disable */
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useSourceCredentials } from '@/lib/source-credentials';
import { getContainerInfoForContent } from '@/lib/container-extension';
import { constructStreamUrl } from '@/lib/stream-url';

export type PlaybackSource = {
  url?: string;
  loading: boolean;
  error?: string | null;
  contentType?: 'movie' | 'series' | 'live';
};

export function useWebPlaybackSource(): PlaybackSource {
  const params = useLocalSearchParams<{
    playlist?: string;
    movie?: string;
    series?: string;
    live?: string;
  }>();
  const { getCredentials } = useSourceCredentials();

  const content = React.useMemo(() => {
    if (params.movie) return { id: params.movie, type: 'movie' as const };
    if (params.series) return { id: params.series, type: 'series' as const };
    if (params.live) return { id: params.live, type: 'live' as const };
    return null;
  }, [params.movie, params.series, params.live]);

  const [state, setState] = React.useState<PlaybackSource>({ loading: true });

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (!params.playlist || !content)
          throw new Error('Missing identifiers');
        const creds = await getCredentials(String(params.playlist), {
          title: 'Play Content',
          message: 'Enter your passphrase to decrypt the source',
        });
        let containerExtension: string | undefined;
        let videoCodec: string | undefined = creds.videoCodec;
        let audioCodec: string | undefined = creds.audioCodec;
        let playbackContentId: number | string = Number(content.id);
        try {
          const info = await getContainerInfoForContent(
            content.type,
            String(params.playlist),
            String(content.id)
          );
          containerExtension = info.containerExtension || containerExtension;
          videoCodec = info.videoCodec || videoCodec;
          audioCodec = info.audioCodec || audioCodec;
          if (info.playbackContentId)
            playbackContentId = info.playbackContentId;
        } catch {}
        const { streamingUrl } = constructStreamUrl({
          server: creds.server,
          username: creds.username,
          password: creds.password,
          contentId: playbackContentId,
          contentType: content.type,
          containerExtension,
          videoCodec,
          audioCodec,
        });
        if (!mounted) return;
        setState({
          loading: false,
          url: streamingUrl,
          error: null,
          contentType: content.type,
        });
      } catch (e) {
        if (!mounted) return;
        setState({
          loading: false,
          url: undefined,
          error: e instanceof Error ? e.message : 'Failed to build stream URL',
          contentType: content?.type,
        });
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [params.playlist, content, content?.id, content?.type]);

  return state;
}
