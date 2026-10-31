import type { Page } from "playwright-core";
import type { ControlDefinition } from "../../../sdk/types.js";

export async function setProofControl(
  page: Page,
  control: ControlDefinition,
  value: number | string,
): Promise<void> {
  await page.locator("#controlsPanel").evaluate(
    (panel, { id, value, kind }) => {
      const row = [...panel.querySelectorAll<HTMLElement>(".control-row")].find(
        (element) => element.dataset.controlId === id,
      );
      const input =
        kind === "color"
          ? row?.querySelector('[data-css-color-role="value"]')
          : row?.querySelector("select, input:not([type=range]), textarea");
      if (
        !(
          input instanceof HTMLInputElement ||
          input instanceof HTMLSelectElement ||
          input instanceof HTMLTextAreaElement
        )
      )
        throw new Error("PROOF_CONTROL_INPUT");
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { id: control.id, kind: control.kind, value },
  );
}
