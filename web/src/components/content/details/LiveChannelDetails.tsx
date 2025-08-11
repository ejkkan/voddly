import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Play, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useSession } from "~/hooks/useAuth";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";
import { CatalogStorage } from "~/lib/catalog-storage";
import { inspectContentMetadata, type ContentMetadata } from "~/lib/metadata-inspector";
import {
  fetchFreshContentDetails,
  type FreshContentMetadata,
} from "~/lib/source-fetcher";
import { constructStreamUrl } from "~/lib/stream-url";

interface LiveChannelInfo {
  found: boolean;
  basicInfo?: {
    stream_id: number;
    name: string;
    stream_icon: string;
    category_id: string;
  };
  streaming?: {
    streamingUrl: string;
    directUrl?: string;
  };
  epg?: {
    hasEPG: boolean;
    currentProgram?: any;
    nextProgram?: any;
  };
  error?: string;
}

export function LiveChannelDetails() {
  const { playlistId, channelId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: session } = useSession();
  const isAuthenticated = !!session;
  const [channel, setChannel] = useState<LiveChannelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [isInspectingMetadata, setIsInspectingMetadata] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [freshData, setFreshData] = useState<FreshContentMetadata | null>(null);
  const [isFetchingFresh, setIsFetchingFresh] = useState(false);
  const [showFreshData, setShowFreshData] = useState(false);
  const { getCredentials, prepareContentPlayback } = useSourceCredentials();

  useEffect(() => {
    if (!playlistId || !channelId) return;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const storage = new CatalogStorage();
        await storage.init();
        const item = await storage.getContentItem(
          String(playlistId),
          "live",
          String(channelId),
        );
        if (!item) {
          setChannel({ found: false, error: "Channel not found in local catalog" });
        } else {
          setChannel({
            found: true,
            basicInfo: {
              stream_id: Number(item.data?.stream_id ?? channelId),
              name: item.data?.name ?? item.title ?? "Live Channel",
              stream_icon: item.data?.stream_icon,
              category_id: item.data?.category_id,
            },
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [playlistId, channelId]);

  const handleInspectMetadata = async () => {
    if (!playlistId || !channelId || !channel?.found) return;

    try {
      setIsInspectingMetadata(true);
      setError(null);

      console.log("🔍 Inspecting metadata for channel:", channel.basicInfo?.name);

      // Get credentials and construct stream URL
      const credentials = await getCredentials(playlistId, {
        title: "Inspect Metadata",
        message: "Enter your passphrase to inspect content metadata",
      });

      const { streamingUrl } = constructStreamUrl({
        server: credentials.server,
        username: credentials.username,
        password: credentials.password,
        contentId: Number(channelId),
        contentType: "live",
        containerExtension: credentials.containerExtension,
        videoCodec: credentials.videoCodec,
        audioCodec: credentials.audioCodec,
      });

      console.log("🔗 Inspecting stream URL:", streamingUrl);

      // Inspect the metadata
      const contentMetadata = await inspectContentMetadata(
        streamingUrl,
        "live",
        channel.basicInfo?.name,
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
    if (!playlistId || !channelId) return;

    try {
      setIsFetchingFresh(true);
      setError(null);

      console.log("🔄 Fetching fresh data for channel:", channelId);

      // Get credentials
      const credentials = await getCredentials(playlistId, {
        title: "Fetch Fresh Data",
        message: "Enter your passphrase to fetch fresh data from source",
      });

      // Fetch fresh data with stream metadata
      const freshContentData = await fetchFreshContentDetails(
        credentials,
        String(channelId),
        "live",
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
            String(channelId),
            "live",
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

  const handlePlayChannel = async () => {
    try {
      if (!playlistId || !channelId) return;

      // Use the centralized credentials manager
      const { credentials } = await prepareContentPlayback(
        playlistId,
        channelId,
        "live",
        {
          title: "Play Channel",
          message: "Enter your passphrase to play the channel",
        },
      );

      navigate({
        to: "/app/player",
        search: {
          playlist: String(playlistId),
          live: String(channelId), // Use channel ID for back navigation
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to prepare playback");
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="relative">
        {/* Header */}
        <div className="border-border flex items-center gap-4 border-b p-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/live">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-foreground text-2xl font-semibold">Live Channel Details</h1>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mx-auto max-w-4xl space-y-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <div className="text-destructive mb-4">⚠️ Error Loading Channel</div>
                <p className="text-muted-foreground">{error}</p>
              </div>
            ) : !channel?.found ? (
              <div className="py-12 text-center">
                <div className="text-muted-foreground mb-4">📺 Channel Not Found</div>
                <p className="text-muted-foreground">
                  The requested live channel could not be found.
                </p>
              </div>
            ) : (
              <>
                {/* Video Player Placeholder */}
                <div className="bg-muted flex aspect-video items-center justify-center rounded-lg border">
                  <div className="space-y-4 text-center">
                    <Play className="text-muted-foreground mx-auto h-16 w-16" />
                    <div>
                      <p className="text-foreground text-lg font-medium">
                        {channel.basicInfo?.name || "Live Channel"}
                      </p>
                      <p className="text-muted-foreground">
                        {channel.epg?.currentProgram?.title || "Live Stream"}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        className="gap-2"
                        onClick={handlePlayChannel}
                        disabled={!channel?.found}
                      >
                        <Play className="h-4 w-4" />
                        Start Watching
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleInspectMetadata}
                        disabled={isInspectingMetadata || !channel?.found}
                      >
                        {isInspectingMetadata ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        {isInspectingMetadata ? "Inspecting..." : "Inspect"}
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleFetchFresh}
                        disabled={isFetchingFresh || !playlistId || !channelId}
                      >
                        {isFetchingFresh ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {isFetchingFresh ? "Fetching..." : "Refresh"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Channel Info */}
                <div className="space-y-4">
                  <h2 className="text-foreground text-2xl font-bold">
                    Channel Information
                  </h2>
                  <div className="bg-card border-border rounded-lg border p-6">
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Channel ID:</span>
                        <span className="text-foreground ml-2">{channelId}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stream ID:</span>
                        <span className="text-foreground ml-2">
                          {channel.basicInfo?.stream_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className="ml-2 text-red-600">🔴 Live</span>
                      </div>
                      {channel.streaming?.streamingUrl && (
                        <div>
                          <span className="text-muted-foreground">Stream:</span>
                          <span className="ml-2 text-green-600">Available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EPG Information */}
                  {channel.epg?.hasEPG && (
                    <div className="bg-card border-border rounded-lg border p-6">
                      <h3 className="text-foreground mb-3 font-semibold">
                        Program Guide
                      </h3>
                      {channel.epg.currentProgram && (
                        <div className="mb-4">
                          <div className="text-muted-foreground text-sm">
                            Now Playing:
                          </div>
                          <div className="text-foreground font-medium">
                            {channel.epg.currentProgram.title}
                          </div>
                          {channel.epg.currentProgram.description && (
                            <div className="text-muted-foreground mt-1 text-sm">
                              {channel.epg.currentProgram.description}
                            </div>
                          )}
                        </div>
                      )}
                      {channel.epg.nextProgram && (
                        <div>
                          <div className="text-muted-foreground text-sm">Up Next:</div>
                          <div className="text-foreground font-medium">
                            {channel.epg.nextProgram.title}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
