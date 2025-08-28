import { useCallback, useState } from 'react';

import { type PlayerState } from '../types/player.types';

const initialState: PlayerState = {
  isPlaying: false,
  isLoading: true,
  hasError: null,
  currentTime: 0,
  duration: 0,
  buffering: false,
  volume: 1,
  isMuted: false,
  audioTracks: [],
  selectedAudioTrack: undefined,
  subtitleTracks: [],
  selectedSubtitleTrack: undefined,
};

export function usePlaybackState() {
  const [playerState, setPlayerState] = useState<PlayerState>(initialState);

  const updatePlayerState = useCallback((updates: Partial<PlayerState>) => {
    setPlayerState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setPlaying = useCallback(
    (isPlaying: boolean) => {
      updatePlayerState({ isPlaying });
    },
    [updatePlayerState]
  );

  const setLoading = useCallback(
    (isLoading: boolean) => {
      updatePlayerState({ isLoading });
    },
    [updatePlayerState]
  );

  const setError = useCallback(
    (error: string | null) => {
      updatePlayerState({ hasError: error, isLoading: false });
    },
    [updatePlayerState]
  );

  const setProgress = useCallback(
    (currentTime: number, duration?: number) => {
      updatePlayerState({
        currentTime,
        ...(duration !== undefined && { duration }),
      });
    },
    [updatePlayerState]
  );

  const setVolume = useCallback(
    (volume: number) => {
      updatePlayerState({ volume: Math.max(0, Math.min(1, volume)) });
    },
    [updatePlayerState]
  );

  const toggleMute = useCallback(() => {
    setPlayerState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  return {
    playerState,
    updatePlayerState,
    setPlaying,
    setLoading,
    setError,
    setProgress,
    setVolume,
    toggleMute,
  };
}
