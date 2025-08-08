import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ContentCarousel } from "./ContentCarousel";

interface ContentSectionProps {
  title: string;
  description: string;
  playlistId: string; // treated as sourceId
  contentType: "live" | "movies" | "series";
  viewAllHref: string;
}

export function ContentSection({
  title,
  description,
  playlistId,
  contentType,
  viewAllHref,
}: ContentSectionProps) {
  return (
    <section className="px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-semibold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Button asChild variant="ghost" className="gap-2">
          <Link to={viewAllHref}>
            View All
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <ContentCarousel playlistId={playlistId} contentType={contentType} />
    </section>
  );
}
