import { Link } from "@tanstack/react-router";
import { Calendar, Film, Play, Tv } from "lucide-react";

interface ContentCardProps {
  item: any;
  contentType: "live" | "movies" | "series";
  playlistId: string;
}

export function ContentCard({ item, contentType, playlistId }: ContentCardProps) {
  const getHref = () => {
    const itemId = item.contentId ?? item.data?.stream_id ?? item.data?.id ?? item.id;
    const href = (() => {
      switch (contentType) {
        case "live":
          return `/app/live/${String(playlistId)}/${String(itemId)}`;
        case "movies":
          return `/app/movies/${String(playlistId)}/${String(itemId)}`;
        case "series":
          return `/app/shows/${String(playlistId)}/${String(itemId)}`;
      }
    })();
    console.log("🔗 ContentCard href:", { contentType, playlistId, itemId, href });
    return href;
  };

  const getIcon = () => {
    switch (contentType) {
      case "live":
        return Tv;
      case "movies":
        return Film;
      case "series":
        return Calendar;
    }
  };

  const Icon = getIcon();
  const title =
    item.title || item.data?.title || item.name || item.data?.name || "Unknown";
  const imageUrl =
    item.logo ||
    item.data?.logo ||
    item.cover ||
    item.data?.cover ||
    item.stream_icon ||
    item.data?.stream_icon ||
    "";

  return (
    <Link
      to={getHref()}
      className="group w-72 flex-shrink-0 cursor-pointer"
      onClick={() => {
        const itemId = item.contentId ?? item.data?.stream_id ?? item.data?.id ?? item.id;
        console.log("📱 ContentCard clicked:", { contentType, playlistId, itemId });
      }}
    >
      <div className="bg-card border-border relative overflow-hidden rounded-lg border transition-all duration-300 hover:scale-105 hover:shadow-lg">
        {/* Image Container */}
        <div className="bg-muted relative aspect-video">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}

          {/* Fallback Icon */}
          {!imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className="text-muted-foreground h-12 w-12" />
            </div>
          )}

          {/* Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="bg-primary rounded-full p-3">
              <Play className="text-primary-foreground h-6 w-6 fill-current" />
            </div>
          </div>

          {/* Content Type Badge */}
          <div className="absolute top-2 left-2">
            <div className="bg-background/90 text-foreground flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
              <Icon className="h-3 w-3" />
              {contentType === "live" ? "LIVE" : contentType.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Content Info */}
        <div className="p-4">
          <h3 className="text-foreground mb-1 truncate text-sm font-medium">{title}</h3>

          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>{contentType === "live" ? "Channel" : "On Demand"}</span>
            {item.year && <span>{item.year}</span>}
          </div>

          {/* Additional Info */}
          {item.plot && (
            <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">{item.plot}</p>
          )}

          {/* Rating/Duration */}
          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
            {item.rating && (
              <span className="bg-muted rounded px-1.5 py-0.5">⭐ {item.rating}</span>
            )}
            {item.duration && (
              <span className="bg-muted rounded px-1.5 py-0.5">{item.duration}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
