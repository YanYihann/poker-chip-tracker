import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PokerChip Ledger",
    short_name: "PokerChip",
    description: "Chip accounting and settlement for Texas Hold'em sessions",
    start_url: "/online",
    display: "standalone",
    background_color: "#153e35",
    theme_color: "#153e35",
    icons: [
      { src: "/icons/poker-chip-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/poker-chip-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/poker-chip-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
