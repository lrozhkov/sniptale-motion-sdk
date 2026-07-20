import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_SETTINGS = "tooling/configs/qa/licenses.json";
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_IN_URL_PATTERN = /(?:^|\/)[a-f0-9]{40,64}(?:\/|$)/u;

function plainRecord(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
  return value;
}

function exactFields(value, permitted, label) {
  for (const key of Object.keys(value)) {
    if (!permitted.includes(key))
      throw new TypeError(`${label} contains an unsupported field: ${key}.`);
  }
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "")
    throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

function stringList(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry === "")
  )
    throw new TypeError(`${label} must be an array of non-empty strings.`);
  if (new Set(value).size !== value.length)
    throw new TypeError(`${label} contains duplicate values.`);
  return [...value];
}

function httpsUrl(value, label) {
  const candidate = text(value, label);
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TypeError(`${label} must be an HTTPS URL.`);
  }
  if (parsed.protocol !== "https:")
    throw new TypeError(`${label} must be an HTTPS URL.`);
  return candidate;
}

export function spdxAtoms(expression) {
  const source = text(expression, "license expression");
  return [...source.matchAll(/[A-Za-z][A-Za-z0-9.-]*/gu)]
    .map((match) => match[0])
    .filter((token) => token !== "AND" && token !== "OR" && token !== "WITH");
}

export function relativeRepoPath(value, label) {
  const candidate = text(value, label);
  if (
    path.isAbsolute(candidate) ||
    candidate.includes("\\") ||
    candidate
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    path.posix.normalize(candidate) !== candidate
  ) {
    throw new TypeError(
      `${label} must be a normalized repository-relative path.`,
    );
  }
  return candidate;
}

export function containedPath(root, relative, label = "path") {
  const checked = relativeRepoPath(relative, label);
  const base = path.resolve(root);
  const destination = path.resolve(base, checked);
  if (!destination.startsWith(`${base}${path.sep}`))
    throw new TypeError(`${label} resolves outside its owner root.`);
  return destination;
}

export function assertContainedAbsolute(root, candidate, label = "path") {
  const base = path.resolve(root);
  const destination = path.resolve(candidate);
  if (destination !== base && !destination.startsWith(`${base}${path.sep}`))
    throw new TypeError(`${label} resolves outside its owner root.`);
  return destination;
}

export async function rejectSymlinkSegments(root, relative, label = "path") {
  const checked = relativeRepoPath(relative, label);
  let cursor = path.resolve(root);
  for (const segment of checked.split("/")) {
    cursor = path.join(cursor, segment);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink())
        throw new TypeError(`${label} crosses a symbolic link.`);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }
  }
}

export async function readContainedRegularFile(root, relative, label = "path") {
  const absolute = containedPath(root, relative, label);
  const realRoot = await fs.realpath(root);
  let realFile;
  try {
    realFile = await fs.realpath(absolute);
  } catch (error) {
    throw new Error(
      `${label} is unavailable at ${relative}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assertContainedAbsolute(realRoot, realFile, label);
  const stat = await fs.stat(realFile);
  if (!stat.isFile()) throw new TypeError(`${label} must be a regular file.`);
  return fs.readFile(realFile);
}

function projectLicenseSettings(value) {
  const record = plainRecord(value, "projectLicense");
  exactFields(
    record,
    [
      "path",
      "sourceUrl",
      "sourcePath",
      "sourceSha256",
      "expectedSha256",
      "title",
      "sourceCopyright",
      "copyright",
    ],
    "projectLicense",
  );
  const sourceSha256 = text(record.sourceSha256, "projectLicense.sourceSha256");
  const expectedSha256 = text(
    record.expectedSha256,
    "projectLicense.expectedSha256",
  );
  if (!HASH_PATTERN.test(sourceSha256) || !HASH_PATTERN.test(expectedSha256))
    throw new TypeError(
      "Project license digests must be lowercase SHA-256 values.",
    );
  const title = text(record.title, "projectLicense.title");
  const sourceCopyright = text(
    record.sourceCopyright,
    "projectLicense.sourceCopyright",
  );
  const copyright = text(record.copyright, "projectLicense.copyright");
  for (const [label, value] of [
    ["projectLicense.title", title],
    ["projectLicense.sourceCopyright", sourceCopyright],
    ["projectLicense.copyright", copyright],
  ]) {
    if (/\r|\n/u.test(value))
      throw new TypeError(`${label} must be a single physical line.`);
  }
  if (sourceCopyright === copyright)
    throw new TypeError(
      "projectLicense copyright transformation must replace the source placeholder.",
    );
  return {
    path: relativeRepoPath(record.path, "projectLicense.path"),
    sourceUrl: httpsUrl(record.sourceUrl, "projectLicense.sourceUrl"),
    sourcePath: relativeRepoPath(
      record.sourcePath,
      "projectLicense.sourcePath",
    ),
    sourceSha256,
    expectedSha256,
    title,
    sourceCopyright,
    copyright,
  };
}

function reviewedDecision(value, index) {
  const label = `reviewedDecisions[${index}]`;
  const record = plainRecord(value, label);
  exactFields(
    record,
    [
      "packageName",
      "version",
      "licenseExpression",
      "requiredScope",
      "disposition",
      "correspondingSourceUrl",
    ],
    label,
  );
  const requiredScope = text(record.requiredScope, `${label}.requiredScope`);
  if (requiredScope !== "production" && requiredScope !== "development-only")
    throw new TypeError(`${label}.requiredScope has an unknown value.`);
  const licenseExpression = text(
    record.licenseExpression,
    `${label}.licenseExpression`,
  );
  const correspondingSourceUrl =
    record.correspondingSourceUrl === undefined
      ? undefined
      : httpsUrl(
          record.correspondingSourceUrl,
          `${label}.correspondingSourceUrl`,
        );
  const disposition = text(record.disposition, `${label}.disposition`);
  if (/\b(?:allowlist|baseline|exception|waiver)s?\b/iu.test(disposition))
    throw new TypeError(
      `${label}.disposition must describe a legal disposition, not debt acceptance.`,
    );
  if (
    requiredScope === "production" &&
    spdxAtoms(licenseExpression).includes("MPL-2.0") &&
    correspondingSourceUrl === undefined
  ) {
    throw new TypeError(
      `${label} needs an exact corresponding-source URL for production MPL-2.0.`,
    );
  }
  return {
    packageName: text(record.packageName, `${label}.packageName`),
    version: text(record.version, `${label}.version`),
    licenseExpression,
    requiredScope,
    disposition,
    ...(correspondingSourceUrl ? { correspondingSourceUrl } : {}),
  };
}

function pinnedSource(value, index) {
  const label = `pinnedSources[${index}]`;
  const record = plainRecord(value, label);
  exactFields(
    record,
    [
      "packageName",
      "version",
      "licenseExpression",
      "sourcePath",
      "originUrl",
      "sha256",
      "packageResolved",
      "packageIntegrity",
    ],
    label,
  );
  const originUrl = httpsUrl(record.originUrl, `${label}.originUrl`);
  if (!COMMIT_IN_URL_PATTERN.test(new URL(originUrl).pathname))
    throw new TypeError(`${label}.originUrl must identify a full commit hash.`);
  const sha256 = text(record.sha256, `${label}.sha256`);
  if (!HASH_PATTERN.test(sha256))
    throw new TypeError(`${label}.sha256 must be a lowercase SHA-256 value.`);
  return {
    packageName: text(record.packageName, `${label}.packageName`),
    version: text(record.version, `${label}.version`),
    licenseExpression: text(
      record.licenseExpression,
      `${label}.licenseExpression`,
    ),
    sourcePath: relativeRepoPath(record.sourcePath, `${label}.sourcePath`),
    originUrl,
    sha256,
    packageResolved: httpsUrl(
      record.packageResolved,
      `${label}.packageResolved`,
    ),
    packageIntegrity: text(
      record.packageIntegrity,
      `${label}.packageIntegrity`,
    ),
  };
}

export function checkLegalSettings(value) {
  const record = plainRecord(value, "license settings");
  exactFields(
    record,
    [
      "$comment",
      "schemaVersion",
      "firstPartyLicense",
      "reportDirectory",
      "projectLicense",
      "automaticallyAcceptedLicenses",
      "deniedLicenses",
      "reviewedDecisions",
      "pinnedSources",
    ],
    "license settings",
  );
  if (record.schemaVersion !== 1)
    throw new TypeError("License settings schemaVersion must be 1.");
  if (
    !Array.isArray(record.reviewedDecisions) ||
    !Array.isArray(record.pinnedSources)
  )
    throw new TypeError(
      "License settings decisions and pinnedSources must be arrays.",
    );
  const automaticallyAcceptedLicenses = stringList(
    record.automaticallyAcceptedLicenses,
    "automaticallyAcceptedLicenses",
  );
  const deniedLicenses = stringList(record.deniedLicenses, "deniedLicenses");
  const overlap = automaticallyAcceptedLicenses.filter((item) =>
    deniedLicenses.includes(item),
  );
  if (overlap.length > 0)
    throw new TypeError(
      `Accepted and denied identifiers overlap: ${overlap.join(", ")}.`,
    );
  const reviewedDecisions = record.reviewedDecisions.map(reviewedDecision);
  const decisionKeys = reviewedDecisions.map(
    (entry) =>
      `${entry.packageName}\0${entry.version}\0${entry.licenseExpression}\0${entry.requiredScope}`,
  );
  if (new Set(decisionKeys).size !== decisionKeys.length)
    throw new TypeError("reviewedDecisions contains an exact duplicate.");
  const pinnedSources = record.pinnedSources.map(pinnedSource);
  const pinnedKeys = pinnedSources.map(
    (entry) =>
      `${entry.packageName}\0${entry.version}\0${entry.licenseExpression}`,
  );
  if (new Set(pinnedKeys).size !== pinnedKeys.length)
    throw new TypeError("pinnedSources contains an exact duplicate.");
  return {
    schemaVersion: 1,
    firstPartyLicense: text(record.firstPartyLicense, "firstPartyLicense"),
    reportDirectory: relativeRepoPath(
      record.reportDirectory,
      "reportDirectory",
    ),
    projectLicense: projectLicenseSettings(record.projectLicense),
    automaticallyAcceptedLicenses,
    deniedLicenses,
    reviewedDecisions,
    pinnedSources,
  };
}

export async function loadLegalSettings(
  repoRoot,
  settingsPath = DEFAULT_SETTINGS,
) {
  const absolute = path.isAbsolute(settingsPath)
    ? assertContainedAbsolute(repoRoot, settingsPath, "license settings path")
    : containedPath(repoRoot, settingsPath, "license settings path");
  let parsed;
  try {
    const relative = path
      .relative(repoRoot, absolute)
      .split(path.sep)
      .join("/");
    parsed = JSON.parse(
      (
        await readContainedRegularFile(
          repoRoot,
          relative,
          "license settings path",
        )
      ).toString("utf8"),
    );
  } catch (error) {
    throw new Error(
      `Unable to parse license settings at ${path.relative(repoRoot, absolute)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return checkLegalSettings(parsed);
}

export async function privateReportDirectory(repoRoot, relativeDirectory) {
  const directory = containedPath(
    repoRoot,
    relativeDirectory,
    "reportDirectory",
  );
  await rejectSymlinkSegments(repoRoot, relativeDirectory, "reportDirectory");
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  return directory;
}

export async function writePrivateFile(directory, fileName, contents) {
  if (!/^[a-z0-9][a-z0-9.-]*$/u.test(fileName))
    throw new TypeError("Private report filename is invalid.");
  const destination = containedPath(
    directory,
    fileName,
    "private report filename",
  );
  await rejectSymlinkSegments(directory, fileName, "private report filename");
  await fs.writeFile(destination, contents, { mode: 0o600 });
  await fs.chmod(destination, 0o600);
}
