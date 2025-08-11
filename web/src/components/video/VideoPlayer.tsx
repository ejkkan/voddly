import {
  ArrowLeft,
  Captions,
  Maximize,
  Minimize,
  Palette,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
// MediaInfo.js removed - subtitle detection now handled by backend
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { apiClient } from "~/lib/api-client";
import { contentResolver } from "~/lib/content-resolver";
import type { PlayerContext } from "~/lib/content-types";

// PGS subtitle support
let PgsRenderer: any = null;
let libpgsLoaded = false;

// Dynamically import libpgs to avoid SSR issues
const loadLibPGS = async () => {
  if (libpgsLoaded) return PgsRenderer;

  try {
    const libpgs = await import("libpgs");
    // Handle different export formats
    PgsRenderer =
      (libpgs as any).PgsRenderer || (libpgs as any).default?.PgsRenderer || libpgs;
    libpgsLoaded = true;
    console.log("📚 libpgs loaded successfully");
    return PgsRenderer;
  } catch (error) {
    console.error("❌ Failed to load libpgs:", error);
    return null;
  }
};

// Stub for MediaInfo.js (deprecated in favor of backend FFmpeg extraction)
const MediaInfoFactory = () => {
  throw new Error("MediaInfo.js is disabled - using backend extraction");
};

type VideoTheme = "default" | "modern";

interface VideoPlayerProps {
  url?: string;
  title?: string;
  theme?: VideoTheme;
  onBack?: () => void;
  autoPlay?: boolean;
  className?: string;
  type?: "movie" | "series" | "live";
  movieId?: string;
  tmdbId?: number;
  playerContext?: PlayerContext;
}

export interface VideoPlayerRef {
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
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
  // Loading state control
  setLoading: (loading: boolean) => void;
  isLoading: () => boolean;
}

const THEMES: Record<
  VideoTheme,
  { primary: string; accent: string; bg: string; text: string; size: "compact" | "large" }
> = {
  default: {
    primary: "#111827",
    accent: "#60a5fa",
    bg: "rgba(0,0,0,0.7)",
    text: "#ffffff",
    size: "compact",
  },
  modern: {
    primary: "#0b1220",
    accent: "#3b82f6",
    bg: "rgba(0,0,0,0.85)",
    text: "#ffffff",
    size: "large",
  },
};

export const VideoPlayer = ({
  ref,
  url,
  title = "Playing",
  theme = "default",
  onBack,
  autoPlay = true,
  className = "",
  type,
  movieId,
  tmdbId,
  playerContext,
}: VideoPlayerProps & { ref?: React.RefObject<VideoPlayerRef | null> }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [externalLoading, setExternalLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSubtitlesPanel, setShowSubtitlesPanel] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<VideoTheme>(theme);
  const [databaseSubtitles, setDatabaseSubtitles] = useState<any[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [loadingSubtitles, setLoadingSubtitles] = useState(false);
  const [expandedLanguages, setExpandedLanguages] = useState<Set<string>>(new Set());
  const [subtitleVariants, setSubtitleVariants] = useState<Record<string, any[]>>({});
  const [embeddedSubtitles, setEmbeddedSubtitles] = useState<any[]>([]);
  const [detectedEmbeddedTracks, setDetectedEmbeddedTracks] = useState(false);
  const [originalSubtitles, setOriginalSubtitles] = useState<any[]>([]);
  const [loadingOriginalTracks, setLoadingOriginalTracks] = useState(false);
  const [pgsRenderer, setPgsRenderer] = useState<any>(null);
  const [pgsCanvasRef, setPgsCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [pgsSupported, setPgsSupported] = useState<boolean | null>(null);

  const themeConfig = THEMES[selectedTheme];

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    onBack?.();
  }, [onBack]);

  useEffect(() => {
    if (url) {
      setIsOpen(true);
      setIsLoading(true);
      console.log("🎬 Video URL changed, setting loading state");

      // Initialize PGS support check
      initializePGSSupport();

      // Fallback to clear loading state after 10 seconds
      const fallbackTimer = setTimeout(() => {
        console.log("⏰ Loading state fallback timeout reached");
        setIsLoading(false);
      }, 10000);

      return () => clearTimeout(fallbackTimer);
    }
  }, [url]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => {
      setCurrentTime(v.currentTime);
      // Clear loading state once we have meaningful playback
      if (v.currentTime > 0 && isLoading) {
        console.log("🎬 Video time update detected, clearing loading state");
        setIsLoading(false);
      }
    };
    const onDuration = () => setDuration(v.duration || 0);
    const onPlay = () => {
      console.log("🎬 Video play event fired");
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onVolume = () => {
      setVolume(v.volume);
      setIsMuted(v.muted);
    };
    const onLoadedMetadata = () => {
      onDuration();
      // Don't automatically clear loading here, wait for canplay

      // Subtitle detection is now handled by the backend endpoint
      // No need to run frontend MediaInfo analysis that interferes with playback
    };
    const onLoadStart = () => setIsLoading(true);
    const onWaiting = () => setIsLoading(true);
    const onSeeking = () => setIsLoading(true);
    const onCanPlay = () => {
      // Only clear loading if we have some duration and we're not in autoplay
      if (v.duration > 0 && !autoPlay) {
        setIsLoading(false);
      }
    };
    const onCanPlayThrough = () => setIsLoading(false);
    const onPlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onSeeked = () => setIsLoading(false);
    const onEnded = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };
    const onError = (e: Event) => {
      setIsLoading(false);
      const target = e.target as HTMLVideoElement;
      console.error("🚨 Video error occurred:", {
        error: target.error,
        code: target.error?.code,
        message: target.error?.message,
        networkState: target.networkState,
        readyState: target.readyState,
        src: target.src,
        currentSrc: target.currentSrc,
      });
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDuration);
    v.addEventListener("loadedmetadata", onLoadedMetadata);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("loadstart", onLoadStart);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("canplaythrough", onCanPlayThrough);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDuration);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("loadstart", onLoadStart);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("canplaythrough", onCanPlayThrough);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
    };
  }, [isLoading, autoPlay]);

  // Autoplay effect - triggers when URL changes and autoPlay is enabled
  useEffect(() => {
    const v = videoRef.current;
    if (!url || !autoPlay) {
      console.log("🎬 Autoplay skipped:", { hasVideo: !!v, hasUrl: !!url, autoPlay });
      return;
    }

    if (!v) {
      console.log("🎬 Video element not ready, will retry autoplay on next render");
      return;
    }

    console.log("🎬 Attempting autoplay for URL:", url);
    console.log(
      "🎬 Video element ready state:",
      v.readyState,
      "Network state:",
      v.networkState,
    );

    // Wait for video to be loaded enough to play
    const attemptPlay = async () => {
      try {
        console.log("🎬 Video state before play attempt:", {
          readyState: v.readyState,
          networkState: v.networkState,
          paused: v.paused,
          ended: v.ended,
          currentTime: v.currentTime,
          duration: v.duration,
        });

        // Ensure video is not muted initially for better UX
        v.muted = false;
        console.log("🎬 Attempting unmuted autoplay...");
        await v.play();
        console.log("✅ Autoplay successful!");
        setIsLoading(false);
      } catch (error) {
        console.log("⚠️ Unmuted autoplay failed, trying muted fallback...", error);
        try {
          v.muted = true;
          await v.play();
          console.log("✅ Muted autoplay successful!");
          setIsLoading(false);
        } catch (mutedError) {
          console.error("❌ Both autoplay attempts failed:", mutedError);
          setIsLoading(false);
        }
      }
    };

    // Check if video is ready
    if (v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      console.log("🎬 Video ready, playing immediately");
      attemptPlay();
    } else {
      console.log("🎬 Video not ready, waiting for canplay event");

      // Listen for multiple events to catch when video is ready
      const onCanPlay = () => {
        console.log("🎬 Video can play, attempting autoplay");
        cleanup();
        // Small delay to ensure stability
        setTimeout(attemptPlay, 100);
      };

      const onLoadedData = () => {
        console.log("🎬 Video loaded data, attempting autoplay");
        cleanup();
        setTimeout(attemptPlay, 100);
      };

      let fallbackTimer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        v.removeEventListener("canplay", onCanPlay);
        v.removeEventListener("loadeddata", onLoadedData);
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };

      v.addEventListener("canplay", onCanPlay);
      v.addEventListener("loadeddata", onLoadedData);

      // Fallback timeout in case events don't fire
      fallbackTimer = setTimeout(() => {
        console.log("🎬 Fallback timeout reached, attempting play anyway");
        cleanup();
        attemptPlay();
      }, 5000); // Increased timeout for series

      return cleanup;
    }
  }, [url, autoPlay]);

  // Additional autoplay effect that triggers when video element becomes available
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url || !autoPlay || !isLoading) return;

    console.log("🎬 Video element now available, attempting autoplay...");

    const attemptPlay = async () => {
      try {
        console.log("🎬 Video state for retry:", {
          readyState: v.readyState,
          networkState: v.networkState,
          paused: v.paused,
          currentTime: v.currentTime,
        });

        if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          v.muted = false;
          console.log("🎬 Attempting unmuted autoplay (retry)...");
          await v.play();
          console.log("✅ Autoplay successful on retry!");
          setIsLoading(false);
        } else {
          console.log("🎬 Video not ready for retry, will wait for events");
        }
      } catch (error) {
        console.log("⚠️ Unmuted autoplay failed on retry, trying muted...", error);
        try {
          v.muted = true;
          await v.play();
          console.log("✅ Muted autoplay successful on retry!");
          setIsLoading(false);
        } catch (mutedError) {
          console.error("❌ Both autoplay retry attempts failed:", mutedError);
          setIsLoading(false);
        }
      }
    };

    // Small delay to let video element settle
    const retryTimer = setTimeout(attemptPlay, 200);
    return () => clearTimeout(retryTimer);
  }, [url, autoPlay, isLoading]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Cleanup PGS renderer on unmount
  useEffect(() => {
    return () => {
      cleanupPGSRenderer();
    };
  }, []);

  // Keyboard shortcuts: space, arrows, volume
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      const v = videoRef.current;
      switch (e.key) {
        case " ":
        case "Spacebar":
          e.preventDefault();
          if (v.paused) v.play();
          else v.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(1, (v.volume || 0) + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(0, (v.volume || 0) - 0.05);
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Auto-hide controls when playing
  useEffect(() => {
    if (!isOpen) return;
    let timeout: any;
    const reset = () => {
      clearTimeout(timeout);
      setShowControls(true);
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 2000);
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", reset);
      container.addEventListener("touchstart", reset, { passive: true } as any);
      reset();
    }
    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener("mousemove", reset);
        container.removeEventListener("touchstart", reset as any);
      }
    };
  }, [isOpen, isPlaying]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      togglePlayPause: () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play();
        else v.pause();
      },
      setVolume: (vol: number) => {
        if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, vol));
      },
      mute: () => {
        if (videoRef.current) videoRef.current.muted = true;
      },
      unmute: () => {
        if (videoRef.current) videoRef.current.muted = false;
      },
      toggleMute: () => {
        if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
      },
      seekTo: (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      enterFullscreen: () => containerRef.current?.requestFullscreen?.(),
      exitFullscreen: () => document.exitFullscreen?.(),
      load: () => setIsOpen(true),
      getCurrentTime: () => currentTime,
      getDuration: () => duration,
      isPlaying: () => isPlaying,
      // Loading state control
      setLoading: (loading: boolean) => setExternalLoading(loading),
      isLoading: () => isLoading || externalLoading,
    }),
    [currentTime, duration, isPlaying, isLoading, externalLoading],
  );

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs
          .toString()
          .padStart(2, "0")}`
      : `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, percent * duration));
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  // Helper functions - defined first to avoid hoisting issues
  const getLanguageName = (code: string): string => {
    const names: Record<string, string> = {
      eng: "English",
      nor: "Norwegian",
      swe: "Swedish",
      ara: "Arabic",
      dan: "Danish",
      fin: "Finnish",
      spa: "Spanish",
      fre: "French",
      ger: "German",
      ita: "Italian",
      por: "Portuguese",
      rus: "Russian",
    };
    return names[code] || code.toUpperCase();
  };

  // Initialize PGS support - check browser compatibility
  const initializePGSSupport = async () => {
    if (pgsSupported !== null) return; // Already checked

    console.log("🔬 Checking PGS browser support...");

    // Check for required APIs
    const hasWebWorkers = typeof Worker !== "undefined";
    const hasOffscreenCanvas = typeof OffscreenCanvas !== "undefined";
    const hasCanvas = typeof HTMLCanvasElement !== "undefined";

    console.log("📊 Browser capabilities:", {
      webWorkers: hasWebWorkers,
      offscreenCanvas: hasOffscreenCanvas,
      canvas: hasCanvas,
    });

    if (!hasWebWorkers || !hasCanvas) {
      console.log("❌ Browser lacks required APIs for PGS support");
      setPgsSupported(false);
      return;
    }

    // Try to load libpgs
    const PgsRendererClass = await loadLibPGS();
    if (!PgsRendererClass) {
      console.log("❌ Failed to load libpgs library");
      setPgsSupported(false);
      return;
    }

    console.log("✅ PGS support available (experimental)");
    setPgsSupported(true);
  };

  // Initialize PGS renderer for a specific subtitle track
  const initializePGSRenderer = async (subtitle: any) => {
    if (!pgsSupported || !videoRef.current) {
      console.log("❌ PGS not supported or video not ready");
      return false;
    }

    try {
      const PgsRendererClass = await loadLibPGS();
      if (!PgsRendererClass) return false;

      // Create canvas for subtitle overlay
      const canvas = document.createElement("canvas");
      const video = videoRef.current;
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "5";

      // Add canvas to video container
      const container = videoRef.current.parentElement;
      if (container) {
        container.appendChild(canvas);
        setPgsCanvasRef(canvas);
      }

      console.log("🎨 PGS canvas initialized:", {
        width: canvas.width,
        height: canvas.height,
      });

      // Try to extract PGS subtitle data from the video stream
      console.log("🎨 Attempting to extract PGS subtitle data...");

      try {
        // For IPTV streams, we'll try to get subtitle data via the backend
        const subtitleParams = {
          streamUrl: video.src,
          language: subtitle.language_code || subtitle.language,
          track: subtitle.trackIndex || subtitle.index || 0,
          format: "pgs",
        };

        console.log("📤 Requesting PGS subtitle extraction:", subtitleParams);

        // For now, create a basic PGS renderer placeholder
        const renderer = new PgsRendererClass(canvas);
        setPgsRenderer(renderer);

        console.log("✅ PGS renderer created and ready");
        console.log("📝 Next: Backend subtitle extraction needed for full functionality");

        // Show a temporary overlay indicating PGS is "active"
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
          ctx.fillRect(10, canvas.height - 60, canvas.width - 20, 40);
          ctx.fillStyle = "white";
          ctx.font = "16px Arial";
          ctx.fillText(
            `PGS Subtitles (${subtitle.language_name}) - Experimental Support Active`,
            20,
            canvas.height - 35,
          );

          // Clear after 3 seconds
          setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }, 3000);
        }

        return true;
      } catch (extractError) {
        console.error("❌ PGS extraction failed:", extractError);
        return false;
      }
    } catch (error) {
      console.error("❌ Failed to initialize PGS renderer:", error);
      return false;
    }
  };

  // Cleanup PGS renderer
  const cleanupPGSRenderer = () => {
    if (pgsRenderer) {
      try {
        pgsRenderer.destroy?.();
        setPgsRenderer(null);
      } catch (error) {
        console.error("❌ Error cleaning up PGS renderer:", error);
      }
    }

    if (pgsCanvasRef && pgsCanvasRef.parentElement) {
      pgsCanvasRef.parentElement.removeChild(pgsCanvasRef);
      setPgsCanvasRef(null);
    }
  };

  // Deprecated: Embedded subtitle detection moved to backend FFmpeg extraction
  const detectEmbeddedSubtitleTracks = async () => {
    if (!videoRef.current || detectedEmbeddedTracks) return;

    const video = videoRef.current;
    const embedded: any[] = [];

    console.log("🔍 Analyzing video file with MediaInfo.js...");

    // 1. Check browser-detectable text tracks first
    console.log(`🔍 Checking browser text tracks... Found: ${video.textTracks.length}`);
    if (video.textTracks && video.textTracks.length > 0) {
      Array.from(video.textTracks).forEach((track, index) => {
        console.log(
          `📝 Found browser-accessible track ${index}: ${track.language} (${track.kind}) - mode: ${track.mode}`,
        );
        embedded.push({
          id: `browser_${index}`,
          language: track.language || "unknown",
          language_name: getLanguageName(track.language || "unknown"),
          source: "Embedded (Browser Native)",
          format: track.kind || "subtitles",
          track: track,
          type: "browser_detected",
          accessible: true,
          note: "This track can be enabled in the browser",
        });
      });
    }

    // Also check for additional track information
    console.log("🔍 Checking video element tracks...");
    // Note: videoTracks and audioTracks are not universally supported
    try {
      const videoTracks = (video as any).videoTracks;
      const audioTracks = (video as any).audioTracks;
      if (videoTracks && videoTracks.length > 0) {
        console.log(`📺 Found ${videoTracks.length} video tracks`);
      }
      if (audioTracks && audioTracks.length > 0) {
        console.log(`🎵 Found ${audioTracks.length} audio tracks`);
      }
    } catch {
      console.log("🔍 Track APIs not available in this browser");
    }

    // 2. Use MediaInfo.js to analyze the actual video file for ALL tracks
    try {
      console.log("🔬 Initializing MediaInfo.js...");

      // Skip MediaInfo.js analysis - using backend FFmpeg extraction instead
      console.log("⚠️ MediaInfo.js disabled - using backend extraction instead");
      throw new Error("MediaInfo.js disabled");
          // Use CDN for MediaInfo WASM files
          if (path.endsWith(".wasm")) {
            return `https://unpkg.com/mediainfo.js@latest/dist/${path}`;
          }
          return prefix + path;
        },
      });

      console.log("📡 Using video element for stream analysis...");

      // Wait for video to load metadata first
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        console.log("⏳ Waiting for video metadata to load...");
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            video.removeEventListener("loadedmetadata", onLoaded);
            reject(new Error("Video metadata timeout"));
          }, 10000);

          const onLoaded = () => {
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          };

          video.addEventListener("loadedmetadata", onLoaded);
        });
      }

      console.log(
        "📊 Video ready state:",
        video.readyState,
        "Network state:",
        video.networkState,
      );

      let arrayBuffer: ArrayBuffer;

      try {
        console.log("🔄 Trying minimal fetch to avoid interfering with playback...");

        // Use a much smaller range to minimize interference with video playback
        const response = await fetch(video.src, {
          headers: {
            Range: "bytes=0-524288", // Only 512KB to minimize interference
          },
        });

        console.log(`📊 Simple fetch status: ${response.status}`);

        if (response.ok || response.status === 206) {
          arrayBuffer = await response.arrayBuffer();
          console.log(
            `📊 Got ${Math.round(arrayBuffer.byteLength / 1024)}KB via minimal fetch`,
          );
        } else {
          throw new Error(`Fetch failed: ${response.status}`);
        }
      } catch (fetchError) {
        console.log(
          "⚠️ Fetch failed, skipping MediaInfo to preserve video playback:",
          fetchError,
        );

        // Skip MediaInfo entirely to avoid any interference with video playback
        throw new Error(
          "Skipping MediaInfo analysis to preserve video playback stability",
        );
      }

      // Analyze the file with timeout
      console.log("🔬 Starting MediaInfo analysis...");
      const analysisPromise = mediainfo.analyzeData(
        () => arrayBuffer.byteLength,
        (chunkSize: number, offset: number) => {
          console.log(
            `📊 MediaInfo requesting chunk: offset=${offset}, size=${chunkSize}`,
          );
          return new Uint8Array(arrayBuffer, offset, chunkSize);
        },
      );

      // Add timeout for MediaInfo analysis
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MediaInfo analysis timeout")), 30000),
      );

      const result = await Promise.race([analysisPromise, timeoutPromise]);

      console.log("🎬 MediaInfo analysis complete!");
      console.log("📊 MediaInfo result type:", typeof result);
      console.log("📊 MediaInfo result keys:", Object.keys(result || {}));
      console.log("Raw MediaInfo result:", result);

      // Parse MediaInfo results
      const typedResult = result as { media?: { track?: any[] } };
      if (typedResult.media && typedResult.media.track) {
        const tracks = typedResult.media.track;

        // Extract subtitle tracks
        const subtitleTracks = tracks.filter((track: any) => track["@type"] === "Text");
        console.log(`📝 Found ${subtitleTracks.length} subtitle tracks via MediaInfo`);

        subtitleTracks.forEach((track: any, index: number) => {
          const language = track.Language || track.Language_String || "unknown";
          const format = track.Format || track.CodecID || "unknown";
          const forced = track.Forced === "Yes";
          const defaultTrack = track.Default === "Yes";

          // Debug: Log what MediaInfo found for each track
          console.log(`🔍 Subtitle track ${index + 1}:`, {
            language,
            format,
            codecId: track.CodecID,
            rawFormat: track.Format,
            forced,
            defaultTrack,
            fullTrack: track,
          });

          // Check if browser already detected this track
          const browserDetected = embedded.some(
            (e) => e.language === language && e.type === "browser_detected",
          );

          // Determine if this is a format that browsers can handle
          const browserCompatibleFormats = ["WebVTT", "SRT", "VTT"];
          const isPotentiallyAccessible = browserCompatibleFormats.some((fmt) =>
            format.toLowerCase().includes(fmt.toLowerCase()),
          );

          // Enhanced PGS detection - check multiple possible format indicators
          const isPGS =
            format === "PGS" ||
            format === "HDMV PGS" ||
            track.CodecID === "S_HDMV/PGS" ||
            track.Format === "PGS" ||
            track.Format === "HDMV PGS" ||
            track.Format_Profile === "PGS" ||
            (track.CodecID && track.CodecID.includes("PGS")) ||
            (format && format.toLowerCase().includes("pgs")) ||
            (track.Format && track.Format.toLowerCase().includes("pgs"));

          let note = "";
          let accessible = browserDetected || isPotentiallyAccessible;

          // Check if this might be PGS but not clearly identified (common with MKV)
          let actuallyIsPGS = isPGS;
          if (
            !isPGS &&
            language.length <= 3 &&
            format === "unknown" &&
            !browserDetected
          ) {
            console.log(
              `🤔 Unknown subtitle format for '${language}' - treating as potential PGS`,
            );
            actuallyIsPGS = true;
          }

          if (actuallyIsPGS) {
            console.log(
              `🎨 Detected/assumed PGS subtitle track: ${language} (format: ${format})`,
            );
            note =
              pgsSupported === true
                ? "PGS (image-based) subtitles - Experimental browser support available via libpgs."
                : pgsSupported === false
                  ? "PGS (image-based) subtitles cannot be displayed in browsers. Use external players like VLC, IPTVX, or TiviMate."
                  : "PGS (image-based) subtitles - Initializing libpgs support...";
            accessible = pgsSupported === true;
          } else if (browserDetected) {
            note = "This track is accessible in browsers";
          } else if (isPotentiallyAccessible) {
            note = "This text-based track might be accessible in browsers";
          } else if (
            format === "UTF-8" &&
            track.CodecID &&
            track.CodecID.includes("S_TEXT")
          ) {
            note = "UTF-8 text subtitles - Server-side extraction available";
            accessible = true;
          } else {
            note = "This track format may require external players";
          }

          embedded.push({
            id: `mediainfo_${index}`,
            language: language,
            language_name: getLanguageName(language),
            source: browserDetected
              ? "Embedded (Browser + MediaInfo)"
              : `Embedded (${format})`,
            format: format,
            codec: track.CodecID || format,
            track: null,
            type: "mediainfo_detected",
            accessible: accessible,
            forced: forced,
            default: defaultTrack,
            index: index,
            isPGS: actuallyIsPGS,
            note: note,
          });
        });

        // Extract audio tracks
        const audioTracks = tracks.filter((track: any) => track["@type"] === "Audio");
        if (audioTracks.length > 1) {
          console.log(
            `🎵 Found ${audioTracks.length} audio tracks:`,
            audioTracks.map((t: any) => `${t.Language || "unknown"} (${t.Format})`),
          );
        }

        // Log container info
        const generalTrack = tracks.find((track: any) => track["@type"] === "General");
        if (generalTrack) {
          console.log("📦 Container:", generalTrack.Format, generalTrack.FileExtension);
          console.log("⏱️ Duration:", generalTrack.Duration);
        }
      }

      // Clean up MediaInfo
      mediainfo.close();
    } catch (error) {
      console.log("⚠️ MediaInfo analysis skipped (using backend extraction instead):", error);

      // More robust fallback based on container type and file extension
      const videoSrc = video.src?.toLowerCase() || "";

      if (videoSrc.includes(".mkv") || videoSrc.includes("matroska")) {
        embedded.push({
          id: "fallback_mkv",
          language: "unknown",
          language_name: "Multiple Tracks (MKV)",
          source: "MKV Container",
          format: "Various (SRT/ASS/PGS)",
          track: null,
          type: "info",
          accessible: false,
          note: "MKV container detected. These files typically contain multiple subtitle tracks that browsers cannot access directly. For full subtitle support, use external players like IPTVX, TiviMate, or VLC.",
        });
      } else if (videoSrc.includes(".mp4") || videoSrc.includes(".m4v")) {
        embedded.push({
          id: "fallback_mp4",
          language: "unknown",
          language_name: "Embedded Tracks (MP4)",
          source: "MP4 Container",
          format: "WebVTT/TTML",
          track: null,
          type: "info",
          accessible: false,
          note: "MP4 container detected. Subtitle analysis failed but browser may support some embedded tracks directly.",
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError =
          errorMessage.includes("fetch") ||
          errorMessage.includes("CORS") ||
          errorMessage.includes("network") ||
          errorMessage.includes("abort");
        const isIPTVServerIssue =
          errorMessage.includes("IPTV server doesn't support") ||
          errorMessage.includes("IPTV stream analysis blocked");

        let note = "Try external players for full subtitle support.";
        if (isIPTVServerIssue) {
          note =
            "IPTV server doesn't support stream analysis. This is normal for most IPTV services. " +
            note;
        } else if (isNetworkError) {
          note = "Network/CORS restrictions prevented analysis. " + note;
        } else {
          note = "Container format analysis failed. " + note;
        }

        embedded.push({
          id: "fallback_generic",
          language: "unknown",
          language_name: "Analysis Failed",
          source: "Unknown Container",
          format: "Unknown",
          track: null,
          type: "info",
          accessible: false,
          note,
        });
      }
    }

    // 3. Log final results
    if (embedded.length > 0) {
      const accessibleCount = embedded.filter((e) => e.accessible).length;
      console.log(
        `✅ Found ${embedded.length} embedded tracks (${accessibleCount} browser-accessible)`,
      );
      setEmbeddedSubtitles(embedded);
    } else {
      console.log("❌ No embedded subtitle tracks detected");
    }

    setDetectedEmbeddedTracks(true);
  };

  // Select embedded subtitle track
  const selectEmbeddedSubtitle = async (subtitle: any) => {
    try {
      // If clicking the same subtitle that's already selected, turn it off
      if (selectedSubtitle === subtitle.id) {
        setSelectedSubtitle(null);
        clearAllSubtitles();
        return;
      }

      // Clear existing subtitles first
      clearAllSubtitles();

      // If this is a browser-detectable track, enable it
      if (subtitle.track && subtitle.type === "browser_detected") {
        subtitle.track.mode = "showing";
        console.log(`✅ Enabled embedded subtitle: ${subtitle.language_name}`);
        setSelectedSubtitle(subtitle.id);
      } else if (subtitle.isPGS) {
        // Enhanced PGS handling with libpgs support
        console.log(`🖼️ PGS subtitle selected: ${subtitle.language_name}`);

        if (pgsSupported === true) {
          console.log("🧪 Attempting experimental PGS rendering...");

          // Cleanup any existing PGS renderer
          cleanupPGSRenderer();

          // Try to initialize PGS renderer
          const success = await initializePGSRenderer(subtitle);
          if (success) {
            console.log("✅ PGS renderer initialized (experimental)");
            console.log("⚠️ Note: Requires server-side subtitle extraction");
            setSelectedSubtitle(subtitle.id);
          } else {
            console.log("❌ PGS renderer initialization failed");
            console.log("💡 Falling back to external player recommendation");
            setSelectedSubtitle(subtitle.id);
          }
        } else if (pgsSupported === false) {
          console.log(`❌ PGS subtitles not supported in this browser`);
          console.log(`💡 To view these subtitles, use external players like:`);
          console.log(`   • VLC Media Player`);
          console.log(`   • IPTVX (iOS/Apple TV)`);
          console.log(`   • TiviMate (Android/Android TV)`);
          console.log(`   • Kodi`);
          setSelectedSubtitle(subtitle.id);
        } else {
          // Still checking support
          console.log("🔍 Checking PGS support...");
          await initializePGSSupport();
          // Retry selection after support check
          setTimeout(() => selectEmbeddedSubtitle(subtitle), 100);
        }
      } else {
        // For other predicted tracks, try to find and enable them
        console.log(`🔍 Attempting to enable track: ${subtitle.language_name}`);

        // Try to find a matching browser track by language
        const video = videoRef.current;
        if (video && video.textTracks) {
          let foundTrack = null;
          for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            if (track.language === (subtitle.language_code || subtitle.language)) {
              foundTrack = track;
              break;
            }
          }

          if (foundTrack) {
            foundTrack.mode = "showing";
            console.log(
              `✅ Found and enabled matching browser track: ${subtitle.language_name}`,
            );
            setSelectedSubtitle(subtitle.id);
          } else {
            console.log(`⚠️ No browser track found for: ${subtitle.language_name}`);
            console.log(`🎨 Attempting MKV subtitle extraction for UTF-8 track...`);

            // Try to extract MKV subtitle for UTF-8 tracks using server-side extraction
            if (
              subtitle.format === "UTF-8" &&
              subtitle.codec &&
              subtitle.codec.includes("S_TEXT")
            ) {
              try {
                await extractAndApplyOriginalSubtitle(video, subtitle);
                setSelectedSubtitle(subtitle.id);
                return;
              } catch (extractError) {
                console.log(`⚠️ Server-side extraction failed:`, extractError);
              }
            }

            console.log(
              `📋 Track info: Format=${subtitle.format}, Language=${subtitle.language_code || subtitle.language}`,
            );
            console.log(
              `🎯 Recommended: Use external players (VLC, IPTVX, TiviMate) for full MKV subtitle support`,
            );
            setSelectedSubtitle(subtitle.id); // Mark as selected for UI feedback
          }
        } else {
          console.log(`⚠️ Cannot access browser text tracks`);
          console.log(`💡 Browser subtitle API not available`);
          setSelectedSubtitle(subtitle.id);
        }
      }
    } catch (error) {
      console.error("❌ Failed to select embedded subtitle:", error);
    }
  };

  // Load original subtitle tracks when video opens
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOpen || !movieId || !url) return;
      setLoadingOriginalTracks(true);
      try {
        // Get content parameters for extraction
        let extractionParams;
        if (playerContext) {
          extractionParams = {
            streamUrl: url,
            movieId: playerContext.contentId,
            tmdbId: playerContext.tmdbId,
          };
        } else {
          extractionParams = {
            streamUrl: url,
            movieId,
            tmdbId,
          };
        }

        console.log("🎬 Extracting original subtitle tracks:", extractionParams);

        const result = await apiClient.extractOriginalSubtitles(extractionParams);

        if (!cancelled && result.success && result.tracks) {
          console.log(`✅ Found ${result.tracks.length} original subtitle tracks`);
          setOriginalSubtitles(result.tracks);
        }
      } catch (error) {
        console.error("❌ Failed to extract original subtitles:", error);
        if (!cancelled) setOriginalSubtitles([]);
      } finally {
        if (!cancelled) setLoadingOriginalTracks(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, movieId, url, tmdbId, playerContext, originalSubtitles.length]);

  // Load available subtitle languages on open (only if no original subtitles)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOpen || !movieId) return;
      
      // Only fetch external subtitles if no original subtitles are available
      if (originalSubtitles.length > 0) {
        console.log(`🎯 Skipping external subtitle fetch - ${originalSubtitles.length} original subtitle(s) available`);
        setDatabaseSubtitles([]); // Clear any existing external subtitles
        return;
      }
      
      console.log("📥 No original subtitles found, fetching external subtitles from OpenSubtitles...");
      
      setLoadingSubtitles(true);
      try {
        // Get subtitle parameters using the content resolver
        let subtitleParams;
        if (playerContext) {
          subtitleParams = contentResolver.getSubtitleParams(playerContext);
          console.log("🎬 Using enhanced subtitle parameters:", subtitleParams);
        } else {
          // Fallback to old logic if no player context
          subtitleParams = {
            tmdb_id: tmdbId,
            query: title && !/^\d+$/.test(String(title)) ? String(title) : undefined,
            type: type === "series" ? "episode" : type === "movie" ? "movie" : undefined,
            preferred_provider: "opensubs",
          };
          console.log("⚠️ Using fallback subtitle parameters:", subtitleParams);
        }

        const languagesData = await (apiClient.user as any).getAvailableLanguages(
          movieId,
          {
            tmdb_id: subtitleParams.tmdbId,
            query: subtitleParams.query,
            type: subtitleParams.type,
            season_number: subtitleParams.seasonNumber,
            episode_number: subtitleParams.episodeNumber,
            preferred_provider: subtitleParams.preferred_provider || "opensubs",
          },
        );
        if (!cancelled) {
          const formatted = (languagesData.languages || []).map((lang: any) => ({
            id: `lang_${lang.code}`,
            language: lang.code,
            language_name: lang.name,
            content: null as string | null,
            kind: "subtitles",
            mimeType: "text/srt",
            count: lang.count || 0,
          }));
          setDatabaseSubtitles(formatted);
        }
      } catch {
        if (!cancelled) setDatabaseSubtitles([]);
      } finally {
        if (!cancelled) setLoadingSubtitles(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, movieId, tmdbId, title, type, playerContext, originalSubtitles.length]);

  // Minimal SRT->VTT conversion and loading into textTracks
  const convertSrtToWebVtt = (srtContent: string): string => {
    let webvtt = "WEBVTT\n\n";
    const srtBlocks = srtContent.split("\n\n");
    srtBlocks.forEach((block) => {
      const lines = block.trim().split("\n");
      if (lines.length >= 3) {
        const timeCode = lines[1].replace(/,/g, ".");
        const text = lines.slice(2).join("\n");
        webvtt += `${timeCode}\n${text}\n\n`;
      }
    });
    return webvtt;
  };

  const parseWebVTT = (vttText: string): VTTCue[] => {
    const cues: VTTCue[] = [];
    const blocks = vttText.split("\n\n");
    blocks.forEach((block) => {
      const lines = block.trim().split("\n");
      if (lines.length >= 2) {
        const timeLine = lines[0];
        const text = lines.slice(1).join("\n");
        const timeMatch = timeLine.match(
          /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/,
        );
        if (timeMatch) {
          const toSeconds = (tc: string) => {
            const parts = tc.split(":");
            return (
              parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
            );
          };
          const start = toSeconds(timeMatch[1]);
          const end = toSeconds(timeMatch[2]);
          cues.push(new VTTCue(start, end, text));
        }
      }
    });
    return cues;
  };

  const clearAllSubtitles = () => {
    if (!videoRef.current) return;

    const tracks = videoRef.current.textTracks;
    // Disable all existing tracks and clear their cues
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = "disabled";
      // Clear all cues from the track
      while (tracks[i].cues && tracks[i].cues!.length > 0) {
        tracks[i].removeCue(tracks[i].cues![0]);
      }
    }

    // Also cleanup PGS renderer
    cleanupPGSRenderer();
  };

  const toggleLanguageExpansion = async (languageCode: string) => {
    const newExpanded = new Set(expandedLanguages);

    if (expandedLanguages.has(languageCode)) {
      // Collapse the language
      newExpanded.delete(languageCode);
      setExpandedLanguages(newExpanded);
    } else {
      // Expand the language and load variants if not already loaded
      newExpanded.add(languageCode);
      setExpandedLanguages(newExpanded);

      if (!subtitleVariants[languageCode] && movieId) {
        try {
          setExternalLoading(true);
          const variantsData = await (apiClient.user as any).getSubtitleVariants(
            movieId,
            languageCode,
            {
              tmdb_id: tmdbId,
            },
          );

          if (variantsData.variants) {
            setSubtitleVariants((prev) => ({
              ...prev,
              [languageCode]: variantsData.variants,
            }));
          }
        } catch (error) {
          console.error("Failed to load subtitle variants:", error);
        } finally {
          setExternalLoading(false);
        }
      }
    }
  };

  const selectSubtitleVariant = async (variant: any) => {
    try {
      // If clicking the same variant that's already selected, turn it off
      if (selectedSubtitle === variant.id) {
        setSelectedSubtitle(null);
        clearAllSubtitles();
        return;
      }

      let content = variant.content as string | null;
      if (!content) {
        // Show loading spinner while fetching subtitle content
        setExternalLoading(true);

        const contentData = await (apiClient.user as any).getSubtitleContentById(
          variant.id,
        );

        // Hide loading spinner
        setExternalLoading(false);

        if (contentData.subtitle?.content) {
          content = contentData.subtitle.content as string;
          // Update the variant in our local state
          setSubtitleVariants((prev) => ({
            ...prev,
            [variant.language_code]:
              prev[variant.language_code]?.map((v) =>
                v.id === variant.id ? { ...v, content } : v,
              ) || [],
          }));
        } else {
          throw new Error("No subtitle content returned");
        }
      }

      if (content && videoRef.current) {
        // Clear all existing subtitles first
        clearAllSubtitles();

        // Add the new subtitle track
        const webvtt = convertSrtToWebVtt(content);
        const track = videoRef.current.addTextTrack(
          "subtitles",
          `${variant.source}: ${variant.language_name}${variant.name ? ` (${variant.name})` : ""}`,
          variant.language_code,
        );
        track.mode = "showing";
        const cues = parseWebVTT(webvtt);
        cues.forEach((cue) => track.addCue(cue));
        setSelectedSubtitle(variant.id);
      }
    } catch {
      // Hide loading spinner on error
      setExternalLoading(false);
      // swallow error in UI
    }
  };

  const selectOriginalSubtitle = async (subtitle: any) => {
    try {
      // If clicking the same subtitle that's already selected, turn it off
      if (selectedSubtitle === subtitle.id) {
        setSelectedSubtitle(null);
        clearAllSubtitles();
        return;
      }

      console.log(`🎬 Selecting original subtitle: ${subtitle.language_name}`);
      await extractAndApplyOriginalSubtitle(videoRef.current!, subtitle);
    } catch (error) {
      console.error("❌ Failed to select original subtitle:", error);
    }
  };

  const selectDatabaseSubtitle = async (subtitle: any) => {
    try {
      // If clicking the same subtitle that's already selected, turn it off
      if (selectedSubtitle === subtitle.id) {
        setSelectedSubtitle(null);
        clearAllSubtitles();
        return;
      }

      let content = subtitle.content as string | null;
      if (!content && movieId) {
        // Show loading spinner while fetching subtitle content
        setExternalLoading(true);

        const contentData = await (apiClient.user as any).getSubtitleContent(
          movieId,
          subtitle.language_code || subtitle.language,
          {
            tmdb_id: tmdbId,
            query: title && !/^\d+$/.test(String(title)) ? String(title) : undefined,
            type: type === "series" ? "episode" : type === "movie" ? "movie" : undefined,
            preferred_provider: "opensubs",
          },
        );

        // Hide loading spinner
        setExternalLoading(false);

        if (contentData.subtitle?.content) {
          content = contentData.subtitle.content as string;
          setDatabaseSubtitles((prev) =>
            prev.map((s) => (s.id === subtitle.id ? { ...s, content } : s)),
          );
        } else {
          throw new Error("No subtitle content returned");
        }
      }

      if (content && videoRef.current) {
        // Clear all existing subtitles first
        clearAllSubtitles();

        // Add the new subtitle track
        const webvtt = convertSrtToWebVtt(content);
        const track = videoRef.current.addTextTrack(
          "subtitles",
          `DB: ${subtitle.language_name}`,
          subtitle.language_code || subtitle.language,
        );
        track.mode = "showing";
        const cues = parseWebVTT(webvtt);
        cues.forEach((cue) => track.addCue(cue));
        setSelectedSubtitle(subtitle.id);
      }
    } catch {
      // Hide loading spinner on error
      setExternalLoading(false);
      // swallow error in UI
    }
  };

  if (!isOpen) return null;

  const sizeClasses =
    themeConfig.size === "large"
      ? { btn: "h-12 w-12", icon: "h-6 w-6", vol: "w-28", title: "text-xl" }
      : { btn: "h-9 w-9", icon: "h-5 w-5", vol: "w-20", title: "text-lg" };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-black ${className}`}
      style={{
        ["--theme-primary" as any]: themeConfig.primary,
        ["--theme-accent" as any]: themeConfig.accent,
        ["--theme-bg" as any]: themeConfig.bg,
        ["--theme-text" as any]: themeConfig.text,
      }}
    >
      {showControls && (
        <div className="absolute top-4 left-4 z-20">
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className={sizeClasses.icon} />
          </Button>
        </div>
      )}

      {showControls && title && (
        <div
          className="absolute top-4 left-16 z-20 rounded px-3 py-2"
          style={{ backgroundColor: themeConfig.bg }}
        >
          <h1
            className={`${sizeClasses.title} font-semibold`}
            style={{ color: themeConfig.text }}
          >
            {title}
          </h1>
        </div>
      )}

      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        src={url}
        onLoadStart={() => {
          console.log("🎬 Video load started with URL:", url);
          console.log("🎬 Video element details:", {
            src: videoRef.current?.src,
            currentSrc: videoRef.current?.currentSrc,
            networkState: videoRef.current?.networkState,
            readyState: videoRef.current?.readyState,
          });
        }}
        onError={(e) => {
          const target = e.target as HTMLVideoElement;
          console.error("🚨 Video element error:", {
            url,
            error: target.error,
            code: target.error?.code,
            message: target.error?.message,
            networkState: target.networkState,
            readyState: target.readyState,
          });

          console.error("🚨 Video playback failed:", {
            url,
            errorCode: target.error?.code,
            errorMessage: target.error?.message,
            networkState: target.networkState,
            readyState: target.readyState,
          });

          // Try to recover from playback errors
          if (target.error?.code === 2) {
            // MEDIA_ERR_NETWORK
            console.log("🔄 Network error detected, attempting recovery...");
            setTimeout(() => {
              if (target.readyState === 0 || target.networkState === 3) {
                console.log("🔄 Reloading video after network error...");
                target.load();
              }
            }, 2000);
          } else if (target.error?.code === 3) {
            // MEDIA_ERR_DECODE
            console.log("🔄 Decode error detected, this might be a codec issue");
          }
        }}
      />

      {isLoading || externalLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <LoadingSpinner size="lg" className="text-white" />
        </div>
      ) : !isPlaying ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Button
            onClick={async () => {
              const v = videoRef.current;
              if (!v) return;

              console.log("🎬 Manual play button clicked");
              setIsLoading(true);

              try {
                // Unmute and play
                v.muted = false;
                await v.play();
                console.log("✅ Manual play successful!");
              } catch (error) {
                console.log("⚠️ Manual play failed, trying muted:", error);
                try {
                  v.muted = true;
                  await v.play();
                  console.log("✅ Manual muted play successful!");
                } catch (mutedError) {
                  console.error("❌ Manual play failed completely:", mutedError);
                  setIsLoading(false);
                }
              }
            }}
            variant="ghost"
            size="icon"
            className={`${selectedTheme === "modern" ? "h-24 w-24" : "h-16 w-16"} rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30`}
          >
            <Play
              className={`${selectedTheme === "modern" ? "h-10 w-10" : "h-8 w-8"} text-white`}
            />
          </Button>
        </div>
      ) : null}

      {showControls && (
        <div
          className="absolute right-0 bottom-0 left-0 z-20 p-4"
          style={{
            background: `linear-gradient(to top, ${themeConfig.bg}, transparent)`,
          }}
        >
          <div className="mb-3">
            <div
              className="h-1 w-full cursor-pointer rounded-full bg-white/30"
              onClick={handleSeek}
            >
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${(currentTime / (duration || 1)) * 100}%`,
                  backgroundColor: themeConfig.accent,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Button
                onClick={async () => {
                  const v = videoRef.current;
                  if (!v) return;

                  if (isPlaying) {
                    v.pause();
                  } else {
                    console.log("🎬 Control bar play clicked");
                    try {
                      await v.play();
                      console.log("✅ Control bar play successful!");
                    } catch (error) {
                      console.log("⚠️ Control bar play failed:", error);
                    }
                  }
                }}
                variant="ghost"
                size="icon"
                className={`${sizeClasses.btn} rounded-full bg-white/20 hover:bg-white/30`}
              >
                {isPlaying ? (
                  <Pause className={sizeClasses.icon} />
                ) : (
                  <Play className={sizeClasses.icon} />
                )}
              </Button>

              <div className="text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <div className="ml-2 flex items-center gap-2">
                <Button
                  onClick={() => {
                    if (videoRef.current)
                      videoRef.current.muted = !videoRef.current.muted;
                  }}
                  variant="ghost"
                  size="icon"
                  className={`${themeConfig.size === "large" ? "h-10 w-10" : "h-8 w-8"} hover:bg-white/20`}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className={sizeClasses.icon} />
                  ) : (
                    <Volume2 className={sizeClasses.icon} />
                  )}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    if (videoRef.current)
                      videoRef.current.volume = parseFloat(e.target.value);
                  }}
                  className={`h-1 ${sizeClasses.vol} cursor-pointer appearance-none rounded-full bg-white/30`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Subtitles toggle */}
              <Button
                onClick={() => {
                  setShowSubtitlesPanel((p) => !p);
                  setShowThemePanel(false);
                }}
                variant="ghost"
                size="icon"
                className={`${themeConfig.size === "large" ? "h-10 w-10" : "h-8 w-8"} hover:bg-white/20`}
                title="Subtitles"
              >
                <Captions className={sizeClasses.icon} />
              </Button>
              {/* Theme toggle */}
              <Button
                onClick={() => {
                  setShowThemePanel((p) => !p);
                  setShowSubtitlesPanel(false);
                }}
                variant="ghost"
                size="icon"
                className={`${themeConfig.size === "large" ? "h-10 w-10" : "h-8 w-8"} hover:bg-white/20`}
                title="Theme"
              >
                <Palette className={sizeClasses.icon} />
              </Button>
              <Button
                onClick={() => {
                  if (isFullscreen) document.exitFullscreen?.();
                  else containerRef.current?.requestFullscreen?.();
                }}
                variant="ghost"
                size="icon"
                className={`${themeConfig.size === "large" ? "h-10 w-10" : "h-8 w-8"} hover:bg-white/20`}
              >
                {isFullscreen ? (
                  <Minimize className={sizeClasses.icon} />
                ) : (
                  <Maximize className={sizeClasses.icon} />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Subtitles panel */}
      {showSubtitlesPanel && (
        <div
          className="absolute right-4 bottom-20 z-30 w-64 rounded-lg p-3 text-sm shadow-lg"
          style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
        >
          <div className="mb-2 font-semibold">Subtitles</div>
          <button
            type="button"
            onClick={() => {
              setSelectedSubtitle(null);
              clearAllSubtitles();
            }}
            className={`block w-full rounded px-2 py-1 text-left hover:bg-white/10 ${!selectedSubtitle ? "bg-white/10" : ""}`}
          >
            Off {selectedSubtitle ? "" : "✓"}
          </button>
          {/* Supported Subtitles Section */}
          <div className="my-2 h-px w-full bg-white/10" />
          <div className="mb-1 text-xs opacity-75">✅ Original (Embedded)</div>

          {/* Original subtitles from the video source */}
          {loadingOriginalTracks && (
            <div className="px-2 py-1 text-xs opacity-70">
              Extracting original tracks...
            </div>
          )}
          {!loadingOriginalTracks && originalSubtitles.length === 0 && (
            <div className="px-2 py-1 text-xs opacity-70">
              No original subtitles found in video
            </div>
          )}
          {originalSubtitles.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => selectOriginalSubtitle(sub)}
              className={`block w-full rounded px-2 py-1 text-left hover:bg-white/10 ${selectedSubtitle === sub.id ? "bg-white/10" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">🎯 {sub.language_name}</span>
                {selectedSubtitle === sub.id && <span className="text-xs">✓</span>}
                <span className="text-xs text-green-400">●</span>
              </div>
              <div className="text-xs opacity-70">{sub.format} • Original Source</div>
            </button>
          ))}

          {/* Embedded (Browser-detected) Subtitles */}
          {embeddedSubtitles.length > 0 && (
            <>
              <div className="mt-2 mb-1 text-xs opacity-75">
                🎬 Browser-Detected Tracks
              </div>
              <div className="mb-2 text-xs opacity-60">
                <div>● = Browser compatible</div>
                <div>🖼️ = Image-based (PGS)</div>
                {pgsSupported === true && (
                  <div className="text-yellow-400">
                    🧪 = Experimental PGS support available
                  </div>
                )}
                {pgsSupported === false && <div>🚫 = Requires external player</div>}
                {pgsSupported === null && <div>🔍 = Checking PGS support...</div>}
              </div>
              {embeddedSubtitles.length === 0 && detectedEmbeddedTracks && (
                <div className="px-2 py-1 text-xs opacity-70">
                  No embedded subtitles detected
                </div>
              )}
              {!detectedEmbeddedTracks && (
                <div className="px-2 py-1 text-xs opacity-70">
                  Detecting embedded tracks...
                </div>
              )}
              {embeddedSubtitles.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => selectEmbeddedSubtitle(sub)}
                  className={`block w-full rounded px-2 py-1 text-left hover:bg-white/10 ${selectedSubtitle === sub.id ? "bg-white/10" : ""} ${sub.accessible ? "" : "opacity-75"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {sub.isPGS && "🖼️ "}
                      {sub.language_name}
                    </span>
                    {selectedSubtitle === sub.id && <span className="text-xs">✓</span>}
                    {sub.accessible && <span className="text-xs text-green-400">●</span>}
                    {sub.isPGS && pgsSupported === true && (
                      <span className="text-xs text-yellow-400">🧪</span>
                    )}
                    {sub.isPGS && pgsSupported === false && (
                      <span className="text-xs text-red-400">🚫</span>
                    )}
                    {sub.isPGS && pgsSupported === null && (
                      <span className="text-xs text-gray-400">🔍</span>
                    )}
                  </div>
                  <div className="text-xs opacity-70">
                    {sub.format}
                    {sub.codec && ` (${sub.codec})`} • {sub.source}
                    {sub.forced && <span className="ml-1 text-yellow-400">[FORCED]</span>}
                    {sub.default && <span className="ml-1 text-blue-400">[DEFAULT]</span>}
                  </div>
                  {sub.note && (
                    <div
                      className={`mt-1 text-xs ${sub.isPGS ? "text-red-300" : "opacity-50"}`}
                    >
                      {sub.note}
                    </div>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Unsupported (Downloaded) Subtitles Section */}
          <div className="my-2 h-px w-full bg-white/10" />
          <div className="mb-1 text-xs opacity-75">📥 External (Downloaded)</div>
          {loadingSubtitles && (
            <div className="px-2 py-1 text-xs opacity-70">Loading languages…</div>
          )}
          {!loadingSubtitles && databaseSubtitles.length === 0 && originalSubtitles.length === 0 && (
            <div className="px-2 py-1 text-xs opacity-70">No external subtitles found</div>
          )}
          {!loadingSubtitles && databaseSubtitles.length === 0 && originalSubtitles.length > 0 && (
            <div className="px-2 py-1 text-xs opacity-70">Using original subtitles only</div>
          )}
          {databaseSubtitles.slice(0, 5).map((sub) => {
            const isExpanded = expandedLanguages.has(sub.language_code);
            const hasVariants = sub.count && sub.count > 1;
            const variants = subtitleVariants[sub.language_code] || [];

            return (
              <div key={sub.id}>
                {/* Main language button */}
                <button
                  type="button"
                  onClick={() => {
                    if (hasVariants) {
                      toggleLanguageExpansion(sub.language_code);
                    } else {
                      selectDatabaseSubtitle(sub);
                    }
                  }}
                  className={`block w-full rounded px-2 py-1 text-left hover:bg-white/10 ${!hasVariants && selectedSubtitle === sub.id ? "bg-white/10" : ""}`}
                >
                  <span className="font-medium">
                    {hasVariants && (
                      <span className="mr-1">{isExpanded ? "▼" : "▶"}</span>
                    )}
                    {sub.content ? "📝" : "🌐"} {sub.language_name}
                  </span>
                  {sub.count && sub.count > 1 ? (
                    <span className="ml-1 text-xs opacity-70">({sub.count})</span>
                  ) : null}
                  {!hasVariants && selectedSubtitle === sub.id ? (
                    <span className="float-right">✓</span>
                  ) : null}
                </button>

                {/* Variants list (if expanded) */}
                {isExpanded && hasVariants && (
                  <div className="mt-1 ml-4 space-y-1">
                    {variants.map((variant: any) => {
                      const isVariantSelected = selectedSubtitle === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => selectSubtitleVariant(variant)}
                          className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-white/10 ${isVariantSelected ? "bg-white/10" : ""}`}
                        >
                          <span>
                            {variant.has_content ? "📝" : "🌐"}
                            {variant.source.toUpperCase()}
                            {variant.name && (
                              <span className="ml-1 opacity-75">
                                {variant.name.length > 20
                                  ? `${variant.name.substring(0, 20)}...`
                                  : variant.name}
                              </span>
                            )}
                          </span>
                          {isVariantSelected ? (
                            <span className="float-right">✓</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Theme panel */}
      {showThemePanel && (
        <div
          className="absolute right-4 bottom-20 z-30 w-56 rounded-lg p-3 text-sm shadow-lg"
          style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
        >
          <div className="mb-2 font-semibold">Theme</div>
          {["default", "modern"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTheme(t as VideoTheme)}
              className={`block w-full rounded px-2 py-1 text-left hover:bg-white/10 ${selectedTheme === t ? "bg-white/10" : ""}`}
            >
              {t === "default" ? "Default" : "Modern"} {selectedTheme === t ? "✓" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Extract and apply original subtitle track using server-side extraction
  async function extractAndApplyOriginalSubtitle(video: HTMLVideoElement, subtitle: any) {
    console.log(
      `🗜 Server-side extraction: ${subtitle.language_name} (track ${subtitle.trackIndex})`,
    );

    try {
      setExternalLoading(true);

      const result = await apiClient.extractOriginalSubtitleContent({
        subtitleId: subtitle.id,
        streamUrl: video.src,
        trackIndex: subtitle.trackIndex,
        language: subtitle.language_code,
      });

      if (result.success && result.content) {
        console.log(
          `✅ Extracted ${result.content.length} chars of original subtitle data`,
        );

        // Clear all existing subtitle tracks first
        const existingTracks = Array.from(video.textTracks);
        existingTracks.forEach((track) => {
          track.mode = "disabled";
        });
        console.log(`🧹 Cleared ${existingTracks.length} existing subtitle tracks`);

        // Create and populate text track
        const track = video.addTextTrack(
          "subtitles",
          `Original: ${subtitle.language_name}`,
          subtitle.language_code || subtitle.language,
        );
        track.mode = "showing";

        // Parse SRT format
        const cues = parseSRTToVTTCues(result.content);
        cues.forEach((cue) => track.addCue(cue));

        console.log(`✅ Successfully added ${cues.length} original subtitle cues`);
        setSelectedSubtitle(subtitle.id);
      } else {
        throw new Error(result.error || "Extraction failed");
      }
    } catch (error) {
      console.error(`❌ Server-side extraction failed:`, error);
      throw error;
    } finally {
      setExternalLoading(false);
    }
  }

  // Parse SRT subtitle data into VTTCue objects
  function parseSRTToVTTCues(srtData: string): VTTCue[] {
    const cues: VTTCue[] = [];
    const blocks = srtData.trim().split("\n\n");

    blocks.forEach((block) => {
      const lines = block.trim().split("\n");
      if (lines.length >= 3) {
        const timeCode = lines[1];
        const text = lines.slice(2).join("\n");

        // Parse SRT timecode: 00:01:23,456 --> 00:01:26,789
        const timeMatch = timeCode.match(
          /(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/,
        );
        if (timeMatch) {
          const startTime = srtTimeToSeconds(timeMatch[1], timeMatch[2]);
          const endTime = srtTimeToSeconds(timeMatch[3], timeMatch[4]);

          try {
            const cue = new VTTCue(startTime, endTime, text);
            cues.push(cue);
          } catch {
            console.log(`⚠️ Skipped invalid cue: ${timeCode}`);
          }
        }
      }
    });

    return cues;
  }

  // Convert SRT time format to seconds
  function srtTimeToSeconds(time: string, milliseconds: string): number {
    const [hours, minutes, seconds] = time.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds + Number(milliseconds) / 1000;
  }
};

VideoPlayer.displayName = "VideoPlayer";
