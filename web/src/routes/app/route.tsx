import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import * as React from "react";
import { Sidebar } from "~/components/layout/Sidebar";
import { Button } from "~/components/ui/button";
import { useNav } from "~/hooks/useNav";
import { InputManagerProvider, useInputManager } from "~/lib/input-manager";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
  beforeLoad: async ({ context }) => {
    // Protect all app routes - redirect to login if not authenticated
    if (!context.user) {
      throw redirect({ to: "/login" });
    }
  },
});

function Shell() {
  const { sidebarOpen, closeSidebar, openSidebar } = useInputManager();
  useNav();
  const location = useLocation();

  // On any route change: ensure sidebar is closed and focus the first carousel card
  React.useEffect(() => {
    closeSidebar();
    const focusFirstCard = () => {
      const firstRow = document.querySelector<HTMLDivElement>("[data-carousel='true']");
      if (!firstRow) return;
      const firstCard = firstRow.querySelector<HTMLAnchorElement>(
        "a[data-card-link='true']",
      );
      firstCard?.focus();
    };
    const raf = requestAnimationFrame(() => {
      setTimeout(focusFirstCard, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname, closeSidebar]);

  return (
    <div className="bg-background flex min-h-screen">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Backdrop to block underlying UI when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarOpen ? "pointer-events-none ml-64" : "ml-0",
        )}
        aria-hidden={sidebarOpen}
      >
        {/* Toggle button when sidebar is closed */}
        {!sidebarOpen && (
          <div className="fixed top-4 left-4 z-30">
            <Button
              variant="outline"
              size="sm"
              onClick={openSidebar}
              className="h-10 w-10 p-0"
              tabIndex={-1}
              aria-hidden
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}

function AppLayout() {
  return (
    <InputManagerProvider>
      <Shell />
    </InputManagerProvider>
  );
}
