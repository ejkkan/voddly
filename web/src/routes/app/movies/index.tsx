import { createFileRoute } from "@tanstack/react-router";
import { MoviesPage } from "~/components/content/MoviesPage";

export const Route = createFileRoute("/app/movies/")({
  component: MoviesPage,
});
