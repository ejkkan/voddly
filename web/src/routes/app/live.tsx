import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LiveChannelsPage } from "~/components/content/LiveChannelsPage";

export const Route = createFileRoute("/app/live")({
  component: () => (
    <>
      <LiveChannelsPage />
      <Outlet />
    </>
  ),
});
