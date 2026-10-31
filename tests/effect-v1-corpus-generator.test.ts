import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  FIXED_TEST_SDK_COMMIT,
  sha256,
} from "../tooling/effect-v1/corpus/contracts";
import {
  DEFAULT_CORPUS_ROOT,
  generateEffectV1Corpus,
  resolveEffectSdkCommit,
} from "../tooling/effect-v1/corpus/generate";
import {
  isCanonicalBundlePath,
  verifyGeneratedCorpus,
} from "../tooling/effect-v1/corpus/verify";

const testRoot = resolve(DEFAULT_CORPUS_ROOT, ".tests");
mkdirSync(testRoot, { recursive: true });
const output = mkdtempSync(resolve(testRoot, "generator-"));

afterAll(() => {
  rmSync(output, { force: true, recursive: true });
});

describe("Effect v1 corpus generator", () => {
  it("leaves an existing handoff byte-exact when the CLI checks determinism", async () => {
    await generateEffectV1Corpus({
      effectSdkCommit: FIXED_TEST_SDK_COMMIT,
      outputRoot: output,
    });
    const before = await snapshot(output);
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "tooling/effect-v1/corpus/verify.ts"],
      {
        cwd: resolve(import.meta.dirname, ".."),
        env: { ...process.env, TSX_DISABLE_CACHE: "1" },
      },
    );
    expect(stdout).toContain(
      "Verified 14 deterministic archives and 18 corpus files.",
    );
    expect(await snapshot(output)).toEqual(before);
    expect(
      (await readdir(DEFAULT_CORPUS_ROOT)).filter((name) =>
        name.startsWith(".determinism-"),
      ),
    ).toEqual([]);
  });

  it("creates the exact deterministic 14-case handoff closure", async () => {
    const first = await generateEffectV1Corpus({
      effectSdkCommit: FIXED_TEST_SDK_COMMIT,
      outputRoot: output,
    });
    const firstVerification = await verifyGeneratedCorpus(
      output,
      FIXED_TEST_SDK_COMMIT,
    );
    const firstSnapshot = await snapshot(output);
    const second = await generateEffectV1Corpus({
      effectSdkCommit: FIXED_TEST_SDK_COMMIT,
      outputRoot: output,
    });
    const secondVerification = await verifyGeneratedCorpus(
      output,
      FIXED_TEST_SDK_COMMIT,
    );
    const secondSnapshot = await snapshot(output);

    expect(first.effectSdkCommit).toBe(FIXED_TEST_SDK_COMMIT);
    expect(second.effectSdkCommit).toBe(FIXED_TEST_SDK_COMMIT);
    expect(firstVerification).toEqual({
      archives: 14,
      files: 18,
      sha256Sums: 17,
    });
    expect(secondVerification).toEqual(firstVerification);
    expect(secondSnapshot).toEqual(firstSnapshot);
    await expect(
      verifyGeneratedCorpus(output, FIXED_TEST_SDK_COMMIT),
    ).resolves.toEqual(firstVerification);
  });

  it("accepts only explicit fixed SHA injection outside final handoff", () => {
    expect(resolveEffectSdkCommit(FIXED_TEST_SDK_COMMIT)).toBe(
      FIXED_TEST_SDK_COMMIT,
    );
    expect(() => resolveEffectSdkCommit("a".repeat(40))).toThrow(
      /fixed deterministic-test commit/u,
    );
  });

  it("rejects a symlinked output ancestor before recursive replacement", async () => {
    mkdirSync(resolve(".tmp/tests"), { recursive: true });
    const external = mkdtempSync(
      resolve(".tmp/tests/sniptale-corpus-external-"),
    );
    const sentinel = resolve(external, "sentinel.txt");
    const link = resolve(testRoot, "linked-output");
    writeFileSync(sentinel, "preserve\n");
    symlinkSync(external, link, "dir");
    try {
      await expect(
        generateEffectV1Corpus({
          effectSdkCommit: FIXED_TEST_SDK_COMMIT,
          outputRoot: resolve(link, "nested"),
        }),
      ).rejects.toThrow(/physical directories/u);
      await expect(readFile(sentinel, "utf8")).resolves.toBe("preserve\n");
    } finally {
      rmSync(link, { force: true });
      rmSync(external, { force: true, recursive: true });
    }
  });

  it("locks canonical bundle entry paths", () => {
    expect(isCanonicalBundlePath("effects/example.sniptale-effect.json")).toBe(
      true,
    );
    expect(
      [
        "/effects/example.sniptale-effect.json",
        "effects\\example.sniptale-effect.json",
        "effects/../example.sniptale-effect.json",
        "effects//example.sniptale-effect.json",
        "effects/con/example.sniptale-effect.json",
        "effects/example.",
        "effects/эффект.sniptale-effect.json",
      ].every((path) => !isCanonicalBundlePath(path)),
    ).toBe(true);
  });
});

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    result[entry.name] = sha256(await readFile(resolve(root, entry.name)));
  }
  for (const directory of ["invalid", "valid"]) {
    for (const entry of await readdir(resolve(root, directory), {
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const path = `${directory}/${entry.name}`;
      result[path] = sha256(await readFile(resolve(root, path)));
    }
  }
  return result;
}
