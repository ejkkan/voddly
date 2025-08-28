import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  VLCPlayer as VLC,
  type VlcPlayerViewRef,
} from 'react-native-vlc-media-player';

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

interface VLCPlayerProps extends BasePlayerProps {
  theme: VisualTheme;
}

export function VLCPlayer({
  url,
  title,
  showBack,
  onBack,
  layout = 'netflix',
  theme,
  autoPlay = true,
  startTime = 0,
}: VLCPlayerProps) {
  const vlcRef = useRef<VlcPlayerViewRef>(null);
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

  // Only unlock orientation when unmounting
  useEffect(() => {
    return () => {
      unlockOrientation();
    };
  }, [unlockOrientation]);

  // Handle VLC player events
  const handlePlaying = useCallback(() => {
    setLoading(false);
    setPlaying(true);
  }, [setLoading, setPlaying]);

  const handlePaused = useCallback(() => {
    setPlaying(false);
  }, [setPlaying]);

  const handleBuffering = useCallback(
    (event: any) => {
      updatePlayerState({ buffering: event.isBuffering });
    },
    [updatePlayerState]
  );

  const handleProgress = useCallback(
    (event: any) => {
      if (event.currentTime !== undefined && event.duration !== undefined) {
        setProgress(event.currentTime / 1000, event.duration / 1000);
      }
    },
    [setProgress]
  );

  const handleError = useCallback(
    (event: any) => {
      console.error('VLC playback error:', event);
      setError('Playback error occurred');
    },
    [setError]
  );

  const handleLoad = useCallback(
    (event: any) => {
      setLoading(false);
      if (event.duration) {
        updatePlayerState({ duration: event.duration / 1000 });
      }

      // Seek to start time if specified
      if (startTime > 0 && vlcRef.current) {
        vlcRef.current.seek(startTime);
      }

      // Extract audio tracks if available
      if (event.audioTracks) {
        updatePlayerState({
          audioTracks: event.audioTracks.map((track: any, index: number) => ({
            id: index.toString(),
            language: track.language || '',
            label: track.name || track.language || `Track ${index + 1}`,
          })),
        });
      }

      // Extract subtitle tracks if available
      if (event.textTracks) {
        updatePlayerState({
          subtitleTracks: event.textTracks.map((track: any, index: number) => ({
            id: index.toString(),
            language: track.language || '',
            label: track.name || track.language || `Subtitle ${index + 1}`,
          })),
        });
      }
    },
    [setLoading, updatePlayerState, startTime]
  );

  // Create player controls
  const controls: PlayerControls = {
    play: () => {
      vlcRef.current?.resume();
      setPlaying(true);
      handleUserActivity();
    },
    pause: () => {
      vlcRef.current?.pause();
      setPlaying(false);
      handleUserActivity();
    },
    togglePlay: () => {
      if (playerState.isPlaying) {
        vlcRef.current?.pause();
        setPlaying(false);
      } else {
        vlcRef.current?.resume();
        setPlaying(true);
      }
      handleUserActivity();
    },
    seek: (time: number) => {
      vlcRef.current?.seek(time);
      setProgress(time);
      handleUserActivity();
    },
    seekRelative: (delta: number) => {
      const newTime = Math.max(
        0,
        Math.min(playerState.duration, playerState.currentTime + delta)
      );
      vlcRef.current?.seek(newTime);
      setProgress(newTime);
      handleUserActivity();
    },
    setVolume: (volume: number) => {
      const vlcVolume = Math.round(volume * 200); // VLC uses 0-200 scale
      vlcRef.current?.setVolume(vlcVolume);
      setVolume(volume);
      handleUserActivity();
    },
    toggleMute: () => {
      toggleMute();
      const vlcVolume = playerState.isMuted
        ? 0
        : Math.round(playerState.volume * 200);
      vlcRef.current?.setVolume(vlcVolume);
      handleUserActivity();
    },
    selectAudioTrack: (trackId: string) => {
      const trackIndex = parseInt(trackId, 10);
      if (!isNaN(trackIndex) && vlcRef.current) {
        vlcRef.current.setAudioTrack(trackIndex);
        updatePlayerState({ selectedAudioTrack: trackId });
      }
      handleUserActivity();
    },
    selectSubtitleTrack: (trackId: string) => {
      const trackIndex = parseInt(trackId, 10);
      if (!isNaN(trackIndex) && vlcRef.current) {
        vlcRef.current.setSubtitleTrack(trackIndex);
        updatePlayerState({ selectedSubtitleTrack: trackId });
      } else if (!trackId && vlcRef.current) {
        vlcRef.current.setSubtitleTrack(-1); // Disable subtitles
        updatePlayerState({ selectedSubtitleTrack: undefined });
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
      vlcRef.current?.reload();
      handleUserActivity();
    },
  };

  // Select layout component
  const Layout = layout === 'minimal' ? MinimalLayout : NetflixLayout;

  return (
    <ThemeProvider theme={theme}>
      <Layout
        videoElement={
          <VLC
            ref={vlcRef}
            source={{ uri: url }}
            style={StyleSheet.absoluteFillObject}
            paused={!autoPlay}
            autoplay={autoPlay}
            onPlaying={handlePlaying}
            onPaused={handlePaused}
            onBuffering={handleBuffering}
            onProgress={handleProgress}
            onError={handleError}
            onLoad={handleLoad}
            onEnd={() => setPlaying(false)}
            resizeMode="contain"
            volume={
              playerState.isMuted ? 0 : Math.round(playerState.volume * 200)
            }
            seek={startTime > 0 ? startTime : undefined}
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

export default VLCPlayer;
