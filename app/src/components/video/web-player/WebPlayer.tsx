/* eslint-disable */
import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '@/lib/api-client';
import { View, Text, Pressable, ActivityIndicator } from '@/components/ui';
import { notify } from '@/lib';
import { TopBar } from './components/TopBar';
import { ControlsBar } from '@/components/video/web-player/components/ControlsBar';

let ShakaNS: any = null;
const STARTUP_PLAY_TIMEOUT_MS = 3500;
const STALL_RECOVERY_TIMEOUT_MS = 2500;
const MAX_SOFT_RELOAD_ATTEMPTS = 2;

export type WebPlayerProps = {
  url: string;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  movieId?: string;
  tmdbId?: number;
  type?: 'movie' | 'series' | 'live';
  disableAutoReload?: boolean;
};

export function WebPlayer(props: WebPlayerProps) {
  const {
    url,
    title,
    showBack,
    onBack,
    movieId,
    tmdbId,
    type,
    disableAutoReload = false,
  } = props;
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const playerRef = React.useRef<any>(null);
  const progressiveFallbackTriedRef = React.useRef<boolean>(false);
  const progressiveAlternateTriedRef = React.useRef<boolean>(false);
  const progressiveRetryCountRef = React.useRef<number>(0);
  const stalledReloadTimerRef = React.useRef<any>(null);
  const hasTriedRouteReloadRef = React.useRef<boolean>(false);
  const recoveryTimerRef = React.useRef<any>(null);
  const startupTimerRef = React.useRef<any>(null);
  const lastTimeEmitRef = React.useRef<number>(0);
  const waitingReloadTimerRef = React.useRef<any>(null);
  const lastProgressMsRef = React.useRef<number>(0);
  const softReloadAttemptsRef = React.useRef<number>(0);
  const createdObjectUrlsRef = React.useRef<string[]>([]);
  const autoplayTriedRef = React.useRef<boolean>(false);
  const pendingPlayRef = React.useRef<Promise<void> | null>(null);
  const audioCheckIntervalRef = React.useRef<any>(null);
  const rafIdRef = React.useRef<number | null>(null);

  const isActiveRef = React.useRef<boolean>(true);
  const setInactiveAndCleanup = React.useCallback(() => {
    isActiveRef.current = false;
    try {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    } catch {}
    try {
      if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
    } catch {}
    try {
      if (stalledReloadTimerRef.current)
        clearTimeout(stalledReloadTimerRef.current);
    } catch {}
    try {
      if (waitingReloadTimerRef.current)
        clearTimeout(waitingReloadTimerRef.current);
    } catch {}
    try {
      if (audioCheckIntervalRef.current) {
        clearInterval(audioCheckIntervalRef.current);
        audioCheckIntervalRef.current = null;
      }
    } catch {}
    try {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    } catch {}
    try {
      playerRef.current?.destroy?.();
    } catch {}
  }, []);

  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (hasError) {
      try {
        notify.error(hasError);
      } catch {}
    }
  }, [hasError]);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [showControls, setShowControls] = React.useState(true);

  const [audioLanguages, setAudioLanguages] = React.useState<string[]>([]);
  const [selectedAudioLang, setSelectedAudioLang] = React.useState<
    string | undefined
  >(undefined);
  const [isMutedUi, setIsMutedUi] = React.useState<boolean>(false);

  const [subtitleTracks, setSubtitleTracks] = React.useState<any[]>([]);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = React.useState<
    number | undefined
  >(undefined);

  const SUBS_DISABLED = true; // Temporarily disable subtitle fetching/UI per request
  const AUDIO_FIX_ENABLED = false; // Hide MP4 fallback button by default

  useFocusEffect(
    React.useCallback(() => {
      isActiveRef.current = true;
      return () => {
        setInactiveAndCleanup();
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
    }, [setInactiveAndCleanup])
  );

  const logVideoState = React.useCallback((label: string) => {
    const v = videoRef.current as any;
    if (!v) return;
    try {
      console.log('[WebPlayer]', label, {
        src: v.src,
        currentSrc: v.currentSrc,
        readyState: v.readyState,
        networkState: v.networkState,
        muted: v.muted,
        volume: v.volume,
        audioTracks: v.audioTracks ? v.audioTracks.length : undefined,
        webkitAudioDecodedByteCount: v.webkitAudioDecodedByteCount,
        mozHasAudio: v.mozHasAudio,
      });
    } catch {}
  }, []);

  React.useEffect(() => {
    autoplayTriedRef.current = false;
    pendingPlayRef.current = null;
    const video = videoRef.current as HTMLVideoElement | null;
    if (!video) return;

    let cancelled = false;
    let player: any;
    let progressiveWatchdog: any;

    const onTime = () => {
      const nowSec = video.currentTime || 0;
      const last = lastTimeEmitRef.current || 0;
      if (Math.abs(nowSec - last) >= 0.25 || nowSec < last) {
        lastTimeEmitRef.current = nowSec;
        setCurrentTime(nowSec);
      }
      try {
        lastProgressMsRef.current = Date.now();
        if (stalledReloadTimerRef.current)
          clearTimeout(stalledReloadTimerRef.current);
        if (waitingReloadTimerRef.current)
          clearTimeout(waitingReloadTimerRef.current);
      } catch {}
    };
    const onDuration = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      logVideoState('onPlay');
    };
    const onPause = () => {
      setIsPlaying(false);
      logVideoState('onPause');
    };
    const onWaiting = () => {
      setIsLoading(true);
      logVideoState('onWaiting');

      // Skip auto-reload logic if disabled
      if (disableAutoReload) return;

      try {
        if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      } catch {}
      recoveryTimerRef.current = setTimeout(() => {
        if (!isActiveRef.current) return;
        const since = Date.now() - (lastProgressMsRef.current || 0);
        if (since < STALL_RECOVERY_TIMEOUT_MS) return;
        if (softReloadAttemptsRef.current < MAX_SOFT_RELOAD_ATTEMPTS) {
          softReloadAttemptsRef.current += 1;
          try {
            const v = videoRef.current;
            if (v) {
              // Store current playback position before reload
              const currentTime = v.currentTime || 0;
              try {
                v.pause();
              } catch {}
              try {
                v.removeAttribute('src');
                v.load();
              } catch {}
              try {
                (v as HTMLVideoElement).src = url;
                (v as any).preload = 'auto';
              } catch {}
              try {
                (v as any).muted = true;
                // Restore playback position after reload
                v.currentTime = currentTime;
                void v.play();
              } catch {}
              lastProgressMsRef.current = Date.now();
            }
          } catch {}
          return;
        }
        if (!hasTriedRouteReloadRef.current) {
          hasTriedRouteReloadRef.current = true;
          try {
            if (isActiveRef.current && typeof window !== 'undefined')
              window.location.reload();
          } catch {}
        }
      }, STALL_RECOVERY_TIMEOUT_MS);
    };
    const onStalled = () => {
      setIsLoading(true);
      logVideoState('onStalled');

      // Skip auto-reload logic if disabled
      if (disableAutoReload) return;

      try {
        if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      } catch {}
      recoveryTimerRef.current = setTimeout(() => {
        if (!isActiveRef.current) return;
        const since = Date.now() - (lastProgressMsRef.current || 0);
        if (since < STALL_RECOVERY_TIMEOUT_MS) return;
        if (softReloadAttemptsRef.current < MAX_SOFT_RELOAD_ATTEMPTS) {
          softReloadAttemptsRef.current += 1;
          try {
            const v = videoRef.current;
            if (v) {
              // Store current playback position before reload
              const currentTime = v.currentTime || 0;
              try {
                v.pause();
              } catch {}
              try {
                v.removeAttribute('src');
                v.load();
              } catch {}
              try {
                (v as HTMLVideoElement).src = url;
                (v as any).preload = 'auto';
              } catch {}
              try {
                (v as any).muted = true;
                // Restore playback position after reload
                v.currentTime = currentTime;
                void v.play();
              } catch {}
              lastProgressMsRef.current = Date.now();
            }
          } catch {}
          return;
        }
        if (!hasTriedRouteReloadRef.current) {
          hasTriedRouteReloadRef.current = true;
          try {
            if (isActiveRef.current && typeof window !== 'undefined')
              window.location.reload();
          } catch {}
        }
      }, STALL_RECOVERY_TIMEOUT_MS);
    };
    const onCanPlay = () => {
      setIsLoading(false);
      try {
        if (progressiveWatchdog) clearTimeout(progressiveWatchdog);
      } catch {}
      try {
        if (stalledReloadTimerRef.current)
          clearTimeout(stalledReloadTimerRef.current);
      } catch {}
      try {
        if (waitingReloadTimerRef.current)
          clearTimeout(waitingReloadTimerRef.current);
      } catch {}
      progressiveWatchdog = null;
      logVideoState('onCanPlay');
      const v = videoRef.current;
      if (!v || autoplayTriedRef.current) return;
      autoplayTriedRef.current = true;
      try {
        pendingPlayRef.current = (async () => {
          try {
            v.muted = false;
            await v.play();
          } catch {
            try {
              v.muted = true;
              await v.play();
            } catch {}
          }
        })();
      } catch {}
    };
    const onVolumeChange = () => {
      try {
        const v = videoRef.current;
        if (!v) return;
        setIsMutedUi(!!v.muted || (v.volume ?? 0) === 0);
      } catch {}
    };
    const onVideoError = () => {
      console.warn('[WebPlayer] onError event');
      logVideoState('onError');
      const videoEl = videoRef.current;
      if (!videoEl) {
        setHasError('Playback error');
        return;
      }
      setHasError('Playback error');
    };
    const onLoadedMeta = () => {
      logVideoState('onLoadedMetadata');
    };
    const onVisibility = () => {
      try {
        if (document.visibilityState === 'hidden') {
          video.pause();
        }
      } catch {}
    };

    const init = async () => {
      try {
        const urlPath = (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return url.split('?')[0];
          }
        })();
        const ext = (urlPath.split('.').pop() || '').toLowerCase();
        const isManifest = ext === 'm3u8' || ext === 'mpd';
        const isHls = ext === 'm3u8';
        const canNativeHls =
          isHls &&
          typeof video.canPlayType === 'function' &&
          video.canPlayType('application/vnd.apple.mpegurl') !== '';
        const useShaka = isManifest && !(isHls && canNativeHls);

        if (useShaka) {
          if (!ShakaNS) {
            const mod = (await import('shaka-player')) as any;
            const candidate = mod?.default ?? mod;
            ShakaNS =
              candidate && candidate.Player
                ? candidate
                : (globalThis as any).shaka;
          }
          if (cancelled || !videoRef.current) return;
          if (!ShakaNS || !ShakaNS.Player) {
            ShakaNS = (globalThis as any).shaka;
          }
          if (!ShakaNS || !ShakaNS.Player) {
            throw new Error('Shaka Player class not found');
          }
          player = new ShakaNS.Player();
          await player.attach(video);
          playerRef.current = player;
          const onError = (e: any) => {
            const message = e?.message || e?.code || 'Playback error';
            setHasError(String(message));
            setIsLoading(false);
          };
          player.addEventListener('error', onError as any);
        }

        video.addEventListener('timeupdate', onTime);
        video.addEventListener('durationchange', onDuration);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('stalled', onStalled);
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onVideoError as any);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('loadedmetadata', onLoadedMeta);
        document.addEventListener('visibilitychange', onVisibility);

        setIsLoading(true);
        try {
          setIsMutedUi(!!video.muted || (video.volume ?? 0) === 0);
        } catch {}

        const isProgressive =
          ext === 'mp4' ||
          ext === 'webm' ||
          ext === 'mov' ||
          ext === 'm4v' ||
          ext === 'mkv';
        console.log('[WebPlayer] init', {
          url,
          ext,
          isManifest,
          isProgressive,
        });

        if (useShaka && player) {
          await player.load(url);
        } else {
          while (video.firstChild) video.removeChild(video.firstChild);
          try {
            /* video.crossOrigin = undefined as any; */
          } catch {}
          try {
            (video as any).preload = 'auto';
          } catch {}
          (video as HTMLVideoElement).src = url;
          progressiveFallbackTriedRef.current = false;
          progressiveRetryCountRef.current = 0;
          progressiveAlternateTriedRef.current = false;
          logVideoState('after set src and load');
          rafIdRef.current = requestAnimationFrame(() => {
            try {
              (video as any).muted = true;
              void (video as HTMLVideoElement).play();
            } catch {}
          });
          try {
            if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
          } catch {}
          startupTimerRef.current = setTimeout(() => {
            if (!isActiveRef.current) return;

            // Skip auto-reload logic if disabled
            if (disableAutoReload) return;

            const since = Date.now() - (lastProgressMsRef.current || 0);
            if (since >= STARTUP_PLAY_TIMEOUT_MS) {
              if (softReloadAttemptsRef.current < MAX_SOFT_RELOAD_ATTEMPTS) {
                softReloadAttemptsRef.current += 1;
                try {
                  const v = videoRef.current;
                  if (v) {
                    // Store current playback position before reload
                    const currentTime = v.currentTime || 0;
                    try {
                      v.pause();
                    } catch {}
                    try {
                      v.removeAttribute('src');
                      v.load();
                    } catch {}
                    try {
                      (v as HTMLVideoElement).src = url;
                      (v as any).preload = 'auto';
                    } catch {}
                    try {
                      (v as any).muted = true;
                      // Restore playback position after reload
                      v.currentTime = currentTime;
                      void v.play();
                    } catch {}
                    lastProgressMsRef.current = Date.now();
                  }
                } catch {}
              }
            }
          }, STARTUP_PLAY_TIMEOUT_MS);
          try {
            if (audioCheckIntervalRef.current) {
              clearInterval(audioCheckIntervalRef.current);
              audioCheckIntervalRef.current = null;
            }
          } catch {}
        }

        try {
          if (player && isManifest) {
            const variants = player.getVariantTracks?.() || [];
            const langs = Array.from(
              new Set(
                (variants as any[]).map((v) => v.audioLanguage).filter(Boolean)
              )
            );
            setAudioLanguages(langs);
            setSelectedAudioLang(langs[0]);
          } else {
            setAudioLanguages([]);
            setSelectedAudioLang(undefined);
          }
        } catch {}

        try {
          if (player && isManifest) {
            const shakaTracks = player.getTextTracks?.() || [];
            const nativeTracks = Array.from(video.textTracks || ([] as any));
            const tracks = shakaTracks.length > 0 ? shakaTracks : nativeTracks;
            setSubtitleTracks(tracks as any);
            if (shakaTracks.length > 0) player.setTextTrackVisibility(true);
          } else {
            const nativeTracks = Array.from(video.textTracks || ([] as any));
            setSubtitleTracks(nativeTracks as any);
          }
        } catch {}
      } catch (e: any) {
        const message = e?.message || e?.code || 'Playback error';
        setHasError(String(message));
        setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      try {
        document.removeEventListener('visibilitychange', onVisibility);
      } catch {}
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      try {
        video.removeEventListener('stalled', onStalled);
      } catch {}
      video.removeEventListener('canplay', onCanPlay);
      try {
        if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      } catch {}
      try {
        player?.destroy?.();
      } catch {}
      playerRef.current = null;
      try {
        createdObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      } catch {}
      createdObjectUrlsRef.current = [];
      try {
        video.removeEventListener('error', onVideoError as any);
      } catch {}
      try {
        video.removeEventListener('volumechange', onVolumeChange);
      } catch {}
      try {
        video.removeEventListener('loadedmetadata', onLoadedMeta);
      } catch {}
      try {
        if (stalledReloadTimerRef.current)
          clearTimeout(stalledReloadTimerRef.current);
      } catch {}
      try {
        if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      } catch {}
      try {
        if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
      } catch {}
      try {
        if (audioCheckIntervalRef.current) {
          clearInterval(audioCheckIntervalRef.current);
          audioCheckIntervalRef.current = null;
        }
      } catch {}
      try {
        video.pause();
      } catch {}
      try {
        (video as any).src = '';
        while (video.firstChild) video.removeChild(video.firstChild);
        video.removeAttribute('src');
        video.load();
      } catch {}
    };
  }, [url]);

  React.useEffect(() => {
    console.log('url', url);
    softReloadAttemptsRef.current = 0;
  }, [url]);

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

  const onCycleAudioLanguage = React.useCallback(() => {
    if (!playerRef.current || audioLanguages.length === 0) return;
    const currentIdx = Math.max(
      0,
      audioLanguages.findIndex((l) => l === selectedAudioLang)
    );
    const nextIdx = (currentIdx + 1) % audioLanguages.length;
    const nextLang = audioLanguages[nextIdx];
    try {
      playerRef.current.selectAudioLanguage(nextLang);
      setSelectedAudioLang(nextLang);
    } catch {}
  }, [audioLanguages, selectedAudioLang]);

  const subtitleLabel =
    selectedSubtitleIndex !== undefined
      ? subtitleTracks[selectedSubtitleIndex]?.language || 'On'
      : 'Off';

  const onPressSubtitles = React.useCallback(async () => {
    // Existing implementation defers fetching until enabled; keep placeholder hook point.
    // Currently subtitles UI is disabled via SUBS_DISABLED.
  }, []);

  const audioFixAvailable = false; // computed inline in previous version
  const onPressAudioFix = React.useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;
      try {
        v.pause();
      } catch {}
      const newUrl = url.replace(/\.mkv(\?.*)?$/i, '.mp4$1');
      (v as HTMLVideoElement).src = newUrl;
      try {
        v.muted = false;
        v.volume = Math.max(0.0, Math.min(1.0, v.volume || 1));
      } catch {}
      v.load();
      void v.play().catch(() => {});
    } catch {}
  }, [url]);

  const onRetry = React.useCallback(() => {
    setHasError(null);
    try {
      videoRef.current?.load();
      videoRef.current?.play();
    } catch {}
  }, []);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const onToggleFullscreen = React.useCallback(() => {
    const el = videoRef.current as any;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        (
          el.requestFullscreen ||
          el.webkitRequestFullscreen ||
          el.msRequestFullscreen
        )?.call(el);
        setIsFullscreen(true);
      } else {
        (
          document.exitFullscreen ||
          (document as any).webkitExitFullscreen ||
          (document as any).msExitFullscreen
        )?.call(document);
        setIsFullscreen(false);
      }
    } catch {}
  }, []);

  return (
    <View className="flex-1 bg-black">
      <Pressable className="flex-1" onPress={() => setShowControls((v) => !v)}>
        <video
          key={url}
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          autoPlay
          muted
          preload="auto"
        />
      </Pressable>

      {showControls && (
        <View className="absolute left-0 right-0 top-0">
          <TopBar showBack={showBack} onBack={onBack} title={title} />
        </View>
      )}

      {showControls && (
        <View className="absolute left-0 right-0 bottom-0 p-3">
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
            audioLanguages={audioLanguages}
            selectedAudioLanguage={selectedAudioLang}
            onCycleAudioLanguage={onCycleAudioLanguage}
            subsDisabled={SUBS_DISABLED}
            subtitleLabel={subtitleLabel}
            onPressSubtitles={onPressSubtitles}
            hasSubtitles={subtitleTracks.length > 0}
            audioFixEnabled={AUDIO_FIX_ENABLED}
            audioFixAvailable={audioFixAvailable}
            onPressAudioFix={onPressAudioFix}
            onRetry={onRetry}
            onToggleFullscreen={onToggleFullscreen}
            isFullscreen={isFullscreen}
          />
          {null}
        </View>
      )}
      {isLoading ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

export default WebPlayer;
