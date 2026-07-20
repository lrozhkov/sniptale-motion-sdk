import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("viewer lazy feature loading", () => {
  it("keeps graph and export owners out of the startup dependency graph", () => {
    const bootstrap = read("src/apps/viewer/app/bootstrap.ts");
    const lazyExports = read("src/apps/viewer/app/lazy-export-features.ts");
    const lazyGraph = read("src/apps/viewer/graph-editor/lazy.ts");

    expect(bootstrap).not.toContain("../graph-editor/install.js");
    expect(bootstrap).not.toContain("../video-export/controller.js");
    expect(bootstrap).not.toContain("sniptale-pack-export");
    expect(lazyGraph).toContain('import("./install.js")');
    expect(lazyExports).toContain('import("../video-export/controller.js")');
    expect(lazyExports).not.toContain("sniptale-pack-export");
  });
});

function read(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}
