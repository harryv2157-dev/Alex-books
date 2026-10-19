import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Your Library",
    short_name: "Library",
    description: "A cosy place to track what you're reading.",
    start_url: "/",
    display: "standalone",
    background_color: "#1f1712",
    theme_color: "#1f1712",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
