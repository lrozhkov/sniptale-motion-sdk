import { parseEffectV1Fixture } from "../../test/fixtures/effect-v1-documents.ts";
import type { StudioReady } from "./studio-response.ts";
import { parseStudioReady } from "./studio-response.ts";
import {
  responseArray,
  responseField,
  responseString,
} from "../../test/fixtures/response.ts";
import { acceptStudioLiveReload } from "./studio-live-accept.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function acceptInstalledStudio({
  cli,
  project,
  evidence,
  browserCheck,
}: {
  cli: string;
  project: string;
  evidence: string;
  browserCheck: boolean;
}) {
  const child = spawn(
    process.execPath,
    [cli, "studio", "--no-open", "--json"],
    { cwd: project, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (text: string) => {
    stdout += text;
  });
  child.stderr.on("data", (text: string) => {
    stderr += text;
  });
  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  let ready: StudioReady | undefined;
  let failure: { error: unknown } | undefined;
  try {
    ready = await new Promise<StudioReady>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Installed Studio did not become ready.")),
        15_000,
      );
      const inspect = () => {
        if (!stdout.includes("\n")) return;
        clearTimeout(timeout);
        child.stdout.off("data", inspect);
        try {
          resolve(parseStudioReady(JSON.parse(stdout)));
        } catch (error) {
          reject(error);
        }
      };
      child.stdout.on("data", inspect);
      void exited.then((result) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `Studio exited before readiness: ${JSON.stringify(result)} ${stderr}`,
          ),
        );
      }, reject);
    });
    assert.notEqual(ready.viewerOrigin, ready.sandboxOrigin);
    const url = new URL(ready.url);
    assert.equal(url.origin, ready.viewerOrigin);
    const headers = {
      "x-sniptale-session": ready.session,
    };
    const catalog = await fetch(
      `${ready.viewerOrigin}/__sniptale/local-effects`,
      { headers },
    );
    assert.equal(catalog.status, 200);
    const value: unknown = await catalog.json();
    assert.deepEqual(responseField(value, "errors"), []);
    assert.equal(responseArray(value, "effects").length, 3);
    assert.equal((await fetch(ready.viewerOrigin)).status, 200);
    assert.equal(
      (await fetch(`${ready.sandboxOrigin}/sandbox.html`)).status,
      200,
    );
    assert.equal(
      (await fetch(`${ready.viewerOrigin}/sniptale-motion.json`)).status,
      404,
    );
    if (browserCheck) await checkBrowser(ready, evidence, cli);
  } catch (error) {
    failure = { error };
  }
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, 10_000);
  try {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGINT");
    const result = await exited;
    await writeFile(join(evidence, "studio.stdout"), stdout);
    await writeFile(join(evidence, "studio.stderr"), stderr);
    if (timedOut)
      throw new Error("Installed Studio did not stop before the timeout.");
    if (process.platform !== "win32") assert.equal(result.code, 130);
    assert.equal(stderr, "");
  } catch (error) {
    failure ??= { error };
  } finally {
    clearTimeout(timeout);
  }
  if (failure) throw failure.error;
  assert.ok(
    ready,
    "Studio readiness must be available after successful acceptance.",
  );
  assert.equal(stdout.trim().split("\n").length, 1);
  await assert.rejects(fetch(ready.viewerOrigin));
  await assert.rejects(fetch(ready.sandboxOrigin));
}

async function checkBrowser(ready: StudioReady, evidence: string, cli: string) {
  const { chromium, expect } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1640, height: 1060 },
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(ready.url, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#packStatus")).toHaveClass(/ready/);
    await expect(page.locator("#templateSelect option")).toHaveCount(3);
    await expect(page.locator("#templateSelect")).toHaveValue("standalone");
    await expect(page.locator("#sandboxFrame")).toHaveAttribute(
      "src",
      `${ready.sandboxOrigin}/sandbox.html`,
    );
    assert.equal(
      await page.evaluate(() =>
        "effectsViewer" in window ? typeof window.effectsViewer : "undefined",
      ),
      "undefined",
    );
    const canvas = page.locator("#previewCanvas");
    const hash = (bytes: Uint8Array) =>
      createHash("sha256").update(bytes).digest("hex");
    await page.locator("#timeSlider").evaluate((element) => {
      if (!(element instanceof HTMLInputElement))
        throw new Error("Time slider must be an input.");
      element.value = "0.2";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const before = hash(await canvas.screenshot());
    await page.locator("#timeSlider").evaluate((element) => {
      if (!(element instanceof HTMLInputElement))
        throw new Error("Time slider must be an input.");
      element.value = "2.5";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect
      .poll(async () => hash(await canvas.screenshot()))
      .not.toBe(before);
    await canvas.screenshot({ path: join(evidence, "studio-preview.png") });
    const originalFile = join(
      ready.project,
      "effects/standalone/effect.sniptale-effect.json",
    );
    const original = await readFile(originalFile, "utf8");
    const color = page.locator('#controlsPanel [data-css-color-role="value"]');
    await page.locator('[data-sidebar-tab="tune"]').click();
    await color.fill("#e14b50");
    await color.press("Tab");
    await expect(page.locator("#exportEffectFileButton")).toBeEnabled();
    await page.locator("#appActionsButton").click();
    const [savedResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/__sniptale/studio/revisions") &&
          response.request().method() === "POST",
      ),
      page.locator("#saveStudioRevisionButton").click(),
    ]);
    assert.equal(savedResponse.status(), 201);
    const saved: unknown = await savedResponse.json();
    assert.equal(responseField(saved, "ok"), true);
    const revisionId = responseString(saved, "revision", "revisionId");
    const persisted = parseEffectV1Fixture(
      await readFile(
        join(
          ready.project,
          "effects/standalone/revisions",
          revisionId,
          "effect.sniptale-effect.json",
        ),
        "utf8",
      ),
    );
    assert.equal(
      persisted.controls.find((control) => control.id === "accent")
        ?.defaultValue,
      "#e14b50",
    );
    assert.equal(await readFile(originalFile, "utf8"), original);
    await page.locator("#appActionsButton").click();
    await page.locator("#openStudioRevisionsButton").click();
    await expect(page.locator("#studioRevisionsDialog")).toBeVisible();
    await expect(page.locator("#studioRevisionSelect")).toHaveValue(revisionId);
    await page
      .locator("#studioRevisionsDialog")
      .screenshot({ path: join(evidence, "studio-revisions.png") });
    const [adopted] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/__sniptale/studio/selection") &&
          response.request().method() === "POST",
      ),
      page.locator("#adoptStudioRevisionButton").click(),
    ]);
    assert.equal(adopted.status(), 200);
    await expect(color).toHaveValue("#e14b50");
    assert.equal(await readFile(originalFile, "utf8"), original);
    const reopened = await browser.newPage({
      viewport: { width: 1640, height: 1060 },
    });
    await reopened.goto(ready.url, { waitUntil: "domcontentloaded" });
    await expect(reopened.locator("#packStatus")).toHaveClass(/ready/);
    await expect(
      reopened.locator('#controlsPanel [data-css-color-role="value"]'),
    ).toHaveValue("#e14b50");
    await acceptStudioLiveReload({
      page: reopened,
      ready,
      cli,
      evidence,
      expect,
    });
    assert.deepEqual(errors, []);
    await writeFile(
      join(evidence, "studio-browser.json"),
      `${JSON.stringify({ status: "passed", browser: browser.version(), sourceRepositoryRequired: false, testApiAvailable: false, cases: ["catalog", "separate-origins", "render-after-scrub", "save-revision", "explicit-adoption", "reopen-adopted"] }, null, 2)}\n`,
    );
  } finally {
    await browser.close();
  }
}
