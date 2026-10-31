import type { Page } from "playwright-core";
import type { EffectV1Kind } from "../../../sdk/effect-v1/types.js";
import { renderProofFrame } from "./frames.js";
import { MAX_STUDIO_SOURCE_BYTES } from "../../../shared/studio/protocol.js";

async function exportedSource(page: Page): Promise<string> {
  await page.locator("#appActionsButton").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportEffectFileButton").click(),
  ]);
  const stream = await download.createReadStream();
  if (!stream) throw new Error("PROOF_EXPORT");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    if (!Buffer.isBuffer(chunk)) throw new Error("PROOF_EXPORT");
    size += chunk.length;
    if (size > MAX_STUDIO_SOURCE_BYTES) {
      stream.destroy();
      throw new Error("PROOF_EXPORT_LIMIT");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function mediaBytes(page: Page, color: string): Promise<Buffer> {
  const source: unknown = await page.evaluate((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PROOF_MEDIA");
    context.fillStyle = color;
    context.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png");
  }, color);
  if (
    typeof source !== "string" ||
    source.length > 100_000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(source)
  )
    throw new Error("PROOF_MEDIA_RESPONSE");
  return Buffer.from(source.slice(source.indexOf(",") + 1), "base64");
}
export async function proveSessionMedia(
  page: Page,
  kind: EffectV1Kind,
  templateId: string,
  duration: number,
) {
  const slots =
    kind === "targetEffect"
      ? ["source"]
      : kind === "transition"
        ? ["from", "to"]
        : [];
  const before = await exportedSource(page);
  const changed: Record<string, boolean> = {};
  for (const slot of slots) {
    const selector =
      slot === "source"
        ? "#previewMediaSourceInput"
        : slot === "from"
          ? "#previewMediaFromInput"
          : "#previewMediaToInput";
    const times =
      slot === "from"
        ? [0.2, 0.5]
        : slot === "to"
          ? [0.5, 0.8]
          : [0.2, 0.5, 0.8];
    const hashes: string[][] = [];
    for (const color of ["#f02519", "#18d569"]) {
      const name = `motion-proof-session-${slot}-${color.slice(1)}.png`;
      await page.locator(selector).setInputFiles({
        buffer: await mediaBytes(page, color),
        mimeType: "image/png",
        name,
      });
      await page.waitForFunction(
        ({ slot, name }) =>
          document.querySelector(`[data-preview-media-status="${slot}"]`)
            ?.textContent === name,
        { slot, name },
      );
      const values: string[] = [];
      for (const fraction of times)
        values.push(
          (await renderProofFrame(page, templateId, duration * fraction)).hash,
        );
      hashes.push(values);
    }
    changed[slot] =
      hashes[0]?.some((hash, index) => hash !== hashes[1]?.[index]) === true;
  }
  const after = await exportedSource(page);
  return {
    changed,
    exportUnchanged: after === before,
    sessionFilesLeaked: after.includes("motion-proof-session-"),
  };
}
