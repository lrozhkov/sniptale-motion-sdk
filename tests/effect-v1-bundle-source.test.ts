import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  isPathContained,
  readMaterializedEffectV1Bundle,
} from "../src/apps/cli/bundle-source";
import { MAX_ASSET_BYTES } from "../src/sdk/protocol";

const cleanup: string[] = [];

afterEach(() => {
  for (const directory of cleanup.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("Effect v1 bundle asset root", () => {
  it("materializes an asset stored inside the real asset root", async () => {
    const fixture = createFixture();
    writeFileSync(join(fixture.root, "mark.svg"), "<svg></svg>");

    const source = await readMaterializedEffectV1Bundle(
      fixture.document,
      fixture.root,
    );

    expect(JSON.parse(source).assets[0]).toMatchObject({
      byteLength: 11,
      svgText: "<svg></svg>",
    });
  });

  it("rejects an in-root symlink that resolves outside the asset root", async () => {
    const fixture = createFixture();
    const outside = join(fixture.parent, "outside.svg");
    writeFileSync(outside, "<svg></svg>");
    symlinkSync(outside, join(fixture.root, "mark.svg"));

    await expect(
      readMaterializedEffectV1Bundle(fixture.document, fixture.root),
    ).rejects.toMatchObject({
      code: "ASSET_PATH_UNSAFE",
      path: "$.assets[0].path",
    });
  });

  it("preserves the missing-file diagnostic", async () => {
    const fixture = createFixture();

    await expect(
      readMaterializedEffectV1Bundle(fixture.document, fixture.root),
    ).rejects.toMatchObject({
      code: "ASSET_FILE_MISSING",
      path: "$.assets[0].path",
    });
  });

  it("rejects oversized files before materializing their bytes", async () => {
    const fixture = createFixture();
    writeFileSync(
      join(fixture.root, "mark.svg"),
      Buffer.alloc(MAX_ASSET_BYTES + 1, 0x20),
    );

    await expect(
      readMaterializedEffectV1Bundle(fixture.document, fixture.root),
    ).rejects.toMatchObject({
      code: "ASSET_SIZE",
      path: "$.assets[0].path",
    });
  });

  it("rejects Windows cross-volume relations", () => {
    expect(isPathContained("C:\\repo\\assets", "D:\\outside.svg", win32)).toBe(
      false,
    );
    expect(
      isPathContained("C:\\repo\\assets", "C:\\repo\\assets\\mark.svg", win32),
    ).toBe(true);
  });
});

function createFixture() {
  const parent = mkdtempSync(join(tmpdir(), "sniptale-effect-bundle-"));
  cleanup.push(parent);
  const root = join(parent, "assets");
  const document = join(parent, "effect.sniptale-effect.json");
  mkdirSync(root);
  writeFileSync(
    document,
    JSON.stringify({
      assets: [
        {
          id: "mark",
          kind: "svg",
          mimeType: "image/svg+xml",
          path: "mark.svg",
        },
      ],
    }),
  );
  return { document, parent, root };
}
