import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "@playwright/test";
import { requiredEntry } from "./helpers/required-entry";

let browser: Browser;
let page: Page;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: [
        'export * from "./src/apps/viewer/panels/control-fields.ts";',
        'export * from "./src/apps/viewer/panels/control-groups.ts";',
        'export * from "./src/apps/viewer/panels/control-icons.ts";',
        'export * from "./src/shared/i18n/index.ts";',
        'export * from "./src/sdk/effect-v1/control-presentation-model.ts";',
      ].join("\n"),
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "ControlPanelProof",
    platform: "browser",
  });
  bundle = requiredEntry(result.outputFiles, 0).text;
  browser = await chromium.launch();
}, 30000);
beforeEach(async () => {
  page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="ru"><body></body></html>');
  await page.addScriptTag({ content: bundle });
});
afterEach(async () => {
  await page?.close();
});
afterAll(async () => {
  await browser?.close();
});

describe("control presentation in Chromium", () => {
  it("preserves numeric values and units through keyboard edits without range clamping", async () => {
    expect(
      await page.evaluate(() => {
        const api = window.ControlPanelProof;
        const control = {
          id: "amount",
          kind: "number",
          defaultValue: 20,
          min: 0,
          max: 100,
          step: 1,
          unit: "percent",
        } as const;
        const field = api.createControlField(api, control);
        document.body.append(field.element);
        const input = field.element.querySelector('input[type="number"]');
        if (!(input instanceof HTMLInputElement))
          throw new Error("Missing numeric field");
        input.value = "0.25";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return {
          value: field.readValue(),
          unit: api.controlUnitLabel(control, api),
        };
      }),
    ).toEqual({ value: "0.25", unit: "%" });
    await page.locator('input[type="number"]').fill("75");
    await page.locator('input[type="number"]').press("ArrowUp");
    await expect
      .poll(() => page.locator('input[type="number"]').inputValue())
      .toBe("76");
  });

  it("uses dropdown for auto options, numeric input for number and multiline text for textarea", async () => {
    expect(
      await page.evaluate(() => {
        const api = window.ControlPanelProof;
        const options = [{ value: "a" }, { value: "b" }];
        const fields = [
          api.createControlField(api, {
            id: "auto",
            kind: "text",
            defaultValue: "b",
            presentation: "auto",
            options,
          }),
          api.createControlField(api, {
            id: "number",
            kind: "number",
            defaultValue: 4,
            presentation: "number",
          }),
          api.createControlField(api, {
            id: "text",
            kind: "text",
            defaultValue: "line 1\nline 2",
            presentation: "textarea",
          }),
        ];
        return fields.map((field) => ({
          tag: field.element.tagName,
          value: field.readValue(),
        }));
      }),
    ).toEqual([
      { tag: "SELECT", value: "b" },
      { tag: "INPUT", value: "4" },
      { tag: "TEXTAREA", value: "line 1\nline 2" },
    ]);
  });

  it.each(["segmented", "toggle"] as const)(
    "supports keyboard selection and change events for %s",
    async (presentation) => {
      await page.evaluate((presentation) => {
        const api = window.ControlPanelProof;
        const field = api.createControlField(api, {
          id: "mode",
          label: { ru: "Режим", en: "Mode" },
          kind: "text",
          defaultValue: "a",
          presentation,
          options: [
            { value: "a", label: "Первый", icon: "check" },
            { value: "b", label: "Второй", icon: "x" },
          ],
        });
        const output = document.createElement("output");
        field.element.addEventListener("change", () => {
          output.value = field.readValue();
        });
        document.body.append(field.element, output);
      }, presentation);
      await page.getByRole("button", { name: "Второй" }).press("Space");
      expect(await page.locator("output").textContent()).toBe("b");
      expect(
        await page
          .getByRole("button", { name: "Второй" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        await page
          .getByRole("button", { name: "Первый" })
          .getAttribute("aria-pressed"),
      ).toBe("false");
      expect(await page.locator('svg[aria-hidden="true"]').count()).toBe(2);
    },
  );

  it("renders populated nested groups, collapsed defaults and safe text with legacy fallback", async () => {
    expect(
      await page.evaluate(() => {
        const api = window.ControlPanelProof;
        const containers = api.createControlGroupContainers(
          document.body,
          {
            id: "test",
            duration: 1,
            controlGroups: [
              {
                id: "paint",
                parentId: "appearance",
                label: { ru: "Краска", en: "Paint" },
                icon: "palette",
              },
              {
                id: "fill",
                parentId: "paint",
                label: { ru: "<img src=x>", en: "Fill" },
                collapsed: true,
              },
              { id: "empty", parentId: "content", label: { en: "Empty" } },
            ],
            controls: [
              { id: "size", defaultValue: 10, group: "fill" },
              { id: "legacy", defaultValue: 1, group: "old-group" },
            ],
          },
          api,
        );
        const collapsed = document.querySelector('[data-control-group="fill"]');
        return {
          keys: [...containers.keys()],
          collapsed: collapsed instanceof HTMLDetailsElement && !collapsed.open,
          parent:
            collapsed?.parentElement?.closest("details")?.dataset.controlGroup,
          heading: collapsed?.querySelector("summary")?.textContent,
          images: document.querySelectorAll("img").length,
          root: document.querySelector(
            '[data-control-group="advanced"] > summary',
          )?.textContent,
        };
      }),
    ).toEqual({
      keys: ["appearance", "paint", "fill", "advanced"],
      collapsed: true,
      parent: "paint",
      heading: "<img src=x>",
      images: 0,
      root: "Дополнительно",
    });
  });

  it("maps all 44 semantic icons and localizes unit suffixes without changing numbers", async () => {
    expect(
      await page.evaluate(() => {
        const api = window.ControlPanelProof;
        api.setLocale("en");
        const english = api.controlUnitLabel(
          { id: "n", defaultValue: 1, unit: "count" },
          api,
        );
        api.setLocale("ru");
        return {
          icons: api.EFFECT_V1_CONTROL_ICONS.map(
            (icon) => api.createControlIcon(icon).tagName,
          ),
          english,
          russian: api.controlUnitLabel(
            { id: "n", defaultValue: 1, unit: "count" },
            api,
          ),
          ratio: api.controlUnitLabel(
            { id: "n", defaultValue: 1, unit: "ratio" },
            api,
          ),
        };
      }),
    ).toEqual({
      icons: Array.from({ length: 44 }, () => "svg"),
      english: "units",
      russian: "шт.",
      ratio: "×",
    });
  });
});
