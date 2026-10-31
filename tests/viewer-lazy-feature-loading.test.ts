import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("viewer lazy feature loading", () => {
  it("keeps graph and export implementations outside the static startup graph", () => {
    const modules = staticModules(resolve("src/apps/viewer/app/bootstrap.ts"));
    for (const owner of [
      "src/apps/viewer/app/create-context.ts",
      "src/apps/viewer/canvas/transform-drag.ts",
      "src/apps/viewer/inspector/layer-content-fields.ts",
    ])
      expect(modules.has(resolve(owner))).toBe(true);
    for (const owner of [
      "src/apps/viewer/graph-editor/actions.ts",
      "src/apps/viewer/graph-editor/controller.ts",
      "src/apps/viewer/graph-editor/view.ts",
      "src/apps/viewer/video-export/controller.ts",
    ])
      expect(modules.has(resolve(owner))).toBe(false);
    // The full repository AST walk also runs with coverage instrumentation.
  }, 15_000);
  it("detects transitive runtime imports and excludes explicit type and dynamic imports", () => {
    const root = resolve(".tmp/static-import-proof");
    const sources = new Map([
      [
        resolve(root, "entry.ts"),
        'import "./runtime.js"; import type { Model } from "./types.js"; import { type Other } from "./other-types.js"; export { type Exported } from "./exported-types.js"; void import("./deferred.js");',
      ],
      [resolve(root, "runtime.ts"), 'export { value } from "./nested.js";'],
      [resolve(root, "nested.ts"), "export const value = 1;"],
    ]);
    const modules = staticModules(resolve(root, "entry.ts"), (file) => {
      const source = sources.get(file);
      if (source === undefined)
        throw new Error("Unexpected runtime dependency: " + file);
      return source;
    });
    expect([...modules].sort()).toEqual([...sources.keys()].sort());
  });
});

function staticModules(
  entry: string,
  readSource: (file: string) => string = (file) => readFileSync(file, "utf8"),
): Set<string> {
  const modules = new Set<string>();
  const visit = (file: string): void => {
    if (modules.has(file)) return;
    modules.add(file);
    const source = ts.createSourceFile(
      file,
      readSource(file),
      ts.ScriptTarget.Latest,
      false,
    );
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
        continue;
      if (
        (ts.isExportDeclaration(node) && node.isTypeOnly) ||
        !node.moduleSpecifier ||
        !ts.isStringLiteral(node.moduleSpecifier)
      )
        continue;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.isTypeOnly) continue;
        if (
          !clause?.name &&
          clause?.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every(
            (specifier) => specifier.isTypeOnly,
          )
        )
          continue;
      }
      if (
        ts.isExportDeclaration(node) &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.length > 0 &&
        node.exportClause.elements.every((specifier) => specifier.isTypeOnly)
      )
        continue;
      const name = node.moduleSpecifier.text;
      if (name.startsWith(".") && /\.[jt]s$/.test(name))
        visit(resolve(dirname(file), name.replace(/\.js$/, ".ts")));
    }
  };
  visit(entry);
  return modules;
}
