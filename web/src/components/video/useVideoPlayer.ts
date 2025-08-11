import { useCallback, useRef } from "react";
import type { VideoPlayerRef } from "./VideoPlayer.tsx";

export interface UseVideoPlayerReturn {
  // Player reference
  playerRef: React.RefObject<VideoPlayerRef | null>;

  // Control methods
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  seekTo: (time: number) => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  load: (url: string) => void;

  // State getters
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;

  // Loading state control
  setLoading: (loading: boolean) => void;
  isLoading: () => boolean;
}

export function useVideoPlayer(): UseVideoPlayerReturn {
  const playerRef = useRef<VideoPlayerRef>(null);

  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const togglePlayPause = useCallback(() => {
    playerRef.current?.togglePlayPause();
  }, []);

  const setVolume = useCallback((volume: number) => {
    playerRef.current?.setVolume(volume);
  }, []);

  const mute = useCallback(() => {
    playerRef.current?.mute();
  }, []);

  const unmute = useCallback(() => {
    playerRef.current?.unmute();
  }, []);

  const toggleMute = useCallback(() => {
    playerRef.current?.toggleMute();
  }, []);

  const seekTo = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  const enterFullscreen = useCallback(() => {
    playerRef.current?.enterFullscreen();
  }, []);

  const exitFullscreen = useCallback(() => {
    playerRef.current?.exitFullscreen();
  }, []);

  const load = useCallback((url: string) => {
    playerRef.current?.load(url);
  }, []);

  const getCurrentTime = useCallback(() => {
    return playerRef.current?.getCurrentTime() ?? 0;
  }, []);

  const getDuration = useCallback(() => {
    return playerRef.current?.getDuration() ?? 0;
  }, []);

  const isPlaying = useCallback(() => {
    return playerRef.current?.isPlaying() ?? false;
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    playerRef.current?.setLoading(loading);
  }, []);

  const isLoading = useCallback(() => {
    return playerRef.current?.isLoading() ?? false;
  }, []);

  return {
    playerRef,
    play,
    pause,
    togglePlayPause,
    setVolume,
    mute,
    unmute,
    toggleMute,
    seekTo,
    enterFullscreen,
    exitFullscreen,
    load,
    getCurrentTime,
    getDuration,
    isPlaying,
    setLoading,
    isLoading,
  };
}
