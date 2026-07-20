import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createNeutralEffectV1Document } from "../tooling/test/fixtures/effect-v1-documents";
import { readLocalEffectSources } from "../tooling/vite/local-effects";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("local Effect v1 development discovery", () => {
  it("materializes valid bundles and selects the newest document by default", async () => {
    const root = await createTemporaryRoot();
    await writeEffect(
      root,
      "older-effect",
      createNeutralEffectV1Document("standalone"),
    );
    const newer = await writeEffect(
      root,
      "newer-effect",
      createEffectWithSvgAsset("newer-effect"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#63dbe7"/></svg>\n',
    );
    await utimes(newer, new Date(2_000), new Date(2_000));
    await utimes(
      resolve(root, "older-effect/older-effect.sniptale-effect.json"),
      new Date(1_000),
      new Date(1_000),
    );

    const catalog = await readLocalEffectSources(root);

    expect(catalog.errors).toEqual([]);
    expect(catalog.effects.map((effect) => effect.sourceName)).toEqual([
      "newer-effect.sniptale-effect.json",
      "older-effect.sniptale-effect.json",
    ]);
    expect(catalog.effects.map((effect) => effect.default)).toEqual([
      true,
      false,
    ]);
    expect(JSON.parse(catalog.effects[0].source).assets[0]).toMatchObject({
      byteLength: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      svgText: expect.stringContaining("#63dbe7"),
    });
  });

  it("reports invalid documents without exposing them to the viewer", async () => {
    const root = await createTemporaryRoot();
    await writeEffect(root, "broken-effect", {
      ...createNeutralEffectV1Document("standalone"),
      id: "broken-effect",
      schemaVersion: "sniptale.effect.v9",
    });

    const catalog = await readLocalEffectSources(root);

    expect(catalog.effects).toEqual([]);
    expect(catalog.errors.join("\n")).toContain("SCHEMA_UNSUPPORTED");
  });
});

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sniptale-local-effects-"));
  temporaryRoots.push(root);
  return root;
}

async function writeEffect(
  root: string,
  id: string,
  document: any,
  svgText?: string,
): Promise<string> {
  const effectRoot = resolve(root, id);
  await mkdir(resolve(effectRoot, "assets"), { recursive: true });
  const effect = { ...document, id };
  const path = resolve(effectRoot, `${id}.sniptale-effect.json`);
  await writeFile(path, `${JSON.stringify(effect, null, 2)}\n`, "utf8");
  if (svgText) {
    await writeFile(resolve(effectRoot, "assets/mark.svg"), svgText, "utf8");
  }
  return path;
}

function createEffectWithSvgAsset(id: string): any {
  const document: any = createNeutralEffectV1Document("standalone");
  document.id = id;
  document.assets = [
    {
      height: 10,
      id: "mark",
      kind: "svg",
      mimeType: "image/svg+xml",
      path: "assets/mark.svg",
      width: 10,
    },
  ];
  document.program.commands.push({
    assetId: "mark",
    height: 10,
    op: "image",
    width: 10,
    x: 0,
    y: 0,
  });
  return document;
}
