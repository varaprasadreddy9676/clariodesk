import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// VitePWA's dev-server hook conflicts with this Vite build's react-refresh
// transform (breaks every module transform in `vite dev` — unrelated to
// devOptions). It only needs to run for production builds anyway, since the
// service worker itself is a build-time-only concern.
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "build"
      ? [
          VitePWA({
            // We author our own service worker (src/sw.ts) so it can handle
            // Web Push + notification clicks — Workbox's auto-generated SW
            // only does asset caching, not push events.
            strategies: "injectManifest",
            // Lives outside src/ — Vite's dev-server react-refresh transform
            // otherwise chokes on any .ts file in src, even one it never
            // registers or imports in dev (this file only builds for prod).
            srcDir: "sw-src",
            filename: "sw.ts",
            injectRegister: "auto",
            registerType: "autoUpdate",
            manifest: {
              name: "ClarioDesk",
              short_name: "ClarioDesk",
              description: "The open-source WhatsApp team inbox",
              theme_color: "#17b26a",
              background_color: "#0b141a",
              display: "standalone",
              start_url: "/",
              scope: "/",
              icons: [
                {
                  src: "/icons/icon-192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "/icons/icon-512.png",
                  sizes: "512x512",
                  type: "image/png",
                },
                {
                  src: "/icons/icon-512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
            },
            injectManifest: {
              // Precache only the built app shell — API calls and media
              // always go through the network, never the cache.
              globPatterns: ["**/*.{js,css,html}"],
            },
          }),
        ]
      : []),
  ],
  server: {
    port: 5173,
  },
}));
