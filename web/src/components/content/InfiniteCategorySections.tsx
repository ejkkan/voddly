import * as React from "react";
import { useInfiniteCategorySections } from "~/hooks/useInfiniteCategorySections";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { ContentCard } from "./ContentCard";

interface InfiniteCategorySectionsProps {
  sourceId: string;
  contentType: "movies" | "series" | "live";
}

export function InfiniteCategorySections({ sourceId, contentType }: InfiniteCategorySectionsProps) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, error } =
    useInfiniteCategorySections(sourceId, contentType, {
      pageSize: 10,
      itemsPerCategory: 20,
    });

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!hasNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          void fetchNextPage();
        }
      }
    }, { rootMargin: "600px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center py-12">
        <div className="space-y-2 text-center">
          <h3 className="text-foreground text-lg font-semibold">Error Loading</h3>
          <p className="text-muted-foreground">Failed to load content sections.</p>
        </div>
      </div>
    );
  }

  const sections = (data?.pages || []).flatMap((p) => p.sections);

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.categoryId} className="space-y-4">
          <div className="px-6">
            <h3 className="text-foreground text-xl font-semibold">{section.categoryName}</h3>
          </div>
          <div className="grid grid-cols-1 gap-6 px-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {section.items.map((item, index) => (
              <ContentCard
                key={`${section.categoryId}-${item.contentId || index}`}
                item={item}
                contentType={contentType}
                playlistId={sourceId}
              />
            ))}
          </div>
        </div>
      ))}

      <div ref={sentinelRef} className="flex justify-center py-8">
        {isFetchingNextPage ? <LoadingSpinner /> : hasNextPage ? (
          <span className="text-muted-foreground text-sm">Scroll to load more…</span>
        ) : (
          <span className="text-muted-foreground text-sm">No more to load</span>
        )}
      </div>
    </div>
  );
}


