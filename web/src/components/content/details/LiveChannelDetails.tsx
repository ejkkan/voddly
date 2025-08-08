import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useSession } from "~/hooks/useAuth";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";
import { CatalogStorage } from "~/lib/catalog-storage";
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
  const { prepareContentPlayback } = useSourceCredentials();

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

      const id = Number(channel?.basicInfo?.stream_id ?? channelId);
      const { streamingUrl } = constructStreamUrl({
        server: credentials.server,
        username: credentials.username,
        password: credentials.password,
        contentId: id,
        contentType: "live",
        containerExtension: credentials.containerExtension,
        videoCodec: credentials.videoCodec,
        audioCodec: credentials.audioCodec,
      });

      navigate({
        to: "/app/player",
        search: {
          url: streamingUrl,
          title: channel?.basicInfo?.name || "Live Channel",
          type: "live",
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
                    <Button
                      className="gap-2"
                      onClick={handlePlayChannel}
                      disabled={!channel?.found}
                    >
                      <Play className="h-4 w-4" />
                      Start Watching
                    </Button>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
