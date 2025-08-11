import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Play, Plus, RefreshCw, Search, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useSession } from "~/hooks/useAuth";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";
import { apiClient } from "~/lib/api-client";
import { CatalogStorage } from "~/lib/catalog-storage";
import { inspectContentMetadata, type ContentMetadata } from "~/lib/metadata-inspector";
import {
  fetchFreshContentDetails,
  type FreshContentMetadata,
} from "~/lib/source-fetcher";
import { constructStreamUrl } from "~/lib/stream-url";

export function SeriesDetails() {
  const { playlistId, seriesId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: session } = useSession();
  const isAuthenticated = !!session;
  const [series, setSeries] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [isInspectingMetadata, setIsInspectingMetadata] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [freshData, setFreshData] = useState<FreshContentMetadata | null>(null);
  const [isFetchingFresh, setIsFetchingFresh] = useState(false);
  const [showFreshData, setShowFreshData] = useState(false);
  const { getCredentials, prepareContentPlayback } = useSourceCredentials();

  useEffect(() => {
    if (!playlistId || !seriesId) return;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const storage = new CatalogStorage();
        await storage.init();
        const item = await storage.getContentItem(
          String(playlistId),
          "series",
          String(seriesId),
        );
        if (!item) {
          setSeries(null);
          setError("Series not found in local catalog");
        } else {
          // Set basic info first
          const basicSeriesInfo = {
            found: true,
            basicInfo: {
              name: item.data?.name ?? item.title ?? `Series ${seriesId}`,
              series_id: item.data?.series_id ?? Number(seriesId),
              rating: item.data?.rating,
              plot: item.data?.plot,
              cast: item.data?.cast,
              director: item.data?.director,
              genre: item.data?.genre,
              release_date: item.data?.release_date,
              cover: item.data?.cover,
              backdrop_path: item.data?.backdrop_path,
            },
            seasons: item.data?.seasons ?? [],
            totalSeasons: item.data?.totalSeasons ?? 0,
            totalEpisodes: item.data?.totalEpisodes ?? 0,
          };
          setSeries(basicSeriesInfo);

          // If we don't have detailed episode information, fetch it from source
          if (
            !basicSeriesInfo.seasons ||
            basicSeriesInfo.seasons.length === 0 ||
            !basicSeriesInfo.seasons.some(
              (season: any) => season.episodes && season.episodes.length > 0,
            )
          ) {
            await fetchDetailedSeriesInfo(basicSeriesInfo);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [playlistId, seriesId]);

  const fetchDetailedSeriesInfo = async (currentSeriesInfo: any) => {
    try {
      setIsLoadingDetails(true);

      if (!playlistId) throw new Error("Playlist ID not available");

      // Get credentials using centralized manager
      const credentials = await getCredentials(playlistId, {
        title: "Fetch Series Details",
        message: "Enter your passphrase to fetch detailed series information",
      });

      // Fetch detailed series information from Xtream API
      const detailedSeriesResponse = await apiClient.getSeriesDetails({
        server: credentials.server,
        username: credentials.username,
        password: credentials.password,
        seriesId: Number(seriesId),
      });

      if (detailedSeriesResponse.found && detailedSeriesResponse.seriesData) {
        // Merge the detailed information with what we already have
        setSeries((prevSeries: any) => ({
          ...prevSeries,
          basicInfo: {
            ...prevSeries.basicInfo,
            ...detailedSeriesResponse.seriesData.basicInfo,
          },
          seasons: detailedSeriesResponse.seriesData.seasons,
          totalSeasons: detailedSeriesResponse.seriesData.totalSeasons,
          totalEpisodes: detailedSeriesResponse.seriesData.totalEpisodes,
          serverUsed: detailedSeriesResponse.seriesData.serverUsed,
        }));
      }
    } catch (err) {
      console.warn("Failed to fetch detailed series info:", err);
      // Don't set error state, just keep the basic info we have
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleInspectMetadata = async () => {
    if (!playlistId || !seriesId || !series?.found) return;

    try {
      setIsInspectingMetadata(true);
      setError(null);

      console.log("🔍 Inspecting metadata for series:", series.basicInfo?.name);

      // Get credentials and construct stream URL for first episode
      const credentials = await getCredentials(playlistId, {
        title: "Inspect Metadata",
        message: "Enter your passphrase to inspect content metadata",
      });

      // Use first episode if available; otherwise fall back to series id
      const firstEpisode = series?.seasons?.[0]?.episodes?.[0];
      let episodeId =
        firstEpisode?.id ?? firstEpisode?.stream_id ?? series?.basicInfo?.series_id;

      // Clean up the episode ID
      if (typeof episodeId === "string") {
        episodeId = episodeId.replace(/^["']|["']$/g, "");
        episodeId = Number(episodeId);
      }

      const { streamingUrl } = constructStreamUrl({
        server: credentials.server,
        username: credentials.username,
        password: credentials.password,
        contentId: Number(episodeId),
        contentType: "series",
        containerExtension: credentials.containerExtension,
        videoCodec: credentials.videoCodec,
        audioCodec: credentials.audioCodec,
      });

      console.log("🔗 Inspecting stream URL:", streamingUrl);

      // Inspect the metadata
      const contentMetadata = await inspectContentMetadata(
        streamingUrl,
        "series",
        series.basicInfo?.name,
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
    if (!playlistId || !seriesId) return;

    try {
      setIsFetchingFresh(true);
      setError(null);

      console.log("🔄 Fetching fresh data for series:", seriesId);

      // Get credentials
      const credentials = await getCredentials(playlistId, {
        title: "Fetch Fresh Data",
        message: "Enter your passphrase to fetch fresh data from source",
      });

      // Fetch fresh data with stream metadata
      const freshContentData = await fetchFreshContentDetails(
        credentials,
        String(seriesId),
        "series",
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
            String(seriesId),
            "series",
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

  const handlePlayEpisode = async () => {
    try {
      if (!playlistId || !seriesId || !series) return;

      // Use the centralized credentials manager
      const { credentials } = await prepareContentPlayback(
        playlistId,
        seriesId,
        "series",
        {
          title: "Play Episode",
          message: "Enter your passphrase to play the episode",
        },
      );

      // Use first episode if seasons/episodes exist; otherwise fall back to series id
      const firstEpisode = series?.seasons?.[0]?.episodes?.[0];
      let episodeId =
        firstEpisode?.id ?? firstEpisode?.stream_id ?? series?.basicInfo?.series_id;

      // Clean up the episode ID - remove quotes if present and ensure it's a clean number
      if (typeof episodeId === "string") {
        episodeId = episodeId.replace(/^["']|["']$/g, ""); // Remove surrounding quotes
        episodeId = Number(episodeId); // Convert to number
      }

      // Get TMDB ID from series data, fresh data, or episode data
      let tmdbId: number | undefined;

      // Try to get TMDB from fresh data first (most detailed)
      if (freshData?.seasons?.[0]?.episodes?.[0]?.info?.tmdb_id) {
        tmdbId = Number(freshData.seasons[0].episodes[0].info.tmdb_id);
      }
      // Fall back to series data
      else if (series?.basicInfo?.tmdb_id) {
        tmdbId = Number(series.basicInfo.tmdb_id);
      }
      // Try episode info if available
      else if (firstEpisode?.info?.tmdb_id) {
        tmdbId = Number(firstEpisode.info.tmdb_id);
      }
      // Try to get from stored content item
      else {
        try {
          const storage = new CatalogStorage();
          await storage.init();
          const contentItem = await storage.getContentItem(
            playlistId,
            "series",
            String(seriesId),
          );
          if (contentItem?.tmdbId) {
            tmdbId = contentItem.tmdbId;
          }
        } catch (error) {
          console.warn("Failed to get TMDB ID from storage:", error);
        }
      }

      const episodeTitle = firstEpisode?.title
        ? ` - ${firstEpisode.title}`
        : firstEpisode?.episode_num
          ? ` - Episode ${firstEpisode.episode_num}`
          : "";

      if (tmdbId) {
        console.log(`🎬 Including TMDB ID ${tmdbId} in player URL for series`);
      } else {
        console.log("⚠️ No TMDB ID found for series navigation");
      }

      navigate({
        to: "/app/player",
        search: {
          playlist: String(playlistId),
          series: String(episodeId), // Use episode stream ID for playback
          ...(tmdbId && { tmdb: tmdbId }), // Include TMDB ID if available
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to prepare playback");
    }
  };

  const handlePlaySpecificEpisode = async (episode: any) => {
    try {
      if (!playlistId || !series) return;

      // Use the centralized credentials manager
      const { credentials } = await prepareContentPlayback(
        playlistId,
        episode.id || episode.stream_id,
        "series",
        {
          title: "Play Episode",
          message: `Enter your passphrase to play "${episode.title || "Episode"}"`,
        },
      );

      // Use episode's streamingUrl if available, or construct it
      let episodeId = episode.id || episode.stream_id;

      // Clean up the episode ID - remove quotes if present and ensure it's a clean number
      if (typeof episodeId === "string") {
        episodeId = episodeId.replace(/^["']|["']$/g, ""); // Remove surrounding quotes
        episodeId = Number(episodeId); // Convert to number
      }

      // Get TMDB ID from episode data, fresh data, or stored content
      let tmdbId: number | undefined;

      // Try to get TMDB from specific episode first
      if (episode?.info?.tmdb_id) {
        tmdbId = Number(episode.info.tmdb_id);
      }
      // Try to get from fresh data
      else if (freshData?.seasons?.[0]?.episodes?.[0]?.info?.tmdb_id) {
        tmdbId = Number(freshData.seasons[0].episodes[0].info.tmdb_id);
      }
      // Fall back to series data
      else if (series?.basicInfo?.tmdb_id) {
        tmdbId = Number(series.basicInfo.tmdb_id);
      }
      // Try to get from stored content item
      else {
        try {
          const storage = new CatalogStorage();
          await storage.init();
          const contentItem = await storage.getContentItem(
            playlistId,
            "series",
            String(seriesId),
          );
          if (contentItem?.tmdbId) {
            tmdbId = contentItem.tmdbId;
          }
        } catch (error) {
          console.warn("Failed to get TMDB ID from storage:", error);
        }
      }

      if (tmdbId) {
        console.log(`🎬 Including TMDB ID ${tmdbId} in player URL for specific episode`);
      } else {
        console.log("⚠️ No TMDB ID found for specific episode navigation");
      }

      navigate({
        to: "/app/player",
        search: {
          playlist: String(playlistId),
          series: String(episodeId), // Use episode stream ID for playback
          ...(tmdbId && { tmdb: tmdbId }), // Include TMDB ID if available
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to prepare playback");
    }
  };

  // Get first episode URL for the main play button
  const getHasEpisode = () => {
    if (!series?.seasons || series.seasons.length === 0) return false;
    return Boolean(
      series.seasons[0]?.episodes?.[0]?.id ??
        series.seasons[0]?.episodes?.[0]?.stream_id ??
        series?.basicInfo?.series_id,
    );
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="relative">
        {/* Header */}
        <div className="border-border flex items-center gap-4 border-b p-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/shows">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-foreground text-2xl font-semibold">Series Details</h1>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mx-auto max-w-6xl space-y-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <div className="text-destructive mb-4">⚠️ Error Loading Series</div>
                <p className="text-muted-foreground">{error}</p>
              </div>
            ) : !series?.found ? (
              <div className="py-12 text-center">
                <div className="text-muted-foreground mb-4">📺 Series Not Found</div>
                <p className="text-muted-foreground">
                  The requested series could not be found.
                </p>
              </div>
            ) : (
              <>
                {/* Hero Section */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                  {/* Poster */}
                  <div className="lg:col-span-1">
                    <div className="bg-muted flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg border">
                      {series.basicInfo?.cover ? (
                        <img
                          src={series.basicInfo.cover}
                          alt={series.basicInfo?.name || "Series poster"}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove(
                              "hidden",
                            );
                          }}
                        />
                      ) : null}
                      <div
                        className={`text-center ${series.basicInfo?.cover ? "hidden" : ""}`}
                      >
                        <Calendar className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                        <p className="text-muted-foreground">Series Poster</p>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-6 lg:col-span-2">
                    <div>
                      <h2 className="text-foreground mb-2 text-3xl font-bold">
                        {series.basicInfo?.name || "Unknown Series"}
                      </h2>
                      <div className="text-muted-foreground flex items-center gap-4">
                        {/* releaseDate not available on SeriesInfo.basicInfo; omit year for now */}
                        {series.totalSeasons > 0 && (
                          <>
                            <span>
                              {series.totalSeasons} Season
                              {series.totalSeasons !== 1 ? "s" : ""}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        {series.totalEpisodes > 0 && (
                          <>
                            <span>
                              {series.totalEpisodes} Episode
                              {series.totalEpisodes !== 1 ? "s" : ""}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        {series.basicInfo?.rating && (
                          <>
                            <span>⭐ {series.basicInfo.rating}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>HD</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        className="gap-2"
                        onClick={handlePlayEpisode}
                        disabled={!getHasEpisode()}
                      >
                        <Play className="h-5 w-5 fill-current" />
                        {getHasEpisode()
                          ? `Play S${series.seasons?.[0]?.season_number || 1}E${series.seasons?.[0]?.episodes?.[0]?.episode_num || 1}`
                          : "No Episodes Available"}
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
                        disabled={isInspectingMetadata || !getHasEpisode()}
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
                        disabled={isFetchingFresh || !playlistId || !seriesId}
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

                    {/* Synopsis */}
                    <div>
                      <h3 className="text-foreground mb-2 text-lg font-semibold">
                        About
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {series.basicInfo?.plot ||
                          "No description available for this series."}
                      </p>
                      {series.basicInfo?.cast && (
                        <div className="mt-3">
                          <span className="text-foreground font-medium">Cast:</span>
                          <span className="text-muted-foreground ml-2">
                            {series.basicInfo.cast}
                          </span>
                        </div>
                      )}
                      {series.basicInfo?.director && (
                        <div className="mt-1">
                          <span className="text-foreground font-medium">Director:</span>
                          <span className="text-muted-foreground ml-2">
                            {series.basicInfo.director}
                          </span>
                        </div>
                      )}
                      {series.basicInfo?.genre && (
                        <div className="mt-1">
                          <span className="text-foreground font-medium">Genre:</span>
                          <span className="text-muted-foreground ml-2">
                            {series.basicInfo.genre}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seasons & Episodes */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-foreground text-xl font-semibold">
                      Seasons & Episodes
                    </h3>
                    {isLoadingDetails && (
                      <div className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        <span className="text-muted-foreground text-sm">
                          Loading episodes...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Check if we have any seasons */}
                  {!series.seasons || series.seasons.length === 0 ? (
                    <div className="bg-card border-border rounded-lg border p-6 text-center">
                      <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                      <h4 className="text-foreground mb-2 font-semibold">
                        No Episodes Available
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        {isLoadingDetails
                          ? "Loading episode information from source..."
                          : "Episode information is not available for this series."}
                      </p>
                    </div>
                  ) : (
                    /* Seasons List */
                    <div className="space-y-4">
                      {series.seasons.map((season: any) => (
                        <div
                          key={season.season_number}
                          className="bg-card border-border rounded-lg border p-6"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <h4 className="text-foreground font-semibold">
                              Season {season.season_number}
                            </h4>
                            <span className="text-muted-foreground text-sm">
                              {season.episode_count} episodes
                            </span>
                          </div>

                          {/* Episode List */}
                          {season.episodes && season.episodes.length > 0 ? (
                            <div className="space-y-3">
                              {season.episodes.map((episode: any) => (
                                <div
                                  key={episode.id}
                                  className="bg-muted hover:bg-accent flex cursor-pointer items-center gap-4 rounded-lg p-3 transition-colors"
                                  onClick={() => handlePlaySpecificEpisode(episode)}
                                >
                                  <div className="text-muted-foreground w-8 text-lg font-semibold">
                                    {episode.episode_num}
                                  </div>
                                  <div className="bg-background flex aspect-video w-32 items-center justify-center rounded border">
                                    {episode.info?.movie_image ? (
                                      <img
                                        src={episode.info.movie_image}
                                        alt={episode.title}
                                        className="h-full w-full rounded object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = "none";
                                          e.currentTarget.nextElementSibling?.classList.remove(
                                            "hidden",
                                          );
                                        }}
                                      />
                                    ) : null}
                                    <Play className="text-muted-foreground h-6 w-6" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="text-foreground font-medium">
                                      {episode.title || `Episode ${episode.episode_num}`}
                                    </h5>
                                    <p className="text-muted-foreground line-clamp-2 text-sm">
                                      {episode.info?.plot || "No description available"}
                                    </p>
                                    {episode.info?.release_date && (
                                      <p className="text-muted-foreground mt-1 text-xs">
                                        Released: {episode.info.release_date}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    {episode.info?.duration && (
                                      <div className="text-muted-foreground text-sm">
                                        {episode.info.duration}
                                      </div>
                                    )}
                                    {episode.info?.rating && (
                                      <div className="text-muted-foreground text-xs">
                                        ⭐ {episode.info.rating}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-4 text-center">
                              <p className="text-muted-foreground text-sm">
                                No episodes available for this season
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Technical Info */}
                <div className="bg-card border-border rounded-lg border p-4">
                  <h3 className="text-foreground mb-3 font-semibold">
                    Technical Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Series ID:</span>
                      <span className="text-foreground ml-2">{seriesId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source:</span>
                      <span className="text-foreground ml-2">{playlistId}</span>
                    </div>
                    {series.basicInfo?.release_date && (
                      <div>
                        <span className="text-muted-foreground">Release Date:</span>
                        <span className="text-foreground ml-2">
                          {series.basicInfo.release_date}
                        </span>
                      </div>
                    )}
                    {series.basicInfo?.category_id && (
                      <div>
                        <span className="text-muted-foreground">Category:</span>
                        <span className="text-foreground ml-2">
                          {series.basicInfo.category_id}
                        </span>
                      </div>
                    )}
                    {series.serverUsed && (
                      <div>
                        <span className="text-muted-foreground">Server:</span>
                        <span className="text-foreground ml-2">{series.serverUsed}</span>
                      </div>
                    )}
                    {series.basicInfo?.rating_5based && (
                      <div>
                        <span className="text-muted-foreground">Rating (5-star):</span>
                        <span className="text-foreground ml-2">
                          {series.basicInfo.rating_5based}/5
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata Display */}
                {showMetadata && metadata && (
                  <div className="bg-card border-border rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-foreground font-semibold">Content Metadata</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMetadata(false)}
                      >
                        Hide
                      </Button>
                    </div>
                    <pre className="bg-muted overflow-auto rounded p-3 text-xs">
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Fresh Data Display */}
                {showFreshData && freshData && (
                  <div className="bg-card border-border rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-foreground font-semibold">
                        Fresh Content Data
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFreshData(false)}
                      >
                        Hide
                      </Button>
                    </div>
                    <pre className="bg-muted overflow-auto rounded p-3 text-xs">
                      {JSON.stringify(freshData, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
