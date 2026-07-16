import { createFileRoute } from "@tanstack/react-router";

// The home page is the static file public/home.html. This route just redirects
// so the marketing site is what visitors see at `/`.
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async () => new Response(null, { status: 302, headers: { Location: "/home.html" } }),
    },
  },
  component: () => null,
});
