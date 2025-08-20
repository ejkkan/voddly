import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import * as React from "react";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { CatalogStorage } from "~/lib/catalog-storage";
import { ContentHeader } from "./ContentHeader";
import { ContentSection } from "./ContentSection";
import { InfiniteCategorySections } from "./InfiniteCategorySections";
import { SearchDialog } from "./SearchDialog";

export function MoviesPage() {
  const [sourceId, setSourceId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState<boolean>(false);

  const storageQuery = useQuery({
    queryKey: ["storage-info"],
    queryFn: async () => {
      const storage = new CatalogStorage();
      await storage.init();
      return storage.getStorageInfo();
    },
    refetchInterval: (data) => {
      // Poll more frequently until we find a source with data
      const hasData = (data?.sources || []).some((s: any) => (s.size || 0) > 0);
      return hasData ? 0 : 2000;
    },
  });

  React.useEffect(() => {
    const info = storageQuery.data;
    if (!info) return;
    // Prefer a source that already has cached data
    const firstWithData = info.sources.find((s: any) => (s.size || 0) > 0);
    const first = firstWithData || info.sources[0];
    if (first && !sourceId) setSourceId(first.sourceId);
    if (!storageQuery.isLoading) setLoading(false);
  }, [storageQuery.data, storageQuery.isLoading, sourceId]);

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

          {/* Infinite category sections */}
          <InfiniteCategorySections sourceId={String(sourceId)} contentType="movies" />
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
