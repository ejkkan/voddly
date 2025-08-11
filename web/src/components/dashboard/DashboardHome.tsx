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
      console.log("🚀 Starting catalog reload for source:", sourceId);

      const source = sourcesData?.sources?.find((s) => s.id === sourceId);
      if (!source) {
        console.error("❌ Source not found in sourcesData:", {
          sourceId,
          availableSources: sourcesData?.sources?.map((s) => s.id),
        });
        throw new Error("Source not found");
      }

      console.log("📋 Source found:", { id: source.id, name: source.name });

      // Get credentials using centralized manager
      console.log("🔐 Getting credentials for source...");
      const credentials = await getCredentials(sourceId, {
        title: "Reload Source",
        message: "Enter your passphrase to reload the catalog",
      });

      console.log("✅ Credentials obtained:", {
        hasServer: !!credentials.server,
        hasUsername: !!credentials.username,
        hasPassword: !!credentials.password,
        server: credentials.server,
      });

      // Validate credentials before proceeding
      if (!credentials.server || !credentials.username || !credentials.password) {
        const missing = [];
        if (!credentials.server) missing.push("server");
        if (!credentials.username) missing.push("username");
        if (!credentials.password) missing.push("password");
        throw new Error(`Invalid credentials: missing ${missing.join(", ")}`);
      }

      // Validate server URL format
      try {
        const serverUrl = new URL(
          credentials.server.endsWith("/")
            ? credentials.server
            : credentials.server + "/",
        );
        console.log("🌐 Server URL validated:", serverUrl.origin);
      } catch (urlError) {
        console.error("❌ Invalid server URL:", credentials.server);
        throw new Error(`Invalid server URL format: ${credentials.server}`);
      }

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

      console.log("🌐 Testing connection with get_live_categories...");
      const testUrl = buildXtreamUrl("get_live_categories");
      console.log(
        "📡 First request URL:",
        testUrl
          .replace(/username=[^&]*/, "username=***")
          .replace(/password=[^&]*/, "password=***"),
      );

      // Fetch catalog data directly from Xtream server
      const fetchWithRetry = async (url: string, description: string, retries = 2) => {
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
          try {
            console.log(
              `🔄 Fetching ${description} (attempt ${attempt}/${retries + 1})...`,
            );

            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(url, {
              method: "GET",
              headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; IPTV-Client/1.0)",
              },
              signal: controller.signal,
              // Note: removed credentials: "include" to avoid CORS issues
            });

            clearTimeout(timeoutId);

            console.log(`📊 ${description} response (attempt ${attempt}):`, {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              url: url
                .replace(/username=[^&]*/, "username=***")
                .replace(/password=[^&]*/, "password=***"),
              headers: Object.fromEntries(response.headers.entries()),
            });

            if (!response.ok) {
              let errorText = "";
              try {
                errorText = await response.text();
              } catch (e) {
                errorText = "Could not read response body";
              }

              console.error(`❌ ${description} failed (attempt ${attempt}):`, {
                status: response.status,
                statusText: response.statusText,
                body: errorText.substring(0, 500),
              });

              // If this is the last attempt, throw the error
              if (attempt > retries) {
                if (response.status === 0) {
                  throw new Error(
                    `Network error: Unable to connect to server (CORS or network issue)`,
                  );
                } else if (response.status === 401) {
                  throw new Error(`Authentication failed: Invalid credentials`);
                } else if (response.status === 404) {
                  throw new Error(
                    `Endpoint not found: ${description} API endpoint may not be available`,
                  );
                } else if (response.status >= 500) {
                  throw new Error(
                    `Server error: ${response.status} ${response.statusText}`,
                  );
                } else {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
              }

              // Wait before retry
              console.log(`⏳ Waiting 2 seconds before retry...`);
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }

            let data;
            try {
              data = await response.json();
            } catch (jsonError) {
              console.error(`💥 Failed to parse JSON for ${description}:`, jsonError);
              const text = await response.text();
              console.error(`📄 Response body:`, text.substring(0, 500));
              throw new Error(`Invalid JSON response from ${description}`);
            }

            console.log(`✅ ${description} success (attempt ${attempt}):`, {
              type: typeof data,
              length: Array.isArray(data) ? data.length : "not array",
              sample: Array.isArray(data) && data.length > 0 ? data[0] : "no data",
            });

            return data;
          } catch (error) {
            console.error(
              `💥 Error fetching ${description} (attempt ${attempt}):`,
              error,
            );

            // If this is the last attempt or it's not a network error, throw
            if (attempt > retries) {
              if (error instanceof Error) {
                if (error.name === "AbortError") {
                  throw new Error(
                    `Request timeout: ${description} took too long to respond`,
                  );
                } else if (error.message.includes("fetch")) {
                  throw new Error(
                    `Network error: Unable to fetch ${description} (check network connection)`,
                  );
                } else if (error.message.includes("CORS")) {
                  throw new Error(
                    `CORS error: Server does not allow cross-origin requests`,
                  );
                }
                throw error;
              } else {
                throw new Error(`Unknown error fetching ${description}`);
              }
            }

            // Wait before retry for network errors
            console.log(`⏳ Network error, waiting 3 seconds before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }

        throw new Error(`Failed to fetch ${description} after ${retries + 1} attempts`);
      };

      const [
        liveCategories,
        vodCategories,
        seriesCategories,
        liveStreams,
        vodStreams,
        seriesList,
      ] = await Promise.all([
        fetchWithRetry(buildXtreamUrl("get_live_categories"), "live categories"),
        fetchWithRetry(buildXtreamUrl("get_vod_categories"), "VOD categories"),
        fetchWithRetry(buildXtreamUrl("get_series_categories"), "series categories"),
        fetchWithRetry(buildXtreamUrl("get_live_streams"), "live streams"),
        fetchWithRetry(buildXtreamUrl("get_vod_streams"), "VOD streams"),
        fetchWithRetry(buildXtreamUrl("get_series"), "series list"),
      ]);

      console.log("📦 Data fetched successfully, processing...");

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

      console.log("📊 Catalog summary:", {
        categories: catalog.categories.length,
        movies: catalog.movies.length,
        series: catalog.series.length,
        channels: catalog.channels.length,
        total:
          catalog.categories.length +
          catalog.movies.length +
          catalog.series.length +
          catalog.channels.length,
      });

      // Store in IndexedDB
      console.log("💾 Storing catalog in IndexedDB...");
      try {
        await catalogStorage.storeSourceCatalog(sourceId, {
          categories: catalog.categories || [],
          movies: catalog.movies || [],
          series: catalog.series || [],
          channels: catalog.channels || [],
        });
        console.log("✅ Catalog stored successfully");
      } catch (dbError) {
        console.error("💥 IndexedDB storage failed:", dbError);
        throw new Error(
          `Failed to store catalog in local database: ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
        );
      }

      // Update stats
      console.log("📈 Getting updated stats...");
      const newStats = await catalogStorage.getCatalogStats(sourceId);
      setCatalogStats((prev) => ({ ...prev, [sourceId]: newStats }));

      console.log("🎉 Catalog reload completed successfully");
      toast.success(`Catalog updated! ${newStats.total} items loaded.`);
    } catch (error) {
      console.error("💥 Failed to reload source data:", error);

      // More detailed error reporting
      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          toast.error(`Network error: ${error.message}`);
        } else if (
          error.message.includes("IndexedDB") ||
          error.message.includes("database")
        ) {
          toast.error(`Database error: ${error.message}`);
        } else if (
          error.message.includes("credentials") ||
          error.message.includes("passphrase")
        ) {
          toast.error(`Authentication error: ${error.message}`);
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        toast.error("Unknown error occurred while reloading catalog");
      }
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
