import type { MetadataRoute } from "next";

/**
 * Manifest PWA — support natif de Next 16, aucune dépendance type `next-pwa`.
 * Pas de service worker dans ce lot : l'app est installable, pas encore offline.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GAgenda — emploi du temps Génie Atomique",
    short_name: "GAgenda",
    description:
      "L'emploi du temps du Génie Atomique, sur ton téléphone, sans passer par l'ENT.",
    start_url: "/edt",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    background_color: "#fafafa",
    theme_color: "#003367",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
