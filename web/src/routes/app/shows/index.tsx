import { createFileRoute } from "@tanstack/react-router";
import { ShowsPage } from "~/components/content/ShowsPage";

export const Route = createFileRoute("/app/shows/")({
  component: ShowsPage,
});

