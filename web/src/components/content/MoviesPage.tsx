import { Search } from "lucide-react";
import * as React from "react";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { CatalogStorage } from "~/lib/catalog-storage";
import { ContentHeader } from "./ContentHeader";
import { InfiniteContentGrid } from "./InfiniteContentGrid";
import { SearchDialog } from "./SearchDialog";

export function MoviesPage() {
  const [sourceId, setSourceId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    let isCancelled = false;
    const storage = new CatalogStorage();

    async function pickSource() {
      try {
        setLoading(true);
        await storage.init();
        const info = await storage.getStorageInfo();
        const first = info.sources.find((s) => (s.size || 0) > 0) || info.sources[0];
        if (!isCancelled) setSourceId(first?.sourceId ?? null);
      } catch (e) {
        if (!isCancelled)
          setError(e instanceof Error ? e.message : "Failed to load sources");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    pickSource();
    return () => {
      isCancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!sourceId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-foreground text-2xl font-semibold">No Playlists</h2>
          <p className="text-muted-foreground">Please add a playlist to view movies.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background min-h-screen px-8 py-10 lg:px-12 lg:py-12">
        <div className="space-y-12 lg:space-y-16">
          <ContentHeader
            title="Movies"
            description="Browse your cached movies"
            iconButtons={[
              {
                icon: <Search className="h-6 w-6" />,
                onClick: () => setSearchOpen(true),
                label: "Search movies",
                variant: "outline",
              },
            ]}
          />

          <InfiniteContentGrid sourceId={String(sourceId)} contentType="movies" />
        </div>
      </div>

      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        sourceId={String(sourceId)}
      />
    </>
  );
}
