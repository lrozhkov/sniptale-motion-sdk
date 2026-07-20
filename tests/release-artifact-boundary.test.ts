import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  inspectRetiredArtifactIdentity,
  verifyReleaseArtifact,
  writeDeclarationManifest,
} from "../tooling/release/artifact-boundary.mjs";

describe("release artifact boundary", () => {
  it("rejects retired identities in release paths and content", () => {
    const retiredProduct = ["smart", "capture"].join("");
    const retiredContract = ["effect", "-", "v", "4"].join("");
    const retiredMixedRoot = ["s", "C", "x", "Owner"].join("");

    expect(
      inspectRetiredArtifactIdentity(
        `sdk/${retiredProduct}.d.ts`,
        `export const product = ${JSON.stringify(retiredProduct)}; export const ${retiredMixedRoot} = true; export type Contract = ${JSON.stringify(retiredContract)};`,
        "content",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("retired product identity"),
        expect.stringContaining("retired short product identity"),
        expect.stringContaining("retired effect contract identity"),
      ]),
    );
    expect(
      inspectRetiredArtifactIdentity(
        "sdk/effect-v1/index.d.ts",
        "export type SniptaleEffectV1 = {};",
        "content",
      ),
    ).toEqual([]);
  });

  it("accepts an app and SDK artifact without repository-local fixtures", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<script type="module" src="/assets/index-AbCd1234.js"></script>',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/index-AbCd1234.js",
      "export {};",
    );
    await writeArtifact(
      root,
      "apps/sandbox/sandbox.html",
      "<!doctype html><main>Sandbox</main>",
    );
    await writeSdkDeclaration(root, "index", "export type Effect = {};");

    await expect(verifyReleaseArtifact(root)).resolves.toEqual({ files: 11 });
  });

  it("rejects demo packs and bundled test API markers", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(root, "apps/viewer/packs/demo/manifest.json", "{}");
    await writeArtifact(
      root,
      "apps/viewer/assets/index-AbCd1234.js",
      "window.effectsViewer = { setPreviewRenderCostForTest() {} };",
    );
    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /effectsViewer.*setPreviewRenderCostForTest.*forbidden release path packs/s,
    );
  });

  it("scans SDK declarations for local-only API markers", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(root, "apps/viewer/index.html", "<main>Editor</main>");
    await writeArtifact(
      root,
      "sdk/index.d.ts",
      "export declare function triggerSandboxTimeoutForTest(): void;",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /sdk\/index\.d\.ts.*triggerSandboxTimeoutForTest/s,
    );
  });

  it("rejects repository-local storage, evidence, and test paths", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    for (const path of [
      ".cache/state.json",
      ".git/config",
      ".tmp/evidence.json",
      "__tests__/fixture.js",
      "coverage/report.json",
      "dist/stale.js",
      "fixtures/effect.json",
      "node_modules/package/index.js",
      "reference/source.svg",
      "templates/local.json",
      "test/helper.js",
    ]) {
      await writeArtifact(root, path, "{}");
    }

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /forbidden release path \.cache.*forbidden release path \.git.*forbidden release path \.tmp.*forbidden release path __tests__.*forbidden release path coverage.*forbidden release path dist.*forbidden release path fixtures.*forbidden release path node_modules.*forbidden release path reference.*forbidden release path templates.*forbidden release path test/s,
    );
  });

  it.each([
    ".env",
    "apps/viewer/assets/local.png",
    "apps/viewer/assets/local.svg",
    "apps/viewer/assets/local.ogg",
    "apps/viewer/assets/local.7z",
    "apps/viewer/assets/local.heic",
    "apps/viewer/assets/payload.exe",
    "apps/viewer/assets/private.pem",
    "apps/viewer/assets/source.bin",
    "apps/viewer/assets/audio.opus",
    "apps/viewer/assets/video.m3u8",
    "apps/viewer/assets/backup.bak",
    "apps/viewer/assets/demo.sniptale-effect.json",
    "apps/viewer/assets/demo.sniptale-effect.json.bak",
    "apps/viewer/assets/corpus.sniptale-bundle.zip",
    "apps/viewer/assets/local.png.dat",
    "apps/viewer/assets/qa.log",
    "sdk/state.tsbuildinfo",
  ])(
    "rejects local media, authored, archive, and evidence file %s",
    async (path) => {
      const root = await createArtifact();
      await writeLegalArtifact(root);
      await writeArtifact(
        root,
        "apps/viewer/index.html",
        "<main>Editor</main>",
      );
      await writeArtifact(root, path, "local-only");

      await expect(verifyReleaseArtifact(root)).rejects.toThrow(
        /outside the allowed release file layout/,
      );
    },
  );

  it("rejects top-level asset storage while allowing Vite asset owners", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/assets/index-AbCd1234.js",
      "export {};",
    );
    await writeArtifact(root, "assets/private.js", "export {};");

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /assets\/private\.js: forbidden release root assets/,
    );
  });

  it("rejects symlinks instead of silently skipping them", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await symlink("LICENSE", join(root, "linked-license"));

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /linked-license: symbolic links and special filesystem entries are forbidden/,
    );
  });

  it("rejects forbidden path and file-layout case variants", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(root, ".TMP/evidence.json", "{}");
    await writeArtifact(
      root,
      "sdk/index.D.TS",
      "export declare function triggerSandboxTimeoutForTest(): void;",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /forbidden release path \.TMP.*sdk\/index\.D\.TS.*outside the allowed release file layout/s,
    );
  });

  it("rejects an artifact without its legal payload", async () => {
    const root = await createArtifact();
    await writeArtifact(root, "apps/viewer/index.html", "<main>Editor</main>");

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /LICENSE.*LICENSES\/dependencies.*NOTICE.*THIRD_PARTY_DEPENDENCIES.*THIRD_PARTY_NOTICES/s,
    );
  });

  it.each([
    "apps/viewer/assets/demo.sniptale-effect.json.js",
    "apps/viewer/assets/local.png.css",
    "apps/viewer/assets/local-fixture.js",
    "sdk/private.pem.d.ts",
  ])("rejects renamed local payload %s", async (path) => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(root, "apps/viewer/index.html", "<main>Editor</main>");
    await writeArtifact(root, path, "export {};");

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /outside the allowed release file layout/,
    );
  });

  it("rejects binary content hidden behind an allowed suffix", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<script type="module" src="/assets/payload-AbCd1234.js"></script>',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/payload-AbCd1234.js",
      new Uint8Array([0xff, 0xfe]),
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /release files must be valid UTF-8 text/,
    );
  });

  it("rejects malformed content hidden behind an allowed suffix", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<script type="module" src="/assets/payload-AbCd1234.js"></script>',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/payload-AbCd1234.js",
      "export const = ;",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /content does not parse as its release file type/,
    );
  });

  it("rejects generated assets that are not reachable from an app entry", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(root, "apps/viewer/index.html", "<main>Editor</main>");
    await writeArtifact(
      root,
      "apps/viewer/assets/local-fixture-AbCd1234.js",
      "export {};",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /generated asset is not reachable from apps\/viewer\/index\.html/,
    );
  });

  it("requires both app entrypoints and the SDK declaration entrypoint", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /apps\/sandbox\/sandbox\.html.*apps\/viewer\/index\.html.*sdk\/index\.d\.ts\.map.*sdk\/index\.d\.ts/s,
    );
  });

  it("does not treat HTML comments as generated-asset references", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<!-- <script src="/assets/comment-AbCd1234.js"></script> -->',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/comment-AbCd1234.js",
      "export {};",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /comment-AbCd1234\.js: generated asset is not reachable/,
    );
  });

  it("rejects an unclosed HTML comment instead of parsing its text", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<!-- <script src="/assets/hidden-AbCd1234.js">',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/hidden-AbCd1234.js",
      "export {};",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /content does not parse as its release file type/,
    );
  });

  it("does not parse asset-like text inside script elements", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      "<script>const text = 'src=\"/assets/hidden-AbCd1234.js\"';</script>",
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/hidden-AbCd1234.js",
      "export {};",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /hidden-AbCd1234\.js: generated asset is not reachable/,
    );
  });

  it.each([
    "https://evil.invalid/assets/orphan-AbCd1234.js",
    "/unrelated/orphan-AbCd1234.js",
  ])(
    "does not map non-local app reference %s by basename",
    async (reference) => {
      const root = await createArtifact();
      await writeLegalArtifact(root);
      await writeArtifact(
        root,
        "apps/viewer/index.html",
        `<script type="module" src="${reference}"></script>`,
      );
      await writeArtifact(
        root,
        "apps/viewer/assets/orphan-AbCd1234.js",
        "export {};",
      );

      await expect(verifyReleaseArtifact(root)).rejects.toThrow(
        /orphan-AbCd1234\.js: generated asset is not reachable/,
      );
    },
  );

  it("does not treat unused JavaScript strings as generated-asset edges", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<script type="module" src="/assets/entry-AbCd1234.js"></script>',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/entry-AbCd1234.js",
      'const unused = "./orphan-AbCd1234.js"; export { unused };',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/orphan-AbCd1234.js",
      "export {};",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /orphan-AbCd1234\.js: generated asset is not reachable/,
    );
  });

  it("accepts new URL edges only when resolved against import.meta.url", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<script type="module" src="/assets/entry-AbCd1234.js"></script>',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/entry-AbCd1234.js",
      'new URL("./orphan-AbCd1234.js", "https://example.test/");',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/orphan-AbCd1234.js",
      "export {};",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /orphan-AbCd1234\.js: generated asset is not reachable/,
    );
  });

  it("matches complete asset reference tokens instead of filename substrings", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<script type="module" src="/assets/index-AbCd1234.js"></script>',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/dex-AbCd1234.js",
      "export {};",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /dex-AbCd1234\.js: generated asset is not reachable/,
    );
  });

  it("rejects CSS parser warnings", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      '<link rel="stylesheet" href="/assets/index-AbCd1234.css">',
    );
    await writeArtifact(
      root,
      "apps/viewer/assets/index-AbCd1234.css",
      "a { color: red; ",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /content does not parse as its release file type/,
    );
  });

  it("rejects NUL-containing release text", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(
      root,
      "apps/viewer/index.html",
      "<!doctype html>\u0000<main>Viewer</main>",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /release text must not contain NUL bytes/,
    );
  });

  it("rejects unpaired and semantically invalid declarations", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeArtifact(root, "sdk/orphan.d.ts.map", "{}");
    await writeArtifact(root, "sdk/local-fixture.d.ts", "export {};\n");
    await writeSdkDeclaration(root, "index", "const value = 1;");

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /declaration-manifest\.json: declaration inventory does not match artifact files.*index\.d\.ts: declaration set is not semantically valid.*local-fixture\.d\.ts: declaration map reference is missing.*local-fixture\.d\.ts: paired declaration map is missing.*orphan\.d\.ts\.map: paired declaration file is missing/s,
    );
  });

  it("requires exact declaration map metadata and a final mapping directive", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeSdkDeclaration(root, "index", "export type Effect = {};");
    await writeArtifact(
      root,
      "sdk/index.d.ts",
      'export type Marker = "//# sourceMappingURL=index.d.ts.map";',
    );
    await writeArtifact(
      root,
      "sdk/index.d.ts.map",
      JSON.stringify({
        version: 3,
        file: "index.d.ts",
        sourceRoot: "https://evil.invalid/",
        sources: ["prefix/src/sdk/index.ts"],
        names: [],
        mappings: "",
      }),
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /index\.d\.ts\.map: declaration map metadata does not match its owner.*index\.d\.ts: declaration map reference is missing/s,
    );
  });

  it("rejects declaration source digest drift", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeSdkDeclaration(root, "index", "export type Effect = {};");
    await writeArtifact(
      root,
      "../src/sdk/index.ts",
      "export type Effect = { changed: true };",
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /declaration owner metadata is invalid for sdk\/index\.d\.ts/,
    );
  });

  it("rejects extra source-map fields, invalid mappings, and map byte drift", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeSdkDeclaration(root, "index", "export type Effect = {};");
    await writeArtifact(
      root,
      "sdk/index.d.ts.map",
      JSON.stringify({
        version: 3,
        file: "index.d.ts",
        sourceRoot: "",
        sources: ["../../src/sdk/index.ts"],
        sourcesContent: ["private source"],
        names: [],
        mappings: "not valid!",
      }),
    );

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /declaration owner metadata is invalid for sdk\/index\.d\.ts.*index\.d\.ts\.map: declaration map metadata does not match its owner/s,
    );
  });

  it("rejects source-map segments whose generated columns move backward", async () => {
    const root = await createArtifact();
    await writeLegalArtifact(root);
    await writeSdkDeclaration(root, "index", "export type Effect = {};");
    const mapPath = join(root, "sdk/index.d.ts.map");
    const map = JSON.parse(await readFile(mapPath, "utf8"));
    map.mappings = "U,L";
    await writeFile(mapPath, JSON.stringify(map));
    await writeDeclarationManifest(root, join(root, ".."));

    await expect(verifyReleaseArtifact(root)).rejects.toThrow(
      /index\.d\.ts\.map: declaration map metadata does not match its owner/,
    );
  });
});

async function createArtifact() {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "effect-sdk-release-"));
  const artifactRoot = join(repositoryRoot, "dist");
  await mkdir(artifactRoot);
  return artifactRoot;
}

async function writeArtifact(root, path, source) {
  const target = join(root, path);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, source);
}

async function writeLegalArtifact(root) {
  await writeArtifact(root, "LICENSE", "MIT License");
  await writeArtifact(root, "NOTICE", "Notice");
  await writeArtifact(root, "THIRD_PARTY_DEPENDENCIES.json", "{}");
  await writeArtifact(root, "THIRD_PARTY_NOTICES.md", "# Notices");
  await writeArtifact(root, "LICENSES/dependencies/example.txt", "MIT");
}

async function writeSdkDeclaration(root, owner, source) {
  const declarationPath = `sdk/${owner}.d.ts`;
  const mapPath = `${declarationPath}.map`;
  const declarationSource = `${source}\n//# sourceMappingURL=${owner}.d.ts.map`;
  const mapSource = JSON.stringify({
    version: 3,
    file: `${owner}.d.ts`,
    sourceRoot: "",
    sources: [`../../src/sdk/${owner}.ts`],
    names: [],
    mappings: "",
  });
  const ownerSource = `${source}\n`;
  await writeArtifact(root, declarationPath, declarationSource);
  await writeArtifact(root, mapPath, mapSource);
  await writeArtifact(root, `../src/sdk/${owner}.ts`, ownerSource);
  await writeArtifact(
    root,
    "sdk/declaration-manifest.json",
    JSON.stringify({
      schemaVersion: "sniptale.declarations.v1",
      files: [
        {
          declaration: declarationPath,
          declarationSha256: digest(declarationSource),
          map: mapPath,
          mapSha256: digest(mapSource),
          source: `src/sdk/${owner}.ts`,
          sourceSha256: digest(ownerSource),
        },
      ],
    }),
  );
}

function digest(source) {
  return createHash("sha256").update(source).digest("hex");
}
