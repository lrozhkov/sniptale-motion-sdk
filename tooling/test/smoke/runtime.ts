import type { Server } from "node:http";
import type { Browser } from "@playwright/test";
import { closeSmokeResources } from "./resources.ts";
import { existsSync } from "node:fs";
import { lstat, mkdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { generateNeutralLocalPack } from "../fixtures/local-pack.ts";
import { startServer } from "./server.ts";
import {
  sandboxPort as defaultSandboxPort,
  viewerPort as defaultViewerPort,
} from "./data.ts";

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
  let viewerServer: Server | null = null;
  let sandboxServer: Server | null = null;
  let browser: Browser | null = null;
  try {
    viewerServer = await startServer(viewerRoot, viewerPort, {
      packRoot: generatedPublicRoot,
    });
    sandboxServer = await startServer(sandboxRoot, sandboxPort);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      acceptDownloads: true,
      viewport: { width: 1640, height: 1060 },
      deviceScaleFactor: 1,
    });
    const ownedBrowser = browser;
    const servers = [viewerServer, sandboxServer];
    let closing: Promise<void> | undefined;
    return {
      browser: ownedBrowser,
      outputDir,
      page,
      sandboxPort,
      viewerPort,
      close(): Promise<void> {
        return (closing ??= closeSmokeResources(ownedBrowser, servers));
      },
    };
  } catch (error) {
    await closeSmokeResources(browser, [viewerServer, sandboxServer]).catch(
      () => {},
    );
    throw error;
  }
}

export function resolveSmokeOutputDirectory(
  requested: string | undefined,
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

export async function prepareSmokeOutputDirectory(
  repoRoot: string,
  output: string,
): Promise<void> {
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

async function assertNoSymlinkAncestor(
  parent: string,
  target: string,
): Promise<void> {
  const pathFromParent = relative(parent, target);
  let current = parent;
  for (const segment of pathFromParent.split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`Smoke output cannot cross symlink ${current}.`);
      }
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return;
      throw error;
    }
  }
}

function isContainedPath(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return (
    pathFromRoot !== "" &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
}

export type SmokeRuntime = Awaited<ReturnType<typeof createSmokeRuntime>>;
