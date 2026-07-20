import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  collectBarePackageImports,
  findRuntimeDependencyViolations,
  inspectRuntimeDependencyOwnership,
} from "./runtime-dependencies.mjs";

describe("runtime dependency ownership", () => {
  it("extracts package roots from static, dynamic, CommonJS, and type imports", () => {
    expect(
      collectBarePackageImports(
        "src/owner.ts",
        [
          'import value from "one/subpath";',
          'export type { Model } from "@scope/two/model";',
          'const lazy = import("three/runtime");',
          'const legacy = require("four");',
          'const resolved = require.resolve("six/subpath");',
          'const commonJs = module.require("seven");',
          'type External = typeof import("five/types");',
          'import local from "./local.js";',
          'import fs from "node:fs";',
        ].join("\n"),
      ),
    ).toEqual(["@scope/two", "five", "four", "one", "seven", "six", "three"]);
  });

  it("rejects dev-only package imports and accepts dependencies and required peers", () => {
    const manifest = {
      dependencies: { runtime: "1.0.0" },
      devDependencies: { buildOnly: "1.0.0" },
      optionalDependencies: {
        hybridOptionalPeer: "1.0.0",
        optionalRuntime: "1.0.0",
      },
      peerDependencies: {
        hybridOptionalPeer: "1.0.0",
        peer: "1.0.0",
        optionalPeer: "1.0.0",
      },
      peerDependenciesMeta: { optionalPeer: { optional: true } },
    };
    const sources = [
      {
        file: "src/owner.ts",
        source: [
          'import "runtime";',
          'import "peer";',
          'import "buildOnly";',
          'import "hybridOptionalPeer";',
          'import "optionalPeer";',
          'import "optionalRuntime";',
        ].join("\n"),
      },
    ];

    expect(findRuntimeDependencyViolations(manifest, sources)).toEqual([
      "src/owner.ts: bare import buildOnly must be declared in dependencies or as a required peer",
      "src/owner.ts: bare import hybridOptionalPeer must be declared in dependencies or as a required peer",
      "src/owner.ts: bare import optionalPeer must be declared in dependencies or as a required peer",
      "src/owner.ts: bare import optionalRuntime must be declared in dependencies or as a required peer",
    ]);
  });

  it("rejects non-literal dynamic imports that cannot be attributed", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: [
            "const packageName = getPackage();",
            "await import(packageName);",
            "module.require(packageName);",
            "require.resolve(packageName);",
          ].join("\n"),
        },
      ]),
    ).toEqual([
      "src/owner.ts:2: dynamic import specifier must be a string literal",
      "src/owner.ts:3: CommonJS require is forbidden in ESM product source",
      "src/owner.ts:4: CommonJS require is forbidden in ESM product source",
    ]);
  });

  it("rejects CommonJS aliases, call forms, and import.meta.resolve", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: [
            "const load = require;",
            'load("build-only");',
            'require.call(null, "build-only");',
            'module["require"]("build-only");',
            'import.meta.resolve("build-only");',
          ].join("\n"),
        },
      ]),
    ).toEqual([
      "src/owner.ts: bare import build-only must be declared in dependencies or as a required peer",
      "src/owner.ts:1: CommonJS require is forbidden in ESM product source",
      "src/owner.ts:3: CommonJS require is forbidden in ESM product source",
      "src/owner.ts:4: CommonJS require is forbidden in ESM product source",
      "src/owner.ts:5: import.meta.resolve is forbidden because its dependency cannot be attributed statically",
    ]);
  });

  it("accepts mapped local package imports and rejects absent or external mappings", () => {
    expect(
      findRuntimeDependencyViolations(
        {
          dependencies: {},
          imports: {
            "#local": "./src/local.ts",
            "#features/*": { default: "./src/features/*.ts" },
            "#external": "build-only",
          },
        },
        [
          {
            file: "src/owner.ts",
            source: [
              'import "#local";',
              'import "#features/one";',
              'import "#missing";',
              'import "#external";',
            ].join("\n"),
          },
        ],
      ),
    ).toEqual([
      "src/owner.ts: package import #external must resolve through package.json#imports to a local ./src/ target",
      "src/owner.ts: package import #missing must resolve through package.json#imports to a local ./src/ target",
    ]);
  });

  it("rejects relative and package-import targets that escape product source", () => {
    expect(
      findRuntimeDependencyViolations(
        {
          dependencies: {},
          imports: { "#helper": "./tooling/helper.ts" },
        },
        [
          {
            file: "src/owner.ts",
            source: 'import "../tooling/helper"; import "#helper";',
          },
        ],
      ),
    ).toEqual([
      "src/owner.ts: local import ../tooling/helper must remain inside src",
      "src/owner.ts: package import #helper must resolve through package.json#imports to a local ./src/ target",
    ]);
  });

  it("rejects createRequire through canonical and aliased node:module imports", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: [
            'import { createRequire } from "node:module";',
            'import { createRequire as makeLoader } from "node:module";',
            "const load = createRequire(import.meta.url);",
            "const aliasedLoad = makeLoader(import.meta.url);",
            'load("dev-only");',
            'aliasedLoad("dev-only");',
          ].join("\n"),
        },
      ]),
    ).toEqual([
      "src/owner.ts:1: node:module loading is forbidden in browser product source",
      "src/owner.ts:2: node:module loading is forbidden in browser product source",
    ]);
  });

  it("does not confuse ordinary property names with CommonJS loading", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: [
            "interface Context { require: boolean }",
            "const context: Context = { require: true };",
            "context.require = false;",
          ].join("\n"),
        },
      ]),
    ).toEqual([]);
  });

  it("does not confuse local require bindings with CommonJS loading", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: [
            'import { require } from "./capability";',
            "const { require: destructuredRequire } = context;",
            'function local(require: (value: string) => void) { require("feature"); }',
            'require("feature");',
            'destructuredRequire("feature");',
          ].join("\n"),
        },
      ]),
    ).toEqual([]);
  });

  it("keeps CommonJS detection active outside a nested local require scope", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: [
            "function local() {",
            "  const require = (value: string) => value;",
            '  require("local-feature");',
            "}",
            'require("dev-only");',
          ].join("\n"),
        },
      ]),
    ).toEqual([
      "src/owner.ts: bare import dev-only must be declared in dependencies or as a required peer",
      "src/owner.ts:5: CommonJS require is forbidden in ESM product source",
    ]);
  });

  it("accepts aliased require properties and local require classes", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: [
            'import { require as localRequire } from "./capability";',
            "const { require: destructuredRequire } = context;",
            'localRequire("feature");',
            'destructuredRequire("feature");',
            "{ class require {}; new require(); }",
          ].join("\n"),
        },
      ]),
    ).toEqual([]);
  });

  it("rejects backslash relative imports that escape product source", () => {
    expect(
      findRuntimeDependencyViolations({ dependencies: {} }, [
        {
          file: "src/owner.ts",
          source: 'import "..\\\\tooling\\\\helper";',
        },
      ]),
    ).toEqual([
      "src/owner.ts: local import ..\\tooling\\helper must remain inside src",
    ]);
  });

  it("rejects symlinks under product source instead of skipping them", () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-runtime-dependencies-"));
    try {
      mkdirSync(join(root, "src"));
      writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
      writeFileSync(join(root, "target.ts"), "export {};\n");
      symlinkSync(join(root, "target.ts"), join(root, "src", "linked.ts"));

      expect(inspectRuntimeDependencyOwnership(root)).toEqual([
        "src/linked.ts: symbolic links and special filesystem entries are forbidden under src",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
