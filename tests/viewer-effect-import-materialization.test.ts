import { File as NodeFile } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  materializeEffectImportFiles,
  verifyMaterializedEffectImportSource,
} from "../src/apps/viewer/effect-file/import-materialization.js";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';

function documentFile(
  assets: unknown[],
  name = "example.sniptale-effect.json",
): File {
  return new NodeFile([JSON.stringify({ assets })], name, {
    type: "application/json",
  }) as unknown as File;
}

function svgFile(name = "logo.svg", content = SVG): File {
  return new NodeFile([content], name, {
    type: "image/svg+xml",
  }) as unknown as File;
}

function pathAsset(path = "assets/logo.svg") {
  return {
    id: "logo",
    kind: "svg",
    mimeType: "image/svg+xml",
    path,
  };
}

describe("Effect v1 import materialization", () => {
  it("rejects non-text sources before JSON coercion can run", async () => {
    let conversions = 0;
    await expect(
      verifyMaterializedEffectImportSource({
        toString() {
          conversions += 1;
          return "{}";
        },
      }),
    ).rejects.toThrow("must be JSON text");
    expect(conversions).toBe(0);
  });

  it("rejects string byte lengths instead of coercing integrity metadata", async () => {
    await expect(
      verifyMaterializedEffectImportSource(
        JSON.stringify({
          assets: [
            {
              ...pathAsset(),
              svgText: SVG,
              byteLength: String(new TextEncoder().encode(SVG).byteLength),
            },
          ],
        }),
      ),
    ).rejects.toThrow("byteLength does not match");
  });
  it("materializes every referenced path and records verified integrity", async () => {
    const result = await materializeEffectImportFiles([
      documentFile([pathAsset()]),
      svgFile(),
    ] as unknown as File[]);
    const value = JSON.parse(result.source);

    expect(result.sourceName).toBe("example.sniptale-effect.json");
    expect(value.assets[0]).toMatchObject({
      byteLength: new TextEncoder().encode(SVG).byteLength,
      id: "logo",
      svgText: SVG,
    });
    expect(value.assets[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects missing, unused, duplicate, and traversal-selected files", async () => {
    await expect(
      materializeEffectImportFiles([
        documentFile([pathAsset()]),
      ] as unknown as File[]),
    ).rejects.toThrow(/Missing file/);
    await expect(
      materializeEffectImportFiles([
        documentFile([]),
        svgFile(),
      ] as unknown as File[]),
    ).rejects.toThrow(/not referenced/);

    const first = svgFile();
    const duplicate = svgFile();
    await expect(
      materializeEffectImportFiles([
        documentFile([pathAsset()]),
        first,
        duplicate,
      ] as unknown as File[]),
    ).rejects.toThrow(/Duplicate selected asset path/);

    const unsafe = svgFile();
    Object.defineProperty(unsafe, "webkitRelativePath", {
      value: "../logo.svg",
    });
    await expect(
      materializeEffectImportFiles([
        documentFile([pathAsset()]),
        unsafe,
      ] as unknown as File[]),
    ).rejects.toThrow(/Unsafe selected asset path/);
  });

  it("rejects MIME/signature mismatch and ambiguous basename resolution", async () => {
    await expect(
      materializeEffectImportFiles([
        documentFile([pathAsset()]),
        svgFile("logo.svg", "not svg"),
      ] as unknown as File[]),
    ).rejects.toThrow(/does not match image\/svg\+xml/);

    const first = svgFile();
    const second = svgFile();
    Object.defineProperty(first, "webkitRelativePath", {
      value: "one/logo.svg",
    });
    Object.defineProperty(second, "webkitRelativePath", {
      value: "two/logo.svg",
    });
    await expect(
      materializeEffectImportFiles([
        documentFile([pathAsset("logo.svg")]),
        first,
        second,
      ] as unknown as File[]),
    ).rejects.toThrow(/Missing file/);
  });

  it("rejects tampered embedded content before application state can change", async () => {
    const valid = await materializeEffectImportFiles([
      documentFile([pathAsset()]),
      svgFile(),
    ] as unknown as File[]);
    const value = JSON.parse(valid.source);
    value.assets[0].svgText = SVG.replace("0 0 1 1", "0 0 2 2");

    await expect(
      verifyMaterializedEffectImportSource(JSON.stringify(value)),
    ).rejects.toThrow(/SHA-256 does not match/);
  });

  it("does not permit direct-source import to bypass path materialization", async () => {
    await expect(
      verifyMaterializedEffectImportSource(
        JSON.stringify({ assets: [pathAsset()] }),
      ),
    ).rejects.toThrow(/no materialized content/);
  });
});
