import { parseEffectV1Fixture } from "../../test/fixtures/effect-v1-documents.ts";
import type { Page, expect as playwrightExpect } from "@playwright/test";
import type { StudioReady } from "./studio-response.ts";
import { responseArray, responseString } from "../../test/fixtures/response.ts";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

export async function acceptStudioLiveReload({
  page,
  ready,
  cli,
  evidence,
  expect,
}: {
  page: Page;
  ready: StudioReady;
  cli: string;
  evidence: string;
  expect: typeof playwrightExpect;
}) {
  const file = join(
    ready.project,
    "effects/standalone/effect.sniptale-effect.json",
  );
  const original = await readFile(file, "utf8");
  const document = parseEffectV1Fixture(original);
  const assetFile = join(ready.project, "effects/standalone/live.svg");
  const staging = join(ready.project, ".tmp/live-accept");
  await mkdir(staging, { recursive: true });
  const headers = {
    "x-sniptale-session": ready.session,
    Origin: ready.viewerOrigin,
    "Content-Type": "application/json",
  };
  const color = page.locator('#controlsPanel [data-css-color-role="value"]');
  const apply = page.locator("#applyStudioUpdateButton");
  const notice = page.locator("#studioUpdateBar");
  const atomic = async (value: unknown) => {
    const pending = join(staging, "effect.json");
    await writeFile(pending, JSON.stringify(value));
    await rename(pending, file);
  };
  const variant = (value: string) => ({
    ...document,
    controls: document.controls.map((control) =>
      control.id === "accent" ? { ...control, defaultValue: value } : control,
    ),
  });
  const svg = (value: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${value}"/><text x="4" y="50" fill="white">Привет 🌙</text></svg>`;
  try {
    const selected = await fetch(
      `${ready.viewerOrigin}/__sniptale/studio/selection`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ effectId: "standalone", revisionId: null }),
      },
    );
    assert.equal(selected.status, 200);
    await expect(notice).toHaveAttribute("data-update-state", "pending");
    await apply.click();
    await expect(color).toHaveValue("#5f7cff");
    await page.locator('[data-sidebar-tab="tune"]').click();
    await atomic(variant("#15cc66"));
    await expect(color).toHaveValue("#15cc66");
    await expect(page.locator("#templateSelect option")).toHaveCount(3);
    await writeFile(file, "{");
    await expect(notice).toHaveAttribute("data-update-state", "unavailable");
    await expect(color).toHaveValue("#15cc66");
    await rm(file);
    await expect(color).toHaveValue("#15cc66");
    await atomic(variant("#26bb77"));
    await expect(color).toHaveValue("#26bb77");
    for (const value of ["#1b7a44", "#147b55", "#0bad66"])
      await atomic(variant(value));
    await expect(color).toHaveValue("#0bad66");
    await expect(page.locator("#exportEffectFileButton")).toBeEnabled();
    await color.fill("#ff1234");
    await color.press("Tab");
    await atomic(variant("#6644ff"));
    await expect(notice).toHaveAttribute("data-update-state", "pending");
    await expect(color).toHaveValue("#ff1234");
    const external = await readFile(file, "utf8");
    await apply.click();
    await expect(color).toHaveValue("#6644ff");
    assert.equal(await readFile(file, "utf8"), external);
    const revisions: unknown = await (
      await fetch(
        `${ready.viewerOrigin}/__sniptale/studio/revisions?effectId=standalone`,
        { headers },
      )
    ).json();
    let recovered = false;
    for (const revision of responseArray(revisions, "revisions")) {
      const saved = parseEffectV1Fixture(
        await readFile(
          join(
            ready.project,
            "effects/standalone/revisions",
            responseString(revision, "revisionId"),
            "effect.sniptale-effect.json",
          ),
          "utf8",
        ),
      );
      if (
        saved.controls.find((control) => control.id === "accent")
          ?.defaultValue === "#ff1234"
      )
        recovered = true;
    }
    assert.equal(
      recovered,
      true,
      "Editor changes were not preserved as a revision before source replacement.",
    );
    const withAsset = variant("#6644ff");
    withAsset.assets = [
      {
        id: "live",
        kind: "svg",
        mimeType: "image/svg+xml",
        path: "live.svg",
        width: 100,
        height: 100,
      },
    ];
    withAsset.layers.push({
      id: "live-layer",
      type: "svgAsset",
      assetId: "live",
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
    withAsset.clips.push({
      layerId: "live-layer",
      sceneId: "main",
      start: 0,
      duration: withAsset.duration,
    });
    withAsset.program.commands.push({
      op: "image",
      assetId: "live",
      layerId: "live-layer",
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
    await writeFile(assetFile, svg("#1b5c9e"));
    await atomic(withAsset);
    await expect
      .poll(() => countColor(page, [27, 92, 158]))
      .toBeGreaterThan(100);
    const assetSource = await readFile(file, "utf8");
    await writeFile(assetFile, svg("#b63d26"));
    await expect
      .poll(() => countColor(page, [182, 61, 38]))
      .toBeGreaterThan(100);
    assert.equal(await readFile(file, "utf8"), assetSource);
    await writeFile(assetFile, "invalid SVG");
    await expect(notice).toHaveAttribute("data-update-state", "unavailable");
    assert.ok((await countColor(page, [182, 61, 38])) > 100);
    await writeFile(assetFile, svg("#3366dd"));
    await expect
      .poll(() => countColor(page, [51, 102, 221]))
      .toBeGreaterThan(100);
    await promisify(execFile)(
      process.execPath,
      [cli, "new", "new-live-effect", "--json"],
      { cwd: ready.project, timeout: 15_000 },
    );
    await expect(page.locator("#templateSelect option")).toHaveCount(4);
    await expect(page.locator("#templateSelect")).toHaveValue("standalone");
    await page
      .locator(".topbar")
      .screenshot({ path: join(evidence, "studio-live-status.png") });
    await writeFile(
      join(evidence, "studio-live.json"),
      `${JSON.stringify({ status: "passed", cases: ["atomic-replacement", "partial-json", "deletion", "rapid-saves", "dirty-editor-backup-before-update", "asset-only-change", "invalid-asset-last-good", "utf8-svg", "new-effect-discovery"] }, null, 2)}\n`,
    );
  } finally {
    await writeFile(file, original);
    await rm(assetFile, { force: true });
    await rm(join(ready.project, "effects/new-live-effect"), {
      recursive: true,
      force: true,
    });
  }
}
async function countColor(
  page: Page,
  expected: readonly [number, number, number],
) {
  const png = await page.locator("#previewCanvas").screenshot();
  return page.evaluate(
    async ({ png, expected }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(png)], { type: "image/png" }),
      );
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d");
        if (!context)
          throw new Error("Preview comparison requires a 2D context.");
        context.drawImage(bitmap, 0, 0);
        const data = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let count = 0;
        for (let index = 0; index < data.length; index += 4)
          if (
            expected.every(
              (value, channel) =>
                Math.abs((data[index + channel] ?? -255) - value) <= 2,
            ) &&
            (data[index + 3] ?? 0) > 250
          )
            count += 1;
        return count;
      } finally {
        bitmap.close();
      }
    },
    { png: [...png], expected },
  );
}
