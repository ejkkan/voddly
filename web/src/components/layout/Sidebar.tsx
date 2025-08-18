import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Film, Home, LogOut, PlayCircle, Tv, X } from "lucide-react";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import authClient from "~/lib/auth/auth-client";
import { cn } from "~/lib/utils";

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

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const queryClient = useQueryClient();

  // Autofocus first link when opening
  React.useEffect(() => {
    if (!isOpen) return;
    const first = document.querySelector<HTMLAnchorElement>("[data-sidebar-link='true']");
    first?.focus();
  }, [isOpen]);

  const handleSignOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: ["user"] });
  };

  if (!isOpen) return null;

  return (
    <div
      className="border-border bg-card fixed top-0 left-0 z-40 h-screen w-64 border-r"
      data-sidebar="true"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full flex-col">
        {/* Logo/Brand */}
        <div className="border-border flex h-16 items-center justify-between border-b px-6">
          <Link to="/app" className="flex items-center gap-2">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <PlayCircle className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="text-foreground text-xl font-semibold">IPTV</span>
          </Link>

          {/* Close button for mobile/tablet */}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navigationItems.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href === "/app" && location.pathname === "/app");

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
                data-sidebar-link="true"
                onClick={(e) => {
                  // Do not navigate on focus/hover – only explicit click triggers
                  if (e.type !== "click") e.preventDefault();
                  // Close sidebar after explicit navigation
                  if (e.type === "click") onClose?.();
                }}
                onMouseEnter={(e) => e.preventDefault()}
                onFocus={(e) => e.preventDefault()}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-border space-y-2 border-t p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Theme</span>
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
