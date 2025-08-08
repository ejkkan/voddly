import { Database, Film, PlaySquare, RefreshCw, Shield, Tv } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useSession } from "~/hooks/useAuth";
import { useAccountSources, useUserAccounts } from "~/hooks/useSource";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";
import { CatalogStorage } from "~/lib/catalog-storage";
import { SourceEmptyState } from "./SourceEmptyState";

export function DashboardHome() {
  console.log("🏠 DashboardHome component rendered");

  // Check authentication state
  const { data: session, isLoading: sessionLoading } = useSession();

  // Get user accounts
  const { data: accountsData, isLoading: accountsLoading } = useUserAccounts();

  // Get sources for the first account (if exists)
  const firstAccount = accountsData?.accounts?.[0];
  const { data: sourcesData, isLoading: sourcesLoading } = useAccountSources(
    firstAccount?.id,
  );

  // State for catalog management
  const [catalogStats, setCatalogStats] = React.useState<Record<string, any>>({});
  const [reloading, setReloading] = React.useState<string | null>(null);

  // Initialize storage and credentials manager
  const catalogStorage = React.useMemo(() => new CatalogStorage(), []);
  const { getCredentials } = useSourceCredentials();

  // Initialize catalog storage and load stats
  React.useEffect(() => {
    const initStorage = async () => {
      try {
        await catalogStorage.init();
        console.log("✅ IndexedDB initialized");

        // Load stats for all sources
        if (sourcesData?.sources) {
          const stats: Record<string, any> = {};
          for (const source of sourcesData.sources) {
            try {
              const sourceStats = await catalogStorage.getCatalogStats(source.id);
              stats[source.id] = sourceStats;
            } catch (error) {
              console.error(`Failed to load stats for source ${source.id}:`, error);
            }
          }
          setCatalogStats(stats);
        }
      } catch (error) {
        console.error("Failed to initialize IndexedDB:", error);
        toast.error("Failed to initialize local storage");
      }
    };

    initStorage();
  }, [sourcesData, catalogStorage]);

  // Function to reload source data
  async function reloadSourceData(sourceId: string) {
    setReloading(sourceId);

    try {
      const source = sourcesData?.sources?.find((s) => s.id === sourceId);
      if (!source) throw new Error("Source not found");

      // Get credentials using centralized manager
      const credentials = await getCredentials(sourceId, {
        title: "Reload Source",
        message: "Enter your passphrase to reload the catalog",
      });

      console.log("🔐 Credentials obtained:", !!credentials);

      toast.info("Fetching catalog from source...");

      // Build Xtream URL helper
      const buildXtreamUrl = (
        action: string,
        params: Record<string, string | number> = {},
      ) => {
        const base = credentials.server.endsWith("/")
          ? credentials.server.slice(0, -1)
          : credentials.server;
        const url = new URL(`${base}/player_api.php`);
        const search = new URLSearchParams({
          username: credentials.username,
          password: credentials.password,
          action,
        });
        for (const [key, value] of Object.entries(params)) {
          search.set(key, String(value));
        }
        url.search = search.toString();
        return url.toString();
      };

      // Fetch catalog data directly from Xtream server
      const [
        liveCategories,
        vodCategories,
        seriesCategories,
        liveStreams,
        vodStreams,
        seriesList,
      ] = await Promise.all([
        fetch(buildXtreamUrl("get_live_categories"), {
          credentials: "include",
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to fetch live categories");
          return res.json();
        }),
        fetch(buildXtreamUrl("get_vod_categories"), {
          credentials: "include",
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to fetch VOD categories");
          return res.json();
        }),
        fetch(buildXtreamUrl("get_series_categories"), {
          credentials: "include",
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to fetch series categories");
          return res.json();
        }),
        fetch(buildXtreamUrl("get_live_streams"), {
          credentials: "include",
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to fetch live streams");
          return res.json();
        }),
        fetch(buildXtreamUrl("get_vod_streams"), {
          credentials: "include",
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to fetch VOD streams");
          return res.json();
        }),
        fetch(buildXtreamUrl("get_series"), {
          credentials: "include",
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to fetch series list");
          return res.json();
        }),
      ]);

      // Combine all categories
      const categories = [
        ...(Array.isArray(liveCategories) ? liveCategories : []).map((cat: any) => ({
          ...cat,
          type: "live",
        })),
        ...(Array.isArray(vodCategories) ? vodCategories : []).map((cat: any) => ({
          ...cat,
          type: "vod",
        })),
        ...(Array.isArray(seriesCategories) ? seriesCategories : []).map((cat: any) => ({
          ...cat,
          type: "series",
        })),
      ];

      const catalog = {
        categories,
        movies: Array.isArray(vodStreams) ? vodStreams : [],
        series: Array.isArray(seriesList) ? seriesList : [],
        channels: Array.isArray(liveStreams) ? liveStreams : [],
      };

      // Store in IndexedDB
      await catalogStorage.storeSourceCatalog(sourceId, {
        categories: catalog.categories || [],
        movies: catalog.movies || [],
        series: catalog.series || [],
        channels: catalog.channels || [],
      });

      // Update stats
      const newStats = await catalogStorage.getCatalogStats(sourceId);
      setCatalogStats((prev) => ({ ...prev, [sourceId]: newStats }));

      toast.success(`Catalog updated! ${newStats.total} items loaded.`);
    } catch (error) {
      console.error("Failed to reload source data:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reload source data",
      );
    } finally {
      setReloading(null);
    }
  }

  // Show loading while checking session or loading data
  if (sessionLoading || accountsLoading || sourcesLoading) {
    console.log("⏳ Loading data...");
    return <LoadingSpinner />;
  }

  // If no session, redirect to login or show login prompt
  if (!session) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-foreground text-2xl font-semibold">
            Authentication Required
          </h2>
          <p className="text-muted-foreground">
            Please log in to access your IPTV dashboard.
          </p>
        </div>
      </div>
    );
  }

  // If no accounts or sources, show empty state
  if (!firstAccount || !sourcesData?.sources?.length) {
    return (
      <div className="bg-background min-h-screen">
        <SourceEmptyState />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Your Sources</h1>
          <p className="text-muted-foreground mt-2">
            Manage your encrypted content sources and local catalog data
          </p>
        </div>

        {/* Security Status */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="text-sm font-semibold">Zero-Knowledge Encryption Active</h3>
              <p className="text-muted-foreground text-sm">
                Your sources are encrypted end-to-end. Only you can decrypt them with your
                passphrase.
              </p>
            </div>
          </div>
        </div>

        {/* Sources Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sourcesData.sources.map((source) => {
            const stats = catalogStats[source.id];
            const isLoading = reloading === source.id;

            return (
              <div key={source.id} className="bg-card space-y-4 rounded-lg border p-6">
                <div>
                  <h3 className="text-lg font-semibold">{source.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    Type: {source.provider_type.toUpperCase()}
                  </p>
                </div>

                {/* Catalog Stats */}
                {stats ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Database className="h-4 w-4" />
                      <span>{stats.total} items cached locally</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Tv className="h-3 w-3" />
                        <span>{stats.channels} Live</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Film className="h-3 w-3" />
                        <span>{stats.movies} Movies</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <PlaySquare className="h-3 w-3" />
                        <span>{stats.series} Series</span>
                      </div>
                    </div>
                    {stats.lastUpdated && (
                      <p className="text-muted-foreground text-xs">
                        Last updated: {new Date(stats.lastUpdated).toLocaleDateString()}
                      </p>
                    )}
                    {stats.sizeBytes && (
                      <p className="text-muted-foreground text-xs">
                        Size: {(stats.sizeBytes / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    No catalog data cached yet
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reloadSourceData(source.id)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {stats ? "Reload" : "Load"} Catalog
                      </>
                    )}
                  </Button>
                  {stats && stats.total > 0 && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        // Navigate to browse content
                        window.location.href = `/app/browse/${source.id}`;
                      }}
                    >
                      Browse
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Source Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => {
              // Navigate to add source page
              window.location.href = "/app/sources/new";
            }}
          >
            Add Another Source
          </Button>
        </div>
      </div>
    </div>
  );
}
