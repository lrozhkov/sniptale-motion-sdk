import type { Page } from "playwright-core";
import {
  FRAME_OBSERVATION_ATTRIBUTE,
  parseFrameObservation,
} from "../../../shared/proof/frame-observation.js";
import type { ProofFrame } from "./assessment.js";

export async function renderProofFrame(
  page: Page,
  templateId: string,
  time: number,
): Promise<ProofFrame> {
  const previous = parseFrameObservation(
    await page
      .locator("#renderStats")
      .getAttribute(FRAME_OBSERVATION_ATTRIBUTE),
  );
  const actualTime = await page
    .locator("#timeSlider")
    .evaluate((element, requested) => {
      if (!(element instanceof HTMLInputElement))
        throw new Error("PROOF_TIME_INPUT");
      element.value = String(requested);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return Number(element.value);
    }, time);
  await page.waitForFunction(
    ({ attribute, templateId, time, after }) => {
      const stats = document.querySelector("#renderStats");
      if (!(stats instanceof HTMLElement) || stats.dataset.status !== "applied")
        return false;
      try {
        const value: unknown = JSON.parse(
          stats.getAttribute(attribute) ?? "null",
        );
        return (
          value !== null &&
          typeof value === "object" &&
          "templateId" in value &&
          value.templateId === templateId &&
          "time" in value &&
          typeof value.time === "number" &&
          Math.abs(value.time - time) < 1e-6 &&
          "sequence" in value &&
          typeof value.sequence === "number" &&
          value.sequence > after &&
          "scale" in value &&
          value.scale === 1
        );
      } catch {
        return false;
      }
    },
    {
      attribute: FRAME_OBSERVATION_ATTRIBUTE,
      templateId,
      time: actualTime,
      after: previous?.sequence ?? 0,
    },
  );
  const result: unknown = await page.evaluate(async (attribute) => {
    const canvas = document.querySelector("#previewCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("PROOF_CANVAS");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("PROOF_CANVAS_CONTEXT");
    const observation = document
      .querySelector("#renderStats")
      ?.getAttribute(attribute);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let occupied = 0;
    let lit = 0;
    for (let index = 0; index < pixels.length; index += 4 * 97) {
      if ((pixels[index + 3] ?? 0) > 0) occupied += 1;
      if (
        (pixels[index] ?? 0) +
          (pixels[index + 1] ?? 0) +
          (pixels[index + 2] ?? 0) >
        24
      )
        lit += 1;
    }
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels)),
    ]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return { hash, occupied, lit, observation };
  }, FRAME_OBSERVATION_ATTRIBUTE);
  if (
    result === null ||
    typeof result !== "object" ||
    !("hash" in result) ||
    typeof result.hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(result.hash) ||
    !("occupied" in result) ||
    typeof result.occupied !== "number" ||
    !Number.isSafeInteger(result.occupied) ||
    result.occupied < 0 ||
    !("lit" in result) ||
    typeof result.lit !== "number" ||
    !Number.isSafeInteger(result.lit) ||
    result.lit < 0 ||
    !("observation" in result)
  )
    throw new Error("PROOF_FRAME_RESPONSE");
  const observation = parseFrameObservation(result.observation);
  if (
    !observation ||
    observation.templateId !== templateId ||
    observation.time !== actualTime ||
    observation.sequence <= (previous?.sequence ?? 0) ||
    observation.scale !== 1
  )
    throw new Error("PROOF_FRAME_IDENTITY");
  return {
    hash: result.hash,
    occupied: result.occupied,
    lit: result.lit,
    time: observation.time,
    observation,
  };
}
