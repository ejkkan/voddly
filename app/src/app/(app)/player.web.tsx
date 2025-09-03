import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';

import { EnhancedSubtitleModal } from '@/components/subtitles/EnhancedSubtitleModal';
import { Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { WebPlayer } from '@/components/video/web-player';
import { useWebPlaybackSource } from '@/components/video/web-player/useWebPlaybackSource';
import { useCurrentProfile } from '@/hooks/ui/useCurrentProfile';
import { type Subtitle, useSubtitles } from '@/hooks/useSubtitles';
import { useWatchStateTracker } from '@/hooks/useWatchStateTracker';

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
  onFormatInfoChange,
  selectedMode,
  selectedEmbeddedTrackIndex,
  selectedEmbeddedLanguage,
  startTime,
  onPlaybackStart,
  onProgress,
  onPlaybackEnd,
  onPause,
  onSeek,
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
  onFormatInfoChange?: (formatInfo: any) => void;
  selectedMode: 'none' | 'external' | 'embedded';
  selectedEmbeddedTrackIndex?: number;
  selectedEmbeddedLanguage?: string;
  startTime?: number;
  onPlaybackStart?: (current: number, duration?: number) => void;
  onProgress?: (current: number, duration?: number) => void;
  onPlaybackEnd?: (current: number, duration?: number) => void;
  onPause?: (current: number, duration?: number) => void;
  onSeek?: (current: number, duration?: number) => void;
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
          onFormatInfoChange={onFormatInfoChange}
          selectedMode={selectedMode}
          selectedEmbeddedTrackIndex={selectedEmbeddedTrackIndex}
          selectedEmbeddedLanguage={selectedEmbeddedLanguage}
          startTime={startTime}
          onPlaybackStart={onPlaybackStart}
          onProgress={onProgress}
          onPlaybackEnd={onPlaybackEnd}
          onPause={onPause}
          onSeek={onSeek}
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
  const [selectedExternalSubtitle, setSelectedExternalSubtitle] =
    useState<Subtitle | null>(null);
  const [formatInfo, setFormatInfo] = useState<any>(null);
  const [selectedMode, setSelectedMode] = useState<
    'none' | 'external' | 'embedded'
  >('none');
  const [selectedEmbeddedTrackIndex, setSelectedEmbeddedTrackIndex] = useState<
    number | undefined
  >(undefined);

  // Debug: Log format info changes
  React.useEffect(() => {
    if (formatInfo) {
      console.log('🎬 Format info updated:', {
        containerFormat: formatInfo.containerFormat,
        subtitleTracks: formatInfo.subtitleTracks?.length || 0,
        audioTracks: formatInfo.audioTracks?.length || 0,
        hasEmbeddedSubtitles: formatInfo.hasEmbeddedSubtitles,
        hasMultipleAudioTracks: formatInfo.hasMultipleAudioTracks,
      });
    }
  }, [formatInfo]);

  // Get route parameters for subtitle fetching
  const params = useLocalSearchParams();
  const movieId = params.movie as string;
  const tmdbId = params.tmdb_id ? Number(params.tmdb_id) : undefined;
  const title = params.title as string;
  const contentId = (params.movie || params.series || params.live) as
    | string
    | undefined;
  const { profileId } = useCurrentProfile();
  
  // Derive current embedded language for UI
  const currentEmbeddedLanguage = React.useMemo(() => {
    if (!formatInfo || selectedEmbeddedTrackIndex === undefined)
      return undefined;
    const track = formatInfo.subtitleTracks?.find(
      (t: any) => t.index === selectedEmbeddedTrackIndex
    );
    return track?.language;
  }, [formatInfo, selectedEmbeddedTrackIndex]);
  
  const { startTime, callbacks, preferences } = useWatchStateTracker({
    profileId,
    contentId,
    contentType,
    reportIntervalMs: 10_000,
    playerPreferences: {
      playbackSpeed: 1.0,
      audioTrack: undefined,
      subtitleTrack: selectedExternalSubtitle?.language_code || currentEmbeddedLanguage,
      qualityPreference: undefined,
    },
  });

  // Fetch subtitles for the movie/series - defer content loading to improve startup performance
  const {
    languages: availableLanguages,
    subtitles: loadedSubtitles,
    isLoading: subtitlesLoading,
  } = useSubtitles(
    {
      movieId,
      tmdbId,
      title,
      contentType: contentType === 'movie' ? 'movie' : 'episode',
      enabled: !!movieId || !!tmdbId,
    },
    [] // Don't auto-fetch subtitle content to improve player startup performance
  );

  const selectedSubtitleLoading = false;
  const allSubtitles = loadedSubtitles;

  // Get the currently selected external subtitle for the player
  const currentSubtitle = selectedExternalSubtitle;

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
      selectedSubtitleLanguage={currentSubtitle?.language_code}
      onSubtitleApplied={handleSubtitleApplied}
      onPressSubtitles={() => setShowSubtitleModal(true)}
      hasSubtitles={
        availableLanguages.length > 0 ||
        (formatInfo?.hasEmbeddedSubtitles &&
          formatInfo.subtitleTracks.length > 0)
      }
      onFormatInfoChange={setFormatInfo}
      selectedMode={selectedMode}
      selectedEmbeddedTrackIndex={selectedEmbeddedTrackIndex}
      selectedEmbeddedLanguage={currentEmbeddedLanguage}
      startTime={startTime}
      onPlaybackStart={callbacks.onPlaybackStart}
      onProgress={callbacks.onProgress}
      onPlaybackEnd={callbacks.onPlaybackEnd}
      onPause={callbacks.onPause}
      onSeek={callbacks.onSeek}
    />
  );

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-black">
        <BackBar />
        {body}

        {/* Enhanced Subtitle Modal */}
        <EnhancedSubtitleModal
          visible={showSubtitleModal}
          onClose={() => setShowSubtitleModal(false)}
          subtitles={allSubtitles}
          formatInfo={formatInfo}
          isLoading={subtitlesLoading || selectedSubtitleLoading}
          currentMode={selectedMode}
          currentExternalId={selectedExternalSubtitle?.id}
          currentEmbeddedLanguage={currentEmbeddedLanguage}
          currentEmbeddedIndex={selectedEmbeddedTrackIndex}
          onClearSelection={() => {
            setSelectedMode('none');
            setSelectedExternalSubtitle(null);
            setSelectedEmbeddedTrackIndex(undefined);
            setShowSubtitleModal(false);
          }}
          onSubtitleSelect={(subtitle: any) => {
            setSelectedMode('external');
            setSelectedExternalSubtitle(subtitle);
            setSelectedEmbeddedTrackIndex(undefined);
            setShowSubtitleModal(false);
          }}
          onEmbeddedTrackSelect={(trackIndex: number) => {
            setSelectedMode('embedded');
            setSelectedExternalSubtitle(null);
            setSelectedEmbeddedTrackIndex(trackIndex);
            setShowSubtitleModal(false);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
