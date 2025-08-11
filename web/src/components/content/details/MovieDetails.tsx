import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Play, Plus, RefreshCw, Search, Share } from "lucide-react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";
import { CatalogStorage } from "~/lib/catalog-storage";
import { inspectContentMetadata, type ContentMetadata } from "~/lib/metadata-inspector";
import {
  fetchFreshContentDetails,
  type FreshContentMetadata,
} from "~/lib/source-fetcher";
import { constructStreamUrl } from "~/lib/stream-url";

export function MovieDetails() {
  const { playlistId, movieId } = useParams({ strict: false });
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { prepareContentPlayback, getCredentials } = useSourceCredentials();
  interface LocalMovieInfo {
    found: boolean;
    basicInfo?: {
      name?: string;
      stream_id?: number;
      duration?: string | number;
      rating?: string | number;
      genre?: string;
      plot?: string;
      cover?: string;
      stream_icon?: string;
    };
    // Store the raw movie data for accessing additional fields like tmdb_id
    rawData?: {
      info?: {
        tmdb_id?: string | number;
      };
      tmdb_id?: string | number;
      tmdb?: string | number; // Alternative field name for TMDB ID
      [key: string]: unknown;
    };
  }
  const [movie, setMovie] = React.useState<LocalMovieInfo | null>(null);
  const [metadata, setMetadata] = React.useState<ContentMetadata | null>(null);
  const [isInspectingMetadata, setIsInspectingMetadata] = React.useState(false);
  const [showMetadata, setShowMetadata] = React.useState(false);
  const [freshData, setFreshData] = React.useState<FreshContentMetadata | null>(null);
  const [isFetchingFresh, setIsFetchingFresh] = React.useState(false);
  const [showFreshData, setShowFreshData] = React.useState(false);
  // stream URL is constructed on Play and immediately used for navigation

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        if (!playlistId || !movieId) return;

        console.log("🎬 Loading movie details:", { playlistId, movieId });
        const storage = new CatalogStorage();
        await storage.init();
        const item = await storage.getContentItem(
          String(playlistId),
          "movie",
          String(movieId),
        );
        console.log("🎬 Movie item from storage:", item);
        console.log("🎬 Movie item.data structure:", item?.data);
        if (!cancelled) {
          if (!item) {
            console.error("❌ Movie not found in catalog:", { playlistId, movieId });
            setError("Movie not found in local catalog");
            setMovie(null);
          } else {
            setMovie({
              found: true,
              basicInfo: {
                name: item.data?.name ?? item.title ?? `Movie ${movieId}`,
                stream_id: item.data?.stream_id ?? Number(movieId),
                duration: item.data?.duration,
                rating: item.data?.rating,
                genre: item.data?.genre,
                plot: item.data?.plot,
                cover: item.data?.cover,
                stream_icon: item.data?.stream_icon,
              },
              rawData: item.data, // Store the complete movie data
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [playlistId, movieId]);

  const handleInspectMetadata = async () => {
    if (!playlistId || !movieId || !movie?.found) return;

    try {
      setIsInspectingMetadata(true);
      setError(null);

      console.log("🔍 Inspecting metadata for movie:", movie.basicInfo?.name);

      // Get credentials and construct stream URL
      const credentials = await getCredentials(playlistId, {
        title: "Inspect Metadata",
        message: "Enter your passphrase to inspect content metadata",
      });

      const { streamingUrl } = constructStreamUrl({
        server: credentials.server,
        username: credentials.username,
        password: credentials.password,
        contentId: Number(movieId),
        contentType: "movie",
        containerExtension: credentials.containerExtension,
        videoCodec: credentials.videoCodec,
        audioCodec: credentials.audioCodec,
      });

      console.log("🔗 Inspecting stream URL:", streamingUrl);

      // Inspect the metadata
      const contentMetadata = await inspectContentMetadata(
        streamingUrl,
        "movie",
        movie.basicInfo?.name,
      );

      setMetadata(contentMetadata);
      setShowMetadata(true);

      console.log("✅ Metadata inspection complete:", contentMetadata);
    } catch (error) {
      console.error("❌ Metadata inspection failed:", error);
      setError(error instanceof Error ? error.message : "Failed to inspect metadata");
    } finally {
      setIsInspectingMetadata(false);
    }
  };

  const handleFetchFresh = async () => {
    if (!playlistId || !movieId) return;

    try {
      setIsFetchingFresh(true);
      setError(null);

      console.log("🔄 Fetching fresh data for movie:", movieId);

      // Get credentials
      const credentials = await getCredentials(playlistId, {
        title: "Fetch Fresh Data",
        message: "Enter your passphrase to fetch fresh data from source",
      });

      // Fetch fresh data with stream metadata
      const freshContentData = await fetchFreshContentDetails(
        credentials,
        String(movieId),
        "movie",
        true, // Include stream metadata
      );

      setFreshData(freshContentData);
      setShowFreshData(true);

      // Update the catalog storage with the fresh data (including TMDB info)
      try {
        const storage = new CatalogStorage();
        await storage.init();
        const sourceInfo = await storage.getStorageInfo();
        const currentSource = sourceInfo.sources.find((s) => s.sourceId === playlistId);
        if (currentSource) {
          await storage.updateContentItemWithFreshData(
            playlistId,
            String(movieId),
            "movie",
            freshContentData,
          );
          console.log("📚 Updated catalog storage with fresh TMDB data");
        }
      } catch (updateError) {
        console.warn("Failed to update catalog with fresh data:", updateError);
      }

      console.log("✅ Fresh data fetch complete:", freshContentData);
    } catch (error) {
      console.error("❌ Fresh data fetch failed:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch fresh data");
    } finally {
      setIsFetchingFresh(false);
    }
  };

  const canPlay = !!movie?.found;

  console.log("🎬 Movie state:", { movie, canPlay, isLoading, error });

  const handlePlayMovie = async () => {
    console.log("🎮 Play button clicked:", { playlistId, movieId, movie });

    // Extract tmdb_id early for debugging
    let tmdbId: number | undefined;
    if (movie?.rawData?.tmdb) {
      tmdbId = Number(movie.rawData.tmdb);
      console.log("🎬 TMDB ID extracted:", tmdbId);
    }

    try {
      if (!playlistId || !movieId) return;

      // Use the centralized credentials manager to verify access
      await prepareContentPlayback(playlistId, movieId, "movie", {
        title: "Play Movie",
        message: "Enter your passphrase to play the movie",
      });

      const id = Number(movie?.basicInfo?.stream_id ?? movieId);

      // We already extracted tmdbId above, but let's also try other sources
      if (!tmdbId && freshData?.sourceData?.detailed?.info?.tmdb_id) {
        tmdbId = Number(freshData.sourceData.detailed.info.tmdb_id);
        console.log("🎬 TMDB ID from freshData:", tmdbId);
      }
      if (!tmdbId && movie?.rawData?.info?.tmdb_id) {
        tmdbId = Number(movie.rawData.info.tmdb_id);
        console.log("🎬 TMDB ID from stored data (info.tmdb_id):", tmdbId);
      }
      if (!tmdbId && movie?.rawData?.tmdb_id) {
        tmdbId = Number(movie.rawData.tmdb_id);
        console.log("🎬 TMDB ID from root level (tmdb_id):", tmdbId);
      }

      console.log("🎬 Final TMDB ID for navigation:", tmdbId);

      // Navigate with SAFE identifiers only; stream URL is constructed in the player route
      navigate({
        to: "/app/player",
        search: {
          playlist: String(playlistId),
          movie: String(movieId), // Use original movie ID - player route will resolve stream ID
          tmdb: tmdbId, // Pass TMDB ID for subtitle fetching
        },
      });

      console.log("✅ Navigation completed");
    } catch (e) {
      console.error("❌ Play button failed:", e);
      setError(e instanceof Error ? e.message : "Failed to prepare playbook");
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="relative">
        <div className="border-border flex items-center gap-4 border-b p-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/movies">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-foreground text-2xl font-semibold">Movie Details</h1>
        </div>

        <div className="p-6">
          <div className="mx-auto max-w-6xl">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : error || !movie?.found ? (
              <div className="py-12 text-center">
                <div className="text-destructive mb-2">Failed to load movie</div>
                <div className="text-muted-foreground text-sm">
                  {error ?? "Unknown error"}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <div className="bg-muted flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg border">
                    {movie?.basicInfo?.cover || movie?.basicInfo?.stream_icon ? (
                      <img
                        src={movie.basicInfo.cover || movie.basicInfo.stream_icon}
                        alt={movie.basicInfo?.name || `Movie ${movieId}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    {!(movie?.basicInfo?.cover || movie?.basicInfo?.stream_icon) && (
                      <div className="text-center">
                        <Play className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                        <p className="text-muted-foreground">Movie Poster</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 lg:col-span-2">
                  <div>
                    <h2 className="text-foreground mb-2 text-3xl font-bold">
                      {movie.basicInfo?.name || `Movie ${movieId}`}
                    </h2>
                    <div className="text-muted-foreground flex items-center gap-4">
                      {movie.basicInfo?.duration != null ? (
                        <span>{String(movie.basicInfo.duration)}</span>
                      ) : null}
                      {movie.basicInfo?.rating != null ? (
                        <>
                          <span>•</span>
                          <span>⭐ {String(movie.basicInfo.rating)}</span>
                        </>
                      ) : null}
                      <span>•</span>
                      <span>HD</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={handlePlayMovie}
                      disabled={false}
                    >
                      <Play className="h-5 w-5 fill-current" />
                      {canPlay ? "Play Now" : "Unavailable"}
                    </Button>

                    <Button variant="outline" size="lg" className="gap-2">
                      <Plus className="h-5 w-5" />
                      Add to List
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      onClick={handleInspectMetadata}
                      disabled={isInspectingMetadata || !canPlay}
                    >
                      {isInspectingMetadata ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Search className="h-5 w-5" />
                      )}
                      {isInspectingMetadata ? "Inspecting..." : "Inspect Metadata"}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      onClick={handleFetchFresh}
                      disabled={isFetchingFresh || !playlistId || !movieId}
                    >
                      {isFetchingFresh ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <RefreshCw className="h-5 w-5" />
                      )}
                      {isFetchingFresh ? "Fetching..." : "Fetch Fresh"}
                    </Button>
                    <Button variant="outline" size="lg" className="gap-2">
                      <Share className="h-5 w-5" />
                      Share
                    </Button>
                  </div>

                  {movie.basicInfo?.plot && (
                    <div>
                      <h3 className="text-foreground mb-2 text-lg font-semibold">
                        Synopsis
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {movie.basicInfo.plot}
                      </p>
                    </div>
                  )}

                  <div className="bg-card border-border rounded-lg border p-4">
                    <h3 className="text-foreground mb-3 font-semibold">Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Movie ID:</span>
                        <span className="text-foreground ml-2">{movieId}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stream ID:</span>
                        <span className="text-foreground ml-2">
                          {movie.basicInfo?.stream_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Genre:</span>
                        <span className="text-foreground ml-2">
                          {movie.basicInfo?.genre || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className="ml-2 text-green-600">
                          {canPlay ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata Display Panel */}
            {showMetadata && metadata && (
              <div className="mx-auto mt-8 max-w-6xl">
                <div className="bg-muted/50 rounded-lg border p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      🔍 Content Metadata Analysis
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMetadata(false)}
                    >
                      Close
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Basic Information */}
                    <div className="space-y-3">
                      <h4 className="text-foreground font-medium">
                        📄 Stream Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Format:</span>
                          <span>{metadata.format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span>
                            {metadata.streamInfo.isHLS && "HLS Stream"}
                            {metadata.streamInfo.isDASH && "DASH Stream"}
                            {metadata.streamInfo.isDirectVideo && "Direct Video File"}
                          </span>
                        </div>
                        {metadata.duration ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration:</span>
                            <span>
                              {Math.floor(metadata.duration / 60)}:
                              {String(Math.floor(metadata.duration % 60)).padStart(
                                2,
                                "0",
                              )}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Audio Tracks */}
                    <div className="space-y-3">
                      <h4 className="text-foreground font-medium">
                        🎵 Audio Tracks ({metadata.audioTracks.length})
                      </h4>
                      <div className="max-h-32 space-y-2 overflow-y-auto text-sm">
                        {metadata.audioTracks.length === 0 ? (
                          <p className="text-muted-foreground italic">
                            No audio tracks detected
                          </p>
                        ) : (
                          metadata.audioTracks.map((track, index) => (
                            <div
                              key={`audio-${track.language}-${track.codec}-${index}`}
                              className="bg-background rounded border p-2"
                            >
                              <div className="flex items-start justify-between">
                                <span className="font-medium">{track.language}</span>
                                {track.default && (
                                  <span className="rounded bg-blue-500 px-1 text-xs text-white">
                                    DEFAULT
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground mt-1 text-xs">
                                {track.codec} • {track.channels}ch
                                {track.bandwidth > 0 &&
                                  ` • ${Math.round(track.bandwidth / 1000)}kbps`}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Video Tracks */}
                    <div className="space-y-3">
                      <h4 className="text-foreground font-medium">
                        📺 Video Tracks ({metadata.videoTracks.length})
                      </h4>
                      <div className="max-h-32 space-y-2 overflow-y-auto text-sm">
                        {metadata.videoTracks.length === 0 ? (
                          <p className="text-muted-foreground italic">
                            No video tracks detected
                          </p>
                        ) : (
                          metadata.videoTracks.map((track, index) => (
                            <div
                              key={`video-${track.width}x${track.height}-${track.codec}-${index}`}
                              className="bg-background rounded border p-2"
                            >
                              <div className="font-medium">
                                {track.width}x{track.height}
                              </div>
                              <div className="text-muted-foreground mt-1 text-xs">
                                {track.codec}
                                {track.bandwidth > 0 &&
                                  ` • ${Math.round(track.bandwidth / 1000)}kbps`}
                                {track.frameRate > 0 && ` • ${track.frameRate}fps`}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Subtitle Tracks */}
                    <div className="space-y-3">
                      <h4 className="text-foreground font-medium">
                        📝 Subtitle Tracks ({metadata.subtitleTracks.length})
                      </h4>
                      <div className="max-h-32 space-y-2 overflow-y-auto text-sm">
                        {metadata.subtitleTracks.length === 0 ? (
                          <p className="text-muted-foreground italic">
                            No subtitle tracks detected
                          </p>
                        ) : (
                          metadata.subtitleTracks.map((track, index) => (
                            <div
                              key={`subtitle-${track.language}-${track.format}-${index}`}
                              className="bg-background rounded border p-2"
                            >
                              <div className="flex items-start justify-between">
                                <span className="font-medium">{track.language}</span>
                                <div className="flex gap-1">
                                  {track.forced && (
                                    <span className="rounded bg-red-500 px-1 text-xs text-white">
                                      FORCED
                                    </span>
                                  )}
                                  {track.default && (
                                    <span className="rounded bg-blue-500 px-1 text-xs text-white">
                                      DEFAULT
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-muted-foreground mt-1 text-xs">
                                {track.format}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* MKV-specific recommendations */}
                  {metadata.format === "MKV" && (
                    <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                      <h4 className="mb-2 font-medium text-yellow-800 dark:text-yellow-200">
                        📁 MKV Multi-Language File Detected
                      </h4>
                      <p className="mb-2 text-sm text-yellow-700 dark:text-yellow-300">
                        This MKV file likely contains embedded multi-language audio and
                        subtitles that browsers cannot access directly.
                      </p>
                      <div className="space-y-1 text-xs text-yellow-600 dark:text-yellow-400">
                        <p>
                          • Browser players cannot switch between embedded audio tracks
                        </p>
                        <p>• Embedded subtitles may not be selectable</p>
                        <p>
                          • This explains why audio/subtitle options don't appear in the
                          player
                        </p>
                        <p>
                          • Professional media players (VLC, etc.) can access all embedded
                          tracks
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Raw Data */}
                  <details className="mt-6">
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
                      🔧 Technical Details (Click to expand)
                    </summary>
                    <pre className="bg-background mt-2 max-h-40 overflow-auto rounded border p-3 text-xs">
                      {JSON.stringify(metadata.rawData, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            )}

            {/* Fresh Data Display Panel */}
            {showFreshData && freshData && (
              <div className="mx-auto mt-8 max-w-6xl">
                <div className="bg-muted/50 rounded-lg border p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">🔄 Fresh Source Data</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFreshData(false)}
                    >
                      Close
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Fresh Content Information */}
                    <div className="space-y-3">
                      <h4 className="text-foreground font-medium">
                        📄 Fresh Content Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Source:</span>
                          <span className="font-medium text-green-600">
                            {freshData.fetchSource}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fetched:</span>
                          <span>{freshData.fetchedAt.toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Title:</span>
                          <span className="max-w-[200px] truncate text-right">
                            {freshData.title}
                          </span>
                        </div>
                        {freshData.rating && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rating:</span>
                            <span>⭐ {freshData.rating}</span>
                          </div>
                        )}
                        {freshData.genre && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Genre:</span>
                            <span className="max-w-[200px] truncate text-right">
                              {freshData.genre}
                            </span>
                          </div>
                        )}
                        {freshData.duration ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration:</span>
                            <span>{freshData.duration}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Stream Metadata (if available) */}
                    {freshData.streamMetadata && (
                      <div className="space-y-3">
                        <h4 className="text-foreground font-medium">
                          🎬 Stream Analysis
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Format:</span>
                            <span>{freshData.streamMetadata.format}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Audio Tracks:</span>
                            <span>{freshData.streamMetadata.audioTracks.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Video Tracks:</span>
                            <span>{freshData.streamMetadata.videoTracks.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtitles:</span>
                            <span>{freshData.streamMetadata.subtitleTracks.length}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Video Information */}
                  {freshData.videoInfo && (
                    <div className="mt-6">
                      <h4 className="text-foreground mb-3 font-medium">
                        🎬 Video Details
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resolution:</span>
                          <span className="font-medium">
                            {freshData.videoInfo.width}x{freshData.videoInfo.height}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Codec:</span>
                          <span>{freshData.videoInfo.codec.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frame Rate:</span>
                          <span>{freshData.videoInfo.frameRate}fps</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HDR:</span>
                          <span>{freshData.videoInfo.isHDR ? "✅ Yes" : "❌ No"}</span>
                        </div>
                        {freshData.videoInfo.colorSpace && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Color Space:</span>
                            <span>{freshData.videoInfo.colorSpace}</span>
                          </div>
                        )}
                        {freshData.videoInfo.bitrate > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bitrate:</span>
                            <span>
                              {Math.round(freshData.videoInfo.bitrate / 1000000)}Mbps
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Audio Information */}
                  {freshData.primaryAudioInfo && (
                    <div className="mt-6">
                      <h4 className="text-foreground mb-3 font-medium">
                        🎵 Primary Audio Track
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Language:</span>
                          <span className="font-medium">
                            {freshData.primaryAudioInfo.language.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Codec:</span>
                          <span>{freshData.primaryAudioInfo.codec.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Channels:</span>
                          <span>
                            {freshData.primaryAudioInfo.channels}ch (
                            {freshData.primaryAudioInfo.channelLayout || "Unknown"})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sample Rate:</span>
                          <span>{freshData.primaryAudioInfo.sampleRate}Hz</span>
                        </div>
                        {freshData.primaryAudioInfo.bitrate > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bitrate:</span>
                            <span>
                              {Math.round(freshData.primaryAudioInfo.bitrate / 1000)}kbps
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Available Audio Tracks */}
                  {freshData.availableAudioTracks &&
                    freshData.availableAudioTracks.length > 1 && (
                      <div className="mt-6">
                        <h4 className="text-foreground mb-3 font-medium">
                          🎶 Available Audio Tracks (
                          {freshData.availableAudioTracks.length})
                        </h4>
                        <div className="space-y-2">
                          {freshData.availableAudioTracks.map((track, index) => (
                            <div
                              key={track.index || index}
                              className="bg-background rounded border p-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {track.language.toUpperCase()}{" "}
                                  {track.codec.toUpperCase()}
                                </span>
                                {track.default && (
                                  <span className="rounded bg-blue-500 px-2 py-1 text-xs text-white">
                                    DEFAULT
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground mt-1 text-xs">
                                {track.channels}ch • {track.sampleRate}Hz
                                {track.bitrate > 0 &&
                                  ` • ${Math.round(track.bitrate / 1000)}kbps`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Available Subtitle Tracks */}
                  {freshData.availableSubtitleTracks &&
                    freshData.availableSubtitleTracks.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-foreground mb-3 font-medium">
                          📝 Available Subtitle Tracks (
                          {freshData.availableSubtitleTracks.length})
                        </h4>
                        <div className="space-y-2">
                          {freshData.availableSubtitleTracks.map((track, index) => (
                            <div
                              key={track.index || index}
                              className="bg-background rounded border p-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {track.language.toUpperCase()}{" "}
                                  {track.format.toUpperCase()}
                                </span>
                                <div className="flex gap-1">
                                  {track.forced && (
                                    <span className="rounded bg-red-500 px-2 py-1 text-xs text-white">
                                      FORCED
                                    </span>
                                  )}
                                  {track.default && (
                                    <span className="rounded bg-blue-500 px-2 py-1 text-xs text-white">
                                      DEFAULT
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Container Information */}
                  {freshData.containerInfo && (
                    <div className="mt-6">
                      <h4 className="text-foreground mb-3 font-medium">
                        📦 Container Information
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium">
                            {freshData.containerInfo.format.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Multi-Language:</span>
                          <span>
                            {freshData.containerInfo.isMultiLanguage ? "✅ Yes" : "❌ No"}
                          </span>
                        </div>
                        {freshData.containerInfo.totalBitrate > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Bitrate:</span>
                            <span>
                              {Math.round(freshData.containerInfo.totalBitrate / 1000)}
                              kbps
                            </span>
                          </div>
                        )}
                        {freshData.containerInfo.encodingApp && (
                          <div className="col-span-2 flex justify-between">
                            <span className="text-muted-foreground">Encoded with:</span>
                            <span className="max-w-[200px] truncate text-right">
                              {freshData.containerInfo.encodingApp}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fresh Description */}
                  {freshData.description && (
                    <div className="mt-6">
                      <h4 className="text-foreground mb-2 font-medium">
                        📝 Fresh Description
                      </h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {freshData.description}
                      </p>
                    </div>
                  )}

                  {/* Comparison with Cached Data */}
                  {movie?.basicInfo && (
                    <div className="mt-6">
                      <h4 className="text-foreground mb-3 font-medium">
                        🔄 Data Comparison
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-yellow-600">
                            Cached Data
                          </h5>
                          <div className="bg-background rounded border p-3 text-xs">
                            <div>
                              <strong>Title:</strong> {movie.basicInfo.name || "N/A"}
                            </div>
                            <div>
                              <strong>Rating:</strong> {movie.basicInfo.rating || "N/A"}
                            </div>
                            <div>
                              <strong>Genre:</strong> {movie.basicInfo.genre || "N/A"}
                            </div>
                            <div>
                              <strong>Description:</strong>{" "}
                              {movie.basicInfo.plot
                                ? movie.basicInfo.plot.length > 100
                                  ? movie.basicInfo.plot.substring(0, 100) + "..."
                                  : movie.basicInfo.plot
                                : "N/A"}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-green-600">
                            Fresh Data
                          </h5>
                          <div className="bg-background rounded border p-3 text-xs">
                            <div>
                              <strong>Title:</strong> {freshData.title}
                            </div>
                            <div>
                              <strong>Rating:</strong> {freshData.rating || "N/A"}
                            </div>
                            <div>
                              <strong>Genre:</strong> {freshData.genre || "N/A"}
                            </div>
                            <div>
                              <strong>Description:</strong>{" "}
                              {freshData.description
                                ? freshData.description.length > 100
                                  ? freshData.description.substring(0, 100) + "..."
                                  : freshData.description
                                : "N/A"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Raw Source Data */}
                  <details className="mt-6">
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
                      🔧 Raw Source Data (Click to expand)
                    </summary>
                    <pre className="bg-background mt-2 max-h-40 overflow-auto rounded border p-3 text-xs">
                      {JSON.stringify(freshData.sourceData, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
