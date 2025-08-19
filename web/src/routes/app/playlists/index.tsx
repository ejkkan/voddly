import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { useAccountSources, useUserAccounts } from "~/hooks/useSource";
import { CatalogStorage, type CatalogStats } from "~/lib/catalog-storage";

export const Route = createFileRoute("/app/playlists/")({
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const { data: accountsData, isLoading: accountsLoading } = useUserAccounts();
  const firstAccount = accountsData?.accounts?.[0];
  const { data: sourcesData, isLoading: sourcesLoading } = useAccountSources(
    firstAccount?.id,
  );

  const [stats, setStats] = React.useState<Record<string, CatalogStats>>({});
  const [dbReady, setDbReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const storage = new CatalogStorage();
        await storage.init();
        if (cancelled) return;
        setDbReady(true);

        if (sourcesData?.sources?.length) {
          const next: Record<string, CatalogStats> = {};
          for (const s of sourcesData.sources) {
            try {
              next[s.id] = await storage.getCatalogStats(s.id);
            } catch {
              // ignore per-source errors
            }
          }
          if (!cancelled) setStats(next);
        }
      } catch {
        setDbReady(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [sourcesData]);

  if (accountsLoading || sourcesLoading) {
    return <LoadingSpinner />;
  }

  const sources = sourcesData?.sources || [];

  return (
    <div className="bg-background min-h-screen px-8 py-10 lg:px-12 lg:py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Playlists</h1>
          <p className="text-muted-foreground">
            Your connected IPTV Xtream and M3U playlists
          </p>
        </div>
        <Button asChild>
          <Link to="/app/playlists/add">Add playlist</Link>
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="text-muted-foreground">No playlists yet.</div>
      ) : (
        <div className="grid gap-4">
          {sources.map((source) => {
            const s = stats[source.id];
            const provider = (source.provider_type || "").toLowerCase();
            const providerLabel =
              provider === "xtream" ? "IPTV Xtream" : provider.toUpperCase();
            return (
              <div
                key={source.id}
                className="border-border bg-card rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-foreground font-medium">{source.name}</div>
                    <div className="text-muted-foreground text-sm">
                      {providerLabel}
                      {dbReady && s ? ` • ${s.channels} channels` : ""}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      ID: {source.id}
                    </div>
                  </div>
                  <Button variant="outline">Manage</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
