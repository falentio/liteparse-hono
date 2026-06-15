import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      input: "src/index.ts",
      output: {
        entryFileNames: "index.js",
        format: "esm",
      },
    },
  },
});
