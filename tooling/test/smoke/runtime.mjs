import { existsSync } from "node:fs";
import { lstat, mkdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { generateNeutralLocalPack } from "../fixtures/local-pack.mjs";
import { startServer } from "./server.mjs";
import {
  sandboxPort as defaultSandboxPort,
  viewerPort as defaultViewerPort,
} from "./data.mjs";

export async function createSmokeRuntime() {
  const repoRoot = process.cwd();
  const builtViewerRoot = resolve(repoRoot, "dist/apps/viewer");
  const builtSandboxRoot = resolve(repoRoot, "dist/apps/sandbox");
  const viewerRoot = resolve(
    process.env.EFFECT_SDK_VIEWER_ROOT || builtViewerRoot,
  );
  const sandboxRoot = resolve(
    process.env.EFFECT_SDK_SANDBOX_ROOT || builtSandboxRoot,
  );
  if (!existsSync(viewerRoot) || !existsSync(sandboxRoot)) {
    throw new Error("Smoke runtime requires built viewer and sandbox roots.");
  }
  const outputDir = resolveSmokeOutputDirectory(
    process.env.EFFECT_SDK_TEST_OUTPUT,
    repoRoot,
  );
  const viewerPort =
    Number(process.env.EFFECT_SDK_VIEWER_PORT) || defaultViewerPort;
  const sandboxPort =
    Number(process.env.EFFECT_SDK_SANDBOX_PORT) || defaultSandboxPort;
  const generatedPublicRoot = resolve(repoRoot, ".tmp/qa/smoke/public");

  await prepareSmokeOutputDirectory(repoRoot, outputDir);
  await generateNeutralLocalPack(resolve(generatedPublicRoot, "packs/demo"));
  const viewerServer = await startServer(viewerRoot, viewerPort, {
    packRoot: generatedPublicRoot,
  });
  const sandboxServer = await startServer(sandboxRoot, sandboxPort);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 1640, height: 1060 },
    deviceScaleFactor: 1,
  });

  return {
    browser,
    outputDir,
    page,
    sandboxPort,
    viewerPort,
    async close() {
      await browser.close();
      await new Promise((resolveClose) => viewerServer.close(resolveClose));
      await new Promise((resolveClose) => sandboxServer.close(resolveClose));
    },
  };
}

export function resolveSmokeOutputDirectory(
  requested,
  repoRoot = process.cwd(),
) {
  const temporaryRoot = resolve(repoRoot, ".tmp");
  const output = resolve(repoRoot, requested || join(".tmp", "qa", "browser"));
  const pathFromTemporaryRoot = relative(temporaryRoot, output);
  if (
    pathFromTemporaryRoot === "" ||
    pathFromTemporaryRoot === ".." ||
    pathFromTemporaryRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromTemporaryRoot)
  ) {
    throw new Error(`Smoke output must stay below ${temporaryRoot}.`);
  }
  return output;
}

export async function prepareSmokeOutputDirectory(repoRoot, output) {
  const repositoryRoot = resolve(repoRoot);
  const temporaryRoot = resolve(repositoryRoot, ".tmp");
  const target = resolveSmokeOutputDirectory(output, repositoryRoot);

  await assertNoSymlinkAncestor(repositoryRoot, temporaryRoot);
  await mkdir(temporaryRoot, { recursive: true });
  await assertNoSymlinkAncestor(temporaryRoot, target);
  await mkdir(target, { recursive: true });

  const [realRepositoryRoot, realTemporaryRoot, realTarget] = await Promise.all(
    [realpath(repositoryRoot), realpath(temporaryRoot), realpath(target)],
  );
  if (
    !isContainedPath(realRepositoryRoot, realTemporaryRoot) ||
    !isContainedPath(realTemporaryRoot, realTarget)
  ) {
    throw new Error(`Smoke output must stay below ${temporaryRoot}.`);
  }
}

async function assertNoSymlinkAncestor(parent, target) {
  const pathFromParent = relative(parent, target);
  let current = parent;
  for (const segment of pathFromParent.split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`Smoke output cannot cross symlink ${current}.`);
      }
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

function isContainedPath(root, target) {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot !== "" &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
}
