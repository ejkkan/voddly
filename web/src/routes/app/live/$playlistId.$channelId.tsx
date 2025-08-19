import { createFileRoute } from "@tanstack/react-router";
import { LiveChannelDetails } from "~/components/content/details/LiveChannelDetails";

export const Route = createFileRoute("/app/live/$playlistId/$channelId")({
  component: LiveChannelDetails,
});








