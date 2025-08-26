import React, { useRef, useCallback, useEffect } from 'react';
import { BasePlayerProps, PlayerControls } from '../shared/types/player.types';
import { VisualTheme } from '../shared/types/theme.types';
import { ThemeProvider } from '../shared/themes/ThemeProvider';
import { NetflixLayout, MinimalLayout } from '../shared/layouts';
import { usePlaybackState } from '../shared/hooks/usePlaybackState';
import { useControlsVisibility } from '../shared/hooks/useControlsVisibility';
import { useShakaPlayer } from './hooks/useShakaPlayer';

interface WebPlayerProps extends BasePlayerProps {
  theme: VisualTheme;
}

export function WebPlayer({ 
  url, 
  title,
  showBack,
  onBack,
  layout = 'netflix',
  theme,
  autoPlay = true,
  startTime = 0,
}: WebPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { playerState, updatePlayerState, setPlaying, setLoading, setError, setProgress, setVolume, toggleMute } = usePlaybackState();
  const { showControls, setShowControls, handleUserActivity } = useControlsVisibility();
  
  // Initialize Shaka player
  const { initializePlayer, destroyPlayer } = useShakaPlayer({
    videoRef,
    onLoad: (data) => {
      setLoading(false);
      updatePlayerState({
        duration: data.duration,
        audioTracks: data.audioTracks,
        subtitleTracks: data.subtitleTracks,
      });
      if (startTime > 0 && videoRef.current) {
        videoRef.current.currentTime = startTime;
      }
    },
    onError: (error) => {
      console.error('Shaka player error:', error);
      setError('Playback error occurred');
    },
  });

  // Initialize player when URL changes
  useEffect(() => {
    if (videoRef.current && url) {
      initializePlayer(url);
    }
    return () => {
      destroyPlayer();
    };
  }, [url]);

  // Handle video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleTimeUpdate = () => {
      setProgress(video.currentTime, video.duration);
    };
    const handleLoadStart = () => setLoading(true);
    const handleCanPlay = () => setLoading(false);
    const handleWaiting = () => updatePlayerState({ buffering: true });
    const handlePlaying = () => updatePlayerState({ buffering: false });
    const handleEnded = () => setPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Create player controls
  const controls: PlayerControls = {
    play: () => {
      videoRef.current?.play();
      handleUserActivity();
    },
    pause: () => {
      videoRef.current?.pause();
      handleUserActivity();
    },
    togglePlay: () => {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
      handleUserActivity();
    },
    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      handleUserActivity();
    },
    seekRelative: (delta: number) => {
      if (videoRef.current) {
        const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + delta));
        videoRef.current.currentTime = newTime;
      }
      handleUserActivity();
    },
    setVolume: (volume: number) => {
      if (videoRef.current) {
        videoRef.current.volume = volume;
        setVolume(volume);
      }
      handleUserActivity();
    },
    toggleMute: () => {
      if (videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted;
        toggleMute();
      }
      handleUserActivity();
    },
    selectAudioTrack: (trackId: string) => {
      // Implement Shaka audio track selection
      updatePlayerState({ selectedAudioTrack: trackId });
      handleUserActivity();
    },
    selectSubtitleTrack: (trackId: string) => {
      // Implement Shaka subtitle track selection
      updatePlayerState({ selectedSubtitleTrack: trackId });
      handleUserActivity();
    },
    toggleFullscreen: () => {
      const video = videoRef.current;
      if (!video) return;

      if (!document.fullscreenElement) {
        video.requestFullscreen?.() || 
        (video as any).webkitRequestFullscreen?.() ||
        (video as any).msRequestFullscreen?.();
      } else {
        document.exitFullscreen?.() ||
        (document as any).webkitExitFullscreen?.() ||
        (document as any).msExitFullscreen?.();
      }
      handleUserActivity();
    },
    retry: () => {
      setError(null);
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play();
      }
      handleUserActivity();
    },
  };

  // Select layout component
  const Layout = layout === 'minimal' ? MinimalLayout : NetflixLayout;

  return (
    <ThemeProvider theme={theme}>
      <Layout
        videoElement={
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            autoPlay={autoPlay}
            playsInline
            preload="auto"
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

export default WebPlayer;