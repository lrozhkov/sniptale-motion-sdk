import { mkdtempSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { validateEffectV1Document } from "../src/sdk/effect-v1/index.js";
import { generateNeutralLocalPack } from "../tooling/test/fixtures/local-pack.mjs";

const OUTPUT = resolve(
  process.cwd(),
  `.tmp/test-fixtures/packs/neutral-${process.pid}`,
);
const SYMLINK_PARENT = resolve(
  process.cwd(),
  `.tmp/test-fixtures/symlink-parent-${process.pid}`,
);
const PRESERVED_SIBLING = resolve(
  dirname(OUTPUT),
  `extension-engine2-current-delta-${process.pid}`,
);
const externalCleanup: string[] = [];

afterEach(async () => {
  await Promise.all([
    rm(OUTPUT, { force: true, recursive: true }),
    rm(SYMLINK_PARENT, { force: true, recursive: true }),
    rm(PRESERVED_SIBLING, { force: true, recursive: true }),
    ...externalCleanup
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  ]);
});

describe("local pack fixture storage", () => {
  it("generates neutral documents and assets only below .tmp", async () => {
    const generated = await generateNeutralLocalPack(OUTPUT);
    const documents = await Promise.all(
      generated.documentPaths.map(async (path: string) =>
        JSON.parse(await readFile(path, "utf8")),
      ),
    );
    const manifest = JSON.parse(await readFile(generated.manifestPath, "utf8"));
    const asset = await readFile(generated.assetPath, "utf8");

    expect(generated.root).toBe(OUTPUT);
    expect(
      documents.map((document) => validateEffectV1Document(document).ok),
    ).toEqual([true, true, true]);
    expect(manifest.modules.map(({ id }: { id: string }) => id)).toEqual([
      "neutral-standalone",
      "neutral-target-effect",
      "neutral-transition",
    ]);
    expect(manifest.assets).toEqual([
      expect.objectContaining({
        id: "neutral-mark",
        path: "assets/neutral-mark.svg",
      }),
    ]);
    expect(asset).toContain("<svg");
  });

  it("rejects output outside repository .tmp", async () => {
    await expect(
      generateNeutralLocalPack(resolve(process.cwd(), "public/packs/neutral")),
    ).rejects.toThrow("must be generated below");
  });

  it("rejects a symlinked output ancestor without touching its target", async () => {
    const outside = mkdtempSync(
      resolve(tmpdir(), "sniptale-local-pack-outside-"),
    );
    externalCleanup.push(outside);
    const marker = resolve(outside, "keep.txt");
    await writeFile(marker, "keep", "utf8");
    await mkdir(dirname(SYMLINK_PARENT), { recursive: true });
    await symlink(outside, SYMLINK_PARENT, "dir");

    await expect(
      generateNeutralLocalPack(resolve(SYMLINK_PARENT, "packs/demo")),
    ).rejects.toThrow("cannot cross symlink");
    expect(await readFile(marker, "utf8")).toBe("keep");
  });

  it("does not remove extension-engine2 sibling artifacts", async () => {
    const marker = resolve(PRESERVED_SIBLING, "README.md");
    await mkdir(PRESERVED_SIBLING, { recursive: true });
    await writeFile(marker, "temporary evidence", "utf8");

    await generateNeutralLocalPack(OUTPUT);

    expect(await readFile(marker, "utf8")).toBe("temporary evidence");
  });
});
