import { createFileRoute } from "@tanstack/react-router";
import { DashboardHome } from "~/components/dashboard/DashboardHome";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  return <DashboardHome />;
}
