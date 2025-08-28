import { useCallback, useRef } from 'react';

import {
  type AudioTrack,
  type SubtitleTrack,
} from '../../shared/types/player.types';

declare global {
  interface Window {
    shaka: any;
  }
}

interface ShakaPlayerHookProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onLoad: (data: {
    duration: number;
    audioTracks: AudioTrack[];
    subtitleTracks: SubtitleTrack[];
  }) => void;
  onError: (error: any) => void;
}

export function useShakaPlayer({
  videoRef,
  onLoad,
  onError,
}: ShakaPlayerHookProps) {
  const playerRef = useRef<any>(null);

  const initializePlayer = useCallback(
    async (url: string) => {
      if (!videoRef.current) return;

      try {
        // Load Shaka Player if not already loaded
        if (!window.shaka) {
          const script = document.createElement('script');
          script.src =
            'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.3.6/shaka-player.compiled.min.js';
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        // Install polyfills
        window.shaka.polyfill.installAll();

        // Check browser support
        if (!window.shaka.Player.isBrowserSupported()) {
          console.warn(
            'Browser does not support Shaka Player, falling back to native playback'
          );
          videoRef.current.src = url;
          return;
        }

        // Create player
        const player = new window.shaka.Player(videoRef.current);
        playerRef.current = player;

        // Configure player
        player.configure({
          streaming: {
            bufferingGoal: 30,
            rebufferingGoal: 15,
            bufferBehind: 30,
          },
        });

        // Add error listener
        player.addEventListener('error', (event: any) => {
          onError(event.detail);
        });

        // Load the manifest
        await player.load(url);

        // Get tracks
        const tracks = player.getVariantTracks();
        const textTracks = player.getTextTracks();

        // Extract unique audio languages
        const audioLanguages = new Map<string, AudioTrack>();
        tracks.forEach((track: any) => {
          if (track.language && !audioLanguages.has(track.language)) {
            audioLanguages.set(track.language, {
              id: track.language,
              language: track.language,
              label: track.label || track.language,
            });
          }
        });

        // Extract subtitle tracks
        const subtitleTracks: SubtitleTrack[] = textTracks.map(
          (track: any) => ({
            id: track.id?.toString() || track.language,
            language: track.language,
            label: track.label || track.language,
          })
        );

        // Notify load complete
        onLoad({
          duration: videoRef.current.duration,
          audioTracks: Array.from(audioLanguages.values()),
          subtitleTracks,
        });
      } catch (error) {
        console.error('Failed to initialize Shaka player:', error);
        // Fallback to native playback
        if (videoRef.current) {
          videoRef.current.src = url;
        }
      }
    },
    [videoRef, onLoad, onError]
  );

  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
  }, []);

  const selectAudioTrack = useCallback((language: string) => {
    if (!playerRef.current) return;

    const tracks = playerRef.current.getVariantTracks();
    const track = tracks.find((t: any) => t.language === language);
    if (track) {
      playerRef.current.selectVariantTrack(track);
    }
  }, []);

  const selectSubtitleTrack = useCallback((trackId: string) => {
    if (!playerRef.current) return;

    const tracks = playerRef.current.getTextTracks();
    const track = tracks.find(
      (t: any) => t.id?.toString() === trackId || t.language === trackId
    );
    if (track) {
      playerRef.current.selectTextTrack(track);
      playerRef.current.setTextTrackVisibility(true);
    } else {
      playerRef.current.setTextTrackVisibility(false);
    }
  }, []);

  return {
    initializePlayer,
    destroyPlayer,
    selectAudioTrack,
    selectSubtitleTrack,
  };
}
