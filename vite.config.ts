import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static site. `base: "./"` keeps the same build working locally and on
// GitHub Pages (served from /one-question-market/).
export default defineConfig({
  plugins: [react()],
  base: "./",
  // Solana libs expect a Node-style `global` and `Buffer`. The Buffer
  // polyfill itself lives in src/polyfills.ts and is imported first in
  // src/main.tsx; this define covers libraries that read `global` at load.
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    // @anchor-lang/core is CommonJS; let Vite pre-bundle it (and the rest of
    // the Solana stack) so the ESM app can import it.
    include: [
      "@anchor-lang/core",
      "@pm-amm/sdk",
      "@solana/web3.js",
      "@solana/spl-token",
      "buffer",
      "bs58",
    ],
    esbuildOptions: {
      define: { global: "globalThis" },
    },
  },
});
