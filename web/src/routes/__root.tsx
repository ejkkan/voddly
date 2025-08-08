/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { getUser } from "~/lib/auth/functions/getUser";
import appCss from "~/styles.css?url";
import { env } from "~/env/client";

import { ThemeProvider } from "~/components/theme-provider";
import { Toaster } from "~/components/ui/sonner";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user: Awaited<ReturnType<typeof getUser>>;
}>()({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: ["user"],
      queryFn: ({ signal }) => getUser({ signal }),
      revalidateIfStale: true,
    }); // we're using react-query for caching, see router.tsx
    return { user };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        title: "IPTV Streaming Platform",
      },
      {
        name: "description",
        content: "Professional IPTV streaming platform with advanced playlist management and live streaming capabilities.",
      },
      {
        name: "theme-color",
        content: "#000000",
      },
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "default",
      },
      {
        name: "format-detection",
        content: "telephone=no",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const router = useRouter();
  const isShell = router.isShell?.() || false;

  // Enhanced shell rendering with loading fallback
  const shellContent = isShell ? (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground">Loading IPTV Platform...</p>
      </div>
    </div>
  ) : (
    <Outlet />
  );

  return (
    <RootDocument isShell={isShell}>
      {shellContent}
    </RootDocument>
  );
}

function RootDocument({ 
  children, 
  isShell 
}: { 
  readonly children: React.ReactNode;
  readonly isShell?: boolean;
}) {
  return (
    // suppress since we're updating the "dark" class in ThemeProvider
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <Toaster richColors />
        </ThemeProvider>

        {/* Only show dev tools in development and when not in shell mode */}
        {!isShell && env.VITE_ENABLE_DEVTOOLS && env.VITE_APP_ENV === "development" && (
          <>
            <ReactQueryDevtools buttonPosition="bottom-right" />
            <TanStackRouterDevtools position="bottom-right" />
          </>
        )}

        <Scripts />
      </body>
    </html>
  );
}
