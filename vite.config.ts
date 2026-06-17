import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node24",
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: "src/index.ts",
      output: {
        entryFileNames: "index.js",
        format: "esm",
      },
    },
  },
});
