import { createFileRoute } from "@tanstack/react-router";
import { MovieDetails } from "~/components/content/details/MovieDetails";

export const Route = createFileRoute("/app/movies/$playlistId/$movieId")({
  component: MovieDetails,
});
