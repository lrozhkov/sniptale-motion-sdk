import {
  responseObject,
  responseString,
} from "../tooling/test/fixtures/response.js";

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
  return new File([JSON.stringify({ assets })], name, {
    type: "application/json",
  });
}

function svgFile(name = "logo.svg", content = SVG): File {
  return new File([content], name, {
    type: "image/svg+xml",
  });
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
    ]);
    const value: unknown = JSON.parse(result.source);

    expect(result.sourceName).toBe("example.sniptale-effect.json");
    expect(responseObject(value, "assets", 0)).toMatchObject({
      byteLength: new TextEncoder().encode(SVG).byteLength,
      id: "logo",
      svgText: SVG,
    });
    expect(responseString(value, "assets", 0, "sha256")).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("rejects missing, unused, duplicate, and traversal-selected files", async () => {
    await expect(
      materializeEffectImportFiles([documentFile([pathAsset()])]),
    ).rejects.toThrow(/Missing file/);
    await expect(
      materializeEffectImportFiles([documentFile([]), svgFile()]),
    ).rejects.toThrow(/not referenced/);

    const first = svgFile();
    const duplicate = svgFile();
    await expect(
      materializeEffectImportFiles([
        documentFile([pathAsset()]),
        first,
        duplicate,
      ]),
    ).rejects.toThrow(/Duplicate selected asset path/);

    const unsafe = svgFile();
    Object.defineProperty(unsafe, "webkitRelativePath", {
      value: "../logo.svg",
    });
    await expect(
      materializeEffectImportFiles([documentFile([pathAsset()]), unsafe]),
    ).rejects.toThrow(/Unsafe selected asset path/);
  });

  it("rejects MIME/signature mismatch and ambiguous basename resolution", async () => {
    await expect(
      materializeEffectImportFiles([
        documentFile([pathAsset()]),
        svgFile("logo.svg", "not svg"),
      ]),
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
      ]),
    ).rejects.toThrow(/Missing file/);
  });

  it("rejects tampered embedded content before application state can change", async () => {
    const valid = await materializeEffectImportFiles([
      documentFile([pathAsset()]),
      svgFile(),
    ]);
    const value: unknown = JSON.parse(valid.source);
    responseObject(value, "assets", 0).svgText = SVG.replace(
      "0 0 1 1",
      "0 0 2 2",
    );

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
