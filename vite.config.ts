import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works on GitHub Pages project sites
// (https://user.github.io/repo/) as well as on a custom domain.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // CI builds from a clean checkout, so there is nothing to empty. Disabling
    // the cleanup keeps local builds working in file-restricted environments.
    emptyOutDir: false,
  },
});
