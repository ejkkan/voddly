import { createFileRoute } from "@tanstack/react-router";
import { SeriesDetails } from "~/components/content/details/SeriesDetails";

export const Route = createFileRoute("/app/shows/$playlistId/$seriesId")({
  component: SeriesDetails,
});




