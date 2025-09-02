import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Video, {
  type OnLoadData,
  type OnProgressData,
} from 'react-native-video';

import { useCast } from '../shared/hooks/useCast';
import { useControlsVisibility } from '../shared/hooks/useControlsVisibility';
import { useOrientation } from '../shared/hooks/useOrientation';
import { usePlaybackState } from '../shared/hooks/usePlaybackState';
import { MinimalLayout, NetflixLayout } from '../shared/layouts';
import { ThemeProvider } from '../shared/themes/ThemeProvider';
import {
  type BasePlayerProps,
  type PlayerControls,
} from '../shared/types/player.types';
import { type VisualTheme } from '../shared/types/theme.types';

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
  onPlaybackStart,
  onProgress,
  onPlaybackEnd,
  constrainToContainer,
}: RNVideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const {
    playerState,
    updatePlayerState,
    setPlaying,
    setLoading,
    setError,
    setProgress,
    setVolume,
    toggleMute,
  } = usePlaybackState();
  const { showControls, setShowControls, handleUserActivity } =
    useControlsVisibility();
  const { lockLandscape, unlockOrientation } = useOrientation();

  // Initialize casting
  const {
    castState,
    isCasting,
    currentDevice,
    startCast,
    stopCast,
    castControls,
  } = useCast({
    url,
    title,
    currentTime: playerState.currentTime,
    duration: playerState.duration,
    onCastStateChange: (state) => {
      updatePlayerState({ castState: state, isCasting: state === 'CONNECTED' });
    },
  });

  // Only unlock orientation when unmounting
  useEffect(() => {
    return () => {
      unlockOrientation();
    };
  }, [unlockOrientation]);

  // Handle video load
  const handleLoad = useCallback(
    (data: OnLoadData) => {
      setLoading(false);
      updatePlayerState({
        duration: data.duration,
        audioTracks:
          data.audioTracks?.map((track) => ({
            id: track.index?.toString() || '',
            language: track.language || '',
            label: track.title || track.language || '',
          })) || [],
        subtitleTracks:
          data.textTracks?.map((track) => ({
            id: track.index?.toString() || '',
            language: track.language || '',
            label: track.title || track.language || '',
          })) || [],
      });

      // Seek to start time if specified
      if (startTime > 0) {
        videoRef.current?.seek(startTime);
      }

      // Notify start when metadata loaded (duration known)
      try {
        onPlaybackStart?.(startTime || 0, data.duration);
      } catch {}
    },
    [setLoading, updatePlayerState, startTime, onPlaybackStart]
  );

  // Handle progress updates
  const handleProgress = useCallback(
    (data: OnProgressData) => {
      setProgress(data.currentTime, data.playableDuration);
      updatePlayerState({
        buffering:
          data.currentTime === playerState.currentTime && playerState.isPlaying,
      });

      try {
        onProgress?.(data.currentTime, playerState.duration);
      } catch {}
    },
    [
      setProgress,
      updatePlayerState,
      playerState.currentTime,
      playerState.isPlaying,
      playerState.duration,
      onProgress,
    ]
  );

  // Handle errors
  const handleError = useCallback(
    (error: any) => {
      console.error('Video playback error:', error);
      setError('Playback error occurred');
    },
    [setError]
  );

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
      const newTime = Math.max(
        0,
        Math.min(playerState.duration, playerState.currentTime + delta)
      );
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
      // Lock to landscape when fullscreen is requested
      lockLandscape();
      handleUserActivity();
    },
    retry: () => {
      setError(null);
      setLoading(true);
      // Force reload by changing key
      handleUserActivity();
    },
    // Cast controls
    startCast: () => {
      startCast();
      handleUserActivity();
    },
    stopCast: () => {
      stopCast();
      handleUserActivity();
    },
  };

  // Override controls when casting
  const effectiveControls = isCasting
    ? {
        ...controls,
        play: castControls.play,
        pause: castControls.pause,
        togglePlay: async () => {
          if (playerState.isPlaying) {
            await castControls.pause();
          } else {
            await castControls.play();
          }
        },
        seek: castControls.seek,
        setVolume: castControls.setVolume,
        toggleMute: castControls.toggleMute,
      }
    : controls;

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
            onEnd={() => {
              setPlaying(false);
              try {
                onPlaybackEnd?.(playerState.currentTime, playerState.duration);
              } catch {}
            }}
            onBuffer={({ isBuffering }) =>
              updatePlayerState({ buffering: isBuffering })
            }
            resizeMode="contain"
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            progressUpdateInterval={250}
            {...(autoPlay && { paused: false })}
          />
        }
        playerState={playerState}
        controls={effectiveControls}
        title={title}
        showBack={showBack}
        onBack={onBack}
        showControls={showControls}
        setShowControls={setShowControls}
        constrainToContainer={constrainToContainer}
      />
    </ThemeProvider>
  );
}

export default RNVideoPlayer;
