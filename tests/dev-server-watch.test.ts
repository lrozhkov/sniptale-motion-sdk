import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DEV_SERVER_WATCH_IGNORED } from "../tooling/vite/dev-watch";
import sandboxConfig from "../tooling/configs/vite/sandbox";
import viewerConfig, {
  shouldIncludeLocalDemoPack,
} from "../tooling/configs/vite/viewer";

const viewerDevConfig =
  typeof viewerConfig === "function"
    ? viewerConfig({ command: "serve", mode: "test" })
    : viewerConfig;
const viewerBuildConfig =
  typeof viewerConfig === "function"
    ? viewerConfig({ command: "build", mode: "test" })
    : viewerConfig;
const repositoryRoot = resolve(import.meta.dirname, "..");

describe("development server watch boundaries", () => {
  it("binds viewer and sandbox to loopback by default", () => {
    expect(viewerDevConfig.server?.host).toBe("127.0.0.1");
    expect(sandboxConfig.server?.host).toBe("127.0.0.1");
  });

  it("keeps generated QA artifacts from reloading the editor runtime", () => {
    const expected = [...DEV_SERVER_WATCH_IGNORED];

    expect(viewerDevConfig.server?.watch?.ignored).toEqual(expected);
    expect(sandboxConfig.server?.watch?.ignored).toEqual(expected);
    expect(expected).toEqual(["**/.tmp/**", "**/dist/**"]);
  });

  it("serves the graph-only local demo pack but keeps release builds clean", () => {
    expect(shouldIncludeLocalDemoPack("serve")).toBe(true);
    expect(shouldIncludeLocalDemoPack("build")).toBe(false);
    expect(shouldIncludeLocalDemoPack("build", "1")).toBe(true);
    expect(viewerDevConfig.publicDir).toBe(
      resolve(repositoryRoot, ".tmp/local/public"),
    );
    expect(viewerBuildConfig.publicDir).toBe(false);
    expect(viewerDevConfig.define?.__EFFECT_SDK_LOCAL_EFFECTS__).toBe("true");
    expect(viewerBuildConfig.define?.__EFFECT_SDK_LOCAL_EFFECTS__).toBe(
      "false",
    );
    expect(
      viewerDevConfig.plugins?.some(
        (plugin) =>
          plugin &&
          "name" in plugin &&
          plugin.name === "sniptale-local-effects",
      ),
    ).toBe(true);
    expect(viewerBuildConfig.plugins).toEqual([]);
  });

  it("owns HTML and generated Vite state below the matching repository seams", () => {
    expect(viewerBuildConfig.root).toBe(
      resolve(repositoryRoot, "src/apps/viewer"),
    );
    expect(viewerBuildConfig.envDir).toBe(repositoryRoot);
    expect(viewerBuildConfig.cacheDir).toBe(
      resolve(repositoryRoot, ".tmp/vite/viewer"),
    );
    expect(viewerBuildConfig.build?.outDir).toBe(
      resolve(repositoryRoot, "dist/apps/viewer"),
    );
    expect(viewerBuildConfig.build?.rollupOptions?.input).toBe(
      resolve(repositoryRoot, "src/apps/viewer/index.html"),
    );

    expect(sandboxConfig.root).toBe(
      resolve(repositoryRoot, "src/apps/sandbox"),
    );
    expect(sandboxConfig.envDir).toBe(repositoryRoot);
    expect(sandboxConfig.cacheDir).toBe(
      resolve(repositoryRoot, ".tmp/vite/sandbox"),
    );
    expect(sandboxConfig.publicDir).toBe(false);
    expect(sandboxConfig.build?.outDir).toBe(
      resolve(repositoryRoot, "dist/apps/sandbox"),
    );
    expect(sandboxConfig.build?.rollupOptions?.input).toBe(
      resolve(repositoryRoot, "src/apps/sandbox/sandbox.html"),
    );
  });
});
