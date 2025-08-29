import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';

import { SubtitleModal } from '@/components/subtitles';
import { Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { WebPlayer } from '@/components/video/web-player';
import { useWebPlaybackSource } from '@/components/video/web-player/useWebPlaybackSource';
import { useSubtitleForLanguage, useSubtitles } from '@/hooks/useSubtitles';

function PlayerContent({
  url,
  contentType,
  movieId,
  tmdbId,
  title,
  selectedSubtitle,
  selectedSubtitleLanguage,
  onSubtitleApplied,
  onPressSubtitles,
  hasSubtitles,
}: {
  url?: string;
  contentType?: 'movie' | 'series' | 'live';
  movieId?: string;
  tmdbId?: number;
  title?: string;
  selectedSubtitle?: any;
  selectedSubtitleLanguage?: string;
  onSubtitleApplied?: (language: string) => void;
  onPressSubtitles: () => void;
  hasSubtitles: boolean;
}) {
  const router = useRouter();
  return (
    <View className="flex-1 items-stretch justify-center">
      {!url ? null : (
        <WebPlayer
          url={url}
          title={title}
          showBack
          onBack={() => router.back()}
          movieId={movieId}
          tmdbId={tmdbId}
          type={contentType}
          subtitleContent={selectedSubtitle?.content}
          subtitleLanguage={selectedSubtitleLanguage}
          onSubtitleApplied={onSubtitleApplied}
          externalOnPressSubtitles={onPressSubtitles}
          externalHasSubtitles={hasSubtitles}
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
  const { url, loading, error, contentType } = useWebPlaybackSource();
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [selectedSubtitleLanguage, setSelectedSubtitleLanguage] =
    useState<string>('');

  // Get route parameters for subtitle fetching
  const params = useLocalSearchParams();
  const movieId = params.movie as string;
  const tmdbId = params.tmdb_id ? Number(params.tmdb_id) : undefined;
  const title = params.title as string;

  // Fetch subtitles for the movie/series
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

  // Get the currently selected subtitle for the player
  const currentSubtitle = React.useMemo(() => {
    return allSubtitles.find(
      (s) => s.language_code === selectedSubtitleLanguage
    );
  }, [allSubtitles, selectedSubtitleLanguage]);

  // Handle subtitle application
  const handleSubtitleApplied = React.useCallback((language: string) => {
    console.log(`Subtitle applied: ${language}`);
  }, []);

  const body = loading ? (
    <Text className="text-center text-white">Loading player…</Text>
  ) : error ? (
    <Text className="text-center text-red-400">{error}</Text>
  ) : (
    <PlayerContent
      url={url}
      contentType={contentType}
      movieId={movieId}
      tmdbId={tmdbId}
      title={title}
      selectedSubtitle={currentSubtitle}
      selectedSubtitleLanguage={selectedSubtitleLanguage}
      onSubtitleApplied={handleSubtitleApplied}
      onPressSubtitles={() => setShowSubtitleModal(true)}
      hasSubtitles={availableLanguages.length > 0}
    />
  );

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-black">
        <BackBar />
        {body}



        {/* Subtitle Modal */}
        <SubtitleModal
          visible={showSubtitleModal}
          onClose={() => setShowSubtitleModal(false)}
          subtitles={allSubtitles}
          isLoading={subtitlesLoading || selectedSubtitleLoading}
          onSubtitleSelect={(subtitle) => {
            // Apply the selected subtitle to the video
            setSelectedSubtitleLanguage(subtitle.language_code);
            setShowSubtitleModal(false);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
