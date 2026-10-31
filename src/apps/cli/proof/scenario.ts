import type { Page } from "playwright-core";
import type { EffectV1Document } from "../../../sdk/effect-v1/types.js";
import {
  alternateControl,
  assessBindings,
  assessAssetTransfers,
  assessFrames,
  proofTimes,
  type ProofFrame,
} from "./assessment.js";
import { renderProofFrame } from "./frames.js";
import { setProofControl } from "./controls.js";
import { proveSessionMedia } from "./media.js";
import { proveViewerRecovery } from "./recovery.js";

export async function runProofScenario(
  page: Page,
  source: string,
  document: EffectV1Document,
) {
  const previousId = await page.locator("#templateSelect").inputValue();
  await page.locator("#effectFileInput").setInputFiles({
    name: "proof.sniptale-effect.json",
    mimeType: "application/json",
    buffer: Buffer.from(source),
  });
  await page.waitForFunction((previousId) => {
    const select = window.document.querySelector("#templateSelect");
    return (
      select instanceof HTMLSelectElement &&
      select.value !== "" &&
      select.value !== previousId
    );
  }, previousId);
  const templateId = await page.locator("#templateSelect").inputValue();
  if (!templateId || templateId.length > 512)
    throw new Error("PROOF_IMPORT_IDENTITY");
  await page.evaluate(async () => {
    await window.document.fonts.ready;
  });
  const frames: ProofFrame[] = [];
  for (const time of proofTimes(document))
    frames.push(await renderProofFrame(page, templateId, time));
  const repeated: ProofFrame[] = [];
  for (const frame of frames)
    repeated.push(await renderProofFrame(page, templateId, frame.time));
  const deterministic = frames.every(
    (frame, index) => frame.hash === repeated[index]?.hash,
  );
  const assessment = assessFrames(frames, document.duration);
  const controls: Array<{
    id: string;
    changed: boolean;
    reason?: "NO_ALTERNATE";
  }> = [];
  for (const control of document.controls) {
    let alternate: number | string;
    try {
      alternate = alternateControl(control);
    } catch {
      controls.push({ id: control.id, changed: false, reason: "NO_ALTERNATE" });
      continue;
    }
    const times = [0.2, 0.5, 0.8].map(
      (fraction) => fraction * document.duration,
    );
    const baseline: ProofFrame[] = [];
    for (const time of times)
      baseline.push(await renderProofFrame(page, templateId, time));
    await setProofControl(page, control, alternate);
    const variant: ProofFrame[] = [];
    for (const time of times)
      variant.push(await renderProofFrame(page, templateId, time));
    controls.push({
      id: control.id,
      changed: variant.some(
        (frame, index) => frame.hash !== baseline[index]?.hash,
      ),
    });
    frames.push(...variant);
    await setProofControl(page, control, control.defaultValue);
  }
  const missingBindings = assessBindings(document, frames);
  const assetTransfers = assessAssetTransfers(document, frames);
  const media = await proveSessionMedia(
    page,
    document.kind,
    templateId,
    document.duration,
  );
  const recovery = await proveViewerRecovery(
    page,
    templateId,
    document.duration,
  );
  return {
    ok:
      deterministic &&
      assetTransfers.ok &&
      assessment.animated &&
      assessment.midpointVisible &&
      controls.every((control) => control.changed) &&
      Object.values(missingBindings).every((missing) => missing.length === 0) &&
      media.exportUnchanged &&
      !media.sessionFilesLeaked &&
      Object.values(media.changed).every(Boolean) &&
      Object.values(recovery).every(Boolean),
    deterministic,
    assessment,
    missingBindings,
    assetTransfers,
    controls,
    media,
    recovery,
    frames: frames.map(({ hash, time, occupied, lit }) => ({
      hash,
      time,
      occupied,
      lit,
    })),
  };
}
