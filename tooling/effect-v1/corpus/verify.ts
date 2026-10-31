#!/usr/bin/env node
import { parseRecordedExpectation } from "./verification-model.js";
import type {
  RecordedExpectation,
  BundleDocumentDeclaration,
  BundleAssetDeclaration,
  VerifiedManifest,
} from "./verification-model.js";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync } from "fflate";

import { validateEffectV1Document } from "../../../src/sdk/effect-v1/index.js";
import {
  BUNDLE_ENGINE,
  BUNDLE_ENGINE_VERSION,
  BUNDLE_MANIFEST_VERSION,
  codePointOrder,
  CORPUS_FORMAT_VERSION,
  CORPUS_VERSION,
  createCorpusSources,
  FIXED_TEST_SDK_COMMIT,
  FIXED_ZIP_MODE,
  sha256,
} from "./contracts.js";

export type CorpusVerification = {
  archives: number;
  files: number;
  sha256Sums: number;
};

const LOCKED_EXPECTATIONS = [
  rejectedExpectation(
    "invalid/asset-mime-mismatch.sniptale-bundle.zip",
    "BUNDLE_ASSET_MIME_MISMATCH",
  ),
  rejectedExpectation(
    "invalid/forbidden-executable.sniptale-bundle.zip",
    "BUNDLE_EXECUTABLE_ENTRY_FORBIDDEN",
  ),
  rejectedExpectation(
    "invalid/hash-mismatch.sniptale-bundle.zip",
    "BUNDLE_ENTRY_HASH_MISMATCH",
  ),
  rejectedExpectation(
    "invalid/missing-document.sniptale-bundle.zip",
    "BUNDLE_ENTRY_MISSING",
  ),
  rejectedExpectation(
    "invalid/size-mismatch.sniptale-bundle.zip",
    "BUNDLE_ENTRY_SIZE_MISMATCH",
  ),
  rejectedExpectation(
    "invalid/undeclared-entry.sniptale-bundle.zip",
    "BUNDLE_ENTRY_UNDECLARED",
  ),
  rejectedExpectation(
    "invalid/unsafe-manifest-path.sniptale-bundle.zip",
    "BUNDLE_ENTRY_PATH_UNSAFE",
  ),
  rejectedExpectation(
    "invalid/wrapper-directory.sniptale-bundle.zip",
    "BUNDLE_MANIFEST_MISSING",
  ),
  rejectedExpectation(
    "invalid/wrong-engine.sniptale-bundle.zip",
    "BUNDLE_ENGINE_UNSUPPORTED",
  ),
  acceptedExpectation("valid/asset-bearing-conformance.sniptale-bundle.zip", [
    "standalone",
  ]),
  acceptedExpectation("valid/multi-effect-with-asset.sniptale-bundle.zip", [
    "standalone",
    "targetEffect",
    "transition",
    "standalone",
  ]),
  acceptedExpectation("valid/standalone-minimal.sniptale-bundle.zip", [
    "standalone",
  ]),
  acceptedExpectation("valid/target-effect.sniptale-bundle.zip", [
    "targetEffect",
  ]),
  acceptedExpectation("valid/transition.sniptale-bundle.zip", ["transition"]),
] as const;

type LockedExpectation = (typeof LOCKED_EXPECTATIONS)[number];

export async function verifyGeneratedCorpus(
  outputRoot: string,
  effectSdkCommit: string,
): Promise<CorpusVerification> {
  const root = resolve(outputRoot);
  const { scenarios } = createCorpusSources();
  const expectedPaths = [
    "SHA256SUMS",
    "contract-lock.json",
    "expectations.json",
    "sniptale-effect-v1.schema.json",
    ...scenarios.map(({ expectation }) => expectation.artifact),
  ].sort(codePointOrder);
  const actualPaths = (await collectFiles(root)).sort(codePointOrder);
  assertEqual(actualPaths, expectedPaths, "corpus output inventory");
  assertNoCaseFoldCollisions(actualPaths, "corpus output paths");

  const expectations: unknown = JSON.parse(
    await readFile(resolve(root, "expectations.json"), "utf8"),
  );
  if (!isRecord(expectations))
    throw new Error("expectations.json must contain an object.");
  assertEqual(
    {
      corpusVersion: expectations.corpusVersion,
      effectSdkCommit: expectations.effectSdkCommit,
      formatVersion: expectations.formatVersion,
    },
    {
      corpusVersion: CORPUS_VERSION,
      effectSdkCommit,
      formatVersion: CORPUS_FORMAT_VERSION,
    },
    "expectations contract",
  );
  if (!Array.isArray(expectations.cases) || expectations.cases.length !== 14) {
    throw new Error("expectations.json must contain exactly 14 cases.");
  }
  const rawCases: unknown[] = expectations.cases;
  const recordedCases = rawCases.map(parseRecordedExpectation);
  const projectedExpectations = recordedCases.map(projectExpectation);
  assertEqual(
    projectedExpectations,
    LOCKED_EXPECTATIONS,
    "independent corpus expectation lock",
  );
  assertEqual(
    scenarios.map(({ expectation }) => expectation),
    LOCKED_EXPECTATIONS,
    "generator scenario lock",
  );

  const cases = new Map(recordedCases.map((item) => [item.artifact, item]));
  if (cases.size !== LOCKED_EXPECTATIONS.length) {
    throw new Error("expectations.json artifacts must be unique.");
  }
  for (const scenario of scenarios) {
    const expectation = cases.get(scenario.expectation.artifact);
    if (!expectation) {
      throw new Error(
        `Missing expectation for ${scenario.expectation.artifact}.`,
      );
    }
    assertEqual(
      {
        accepted: expectation.accepted,
        artifact: expectation.artifact,
        ...(expectation.effectKinds
          ? { effectKinds: expectation.effectKinds }
          : {}),
        ...(expectation.primaryCode
          ? { primaryCode: expectation.primaryCode }
          : {}),
      },
      scenario.expectation,
      `${scenario.expectation.artifact} expectation`,
    );
    const archive = new Uint8Array(
      await readFile(resolve(root, scenario.expectation.artifact)),
    );
    if (
      expectation.archiveBytes !== archive.byteLength ||
      expectation.archiveSha256 !== sha256(archive)
    ) {
      throw new Error(
        `${scenario.expectation.artifact}: archive metadata drifted.`,
      );
    }
    verifyZipMetadata(archive, [...scenario.entries.keys()]);
    const unzipped = unzipSync(archive);
    assertNoCaseFoldCollisions(
      Object.keys(unzipped),
      `${scenario.expectation.artifact} ZIP entries`,
    );
    assertEqual(
      Object.keys(unzipped).sort(codePointOrder),
      [...scenario.entries.keys()].sort(codePointOrder),
      `${scenario.expectation.artifact} entries`,
    );
    for (const [name, expectedBytes] of scenario.entries) {
      const actualBytes = unzipped[name];
      if (!actualBytes || sha256(actualBytes) !== sha256(expectedBytes)) {
        throw new Error(
          `${scenario.expectation.artifact}:${name} payload drifted.`,
        );
      }
      if (
        scenario.expectation.accepted &&
        name.endsWith(".sniptale-effect.json")
      ) {
        const validation = validateEffectV1Document(
          JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(actualBytes),
          ),
        );
        if (!validation.ok) {
          throw new Error(
            `${scenario.expectation.artifact}:${name} is not a valid Effect v1 document.`,
          );
        }
      }
    }
    const lockedExpectation = LOCKED_EXPECTATIONS.find(
      ({ artifact }) => artifact === scenario.expectation.artifact,
    );
    if (!lockedExpectation)
      throw new Error(
        `${scenario.expectation.artifact}: scenario is not locked.`,
      );
    verifyManifestPayloads(lockedExpectation, unzipped);
  }

  const contractLock: unknown = JSON.parse(
    await readFile(resolve(root, "contract-lock.json"), "utf8"),
  );
  assertEqual(
    contractLock,
    {
      bundleEngine: BUNDLE_ENGINE,
      bundleManifest: BUNDLE_MANIFEST_VERSION,
      corpusVersion: CORPUS_VERSION,
      effectSchema: "sniptale.effect.v1",
      effectSdkCommit,
      engineVersion: BUNDLE_ENGINE_VERSION,
      formatVersion: CORPUS_FORMAT_VERSION,
    },
    "contract lock",
  );

  const schemaCopy = await readFile(
    resolve(root, "sniptale-effect-v1.schema.json"),
  );
  const schemaOwner = await readFile(
    resolve(
      import.meta.dirname,
      "../../../schemas/sniptale-effect-v1.schema.json",
    ),
  );
  if (sha256(schemaCopy) !== sha256(schemaOwner)) {
    throw new Error("Corpus schema copy does not match the schema owner.");
  }

  const checksumLines = (await readFile(resolve(root, "SHA256SUMS"), "utf8"))
    .trimEnd()
    .split("\n");
  const checksumPaths = expectedPaths.filter((path) => path !== "SHA256SUMS");
  const expectedChecksumLines = [];
  for (const path of checksumPaths) {
    expectedChecksumLines.push(
      `${sha256(await readFile(resolve(root, path)))}  ${path}`,
    );
  }
  assertEqual(checksumLines, expectedChecksumLines, "SHA256SUMS closure");
  return {
    archives: scenarios.length,
    files: actualPaths.length,
    sha256Sums: checksumLines.length,
  };
}

function verifyManifestPayloads(
  expectation: LockedExpectation,
  entries: Record<string, Uint8Array>,
): void {
  const { artifact } = expectation;
  const primaryCode =
    "primaryCode" in expectation ? expectation.primaryCode : undefined;
  const executableEntries = Object.keys(entries).filter(isExecutableEntry);
  assertEqual(
    executableEntries.length,
    primaryCode === "BUNDLE_EXECUTABLE_ENTRY_FORBIDDEN" ? 1 : 0,
    `${artifact} executable entry count`,
  );
  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) {
    if (primaryCode !== "BUNDLE_MANIFEST_MISSING") {
      throw new Error(`${artifact}: root manifest is unexpectedly absent.`);
    }
    return;
  }
  const rawManifest: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes),
  );
  const manifest = parseBundleManifestEnvelope(
    rawManifest,
    primaryCode,
    artifact,
  );
  assertEqual(
    manifest.manifestVersion,
    BUNDLE_MANIFEST_VERSION,
    `${artifact} manifest version`,
  );
  assertEqual(manifest.version, CORPUS_VERSION, `${artifact} pack version`);
  assertEqual(
    manifest.engineVersion === BUNDLE_ENGINE_VERSION ? 0 : 1,
    primaryCode === "BUNDLE_ENGINE_UNSUPPORTED" ? 1 : 0,
    `${artifact} engine compatibility`,
  );
  if (
    !Array.isArray(manifest.effectDocuments) ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error(`${artifact}: manifest declarations must be arrays.`);
  }
  const declarations = [
    ...manifest.effectDocuments.map((declaration) => ({
      ...declaration,
      role: "document" as const,
    })),
    ...manifest.assets.map((declaration) => ({
      ...declaration,
      role: "asset" as const,
    })),
  ];
  let missing = 0;
  let sizeMismatches = 0;
  let hashMismatches = 0;
  let mimeMismatches = 0;
  let unsafePaths = 0;
  let documentAssetMismatches = 0;
  const declaredPaths = new Set(["manifest.json"]);
  const actualEffectKinds = [];
  const manifestAssets = new Map<string, BundleAssetDeclaration>(
    manifest.assets.map((declaration) => [declaration.path, declaration]),
  );
  const usedManifestAssets = new Set<string>();
  for (const declaration of declarations) {
    if (typeof declaration.path !== "string") {
      throw new Error(`${artifact}: declaration path is not a string.`);
    }
    if (!isCanonicalBundlePath(declaration.path)) {
      unsafePaths += 1;
      continue;
    }
    if (
      (declaration.role === "document" &&
        (!declaration.path.startsWith("effects/") ||
          !declaration.path.endsWith(".sniptale-effect.json"))) ||
      (declaration.role === "asset" && !declaration.path.startsWith("assets/"))
    ) {
      throw new Error(
        `${artifact}: declaration path has the wrong owner root.`,
      );
    }
    declaredPaths.add(declaration.path);
    const bytes = entries[declaration.path];
    if (!bytes) {
      missing += 1;
      continue;
    }
    if (declaration.byteLength !== bytes.byteLength) sizeMismatches += 1;
    if (declaration.sha256 !== sha256(bytes)) hashMismatches += 1;
    if (
      declaration.role === "asset" &&
      declaration.mimeType !== detectAssetMime(bytes)
    ) {
      mimeMismatches += 1;
    }
    if (declaration.role === "document") {
      if (declaration.schemaVersion !== "sniptale.effect.v1") {
        throw new Error(`${artifact}: declaration schema is not Effect v1.`);
      }
      const rawDocument: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
      const validation = validateEffectV1Document(rawDocument);
      if (!validation.ok || !validation.document) {
        throw new Error(
          `${artifact}:${declaration.path} is not valid Effect v1.`,
        );
      }
      const document = validation.document;
      if (document.id !== declaration.id) {
        throw new Error(
          `${artifact}:${declaration.path} id does not match its declaration.`,
        );
      }
      for (const asset of document.assets) {
        const bundleAsset =
          typeof asset.path === "string"
            ? manifestAssets.get(asset.path)
            : undefined;
        if (bundleAsset && typeof asset.path === "string") {
          usedManifestAssets.add(asset.path);
        }
        if (
          !bundleAsset ||
          asset.byteLength !== bundleAsset.byteLength ||
          asset.kind !== bundleAsset.kind ||
          asset.mimeType !== bundleAsset.mimeType ||
          asset.path !== bundleAsset.path ||
          asset.sha256 !== bundleAsset.sha256
        ) {
          documentAssetMismatches += 1;
        }
      }
      actualEffectKinds.push(document.kind);
    }
  }
  assertEqual(
    {
      documentAssetMismatches,
      hashMismatches,
      mimeMismatches,
      missing,
      sizeMismatches,
      unsafePaths,
    },
    {
      documentAssetMismatches:
        primaryCode === "BUNDLE_ASSET_MIME_MISMATCH" ? 1 : 0,
      hashMismatches: primaryCode === "BUNDLE_ENTRY_HASH_MISMATCH" ? 1 : 0,
      mimeMismatches: primaryCode === "BUNDLE_ASSET_MIME_MISMATCH" ? 1 : 0,
      missing: primaryCode === "BUNDLE_ENTRY_MISSING" ? 1 : 0,
      sizeMismatches: primaryCode === "BUNDLE_ENTRY_SIZE_MISMATCH" ? 1 : 0,
      unsafePaths: primaryCode === "BUNDLE_ENTRY_PATH_UNSAFE" ? 1 : 0,
    },
    `${artifact} declaration integrity`,
  );
  assertEqual(
    [...usedManifestAssets].sort(codePointOrder),
    [...manifestAssets.keys()].sort(codePointOrder),
    `${artifact} document-to-bundle asset closure`,
  );
  const undeclaredEntries = Object.keys(entries).filter(
    (path) => !declaredPaths.has(path) && !isExecutableEntry(path),
  );
  assertEqual(
    undeclaredEntries.length,
    primaryCode === "BUNDLE_ENTRY_UNDECLARED" ||
      primaryCode === "BUNDLE_ENTRY_PATH_UNSAFE"
      ? 1
      : 0,
    `${artifact} undeclared non-executable entry count`,
  );
  if (expectation.accepted) {
    assertEqual(
      actualEffectKinds,
      expectation.effectKinds,
      `${artifact} effect kind order`,
    );
  }
}

function parseBundleManifestEnvelope(
  manifest: unknown,
  primaryCode: string | undefined,
  artifact: string,
): VerifiedManifest {
  if (
    !isRecord(manifest) ||
    !hasExactKeys(
      manifest,
      [
        "assets",
        "effectDocuments",
        "engineVersion",
        "label",
        "manifestVersion",
        "packId",
        "version",
      ],
      ["description"],
    ) ||
    typeof manifest.engineVersion !== "string" ||
    !isLocalizedText(manifest.label) ||
    (manifest.description !== undefined &&
      !isLocalizedText(manifest.description)) ||
    !isIdentifier(manifest.packId) ||
    manifest.version !== CORPUS_VERSION ||
    !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(
      manifest.version,
    ) ||
    !Array.isArray(manifest.effectDocuments) ||
    manifest.effectDocuments.length === 0 ||
    manifest.effectDocuments.length > 100 ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length > 200
  ) {
    throw new Error(`${artifact}: bundle manifest envelope is invalid.`);
  }
  if (
    manifest.manifestVersion !== BUNDLE_MANIFEST_VERSION ||
    (primaryCode === "BUNDLE_ENGINE_UNSUPPORTED"
      ? manifest.engineVersion !== "1.0"
      : manifest.engineVersion !== BUNDLE_ENGINE_VERSION)
  ) {
    throw new Error(`${artifact}: bundle manifest version contract drifted.`);
  }
  const ids = new Set<string>();
  const normalizedPaths = new Set<string>(["manifest.json"]);
  const rawDocuments: unknown[] = manifest.effectDocuments;
  const effectDocuments: BundleDocumentDeclaration[] = [];
  for (const declaration of rawDocuments) {
    if (
      !isRecord(declaration) ||
      !hasExactKeys(declaration, [
        "byteLength",
        "id",
        "path",
        "schemaVersion",
        "sha256",
      ]) ||
      !isIdentifier(declaration.id) ||
      typeof declaration.path !== "string" ||
      ids.has(declaration.id) ||
      declaration.schemaVersion !== "sniptale.effect.v1" ||
      !isBoundedInteger(declaration.byteLength, 10 * 1024 * 1024) ||
      !isSha256(declaration.sha256)
    ) {
      throw new Error(`${artifact}: bundle document declaration is invalid.`);
    }
    ids.add(declaration.id);
    assertManifestPath(
      declaration.path,
      "effects/",
      ".sniptale-effect.json",
      primaryCode,
      normalizedPaths,
      artifact,
    );
    effectDocuments.push({
      id: declaration.id,
      path: declaration.path,
      byteLength: declaration.byteLength,
      sha256: declaration.sha256,
      schemaVersion: declaration.schemaVersion,
    });
  }
  const mimeByKind = {
    audio: new Set(["audio/mpeg", "audio/ogg", "audio/wav"]),
    image: new Set(["image/jpeg", "image/png", "image/webp"]),
    svg: new Set(["image/svg+xml"]),
  } as const;
  const rawAssets: unknown[] = manifest.assets;
  const assets: BundleAssetDeclaration[] = [];
  for (const declaration of rawAssets) {
    if (
      !isRecord(declaration) ||
      !hasExactKeys(declaration, [
        "byteLength",
        "kind",
        "mimeType",
        "path",
        "sha256",
      ]) ||
      !(
        declaration.kind === "audio" ||
        declaration.kind === "image" ||
        declaration.kind === "svg"
      ) ||
      typeof declaration.path !== "string" ||
      typeof declaration.mimeType !== "string" ||
      !mimeByKind[declaration.kind].has(declaration.mimeType) ||
      !isBoundedInteger(declaration.byteLength, 50 * 1024 * 1024) ||
      !isSha256(declaration.sha256)
    ) {
      throw new Error(`${artifact}: bundle asset declaration is invalid.`);
    }
    assertManifestPath(
      declaration.path,
      "assets/",
      undefined,
      primaryCode,
      normalizedPaths,
      artifact,
    );
    assets.push({
      path: declaration.path,
      byteLength: declaration.byteLength,
      sha256: declaration.sha256,
      kind: declaration.kind,
      mimeType: declaration.mimeType,
    });
  }
  return {
    manifestVersion: manifest.manifestVersion,
    version: manifest.version,
    engineVersion: manifest.engineVersion,
    effectDocuments,
    assets,
  };
}

function assertManifestPath(
  path: unknown,
  prefix: string,
  suffix: string | undefined,
  primaryCode: string | undefined,
  normalizedPaths: Set<string>,
  artifact: string,
): void {
  if (!isCanonicalBundlePath(path)) {
    if (primaryCode !== "BUNDLE_ENTRY_PATH_UNSAFE") {
      throw new Error(`${artifact}: manifest path is unexpectedly unsafe.`);
    }
    return;
  }
  if (!path.startsWith(prefix) || (suffix && !path.endsWith(suffix))) {
    throw new Error(`${artifact}: manifest path has the wrong role.`);
  }
  const normalized = path.normalize("NFC").toLowerCase();
  if (normalizedPaths.has(normalized)) {
    throw new Error(`${artifact}: manifest paths collide after case folding.`);
  }
  normalizedPaths.add(normalized);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

function isLocalizedText(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["en", "ru"]) &&
    [value.en, value.ru].every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0 &&
        item.length <= 4096,
    )
  );
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 1 &&
    Number(value) <= maximum
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export function isCanonicalBundlePath(path: unknown): path is string {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.length > 512 ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("?") ||
    path.includes("#") ||
    /[^\x20-\x7e]/u.test(path)
  ) {
    return false;
  }
  return path
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.endsWith(".") &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(segment) &&
        !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment),
    );
}

function isExecutableEntry(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(?:^|\/)(?:renderers?|recipes?)(?:\/|$)/u.test(lower) ||
    /\.(?:cjs|js|jsx|mjs|source|ts|tsx|wasm)$/u.test(lower)
  );
}

function detectAssetMime(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "image/png";
  }
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  if (/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/u.test(source)) {
    return "image/svg+xml";
  }
  return undefined;
}

function assertNoCaseFoldCollisions(paths: string[], owner: string): void {
  const folded = new Map<string, string>();
  for (const path of paths) {
    const key = path.normalize("NFC").toLowerCase();
    const previous = folded.get(key);
    if (previous !== undefined && previous !== path) {
      throw new Error(`${owner} case-fold collision: ${previous} and ${path}.`);
    }
    folded.set(key, path);
  }
}

export function verifyZipMetadata(
  archive: Uint8Array,
  expectedNames: string[],
): void {
  const { centralOffset, entries } = readCentralDirectory(archive);
  assertEqual(
    entries.map(({ name }) => name),
    [...expectedNames].sort(codePointOrder),
    "ZIP entry order",
  );
  let expectedLocalOffset = 0;
  for (const entry of entries) {
    if (entry.compression !== 8) {
      throw new Error(`${entry.name}: ZIP compression must be DEFLATE.`);
    }
    if (entry.date !== 33 || entry.time !== 0) {
      throw new Error(
        `${entry.name}: ZIP timestamp must be 1980-01-01T00:00:00.`,
      );
    }
    if (entry.os !== 3 || entry.mode !== FIXED_ZIP_MODE) {
      throw new Error(`${entry.name}: ZIP mode must be Unix 100644.`);
    }
    if (entry.extraLength !== 0 || entry.commentLength !== 0) {
      throw new Error(`${entry.name}: ZIP central metadata must be minimal.`);
    }
    if (entry.localOffset !== expectedLocalOffset) {
      throw new Error(`${entry.name}: ZIP local header order drifted.`);
    }
    const local = readLocalHeader(archive, entry.localOffset);
    assertEqual(
      {
        compressedSize: local.compressedSize,
        compression: local.compression,
        crc32: local.crc32,
        date: local.date,
        flags: local.flags,
        name: local.name,
        time: local.time,
        uncompressedSize: local.uncompressedSize,
      },
      {
        compressedSize: entry.compressedSize,
        compression: entry.compression,
        crc32: entry.crc32,
        date: entry.date,
        flags: entry.flags,
        name: entry.name,
        time: entry.time,
        uncompressedSize: entry.uncompressedSize,
      },
      `${entry.name} local/central ZIP metadata`,
    );
    if (local.extraLength !== 0) {
      throw new Error(`${entry.name}: ZIP local metadata must be minimal.`);
    }
    expectedLocalOffset = local.dataOffset + entry.compressedSize;
  }
  if (expectedLocalOffset !== centralOffset) {
    throw new Error(
      "ZIP local payload closure does not meet the central directory.",
    );
  }
}

function readCentralDirectory(archive: Uint8Array) {
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );
  let endOffset = -1;
  for (
    let offset = archive.byteLength - 22;
    offset >= Math.max(0, archive.byteLength - 65_557);
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset === -1) throw new Error("ZIP end record is missing.");
  const commentLength = view.getUint16(endOffset + 20, true);
  if (
    endOffset + 22 + commentLength !== archive.byteLength ||
    commentLength !== 0 ||
    view.getUint16(endOffset + 4, true) !== 0 ||
    view.getUint16(endOffset + 6, true) !== 0
  ) {
    throw new Error("ZIP end record is not the locked single-disk profile.");
  }
  const entryCount = view.getUint16(endOffset + 10, true);
  if (view.getUint16(endOffset + 8, true) !== entryCount) {
    throw new Error("ZIP central-directory entry counts disagree.");
  }
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("ZIP central-directory record is missing.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      archive.subarray(offset + 46, offset + 46 + nameLength),
    );
    entries.push({
      commentLength,
      compressedSize: view.getUint32(offset + 20, true),
      compression: view.getUint16(offset + 10, true),
      crc32: view.getUint32(offset + 16, true),
      date: view.getUint16(offset + 14, true),
      extraLength,
      flags: view.getUint16(offset + 8, true),
      localOffset: view.getUint32(offset + 42, true),
      mode: view.getUint32(offset + 38, true) >>> 16,
      name,
      os: view.getUint16(offset + 4, true) >>> 8,
      time: view.getUint16(offset + 12, true),
      uncompressedSize: view.getUint32(offset + 24, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (
    entries.length === 0 ||
    offset !== centralOffset + centralSize ||
    offset !== endOffset
  ) {
    throw new Error("ZIP central-directory closure drifted.");
  }
  return { centralOffset, entries };
}

function readLocalHeader(archive: Uint8Array, offset: number) {
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );
  if (view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error("ZIP local header is missing.");
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const name = new TextDecoder("utf-8", { fatal: true }).decode(
    archive.subarray(offset + 30, offset + 30 + nameLength),
  );
  return {
    compressedSize: view.getUint32(offset + 18, true),
    compression: view.getUint16(offset + 8, true),
    crc32: view.getUint32(offset + 14, true),
    dataOffset,
    date: view.getUint16(offset + 12, true),
    extraLength,
    flags: view.getUint16(offset + 6, true),
    name,
    time: view.getUint16(offset + 10, true),
    uncompressedSize: view.getUint32(offset + 22, true),
  };
}

async function collectFiles(
  directory: string,
  root = directory,
): Promise<string[]> {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path, root)));
    else if (entry.isFile())
      files.push(relative(root, path).split(sep).join("/"));
    else throw new Error(`${path}: corpus output contains a special file.`);
  }
  return files;
}

function assertEqual(actual: unknown, expected: unknown, owner: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${owner} mismatch:\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`,
    );
  }
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const path of (await collectFiles(root)).sort(codePointOrder)) {
    result.set(path, sha256(await readFile(resolve(root, path))));
  }
  return result;
}

async function runCli(): Promise<void> {
  const { DEFAULT_CORPUS_ROOT, generateEffectV1Corpus } =
    await import("./generate.js");
  const runGenerator = () =>
    generateEffectV1Corpus({ effectSdkCommit: FIXED_TEST_SDK_COMMIT });
  await runGenerator();
  const outputRoot = DEFAULT_CORPUS_ROOT;
  const first = await snapshot(outputRoot);
  await runGenerator();
  const second = await snapshot(outputRoot);
  assertEqual([...second], [...first], "two-run corpus determinism");
  const verification = await verifyGeneratedCorpus(
    outputRoot,
    FIXED_TEST_SDK_COMMIT,
  );
  process.stdout.write(
    `Verified ${verification.archives} deterministic archives and ${verification.files} corpus files.\n`,
  );
}

function projectExpectation(item: RecordedExpectation) {
  return {
    accepted: item.accepted,
    artifact: item.artifact,
    ...(item.effectKinds ? { effectKinds: item.effectKinds } : {}),
    ...(item.primaryCode ? { primaryCode: item.primaryCode } : {}),
  };
}

function rejectedExpectation(artifact: string, primaryCode: string) {
  return { accepted: false as const, artifact, primaryCode };
}

function acceptedExpectation(artifact: string, effectKinds: string[]) {
  return { accepted: true as const, artifact, effectKinds };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCli();
}
