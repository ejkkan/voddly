import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-2xl space-y-6 p-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">IPTV Streaming Platform</h1>
        <p className="text-muted-foreground">
          Stream live channels, movies, and shows. Manage your playlists and enjoy a
          seamless viewing experience.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/login"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="border-input hover:bg-accent hover:text-accent-foreground rounded-md border px-4 py-2"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
