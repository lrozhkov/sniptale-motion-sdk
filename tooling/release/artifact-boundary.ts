import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, posix, relative, resolve, sep } from "node:path";
import { transform } from "esbuild";
import ts from "typescript";

type DeclarationEntry = {
  declaration: string;
  declarationSha256: string;
  map: string;
  mapSha256: string;
  source: string;
  sourceSha256: string;
};
type GeneratedAsset = { path: string; name: string };

const FORBIDDEN_PATH_SEGMENTS = new Set([
  ".backup",
  ".cache",
  ".git",
  ".output",
  ".playwright-browsers",
  ".tmp",
  ".vite",
  "__tests__",
  "build",
  "coverage",
  "dist",
  "fixtures",
  "node_modules",
  "packs",
  "reference",
  "sample-scene.d.ts",
  "sample-scene.d.ts.map",
  "templates",
  "test",
  "test-output",
  "tests",
]);

const FORBIDDEN_TOP_LEVEL_SEGMENTS = new Set(["assets"]);

const FORBIDDEN_TEXT_MARKERS = [
  "./packs/demo/",
  "effectsViewer",
  "neutral-contract-fixtures",
  "sniptale-gallery-",
  "setPreviewRenderCostForTest",
  "triggerSandboxTimeoutForTest",
];

const REQUIRED_LEGAL_PATHS = new Set([
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_DEPENDENCIES.json",
  "THIRD_PARTY_NOTICES.md",
]);

const REQUIRED_PRODUCT_PATHS = new Set([
  "apps/sandbox/sandbox.html",
  "apps/viewer/index.html",
  "sdk/declaration-manifest.json",
  "sdk/index.d.ts",
  "sdk/index.d.ts.map",
]);

const DECLARATION_MANIFEST_PATH = "sdk/declaration-manifest.json";
const RETIRED_ARTIFACT_PRODUCT_IDENTITIES = [
  ["screen", "yx"].join(""),
  ["smart", "capture"].join(""),
  ["n", "s", "m", "p"].join(""),
];
const RETIRED_ARTIFACT_SHORT_IDENTITY = ["s", "c", "x"].join("");
const RETIRED_ARTIFACT_EFFECT_PATTERN = new RegExp(
  ["effect", "(?:[-_. ]?v)", "4"].join(""),
  "iu",
);
const RETIRED_ARTIFACT_SHORT_PATTERN = new RegExp(
  [
    "(?<![A-Za-z0-9])",
    ...RETIRED_ARTIFACT_SHORT_IDENTITY.split("").map(
      (character) => `[${character}${character.toUpperCase()}]`,
    ),
    "(?=$|[^A-Za-z0-9]|[A-Z])",
  ].join(""),
  "u",
);

export async function writeDeclarationManifest(
  rootDirectory: string,
  repositoryRoot = process.cwd(),
) {
  const root = resolve(rootDirectory);
  const sdkRoot = resolve(root, "sdk");
  const files = await collectFiles(sdkRoot);
  const declarations = files
    .map((file) => relative(root, file).split(sep).join("/"))
    .filter((path) => path.endsWith(".d.ts"))
    .sort(codePointOrder);
  const entries: DeclarationEntry[] = [];
  for (const declaration of declarations) {
    const map = `${declaration}.map`;
    const mapModel: unknown = JSON.parse(
      await readFile(resolve(root, map), "utf8"),
    );
    const source = expectedDeclarationSource(declaration);
    const mapSource = readSingleMapSource(mapModel);
    if (mapSource === null || normalizeMapSource(map, mapSource) !== source)
      throw new Error(`${map}: declaration map does not identify ${source}`);
    const declarationBytes = await readFile(resolve(root, declaration));
    const mapBytes = await readFile(resolve(root, map));
    const sourceBytes = await readFile(resolve(repositoryRoot, source));
    entries.push({
      declaration,
      declarationSha256: sha256(declarationBytes),
      map,
      mapSha256: sha256(mapBytes),
      source,
      sourceSha256: sha256(sourceBytes),
    });
  }
  const model = { schemaVersion: "sniptale.declarations.v1", files: entries };
  await writeFile(
    resolve(root, DECLARATION_MANIFEST_PATH),
    `${JSON.stringify(model, null, 2)}\n`,
  );
  return model;
}

export async function verifyReleaseArtifact(rootDirectory: string) {
  const root = resolve(rootDirectory);
  const files = await collectFiles(root);
  const violations: string[] = [];
  const sources = new Map<string, string>();
  const artifactPaths = new Set(
    files.map((file) => relative(root, file).split(sep).join("/")),
  );
  for (const requiredPath of REQUIRED_LEGAL_PATHS) {
    if (!artifactPaths.has(requiredPath)) {
      violations.push(
        `${requiredPath}: required release legal file is missing`,
      );
    }
  }
  for (const requiredPath of REQUIRED_PRODUCT_PATHS) {
    if (!artifactPaths.has(requiredPath)) {
      violations.push(
        `${requiredPath}: required release product file is missing`,
      );
    }
  }
  if (
    ![...artifactPaths].some((artifactPath) =>
      artifactPath.startsWith("LICENSES/dependencies/"),
    )
  ) {
    violations.push(
      "LICENSES/dependencies: dependency license payload is missing",
    );
  }
  for (const file of files) {
    const artifactPath = relative(root, file).split(sep).join("/");
    violations.push(
      ...inspectRetiredArtifactIdentity(artifactPath, artifactPath, "path"),
    );
    const pathSegments = artifactPath.split("/");
    const normalizedSegments = pathSegments.map((segment) =>
      segment.toLowerCase(),
    );
    if (FORBIDDEN_TOP_LEVEL_SEGMENTS.has(normalizedSegments[0] ?? "")) {
      violations.push(
        `${artifactPath}: forbidden release root ${pathSegments[0] ?? ""}`,
      );
      continue;
    }
    const forbiddenSegment = pathSegments.find((segment) =>
      FORBIDDEN_PATH_SEGMENTS.has(segment.toLowerCase()),
    );
    if (forbiddenSegment) {
      violations.push(
        `${artifactPath}: forbidden release path ${forbiddenSegment}`,
      );
      continue;
    }
    if (!isAllowedReleasePath(artifactPath)) {
      violations.push(
        `${artifactPath}: outside the allowed release file layout`,
      );
      continue;
    }
    let source: string;
    try {
      const bytes = await readFile(file);
      source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      violations.push(
        `${artifactPath}: release files must be valid UTF-8 text`,
      );
      continue;
    }
    sources.set(artifactPath, source);
    violations.push(
      ...inspectRetiredArtifactIdentity(artifactPath, source, "content"),
    );
    if (source.includes("\u0000")) {
      violations.push(
        `${artifactPath}: release text must not contain NUL bytes`,
      );
    }
    violations.push(...(await inspectFileSyntax(artifactPath, source)));
    for (const marker of FORBIDDEN_TEXT_MARKERS) {
      if (source.includes(marker)) {
        violations.push(
          `${artifactPath}: contains local-only marker ${marker}`,
        );
      }
    }
  }
  violations.push(...inspectGeneratedAssetReachability(artifactPaths, sources));
  violations.push(
    ...(await inspectDeclarationPairs(root, artifactPaths, sources)),
  );
  violations.push(...inspectDeclarationSemantics(root, artifactPaths));
  if (violations.length > 0) {
    throw new Error(
      `Release artifact boundary failed:\n${violations.sort(codePointOrder).join("\n")}`,
    );
  }
  return { files: files.length };
}

export function inspectRetiredArtifactIdentity(
  owner: string,
  source: string,
  location: "path" | "content",
): string[] {
  const violations: string[] = [];
  const normalizedSource = source.toLowerCase();
  for (const identity of RETIRED_ARTIFACT_PRODUCT_IDENTITIES) {
    if (normalizedSource.includes(identity)) {
      violations.push(
        `${owner}: ${location} contains a retired product identity`,
      );
    }
  }
  if (RETIRED_ARTIFACT_SHORT_PATTERN.test(source)) {
    violations.push(
      `${owner}: ${location} contains a retired short product identity`,
    );
  }
  if (RETIRED_ARTIFACT_EFFECT_PATTERN.test(source)) {
    violations.push(
      `${owner}: ${location} contains a retired effect contract identity`,
    );
  }
  return violations;
}

async function collectFiles(
  directory: string,
  root = directory,
): Promise<string[]> {
  const entries = (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => codePointOrder(left.name, right.name),
  );
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path, root)));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      const artifactPath = relative(root, path).split(sep).join("/");
      throw new Error(
        `Release artifact boundary failed:\n${artifactPath}: symbolic links and special filesystem entries are forbidden`,
      );
    }
  }
  return files;
}

function codePointOrder(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isAllowedReleasePath(artifactPath: string): boolean {
  if (
    artifactPath === "LICENSE" ||
    artifactPath === "NOTICE" ||
    REQUIRED_LEGAL_PATHS.has(artifactPath)
  ) {
    return true;
  }
  if (/^LICENSES\/dependencies\/[^/]+\.txt$/u.test(artifactPath)) {
    return true;
  }
  if (artifactPath === DECLARATION_MANIFEST_PATH) return true;
  if (/^apps\/(?:viewer\/index|sandbox\/sandbox)\.html$/u.test(artifactPath)) {
    return true;
  }
  if (
    /^apps\/(?:viewer|sandbox)\/assets\/[a-z0-9][a-z0-9-]*-[A-Za-z0-9_-]{8}\.(?:css|js)$/u.test(
      artifactPath,
    )
  ) {
    return true;
  }
  return /^sdk\/(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*\.d\.ts(?:\.map)?$/u.test(
    artifactPath,
  );
}

async function inspectFileSyntax(
  artifactPath: string,
  source: string,
): Promise<string[]> {
  try {
    if (artifactPath.endsWith(".js")) {
      const result = await transform(source, {
        loader: "js",
        target: "esnext",
      });
      if (result.warnings.length > 0)
        throw new Error("JavaScript parse warning");
    } else if (artifactPath.endsWith(".css")) {
      const result = await transform(source, { loader: "css" });
      if (result.warnings.length > 0) throw new Error("CSS parse warning");
    } else if (artifactPath.endsWith(".html")) {
      parseHtmlAssetReferences(source);
    } else if (
      artifactPath.endsWith(".json") ||
      artifactPath.endsWith(".map")
    ) {
      JSON.parse(source);
    } else if (artifactPath.endsWith(".d.ts")) {
      if (hasDeclarationSyntaxError(artifactPath, source))
        throw new Error("TypeScript declaration parse failed");
    }
  } catch {
    return [`${artifactPath}: content does not parse as its release file type`];
  }
  return [];
}

function inspectGeneratedAssetReachability(
  artifactPaths: ReadonlySet<string>,
  sources: ReadonlyMap<string, string>,
): string[] {
  const violations: string[] = [];
  for (const app of ["viewer", "sandbox"]) {
    const prefix = `apps/${app}/assets/`;
    const assets = [...artifactPaths]
      .filter((artifactPath) => artifactPath.startsWith(prefix))
      .map((artifactPath) => ({
        path: artifactPath,
        name: artifactPath.slice(prefix.length),
      }));
    const htmlPath = `apps/${app}/${app === "viewer" ? "index" : "sandbox"}.html`;
    const reachable = new Set<string>();
    const queue: string[] = [];

    addReferencedAssets(
      htmlPath,
      sources.get(htmlPath) ?? "",
      assets,
      reachable,
      queue,
    );
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      addReferencedAssets(
        current,
        sources.get(current) ?? "",
        assets,
        reachable,
        queue,
      );
    }

    for (const asset of assets) {
      if (!reachable.has(asset.path)) {
        violations.push(
          `${asset.path}: generated asset is not reachable from ${htmlPath}`,
        );
      }
    }
  }
  return violations;
}

function addReferencedAssets(
  ownerPath: string,
  source: string,
  assets: readonly GeneratedAsset[],
  reachable: Set<string>,
  queue: string[],
): void {
  const references = extractAssetReferences(ownerPath, source);
  for (const asset of assets) {
    if (!reachable.has(asset.path) && references.has(asset.path)) {
      reachable.add(asset.path);
      queue.push(asset.path);
    }
  }
}

function extractAssetReferences(
  ownerPath: string,
  source: string,
): Set<string> {
  const references = new Set<string>();
  if (ownerPath.endsWith(".html")) {
    try {
      for (const reference of parseHtmlAssetReferences(source)) {
        addResolvedAssetReference(references, ownerPath, reference);
      }
    } catch {
      // The file-type parser owns the syntax violation.
    }
    return references;
  }
  if (ownerPath.endsWith(".css")) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//gu, "");
    for (const match of withoutComments.matchAll(
      /(?:@import\s+(?:url\()?|url\()[\s"']*([^\s"')]+)[\s"']*\)?/giu,
    )) {
      addResolvedAssetReference(references, ownerPath, match[1]);
    }
    return references;
  }
  if (ownerPath.endsWith(".js")) {
    const document = ts.createSourceFile(
      ownerPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    function visit(node: ts.Node): void {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        addResolvedAssetReference(
          references,
          ownerPath,
          node.moduleSpecifier.text,
        );
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        addResolvedAssetReference(
          references,
          ownerPath,
          node.arguments[0].text,
        );
      } else if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "URL" &&
        node.arguments?.[0] &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        node.arguments[1] &&
        isImportMetaUrlExpression(node.arguments[1])
      ) {
        addResolvedAssetReference(
          references,
          ownerPath,
          node.arguments[0].text,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(document);
  }
  return references;
}

function addResolvedAssetReference(
  references: Set<string>,
  ownerPath: string,
  reference: string | undefined,
): void {
  const cleanReference = reference?.split(/[?#]/u)[0];
  if (
    !cleanReference ||
    cleanReference.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/iu.test(cleanReference)
  ) {
    return;
  }
  const appMatch = ownerPath.match(/^apps\/(viewer|sandbox)\//u);
  if (!appMatch?.[1]) return;
  const resolvedPath = cleanReference.startsWith("/")
    ? posix.normalize(`apps/${appMatch[1]}${cleanReference}`)
    : posix.normalize(posix.join(posix.dirname(ownerPath), cleanReference));
  references.add(resolvedPath);
}

function isImportMetaUrlExpression(node: ts.Node): boolean {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isMetaProperty(node.expression) &&
    node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    node.name.text === "url"
  ) {
    return true;
  }
  if (ts.isParenthesizedExpression(node)) {
    return isImportMetaUrlExpression(node.expression);
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return (
      (isEmptyStringLiteral(node.left) &&
        isImportMetaUrlExpression(node.right)) ||
      (isImportMetaUrlExpression(node.left) && isEmptyStringLiteral(node.right))
    );
  }
  return false;
}

function isEmptyStringLiteral(node: ts.Node): boolean {
  return ts.isStringLiteralLike(node) && node.text === "";
}

function parseHtmlAssetReferences(source: string): string[] {
  const references: string[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) break;
    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) throw new Error("Unclosed HTML comment");
      cursor = commentEnd + 3;
      continue;
    }
    const tagEnd = findHtmlTagEnd(source, tagStart + 1);
    if (tagEnd < 0) throw new Error("Unclosed HTML tag");
    const tagSource = source.slice(tagStart + 1, tagEnd);
    const tagMatch = tagSource.match(/^\s*([A-Za-z][A-Za-z0-9:-]*)\b/u);
    if (!tagMatch?.[1]) {
      cursor = tagEnd + 1;
      continue;
    }
    const tagName = tagMatch[1].toLowerCase();
    if (tagName === "script" || tagName === "link") {
      const attributeName = tagName === "script" ? "src" : "href";
      const attribute = findHtmlAttribute(tagSource, attributeName);
      if (attribute !== null) references.push(attribute);
    }
    cursor = tagEnd + 1;
    if (tagName === "script" && !tagSource.trimEnd().endsWith("/")) {
      const closeStart = source.toLowerCase().indexOf("</script", cursor);
      if (closeStart < 0) throw new Error("Unclosed script element");
      const closeEnd = findHtmlTagEnd(source, closeStart + 2);
      if (closeEnd < 0) throw new Error("Unclosed script element");
      cursor = closeEnd + 1;
    }
  }
  return references;
}

function findHtmlTagEnd(source: string, start: number): number {
  let quote = "";
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function findHtmlAttribute(
  tagSource: string,
  attributeName: string,
): string | null {
  const pattern = new RegExp(
    `(?:^|\\s)${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "iu",
  );
  const match = tagSource.match(pattern);
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

async function inspectDeclarationPairs(
  root: string,
  artifactPaths: ReadonlySet<string>,
  sources: ReadonlyMap<string, string>,
): Promise<string[]> {
  const violations: string[] = [];
  const declarationPaths = [...artifactPaths]
    .filter((path) => path.endsWith(".d.ts"))
    .sort(codePointOrder);
  const mapPaths = [...artifactPaths]
    .filter((path) => path.endsWith(".d.ts.map"))
    .sort(codePointOrder);
  const manifestEntries = readDeclarationManifestEntries(sources, violations);
  const manifestDeclarations = [...manifestEntries.keys()].sort(codePointOrder);
  if (
    JSON.stringify(manifestDeclarations) !== JSON.stringify(declarationPaths)
  ) {
    violations.push(
      `${DECLARATION_MANIFEST_PATH}: declaration inventory does not match artifact files`,
    );
  }
  for (const declarationPath of declarationPaths) {
    const mapPath = `${declarationPath}.map`;
    const manifestEntry = manifestEntries.get(declarationPath);
    if (!artifactPaths.has(mapPath)) {
      violations.push(`${declarationPath}: paired declaration map is missing`);
    }
    const finalLine = (sources.get(declarationPath) ?? "")
      .trimEnd()
      .split(/\r?\n/u)
      .at(-1);
    if (finalLine !== `//# sourceMappingURL=${basename(mapPath)}`) {
      violations.push(
        `${declarationPath}: declaration map reference is missing`,
      );
    }
    if (
      manifestEntry &&
      (manifestEntry.map !== mapPath ||
        manifestEntry.source !== expectedDeclarationSource(declarationPath) ||
        manifestEntry.declarationSha256 !==
          sha256(sources.get(declarationPath) ?? "") ||
        manifestEntry.mapSha256 !== sha256(sources.get(mapPath) ?? "") ||
        !/^[a-f0-9]{64}$/u.test(manifestEntry.sourceSha256) ||
        (await sourceDigest(root, manifestEntry.source)) !==
          manifestEntry.sourceSha256)
    ) {
      violations.push(
        `${DECLARATION_MANIFEST_PATH}: declaration owner metadata is invalid for ${declarationPath}`,
      );
    }
  }
  for (const mapPath of mapPaths) {
    const declarationPath = mapPath.slice(0, -".map".length);
    if (!artifactPaths.has(declarationPath)) {
      violations.push(`${mapPath}: paired declaration file is missing`);
      continue;
    }
    try {
      const model: unknown = JSON.parse(sources.get(mapPath) ?? "");
      const manifestEntry = manifestEntries.get(declarationPath);
      const source = readSingleMapSource(model);
      const normalizedSource =
        source === null ? null : normalizeMapSource(mapPath, source);
      if (
        !hasExactKeys(model, [
          "file",
          "mappings",
          "names",
          "sourceRoot",
          "sources",
          "version",
        ]) ||
        model.version !== 3 ||
        model.file !== basename(declarationPath) ||
        normalizedSource !== expectedDeclarationSource(declarationPath) ||
        normalizedSource !== manifestEntry?.source ||
        !Array.isArray(model.names) ||
        model.names.length !== 0 ||
        typeof model.mappings !== "string" ||
        !isValidSourceMapMappings(model.mappings, 1, model.names.length)
      ) {
        violations.push(
          `${mapPath}: declaration map metadata does not match its owner`,
        );
      }
    } catch {
      // JSON syntax is reported by the file-type parser.
    }
  }
  return violations;
}

function inspectDeclarationSemantics(
  root: string,
  artifactPaths: ReadonlySet<string>,
): string[] {
  const declarationFiles = [...artifactPaths]
    .filter((path) => path.endsWith(".d.ts"))
    .map((path) => resolve(root, path));
  if (declarationFiles.length === 0) return [];
  const program = ts.createProgram(declarationFiles, {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noLib: true,
    noEmit: true,
    skipLibCheck: false,
    target: ts.ScriptTarget.ES2023,
    types: [],
  });
  return ts
    .getPreEmitDiagnostics(program)
    .filter(
      (diagnostic) =>
        diagnostic.category === ts.DiagnosticCategory.Error &&
        !new Set([2304, 2318, 2537, 2583]).has(diagnostic.code),
    )
    .map((diagnostic) => {
      const artifactPath = diagnostic.file
        ? relative(root, diagnostic.file.fileName).split(sep).join("/")
        : "sdk";
      return `${artifactPath}: declaration set is not semantically valid (${diagnostic.code})`;
    });
}

function readDeclarationManifestEntries(
  sources: ReadonlyMap<string, string>,
  violations: string[],
): Map<string, DeclarationEntry> {
  try {
    const model: unknown = JSON.parse(
      sources.get(DECLARATION_MANIFEST_PATH) ?? "",
    );
    if (
      !hasExactKeys(model, ["files", "schemaVersion"]) ||
      model.schemaVersion !== "sniptale.declarations.v1" ||
      !Array.isArray(model.files)
    ) {
      throw new Error("invalid declaration manifest");
    }
    const entries = new Map<string, DeclarationEntry>();
    const rawEntries: unknown[] = model.files;
    for (const entry of rawEntries) {
      if (
        !hasExactKeys(entry, [
          "declaration",
          "declarationSha256",
          "map",
          "mapSha256",
          "source",
          "sourceSha256",
        ]) ||
        typeof entry.declaration !== "string" ||
        typeof entry.declarationSha256 !== "string" ||
        typeof entry.map !== "string" ||
        typeof entry.mapSha256 !== "string" ||
        typeof entry.source !== "string" ||
        typeof entry.sourceSha256 !== "string" ||
        entries.has(entry.declaration)
      ) {
        throw new Error("invalid declaration manifest entry");
      }
      entries.set(entry.declaration, {
        declaration: entry.declaration,
        declarationSha256: entry.declarationSha256,
        map: entry.map,
        mapSha256: entry.mapSha256,
        source: entry.source,
        sourceSha256: entry.sourceSha256,
      });
    }
    if (
      JSON.stringify([...entries.keys()]) !==
      JSON.stringify([...entries.keys()].sort(codePointOrder))
    ) {
      throw new Error("unsorted declaration manifest");
    }
    return entries;
  } catch {
    violations.push(
      `${DECLARATION_MANIFEST_PATH}: invalid declaration manifest`,
    );
    return new Map<string, DeclarationEntry>();
  }
}

function expectedDeclarationSource(declarationPath: string): string {
  return declarationPath
    .replace(/^sdk\//u, "src/sdk/")
    .replace(/\.d\.ts$/u, ".ts");
}

function normalizeMapSource(mapPath: string, source: string): string {
  return posix.normalize(posix.join("dist", posix.dirname(mapPath), source));
}

async function sourceDigest(
  root: string,
  source: string,
): Promise<string | null> {
  try {
    return sha256(await readFile(resolve(root, "..", source)));
  } catch {
    return null;
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isValidSourceMapMappings(
  mappings: string,
  sourceCount: number,
  nameCount: number,
): boolean {
  let sourceIndex = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let nameIndex = 0;
  for (const line of mappings.split(";")) {
    let generatedColumn = 0;
    if (line === "") continue;
    for (const segment of line.split(",")) {
      if (!segment) return false;
      const values = decodeVlqSegment(segment);
      if (!values || ![1, 4, 5].includes(values.length)) return false;
      const [generatedDelta, sourceDelta, lineDelta, columnDelta, nameDelta] =
        values;
      if (generatedDelta === undefined || generatedDelta < 0) return false;
      generatedColumn += generatedDelta;
      if (generatedColumn < 0) return false;
      if (values.length >= 4) {
        if (
          sourceDelta === undefined ||
          lineDelta === undefined ||
          columnDelta === undefined
        )
          return false;
        sourceIndex += sourceDelta;
        originalLine += lineDelta;
        originalColumn += columnDelta;
        if (
          sourceIndex < 0 ||
          sourceIndex >= sourceCount ||
          originalLine < 0 ||
          originalColumn < 0
        ) {
          return false;
        }
      }
      if (values.length === 5) {
        if (nameDelta === undefined) return false;
        nameIndex += nameDelta;
        if (nameIndex < 0 || nameIndex >= nameCount) return false;
      }
    }
  }
  return true;
}

function decodeVlqSegment(segment: string): number[] | null {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const character of segment) {
    const digit =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(
        character,
      );
    if (digit < 0) return null;
    value += (digit & 31) * 2 ** shift;
    if (value > Number.MAX_SAFE_INTEGER) return null;
    if ((digit & 32) !== 0) {
      shift += 5;
      continue;
    }
    const negative = (value & 1) === 1;
    values.push((negative ? -1 : 1) * Math.floor(value / 2));
    value = 0;
    shift = 0;
  }
  return shift === 0 ? values : null;
}

function hasExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort(codePointOrder)) ===
      JSON.stringify([...expectedKeys].sort(codePointOrder))
  );
}

function readSingleMapSource(value: unknown): string | null {
  if (
    !hasExactKeys(value, [
      "file",
      "mappings",
      "names",
      "sourceRoot",
      "sources",
      "version",
    ]) ||
    value.sourceRoot !== "" ||
    !Array.isArray(value.sources) ||
    value.sources.length !== 1
  )
    return null;
  const source: unknown = value.sources[0];
  return typeof source === "string" ? source : null;
}
function hasDeclarationSyntaxError(
  artifactPath: string,
  source: string,
): boolean {
  const fileName = resolve(artifactPath).split(sep).join("/");
  const canonical = (requested: string): string => {
    const normalized = resolve(requested).split(sep).join("/");
    return ts.sys.useCaseSensitiveFileNames
      ? normalized
      : normalized.toLowerCase();
  };
  const canonicalName = canonical(fileName);
  const options: ts.CompilerOptions = {
    noLib: true,
    noResolve: true,
    noEmit: true,
    target: ts.ScriptTarget.Latest,
  };
  const document = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (requested) =>
    canonical(requested) === canonicalName ? document : undefined;
  host.fileExists = (requested) => canonical(requested) === canonicalName;
  host.readFile = (requested) =>
    canonical(requested) === canonicalName ? source : undefined;
  return (
    ts
      .createProgram([fileName], options, host)
      .getSyntacticDiagnostics(document).length > 0
  );
}
