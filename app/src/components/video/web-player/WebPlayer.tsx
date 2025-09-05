/* eslint-disable */
import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Pressable, ActivityIndicator } from '@/components/ui';
import { TopBar } from './components/TopBar';
import { ControlsBar } from '@/components/video/web-player/components/ControlsBar';

let ShakaNS: any = null;

export type WebPlayerProps = {
  url: string;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  startTime?: number;
};

export function WebPlayer(props: WebPlayerProps) {
  const {
    url,
    title,
    showBack,
    onBack,
    startTime = 0,
  } = props;
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const playerRef = React.useRef<any>(null);
  const isActiveRef = React.useRef<boolean>(true);




  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [showControls, setShowControls] = React.useState(true);
  const [isMutedUi, setIsMutedUi] = React.useState<boolean>(false);
  

  useFocusEffect(
    React.useCallback(() => {
      isActiveRef.current = true;
      return () => {
        isActiveRef.current = false;
        try {
          playerRef.current?.destroy?.();
        } catch {}
        try {
          const v = videoRef.current as HTMLVideoElement | null;
          if (!v) return;
          try {
            v.pause();
          } catch {}
          try {
            (v as any).src = '';
            v.removeAttribute('src');
            v.load();
          } catch {}
        } catch {}
      };
    }, [])
  );


  React.useEffect(() => {
    if (!url || !videoRef.current) return;
    console.log('Video:', url);
    
    const initPlayer = async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        
        // Load Shaka Player
        const shakaModule = await import('shaka-player');
        const shaka = shakaModule.default || (globalThis as any).shaka;

        if (!shaka || !shaka.Player) {
          throw new Error('Shaka Player not available');
        }

        // Create player and attach to video element
        const player = new shaka.Player();
        playerRef.current = player;
        await player.attach(video);

        // Load the video URL
        await player.load(url);

        console.log('Video loaded successfully');
        
        // Set up basic event listeners
        const onTimeUpdate = () => {
          setCurrentTime(video.currentTime || 0);
        };
        const onDurationChange = () => {
          setDuration(video.duration || 0);
        };
        const onPlay = () => {
          setIsPlaying(true);
          setIsLoading(false);
        };
        const onPause = () => {
          setIsPlaying(false);
        };
        const onWaiting = () => {
          setIsLoading(true);
        };
        const onCanPlay = () => {
          setIsLoading(false);
        };
        const onVolumeChange = () => {
          setIsMutedUi(!!video.muted || (video.volume ?? 0) === 0);
        };
        const onLoadedMetadata = () => {
          if (startTime && startTime > 0) {
            video.currentTime = startTime;
          }
        };
        const onError = () => {
          console.error('Video playback error');
          setHasError('Playback error');
          setIsLoading(false);
        };
        
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);
        
        // Cleanup function
        return () => {
          video.removeEventListener('timeupdate', onTimeUpdate);
          video.removeEventListener('durationchange', onDurationChange);
          video.removeEventListener('play', onPlay);
          video.removeEventListener('pause', onPause);
          video.removeEventListener('waiting', onWaiting);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('volumechange', onVolumeChange);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          player.destroy();
        };
      } catch (error) {
        console.error('Failed to load video:', error);
        setHasError('Failed to load video');
        setIsLoading(false);
      }
    };

    initPlayer();
  }, [url, startTime]);


  const onSeek = React.useCallback(
    (value: number) => {
      if (!videoRef.current || duration <= 0) return;
      const target = Math.max(0, Math.min(duration, value));
      videoRef.current.currentTime = target;
    },
    [duration]
  );

  const onSeekToFraction = React.useCallback(
    (fraction01: number) => {
      if (!videoRef.current || duration <= 0) return;
      const safe = Math.max(0, Math.min(1, fraction01));
      const target = safe * duration;
      videoRef.current.currentTime = target;
    },
    [duration]
  );

  const fmt = (s: number) => {
    const sec = Math.max(0, Math.floor(s));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const sc = sec % 60;
    const mm = m < 10 ? `0${m}` : String(m);
    const ss = sc < 10 ? `0${sc}` : String(sc);
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const onTogglePlay = React.useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;
      if (isPlaying) v.pause();
      else {
        try {
          v.muted = false;
          v.volume = Math.max(0.0, Math.min(1.0, v.volume || 1));
        } catch {}
        v.play();
      }
    } catch {}
  }, [isPlaying]);

  const onToggleMute = React.useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;

      v.muted = !v.muted;
      if (!v.muted && v.volume === 0) v.volume = 1;
      setIsMutedUi(!!v.muted || (v.volume ?? 0) === 0);
    } catch {}
  }, []);

  const onRetry = React.useCallback(() => {
    setHasError(null);
    // Simple retry - just reload the page or reinitialize
    window.location.reload();
  }, []);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const onToggleFullscreen = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        const requestFullscreen =
          container.requestFullscreen ||
          (container as any).webkitRequestFullscreen ||
          (container as any).mozRequestFullScreen ||
          (container as any).msRequestFullscreen;

        if (requestFullscreen) {
          requestFullscreen.call(container);
          setIsFullscreen(true);
        }
      } else {
        const exitFullscreen =
          document.exitFullscreen ||
          (document as any).webkitExitFullscreen ||
          (document as any).mozCancelFullScreen ||
          (document as any).msExitFullscreen;

        if (exitFullscreen) {
          exitFullscreen.call(document);
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.error('Fullscreen toggle failed:', err);
    }
  }, []);

  // Keyboard controls
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isHoldingLeft = false;
    let isHoldingRight = false;
    let fastForwardInterval: number | null = null;

    const startFastForward = (direction: 'forward' | 'backward') => {
      if (fastForwardInterval) return;

      fastForwardInterval = window.setInterval(() => {
        if (!video) return;
        const seekAmount = direction === 'forward' ? 2 : -2;
        video.currentTime = Math.max(
          0,
          Math.min(duration, video.currentTime + seekAmount)
        );
      }, 100);
    };

    const stopFastForward = () => {
      if (fastForwardInterval) {
        window.clearInterval(fastForwardInterval);
        fastForwardInterval = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for media keys
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'f',
          'F',
        ].includes(e.key)
      ) {
        e.preventDefault();
      }

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          onTogglePlay();
          break;

        case 'ArrowUp':
          if (video) {
            video.volume = Math.min(1, video.volume + 0.1);
            setIsMutedUi(false);
            if (video.muted) video.muted = false;
          }
          break;

        case 'ArrowDown':
          if (video) {
            video.volume = Math.max(0, video.volume - 0.1);
            setIsMutedUi(video.volume === 0);
          }
          break;

        case 'ArrowLeft':
          if (!isHoldingLeft) {
            isHoldingLeft = true;
            if (!e.repeat) {
              // First press - seek back 10 seconds
              onSeek(Math.max(0, currentTime - 10));
            } else {
              // Holding - start fast rewind
              startFastForward('backward');
            }
          }
          break;

        case 'ArrowRight':
          if (!isHoldingRight) {
            isHoldingRight = true;
            if (!e.repeat) {
              // First press - seek forward 10 seconds
              onSeek(currentTime + 10);
            } else {
              // Holding - start fast forward
              startFastForward('forward');
            }
          }
          break;

        case 'f':
        case 'F':
          onToggleFullscreen();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          isHoldingLeft = false;
          stopFastForward();
          break;

        case 'ArrowRight':
          isHoldingRight = false;
          stopFastForward();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      stopFastForward();
    };
  }, [currentTime, duration, onSeek, onTogglePlay, onToggleFullscreen]);


  return (
    <div
      ref={containerRef}
      className="flex-1 bg-black"
      style={{
        display: 'flex',
        flex: 1,
        backgroundColor: 'black',
        position: 'relative',
      }}
    >
      <Pressable
        className="flex-1"
        onPress={() => {
          setShowControls((v) => !v);
        }}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          autoPlay
        />
      </Pressable>

      {showControls && (
        <View className="absolute left-0 right-0 top-0">
          <TopBar showBack={showBack} onBack={onBack} title={title} />
        </View>
      )}

      {showControls && (
        <View
          className="absolute left-0 right-0 bottom-0 p-3"
          style={{ zIndex: 1000 }}
        >
          <ControlsBar
            isPlaying={isPlaying}
            isLoading={isLoading}
            hasError={!!hasError}
            currentTimeLabel={fmt(currentTime)}
            durationLabel={fmt(duration)}
            progressPercent={
              duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
            }
            onSeekToFraction={onSeekToFraction}
            onSeekBack={() => onSeek(Math.max(0, currentTime - 15))}
            onSeekForward={() => onSeek(currentTime + 30)}
            onTogglePlay={onTogglePlay}
            onToggleMute={onToggleMute}
            isMuted={isMutedUi}
            audioLanguages={[]}
            selectedAudioLanguage={undefined}
            onCycleAudioLanguage={() => {}}
            subsDisabled={true}
            subtitleLabel="Off"
            onPressSubtitles={() => {}}
            hasSubtitles={false}
            audioFixEnabled={false}
            audioFixAvailable={false}
            onPressAudioFix={() => {}}
            onRetry={onRetry}
            onToggleFullscreen={onToggleFullscreen}
            isFullscreen={isFullscreen}
          />
        </View>
      )}
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color="#ffffff" />
        </View>
      )}
    </div>
  );
}

export default WebPlayer;
