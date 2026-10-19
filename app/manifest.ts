import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cycle",
    short_name: "Cycle",
    description:
      "Un diario intimo e semplice per il tuo ciclo. I dati restano sul dispositivo.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    display_override: ["standalone"],
    orientation: "portrait",
    background_color: "#faf5ec",
    theme_color: "#faf5ec",
    lang: "it",
    categories: ["health", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
