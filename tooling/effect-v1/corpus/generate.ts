#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync, type Zippable } from "fflate";

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
  FIXED_ZIP_COMPRESSION_LEVEL,
  FIXED_ZIP_MODE,
  jsonBytes,
  sha256,
} from "./contracts.js";

export const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
export const DEFAULT_CORPUS_ROOT = resolve(
  REPOSITORY_ROOT,
  ".tmp/sniptale-effect-corpus",
);
export const SCHEMA_PATH = resolve(
  REPOSITORY_ROOT,
  "schemas/sniptale-effect-v1.schema.json",
);

export type GenerateCorpusOptions = {
  effectSdkCommit?: string;
  outputRoot?: string;
};

export async function generateEffectV1Corpus(
  options: GenerateCorpusOptions = {},
) {
  const outputRoot = resolve(options.outputRoot ?? DEFAULT_CORPUS_ROOT);
  await assertSafeCorpusOutputRoot(outputRoot);
  const effectSdkCommit = resolveEffectSdkCommit(options.effectSdkCommit);
  const { documents, scenarios } = createCorpusSources();
  for (const document of documents) {
    const validation = validateEffectV1Document(document);
    if (!validation.ok) {
      const diagnostic = validation.diagnostics[0];
      throw new Error(
        `Corpus document ${document.id} is invalid: ${diagnostic?.code} ${diagnostic?.path}`,
      );
    }
  }

  await rm(outputRoot, { force: true, recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const expectations = [];
  for (const scenario of scenarios) {
    const archive = createDeterministicZip(scenario.entries);
    const archivePath = resolve(outputRoot, scenario.expectation.artifact);
    await mkdir(dirname(archivePath), { recursive: true });
    await writeFile(archivePath, archive);
    expectations.push({
      accepted: scenario.expectation.accepted,
      archiveBytes: archive.byteLength,
      archiveSha256: sha256(archive),
      artifact: scenario.expectation.artifact,
      ...(scenario.expectation.effectKinds
        ? { effectKinds: scenario.expectation.effectKinds }
        : {}),
      ...(scenario.expectation.primaryCode
        ? { primaryCode: scenario.expectation.primaryCode }
        : {}),
    });
  }

  const expectationModel = {
    cases: expectations.sort((left, right) =>
      codePointOrder(left.artifact, right.artifact),
    ),
    corpusVersion: CORPUS_VERSION,
    effectSdkCommit,
    formatVersion: CORPUS_FORMAT_VERSION,
  };
  const contractLock = {
    bundleEngine: BUNDLE_ENGINE,
    bundleManifest: BUNDLE_MANIFEST_VERSION,
    corpusVersion: CORPUS_VERSION,
    effectSchema: "sniptale.effect.v1",
    effectSdkCommit,
    engineVersion: BUNDLE_ENGINE_VERSION,
    formatVersion: CORPUS_FORMAT_VERSION,
  };
  await Promise.all([
    writeFile(
      resolve(outputRoot, "expectations.json"),
      jsonBytes(expectationModel),
    ),
    writeFile(
      resolve(outputRoot, "contract-lock.json"),
      jsonBytes(contractLock),
    ),
    writeFile(
      resolve(outputRoot, "sniptale-effect-v1.schema.json"),
      await readFile(SCHEMA_PATH),
    ),
  ]);
  await writeChecksumIndex(outputRoot);
  return { effectSdkCommit, outputRoot };
}

export function createDeterministicZip(
  entries: ReadonlyMap<string, Uint8Array>,
): Uint8Array {
  const zippable: Zippable = {};
  for (const [name, bytes] of [...entries].sort(([left], [right]) =>
    codePointOrder(left, right),
  )) {
    zippable[name] = [
      bytes,
      {
        attrs: FIXED_ZIP_MODE << 16,
        level: FIXED_ZIP_COMPRESSION_LEVEL,
        mtime: new Date(1980, 0, 1, 0, 0, 0, 0),
        os: 3,
      },
    ];
  }
  return zipSync(zippable, {
    attrs: FIXED_ZIP_MODE << 16,
    level: FIXED_ZIP_COMPRESSION_LEVEL,
    mtime: new Date(1980, 0, 1, 0, 0, 0, 0),
    os: 3,
  });
}

export function resolveEffectSdkCommit(injected?: string): string {
  if (injected !== undefined) {
    if (injected !== FIXED_TEST_SDK_COMMIT) {
      throw new Error(
        "Injected Effect SDK commit must be the fixed deterministic-test commit.",
      );
    }
    return injected;
  }
  const status = execFileSync("git", ["status", "--porcelain=v1"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });
  if (status !== "") {
    throw new Error(
      "Final corpus generation requires a clean Effect SDK HEAD. Commit the rebrand before generating handoff metadata.",
    );
  }
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
}

async function assertSafeCorpusOutputRoot(outputRoot: string): Promise<void> {
  const pathFromRoot = relative(DEFAULT_CORPUS_ROOT, outputRoot);
  if (
    pathFromRoot.startsWith("..") ||
    pathFromRoot.split(sep).includes("..") ||
    resolve(DEFAULT_CORPUS_ROOT, pathFromRoot) !== outputRoot
  ) {
    throw new Error(
      `Corpus output must stay under ${DEFAULT_CORPUS_ROOT}; received ${outputRoot}.`,
    );
  }
  const relativeParts =
    pathFromRoot === "" ? [] : pathFromRoot.split(sep).filter(Boolean);
  const candidates = [resolve(REPOSITORY_ROOT, ".tmp"), DEFAULT_CORPUS_ROOT];
  let candidate = DEFAULT_CORPUS_ROOT;
  for (const part of relativeParts) {
    candidate = resolve(candidate, part);
    candidates.push(candidate);
  }
  for (const path of new Set(candidates)) {
    try {
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error(
          `Corpus output path components must be physical directories: ${path}.`,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }
}

async function writeChecksumIndex(outputRoot: string): Promise<void> {
  const paths = [
    "contract-lock.json",
    "expectations.json",
    "sniptale-effect-v1.schema.json",
    ...createCorpusSources().scenarios.map(
      ({ expectation }) => expectation.artifact,
    ),
  ].sort(codePointOrder);
  const lines = [];
  for (const path of paths) {
    lines.push(`${sha256(await readFile(resolve(outputRoot, path)))}  ${path}`);
  }
  await writeFile(resolve(outputRoot, "SHA256SUMS"), `${lines.join("\n")}\n`);
}

async function runCli(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error(
      "The corpus handoff CLI accepts no arguments and requires a clean HEAD.",
    );
  }
  const result = await generateEffectV1Corpus();
  const { verifyGeneratedCorpus } = await import("./verify.js");
  const verification = await verifyGeneratedCorpus(
    result.outputRoot,
    result.effectSdkCommit,
  );
  process.stdout.write(
    `Generated ${verification.archives} deterministic archives at ${result.outputRoot}\nEffect SDK commit: ${result.effectSdkCommit}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCli();
}
