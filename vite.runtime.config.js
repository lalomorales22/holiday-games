import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "dist/runtime",
    emptyOutDir: true,
    lib: {
      entry: "src/game-runtime.js",
      name: "HolidayRuntime",
      formats: ["iife"],
      fileName: () => "game-runtime.js",
    },
    chunkSizeWarningLimit: 1200,
  },
});
