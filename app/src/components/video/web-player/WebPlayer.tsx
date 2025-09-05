/* eslint-disable */
import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '@/lib/api-client';
import { View, Text, Pressable, ActivityIndicator } from '@/components/ui';
import { notify } from '@/lib';
import { TopBar } from './components/TopBar';
import { ControlsBar } from '@/components/video/web-player/components/ControlsBar';
import { FormatSupportIndicator } from './components/FormatSupportIndicator';
import { useFormatSupport } from './hooks/useFormatSupport';

let ShakaNS: any = null;

export type WebPlayerProps = {
  url: string;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  movieId?: string;
  tmdbId?: number;
  type?: 'movie' | 'series' | 'live';
  subtitleContent?: string;
  subtitleLanguage?: string;
  onSubtitleApplied?: (language: string) => void;
  externalOnPressSubtitles?: () => void;
  externalHasSubtitles?: boolean;
  onFormatInfoChange?: (formatInfo: any) => void;
  selectedMode?: 'none' | 'external' | 'embedded';
  selectedEmbeddedTrackIndex?: number;
  selectedEmbeddedLanguage?: string;
  // Watch-state callbacks (optional)
  startTime?: number;
  onPlaybackStart?: (currentTimeSec: number, durationSec?: number) => void;
  onProgress?: (currentTimeSec: number, durationSec?: number) => void;
  onPlaybackEnd?: (currentTimeSec: number, durationSec?: number) => void;
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
    subtitleContent,
    subtitleLanguage,
    onSubtitleApplied,
    externalOnPressSubtitles,
    externalHasSubtitles,
    selectedMode = 'none',
    selectedEmbeddedTrackIndex,
    selectedEmbeddedLanguage,
    startTime = 0,
    onPlaybackStart,
    onProgress,
    onPlaybackEnd,
  } = props;
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const playerRef = React.useRef<any>(null);
  const lastTimeEmitRef = React.useRef<number>(0);
  const createdObjectUrlsRef = React.useRef<string[]>([]);
  const autoplayTriedRef = React.useRef<boolean>(false);
  const pendingPlayRef = React.useRef<Promise<void> | null>(null);
  const audioCheckIntervalRef = React.useRef<any>(null);
  const rafIdRef = React.useRef<number | null>(null);
  const subtitleTrackRef = React.useRef<HTMLTrackElement | null>(null);
  const subtitleBlobUrlRef = React.useRef<string | null>(null);

  // Format support analysis
  const {
    formatInfo,
    isLoading: formatAnalysisLoading,
    error: formatError,
  } = useFormatSupport(url);

  // Notify parent component when format info changes
  React.useEffect(() => {
    if (formatInfo && props.onFormatInfoChange) {
      props.onFormatInfoChange(formatInfo);
    }
  }, [formatInfo, props.onFormatInfoChange]);

  // Convert SRT to VTT format
  const convertSRTtoVTT = React.useCallback((srtContent: string): string => {
    // Add VTT header
    let vttContent = 'WEBVTT\n\n';

    // Replace SRT timestamp format with VTT format
    // SRT: 00:00:20,000 --> 00:00:24,400
    // VTT: 00:00:20.000 --> 00:00:24.400
    const convertedContent = srtContent
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
      .replace(/^\d+$/gm, '') // Remove sequence numbers
      .replace(/\n\n\n+/g, '\n\n'); // Clean up extra newlines

    vttContent += convertedContent;
    return vttContent;
  }, []);

  // Function to apply subtitle content to video
  const applySubtitleContent = React.useCallback(
    (content: string, language: string) => {
      if (!videoRef.current) return;

      // Clean up existing subtitle track
      if (subtitleTrackRef.current) {
        videoRef.current.removeChild(subtitleTrackRef.current);
        subtitleTrackRef.current = null;
      }

      // Clean up existing blob URL
      if (subtitleBlobUrlRef.current) {
        URL.revokeObjectURL(subtitleBlobUrlRef.current);
        subtitleBlobUrlRef.current = null;
      }

      if (!content) return;

      try {
        // Convert SRT to VTT format if needed
        const vttContent = content.includes('WEBVTT')
          ? content
          : convertSRTtoVTT(content);

        // Create blob URL for subtitle content
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const blobUrl = URL.createObjectURL(blob);
        subtitleBlobUrlRef.current = blobUrl;

        // Create track element
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.src = blobUrl;
        track.srclang = language.toLowerCase();
        track.label = language.toUpperCase();
        track.default = true;

        // Add track to video
        videoRef.current.appendChild(track);
        subtitleTrackRef.current = track;

        // Enable the track
        track.addEventListener('load', () => {
          if (track.track) {
            track.track.mode = 'showing';
          }
        });

        console.log(`Applied subtitle track: ${language}`);
        onSubtitleApplied?.(language);
      } catch (error) {
        console.error('Failed to apply subtitle content:', error);
      }
    },
    [onSubtitleApplied, convertSRTtoVTT]
  );

  const clearExternalSubtitles = React.useCallback(() => {
    try {
      const video = videoRef.current;
      if (!video) return;
      if (subtitleTrackRef.current) {
        try {
          video.removeChild(subtitleTrackRef.current);
        } catch {}
        subtitleTrackRef.current = null;
      }
      if (subtitleBlobUrlRef.current) {
        try {
          URL.revokeObjectURL(subtitleBlobUrlRef.current);
        } catch {}
        subtitleBlobUrlRef.current = null;
      }
    } catch {}
  }, []);

  const disableAllEmbeddedTextTracks = React.useCallback(() => {
    try {
      const video = videoRef.current as any;
      if (!video) return;
      const nativeTracks: TextTrackList | undefined = video.textTracks;
      if (nativeTracks) {
        for (let i = 0; i < nativeTracks.length; i += 1) {
          try {
            (nativeTracks[i] as any).mode = 'disabled';
          } catch {}
        }
      }
      try {
        if (playerRef.current?.setTextTrackVisibility) {
          playerRef.current.setTextTrackVisibility(false);
        }
      } catch {}
    } catch {}
  }, []);

  const enableEmbeddedTrackByLanguage = React.useCallback(
    (language?: string) => {
      try {
        if (!language) return;
        // Try Shaka first
        if (playerRef.current) {
          try {
            if (playerRef.current.selectTextLanguage) {
              playerRef.current.selectTextLanguage(language);
              playerRef.current.setTextTrackVisibility?.(true);
              return;
            }
          } catch {}
        }
        // Fallback to HTML5 native tracks by language
        const video = videoRef.current as any;
        if (video && video.textTracks) {
          const list: any[] = Array.from(video.textTracks as any);
          let selected = false;
          list.forEach((t) => {
            if (
              !selected &&
              (t.language === language ||
                t.language === language?.toLowerCase())
            ) {
              try {
                t.mode = 'showing';
                selected = true;
              } catch {}
            } else {
              try {
                t.mode = 'disabled';
              } catch {}
            }
          });
        }
      } catch {}
    },
    []
  );

  const isActiveRef = React.useRef<boolean>(true);
  const setInactiveAndCleanup = React.useCallback(() => {
    isActiveRef.current = false;
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

  const SUBS_DISABLED = false; // Enable subtitle fetching/UI
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
        // Additional audio debugging info
        paused: v.paused,
        currentTime: v.currentTime,
        duration: v.duration,
        error: v.error,
        videoHeight: v.videoHeight,
        videoWidth: v.videoWidth,
        canPlayType_m3u8: v.canPlayType
          ? v.canPlayType('application/vnd.apple.mpegurl')
          : 'N/A',
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
        try {
          onProgress?.(nowSec, duration || video.duration || 0);
        } catch {}
      }
    };
    const onDuration = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      logVideoState('onPlay');
      try {
        onPlaybackStart?.(video.currentTime || 0, video.duration || duration);
      } catch {}

      // For live streams, ensure audio is enabled after playback starts
      if (type === 'live' && video.muted) {
        console.log(
          '[WebPlayer] Live stream playing but muted, attempting to unmute'
        );
        setTimeout(() => {
          try {
            video.muted = false;
            video.volume = 1.0;
            setIsMutedUi(false);
            console.log('[WebPlayer] Successfully unmuted live stream');
          } catch (e) {
            console.log('[WebPlayer] Failed to unmute live stream:', e);
          }
        }, 500);
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      logVideoState('onPause');
    };
    const onWaiting = () => {
      setIsLoading(true);
      logVideoState('onWaiting');
    };
    const onStalled = () => {
      setIsLoading(true);
      logVideoState('onStalled');
    };
    const onCanPlay = () => {
      setIsLoading(false);
      try {
        if (progressiveWatchdog) clearTimeout(progressiveWatchdog);
      } catch {}
      progressiveWatchdog = null;
      logVideoState('onCanPlay');
      const v = videoRef.current;
      if (!v || autoplayTriedRef.current) return;
      autoplayTriedRef.current = true;
      try {
        pendingPlayRef.current = (async () => {
          try {
            // For live streams, ensure audio is enabled
            if (type === 'live') {
              console.log(
                '[WebPlayer] Live stream detected, ensuring audio is enabled'
              );
              v.muted = false;
              v.volume = 1.0;
            } else {
              v.muted = false;
            }
            await v.play();
            console.log('[WebPlayer] Playback started with audio enabled');
          } catch (e) {
            console.log(
              '[WebPlayer] Failed to play with audio, trying muted:',
              e
            );
            try {
              v.muted = true;
              await v.play();
              // Try to unmute after playback starts for live streams
              if (type === 'live') {
                setTimeout(() => {
                  console.log(
                    '[WebPlayer] Attempting to unmute live stream after playback'
                  );
                  v.muted = false;
                  v.volume = 1.0;
                  setIsMutedUi(false);
                }, 100);
              }
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
      // Seek to provided start time if any
      try {
        if (startTime && startTime > 0) {
          video.currentTime = startTime;
        }
      } catch {}
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
        const isMpegTs = ext === 'ts';
        const canNativeHls =
          isHls &&
          typeof video.canPlayType === 'function' &&
          video.canPlayType('application/vnd.apple.mpegurl') !== '';

        // For .ts streams, use direct playback (no Shaka needed)
        const useShaka = isManifest && !(isHls && canNativeHls) && !isMpegTs;

        // Log stream type detection
        console.log('[WebPlayer] Stream type detection:', {
          url,
          ext,
          isManifest,
          isHls,
          isMpegTs,
          canNativeHls,
          useShaka,
          contentType: type,
        });

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

          // Add event listener for track changes
          player.addEventListener('adaptation', () => {
            console.log('[WebPlayer] Adaptation event - checking audio tracks');
            const tracks = player.getVariantTracks();
            if (tracks && tracks.length > 0) {
              const activeTrack = tracks.find((t: any) => t.active);
              if (activeTrack) {
                console.log('[WebPlayer] Active track:', {
                  audioCodec: activeTrack.audioCodec,
                  audioChannelsCount: activeTrack.audioChannelsCount,
                  audioSamplingRate: activeTrack.audioSamplingRate,
                  audioLanguage: activeTrack.audioLanguage,
                });
              }
            }
          });

          // Listen for loaded event to check audio
          player.addEventListener('loaded', () => {
            console.log('[WebPlayer] Shaka loaded event');
            const audioTracks = player.getAudioTracks();
            const variantTracks = player.getVariantTracks();
            console.log('[WebPlayer] Available audio after load:', {
              audioTracks,
              variantTracks,
              audioTrackCount: audioTracks?.length,
              variantTrackCount: variantTracks?.length,
            });
          });
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
          ext === 'mkv' ||
          ext === 'ts'; // Added .ts as progressive format
        console.log('[WebPlayer] init', {
          url,
          ext,
          isManifest,
          isProgressive,
          isMpegTs,
        });

        if (useShaka && player) {
          // Configure Shaka for better audio handling
          if (type === 'live') {
            try {
              player.configure({
                streaming: {
                  rebufferingGoal: 2,
                  bufferingGoal: 10,
                  autoLowLatencyMode: false,
                },
                manifest: {
                  defaultPresentationDelay: 10,
                  hls: {
                    ignoreTextStreamFailures: true,
                    useFullSegmentsForStartTime: true,
                  },
                },
                // Ensure all audio tracks are enabled
                preferredAudioLanguage: 'und', // 'und' for undefined/any language
                restrictions: {
                  minPixels: 0,
                  maxPixels: Infinity,
                  minFrameRate: 0,
                  maxFrameRate: Infinity,
                  minBandwidth: 0,
                  maxBandwidth: Infinity,
                },
              });

              // Set up audio configuration
              player.configure({
                mediaSource: {
                  forceTransmux: true, // Force transmuxing for better compatibility
                },
              });
            } catch (e) {
              console.log('[WebPlayer] Shaka config error:', e);
            }
          }
          await player.load(url);

          // After loading, ensure audio is enabled for live streams
          if (type === 'live') {
            console.log('[WebPlayer] Checking audio configuration after load');
            const config = player.getConfiguration();
            console.log('[WebPlayer] Shaka configuration:', config);

            // Get all available tracks
            const variantTracks = player.getVariantTracks();
            const audioTracks = player.getAudioTracks();

            if (variantTracks && variantTracks.length > 0) {
              // Find a track with audio
              const trackWithAudio = variantTracks.find(
                (t: any) => t.audioCodec
              );
              if (trackWithAudio && !trackWithAudio.active) {
                console.log(
                  '[WebPlayer] Selecting track with audio:',
                  trackWithAudio
                );
                player.selectVariantTrack(trackWithAudio);
              }
            }

            // Ensure player is not muted - try multiple times
            if (video) {
              // Immediately unmute
              video.muted = false;
              video.volume = 1.0;
              console.log(
                '[WebPlayer] Ensured video is unmuted after Shaka load'
              );

              // Try again after a short delay
              setTimeout(() => {
                if (video && video.muted) {
                  console.log('[WebPlayer] Video still muted, forcing unmute');
                  video.muted = false;
                  video.volume = 1.0;
                  setIsMutedUi(false);
                }
              }, 100);

              // And once more after playback likely started
              setTimeout(() => {
                if (video) {
                  video.muted = false;
                  video.volume = 1.0;
                  setIsMutedUi(false);
                  console.log('[WebPlayer] Final unmute attempt');
                  logVideoState('After final unmute');
                }
              }, 1000);
            }
          }
        } else {
          while (video.firstChild) video.removeChild(video.firstChild);
          try {
            /* video.crossOrigin = undefined as any; */
          } catch {}
          try {
            (video as any).preload = 'auto';
            // For live streams, ensure audio codec support
            if (type === 'live') {
              (video as any).crossOrigin = 'anonymous';
            }
          } catch {}
          (video as HTMLVideoElement).src = url;
          logVideoState('after set src and load');
          rafIdRef.current = requestAnimationFrame(() => {
            try {
              // For live streams and MPEG-TS, try to play with audio first
              if (type === 'live' || ext === 'ts') {
                console.log(
                  '[WebPlayer] Live/TS stream - attempting playback with audio'
                );
                (video as any).muted = false;
                (video as any).volume = 1.0;
                // Set crossOrigin for better compatibility
                (video as any).crossOrigin = 'anonymous';
              } else {
                (video as any).muted = true;
              }
              void (video as HTMLVideoElement).play().catch((e) => {
                console.log('[WebPlayer] Initial play failed:', e);
                // Fallback to muted if unmuted playback fails
                if (type === 'live' || ext === 'ts') {
                  console.log('[WebPlayer] Falling back to muted playback');
                  (video as any).muted = true;
                  void (video as HTMLVideoElement).play().then(() => {
                    // Try to unmute after playback starts
                    setTimeout(() => {
                      console.log(
                        '[WebPlayer] Attempting to unmute after playback started'
                      );
                      (video as any).muted = false;
                      (video as any).volume = 1.0;
                      setIsMutedUi(false);
                    }, 500);
                  });
                }
              });
            } catch {}
          });
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
            const audioTracks = player.getAudioTracks?.() || [];
            console.log('[WebPlayer] Audio tracks info:', {
              variants,
              audioTracks,
              variantCount: variants.length,
              audioTrackCount: audioTracks.length,
            });

            // Check if audio is available
            if (variants.length > 0) {
              const firstVariant = variants[0];
              console.log('[WebPlayer] First variant details:', {
                audioId: firstVariant.audioId,
                audioCodec: firstVariant.audioCodec,
                audioLanguage: firstVariant.audioLanguage,
                audioRoles: firstVariant.audioRoles,
                audioChannelsCount: firstVariant.audioChannelsCount,
                audioSamplingRate: firstVariant.audioSamplingRate,
              });

              // Try to select the first audio track explicitly
              if (firstVariant.audioId) {
                try {
                  player.selectAudioLanguage(
                    firstVariant.audioLanguage || 'und'
                  );
                  console.log(
                    '[WebPlayer] Selected audio language:',
                    firstVariant.audioLanguage || 'und'
                  );
                } catch (e) {
                  console.log(
                    '[WebPlayer] Failed to select audio language:',
                    e
                  );
                }
              }
            }

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
        } catch (e) {
          console.log('[WebPlayer] Error getting audio tracks:', e);
        }

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
        onPlaybackEnd?.(video.currentTime || 0, video.duration || duration);
      } catch {}
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
        if (subtitleBlobUrlRef.current) {
          URL.revokeObjectURL(subtitleBlobUrlRef.current);
          subtitleBlobUrlRef.current = null;
        }
      } catch {}
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

      // For live streams with Shaka, ensure we handle audio properly
      if (type === 'live' && playerRef.current) {
        // Resume audio context if needed (for browser autoplay policies)
        if (typeof window !== 'undefined' && (window as any).AudioContext) {
          const audioContext = new ((window as any).AudioContext ||
            (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              console.log('[WebPlayer] Audio context resumed');
            });
          }
        }
      }

      v.muted = !v.muted;
      if (!v.muted && v.volume === 0) v.volume = 1;
      setIsMutedUi(!!v.muted || (v.volume ?? 0) === 0);
      console.log('[WebPlayer] Toggled mute:', {
        muted: v.muted,
        volume: v.volume,
      });
      logVideoState('After toggle mute');
    } catch {}
  }, [logVideoState, type]);

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
    if (externalOnPressSubtitles) {
      externalOnPressSubtitles();
    } else {
      // Existing implementation defers fetching until enabled; keep placeholder hook point.
      // Currently subtitles UI is disabled via SUBS_DISABLED.
    }
  }, [externalOnPressSubtitles]);

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

  // React to selection mode changes and apply/clear subtitles accordingly
  React.useEffect(() => {
    if (selectedMode === 'external') {
      // External: clear embedded visibility and apply external content
      disableAllEmbeddedTextTracks();
      if (subtitleContent && subtitleLanguage) {
        applySubtitleContent(subtitleContent, subtitleLanguage);
      }
    } else if (selectedMode === 'embedded') {
      // Embedded: clear external track and enable embedded by language
      clearExternalSubtitles();
      if (selectedEmbeddedLanguage) {
        enableEmbeddedTrackByLanguage(selectedEmbeddedLanguage);
      }
    } else {
      // None: clear both external and embedded
      clearExternalSubtitles();
      disableAllEmbeddedTextTracks();
    }
  }, [
    selectedMode,
    subtitleContent,
    subtitleLanguage,
    selectedEmbeddedLanguage,
    applySubtitleContent,
    clearExternalSubtitles,
    disableAllEmbeddedTextTracks,
    enableEmbeddedTrackByLanguage,
  ]);

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
          // On any user interaction with live streams, ensure audio is enabled
          if (type === 'live' && videoRef.current && videoRef.current.muted) {
            console.log(
              '[WebPlayer] User interaction detected, enabling audio'
            );
            videoRef.current.muted = false;
            videoRef.current.volume = 1.0;
            setIsMutedUi(false);

            // Resume audio context if needed
            if (typeof window !== 'undefined' && (window as any).AudioContext) {
              const audioContext = new ((window as any).AudioContext ||
                (window as any).webkitAudioContext)();
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  console.log(
                    '[WebPlayer] Audio context resumed via user interaction'
                  );
                });
              }
            }
          }
        }}
      >
        <video
          key={url}
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          autoPlay
          muted={type !== 'live'} // Don't mute live streams by default
          preload="auto"
        />
      </Pressable>

      {showControls && (
        <View className="absolute left-0 right-0 top-0">
          <TopBar showBack={showBack} onBack={onBack} title={title} />

          {/* Format Support Indicator */}
          {formatInfo && (
            <FormatSupportIndicator
              formatInfo={formatInfo}
              onTrackSelect={(type, trackIndex) => {
                if (type === 'subtitle') {
                  // Handle subtitle track selection
                  console.log('Selected subtitle track:', trackIndex);
                } else if (type === 'audio') {
                  // Handle audio track selection
                  console.log('Selected audio track:', trackIndex);
                }
              }}
            />
          )}
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
            audioLanguages={audioLanguages}
            selectedAudioLanguage={selectedAudioLang}
            onCycleAudioLanguage={onCycleAudioLanguage}
            subsDisabled={SUBS_DISABLED}
            subtitleLabel={subtitleLabel}
            onPressSubtitles={onPressSubtitles}
            hasSubtitles={externalHasSubtitles || subtitleTracks.length > 0}
            audioFixEnabled={AUDIO_FIX_ENABLED}
            audioFixAvailable={audioFixAvailable}
            onPressAudioFix={onPressAudioFix}
            onRetry={onRetry}
            onToggleFullscreen={onToggleFullscreen}
            isFullscreen={isFullscreen}
            // Format support props
            formatInfo={formatInfo}
            onPressAudioTracks={() => {
              // TODO: Show audio track modal
              console.log('Show audio track selection');
            }}
            hasMultipleAudioTracks={formatInfo?.hasMultipleAudioTracks}
            hasEmbeddedSubtitles={formatInfo?.hasEmbeddedSubtitles}
          />
          {null}
        </View>
      )}
      {isLoading ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : null}

      {/* Audio muted indicator for live streams */}
      {type === 'live' && isMutedUi && isPlaying && !isLoading && (
        <Pressable
          className="absolute top-20 left-4 bg-red-600 px-3 py-2 rounded-lg flex-row items-center"
          onPress={onToggleMute}
        >
          <Text className="text-white font-semibold">
            🔇 Audio Muted - Tap to unmute
          </Text>
        </Pressable>
      )}
    </div>
  );
}

export default WebPlayer;
