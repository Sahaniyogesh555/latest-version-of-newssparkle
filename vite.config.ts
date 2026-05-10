import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
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
        manualChunks(id) {
          // Vendor chunks
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
            }
            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }
            if (id.includes("lucide-react")) {
              return "icons-vendor";
            }
            if (id.includes("react-router") || id.includes("react-helmet")) {
              return "router-vendor";
            }
            if (id.includes("react-markdown") || id.includes("remark-gfm")) {
              return "markdown-vendor";
            }
            return "vendor";
          }
          // App chunks
          if (id.includes("src/pages/")) {
            return "pages";
          }
          if (id.includes("src/components/")) {
            return "components";
          }
          if (id.includes("src/lib/")) {
            return "utils";
          }
        },
      },
    },
  },
}));
