/* eslint-disable */
import React from 'react';
import apiClient from '@/lib/api-client';
import { View, Text, Pressable } from '@/components/ui';
// Lazy-load Shaka at runtime to avoid type/module issues
let ShakaNS: any = null;

type Props = {
  url: string;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  movieId?: string;
  tmdbId?: number;
  type?: 'movie' | 'series' | 'live';
};

// Minimal web-only Shaka wrapper that uses the same simple controls as other players
export function WebPlayerView(props: Props) {
  const { url, title, showBack, onBack, movieId, tmdbId, type } = props;
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const playerRef = React.useRef<any>(null);
  const progressiveFallbackTriedRef = React.useRef<boolean>(false);

  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [showControls, setShowControls] = React.useState(true);
  const [audioIssue, setAudioIssue] = React.useState<null | 'no-audio'>(null);

  const [audioLanguages, setAudioLanguages] = React.useState<string[]>([]);
  const [selectedAudioLang, setSelectedAudioLang] = React.useState<
    string | undefined
  >(undefined);
  const [isMutedUi, setIsMutedUi] = React.useState<boolean>(false);

  const [subtitleTracks, setSubtitleTracks] = React.useState<any[]>([]);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = React.useState<
    number | undefined
  >(undefined);

  // Extra subtitle sources (original embedded via server extraction, and external DB)
  const [originalTracks, setOriginalTracks] = React.useState<
    Array<{
      id: string;
      language_code: string;
      language_name: string;
      trackIndex: number;
    }>
  >([]);
  const [dbLanguages, setDbLanguages] = React.useState<
    Array<{ code: string; name: string; count?: number }>
  >([]);
  const createdObjectUrlsRef = React.useRef<string[]>([]);
  const autoplayTriedRef = React.useRef<boolean>(false);
  const pendingPlayRef = React.useRef<Promise<void> | null>(null);
  const SUBS_DISABLED = true; // Temporarily disable subtitle fetching/UI per request
  const AUDIO_FIX_ENABLED = false; // Hide MP4 fallback button by default (provider often doesn't serve MP4)

  // Debug logging helpers
  const logVideoState = React.useCallback((label: string) => {
    const v = videoRef.current as any;
    if (!v) return;
    try {
      // Avoid logging giant objects; pick key fields
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
    const video = videoRef.current as HTMLVideoElement | null;
    if (!video) return;

    let cancelled = false;
    let player: any;
    let progressiveWatchdog: any;

    const onTime = () => setCurrentTime(video.currentTime || 0);
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
    };
    const onCanPlay = () => {
      setIsLoading(false);
      try {
        if (progressiveWatchdog) clearTimeout(progressiveWatchdog);
      } catch {}
      progressiveWatchdog = null;
      logVideoState('onCanPlay');
      // Attempt autoplay exactly once on first canplay to avoid AbortError
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

    const init = async () => {
      try {
        // Decide playback mode based on URL extension
        const urlPath = (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return url.split('?')[0];
          }
        })();
        const ext = (urlPath.split('.').pop() || '').toLowerCase();
        const isManifest = ext === 'm3u8' || ext === 'mpd';

        if (isManifest) {
          if (!ShakaNS) {
            // Use a literal dynamic import so the bundler includes the module
            // @ts-ignore - types not needed for runtime import
            const mod = (await import('shaka-player')) as any;
            const candidate = mod?.default ?? mod;
            // Prefer namespace with Player; otherwise fallback to window.shaka
            ShakaNS =
              candidate && candidate.Player
                ? candidate
                : (globalThis as any).shaka;
          }
          if (cancelled || !videoRef.current) return;

          if (!ShakaNS || !ShakaNS.Player) {
            // Try global window.shaka as last resort
            ShakaNS = (globalThis as any).shaka;
          }
          if (!ShakaNS || !ShakaNS.Player) {
            throw new Error('Shaka Player class not found');
          }

          // Shaka: initialize without mediaElement, then attach (avoids deprecation in v4.15+)
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
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('error', onVideoError as any);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('loadedmetadata', onLoadedMeta);

        setIsLoading(true);
        // Initialize mute UI state
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

        if (isManifest && player) {
          await player.load(url);
        } else {
          // Minimal progressive playback: set src directly, no type hints, no crossOrigin
          while (video.firstChild) video.removeChild(video.firstChild);
          try {
            // Avoid setting crossOrigin; some IPTV servers fail CORS with it
            // video.crossOrigin = undefined as any;
          } catch {}
          try {
            (video as any).preload = 'auto';
          } catch {}
          (video as HTMLVideoElement).src = url;
          progressiveFallbackTriedRef.current = false;
          video.load();
          logVideoState('after set src and load');
          // Watch for lack of audio decode (common for E-AC-3 in browsers)
          try {
            setAudioIssue(null);
            const v = video;
            let checks = 0;
            const maxChecks = 10; // ~5s at 500ms
            const timer = setInterval(() => {
              if (!v) {
                clearInterval(timer);
                return;
              }
              checks += 1;
              const decoded = (v as any).webkitAudioDecodedByteCount || 0;
              const muted = !!v.muted;
              const vol = v.volume ?? 1;
              if (decoded > 0) {
                clearInterval(timer);
                return;
              }
              if (checks >= maxChecks && !muted && vol > 0) {
                clearInterval(timer);
                setAudioIssue('no-audio');
              }
            }, 500);
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

        // Defer subtitle discovery and loading until user requests via UI to avoid
        // interfering with initial playback and causing buffering

        // Autoplay is handled on canplay to prevent AbortError
      } catch (e: any) {
        const message = e?.message || e?.code || 'Playback error';
        setHasError(String(message));
        setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      try {
        player?.destroy?.();
      } catch {}
      playerRef.current = null;
      // Revoke any created object URLs
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
        if (progressiveWatchdog) clearTimeout(progressiveWatchdog);
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

  const fmt = (s: number) => {
    const sec = Math.max(0, Math.floor(s));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const sc = sec % 60;
    const mm = m < 10 ? `0${m}` : String(m);
    const ss = sc < 10 ? `0${sc}` : String(sc);
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  // Minimal SRT -> WebVTT conversion
  const convertSrtToWebVtt = (srtContent: string): string => {
    const normalized = srtContent.replace(/\r/g, '');
    const blocks = normalized.split('\n\n');
    let vtt = 'WEBVTT\n\n';
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      let idx = 0;
      if (/^\d+$/.test(lines[0])) idx = 1; // skip index line if present
      const timeLine = lines[idx];
      if (!/-->/.test(timeLine)) continue;
      const timeCode = timeLine.replace(/,/g, '.');
      const text = lines.slice(idx + 1).join('\n');
      vtt += `${timeCode}\n${text}\n\n`;
    }
    return vtt;
  };

  return (
    <View className="flex-1 bg-black">
      <Pressable className="flex-1" onPress={() => setShowControls((v) => !v)}>
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted={false}
        />
      </Pressable>

      {showControls && (
        <View className="absolute left-0 right-0 top-0">
          <View className="flex-row items-center p-3">
            {showBack ? (
              <Pressable
                className="rounded-md bg-white/10 px-3 py-2 mr-2"
                onPress={onBack}
              >
                <Text className="text-white">Back</Text>
              </Pressable>
            ) : null}
            {title ? (
              <Text className="text-white text-sm" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {showControls && (
        <View className="absolute left-0 right-0 bottom-0 p-3">
          <View className="flex-row items-center justify-between mb-2">
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => {
                try {
                  if (!videoRef.current) return;
                  if (isPlaying) videoRef.current.pause();
                  else {
                    // Ensure audio is enabled on user interaction
                    try {
                      videoRef.current.muted = false;
                      videoRef.current.volume = Math.max(
                        0.0,
                        Math.min(1.0, videoRef.current.volume || 1)
                      );
                    } catch {}
                    videoRef.current.play();
                  }
                } catch {}
              }}
            >
              <Text className="text-white">{isPlaying ? 'Pause' : 'Play'}</Text>
            </Pressable>

            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => {
                try {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  if (!v.muted && v.volume === 0) v.volume = 1;
                  setIsMutedUi(!!v.muted || (v.volume ?? 0) === 0);
                } catch {}
              }}
            >
              <Text className="text-white text-xs">
                {isMutedUi ? 'Unmute' : 'Mute'}
              </Text>
            </Pressable>

            {audioLanguages.length > 0 ? (
              <Pressable
                className="rounded-md bg-white/10 px-3 py-2"
                onPress={() => {
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
                }}
              >
                <Text className="text-white text-xs">
                  {`Audio: ${selectedAudioLang ?? 'Default'}`}
                </Text>
              </Pressable>
            ) : null}

            {/* Audio compatibility fallback: try .mp4 variant if MKV has no audio in browser */}
            {AUDIO_FIX_ENABLED &&
              (() => {
                try {
                  const base = url.split('?')[0];
                  if (/\.mkv$/i.test(base)) {
                    return (
                      <Pressable
                        className="rounded-md bg-white/10 px-3 py-2"
                        onPress={() => {
                          const v = videoRef.current;
                          if (!v) return;
                          try {
                            v.pause();
                          } catch {}
                          const newUrl = url.replace(
                            /\.mkv(\?.*)?$/i,
                            '.mp4$1'
                          );
                          v.src = newUrl;
                          try {
                            v.muted = false;
                            v.volume = Math.max(
                              0.0,
                              Math.min(1.0, v.volume || 1)
                            );
                          } catch {}
                          v.load();
                          void v.play().catch(() => {});
                        }}
                      >
                        <Text className="text-white text-xs">Audio fix</Text>
                      </Pressable>
                    );
                  }
                } catch {}
                return null;
              })()}

            {SUBS_DISABLED ? null : subtitleTracks.length > 0 ? (
              <Pressable
                className="rounded-md bg-white/10 px-3 py-2"
                onPress={async () => {
                  const player = playerRef.current;
                  const video = videoRef.current;
                  if (!player && !video) return;
                  // If we don't yet have any known original/DB subtitle listings, fetch them now on-demand
                  try {
                    if (
                      movieId &&
                      originalTracks.length === 0 &&
                      dbLanguages.length === 0
                    ) {
                      const [origRes, langsRes] = await Promise.allSettled([
                        apiClient.extractOriginalSubtitles({
                          streamUrl: url,
                          movieId,
                          tmdbId,
                        }),
                        apiClient.raw.user.getAvailableLanguages(movieId, {
                          tmdb_id: tmdbId,
                          type:
                            type === 'series'
                              ? 'episode'
                              : type === 'movie'
                                ? 'movie'
                                : 'all',
                          preferred_provider: 'opensubs',
                        }),
                      ]);
                      if (
                        origRes.status === 'fulfilled' &&
                        origRes.value?.success &&
                        Array.isArray(origRes.value.tracks)
                      ) {
                        setOriginalTracks(
                          origRes.value.tracks.map((t: any) => ({
                            id: t.id,
                            language_code: t.language_code,
                            language_name: t.language_name,
                            trackIndex: t.trackIndex,
                          }))
                        );
                      }
                      if (
                        langsRes.status === 'fulfilled' &&
                        Array.isArray(langsRes.value?.languages)
                      ) {
                        setDbLanguages(langsRes.value.languages);
                      }
                    }
                  } catch {}
                  const shakaTracks = player?.getTextTracks?.() || [];
                  const nativeTracks = Array.from(
                    video?.textTracks || ([] as any)
                  );
                  const tracks =
                    shakaTracks.length > 0 ? shakaTracks : nativeTracks;

                  // If we have no tracks yet but know of available ones, try to add the first available now
                  if (tracks.length === 0 && movieId) {
                    try {
                      // Prefer first original if any, otherwise first DB language
                      if (originalTracks.length > 0) {
                        const t = originalTracks[0];
                        const res =
                          await apiClient.extractOriginalSubtitleContent({
                            subtitleId: t.id,
                            streamUrl: url,
                            trackIndex: t.trackIndex,
                            language: t.language_code,
                          });
                        if (res.success && res.content) {
                          const vtt = convertSrtToWebVtt(res.content);
                          const blob = new Blob([vtt], { type: 'text/vtt' });
                          const objUrl = URL.createObjectURL(blob);
                          createdObjectUrlsRef.current.push(objUrl);
                          if (
                            player &&
                            typeof player.addTextTrack === 'function'
                          ) {
                            player.addTextTrack(
                              objUrl,
                              t.language_code,
                              'subtitles',
                              'text/vtt',
                              '',
                              `Original: ${t.language_name}`,
                              false
                            );
                            const updated = player.getTextTracks?.() || [];
                            setSubtitleTracks(updated as any);
                            try {
                              player.setTextTrackVisibility(true);
                              player.selectTextLanguage?.(t.language_code);
                            } catch {}
                            setSelectedSubtitleIndex(updated.length - 1);
                          } else if (video) {
                            const trackEl = document.createElement('track');
                            trackEl.kind = 'subtitles';
                            trackEl.src = objUrl;
                            trackEl.srclang = t.language_code;
                            trackEl.label = `Original: ${t.language_name}`;
                            video.appendChild(trackEl);
                            const updated = Array.from(
                              video.textTracks || ([] as any)
                            );
                            setSubtitleTracks(updated as any);
                            setSelectedSubtitleIndex(updated.length - 1);
                          }
                          return;
                        }
                      } else if (dbLanguages.length > 0) {
                        const l = dbLanguages[0];
                        const res = await apiClient.raw.user.getSubtitleContent(
                          movieId,
                          l.code,
                          {
                            tmdb_id: tmdbId,
                            type:
                              type === 'series'
                                ? 'episode'
                                : type === 'movie'
                                  ? 'movie'
                                  : 'all',
                            preferred_provider: 'opensubs',
                          }
                        );
                        if (res.subtitle?.content) {
                          const vtt = convertSrtToWebVtt(res.subtitle.content);
                          const blob = new Blob([vtt], { type: 'text/vtt' });
                          const objUrl = URL.createObjectURL(blob);
                          createdObjectUrlsRef.current.push(objUrl);
                          if (
                            player &&
                            typeof player.addTextTrack === 'function'
                          ) {
                            player.addTextTrack(
                              objUrl,
                              l.code,
                              'subtitles',
                              'text/vtt',
                              '',
                              `DB: ${l.name}`,
                              false
                            );
                            const updated = player.getTextTracks?.() || [];
                            setSubtitleTracks(updated as any);
                            try {
                              player.setTextTrackVisibility(true);
                              player.selectTextLanguage?.(l.code);
                            } catch {}
                            setSelectedSubtitleIndex(updated.length - 1);
                          } else if (video) {
                            const trackEl = document.createElement('track');
                            trackEl.kind = 'subtitles';
                            trackEl.src = objUrl;
                            trackEl.srclang = l.code;
                            trackEl.label = `DB: ${l.name}`;
                            video.appendChild(trackEl);
                            const updated = Array.from(
                              video.textTracks || ([] as any)
                            );
                            setSubtitleTracks(updated as any);
                            setSelectedSubtitleIndex(updated.length - 1);
                          }
                          return;
                        }
                      }
                    } catch {}
                  }

                  const currentIdx = selectedSubtitleIndex ?? -1;
                  const nextIdx =
                    currentIdx + 1 < tracks.length ? currentIdx + 1 : -1;
                  if (nextIdx >= 0) {
                    try {
                      if (player && shakaTracks.length > 0) {
                        player.setTextTrackVisibility(true);
                        player.selectTextTrack(tracks[nextIdx] as any);
                      } else if (video && nativeTracks.length > 0) {
                        nativeTracks.forEach((t: any, i: number) => {
                          t.mode = i === nextIdx ? 'showing' : 'disabled';
                        });
                      }
                    } catch {}
                  } else {
                    try {
                      if (player && shakaTracks.length > 0) {
                        player.setTextTrackVisibility(false);
                      } else if (video && nativeTracks.length > 0) {
                        nativeTracks.forEach((t: any) => (t.mode = 'disabled'));
                      }
                    } catch {}
                  }
                  setSelectedSubtitleIndex(nextIdx >= 0 ? nextIdx : undefined);
                }}
              >
                <Text className="text-white text-xs">
                  {`Subs: ${
                    selectedSubtitleIndex !== undefined
                      ? subtitleTracks[selectedSubtitleIndex]?.language || 'On'
                      : 'Off'
                  }`}
                </Text>
              </Pressable>
            ) : SUBS_DISABLED ? null : movieId ? (
              // Show button even when there are no tracks yet so we can trigger on-demand loading
              <Pressable
                className="rounded-md bg-white/10 px-3 py-2"
                onPress={async () => {
                  const player = playerRef.current;
                  const video = videoRef.current;
                  // Fetch lists on first demand if empty
                  try {
                    if (
                      movieId &&
                      originalTracks.length === 0 &&
                      dbLanguages.length === 0
                    ) {
                      const [origRes, langsRes] = await Promise.allSettled([
                        apiClient.extractOriginalSubtitles({
                          streamUrl: url,
                          movieId,
                          tmdbId,
                        }),
                        apiClient.raw.user.getAvailableLanguages(movieId, {
                          tmdb_id: tmdbId,
                          type:
                            type === 'series'
                              ? 'episode'
                              : type === 'movie'
                                ? 'movie'
                                : 'all',
                          preferred_provider: 'opensubs',
                        }),
                      ]);
                      if (
                        origRes.status === 'fulfilled' &&
                        origRes.value?.success &&
                        Array.isArray(origRes.value.tracks)
                      ) {
                        setOriginalTracks(
                          origRes.value.tracks.map((t: any) => ({
                            id: t.id,
                            language_code: t.language_code,
                            language_name: t.language_name,
                            trackIndex: t.trackIndex,
                          }))
                        );
                      }
                      if (
                        langsRes.status === 'fulfilled' &&
                        Array.isArray(langsRes.value?.languages)
                      ) {
                        setDbLanguages(langsRes.value.languages);
                      }
                    }
                  } catch {}
                  const shakaTracks = player?.getTextTracks?.() || [];
                  const nativeTracks = Array.from(
                    video?.textTracks || ([] as any)
                  );
                  const tracks =
                    shakaTracks.length > 0 ? shakaTracks : nativeTracks;
                  if (tracks.length > 0) return; // handled by branch above

                  try {
                    if (originalTracks.length > 0) {
                      const t = originalTracks[0];
                      const res =
                        await apiClient.extractOriginalSubtitleContent({
                          subtitleId: t.id,
                          streamUrl: url,
                          trackIndex: t.trackIndex,
                          language: t.language_code,
                        });
                      if (res.success && res.content) {
                        const vtt = convertSrtToWebVtt(res.content);
                        const blob = new Blob([vtt], { type: 'text/vtt' });
                        const objUrl = URL.createObjectURL(blob);
                        createdObjectUrlsRef.current.push(objUrl);
                        if (player && player.addTextTrack) {
                          player.addTextTrack(
                            objUrl,
                            t.language_code,
                            'subtitles',
                            'text/vtt',
                            '',
                            `Original: ${t.language_name}`,
                            false
                          );
                          const updated = player.getTextTracks?.() || [];
                          setSubtitleTracks(updated as any);
                          player.setTextTrackVisibility?.(true);
                          player.selectTextLanguage?.(t.language_code);
                          setSelectedSubtitleIndex(updated.length - 1);
                        } else if (video) {
                          const trackEl = document.createElement('track');
                          trackEl.kind = 'subtitles';
                          trackEl.src = objUrl;
                          trackEl.srclang = t.language_code;
                          trackEl.label = `Original: ${t.language_name}`;
                          video.appendChild(trackEl);
                          const updated = Array.from(
                            video.textTracks || ([] as any)
                          );
                          setSubtitleTracks(updated as any);
                          setSelectedSubtitleIndex(updated.length - 1);
                        }
                        return;
                      }
                    } else if (dbLanguages.length > 0) {
                      const l = dbLanguages[0];
                      const res = await apiClient.raw.user.getSubtitleContent(
                        movieId,
                        l.code,
                        {
                          tmdb_id: tmdbId,
                          type:
                            type === 'series'
                              ? 'episode'
                              : type === 'movie'
                                ? 'movie'
                                : 'all',
                          preferred_provider: 'opensubs',
                        }
                      );
                      if (res.subtitle?.content) {
                        const vtt = convertSrtToWebVtt(res.subtitle.content);
                        const blob = new Blob([vtt], { type: 'text/vtt' });
                        const objUrl = URL.createObjectURL(blob);
                        createdObjectUrlsRef.current.push(objUrl);
                        if (player && player.addTextTrack) {
                          player.addTextTrack(
                            objUrl,
                            l.code,
                            'subtitles',
                            'text/vtt',
                            '',
                            `DB: ${l.name}`,
                            false
                          );
                          const updated = player.getTextTracks?.() || [];
                          setSubtitleTracks(updated as any);
                          player.setTextTrackVisibility?.(true);
                          player.selectTextLanguage?.(l.code);
                          setSelectedSubtitleIndex(updated.length - 1);
                        } else if (video) {
                          const trackEl = document.createElement('track');
                          trackEl.kind = 'subtitles';
                          trackEl.src = objUrl;
                          trackEl.srclang = l.code;
                          trackEl.label = `DB: ${l.name}`;
                          video.appendChild(trackEl);
                          const updated = Array.from(
                            video.textTracks || ([] as any)
                          );
                          setSubtitleTracks(updated as any);
                          setSelectedSubtitleIndex(updated.length - 1);
                        }
                        return;
                      }
                    }
                  } catch {}
                }}
              >
                <Text className="text-white text-xs">Subs</Text>
              </Pressable>
            ) : null}
          </View>

          <View className="flex-row items-center">
            <Text className="text-white text-xs mr-2" style={{ width: 48 }}>
              {fmt(currentTime)}
            </Text>
            <View
              style={{
                flex: 1,
                height: 4,
                backgroundColor: '#3f3f46',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                  backgroundColor: '#22c55e',
                }}
              />
            </View>
            <Text
              className="text-white text-xs ml-2"
              style={{ width: 48, textAlign: 'right' }}
            >
              {fmt(duration)}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => onSeek(Math.max(0, currentTime - 15))}
            >
              <Text className="text-white">-15s</Text>
            </Pressable>
            <Pressable
              className="rounded-md bg-white/10 px-3 py-2"
              onPress={() => onSeek(currentTime + 30)}
            >
              <Text className="text-white">+30s</Text>
            </Pressable>
            {hasError ? (
              <Pressable
                className="rounded-md bg-white/10 px-3 py-2"
                onPress={() => {
                  setHasError(null);
                  try {
                    videoRef.current?.load();
                    videoRef.current?.play();
                  } catch {}
                }}
              >
                <Text className="text-white">Retry</Text>
              </Pressable>
            ) : null}
          </View>
          {audioIssue === 'no-audio' ? (
            <View className="mt-2">
              <Text className="text-yellow-300 text-xs mb-2">
                Audio isn’t supported by this browser for this file. Please use
                the app for full playback, or open in VLC from the details page.
              </Text>
              <View className="flex-row">
                <Pressable
                  className="rounded-md bg-white/10 px-3 py-2 mr-2"
                  onPress={() => {
                    try {
                      window.open(url, '_blank');
                    } catch {}
                  }}
                >
                  <Text className="text-white text-xs">Open in new tab</Text>
                </Pressable>
                <Pressable
                  className="rounded-md bg-white/10 px-3 py-2"
                  onPress={async () => {
                    try {
                      await navigator.clipboard?.writeText(url);
                    } catch {}
                  }}
                >
                  <Text className="text-white text-xs">Copy URL</Text>
                </Pressable>
              </View>
            </View>
          ) : isLoading ? (
            <Text className="text-white/80 text-xs mt-2">Buffering…</Text>
          ) : null}
          {hasError ? (
            <Text className="text-red-400 text-xs mt-2">{hasError}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default WebPlayerView;
