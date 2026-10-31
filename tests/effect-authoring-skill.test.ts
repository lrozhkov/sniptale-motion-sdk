import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EFFECT_V1_COMMAND_OPS,
  EFFECT_V1_EXPRESSION_OPS,
  validateEffectV1Document,
} from "../src/sdk/effect-v1/index.js";

const skillRoot = "docs/authoring/create-effect";

describe("Effect v1 authoring skill", () => {
  it("is installed as a discoverable skill package", () => {
    const skill = read(`${skillRoot}/SKILL.md`);
    const metadata = read(".agents/skills/create-effect/agents/openai.yaml");

    expect(skill).toMatch(/^---\nname: create-effect\ndescription: .+\n/);
    expect(metadata).toContain('display_name: "Create Sniptale Effect"');
    expect(metadata).toContain("$create-effect");
    expect(read(".gitignore")).toContain("/.tmp/");
  });

  it("routes authors to direct graph import and ignored effect-local storage", () => {
    const skill = read(`${skillRoot}/SKILL.md`);
    const contract = read(`${skillRoot}/references/effect-v1-contract.md`);
    const patterns = read(`${skillRoot}/references/authoring-patterns.md`);
    const manual = `${skill}\n${contract}\n${patterns}\n${read(".agents/skills/create-effect/SKILL.md")}`;

    expect(manual).toContain("*.sniptale-effect.json");
    expect(manual).toContain("npm run effect:new");
    expect(manual).toContain("npm run -s effect:validate");
    expect(manual).toContain("npm run effect:prove");
    expect(manual).toContain(".tmp/effects/<effect-id>/");
    expect(manual).toContain("--asset-root .tmp/effects/<effect-id>");
    expect(manual).toContain("ignored");
    expect(manual).toContain("`standalone`");
    expect(manual).toContain("`targetEffect`");
    expect(manual).toContain("`transition`");
    expect(manual).toContain("JavaScript renderer");
    expect(manual).not.toContain("--asset-root /tmp");
    expect(manual).not.toContain("public/packs/demo");
    expect(manual).not.toContain("compiled renderer");
  });

  it("documents every graph command and expression operation", () => {
    const runtime = read(`${skillRoot}/references/graph-runtime.md`);

    for (const operation of EFFECT_V1_COMMAND_OPS) {
      expect(runtime, `missing command ${operation}`).toContain(
        `\`${operation}\``,
      );
    }
    for (const operation of EFFECT_V1_EXPRESSION_OPS) {
      expect(runtime, `missing expression ${operation}`).toContain(
        `\`${operation}\``,
      );
    }
  });

  it("keeps every JSON example parseable", () => {
    for (const file of [
      `${skillRoot}/references/effect-v1-contract.md`,
      `${skillRoot}/references/graph-runtime.md`,
      `${skillRoot}/references/authoring-patterns.md`,
    ]) {
      const examples = readJsonExamples(file);
      expect(
        examples.length,
        `missing JSON examples in ${file}`,
      ).toBeGreaterThan(0);
    }
  });

  it("documents a minimal payload accepted by the authoritative validator", () => {
    const document = readJsonExamples(
      `${skillRoot}/references/effect-v1-contract.md`,
    ).find(
      (example) =>
        example !== null &&
        typeof example === "object" &&
        "schemaVersion" in example &&
        example.schemaVersion === "sniptale.effect.v1",
    );

    expect(validateEffectV1Document(document)).toMatchObject({
      ok: true,
      summary: { errors: 0, warnings: 0 },
    });
  });
});

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function readJsonExamples(path: string): unknown[] {
  return [...read(path).matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) =>
    JSON.parse(match[1] ?? ""),
  );
}
