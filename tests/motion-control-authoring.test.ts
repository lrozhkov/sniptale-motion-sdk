import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectControlAuthoring } from "../src/apps/cli/authoring-quality.js";
import { runMotionCli } from "../src/apps/cli/commands.js";
import { publicDiagnosticPath } from "../src/apps/cli/diagnostic-path.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";
import { createControlPresentationDocument } from "../tooling/test/fixtures/control-presentation.js";
import { requiredEntry } from "./helpers/required-entry.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("opt-in control authoring quality", () => {
  it("exposes supported locale paths and still redacts arbitrary document keys", () => {
    expect(publicDiagnosticPath("$.controls[0].label.ru")).toBe(
      "$.controls[0].label.ru",
    );
    expect(
      publicDiagnosticPath("$.controls[0].label.customer_private_key"),
    ).toBe("$.controls[0].label.<field>");
  });
  it.each(["standalone", "targetEffect", "transition"] as const)(
    "generates a clean %s starter",
    (kind) => {
      expect(
        inspectControlAuthoring(createStarterDocument("clean", kind)),
      ).toEqual([]);
    },
  );

  it("requires separate units for explicit numeric label suffixes without guessing dimensions", () => {
    const document = createControlPresentationDocument();
    const control = requiredEntry(document.controls, 0);
    control.label = { ru: "Ширина (px)", en: "Width (px)" };
    const before = structuredClone(document);
    expect(inspectControlAuthoring(document)).toMatchObject([
      {
        code: "AUTHORING_CONTROL_LABEL_UNIT",
        path: "$.controls[0].label.ru",
        severity: "error",
      },
      {
        code: "AUTHORING_CONTROL_LABEL_UNIT",
        path: "$.controls[0].label.en",
        severity: "error",
      },
    ]);
    expect(document).toEqual(before);
    delete control.unit;
    expect(inspectControlAuthoring(document).map((item) => item.code)).toEqual([
      "AUTHORING_CONTROL_UNIT",
      "AUTHORING_CONTROL_UNIT",
    ]);
    control.label = { ru: "Ширина", en: "Width" };
    expect(inspectControlAuthoring(document)).toEqual([]);
  });

  it("keeps frequency suffixes separate from raw Hz values", () => {
    const document = createControlPresentationDocument();
    const control = requiredEntry(document.controls, 0);
    control.unit = "hz";
    control.label = { ru: "Обновление (Гц)", en: "Refresh (Hz)" };
    expect(
      inspectControlAuthoring(document).map(({ code, path }) => ({
        code,
        path,
      })),
    ).toEqual([
      { code: "AUTHORING_CONTROL_LABEL_UNIT", path: "$.controls[0].label.ru" },
      { code: "AUTHORING_CONTROL_LABEL_UNIT", path: "$.controls[0].label.en" },
    ]);
    control.label = { ru: "Обновление", en: "Refresh" };
    expect(inspectControlAuthoring(document)).toEqual([]);
    expect(control.defaultValue).toBe(20);
  });

  it("keeps ordinary CLI validation compatible and reports localized authoring diagnostics separately", async () => {
    await mkdir(".tmp/tests", { recursive: true });
    const root = await mkdtemp(resolve(".tmp/tests/control-authoring-"));
    roots.push(root);
    const document = createControlPresentationDocument();
    requiredEntry(document.controls, 0).label = {
      ru: "Ширина (px)",
      en: "Width (px)",
    };
    const file = join(root, "effect.sniptale-effect.json");
    await writeFile(file, JSON.stringify(document));
    async function invoke(...args: string[]) {
      let stdout = "";
      const exitCode = await runMotionCli(
        ["validate", file, "--json", ...args],
        {
          cwd: root,
          packageRoot: root,
          version: "0.1.0",
          stdout: (text) => {
            stdout += text;
          },
          stderr: () => {
            throw new Error("Unexpected stderr in JSON mode");
          },
        },
      );
      const response: unknown = JSON.parse(stdout);
      return { exitCode, response };
    }
    expect(await invoke()).toMatchObject({
      exitCode: 0,
      response: { ok: true, diagnostics: [] },
    });
    expect(await invoke("--authoring", "--locale", "en")).toMatchObject({
      exitCode: 1,
      response: {
        ok: false,
        proof: { schema: "passed", runtime: "not-run" },
        diagnostics: [
          {
            code: "AUTHORING_CONTROL_LABEL_UNIT",
            message:
              "Keep numeric control units in unit, separate from the label.",
            path: "$.controls[0].label.ru",
          },
          {
            code: "AUTHORING_CONTROL_LABEL_UNIT",
            path: "$.controls[0].label.en",
          },
        ],
      },
    });
    expect(await invoke("--authoring")).toMatchObject({
      exitCode: 1,
      response: {
        diagnostics: [
          {
            message:
              "Единица числового параметра должна храниться в unit отдельно от подписи.",
          },
          {
            message:
              "Единица числового параметра должна храниться в unit отдельно от подписи.",
          },
        ],
      },
    });
  });
});
