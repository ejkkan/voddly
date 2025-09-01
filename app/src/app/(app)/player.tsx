import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';

import { SubtitleButton, SubtitleModal } from '@/components/subtitles';
import { SafeAreaView, Text, View } from '@/components/ui';
import { VideoPlayer } from '@/components/video';
import { useWebPlaybackSource } from '@/components/video/web-player/useWebPlaybackSource';
import { useCurrentProfile } from '@/hooks/ui/useCurrentProfile';
import { useSubtitleForLanguage, useSubtitles } from '@/hooks/useSubtitles';
import { useWatchStateTracker } from '@/hooks/useWatchStateTracker';

export default function Player() {
  const router = useRouter();
  const { url, loading, error, contentType } = useWebPlaybackSource();
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [selectedSubtitleLanguage, setSelectedSubtitleLanguage] =
    useState<string>('');

  // You can also get theme/layout preferences from params or user settings
  const params = useLocalSearchParams();
  const layout = (params.layout as 'netflix' | 'minimal') || 'netflix';
  const theme = (params.theme as 'default' | 'compact') || 'compact';

  // Extract movie metadata from params for subtitle fetching
  const movieId = params.movie as string;
  const tmdbId = params.tmdb_id ? Number(params.tmdb_id) : undefined;
  const title = params.title as string;
  const contentId = (params.movie || params.series || params.live) as
    | string
    | undefined;
  const { profileId } = useCurrentProfile();
  const { startTime, callbacks, preferences, updatePreferences } =
    useWatchStateTracker({
      profileId,
      contentId,
      contentType,
      reportIntervalMs: 10_000,
    });

  // Fetch subtitles for the movie
  const {
    languages: availableLanguages,
    subtitles: loadedSubtitles,
    isLoading: subtitlesLoading,
  } = useSubtitles({
    movieId,
    tmdbId,
    title,
    contentType: contentType === 'movie' ? 'movie' : 'episode',
    enabled: !!movieId || !!tmdbId,
  });

  // Fetch subtitle content for selected language
  const { data: selectedSubtitle, isLoading: selectedSubtitleLoading } =
    useSubtitleForLanguage(
      {
        movieId,
        tmdbId,
        title,
        contentType: contentType === 'movie' ? 'movie' : 'episode',
      },
      selectedSubtitleLanguage
    );

  // Initialize subtitle language from saved preferences
  React.useEffect(() => {
    if (preferences?.subtitleTrack && !selectedSubtitleLanguage) {
      setSelectedSubtitleLanguage(preferences.subtitleTrack);
    }
  }, [preferences?.subtitleTrack]);

  // Combine loaded subtitles with selected subtitle
  const allSubtitles = React.useMemo(() => {
    const combined = [...loadedSubtitles];
    if (
      selectedSubtitle &&
      !combined.find((s) => s.language_code === selectedSubtitle.language_code)
    ) {
      combined.push(selectedSubtitle);
    }
    return combined;
  }, [loadedSubtitles, selectedSubtitle]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center bg-black">
          <Text className="text-white">Loading player…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center bg-black">
          <Text className="text-red-400">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!url) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center bg-black">
          <Text className="text-white">No video URL provided</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-black">
        <VideoPlayer
          url={url}
          title={params.title as string}
          type={contentType}
          showBack
          onBack={() => router.back()}
          layout={layout}
          theme={theme}
          preferredPlayer="rn-video" // Force RN Video player to see compact theme
          startTime={startTime}
          onPlaybackStart={callbacks.onPlaybackStart}
          onProgress={callbacks.onProgress}
          onPlaybackEnd={callbacks.onPlaybackEnd}
          onPause={callbacks.onPause}
          onSeek={callbacks.onSeek}
          initialPlaybackSpeed={preferences?.playbackSpeed}
          initialAudioTrack={preferences?.audioTrack}
          initialSubtitleTrack={preferences?.subtitleTrack}
          initialQuality={preferences?.qualityPreference}
        />

        {/* Subtitle Button - positioned over the video */}
        <View className="absolute right-4 top-16 z-10">
          <SubtitleButton
            onPress={() => setShowSubtitleModal(true)}
            availableCount={availableLanguages.length}
            isLoading={subtitlesLoading}
          />
        </View>

        {/* Subtitle Modal */}
        <SubtitleModal
          visible={showSubtitleModal}
          onClose={() => setShowSubtitleModal(false)}
          subtitles={allSubtitles}
          isLoading={subtitlesLoading || selectedSubtitleLoading}
          onSubtitleSelect={(subtitle) => {
            console.log('[Player] Subtitle selected:', subtitle.language_code);
            // Apply the selected subtitle to the video
            setSelectedSubtitleLanguage(subtitle.language_code);
            // Update watch state with the new subtitle preference
            if (updatePreferences) {
              console.log(
                '[Player] Calling updatePreferences with subtitle:',
                subtitle.language_code
              );
              updatePreferences({ subtitleTrack: subtitle.language_code });
            } else {
              console.log('[Player] updatePreferences is not available');
            }
            // The subtitle content will be automatically applied by the video player
            // through the useSubtitleForLanguage hook
          }}
        />
      </View>
    </SafeAreaView>
  );
}
