import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => ({
  // Build optimizations for SPA
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
  },
  // Optimize dev server
  server: {
    hmr: {
      overlay: false,
    },
  },
  // Asset optimization
  assetsInclude: ['**/*.woff2', '**/*.woff'],
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      // https://github.com/TanStack/router/discussions/2863#discussioncomment-13713677
      customViteReactPlugin: true,

      tsr: {
        quoteStyle: "double",
        semicolons: true,
      },

      // SPA Configuration
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/_shell.html",
          crawlLinks: true,
          retryCount: 3,
        },
      },

      // https://tanstack.com/start/latest/docs/framework/react/hosting#deployment
      // target: "node-server", // Commented out for SPA mode
    }),
    viteReact({
      // https://react.dev/learn/react-compiler
      babel: {
        plugins: [
          [
            "babel-plugin-react-compiler",
            {
              target: "19",
            },
          ],
        ],
      },
    }),
    tailwindcss(),
  ],
}));
