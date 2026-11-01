import type { Page } from "playwright-core";
import { FRAME_OBSERVATION_ATTRIBUTE } from "../../../shared/proof/frame-observation.js";
import { renderProofFrame } from "./frames.js";
import { exportProofSource } from "./media.js";

export async function proveViewerRecovery(
  page: Page,
  templateId: string,
  duration: number,
) {
  const time = duration * 0.6;
  const baseline = await renderProofFrame(page, templateId, time);
  await page.locator("#timeSlider").evaluate((element, duration) => {
    if (!(element instanceof HTMLInputElement))
      throw new Error("PROOF_TIME_INPUT");
    for (const fraction of [0.1, 0.8, 0.3, 0.6]) {
      element.value = String(duration * fraction);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, duration);
  const settled = await renderProofFrame(page, templateId, time);
  await page.locator("#sandboxFrame").evaluate((element) => {
    if (!(element instanceof HTMLIFrameElement))
      throw new Error("PROOF_SANDBOX");
    const url = new URL(element.src);
    url.searchParams.set("runtimeRestart", "proof");
    element.src = url.toString();
  });
  await page.waitForFunction(
    ({ attribute, previous }) => {
      try {
        const value: unknown = JSON.parse(
          document.querySelector("#renderStats")?.getAttribute(attribute) ??
            "null",
        );
        return (
          value !== null &&
          typeof value === "object" &&
          "generation" in value &&
          typeof value.generation === "number" &&
          value.generation > previous
        );
      } catch {
        return false;
      }
    },
    {
      attribute: FRAME_OBSERVATION_ATTRIBUTE,
      previous: settled.observation.generation,
    },
  );
  const recovered = await renderProofFrame(page, templateId, time);
  await exportProofSource(page);
  return {
    rapidSeekStable: settled.hash === baseline.hash,
    restartStable: recovered.hash === baseline.hash,
    generationChanged:
      recovered.observation.generation > settled.observation.generation,
  };
}
