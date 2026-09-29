import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const development = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    // Production stays compatible with GitHub Pages and the existing .html URLs.
    ...(development ? {} : { output: "export" }),
    trailingSlash: false,
    images: { unoptimized: true },
    poweredByHeader: false,
    // Rewrites need a server, so they are restricted to the local dev server.
    ...(development
      ? {
          async rewrites() {
            return [
              { source: "/index.html", destination: "/" },
              ...["works", "partners", "events", "contact"].map((page) => ({
                source: `/${page}.html`,
                destination: `/${page}`,
              })),
            ];
          },
        }
      : {}),
  };
}
