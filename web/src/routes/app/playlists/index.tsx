import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";

type Playlist = {
  id: string;
  name: string;
  type: "xtream" | "m3u";
  channels: number;
};

const mockPlaylists: Playlist[] = [
  { id: "p1", name: "Living Room - Xtream", type: "xtream", channels: 820 },
  { id: "p2", name: "Bedroom - M3U", type: "m3u", channels: 430 },
];

export const Route = createFileRoute("/app/playlists/")({
  component: PlaylistsPage,
});

function PlaylistsPage() {
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

      <div className="grid gap-4">
        {mockPlaylists.map((pl) => (
          <div key={pl.id} className="border-border bg-card rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-foreground font-medium">{pl.name}</div>
                <div className="text-muted-foreground text-sm">
                  {pl.type === "xtream" ? "IPTV Xtream" : "M3U"} • {pl.channels} channels
                </div>
              </div>
              <Button variant="outline">Manage</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
