import { describe, expect, it } from "vitest";
import { createSecurityEnvironment, NPM_REGISTRY } from "./environment.mjs";

describe("security scanner environment", () => {
  it("removes scope, configuration, and runtime injection overrides", () => {
    const environment = createSecurityEnvironment(
      {
        PATH: "/trusted/bin",
        CI: "true",
        GITLEAKS_CONFIG: "/tmp/weakened.toml",
        GITLEAKS_CONFIG_TOML: "[[allowlists]]",
        NPM_CONFIG_OMIT: "dev",
        npm_config_registry: "https://registry.invalid/",
        OSV_SCANNER_CONFIG: "/tmp/osv.toml",
        SCALIBR_SKIP: "all",
        GIT_DIR: "/tmp/unrelated.git",
        GIT_CONFIG_COUNT: "1",
        NODE_OPTIONS: "--import=/tmp/inject.mjs",
        NODE_PATH: "/tmp/modules",
      },
      { npmUserConfig: "/repo/.tmp/security/npmrc" },
    );

    expect(environment).toEqual({
      PATH: "/trusted/bin",
      CI: "true",
      NPM_CONFIG_REGISTRY: NPM_REGISTRY,
      NPM_CONFIG_USERCONFIG: "/repo/.tmp/security/npmrc",
    });
  });
});
