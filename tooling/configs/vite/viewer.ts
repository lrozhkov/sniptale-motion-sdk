import { resolve } from "node:path";
import { defineConfig } from "vite";
import { createDevServerWatchOptions } from "../../vite/dev-watch";
import { createLocalEffectsPlugin } from "../../vite/local-effects";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const VIEWER_ROOT = resolve(REPOSITORY_ROOT, "src/apps/viewer");

export default defineConfig(({ command }) => {
  const includeLocalDemoPack = shouldIncludeLocalDemoPack(
    command,
    process.env.EFFECT_SDK_INCLUDE_LOCAL_DEMO_PACK,
  );

  return {
    appType: "mpa",
    cacheDir: resolve(REPOSITORY_ROOT, ".tmp/vite/viewer"),
    define: {
      __EFFECT_SDK_LOCAL_DEMO_PACK__: JSON.stringify(includeLocalDemoPack),
      __EFFECT_SDK_LOCAL_EFFECTS__: JSON.stringify(command === "serve"),
    },
    envDir: REPOSITORY_ROOT,
    publicDir: includeLocalDemoPack
      ? resolve(REPOSITORY_ROOT, ".tmp/local/public")
      : false,
    root: VIEWER_ROOT,
    plugins: command === "serve" ? [createLocalEffectsPlugin()] : [],
    server: {
      host: "127.0.0.1",
      port: 4177,
      strictPort: true,
      watch: createDevServerWatchOptions(),
    },
    build: {
      outDir: resolve(REPOSITORY_ROOT, "dist/apps/viewer"),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(VIEWER_ROOT, "index.html"),
      },
    },
  };
});

export function shouldIncludeLocalDemoPack(
  command: "build" | "serve",
  environmentFlag?: string,
): boolean {
  return command === "serve" || environmentFlag === "1";
}
