import { findCoercedValidationLookups } from "./validation-boundaries.ts";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { inspectRepositoryHygiene } from "./repository-hygiene.ts";
import { inspectRuntimeDependencyOwnership } from "./runtime-dependencies.ts";
import { inspectDependencyAdmission } from "../security/dependency-admission.ts";

const repoRoot = process.cwd();
const violations: string[] = [];
const warnings: string[] = [];
const importGraph = new Map<string, string[]>();
const sourceFiles = new Set<string>();
const THIN_ENTRYPOINTS = new Map([
  ["src/apps/viewer/main.ts", 100],
  ["src/apps/sandbox/runtime.ts", 100],
]);
const APP_OWNER_MAX_LINES = 600;
const SDK_OWNER_MAX_LINES = 1200;
const SMOKE_ENTRYPOINT_MAX_LINES = 150;
const SMOKE_MODULE_MAX_LINES = 1200;
const SANDBOX_FORBIDDEN_APIS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bWebTransport\b/,
  /\bnavigator\.sendBeacon\b/,
  /\bRTCPeerConnection\b/,
  /\bimportScripts\s*\(/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
  /\bchrome\./,
  /\bbrowser\./,
];
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
const DIRECT_UI_LITERAL =
  /(?:\.(?:textContent|innerText|title)\s*=\s*["'][^"']+["']|setAttribute\(\s*["']aria-label["']\s*,\s*["'][^"']+["']\s*\))/;
const BROAD_GLOBAL_DECLARATION =
  /interface\s+(?:Object|EventTarget)\s*\{[\s\S]*?\[[^\]]+\]\s*:\s*any\s*;/;

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    if ([".git", ".tmp", "node_modules", "dist"].includes(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
    } else {
      inspectFile(path);
    }
  }
}

function relative(path: string) {
  return path.slice(repoRoot.length + 1).replaceAll("\\", "/");
}

function inspectFile(path: string) {
  const file = relative(path);
  const isSourceTs = file.startsWith("src/") && /\.(?:[cm]?ts|tsx)$/.test(file);
  if (SANDBOX_EXTERNAL_RUNTIME_COMPATIBILITY_OWNERS.has(file)) {
    violations.push(
      `${file}: retired external runtime compatibility owner must not return`,
    );
  }
  if (
    /(?:^|\/)[^/]*(?:harness|wrapper)[^/]*$/i.test(file) &&
    !file.startsWith("tooling/")
  ) {
    violations.push(
      `${file}: harness and wrapper owners must live under tooling/`,
    );
  }
  if (file.startsWith("scripts/")) {
    violations.push(`${file}: repository commands must live under tooling/`);
  }
  if (file.startsWith("src/") && /\.(?:[cm]?js|jsx)$/.test(file)) {
    violations.push(
      `${file}: product source must be TypeScript after migration`,
    );
  }
  if (
    file.startsWith("tests/smoke/") &&
    !file.startsWith("tests/smoke/scenarios/")
  ) {
    violations.push(
      `${file}: smoke harness implementation must live under tooling/test/smoke/`,
    );
  }
  if (
    (file.startsWith("tooling/test/smoke/") ||
      file.startsWith("tests/smoke/scenarios/")) &&
    file.endsWith(".ts")
  ) {
    const source = readFileSync(path, "utf8");
    const lines = source.split("\n").length;
    if (file === "tooling/test/smoke/run.ts") {
      if (lines > SMOKE_ENTRYPOINT_MAX_LINES) {
        violations.push(
          `${file}: smoke entrypoint must stay thin (${lines}/${SMOKE_ENTRYPOINT_MAX_LINES} lines)`,
        );
      }
      if (
        !source.includes('from "./runtime.ts"') ||
        !source.includes('from "../../../tests/smoke/scenarios/main-flow.ts"')
      ) {
        violations.push(
          `${file}: smoke entrypoint must delegate to runtime and scenario orchestrator`,
        );
      }
    } else if (lines > SMOKE_MODULE_MAX_LINES) {
      violations.push(
        `${file}: smoke module is oversized (${lines}/${SMOKE_MODULE_MAX_LINES} lines); split scenario/helper ownership before adding coverage`,
      );
    }
  }
  if (isSourceTs) {
    const source = readFileSync(path, "utf8");
    const lines = source.split("\n").length;
    violations.push(...findCoercedValidationLookups(file, source));
    sourceFiles.add(file);
    importGraph.set(file, collectRelativeImports(file, source));
    if (source.includes("@ts-nocheck") || source.includes("@ts-ignore")) {
      violations.push(
        `${file}: TypeScript suppression directives are not allowed`,
      );
    }
    if (BROAD_GLOBAL_DECLARATION.test(source)) {
      violations.push(
        `${file}: broad global Object/EventTarget index signatures hide type errors`,
      );
    }
    const entrypointLimit = THIN_ENTRYPOINTS.get(file);
    if (entrypointLimit !== undefined && lines > entrypointLimit) {
      violations.push(
        `${file}: entrypoint must stay thin (${lines}/${THIN_ENTRYPOINTS.get(file)} lines)`,
      );
    }
    if (
      (file.startsWith("src/apps/viewer/") ||
        file.startsWith("src/apps/sandbox/")) &&
      !file.includes("/legacy-") &&
      !THIN_ENTRYPOINTS.has(file) &&
      lines > APP_OWNER_MAX_LINES
    ) {
      violations.push(
        `${file}: app owner module is oversized (${lines}/${APP_OWNER_MAX_LINES} lines); split ownership before adding behavior`,
      );
    }
    if (file.startsWith("src/sdk/") && lines > SDK_OWNER_MAX_LINES) {
      violations.push(
        `${file}: SDK owner module is oversized (${lines}/${SDK_OWNER_MAX_LINES} lines); split public contracts/helpers`,
      );
    }
    if (file.startsWith("src/apps/viewer/") && DIRECT_UI_LITERAL.test(source)) {
      violations.push(
        `${file}: adopted viewer owner has hard-coded UI copy; use shared i18n t()/translateText()`,
      );
    }
    if (source.includes("legacy-controller")) {
      violations.push(`${file}: viewer compatibility owner has been removed`);
    }
    if (source.includes("legacy-runtime")) {
      violations.push(`${file}: sandbox compatibility owner has been removed`);
    }
    if (file.startsWith("src/apps/sandbox/")) {
      for (const pattern of SANDBOX_FORBIDDEN_APIS) {
        if (pattern.test(source)) {
          violations.push(
            `${file}: forbidden sandbox/browser API matched ${pattern.source}`,
          );
        }
      }
      for (const pattern of SANDBOX_EXTERNAL_RUNTIME_COMPATIBILITY) {
        if (pattern.test(source)) {
          violations.push(
            `${file}: external runtime compatibility token matched ${pattern.source}; Effect v1 owns the declarative sandbox contract`,
          );
        }
      }
    }
    if (file.startsWith("src/apps/sandbox/runtime/")) {
      for (const localName of collectUnusedLocalNamedImports(source)) {
        violations.push(
          `${file}: unused local named import "${localName}" in sandbox runtime owner`,
        );
      }
    }
    if (
      file === "src/apps/sandbox/runtime/runtime-facade.ts" &&
      SANDBOX_RUNTIME_FACADE_COMPATIBILITY_MEMBER.test(source)
    ) {
      violations.push(
        `${file}: external runtime compatibility member returned to the sandbox facade`,
      );
    }
    if (file.includes("/legacy-") && lines > 2000) {
      warnings.push(
        `${file}: compatibility owner is still large (${lines} lines); keep extracting instead of adding behavior here`,
      );
    }
  }
}

walk(repoRoot);
detectImportCycles();
violations.push(...inspectRepositoryHygiene(repoRoot));
violations.push(...inspectRuntimeDependencyOwnership(repoRoot));
violations.push(...inspectDependencyAdmission(repoRoot));

if (violations.length > 0) {
  console.error("Guardrail violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("Guardrail warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log("Guardrails passed");

function collectRelativeImports(file: string, source: string) {
  const imports = [];
  const importPattern =
    /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier?.startsWith(".")) continue;
    imports.push(resolveSourceImport(file, specifier));
  }
  return imports.flat().filter(Boolean);
}

function collectUnusedLocalNamedImports(source: string) {
  const unused = [];
  const namedImportPattern =
    /\bimport\s*\{([\s\S]*?)\}\s*from\s*["'](\.[^"']+)["'];/g;
  const searchableSource = source.replace(namedImportPattern, "");
  for (const match of source.matchAll(namedImportPattern)) {
    const specifier = match[2];
    if (!specifier?.startsWith(".")) continue;
    for (const rawPart of (match[1] ?? "").split(",")) {
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveSourceImport(file: string, specifier: string) {
  const directory = file.split("/").slice(0, -1).join("/");
  const raw = normalizePath(join(directory, specifier));
  if (raw.endsWith(".js"))
    return [raw.replace(/\.js$/, ".ts"), raw.replace(/\.js$/, ".tsx")];
  if (raw.endsWith(".mjs")) return [raw.replace(/\.mjs$/, ".mts")];
  if (raw.endsWith(".cjs")) return [raw.replace(/\.cjs$/, ".cts")];
  return [
    `${raw}.ts`,
    `${raw}.tsx`,
    `${raw}.mts`,
    `${raw}.cts`,
    `${raw}/index.ts`,
    `${raw}/index.tsx`,
    `${raw}/index.mts`,
    `${raw}/index.cts`,
  ];
}

function detectImportCycles() {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const reported = new Set<string>();

  function visit(file: string) {
    if (visited.has(file)) return;
    if (visiting.has(file)) {
      const start = stack.indexOf(file);
      const cycle = [...stack.slice(start), file];
      const key = cycle.join(" -> ");
      if (!reported.has(key)) {
        reported.add(key);
        violations.push(`${key}: import cycle detected`);
      }
      return;
    }
    visiting.add(file);
    stack.push(file);
    for (const dependency of importGraph.get(file) ?? []) {
      if (!sourceFiles.has(dependency)) continue;
      visit(dependency);
    }
    stack.pop();
    visiting.delete(file);
    visited.add(file);
  }

  for (const file of importGraph.keys()) {
    visit(file);
  }
}

function normalizePath(path: string) {
  const parts = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}
