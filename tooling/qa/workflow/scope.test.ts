import { expect, it } from "vitest";
import { classifyScope } from "./scope.ts";

it("limits unit-test and ordinary-document changes to checkpoint and coverage", () => {
  for (const files of [
    ["tooling/qa/formatting/format.test.ts"],
    ["tests/i18n.test.ts", "README.md"],
    ["tooling/qa/workflow/closeout.test.ts"],
  ])
    expect(classifyScope(files)).toMatchObject({
      coverage: true,
      build: false,
      security: false,
      full: false,
    });
  expect(classifyScope(["AGENTS.md"])).toMatchObject({
    coverage: false,
    full: false,
  });
});

it("keeps full proof for executable owners, harnesses, payloads and unknown paths", () => {
  for (const file of [
    "src/apps/viewer/app/context.ts",
    "tooling/qa/workflow/closeout.ts",
    "tooling/configs/qa/oxlint.json",
    "tooling/test/smoke/run.ts",
    "tests/smoke.spec.ts",
    "tests/smoke.test.ts",
    "tests/fixtures/source.test.ts",
    "tests/smoke/viewer.test.ts",
    "tests/fixtures/media.png",
    "package-lock.json",
    ".github/workflows/ci.yml",
    "docs/authoring/create-effect/SKILL.md",
    ".agents/skills/create-effect/SKILL.md",
    "new-root-config.json",
  ])
    expect(classifyScope(["tests/i18n.test.ts", file])).toMatchObject({
      full: true,
      build: true,
      security: true,
    });
});
