import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { CatalogStorage, type ContentItem } from "~/lib/catalog-storage";
import { ContentCard } from "./ContentCard";

interface ContentCarouselProps {
  playlistId: string; // kept prop name for UI components; treated as sourceId
  contentType: "live" | "movies" | "series";
}

export function ContentCarousel({ playlistId, contentType }: ContentCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [items, setItems] = React.useState<ContentItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let isCancelled = false;
    const storage = new CatalogStorage();

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        await storage.init();
        const type =
          contentType === "movies"
            ? "movie"
            : contentType === "series"
              ? "series"
              : "live";
        const results = await storage.queryContent(playlistId, { type, limit: 30 });
        if (!isCancelled) setItems(results);
      } catch (e) {
        if (!isCancelled)
          setError(e instanceof Error ? e.message : "Failed to load content");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      isCancelled = true;
    };
  }, [playlistId, contentType]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320; // Width of card + gap
      const scrollLeft = scrollRef.current.scrollLeft;
      const newScrollLeft =
        direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;

      scrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-muted-foreground">Failed to load content</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <p className="text-muted-foreground">No content available</p>
      </div>
    );
  }

  return (
    <div className="group relative">
      {/* Left Scroll Button */}
      <Button
        variant="ghost"
        size="icon"
        className="bg-background/80 hover:bg-background/90 absolute top-1/2 left-0 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => scroll("left")}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>

      {/* Right Scroll Button */}
      <Button
        variant="ghost"
        size="icon"
        className="bg-background/80 hover:bg-background/90 absolute top-1/2 right-0 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Carousel Container */}
      <div
        ref={scrollRef}
        data-carousel="true"
        className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth px-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item, index) => (
          <ContentCard
            key={`${item.contentId || item.data?.id || index}-${index}`}
            item={item}
            contentType={contentType}
            playlistId={playlistId}
          />
        ))}
      </div>
    </div>
  );
}
