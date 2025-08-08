import { Link } from "@tanstack/react-router";
import { Info, PlayCircle } from "lucide-react";
import { Button } from "~/components/ui/button";

interface HeroSectionProps {
  user: any;
}

export function HeroSection({ user }: HeroSectionProps) {
  return (
    <div className="from-background via-background/80 to-background relative flex h-[70vh] items-center justify-center bg-gradient-to-r">
      {/* Background Pattern */}
      <div className="bg-grid-pattern absolute inset-0 opacity-5"></div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl space-y-6 px-6 text-center">
        <div className="space-y-4">
          <h1 className="text-foreground text-4xl font-bold md:text-6xl">
            Welcome back, <span className="text-primary">{user?.name || "User"}</span>
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg md:text-xl">
            Discover and enjoy your favorite live TV channels, movies, and series all in
            one place. Your entertainment, your way.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link to="/app/live">
              <PlayCircle className="h-5 w-5" />
              Start Watching
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/app/movies">
              <Info className="h-5 w-5" />
              Browse Movies
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 pt-8">
          <div className="text-center">
            <div className="text-primary text-2xl font-bold">Live TV</div>
            <div className="text-muted-foreground text-sm">Channels</div>
          </div>
          <div className="text-center">
            <div className="text-primary text-2xl font-bold">Movies</div>
            <div className="text-muted-foreground text-sm">On Demand</div>
          </div>
          <div className="text-center">
            <div className="text-primary text-2xl font-bold">Series</div>
            <div className="text-muted-foreground text-sm">TV Shows</div>
          </div>
        </div>
      </div>
    </div>
  );
}
