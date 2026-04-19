import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const port = Number(process.env.PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";
const apiPort = process.env.API_PORT ?? "8080";

/**
 * Cloudflare Rocket Loader rewrites every `<script>` it sees, including
 * `<script type="module">`, replacing the `type` attribute with a synthetic
 * value like `type="b1323df6...module"`. The browser then refuses to execute
 * the script, the React bundle never boots, and the page stays a blank white
 * screen — particularly on mobile, where the timing race is much harder to
 * win than on desktop.
 *
 * The supported escape hatch is to mark each script with `data-cfasync="false"`,
 * which tells Rocket Loader to leave it alone. We inject the attribute into
 * every <script> tag in the built index.html (and on the dev server) so we
 * don't depend on the Cloudflare dashboard setting being correct.
 */
function addCfAsyncFalse(html: string): string {
  // Strip HTML comments out of consideration first so we don't mutate the
  // text inside `<!-- ... <script ... -->` documentation blocks. We only
  // operate on the live markup between comments.
  const COMMENT_RE = /<!--[\s\S]*?-->/g;
  const parts: { isComment: boolean; text: string }[] = [];
  let lastIdx = 0;
  for (const m of html.matchAll(COMMENT_RE)) {
    if (m.index! > lastIdx) parts.push({ isComment: false, text: html.slice(lastIdx, m.index!) });
    parts.push({ isComment: true, text: m[0] });
    lastIdx = m.index! + m[0].length;
  }
  if (lastIdx < html.length) parts.push({ isComment: false, text: html.slice(lastIdx) });

  // Only an opening `<script` followed by whitespace, `>`, or `/` is a real
  // tag opener; this avoids mutating literal `<scripty` text inside JSON-LD
  // blobs. The negative lookahead skips tags that already carry
  // data-cfasync so we don't double-stamp.
  const TAG_RE = /<script(?=[\s>/])(?![^>]*\bdata-cfasync\b)/gi;
  return parts
    .map((p) => (p.isComment ? p.text : p.text.replace(TAG_RE, '<script data-cfasync="false"')))
    .join("");
}

const cfDisableRocketLoader = {
  name: "trynex:disable-cf-rocket-loader",
  // Stamp the dev server response so dev iframes match production behaviour.
  transformIndexHtml: {
    order: "post" as const,
    handler(html: string): string {
      return addCfAsyncFalse(html);
    },
  },
  // vite-plugin-pwa appends its <script id="vite-plugin-pwa:register-sw">
  // tag *after* all transformIndexHtml hooks run, so we also rewrite the
  // emitted dist/index.html on disk once the bundle is fully written.
  async closeBundle() {
    try {
      const fs = await import("node:fs/promises");
      const outFile = path.resolve(import.meta.dirname, "dist/index.html");
      const html = await fs.readFile(outFile, "utf8");
      const patched = addCfAsyncFalse(html);
      if (patched !== html) await fs.writeFile(outFile, patched, "utf8");
    } catch {
      // dist/index.html doesn't exist (e.g. dev mode) — nothing to do.
    }
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    cfDisableRocketLoader,
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/mockups/**"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        additionalManifestEntries: [{ url: "/offline.html", revision: null }],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
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
});
