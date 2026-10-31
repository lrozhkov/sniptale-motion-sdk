import { diagnosticValue } from "../../../src/sdk/diagnostic-value.js";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, normalize, relative, resolve, sep } from "node:path";
import ts from "typescript";

type PolicyPropertyNode =
  | ts.PropertyAssignment
  | ts.ShorthandPropertyAssignment
  | ts.PropertyDeclaration
  | ts.PropertySignature
  | ts.MethodDeclaration
  | ts.MethodSignature
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;
type StaticBindings = ReadonlyMap<string, ts.Expression>;

const ROOT_MARKDOWN = new Set([
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
]);
const STORAGE_ROOTS = [".tmp/", "dist/", "node_modules/"];
const UNTRACKED_CONTENT_ROOTS = [
  ...STORAGE_ROOTS,
  "public/",
  "tests/fixtures/",
];
const REQUIRED_IGNORE_RULES = ["/.tmp/", "/dist/", "/node_modules/"];
const ROOT_ENTRY_CONTRACT = new Map([
  [".agents", "directory"],
  [".codex", "directory"],
  [".git", "git-metadata"],
  [".gitignore", "file"],
  [".npmrc", "file"],
  [".oxfmtignore", "file"],
  [".vscode", "directory"],
  [".oxfmtrc.json", "file"],
  [".tmp", "directory"],
  ["AGENTS.md", "file"],
  ["CONTRIBUTING.md", "file"],
  ["LICENSE", "file"],
  ["LICENSES", "directory"],
  ["NOTICE", "file"],
  ["README.md", "file"],
  ["SECURITY.md", "file"],
  ["THIRD_PARTY_DEPENDENCIES.json", "file"],
  ["THIRD_PARTY_NOTICES.md", "file"],
  ["dist", "directory"],
  ["docs", "directory"],
  ["node_modules", "directory"],
  ["package-lock.json", "file"],
  ["package.json", "file"],
  ["schemas", "directory"],
  ["src", "directory"],
  ["tests", "directory"],
  ["tooling", "directory"],
  ["tsconfig.json", "file"],
]);
const TEMPORARY_FILE_PATTERN =
  /(?:\.tmp|\.temp|\.bak|\.orig|\.rej|\.swp|\.patch|\.diff|\.Zone\.Identifier|~)$/iu;
const REQUIRED_FORMATTER_IGNORES = [
  "*.md",
  "LICENSE",
  "LICENSES/**",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
];
const CLONE_PATH_PATTERN = /(?:\\\\wsl\$\\|[A-Za-z]:\\|\/home\/[^/]+\/)/;
const RETIRED_PRODUCT_IDENTITIES = [
  ["screen", "yx"].join(""),
  ["smart", "capture"].join(""),
  ["n", "s", "m", "p"].join(""),
];
const RETIRED_SHORT_PRODUCT_IDENTITY = ["s", "c", "x"].join("");
const RETIRED_EFFECT_IDENTITY_PATTERN = new RegExp(
  ["effect", "(?:[-_. ]?v)", "4"].join(""),
  "iu",
);
const RETIRED_SHORT_PRODUCT_PATTERN = new RegExp(
  [
    "(?<![A-Za-z0-9])",
    ...RETIRED_SHORT_PRODUCT_IDENTITY.split("").map(
      (character) => `[${character}${character.toUpperCase()}]`,
    ),
    "(?=$|[^A-Za-z0-9]|[A-Z])",
  ].join(""),
  "u",
);

export function inspectRepositoryHygiene(root = process.cwd()) {
  const violations: string[] = [];
  const { candidateFiles, trackedFiles } = collectRepositoryFiles(root);

  violations.push(...inspectRootTopology(root));
  inspectToolingTopology(root, violations);
  inspectStorageRoots(root, trackedFiles, violations);
  inspectRetiredRepositoryIdentity(root, candidateFiles, violations);
  violations.push(...inspectTrackedIndexIdentity(root));
  inspectIgnoreRules(root, violations);
  inspectOssIdentity(root, candidateFiles, violations);
  violations.push(...inspectPublicationBoundary(root));
  inspectMarkdownTopology(root, candidateFiles, violations);
  inspectAuthoredText(root, candidateFiles, violations);
  inspectDebtPolicyFiles(root, candidateFiles, violations);
  inspectTemporaryFiles(candidateFiles, violations);

  return violations;
}

function inspectRetiredRepositoryIdentity(
  root: string,
  candidateFiles: readonly string[],
  violations: string[],
) {
  for (const file of candidateFiles) {
    violations.push(...inspectRetiredIdentityText(file, file, "path"));
    let source: string;
    try {
      if (!lstatSync(resolve(root, file)).isFile()) {
        violations.push(
          `${file}: repository identity files must be regular files`,
        );
        continue;
      }
      source = new TextDecoder("utf-8", { fatal: true }).decode(
        readFileSync(resolve(root, file)),
      );
    } catch {
      violations.push(`${file}: repository files must be valid UTF-8 text`);
      continue;
    }
    violations.push(...inspectRetiredIdentityText(file, source, "content"));
  }
}

export function inspectTrackedIndexIdentity(root = process.cwd()) {
  const violations: string[] = [];
  const staged = execFileSync("git", ["ls-files", "--stage", "-z"], {
    cwd: root,
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d+) ([a-f0-9]+) (\d+)\t([\s\S]+)$/u.exec(entry);
      if (!match?.[1] || !match[2] || !match[3] || !match[4])
        throw new Error(`Unexpected Git index entry: ${entry}`);
      return {
        mode: match[1],
        objectId: match[2],
        path: match[4],
        stage: match[3],
      };
    });
  if (staged.length === 0) return violations;
  const batch = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: `${staged.map(({ objectId }) => objectId).join("\n")}\n`,
    maxBuffer: 64 * 1024 * 1024,
  });
  let offset = 0;
  for (const entry of staged) {
    if (existsSync(resolve(root, entry.path))) {
      const headerEnd = batch.indexOf(0x0a, offset);
      if (headerEnd === -1)
        throw new Error("Git object batch header is truncated.");
      const header = batch.subarray(offset, headerEnd).toString("utf8");
      const headerMatch = /^([a-f0-9]+) ([a-z]+) (\d+)$/u.exec(header);
      if (!headerMatch)
        throw new Error(`Unexpected Git object batch header: ${header}`);
      offset = headerEnd + 1 + Number(headerMatch[3]) + 1;
      continue;
    }
    violations.push(
      ...inspectRetiredIdentityText(entry.path, entry.path, "index path"),
    );
    if (entry.stage !== "0") {
      violations.push(
        `${entry.path}: unresolved Git index stages are forbidden`,
      );
    }
    if (entry.mode !== "100644" && entry.mode !== "100755") {
      violations.push(
        `${entry.path}: tracked identity entries must be regular files`,
      );
    }
    const headerEnd = batch.indexOf(0x0a, offset);
    if (headerEnd === -1)
      throw new Error("Git object batch header is truncated.");
    const header = batch.subarray(offset, headerEnd).toString("utf8");
    const headerMatch = /^([a-f0-9]+) ([a-z]+) (\d+)$/u.exec(header);
    if (!headerMatch || headerMatch[1] !== entry.objectId) {
      throw new Error(`Unexpected Git object batch header: ${header}`);
    }
    const size = Number(headerMatch[3]);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (batch[contentEnd] !== 0x0a) {
      throw new Error(
        `Git object batch payload is truncated for ${entry.path}.`,
      );
    }
    offset = contentEnd + 1;
    if (headerMatch[2] !== "blob") {
      violations.push(`${entry.path}: tracked identity entry must be a blob`);
      continue;
    }
    try {
      const source = new TextDecoder("utf-8", { fatal: true }).decode(
        batch.subarray(contentStart, contentEnd),
      );
      violations.push(
        ...inspectRetiredIdentityText(entry.path, source, "index content"),
      );
    } catch {
      violations.push(
        `${entry.path}: tracked index content must be valid UTF-8 text`,
      );
    }
  }
  return violations;
}

export function inspectRetiredIdentityText(
  owner: string,
  source: string,
  location: string,
) {
  const violations: string[] = [];
  const normalizedSource = source.toLowerCase();
  for (const identity of RETIRED_PRODUCT_IDENTITIES) {
    if (normalizedSource.includes(identity)) {
      violations.push(
        `${owner}: ${location} contains a retired product identity`,
      );
    }
  }
  if (RETIRED_SHORT_PRODUCT_PATTERN.test(source)) {
    violations.push(
      `${owner}: ${location} contains a retired short product identity`,
    );
  }
  if (RETIRED_EFFECT_IDENTITY_PATTERN.test(source)) {
    violations.push(
      `${owner}: ${location} contains a retired effect contract identity`,
    );
  }
  return violations;
}

export function inspectRootTopology(root = process.cwd()) {
  const violations: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const expected = ROOT_ENTRY_CONTRACT.get(entry.name);
    if (!expected) {
      violations.push(
        `${entry.name}: root entry has no repository topology owner`,
      );
      continue;
    }
    const actual = entry.isDirectory()
      ? "directory"
      : entry.isFile()
        ? "file"
        : "special";
    if (
      actual !== expected &&
      !(
        expected === "git-metadata" &&
        (actual === "file" || actual === "directory")
      )
    ) {
      violations.push(
        `${entry.name}: root entry must be ${expected}, found ${actual}`,
      );
    }
  }
  const docsRoot = resolve(root, "docs");
  if (existsSync(docsRoot)) {
    for (const directory of collectEmptyDirectories(docsRoot, root)) {
      violations.push(
        `${directory}: empty documentation directory is forbidden`,
      );
    }
  }
  return violations;
}

function collectEmptyDirectories(directory: string, root: string): string[] {
  const empty: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      empty.push(
        ...collectEmptyDirectories(resolve(directory, entry.name), root),
      );
    }
  }
  if (readdirSync(directory).length === 0) {
    empty.push(relative(root, directory).split(sep).join("/"));
  }
  return empty;
}

function inspectTemporaryFiles(
  candidateFiles: readonly string[],
  violations: string[],
) {
  for (const file of candidateFiles) {
    if (isTemporaryFilePath(file)) {
      violations.push(`${file}: temporary files belong under .tmp/`);
    }
  }
}

export function isTemporaryFilePath(file: string) {
  return TEMPORARY_FILE_PATTERN.test(file);
}

function inspectToolingTopology(root: string, violations: string[]) {
  if (existsSync(resolve(root, "scripts"))) {
    violations.push(
      "scripts: top-level scripts directory is forbidden; repository commands belong under tooling/",
    );
  }
  if (existsSync(resolve(root, "tests/fixtures"))) {
    violations.push(
      "tests/fixtures: generated fixture contents belong under .tmp/ and fixture generators belong under tooling/test/fixtures/",
    );
  }
  const packageJson = readJsonRecord(root, "package.json");
  for (const [name, command] of Object.entries(
    recordValue(packageJson.scripts ?? {}, "package.json scripts"),
  )) {
    if (typeof command !== "string") {
      violations.push(`package.json#scripts.${name}: script must be a string`);
      continue;
    }
    if (command.includes("scripts/")) {
      violations.push(
        `package.json#scripts.${name}: command must resolve through tooling/`,
      );
    }
  }
  const tsconfig = readJsonRecord(root, "tsconfig.json");
  if (Array.isArray(tsconfig.include) && tsconfig.include.includes("scripts")) {
    violations.push("tsconfig.json: top-level scripts directory is forbidden");
  }
  for (const file of [
    "src/apps/viewer/index.html",
    "src/apps/sandbox/sandbox.html",
    "tooling/configs/qa/gitleaks.toml",
    "tooling/configs/qa/vitest.ts",
    "tooling/configs/qa/publication.json",
    "tooling/qa/security/environment.ts",
    "tooling/qa/security/scan-worktree.ts",
    "tooling/qa/wrappers/security.ts",
    "tooling/configs/typescript/sdk.json",
    "tooling/configs/vite/sandbox.ts",
    "tooling/configs/vite/viewer.ts",
  ]) {
    if (!existsSync(resolve(root, file))) {
      violations.push(`${file}: required owner file is missing`);
    }
  }
}

export function inspectPublicationBoundary(root = process.cwd()) {
  const violations: string[] = [];
  let policy: Record<string, unknown>;
  try {
    policy = readJsonRecord(root, "tooling/configs/qa/publication.json");
  } catch (error) {
    violations.push(
      `tooling/configs/qa/publication.json: publication policy is unavailable or invalid: ${error instanceof Error ? error.message : diagnosticValue(error)}`,
    );
    return violations;
  }
  const expectedPolicy = {
    schemaVersion: 2,
    publication: "github-source",
    gitHubPublication: "lrozhkov/sniptale-motion-sdk",
    gitHubActions: "disabled",
    registryPublication: "not-authorized",
    securityReporting: "github-private-vulnerability-reporting",
  };
  if (
    JSON.stringify(Object.keys(policy).sort()) !==
    JSON.stringify(Object.keys(expectedPolicy).sort())
  ) {
    violations.push(
      "tooling/configs/qa/publication.json: publication policy fields must remain exact",
    );
  }
  for (const [field, expected] of Object.entries(expectedPolicy)) {
    if (policy[field] !== expected) {
      violations.push(
        `tooling/configs/qa/publication.json#${field}: expected ${JSON.stringify(expected)}`,
      );
    }
  }

  const packageJson = readJsonRecord(root, "package.json");
  const expectedPackageMetadata = {
    repository: "https://github.com/lrozhkov/sniptale-motion-sdk.git",
    homepage: "https://github.com/lrozhkov/sniptale-motion-sdk#readme",
  };
  for (const [field, expected] of Object.entries(expectedPackageMetadata)) {
    if (packageJson[field] !== expected) {
      violations.push(
        `package.json#${field}: expected ${JSON.stringify(expected)}`,
      );
    }
  }
  for (const field of ["bugs", "publishConfig"]) {
    if (Object.hasOwn(packageJson, field)) {
      violations.push(
        `package.json#${field}: registry or public-intake metadata is not authorized`,
      );
    }
  }
  for (const [name, command] of Object.entries(
    recordValue(packageJson.scripts ?? {}, "package.json scripts"),
  )) {
    if (typeof command !== "string") {
      violations.push(`package.json#scripts.${name}: script must be a string`);
      continue;
    }
    if (
      ["prepublish", "prepublishonly", "publish", "postpublish"].includes(
        name.toLowerCase(),
      )
    ) {
      violations.push(
        `package.json#scripts.${name}: registry publication lifecycle is not authorized`,
      );
    }
    if (
      /\b(?:(?:npm|pnpm|yarn)\s+publish|git\s+push|gh\s+(?:repo|release|pr)|npm\s+(?:dist-tag|deprecate)|semantic-release)\b/iu.test(
        command,
      )
    ) {
      violations.push(
        `package.json#scripts.${name}: external publication command is not authorized`,
      );
    }
  }

  const security = readFileSync(resolve(root, "SECURITY.md"), "utf8");
  const privateReportingUrl =
    "https://github.com/lrozhkov/sniptale-motion-sdk/security/advisories/new";
  const reportingStatus = `Report suspected vulnerabilities privately through [GitHub private vulnerability reporting](${privateReportingUrl}).`;
  if (!security.includes(reportingStatus)) {
    violations.push(
      "SECURITY.md: reporting status must match GitHub private vulnerability reporting",
    );
  }
  const configuredPrivateReportingUrls =
    security.match(
      /https:\/\/github\.com\/[^\s/)]+\/[^\s/)]+\/security\/advisories\/new/gu,
    ) ?? [];
  if (
    configuredPrivateReportingUrls.length !== 1 ||
    configuredPrivateReportingUrls[0] !== privateReportingUrl ||
    /(?:mailto:|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu.test(security)
  ) {
    violations.push(
      "SECURITY.md: reporting instructions must have one private GitHub owner",
    );
  }
  const release = readFileSync(resolve(root, "docs/oss/release.md"), "utf8");
  if (
    !release.includes(
      "GitHub source publication is authorized only for [lrozhkov/sniptale-motion-sdk](https://github.com/lrozhkov/sniptale-motion-sdk).",
    )
  ) {
    violations.push(
      "docs/oss/release.md: publication boundary must match the authorized GitHub target",
    );
  }
  if (
    !release.includes(
      "GitHub Actions is disabled and workflow files are forbidden.",
    )
  ) {
    violations.push(
      "docs/oss/release.md: GitHub Actions boundary must remain disabled",
    );
  }
  if (existsSync(resolve(root, ".github/workflows"))) {
    violations.push(
      ".github/workflows: GitHub Actions workflows are forbidden because QA runs locally",
    );
  }
  return violations;
}

export function collectRepositoryFiles(root = process.cwd()) {
  const candidateFiles = gitFiles(root, [
    "ls-files",
    "-co",
    "--exclude-standard",
    "-z",
  ]).filter((file) => existsSync(resolve(root, file)));
  const trackedFiles = gitFiles(root, ["ls-files", "-z"]);
  return { candidateFiles, trackedFiles };
}

function inspectOssIdentity(
  root: string,
  candidateFiles: readonly string[],
  violations: string[],
) {
  for (const file of [
    "CONTRIBUTING.md",
    "LICENSE",
    "NOTICE",
    "README.md",
    "SECURITY.md",
  ]) {
    if (!existsSync(resolve(root, file))) {
      violations.push(
        `${file}: required open-source readiness file is missing`,
      );
    }
  }

  const packageJson = readJsonRecord(root, "package.json");
  const packageLock = readJsonRecord(root, "package-lock.json");
  if (packageJson.name !== "@sniptale/motion-sdk") {
    violations.push("package.json: package name must be @sniptale/motion-sdk");
  }
  if (packageJson.private !== true) {
    violations.push(
      "package.json: private must remain true because registry publication is not planned",
    );
  }
  if (packageJson.license !== "MIT") {
    violations.push("package.json: first-party license must be MIT");
  }
  if (packageJson.author !== "Lev Rozhkov") {
    violations.push(
      "package.json: author must match the confirmed Git history owner",
    );
  }
  const lockRoot =
    isRecord(packageLock.packages) && isRecord(packageLock.packages[""])
      ? packageLock.packages[""]
      : null;
  if (
    packageLock.name !== packageJson.name ||
    lockRoot?.name !== packageJson.name ||
    lockRoot?.license !== packageJson.license
  ) {
    violations.push(
      "package-lock.json: first-party name/license metadata is stale",
    );
  }

  const identityFiles = [
    "README.md",
    "package.json",
    "src/apps/sandbox/sandbox.html",
    "src/apps/viewer/index.html",
    "src/apps/viewer/app/shell.ts",
    "src/shared/i18n/messages.ts",
    ...candidateFiles.filter((file) => file.startsWith("docs/")),
  ].filter((file) => existsSync(resolve(root, file)));
  for (const file of new Set(identityFiles)) {
    const source = readFileSync(resolve(root, file), "utf8");
    if (source.includes("@local/effect-sdk")) {
      violations.push(
        `${file}: local package identity is not part of Sniptale Motion SDK`,
      );
    }
    if (hasStaleProductTitle(source)) {
      violations.push(`${file}: stale Effect SDK product title`);
    }
  }

  const contributingPath = resolve(root, "CONTRIBUTING.md");
  if (existsSync(contributingPath)) {
    const contributing = readFileSync(contributingPath, "utf8");
    if (!/External code contributions are not accepted\./.test(contributing)) {
      violations.push(
        "CONTRIBUTING.md: closed external code contribution policy is not explicit",
      );
    }
    if (!/Pull requests are not accepted\./.test(contributing)) {
      violations.push(
        "CONTRIBUTING.md: closed pull-request policy is not explicit",
      );
    }
  }

  for (const file of candidateFiles) {
    if (
      /^(?:\.github\/)?(?:PULL_REQUEST_TEMPLATE|pull_request_template)/i.test(
        file,
      )
    ) {
      violations.push(
        `${file}: pull-request templates contradict the closed contribution policy`,
      );
    }
  }
}

export function inspectAuthoredSource(file: string, source: string) {
  return [
    ...findHardWrappedProse(file, source),
    ...findWideMarkdownTables(file, source),
  ];
}

export function hasStaleProductTitle(source: string) {
  return source.replaceAll("Sniptale Motion SDK", "").includes("Effect SDK");
}

export function findHardWrappedProse(file: string, source: string) {
  const violations: string[] = [];
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  let fenced = false;
  const frontmatterEnd =
    lines[0]?.trim() === "---"
      ? lines.findIndex((line, index) => index > 0 && line.trim() === "---")
      : -1;
  let htmlComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (frontmatterEnd > 0 && index <= frontmatterEnd) continue;
    if (/^(```|~~~)/.test(trimmed)) {
      fenced = !fenced;
      continue;
    }
    if (trimmed.includes("<!--")) htmlComment = true;
    if (fenced || htmlComment) {
      if (trimmed.includes("-->")) htmlComment = false;
      continue;
    }
    if (index === 0 || !isProseContinuation(trimmed)) continue;

    const previous = (lines[index - 1] ?? "").trim();
    if (!previous) continue;
    if (isListItem(previous)) {
      violations.push(
        `${file}:${index + 1}: authored prose must use natural paragraphs without forced line wrapping`,
      );
      continue;
    }
    if (isBlockBoundary(previous)) continue;
    violations.push(
      `${file}:${index + 1}: authored prose must use natural paragraphs without forced line wrapping`,
    );
  }

  return violations;
}

export function findWideMarkdownTables(file: string, source: string) {
  const violations: string[] = [];
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = (lines[index] ?? "").trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const columns = trimmed
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim()).length;
    if (columns > 4) {
      violations.push(
        `${file}:${index + 1}: Markdown tables are limited to four columns (${columns} found)`,
      );
    }
  }
  return violations;
}

function inspectStorageRoots(
  root: string,
  trackedFiles: readonly string[],
  violations: string[],
) {
  const trackedStorage = findTrackedLocalContent(trackedFiles);
  for (const file of trackedStorage) {
    violations.push(
      `${file}: local storage, generated fixtures, and output roots must not contain tracked files`,
    );
  }

  const requiredIgnored = [
    ".tmp/probe.txt",
    "dist/probe.txt",
    "node_modules/probe.txt",
  ];
  for (const file of requiredIgnored) {
    if (!isIgnored(root, file)) {
      violations.push(`${file}: storage/output root must be ignored`);
    }
  }

  const requiredVisible = [
    "docs/.tmp/probe.md",
    "docs/dist/probe.md",
    "docs/node_modules/probe.md",
  ];
  for (const file of requiredVisible) {
    if (isIgnored(root, file)) {
      violations.push(
        `${file}: root storage ignore rule must not hide nested documentation paths`,
      );
    }
  }
}

export function findTrackedLocalContent(trackedFiles: readonly string[]) {
  return trackedFiles.filter((file) =>
    UNTRACKED_CONTENT_ROOTS.some((storageRoot) => file.startsWith(storageRoot)),
  );
}

function inspectIgnoreRules(root: string, violations: string[]) {
  const ignoreFile = resolve(root, ".gitignore");
  const rules = readFileSync(ignoreFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const rule of REQUIRED_IGNORE_RULES) {
    if (!rules.includes(rule)) {
      violations.push(`.gitignore: missing root-anchored rule ${rule}`);
    }
  }

  const formatterIgnore = readFileSync(resolve(root, ".oxfmtignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const rule of REQUIRED_FORMATTER_IGNORES) {
    if (!formatterIgnore.includes(rule)) {
      violations.push(
        `.oxfmtignore: missing authored/legal text exclusion ${rule}`,
      );
    }
  }
  const allowedFormatterIgnores = new Set([
    ...REQUIRED_IGNORE_RULES,
    ...REQUIRED_FORMATTER_IGNORES,
  ]);
  for (const rule of formatterIgnore) {
    if (!allowedFormatterIgnores.has(rule)) {
      violations.push(`.oxfmtignore: unowned formatting exclusion ${rule}`);
    }
  }

  const formatterConfig = resolve(root, ".oxfmtrc.json");
  if (!existsSync(formatterConfig)) {
    violations.push(".oxfmtrc.json: required to pin proseWrap=never");
  } else {
    const config: unknown = JSON.parse(readFileSync(formatterConfig, "utf8"));
    if (!isRecord(config) || config.proseWrap !== "never") {
      violations.push('.oxfmtrc.json: "proseWrap" must be "never"');
    }
  }
}

function inspectMarkdownTopology(
  root: string,
  candidateFiles: readonly string[],
  violations: string[],
) {
  const markdownFiles = candidateFiles.filter(
    (file) => extname(file) === ".md",
  );
  for (const file of markdownFiles) {
    const isRoot = ROOT_MARKDOWN.has(file);
    const isSkill = isSkillMarkdownPath(file);
    const isDoc = file.startsWith("docs/");
    if (!isRoot && !isSkill && !isDoc) {
      violations.push(
        `${file}: tracked Markdown has no active documentation owner`,
      );
    }
    if (isDoc && file !== "docs/README.md" && /\/README\.md$/.test(file)) {
      violations.push(
        `${file}: docs/README.md is the sole documentation index`,
      );
    }
  }

  const indexPath = resolve(root, "docs/README.md");
  if (!existsSync(indexPath)) {
    violations.push("docs/README.md: sole documentation index is missing");
  } else {
    const indexLinks = collectLocalMarkdownLinks(
      root,
      "docs/README.md",
      readFileSync(indexPath, "utf8"),
    );
    const activeDocs = markdownFiles.filter(
      (file) => file.startsWith("docs/") && file !== "docs/README.md",
    );
    for (const file of activeDocs) {
      if (!indexLinks.has(file)) {
        violations.push(
          `${file}: active document is not linked from docs/README.md`,
        );
      }
    }
  }

  for (const file of markdownFiles) {
    const source = readFileSync(resolve(root, file), "utf8");
    if (CLONE_PATH_PATTERN.test(source)) {
      violations.push(
        `${file}: clone-specific absolute paths are not allowed in active documentation`,
      );
    }
    for (const target of collectMarkdownLinkTargets(file, source)) {
      if (isExternalLink(target)) continue;
      const cleanTarget = target.replace(/^<|>$/g, "").split("#")[0];
      if (!cleanTarget) continue;
      const resolved = resolve(root, dirname(file), cleanTarget);
      if (!isInsideRoot(root, resolved) || !existsSync(resolved)) {
        violations.push(`${file}: dangling local link ${target}`);
      }
    }
  }
}

export function isSkillMarkdownPath(file: string) {
  return /^\.agents\/skills\/(?:[^/]+\.md|[^/]+\/(?:SKILL\.md|references\/[^/]+\.md))$/.test(
    file,
  );
}

function inspectAuthoredText(
  root: string,
  candidateFiles: readonly string[],
  violations: string[],
) {
  const authoredFiles = candidateFiles.filter(
    (file) => extname(file) === ".md",
  );
  for (const legalFile of ["LICENSE", "NOTICE"]) {
    if (existsSync(resolve(root, legalFile))) authoredFiles.push(legalFile);
  }
  for (const file of new Set(authoredFiles)) {
    const source = readFileSync(resolve(root, file), "utf8");
    violations.push(...inspectAuthoredSource(file, source));
  }
}

function inspectDebtPolicyFiles(
  root: string,
  candidateFiles: readonly string[],
  violations: string[],
) {
  for (const file of candidateFiles) {
    violations.push(
      ...inspectDebtPolicySource(
        file,
        isPolicyOwner(file) ? readFileSync(resolve(root, file), "utf8") : "",
      ),
    );
  }
}

export function inspectDebtPolicySource(file: string, source: string) {
  const violations: string[] = [];
  if (/(?:baseline|allowlist|known[-_.]?fail|suppress|waiver)/i.test(file)) {
    violations.push(`${file}: debt-normalizing policy files are not allowed`);
  }
  if (isPolicyOwner(file) && containsDebtPolicyKey(file, source)) {
    violations.push(`${file}: debt-normalizing policy keys are not allowed`);
  }
  return violations;
}

function containsDebtPolicyKey(file: string, source: string) {
  const extension = extname(file).toLowerCase();
  if (extension === ".json") {
    try {
      return objectContainsDebtKey(JSON.parse(source));
    } catch {
      return false;
    }
  }
  if (extension === ".yaml" || extension === ".yml") {
    return source.split(/\r?\n/u).some((line) => {
      const match = line.match(
        /^\s*(?:"((?:\\.|[^"\\])*)"|'([^']*)'|([A-Za-z0-9_-]+))\s*:/u,
      );
      if (!match) return false;
      let key: unknown = match[1] ?? match[2] ?? match[3];
      if (match[1] !== undefined) {
        try {
          key = JSON.parse(`"${match[1]}"`);
        } catch {
          return false;
        }
      }
      return isDebtPolicyKey(key);
    });
  }
  return /\.(?:[cm]?[jt]sx?)$/iu.test(file)
    ? programContainsDebtKey(file, source)
    : false;
}

function objectContainsDebtKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(objectContainsDebtKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) => isDebtPolicyKey(key) || objectContainsDebtKey(nested),
  );
}

function programContainsDebtKey(file: string, source: string) {
  const document = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") || file.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  const bindings = new Map<string, ts.Expression>();
  function collectBindings(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      bindings.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectBindings);
  }
  collectBindings(document);

  let found = false;
  function inspect(node: ts.Node) {
    if (found) return;
    if (isPolicyPropertyNode(node)) {
      const key = staticPropertyName(node.name, bindings);
      if (key !== null && isDebtPolicyKey(key)) found = true;
    } else if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      const key = staticString(node.argumentExpression, bindings);
      if (key !== null && isDebtPolicyKey(key)) found = true;
    } else if (isStaticKeyContainer(node)) {
      const key = staticString(node.elements[0], bindings);
      if (key !== null && isDebtPolicyKey(key)) found = true;
    } else if (isPolicyKeyApiCall(node)) {
      const key = staticString(node.arguments[1], bindings);
      if (key !== null && isDebtPolicyKey(key)) found = true;
    }
    ts.forEachChild(node, inspect);
  }
  inspect(document);
  return found;
}

function isPolicyPropertyNode(node: ts.Node): node is PolicyPropertyNode {
  return (
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function staticPropertyName(
  name: ts.PropertyName | undefined,
  bindings: StaticBindings,
): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return ts.isComputedPropertyName(name)
    ? staticString(name.expression, bindings)
    : null;
}

function isStaticKeyContainer(
  node: ts.Node,
): node is ts.ArrayLiteralExpression {
  if (!ts.isArrayLiteralExpression(node) || node.elements.length < 2) {
    return false;
  }
  const parent = node.parent;
  if (ts.isArrayLiteralExpression(parent)) {
    const container = parent.parent;
    return (
      (ts.isCallExpression(container) || ts.isNewExpression(container)) &&
      isKeyContainerCall(container.expression)
    );
  }
  return false;
}

function isKeyContainerCall(expression: ts.Expression) {
  return (
    (ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "Object" &&
      expression.name.text === "fromEntries") ||
    (ts.isIdentifier(expression) && expression.text === "Map")
  );
}

function isPolicyKeyApiCall(node: ts.Node): node is ts.CallExpression {
  if (
    !ts.isCallExpression(node) ||
    node.arguments.length < 2 ||
    !ts.isPropertyAccessExpression(node.expression) ||
    !ts.isIdentifier(node.expression.expression)
  ) {
    return false;
  }
  const owner = node.expression.expression.text;
  const method = node.expression.name.text;
  return (
    (owner === "Object" && method === "defineProperty") ||
    (owner === "Reflect" && (method === "defineProperty" || method === "set"))
  );
}

function staticString(
  expression: ts.Expression | undefined,
  bindings: StaticBindings,
  seen: ReadonlySet<string> = new Set<string>(),
): string | null {
  if (!expression) return null;
  if (ts.isStringLiteralLike(expression)) return expression.text;
  if (ts.isParenthesizedExpression(expression)) {
    return staticString(expression.expression, bindings, seen);
  }
  if (
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return staticString(expression.expression, bindings, seen);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticString(expression.left, bindings, seen);
    const right = staticString(expression.right, bindings, seen);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(expression)) {
    let result = expression.head.text;
    for (const span of expression.templateSpans) {
      const value = staticString(span.expression, bindings, seen);
      if (value === null) return null;
      result += value + span.literal.text;
    }
    return result;
  }
  if (ts.isIdentifier(expression) && bindings.has(expression.text)) {
    if (seen.has(expression.text)) return null;
    return staticString(
      bindings.get(expression.text),
      bindings,
      new Set([...seen, expression.text]),
    );
  }
  return null;
}

function isDebtPolicyKey(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase().replaceAll(/[-_]/gu, "");
  return new Set([
    "allowlist",
    "allowlists",
    "baseline",
    "baselines",
    "exception",
    "exceptions",
    "ignoredviolation",
    "ignoredviolations",
    "knownfailure",
    "knownfailures",
    "suppression",
    "suppressions",
    "waiver",
    "waivers",
  ]).has(normalized);
}

function isPolicyOwner(file: string) {
  if (
    file === "tooling/qa/policy/repository-hygiene.ts" ||
    file === "tooling/qa/policy/repository-hygiene.test.ts"
  ) {
    return false;
  }
  return (
    file === "package.json" ||
    ((file.startsWith("tooling/configs/") ||
      file.startsWith("tooling/qa/") ||
      file.startsWith("tooling/release/")) &&
      /\.(?:json|[cm]?[jt]sx?|ya?ml)$/i.test(file)) ||
    /(?:^|\/)[^/]*(?:checks?|config|guardrail|policy|rules?)[^/]*\.(?:json|[cm]?[jt]sx?|ya?ml)$/i.test(
      file,
    )
  );
}

function collectLocalMarkdownLinks(root: string, file: string, source: string) {
  return new Set(
    collectMarkdownLinkTargets(file, source)
      .filter((target) => !isExternalLink(target))
      .map((target) => target.replace(/^<|>$/g, "").split("#")[0])
      .filter(
        (target): target is string =>
          typeof target === "string" && target !== "",
      )
      .map((target) => toRepoPath(root, resolve(root, dirname(file), target)))
      .filter((target) => target.endsWith(".md")),
  );
}

function collectMarkdownLinkTargets(_file: string, source: string) {
  return [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) =>
    (match[1] ?? "").trim(),
  );
}

function isExternalLink(target: string) {
  return /^(?:[a-z]+:|#)/i.test(target);
}

function isProseContinuation(line: string) {
  if (!line) return false;
  if (isBlockBoundary(line)) return false;
  return true;
}

function isBlockBoundary(line: string) {
  return /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\|.*\|$|(?:---|___|\*\*\*)$|<[^>]+>|\[[^\]]+\]:)/.test(
    line,
  );
}

function isListItem(line: string) {
  return /^(?:[-*+]\s|\d+[.)]\s)/.test(line);
}

function isIgnored(root: string, file: string) {
  try {
    execFileSync("git", ["check-ignore", "--no-index", "--quiet", "--", file], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function gitFiles(root: string, args: readonly string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .map((file) => file.split(sep).join("/"));
}

function isInsideRoot(root: string, path: string) {
  const relativePath = relative(resolve(root), path);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") &&
      !normalize(relativePath).startsWith(`..${sep}`))
  );
}

function toRepoPath(root: string, path: string) {
  return relative(resolve(root), path).split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be a JSON object.`);
  return value;
}
function readJsonRecord(root: string, file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(resolve(root, file), "utf8"));
  return recordValue(value, file);
}
