import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { CliContext } from "../context.js";
import { parseEffectV1Source } from "../../../sdk/effect-v1/index.js";
import { readMaterializedEffectV1Bundle } from "../bundle-source.js";
import {
  launchMotionBrowser,
  type BrowserOptions,
} from "../browser/runtime.js";
import { initProject } from "../project.js";
import { startMotionStudio, type MotionStudio } from "../studio/server.js";
import { MotionCliError } from "../errors.js";
import { runProofScenario } from "./scenario.js";
import { cliMessages } from "../../../shared/i18n/cli.js";
import { MAX_STUDIO_SOURCE_BYTES } from "../../../shared/studio/protocol.js";

export async function proveMotionEffect(
  context: CliContext,
  file: string,
  options: BrowserOptions & { assetRoot?: string } = {},
) {
  const source = await readMaterializedEffectV1Bundle(file, options.assetRoot);
  if (Buffer.byteLength(source, "utf8") > MAX_STUDIO_SOURCE_BYTES)
    throw new MotionCliError(
      "FILE_LIMIT",
      cliMessages(options.locale ?? "ru").proofSourceTooLarge,
    );
  const { document, ...validation } = parseEffectV1Source(source);
  if (!validation.ok || !document)
    return { ...validation, proof: { schema: "failed", runtime: "not-run" } };
  const launched = await launchMotionBrowser(options);
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(180_000),
  ]);
  let closing: Promise<void> | null = null;
  const stop = () => {
    closing ??= launched.browser.close();
    void closing.catch(() => {});
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  let temporary: string | null = null;
  let studio: MotionStudio | null = null;
  let cleanupFailed = false;
  const outcome = await (async () => {
    try {
      signal.throwIfAborted();
      const root = resolve(context.cwd, ".tmp");
      await mkdir(root, { recursive: true });
      if ((await realpath(root)) !== root) throw new Error("PROOF_PATH");
      temporary = await mkdtemp(join(root, "motion-proof-"));
      await initProject(temporary, ".", context.version);
      studio = await startMotionStudio(temporary, context.packageRoot);
      const session = await launched.browser.newContext({
        viewport: { width: 1640, height: 1060 },
        deviceScaleFactor: 1,
        serviceWorkers: "block",
      });
      const allowed = new Set([studio.viewerOrigin, studio.sandboxOrigin]);
      let blockedRequests = 0;
      await session.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          allowed.has(url.origin) ||
          url.protocol === "blob:" ||
          url.protocol === "data:"
        )
          await route.continue();
        else {
          blockedRequests += 1;
          await route.abort();
        }
      });
      const page = await session.newPage();
      page.setDefaultTimeout(15_000);
      let pageErrors = 0;
      page.on("pageerror", () => {
        pageErrors += 1;
      });
      await page.goto(studio.url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() =>
        window.document
          .querySelector("#packStatus")
          ?.classList.contains("ready"),
      );
      const { ok, ...evidence } = await runProofScenario(
        page,
        source,
        document,
      );
      const passed = ok && blockedRequests === 0 && pageErrors === 0;
      return {
        ok: passed,
        effectId: document.id,
        kind: document.kind,
        proof: {
          schema: "passed",
          runtime: passed ? "passed" : "failed",
          browser: { channel: launched.channel, version: launched.version },
          toolkitVersion: context.version,
          materializedSha256: createHash("sha256").update(source).digest("hex"),
          assets: { declared: document.assets.length, materialized: true },
          ...evidence,
          blockedRequests,
          pageErrors,
        },
      };
    } catch {
      options.signal?.throwIfAborted();
      throw new MotionCliError(
        "PROOF_RUNTIME",
        cliMessages(options.locale ?? "ru").proofFailed,
      );
    } finally {
      signal.removeEventListener("abort", stop);
      const outcomes = await Promise.allSettled([
        Promise.resolve().then(() => closing ?? launched.browser.close()),
        Promise.resolve().then(() => studio?.close()),
      ]);
      const removed = await Promise.allSettled(
        temporary ? [rm(temporary, { recursive: true, force: true })] : [],
      );
      cleanupFailed = [...outcomes, ...removed].some(
        (result) => result.status === "rejected",
      );
    }
  })();
  if (cleanupFailed)
    throw new MotionCliError(
      "PROOF_CLEANUP",
      cliMessages(options.locale ?? "ru").proofCleanupFailed,
    );
  return outcome;
}
