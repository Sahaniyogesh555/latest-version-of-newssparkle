import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // The dev server is reached through proxied preview hosts (and any LAN
    // device), so Vite's host allowlist must not reject them.
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    brotliSize: true,
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Only third-party code is grouped here. Application code is left to
        // Rollup so the lazy() route imports in App.tsx actually produce one
        // chunk per route — the previous config forced every file under
        // src/pages and src/components into two shared chunks, which defeated
        // code splitting entirely (18 routes in a single 115 kB request).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
          if (id.includes("react-router") || id.includes("react-helmet")) return "router-vendor";
          if (
            id.includes("react-markdown") ||
            id.includes("remark") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("unified")
          ) {
            return "markdown-vendor";
          }
          return "vendor";
        },
      },
    },
  },
}));
