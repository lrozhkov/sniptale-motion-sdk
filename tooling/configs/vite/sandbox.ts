import { resolve } from "node:path";
import { defineConfig } from "vite";
import { createDevServerWatchOptions } from "../../vite/dev-watch.ts";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const SANDBOX_ROOT = resolve(REPOSITORY_ROOT, "src/apps/sandbox");

export default defineConfig({
  appType: "mpa",
  cacheDir: resolve(REPOSITORY_ROOT, ".tmp/vite/sandbox"),
  envDir: REPOSITORY_ROOT,
  publicDir: false,
  root: SANDBOX_ROOT,
  worker: {
    format: "es",
  },
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
    watch: createDevServerWatchOptions(),
  },
  build: {
    outDir: resolve(REPOSITORY_ROOT, "dist/apps/sandbox"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(SANDBOX_ROOT, "sandbox.html"),
    },
  },
});
