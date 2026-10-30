import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import vitestConfig from "../../configs/qa/vitest";
import { inspectRepositoryHygiene } from "./repository-hygiene.mjs";

const APP_OWNER_MAX_LINES = 320;
const SMOKE_ENTRYPOINT_MAX_LINES = 80;
const SMOKE_MODULE_MAX_LINES = 900;
const THIN_ENTRYPOINTS = new Map([
  ["src/apps/viewer/main.ts", 40],
  ["src/apps/sandbox/runtime.ts", 40],
]);
const DIRECT_UI_LITERAL =
  /(?:\.(?:textContent|innerText|title)\s*=\s*["'][^"']+["']|setAttribute\(\s*["']aria-label["']\s*,\s*["'][^"']+["']\s*\))/;
const BROAD_GLOBAL_DECLARATION =
  /interface\s+(?:Object|EventTarget)\s*\{[\s\S]*?\[[^\]]+\]\s*:\s*any\s*;/;
const SANDBOX_EXTERNAL_RUNTIME_COMPATIBILITY = [
  /\bAbsoluteFill\b/u,
  /\bapplyMotionPaintState\b/u,
  /\bcreateMotionLayoutFacade\b/u,
  /\bcreateMotionEasing\b/u,
  /\bdrawMotionRect\b/u,
  /\bextrapolate(?:Left|Right)\b/u,
  /\bmotion(?:Interpolate|Spring)\b/u,
  /\bovershootClamping\b/u,
  /\bremotion\b/iu,
  /\btimelineContext\b/u,
  /\buseCurrentFrame\b/u,
  /\buseVideoConfig\b/u,
  /\bwithMotionStyle\b/u,
];
const SANDBOX_EXTERNAL_RUNTIME_COMPATIBILITY_OWNERS = new Set([
  "src/apps/sandbox/runtime/layout-primitives.ts",
  "src/apps/sandbox/runtime/motion-facade.ts",
  "src/apps/sandbox/runtime/motion-primitives.ts",
  "src/apps/sandbox/runtime/sequence-primitives.ts",
  "src/apps/sandbox/runtime/shape-primitives.ts",
  "src/apps/sandbox/runtime/transform-primitives.ts",
]);
const SANDBOX_RUNTIME_FACADE_COMPATIBILITY_MEMBER =
  /^\s{4}(?:AbsoluteFill|Easing|ease|enterExit|interpolate|keyframes|layout|lerp|motion|random|sequence|sequenceFrames|spring|stagger|timelineContext|withTransformOrigin)(?:\s*:|\s*\(|\s*,)/mu;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if ([".git", ".tmp", "node_modules", "dist"].includes(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? walk(path)
      : [path.replace(`${process.cwd()}/`, "")];
  });
}

describe("architecture guardrails", () => {
  it("keeps repository documentation, storage, and policy state deterministic", () => {
    expect(inspectRepositoryHygiene(process.cwd())).toEqual([]);
  });

  it("keeps product source on TypeScript after migration", () => {
    const productJs = walk(join(process.cwd(), "src")).filter((file) =>
      /\.(?:[cm]?js|jsx)$/.test(file),
    );
    expect(productJs).toEqual([]);
  });

  it("keeps every repository command, harness, and wrapper under tooling", () => {
    const repositoryFiles = walk(process.cwd());
    const misplacedRoles = repositoryFiles
      .filter((file) => /(?:^|\/)[^/]*(?:harness|wrapper)[^/]*$/i.test(file))
      .filter((file) => !file.startsWith("tooling/"));
    const packageJson = JSON.parse(read("package.json"));
    const staleCommands = Object.entries(packageJson.scripts)
      .filter(([, command]) => String(command).includes("scripts/"))
      .map(([name]) => name);

    expect(existsSync(join(process.cwd(), "scripts"))).toBe(false);
    expect(
      repositoryFiles.filter((file) => file.startsWith("scripts/")),
    ).toEqual([]);
    expect(misplacedRoles).toEqual([]);
    expect(staleCommands).toEqual([]);
    expect(JSON.parse(read("tsconfig.json")).include).not.toContain("scripts");
  });

  it("exposes checkpoint as the canonical logged QA wrapper", () => {
    const packageJson = JSON.parse(read("package.json"));
    const checkpoint = read("tooling/qa/wrappers/checkpoint.mjs");

    expect(packageJson.scripts["qa:seamgate"]).toBeUndefined();
    expect(packageJson.scripts["qa:checkpoint"]).toBe(
      "node tooling/qa/wrappers/checkpoint.mjs",
    );
    expect(checkpoint).toContain('runQaWrapper("qa:checkpoint"');
    expect(checkpoint).toContain("tooling/qa/policy/guardrails.mjs");

    const unobservedWrappers = Object.entries(packageJson.scripts)
      .filter(
        ([name, command]) =>
          name.startsWith("qa:") &&
          String(command).startsWith("node tooling/qa/wrappers/"),
      )
      .filter(([, command]) => {
        const entrypoint = String(command).split(" ")[1];
        return !read(entrypoint).includes("runQaWrapper");
      })
      .map(([name]) => name);
    expect(unobservedWrappers).toEqual([]);
  });

  it("keeps local command entrypoints in their tooling owners", () => {
    const scripts = JSON.parse(read("package.json")).scripts;

    expect(scripts).toEqual({
      build: "npm run release:legal && node tooling/build/run.mjs",
      "build:local": "node tooling/build/run.mjs --include-local-demo-pack",
      dev: "node tooling/vite/dev.mjs",
      "effect:corpus": "tsx tooling/effect-v1/corpus/generate.ts",
      "effect:corpus:check": "tsx tooling/effect-v1/corpus/verify.ts",
      "effect:new": "tsx tooling/effect-v1/new.ts",
      "effect:prove": "npm run build:local && npm run effect:prove:runtime --",
      "effect:prove:runtime":
        "EFFECT_SDK_VIEWER_PORT=4377 EFFECT_SDK_SANDBOX_PORT=4378 tsx tooling/effect-v1/prove.ts",
      "effect:schema":
        "tsx tooling/effect-v1/schema.ts --output schemas/sniptale-effect-v1.schema.json",
      "effect:schema:check":
        "tsx tooling/effect-v1/schema.ts --output schemas/sniptale-effect-v1.schema.json --check",
      "effect:validate": "tsx tooling/effect-v1/validate.ts",
      format: "node tooling/qa/formatting/run.mjs",
      "format:write": "node tooling/qa/formatting/run.mjs --write",
      qa: "npm run qa:checkpoint && npm run qa:build",
      "qa:build": "node tooling/qa/wrappers/build.mjs",
      "qa:checkpoint": "node tooling/qa/wrappers/checkpoint.mjs",
      "qa:closeout": "node tooling/qa/wrappers/closeout.mjs",
      "qa:coverage": "node tooling/qa/wrappers/coverage.mjs",
      "qa:dependencies": "node tooling/qa/security/dependency-age.mjs",
      "qa:licenses":
        "node tooling/release/dependency-legal/audit-full-lock.mjs",
      "qa:preflight": "node tooling/qa/wrappers/preflight.mjs",
      "qa:security": "node tooling/qa/wrappers/security.mjs",
      "release:legal":
        "node tooling/release/dependency-legal/generate-production-legal.mjs",
      "release:legal:check":
        "node tooling/release/dependency-legal/validate-production-legal.mjs",
      serve: "node tooling/http/serve.mjs",
      test: "vitest run --config tooling/configs/qa/vitest.ts",
      "test:coverage":
        "vitest run --coverage --config tooling/configs/qa/vitest.ts",
      "test:smoke": "node tooling/test/smoke/run.mjs",
      typecheck: "node node_modules/@typescript/native/bin/tsc --noEmit",
    });
  });

  it("keeps publication security proof history-independent and traceable", () => {
    const wrapper = read("tooling/qa/wrappers/security.mjs");
    const worktree = read("tooling/qa/security/scan-worktree.mjs");
    const environment = read("tooling/qa/security/environment.mjs");
    const gitleaksConfig = read("tooling/configs/qa/gitleaks.toml");

    expect(wrapper).toContain('runQaWrapper("qa:security"');
    expect(wrapper).toContain("const GITLEAKS_HISTORY_SCAN_ENABLED = false;");
    expect(wrapper).toContain("async function runGitleaksHistoryAudit");
    expect(wrapper).toContain("if (GITLEAKS_HISTORY_SCAN_ENABLED)");
    expect(wrapper.match(/runGitleaksHistoryAudit\(/gu)).toHaveLength(2);
    expect(wrapper).toMatch(
      /if \(GITLEAKS_HISTORY_SCAN_ENABLED\) \{\s*await runGitleaksHistoryAudit\(securityRun\);\s*gitleaksHistoryStatus = "passed";\s*\}/u,
    );
    expect(wrapper).toContain('gitleaksHistoryStatus = "passed"');
    expect(wrapper).toContain("GITLEAKS_HISTORY_SCAN_DISABLED_REASON");
    expect(wrapper).toContain("historyScan: {");
    expect(wrapper).toContain('"npm advisory audit", "npm"');
    expect(wrapper).toContain('"--audit-level=info"');
    expect(wrapper).toContain("...NPM_DEPENDENCY_SCOPE");
    expect(wrapper).toContain("`--registry=${NPM_REGISTRY}`");
    expect(wrapper).toMatch(/"audit",\s+"signatures"/u);
    expect(wrapper).toContain('"osv-scanner"');
    expect(wrapper).toContain('"gitleaks"');
    expect(wrapper).toContain("--no-ignore");
    expect(wrapper).toContain("--ignore-gitleaks-allow");
    expect(wrapper).toContain("GITLEAKS_CONFIG_PATH");
    expect(wrapper).toContain("GITLEAKS_IGNORE_PATH");
    expect(wrapper).toContain(
      'gitleaksIndex: join(evidenceRoot, "gitleaks-index.json")',
    );
    expect(wrapper).toMatch(
      /checks:\s*\[[\s\S]*"gitleaks-index",\s*"gitleaks-worktree"[\s\S]*\],\s*historyScan:/u,
    );
    expect(wrapper).toContain("env: securityEnvironment");
    expect(environment).toContain("SECURITY_OVERRIDE_KEY");
    expect(environment).toContain("NPM_CONFIG_REGISTRY");
    expect(gitleaksConfig).toBe("[extend]\nuseDefault = true\n");
    expect(worktree).toContain("GIT_INDEX_FILE: temporaryIndex");
    expect(worktree).toContain('["rev-parse", "--git-path", "index"]');
    expect(worktree).toContain("copyFile(");
    expect(worktree).toContain("indexSnapshotRoot");
    expect(worktree).toContain("worktreeSnapshotRoot");
    expect(worktree).toContain("skip-worktree or assume-unchanged entries");
    expect(worktree).toContain(
      "symlink, gitlink, sparse-directory, or unmerged entries",
    );
    expect(worktree).toContain("env: securityEnvironment");
    expect(`${wrapper}\n${worktree}\n${environment}`).not.toMatch(
      /(?:baseline-path|\.gitleaksignore|osv-scanner\.toml)/i,
    );
  });

  it("keeps release build stages in their required order", () => {
    expectSourceOrder(read("tooling/build/run.mjs"), [
      'await rm("dist"',
      '"node_modules/@typescript/native/bin/tsc"',
      'await writeDeclarationManifest("dist");',
      '"tooling/configs/vite/viewer.ts"',
      '"tooling/configs/vite/sandbox.ts"',
      "await cp(legalPath",
      "await runProductionLegalValidation",
      'await verifyReleaseArtifact("dist");',
    ]);
  });

  it("keeps entrypoints thin", () => {
    for (const [file, maxLines] of THIN_ENTRYPOINTS) {
      expect(lineCount(file), file).toBeLessThanOrEqual(maxLines);
    }
  });

  it("keeps extracted app owner modules small unless explicitly legacy-named", () => {
    const oversized = walk(join(process.cwd(), "src/apps"))
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => !file.includes("/legacy-"))
      .filter((file) => !THIN_ENTRYPOINTS.has(file))
      .filter((file) => lineCount(file) > APP_OWNER_MAX_LINES);

    expect(oversized).toEqual([]);
  });

  it("does not let extracted viewer owners hard-code visible UI copy", () => {
    const offenders = walk(join(process.cwd(), "src/apps/viewer"))
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => DIRECT_UI_LITERAL.test(read(file)));

    expect(offenders).toEqual([]);
  });

  it("does not keep viewer compatibility owners after the app split", () => {
    const offenders = walk(join(process.cwd(), "src"))
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => read(file).includes("legacy-controller"));

    expect(offenders).toEqual([]);
  });

  it("does not keep sandbox compatibility owners after the runtime split", () => {
    const offenders = walk(join(process.cwd(), "src"))
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => read(file).includes("legacy-runtime"));

    expect(offenders).toEqual([]);
  });

  it("keeps external authoring runtime compatibility out of the sandbox", () => {
    const offenders = walk(join(process.cwd(), "src/apps/sandbox"))
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) =>
        SANDBOX_EXTERNAL_RUNTIME_COMPATIBILITY.filter((pattern) =>
          pattern.test(read(file)),
        ).map((pattern) => `${file}:${pattern.source}`),
      );

    expect(offenders).toEqual([]);
  });

  it("keeps retired compatibility owners and facade members deleted", () => {
    const sandboxFiles = walk(join(process.cwd(), "src/apps/sandbox"));
    const owners = sandboxFiles.filter((file) =>
      SANDBOX_EXTERNAL_RUNTIME_COMPATIBILITY_OWNERS.has(file),
    );
    const runtimeFacade = read("src/apps/sandbox/runtime/runtime-facade.ts");

    expect(owners).toEqual([]);
    expect(runtimeFacade).not.toMatch(
      SANDBOX_RUNTIME_FACADE_COMPATIBILITY_MEMBER,
    );
    expect("    ease,\n").toMatch(SANDBOX_RUNTIME_FACADE_COMPATIBILITY_MEMBER);
    expect("    lerp,\n").toMatch(SANDBOX_RUNTIME_FACADE_COMPATIBILITY_MEMBER);
    expect("    sequence(context, definition) {\n").toMatch(
      SANDBOX_RUNTIME_FACADE_COMPATIBILITY_MEMBER,
    );
  });

  it("does not hide type errors with broad global declarations", () => {
    const offenders = walk(join(process.cwd(), "src"))
      .filter((file) => /\.tsx?$/.test(file) || /\.d\.ts$/.test(file))
      .filter((file) => BROAD_GLOBAL_DECLARATION.test(read(file)));

    expect(offenders).toEqual([]);
  });

  it("keeps selectedItem as the sole primary selection authority", () => {
    const offenders = walk(join(process.cwd(), "src/apps/viewer"))
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => /\bstate\.selectedKeyframe\b/.test(read(file)));

    expect(offenders).toEqual([]);
  });

  it("does not leave unused local named imports in sandbox runtime owners", () => {
    const offenders = walk(join(process.cwd(), "src/apps/sandbox/runtime"))
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) =>
        collectUnusedLocalNamedImports(read(file)).map(
          (localName) => `${file}:${localName}`,
        ),
      );

    expect(offenders).toEqual([]);
  });

  it("keeps coverage wired into the full QA build", () => {
    const packageJson = JSON.parse(read("package.json"));
    const buildWrapper = read("tooling/qa/wrappers/build.mjs");

    expect(packageJson.scripts["qa:coverage"]).toBe(
      "node tooling/qa/wrappers/coverage.mjs",
    );
    expect(packageJson.scripts["test:coverage"]).toBe(
      "vitest run --coverage --config tooling/configs/qa/vitest.ts",
    );
    expect(collectNpmRunSteps(buildWrapper)).toEqual([
      ["typecheck", "typecheck"],
      ["unit tests", "test"],
      ["coverage", "qa:coverage"],
      ["local fixture build", "build:local"],
      ["browser smoke", "test:smoke"],
      ["release build", "build"],
    ]);
    expect(vitestConfig.test?.coverage?.include).toEqual([
      "src/**/*.{ts,tsx,mts,cts}",
    ]);
    expect(vitestConfig.test?.coverage?.exclude).toEqual([
      "src/**/*.d.{ts,mts,cts}",
    ]);
    expect(vitestConfig.test?.coverage?.reportsDirectory).toBe(
      ".tmp/qa/coverage",
    );
    expect(vitestConfig.test?.coverage?.thresholds).toBeUndefined();
  });

  it("keeps the browser smoke runner as a thin orchestrator", () => {
    const runner = read("tooling/test/smoke/run.mjs");

    expect(lineCount("tooling/test/smoke/run.mjs")).toBeLessThanOrEqual(
      SMOKE_ENTRYPOINT_MAX_LINES,
    );
    expect(runner).toContain('from "./runtime.mjs"');
    expect(runner).toContain(
      'from "../../../tests/smoke/scenarios/main-flow.mjs"',
    );
    expect(read("tooling/effect-v1/prove.ts")).toContain(
      'from "../test/smoke/runtime.mjs"',
    );
  });

  it("keeps browser smoke scenarios and helpers below owner size limits", () => {
    const oversized = [
      ...walk(join(process.cwd(), "tooling/test/smoke")),
      ...walk(join(process.cwd(), "tests/smoke")),
    ]
      .filter((file) => file.endsWith(".mjs"))
      .filter((file) => file !== "tooling/test/smoke/run.mjs")
      .filter((file) => lineCount(file) > SMOKE_MODULE_MAX_LINES);

    expect(oversized).toEqual([]);
  });
});

function read(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

function lineCount(file: string): number {
  return read(file).split("\n").length;
}

function collectNpmRunSteps(source: string): string[][] {
  return [
    ...source.matchAll(/await run\("([^"]+)", "npm", \["run", "([^"]+)"\]\);/g),
  ].map((match) => [match[1], match[2]]);
}

function expectSourceOrder(source: string, markers: string[]): void {
  let cursor = -1;
  for (const marker of markers) {
    const index = source.indexOf(marker, cursor + 1);
    expect(
      index,
      `missing or reordered build stage: ${marker}`,
    ).toBeGreaterThan(cursor);
    cursor = index;
  }
}

function collectUnusedLocalNamedImports(source: string): string[] {
  const unused: string[] = [];
  const namedImportPattern =
    /\bimport\s*\{([\s\S]*?)\}\s*from\s*["'](\.[^"']+)["'];/g;
  const searchableSource = source.replace(namedImportPattern, "");
  for (const match of source.matchAll(namedImportPattern)) {
    const specifier = match[2];
    if (!specifier.startsWith(".")) continue;
    for (const rawPart of match[1].split(",")) {
      const localName = rawPart
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (!localName || !/^[A-Za-z_$][\w$]*$/.test(localName)) continue;
      if (
        !new RegExp(`\\b${escapeRegExp(localName)}\\b`).test(searchableSource)
      ) {
        unused.push(localName);
      }
    }
  }
  return unused;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
