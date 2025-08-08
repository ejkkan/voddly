import { Link, useLocation } from "@tanstack/react-router";
import { Home, Tv, Film, PlayCircle, Settings, LogOut } from "lucide-react";
import { cn } from "~/lib/utils";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import authClient from "~/lib/auth/auth-client";
import { useQueryClient } from "@tanstack/react-query";

const navigationItems = [
  {
    name: "Home",
    href: "/app",
    icon: Home,
  },
  {
    name: "Live TV",
    href: "/app/live",
    icon: Tv,
  },
  {
    name: "Movies",
    href: "/app/movies", 
    icon: Film,
  },
  {
    name: "Shows",
    href: "/app/shows",
    icon: PlayCircle,
  },
];

export function Sidebar() {
  const location = useLocation();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: ["user"] });
  };

  return (
    <div className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        {/* Logo/Brand */}
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link to="/app" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <PlayCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">IPTV</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href === "/app" && location.pathname === "/app");
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive 
                    ? "bg-accent text-accent-foreground" 
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
