import { createFileRoute } from "@tanstack/react-router";
import { Game } from "../game/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "TBLE — First-Person Table Shooter" },
      { name: "description", content: "Battle living tables offline or fight friends online in 1v1s, lobbies and parties." },
      { property: "og:title", content: "TBLE — First-Person Table Shooter" },
      { property: "og:description", content: "Battle living tables offline or fight friends online in 1v1s, lobbies and parties." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
