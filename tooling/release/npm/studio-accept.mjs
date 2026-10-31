import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function acceptInstalledStudio({
  cli,
  project,
  evidence,
  browserCheck,
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
  child.stdout.on("data", (text) => {
    stdout += text;
  });
  child.stderr.on("data", (text) => {
    stderr += text;
  });
  const exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  let ready;
  try {
    ready = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Installed Studio did not become ready.")),
        15_000,
      );
      const inspect = () => {
        if (!stdout.includes("\n")) return;
        clearTimeout(timeout);
        child.stdout.off("data", inspect);
        try {
          resolve(JSON.parse(stdout));
        } catch (error) {
          reject(error);
        }
      };
      child.stdout.on("data", inspect);
      exited.then((result) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `Studio exited before readiness: ${JSON.stringify(result)} ${stderr}`,
          ),
        );
      }, reject);
    });
    assert.equal(ready.ok, true);
    assert.equal(ready.command, "studio");
    assert.notEqual(ready.viewerOrigin, ready.sandboxOrigin);
    const url = new URL(ready.url);
    assert.equal(url.origin, ready.viewerOrigin);
    const headers = {
      "x-sniptale-session": url.searchParams.get("studioSession"),
    };
    const catalog = await fetch(
      `${ready.viewerOrigin}/__sniptale/local-effects`,
      { headers },
    );
    assert.equal(catalog.status, 200);
    const value = await catalog.json();
    assert.deepEqual(value.errors, []);
    assert.equal(value.effects.length, 3);
    assert.equal((await fetch(ready.viewerOrigin)).status, 200);
    assert.equal(
      (await fetch(`${ready.sandboxOrigin}/sandbox.html`)).status,
      200,
    );
    assert.equal(
      (await fetch(`${ready.viewerOrigin}/sniptale-motion.json`)).status,
      404,
    );
    if (browserCheck) await checkBrowser(ready, evidence);
  } finally {
    child.kill("SIGINT");
    let timeout;
    const result = await Promise.race([
      exited,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("Installed Studio did not stop."));
        }, 10_000);
      }),
    ]).finally(() => clearTimeout(timeout));
    await writeFile(join(evidence, "studio.stdout"), stdout);
    await writeFile(join(evidence, "studio.stderr"), stderr);
    if (process.platform !== "win32") assert.equal(result.code, 130);
    assert.equal(stderr, "");
  }
  assert.equal(stdout.trim().split("\n").length, 1);
  await assert.rejects(fetch(ready.viewerOrigin));
  await assert.rejects(fetch(ready.sandboxOrigin));
}

async function checkBrowser(ready, evidence) {
  const { chromium, expect } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  const errors = [];
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
      await page.evaluate(() => typeof window.effectsViewer),
      "undefined",
    );
    const canvas = page.locator("#previewCanvas");
    const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
    await page.locator("#timeSlider").evaluate((element) => {
      element.value = "0.2";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect.poll(async () => hash(await canvas.screenshot())).toBeTruthy();
    const before = hash(await canvas.screenshot());
    await page.locator("#timeSlider").evaluate((element) => {
      element.value = "2.5";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect
      .poll(async () => hash(await canvas.screenshot()))
      .not.toBe(before);
    await canvas.screenshot({ path: join(evidence, "studio-preview.png") });
    assert.deepEqual(errors, []);
    await writeFile(
      join(evidence, "studio-browser.json"),
      `${JSON.stringify({ status: "passed", browser: browser.version(), sourceRepositoryRequired: false, testApiAvailable: false, cases: ["catalog", "separate-origins", "render-after-scrub"] }, null, 2)}\n`,
    );
  } finally {
    await browser.close();
  }
}
