import { Film, Radio, Search, Tv, X } from "lucide-react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";
import { CatalogStorage, type ContentItem } from "~/lib/catalog-storage";
import { ContentCard } from "./ContentCard";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId?: string;
}

interface SearchResults {
  movies: ContentItem[];
  series: ContentItem[];
  live: ContentItem[];
  total: number;
}

export function SearchDialog({ open, onOpenChange, sourceId }: SearchDialogProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Debounced search function
  const performSearch = React.useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const storage = new CatalogStorage();
        await storage.init();
        const searchResults = await storage.searchAllContent(searchQuery, sourceId);
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults(null);
      } finally {
        setLoading(false);
      }
    },
    [sourceId],
  );

  // Handle search input with debouncing
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // Clear search when dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setError(null);
    }
  }, [open]);

  const hasResults = results && results.total > 0;
  const isEmpty = results && results.total === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95vh] max-w-7xl flex-col overflow-hidden">
        <DialogHeader className="space-y-6 pb-6">
          <DialogTitle className="text-center text-4xl font-bold tracking-tight lg:text-5xl">
            Search Content
          </DialogTitle>
          <DialogDescription className="text-center text-xl leading-relaxed lg:text-2xl">
            Search across movies, TV shows, and live channels
          </DialogDescription>

          {/* Search Input */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-6 h-8 w-8 -translate-y-1/2 transform lg:h-10 lg:w-10" />
            <Input
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="focus:border-primary h-16 rounded-2xl border-2 pr-16 pl-16 text-2xl font-medium lg:h-20 lg:pr-20 lg:pl-20 lg:text-3xl"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-3 h-12 w-12 -translate-y-1/2 transform rounded-xl lg:h-14 lg:w-14"
              >
                <X className="h-6 w-6 lg:h-8 lg:w-8" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {error && (
            <div className="flex justify-center py-16">
              <div className="space-y-4 text-center">
                <h3 className="text-destructive text-2xl font-semibold lg:text-3xl">
                  Search Error
                </h3>
                <p className="text-muted-foreground text-xl lg:text-2xl">{error}</p>
              </div>
            </div>
          )}

          {isEmpty && (
            <div className="flex justify-center py-16">
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-semibold lg:text-3xl">No Results Found</h3>
                <p className="text-muted-foreground text-xl lg:text-2xl">
                  Try adjusting your search terms
                </p>
              </div>
            </div>
          )}

          {!loading && !error && !query.trim() && (
            <div className="flex justify-center py-16">
              <div className="space-y-6 text-center">
                <Search className="text-muted-foreground/50 mx-auto h-20 w-20 lg:h-24 lg:w-24" />
                <h3 className="text-2xl font-semibold lg:text-3xl">Start Searching</h3>
                <p className="text-muted-foreground max-w-2xl text-xl lg:text-2xl">
                  Type in the search box above to find movies, TV shows, and live channels
                </p>
              </div>
            </div>
          )}

          {hasResults && (
            <div className="space-y-10 pb-8">
              {/* Movies Section */}
              {results.movies.length > 0 && (
                <SearchResultSection
                  title="Movies"
                  icon={<Film className="h-7 w-7 lg:h-8 lg:w-8" />}
                  items={results.movies}
                  contentType="movies"
                  sourceId={sourceId}
                />
              )}

              {/* TV Shows Section */}
              {results.series.length > 0 && (
                <SearchResultSection
                  title="TV Shows"
                  icon={<Tv className="h-7 w-7 lg:h-8 lg:w-8" />}
                  items={results.series}
                  contentType="series"
                  sourceId={sourceId}
                />
              )}

              {/* Live Channels Section */}
              {results.live.length > 0 && (
                <SearchResultSection
                  title="Live Channels"
                  icon={<Radio className="h-7 w-7 lg:h-8 lg:w-8" />}
                  items={results.live}
                  contentType="live"
                  sourceId={sourceId}
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SearchResultSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ContentItem[];
  contentType: "movies" | "series" | "live";
  sourceId?: string;
}

function SearchResultSection({
  title,
  icon,
  items,
  contentType,
  sourceId,
}: SearchResultSectionProps) {
  const maxDisplayed = 8; // Limit results for performance
  const displayedItems = items.slice(0, maxDisplayed);
  const hasMore = items.length > maxDisplayed;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-4 px-2">
        <div className="text-primary flex items-center gap-3">
          {icon}
          <h3 className="text-3xl font-semibold lg:text-4xl">{title}</h3>
        </div>
        <div className="bg-primary/10 text-primary rounded-full px-4 py-2 text-xl font-medium lg:px-6 lg:py-3 lg:text-2xl">
          {items.length}
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {displayedItems.map((item, index) => (
          <ContentCard
            key={`${item.uid}-${index}`}
            item={item}
            contentType={contentType}
            playlistId={item.sourceId}
            className="aspect-[2/3] transition-transform hover:scale-105"
          />
        ))}
      </div>

      {/* Show More Indicator */}
      {hasMore && (
        <div className="text-center">
          <p className="text-muted-foreground text-xl lg:text-2xl">
            Showing {maxDisplayed} of {items.length} results
          </p>
        </div>
      )}
    </div>
  );
}
