import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Assetly",
    short_name: "Assetly",
    description:
      "Assetly ile varlık, bakım, servis, belge ve maliyet süreçlerini tek panelde yönetin.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070b18",
    theme_color: "#070b18",
    lang: "tr-TR",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/icons/icon-192-v2.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-v2.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
