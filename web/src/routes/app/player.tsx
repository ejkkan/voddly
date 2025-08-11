import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VideoPlayer } from "~/components/video";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";
import { contentResolver } from "~/lib/content-resolver";
import type { PlayerContext } from "~/lib/content-types";
import { constructStreamUrl } from "~/lib/stream-url";

type VideoTheme = "default" | "modern";

interface PlayerSearchParams {
  playlist: string; // playlist/source identifier
  movie?: string; // movie content id
  series?: string; // series content id
  live?: string; // live channel id
  tmdb?: number; // TMDB ID for subtitle search
}

export const Route = createFileRoute("/app/player")({
  component: VideoPlayerRoute,
  validateSearch: (search: Record<string, unknown>): PlayerSearchParams => ({
    playlist: String(search.playlist || ""),
    movie: search.movie ? String(search.movie) : undefined,
    series: search.series ? String(search.series) : undefined,
    live: search.live ? String(search.live) : undefined,
    tmdb: search.tmdb ? Number(search.tmdb) : undefined,
  }),
});

function VideoPlayerRoute() {
  const navigate = useNavigate();
  const { playlist, movie, series, live, tmdb } = useSearch({
    from: "/app/player",
  });
  const { getCredentials } = useSourceCredentials();
  const [streamingUrl, setStreamingUrl] = useState<string>("");
  const [playerContext, setPlayerContext] = useState<PlayerContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Internal loading/error are handled implicitly by the underlying player UI
  const [, setIsLoading] = useState<boolean>(true);

  // Determine content type and ID from the provided parameters
  const contentId = movie || series || live;
  const contentType: "movie" | "series" | "live" = movie
    ? "movie"
    : series
      ? "series"
      : "live";

  // Use default theme (could be made user-configurable later)
  const theme: VideoTheme = "modern";

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        if (!playlist || !contentId) throw new Error("Missing identifiers");

        console.log("🎬 Resolving content:", { playlist, contentType, contentId, tmdb });

        // Clean the content ID - remove quotes if present
        let cleanContentId = String(contentId);
        if (cleanContentId.startsWith('"') && cleanContentId.endsWith('"')) {
          cleanContentId = cleanContentId.slice(1, -1);
          console.log("🎬 Cleaned content ID:", cleanContentId, "from", contentId);
        }

        // Resolve content using the new content resolver
        const context = await contentResolver.resolveContent(
          playlist,
          contentType,
          cleanContentId,
          tmdb,
        );

        if (!cancelled) {
          setPlayerContext(context);
          console.log("🎬 Player context resolved:", context);
        }

        // Fetch decrypted credentials for the playlist/source
        const credentials = await getCredentials(playlist, {
          title: `Play ${contentType}`,
          message: "Enter your passphrase to start playback",
        });

        // Construct stream URL using the resolved content ID (episode ID for series)
        const { streamingUrl } = constructStreamUrl({
          server: credentials.server,
          username: credentials.username,
          password: credentials.password,
          contentId: Number(context.contentId),
          contentType: context.contentType,
          containerExtension: credentials.containerExtension,
          videoCodec: credentials.videoCodec,
          audioCodec: credentials.audioCodec,
        });

        if (!cancelled) {
          console.log("🎬 Stream URL generated:", streamingUrl);
          console.log("🎬 Stream URL details:", {
            url: streamingUrl,
            length: streamingUrl.length,
            isValidUrl: streamingUrl.startsWith("http"),
            extension: streamingUrl.split(".").pop(),
          });
          setStreamingUrl(streamingUrl);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to prepare playback");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [playlist, contentId, contentType, tmdb, getCredentials]);

  const handleGoBack = () => {
    // Navigate back to the appropriate content details page based on type
    if (contentType === "movie" && movie) {
      navigate({
        to: "/app/movies/$playlistId/$movieId",
        params: { playlistId: playlist, movieId: movie },
      });
    } else if (contentType === "series" && series) {
      navigate({
        to: "/app/shows/$playlistId/$seriesId",
        params: { playlistId: playlist, seriesId: series },
      });
    } else if (contentType === "live" && live) {
      navigate({
        to: "/app/live/$playlistId/$channelId",
        params: { playlistId: playlist, channelId: live },
      });
    } else {
      // Fallback to home if type is unknown
      navigate({ to: "/app" });
    }
  };

  // Show error state if something went wrong
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="mb-4 text-red-500">❌</div>
          <div className="mb-2 text-lg font-semibold">Playback Error</div>
          <div className="mb-4 text-sm text-gray-300">{error}</div>
          <button
            onClick={() => window.history.back()}
            className="rounded bg-white px-4 py-2 text-black hover:bg-gray-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while resolving content
  if (!playerContext) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="mb-4">🎬</div>
          <div>Loading content...</div>
        </div>
      </div>
    );
  }

  // Show loading state while getting stream URL
  if (!streamingUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="mb-4">🔗</div>
          <div>Preparing stream...</div>
        </div>
      </div>
    );
  }

  // Render player with resolved context
  return (
    <VideoPlayer
      url={streamingUrl}
      title={playerContext.title}
      theme={theme}
      onBack={handleGoBack}
      autoPlay={true}
      type={playerContext.contentType}
      movieId={playerContext.contentId}
      tmdbId={playerContext.tmdbId}
      playerContext={playerContext}
    />
  );
}
