import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ExternalLink, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";

interface PlayerSearchParams {
  url: string;
  title: string;
  type: "movie" | "series" | "live";
}

export const Route = createFileRoute("/app/player")({
  component: VideoPlayer,
  validateSearch: (search: Record<string, unknown>): PlayerSearchParams => ({
    url: (search.url as string) || "",
    title: (search.title as string) || "Video Player",
    type: (search.type as "movie" | "series" | "live") || "movie",
  }),
});

function VideoPlayer() {
  const navigate = useNavigate();
  const { url, title, type } = useSearch({ from: "/app/player" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Clean up the video URL by removing .undefined extension
  const cleanVideoUrl = url?.replace(/\.undefined$/, "") || "";

  // Log the URL for debugging
  console.log("🎥 Video Player URL:", cleanVideoUrl);
  console.log("🎥 Video Player Title:", title);
  console.log("🎥 Video Player Type:", type);

  // Helper function to clear loading state
  const clearLoadingState = (reason: string) => {
    console.log(`Clearing loading state: ${reason}`);
    setIsLoading(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  };

  // Reset state when URL changes
  useEffect(() => {
    if (cleanVideoUrl) {
      setVideoError(null);
      setIsLoading(true);

      // Set a loading timeout (30 seconds)
      loadingTimeoutRef.current = setTimeout(() => {
        if (isLoading && !videoError) {
          setIsLoading(false);
          setVideoError(
            "Video is taking too long to load. The streaming server may be slow or unavailable.",
          );
        }
      }, 30000);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [cleanVideoUrl, isLoading, videoError]);

  // Handle ESC key press to go back
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate({ to: "..", from: "/app/player" });
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [navigate]);

  const handleRetry = () => {
    console.log("Retrying video load...");
    setVideoError(null);
    setIsLoading(true);
    if (videoRef.current) {
      // Force reload by setting src again
      videoRef.current.src = cleanVideoUrl;
      videoRef.current.load();
    }
  };

  const handleTryHLS = () => {
    const hlsUrl = cleanVideoUrl.replace(/\.(mp4|mkv|avi)$/, ".m3u8");
    console.log("Trying HLS version:", hlsUrl);
    setVideoError(null);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.src = hlsUrl;
      videoRef.current.load();
    }
  };

  const handleTryTS = () => {
    const tsUrl = cleanVideoUrl.replace(/\.(mp4|mkv|avi)$/, ".ts");
    console.log("Trying TS version:", tsUrl);
    setVideoError(null);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.src = tsUrl;
      videoRef.current.load();
    }
  };

  const handleOpenExternal = () => {
    window.open(cleanVideoUrl, "_blank");
  };

  const handleTestUrl = async () => {
    console.log("🔍 Testing stream URL accessibility...");
    try {
      const response = await fetch(cleanVideoUrl, {
        method: "HEAD",
        mode: "no-cors", // Avoid CORS issues for testing
      });
      console.log("✅ Stream URL test result:", response.status);
    } catch (error) {
      console.error("❌ Stream URL test failed:", error);
      // Try a different approach - just log the attempt
      console.log("🔗 Stream URL to test manually:", cleanVideoUrl);
    }
  };

  const handleGoBack = () => {
    navigate({ to: "..", from: "/app/player" });
  };

  if (!cleanVideoUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center text-white">
          <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h2 className="mb-2 text-xl font-semibold">No Video URL</h2>
          <p className="mb-4 text-gray-300">No video URL was provided for playback.</p>
          <Button onClick={handleGoBack} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black">
      {/* Header Controls */}
      <div className="absolute top-0 right-0 left-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleGoBack}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="text-white">
              <h1 className="truncate text-lg font-semibold">{title}</h1>
              <p className="text-sm text-gray-300 capitalize">{type}</p>
            </div>
          </div>

          <div className="text-xs text-gray-400">Press ESC to exit</div>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative h-screen w-full">
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          controls
          autoPlay
          preload="metadata"
          controlsList="nodownload"
          crossOrigin="anonymous"
          playsInline
          onLoadStart={() => {
            console.log("Video load started:", cleanVideoUrl);
            setIsLoading(true);
            setVideoError(null);
            // Clear any existing timeout
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
          }}
          onCanPlay={() => clearLoadingState("Video can play")}
          onLoadedData={() => clearLoadingState("Video loaded data")}
          onPlay={() => clearLoadingState("Video started playing")}
          onPlaying={() => clearLoadingState("Video is actively playing")}
          onTimeUpdate={() => {
            // Only clear loading if video is actually playing and has progressed
            if (
              videoRef.current &&
              videoRef.current.currentTime > 0 &&
              !videoRef.current.paused
            ) {
              clearLoadingState("Video time update - playing");
            }
          }}
          onError={(e) => {
            console.error("Video playback error:", e);
            console.log("Failed URL:", cleanVideoUrl);

            const video = e.currentTarget as HTMLVideoElement;
            const error = video.error;

            // Log detailed error information
            console.log("Video error details:", {
              code: error?.code,
              message: error?.message,
              networkState: video.networkState,
              readyState: video.readyState,
              currentSrc: video.currentSrc,
            });

            clearLoadingState("Video error occurred");

            // Prevent multiple error handlers from firing
            if (videoError) return;

            let errorMessage = "Unable to load IPTV stream";

            if (error) {
              switch (error.code) {
                case error.MEDIA_ERR_ABORTED:
                  errorMessage = "Stream loading was cancelled";
                  break;
                case error.MEDIA_ERR_NETWORK:
                  errorMessage = "Network error - IPTV server may be unreachable";
                  break;
                case error.MEDIA_ERR_DECODE:
                  errorMessage = "Video codec not supported - try a different player";
                  break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMessage = "IPTV stream format not supported by browser";
                  break;
                default:
                  errorMessage = "IPTV stream playback failed";
              }
            }

            setVideoError(errorMessage);
          }}
        >
          <source src={cleanVideoUrl} type="video/mp4" />
          <source
            src={cleanVideoUrl.replace(/\.(mp4|mkv|avi)$/, ".m3u8")}
            type="application/x-mpegURL"
          />
          <source
            src={cleanVideoUrl.replace(/\.(mp4|mkv|avi)$/, ".ts")}
            type="video/mp2t"
          />
          <track kind="captions" srcLang="en" label="English" />
          Your browser does not support the video tag or IPTV streaming.
        </video>

        {/* Loading overlay */}
        {isLoading && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <div className="space-y-4 text-center">
              <LoadingSpinner size="lg" className="mx-auto" />
              <div className="space-y-2 text-white">
                <p className="text-lg font-medium">Loading video...</p>
                <p className="text-sm text-white/70">Connecting to streaming server...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="max-w-md space-y-6 p-8 text-center text-white">
              <div className="flex justify-center">
                <AlertTriangle className="h-16 w-16 text-red-400" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Playback Error</h3>
                <p className="text-white/70">{videoError}</p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    onClick={handleRetry}
                    variant="default"
                    size="sm"
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                  <Button onClick={handleTryHLS} variant="secondary" size="sm">
                    Try HLS
                  </Button>
                  <Button onClick={handleTryTS} variant="secondary" size="sm">
                    Try TS
                  </Button>
                  <Button
                    onClick={handleOpenExternal}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    External
                  </Button>
                  <Button onClick={handleTestUrl} variant="outline" size="sm">
                    Test URL
                  </Button>
                </div>

                <div className="space-y-2 text-xs text-white/50">
                  <div className="rounded bg-black/50 p-2 text-left font-mono break-all text-white/70">
                    {cleanVideoUrl}
                  </div>
                  <p>IPTV streams may require specific players like VLC or Kodi</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
