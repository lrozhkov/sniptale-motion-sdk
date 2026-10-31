import { readFileSync, readdirSync } from "node:fs";
import { join, posix, relative } from "node:path";
import ts from "typescript";

export function inspectRuntimeDependencyOwnership(root = process.cwd()) {
  const manifest: unknown = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  const collection = collectTypeScriptSources(join(root, "src"), root);
  const sources = collection.files.map((file) => ({
    file: relative(root, file).replaceAll("\\", "/"),
    source: readFileSync(file, "utf8"),
  }));
  return [
    ...collection.violations,
    ...findRuntimeDependencyViolations(manifest, sources),
  ]
    .filter((violation, index, all) => all.indexOf(violation) === index)
    .sort(codePointOrder);
}

interface RuntimeSource {
  file: string;
  source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function manifestRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function dependencyNames(
  manifest: Record<string, unknown>,
  field: string,
): string[] {
  const value = manifest[field];
  if (value === undefined) return [];
  const record = manifestRecord(value, `package.json#${field}`);
  for (const [name, version] of Object.entries(record)) {
    if (typeof version !== "string") {
      throw new Error(`package.json#${field}.${name} must be a string`);
    }
  }
  return Object.keys(record);
}

export function findRuntimeDependencyViolations(
  input: unknown,
  sources: readonly RuntimeSource[],
) {
  const manifest = manifestRecord(input, "package.json");
  const peerMeta =
    manifest.peerDependenciesMeta === undefined
      ? {}
      : manifestRecord(
          manifest.peerDependenciesMeta,
          "package.json#peerDependenciesMeta",
        );
  for (const [name, value] of Object.entries(peerMeta)) {
    const entry = manifestRecord(
      value,
      `package.json#peerDependenciesMeta.${name}`,
    );
    if (entry.optional !== undefined && typeof entry.optional !== "boolean") {
      throw new Error(
        `package.json#peerDependenciesMeta.${name}.optional must be a boolean`,
      );
    }
  }
  const optionalPackages = new Set(
    dependencyNames(manifest, "optionalDependencies"),
  );
  const productionPackages = new Set(
    dependencyNames(manifest, "dependencies").filter(
      (packageName) => !optionalPackages.has(packageName),
    ),
  );
  for (const packageName of dependencyNames(manifest, "peerDependencies")) {
    if (
      !optionalPackages.has(packageName) &&
      !(
        isRecord(peerMeta[packageName]) &&
        peerMeta[packageName].optional === true
      )
    ) {
      productionPackages.add(packageName);
    }
  }

  const violations: string[] = [];
  for (const { file, source } of sources) {
    const analysis = analyzeModuleImports(file, source);
    for (const line of analysis.unresolvedDynamicLines) {
      violations.push(
        `${file}:${line}: dynamic import specifier must be a string literal`,
      );
    }
    for (const line of analysis.commonJsLines) {
      violations.push(
        `${file}:${line}: CommonJS require is forbidden in ESM product source`,
      );
    }
    for (const line of analysis.importMetaResolveLines) {
      violations.push(
        `${file}:${line}: import.meta.resolve is forbidden because its dependency cannot be attributed statically`,
      );
    }
    for (const line of analysis.nodeModuleLines) {
      violations.push(
        `${file}:${line}: node:module loading is forbidden in browser product source`,
      );
    }
    for (const specifier of analysis.localSpecifiers) {
      if (!staysInsideProductSource(file, specifier)) {
        violations.push(
          `${file}: local import ${specifier} must remain inside src`,
        );
      }
    }
    for (const packageName of analysis.barePackages) {
      if (!productionPackages.has(packageName)) {
        violations.push(
          `${file}: bare import ${packageName} must be declared in dependencies or as a required peer`,
        );
      }
    }
    for (const packageImport of analysis.packageImports) {
      if (!hasSafeLocalPackageImport(manifest.imports, packageImport)) {
        violations.push(
          `${file}: package import ${packageImport} must resolve through package.json#imports to a local ./src/ target`,
        );
      }
    }
  }
  return [...new Set(violations)].sort(codePointOrder);
}

export function collectBarePackageImports(file: string, source: string) {
  return analyzeModuleImports(file, source).barePackages;
}

function analyzeModuleImports(file: string, source: string) {
  const scriptKind = file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const document = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const isLocalRequire = createLocalRequireResolver(document);
  const packages = new Set<string>();
  const packageImports = new Set<string>();
  const localSpecifiers = new Set<string>();
  const unresolvedDynamicLines = new Set<number>();
  const commonJsLines = new Set<number>();
  const importMetaResolveLines = new Set<number>();
  const nodeModuleLines = new Set<number>();

  function lineOf(node: ts.Node) {
    return (
      document.getLineAndCharacterOfPosition(node.getStart(document)).line + 1
    );
  }

  function collect(specifier: string, node: ts.Node) {
    if (!specifier) {
      return;
    }
    if (specifier === "node:module" || specifier === "module") {
      nodeModuleLines.add(lineOf(node));
      return;
    }
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      localSpecifiers.add(specifier);
      return;
    }
    if (specifier.startsWith("node:")) return;
    if (specifier.startsWith("#")) {
      packageImports.add(specifier);
      return;
    }
    const parts = specifier.split("/");
    const packageName = specifier.startsWith("@")
      ? parts.slice(0, 2).join("/")
      : parts[0];
    if (packageName) packages.add(packageName);
  }

  function visit(node: ts.Node) {
    if (
      ts.isIdentifier(node) &&
      node.text === "require" &&
      !isLocalRequire(node) &&
      isRequireIdentifierUse(node)
    ) {
      commonJsLines.add(lineOf(node));
    }
    if (isModulePropertyRequire(node)) {
      commonJsLines.add(lineOf(node));
    }
    if (isImportMetaResolve(node)) {
      importMetaResolveLines.add(lineOf(node));
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      collect(node.moduleSpecifier.text, node);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      collect(node.moduleReference.expression.text, node);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        collect(node.arguments[0].text, node);
      } else {
        unresolvedDynamicLines.add(lineOf(node));
      }
    } else if (
      ts.isCallExpression(node) &&
      isRequireLikeExpression(node.expression, isLocalRequire) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      collect(node.arguments[0].text, node);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      collect(node.argument.literal.text, node);
    }
    ts.forEachChild(node, visit);
  }

  visit(document);
  return {
    barePackages: [...packages].sort(codePointOrder),
    packageImports: [...packageImports].sort(codePointOrder),
    localSpecifiers: [...localSpecifiers].sort(codePointOrder),
    unresolvedDynamicLines: [...unresolvedDynamicLines].sort(
      (left, right) => left - right,
    ),
    commonJsLines: [...commonJsLines].sort((left, right) => left - right),
    importMetaResolveLines: [...importMetaResolveLines].sort(
      (left, right) => left - right,
    ),
    nodeModuleLines: [...nodeModuleLines].sort((left, right) => left - right),
  };
}

function collectTypeScriptSources(
  directory: string,
  root: string,
): { files: string[]; violations: string[] } {
  const files: string[] = [];
  const violations: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => codePointOrder(left.name, right.name),
  )) {
    const path = join(directory, entry.name);
    const repoPath = relative(root, path).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      const nested = collectTypeScriptSources(path, root);
      files.push(...nested.files);
      violations.push(...nested.violations);
    } else if (entry.isFile() && /\.(?:[cm]?ts|tsx)$/u.test(entry.name)) {
      files.push(path);
    } else if (
      entry.isSymbolicLink() ||
      (!entry.isFile() && !entry.isDirectory())
    ) {
      violations.push(
        `${repoPath}: symbolic links and special filesystem entries are forbidden under src`,
      );
    }
  }
  return { files, violations };
}

function isRequireLikeExpression(
  expression: ts.Expression,
  isLocalRequire: (identifier: ts.Identifier) => boolean = () => false,
) {
  if (ts.isIdentifier(expression)) {
    return expression.text === "require" && !isLocalRequire(expression);
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return (
      (ts.isIdentifier(expression.expression) &&
        expression.expression.text === "module" &&
        expression.name.text === "require") ||
      (ts.isIdentifier(expression.expression) &&
        expression.expression.text === "require" &&
        !isLocalRequire(expression.expression))
    );
  }
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.argumentExpression &&
    ts.isStringLiteralLike(expression.argumentExpression)
  ) {
    return (
      (expression.expression.text === "module" &&
        expression.argumentExpression.text === "require") ||
      (expression.expression.text === "require" &&
        !isLocalRequire(expression.expression))
    );
  }
  return false;
}

function createLocalRequireResolver(document: ts.SourceFile) {
  const bindingScopes = new Set<ts.Node | null>();

  function bindingContainsRequire(name: ts.BindingName): boolean {
    if (ts.isIdentifier(name)) return name.text === "require";
    return name.elements.some(
      (element) =>
        ts.isBindingElement(element) && bindingContainsRequire(element.name),
    );
  }

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && bindingContainsRequire(node.name)) {
      const declarationList = node.parent;
      const isBlockScoped =
        ts.isVariableDeclarationList(declarationList) &&
        (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0;
      bindingScopes.add(
        isBlockScoped
          ? nearestLexicalScope(node.parent)
          : nearestFunctionScope(node.parent),
      );
    } else if (ts.isParameter(node) && bindingContainsRequire(node.name)) {
      bindingScopes.add(nearestFunctionScope(node.parent));
    } else if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "require"
    ) {
      bindingScopes.add(nearestLexicalScope(node.parent));
    } else if (ts.isFunctionExpression(node) && node.name?.text === "require") {
      bindingScopes.add(node);
    } else if (ts.isClassDeclaration(node) && node.name?.text === "require") {
      bindingScopes.add(nearestLexicalScope(node.parent));
    } else if (ts.isClassExpression(node) && node.name?.text === "require") {
      bindingScopes.add(node);
    } else if (
      (ts.isImportClause(node) && node.name?.text === "require") ||
      (ts.isImportSpecifier(node) && node.name.text === "require") ||
      (ts.isNamespaceImport(node) && node.name.text === "require") ||
      (ts.isImportEqualsDeclaration(node) && node.name.text === "require")
    ) {
      bindingScopes.add(document);
    } else if (
      ts.isCatchClause(node) &&
      node.variableDeclaration &&
      bindingContainsRequire(node.variableDeclaration.name)
    ) {
      bindingScopes.add(node.block);
    }
    ts.forEachChild(node, visit);
  }
  visit(document);

  return (identifier: ts.Identifier) => {
    for (let current = identifier.parent; current; current = current.parent) {
      if (bindingScopes.has(current)) return true;
    }
    return false;
  };
}

function nearestLexicalScope(node: ts.Node): ts.Node | null {
  for (let current = node; current; current = current.parent) {
    if (
      ts.isBlock(current) ||
      ts.isSourceFile(current) ||
      ts.isCaseBlock(current) ||
      ts.isFunctionLike(current)
    ) {
      return current;
    }
  }
  return null;
}

function nearestFunctionScope(node: ts.Node): ts.Node | null {
  for (let current = node; current; current = current.parent) {
    if (ts.isSourceFile(current) || ts.isFunctionLike(current)) return current;
  }
  return null;
}

function isModulePropertyRequire(node: ts.Node): boolean {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "module" &&
    node.name.text === "require"
  ) {
    return true;
  }
  return (
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "module" &&
    node.argumentExpression !== undefined &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === "require"
  );
}

function isRequireIdentifierUse(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return true;
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent)) &&
    parent.name === node
  ) {
    return false;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return (
      ts.isIdentifier(parent.expression) && parent.expression.text === "module"
    );
  }
  if (
    (ts.isBindingElement(parent) || ts.isImportSpecifier(parent)) &&
    parent.propertyName === node
  ) {
    return false;
  }
  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isImportSpecifier(parent) ||
      ts.isBindingElement(parent)) &&
    parent.name === node
  ) {
    return false;
  }
  return true;
}

function isImportMetaResolve(node: ts.Node): boolean {
  if (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "resolve" &&
    ts.isMetaProperty(node.expression)
  ) {
    return node.expression.keywordToken === ts.SyntaxKind.ImportKeyword;
  }
  return (
    ts.isElementAccessExpression(node) &&
    ts.isMetaProperty(node.expression) &&
    node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    node.argumentExpression !== undefined &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === "resolve"
  );
}

function hasSafeLocalPackageImport(
  imports: unknown,
  specifier: string,
): boolean {
  if (!isRecord(imports)) {
    return false;
  }
  if (Object.hasOwn(imports, specifier)) {
    return isSafeLocalImportTarget(imports[specifier], "");
  }
  const matches = Object.keys(imports)
    .filter((key) => key.startsWith("#") && key.includes("*"))
    .map((key) => {
      const [prefix = "", suffix = ""] = key.split("*");
      if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
        return null;
      }
      return {
        key,
        match: specifier.slice(prefix.length, specifier.length - suffix.length),
      };
    })
    .filter((match) => match !== null)
    .sort((left, right) => right.key.length - left.key.length)[0];
  return matches
    ? isSafeLocalImportTarget(imports[matches.key], matches.match)
    : false;
}

function isSafeLocalImportTarget(target: unknown, wildcard: string): boolean {
  if (typeof target === "string") {
    const resolved = target.replaceAll("*", wildcard);
    return (
      resolved.startsWith("./src/") &&
      !resolved
        .slice(2)
        .split("/")
        .some((segment) => segment === "..") &&
      !resolved.includes("\\")
    );
  }
  if (Array.isArray(target)) {
    return (
      target.length > 0 &&
      target.every((item) => isSafeLocalImportTarget(item, wildcard))
    );
  }
  if (target && typeof target === "object") {
    const values = Object.values(target);
    return (
      values.length > 0 &&
      values.every((item) => isSafeLocalImportTarget(item, wildcard))
    );
  }
  return false;
}

function staysInsideProductSource(file: string, specifier: string) {
  if (specifier.startsWith("/")) return false;
  if (specifier.includes("\\")) return false;
  const cleanSpecifier = specifier.split(/[?#]/u)[0] ?? "";
  const resolved = posix.normalize(
    posix.join(posix.dirname(file.replaceAll("\\", "/")), cleanSpecifier),
  );
  return resolved === "src" || resolved.startsWith("src/");
}

function codePointOrder(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
