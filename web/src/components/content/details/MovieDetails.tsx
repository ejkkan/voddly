import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Play, Plus, Share } from "lucide-react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";
import { CatalogStorage } from "~/lib/catalog-storage";
import { constructStreamUrl } from "~/lib/stream-url";

export function MovieDetails() {
  const { playlistId, movieId } = useParams({ strict: false });
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { prepareContentPlayback } = useSourceCredentials();
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
  }
  const [movie, setMovie] = React.useState<LocalMovieInfo | null>(null);
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

  const canPlay = !!movie?.found;

  console.log("🎬 Movie state:", { movie, canPlay, isLoading, error });

  const handlePlayMovie = async () => {
    console.log("🎮 Play button clicked:", { playlistId, movieId, movie });
    try {
      if (!playlistId || !movieId) return;

      // Use the centralized credentials manager
      const { credentials } = await prepareContentPlayback(playlistId, movieId, "movie", {
        title: "Play Movie",
        message: "Enter your passphrase to play the movie",
      });

      const id = Number(movie?.basicInfo?.stream_id ?? movieId);
      const { streamingUrl } = constructStreamUrl({
        server: credentials.server,
        username: credentials.username,
        password: credentials.password,
        contentId: id,
        contentType: "movie",
        containerExtension: credentials.containerExtension,
        videoCodec: credentials.videoCodec,
        audioCodec: credentials.audioCodec,
      });

      console.log("🎬 Navigating to player with:", {
        streamingUrl,
        title: movie?.basicInfo?.name || `Movie ${movieId}`,
        id,
      });

      navigate({
        to: "/app/player",
        search: {
          url: streamingUrl,
          title: movie?.basicInfo?.name || `Movie ${movieId}`,
          type: "movie",
        },
      });

      console.log("✅ Navigation completed");
    } catch (e) {
      console.error("❌ Play button failed:", e);
      setError(e instanceof Error ? e.message : "Failed to prepare playback");
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
          </div>
        </div>
      </div>
    </div>
  );
}
