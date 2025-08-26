import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Video, { OnLoadData, OnProgressData } from 'react-native-video';
import { BasePlayerProps, PlayerControls } from '../shared/types/player.types';
import { VisualTheme } from '../shared/types/theme.types';
import { ThemeProvider } from '../shared/themes/ThemeProvider';
import { NetflixLayout, MinimalLayout } from '../shared/layouts';
import { usePlaybackState } from '../shared/hooks/usePlaybackState';
import { useControlsVisibility } from '../shared/hooks/useControlsVisibility';
import { useOrientation } from '../shared/hooks/useOrientation';

interface RNVideoPlayerProps extends BasePlayerProps {
  theme: VisualTheme;
}

export function RNVideoPlayer({ 
  url, 
  title,
  showBack,
  onBack,
  layout = 'netflix',
  theme,
  autoPlay = true,
  startTime = 0,
}: RNVideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const { playerState, updatePlayerState, setPlaying, setLoading, setError, setProgress, setVolume, toggleMute } = usePlaybackState();
  const { showControls, setShowControls, handleUserActivity } = useControlsVisibility();
  const { lockLandscape, unlockOrientation } = useOrientation();

  // Lock to landscape on mount
  useEffect(() => {
    lockLandscape();
    return () => {
      unlockOrientation();
    };
  }, []);

  // Handle video load
  const handleLoad = useCallback((data: OnLoadData) => {
    setLoading(false);
    updatePlayerState({
      duration: data.duration,
      audioTracks: data.audioTracks?.map(track => ({
        id: track.index?.toString() || '',
        language: track.language || '',
        label: track.title || track.language || '',
      })) || [],
      subtitleTracks: data.textTracks?.map(track => ({
        id: track.index?.toString() || '',
        language: track.language || '',
        label: track.title || track.language || '',
      })) || [],
    });

    // Seek to start time if specified
    if (startTime > 0) {
      videoRef.current?.seek(startTime);
    }
  }, [setLoading, updatePlayerState, startTime]);

  // Handle progress updates
  const handleProgress = useCallback((data: OnProgressData) => {
    setProgress(data.currentTime, data.playableDuration);
    updatePlayerState({
      buffering: data.currentTime === playerState.currentTime && playerState.isPlaying,
    });
  }, [setProgress, updatePlayerState, playerState.currentTime, playerState.isPlaying]);

  // Handle errors
  const handleError = useCallback((error: any) => {
    console.error('Video playback error:', error);
    setError('Playback error occurred');
  }, [setError]);

  // Create player controls
  const controls: PlayerControls = {
    play: () => {
      setPlaying(true);
      handleUserActivity();
    },
    pause: () => {
      setPlaying(false);
      handleUserActivity();
    },
    togglePlay: () => {
      setPlaying(!playerState.isPlaying);
      handleUserActivity();
    },
    seek: (time: number) => {
      videoRef.current?.seek(time);
      setProgress(time);
      handleUserActivity();
    },
    seekRelative: (delta: number) => {
      const newTime = Math.max(0, Math.min(playerState.duration, playerState.currentTime + delta));
      videoRef.current?.seek(newTime);
      setProgress(newTime);
      handleUserActivity();
    },
    setVolume: (volume: number) => {
      setVolume(volume);
      handleUserActivity();
    },
    toggleMute: () => {
      toggleMute();
      handleUserActivity();
    },
    selectAudioTrack: (trackId: string) => {
      const trackIndex = parseInt(trackId, 10);
      if (!isNaN(trackIndex) && videoRef.current) {
        (videoRef.current as any).setSelectedAudioTrack({
          type: 'index',
          value: trackIndex,
        });
        updatePlayerState({ selectedAudioTrack: trackId });
      }
      handleUserActivity();
    },
    selectSubtitleTrack: (trackId: string) => {
      const trackIndex = parseInt(trackId, 10);
      if (!isNaN(trackIndex) && videoRef.current) {
        (videoRef.current as any).setSelectedTextTrack({
          type: trackId ? 'index' : 'disabled',
          value: trackIndex,
        });
        updatePlayerState({ selectedSubtitleTrack: trackId });
      }
      handleUserActivity();
    },
    toggleFullscreen: () => {
      // On mobile, we're already fullscreen in landscape
      handleUserActivity();
    },
    retry: () => {
      setError(null);
      setLoading(true);
      // Force reload by changing key
      handleUserActivity();
    },
  };

  // Select layout component
  const Layout = layout === 'minimal' ? MinimalLayout : NetflixLayout;

  return (
    <ThemeProvider theme={theme}>
      <Layout
        videoElement={
          <Video
            ref={videoRef}
            source={{ uri: url }}
            style={StyleSheet.absoluteFillObject}
            paused={!playerState.isPlaying}
            volume={playerState.isMuted ? 0 : playerState.volume}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onError={handleError}
            onEnd={() => setPlaying(false)}
            onBuffer={({ isBuffering }) => updatePlayerState({ buffering: isBuffering })}
            resizeMode="contain"
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            progressUpdateInterval={250}
            {...(autoPlay && { paused: false })}
          />
        }
        playerState={playerState}
        controls={controls}
        title={title}
        showBack={showBack}
        onBack={onBack}
        showControls={showControls}
        setShowControls={setShowControls}
      />
    </ThemeProvider>
  );
}

export default RNVideoPlayer;