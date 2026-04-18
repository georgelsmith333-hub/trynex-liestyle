import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const port = Number(process.env.PORT ?? "8081");
const basePath = process.env.BASE_PATH ?? "/";
const isReplit = !!process.env.REPL_ID;
const isDev = process.env.NODE_ENV !== "production";
const apiPort = process.env.API_PORT ?? "8080";

export default defineConfig(async () => {
  const plugins: any[] = [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        additionalManifestEntries: [{ url: "/offline.html", revision: null }],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ];

  if (isDev && isReplit) {
    try {
      const { default: runtimeErrorOverlay } = await import("@replit/vite-plugin-runtime-error-modal");
      plugins.push(runtimeErrorOverlay());
    } catch {}
    try {
      const { cartographer } = await import("@replit/vite-plugin-cartographer");
      plugins.push(cartographer({ root: path.resolve(import.meta.dirname, "..") }));
    } catch {}
    try {
      const { devBanner } = await import("@replit/vite-plugin-dev-banner");
      plugins.push(devBanner());
    } catch {}
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-motion": ["framer-motion"],
            "vendor-query": ["@tanstack/react-query"],
            "vendor-radix": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-tabs",
              "@radix-ui/react-select",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-toast",
              "@radix-ui/react-popover",
            ],
            "vendor-editor": [
              "@tiptap/react",
              "@tiptap/starter-kit",
            ],
            "vendor-charts": ["recharts"],
          },
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
