import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export const Route = createFileRoute("/app/playlists/add")({
  component: AddPlaylistPage,
});

function AddPlaylistPage() {
  const [mode, setMode] = React.useState<"xtream" | "m3u">("xtream");
  const [name, setName] = React.useState("");
  const [serverUrl, setServerUrl] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [m3uUrl, setM3uUrl] = React.useState("");

  return (
    <div className="bg-background min-h-screen px-8 py-10 lg:px-12 lg:py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Connect Playlist</h1>
          <p className="text-muted-foreground">
            Use mock details for now. Simple placeholder form.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/playlists">Back</Link>
        </Button>
      </div>

      <div className="max-w-xl space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === "xtream" ? "default" : "outline"}
            onClick={() => setMode("xtream")}
          >
            IPTV Xtream
          </Button>
          <Button
            variant={mode === "m3u" ? "default" : "outline"}
            onClick={() => setMode("m3u")}
          >
            M3U
          </Button>
        </div>

        <div className="grid gap-3">
          <label className="text-sm font-medium">Playlist name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Living Room"
          />
        </div>

        {mode === "xtream" ? (
          <>
            <div className="grid gap-3">
              <label className="text-sm font-medium">Server URL</label>
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://example.com"
              />
            </div>
            <div className="grid gap-3">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="demo"
              />
            </div>
            <div className="grid gap-3">
              <label className="text-sm font-medium">Password</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="*****"
                type="password"
              />
            </div>
          </>
        ) : (
          <div className="grid gap-3">
            <label className="text-sm font-medium">M3U URL</label>
            <Input
              value={m3uUrl}
              onChange={(e) => setM3uUrl(e.target.value)}
              placeholder="http://example.com/playlist.m3u"
            />
          </div>
        )}

        <Button className="mt-2">Add playlist</Button>
      </div>
    </div>
  );
}
