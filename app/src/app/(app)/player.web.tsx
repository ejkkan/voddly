import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { WebPlayer } from '@/components/video/web-player';
import { useSourceCredentials } from '@/lib/source-credentials';
import { getContainerInfoForContent } from '@/lib/container-extension';
import { constructStreamUrl } from '@/lib/stream-url';
import { useMovieMetadata, useTVMetadata } from '@/hooks/use-content-metadata';

function PlayerContent({ 
  url, 
  title, 
  tmdbId, 
  contentType 
}: { 
  url?: string; 
  title?: string; 
  tmdbId?: string;
  contentType?: 'movie' | 'series' | 'live';
}) {
  const router = useRouter();
  
  // Fetch metadata based on content type if TMDB ID is available
  const movieMetadata = useMovieMetadata(
    contentType === 'movie' && tmdbId ? tmdbId : undefined,
    {
      enabled: contentType === 'movie' && !!tmdbId,
    }
  );
  
  const tvMetadata = useTVMetadata(
    contentType === 'series' && tmdbId ? tmdbId : undefined,
    {
      enabled: contentType === 'series' && !!tmdbId,
    }
  );
  
  // Use fetched metadata to enhance the title if available
  const enhancedTitle = React.useMemo(() => {
    if (contentType === 'movie' && movieMetadata.data) {
      return movieMetadata.data.title || title;
    }
    if (contentType === 'series' && tvMetadata.data) {
      return (tvMetadata.data as any).name || title;
    }
    return title;
  }, [title, movieMetadata.data, tvMetadata.data, contentType]);
  
  // Log the available data for debugging
  React.useEffect(() => {
    if (tmdbId && contentType) {
      console.log('Player has TMDB ID:', tmdbId, 'for', contentType, ':', title);
      
      if (contentType === 'movie' && movieMetadata.data) {
        console.log('Fetched movie metadata:', {
          title: movieMetadata.data.title,
          overview: movieMetadata.data.overview,
          release_date: movieMetadata.data.release_date,
          runtime: movieMetadata.data.runtime,
        });
      }
      
      if (contentType === 'series' && tvMetadata.data) {
        console.log('Fetched TV metadata:', {
          name: (tvMetadata.data as any).name,
          overview: tvMetadata.data.overview,
          first_air_date: (tvMetadata.data as any).first_air_date,
          number_of_seasons: (tvMetadata.data as any).number_of_seasons,
        });
      }
    }
  }, [tmdbId, title, contentType, movieMetadata.data, tvMetadata.data]);
  
  return (
    <View className="flex-1 items-stretch justify-center">
      {!url ? null : (
        <WebPlayer
          url={url}
          title={enhancedTitle}
          showBack
          onBack={() => router.back()}
        />
      )}
    </View>
  );
}

function BackBar() {
  const router = useRouter();
  return (
    <View className="p-3">
      <Pressable
        onPress={() => router.back()}
        className="rounded-md bg-white/10 px-3 py-2"
      >
        <Text className="text-white">Back</Text>
      </Pressable>
    </View>
  );
}

export default function Player() {
  const params = useLocalSearchParams();
  const { getCredentials } = useSourceCredentials();
  const [url, setUrl] = React.useState<string | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Extract parameters - support both direct video URL and playlist-based approach
  const directVideo = params.video as string;
  const playlist = params.playlist as string;
  const movie = params.movie as string;
  const series = params.series as string;
  const live = params.live as string;
  const title = params.title as string;
  const tmdbId = params.tmdb_id as string;

  React.useEffect(() => {
    let mounted = true;
    const loadVideo = async () => {
      try {
        // If direct video URL is provided, use it directly
        if (directVideo) {
          if (!mounted) return;
          setUrl(`http://${directVideo}`);
          setLoading(false);
          setError(null);
          return;
        }

        // Otherwise, construct URL from playlist parameters (existing flow)
        if (!playlist) {
          throw new Error('Missing playlist or video parameter');
        }

        const contentId = movie || series || live;
        const contentType = movie ? 'movie' : series ? 'series' : 'live';
        
        if (!contentId) {
          throw new Error('Missing content identifier');
        }

        const creds = await getCredentials(playlist, {
          title: 'Play Content',
          message: 'Enter your passphrase to decrypt the source',
        });

        let containerExtension: string | undefined;
        let videoCodec: string | undefined = creds.videoCodec;
        let audioCodec: string | undefined = creds.audioCodec;
        let playbackContentId: number | string = Number(contentId);
        
        try {
          const info = await getContainerInfoForContent(
            contentType as 'movie' | 'series' | 'live',
            playlist,
            contentId
          );
          containerExtension = info.containerExtension || containerExtension;
          videoCodec = info.videoCodec || videoCodec;
          audioCodec = info.audioCodec || audioCodec;
          if (info.playbackContentId) {
            playbackContentId = info.playbackContentId;
          }
        } catch {}

        const { streamingUrl } = constructStreamUrl({
          server: creds.server,
          username: creds.username,
          password: creds.password,
          contentId: playbackContentId,
          contentType: contentType as 'movie' | 'series' | 'live',
          containerExtension,
          videoCodec,
          audioCodec,
        });
        
        if (!mounted) return;
        setUrl(streamingUrl);
        setLoading(false);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load video');
        setLoading(false);
      }
    };

    loadVideo();
    return () => {
      mounted = false;
    };
  }, [directVideo, playlist, movie, series, live, getCredentials]);

  // Determine content type from params
  const contentType = movie ? 'movie' : series ? 'series' : live ? 'live' : undefined;
  
  const body = loading ? (
    <Text className="text-center text-white">Loading player…</Text>
  ) : error ? (
    <Text className="text-center text-red-400">{error}</Text>
  ) : (
    <PlayerContent 
      url={url} 
      title={title} 
      tmdbId={tmdbId} 
      contentType={contentType}
    />
  );

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-black">
        <BackBar />
        {body}
      </View>
    </SafeAreaView>
  );
}
