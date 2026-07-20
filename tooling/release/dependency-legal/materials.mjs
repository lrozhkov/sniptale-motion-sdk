import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  assertContainedAbsolute,
  containedPath,
  loadLegalSettings,
  readContainedRegularFile,
  rejectSymlinkSegments,
  spdxAtoms,
} from "./boundary.mjs";
import { inspectLegalState } from "./compliance.mjs";
import { openPackageLock, productionInventory } from "./inventory.mjs";

const MANIFEST_FILE = "THIRD_PARTY_DEPENDENCIES.json";
const NOTICES_FILE = "THIRD_PARTY_NOTICES.md";
const ARTIFACT_DIRECTORY = "LICENSES/dependencies";

function codePointOrder(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function readRepositoryFile(repoRoot, relative, label) {
  return readContainedRegularFile(repoRoot, relative, label);
}

function legalFileRank(fileName, family) {
  const lower = fileName.toLowerCase();
  if (lower === family) return 0;
  if (lower.startsWith(`${family}.`)) return 1;
  return Number.POSITIVE_INFINITY;
}

async function chooseInstalledFile(repoRoot, packagePath, families) {
  const directory = containedPath(
    repoRoot,
    packagePath,
    "installed package path",
  );
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Installed package directory is unavailable for ${packagePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const choices = entries
    .filter((entry) => entry.isFile())
    .flatMap((entry) =>
      families.map((family, familyIndex) => ({
        name: entry.name,
        score: familyIndex * 2 + legalFileRank(entry.name, family),
      })),
    )
    .filter((entry) => Number.isFinite(entry.score))
    .sort(
      (left, right) =>
        left.score - right.score || codePointOrder(left.name, right.name),
    );
  if (choices.length === 0) return undefined;
  const source = `${packagePath}/${choices[0].name}`;
  return {
    source,
    contents: await readRepositoryFile(
      repoRoot,
      source,
      "installed legal text",
    ),
  };
}

function artifactStem(packageName, version) {
  const stem = `${packageName.replace("/", "__")}-${version}`;
  if (
    !/^@[a-z0-9._-]+__[a-z0-9._-]+-[a-z0-9.+_-]+$|^[a-z0-9][a-z0-9._-]*-[a-z0-9.+_-]+$/iu.test(
      stem,
    )
  )
    throw new TypeError(
      `Package identity cannot be represented as a legal artifact filename: ${packageName}@${version}.`,
    );
  return stem;
}

function repositoryUrl(packageDocument, packageResolved) {
  const raw =
    typeof packageDocument.repository === "string"
      ? packageDocument.repository
      : packageDocument.repository?.url;
  if (typeof raw !== "string" || raw === "") return packageResolved;
  if (raw.startsWith("git+https://")) return raw.slice(4);
  if (raw.startsWith("git://")) return `https://${raw.slice("git://".length)}`;
  if (/^[a-z0-9._-]+\/[a-z0-9._-]+$/iu.test(raw))
    return `https://github.com/${raw}`;
  return raw;
}

function matchingDecision(component, settings) {
  return settings.reviewedDecisions.find(
    (entry) =>
      entry.packageName === component.packageName &&
      entry.version === component.version &&
      entry.licenseExpression === component.licenseExpression &&
      entry.requiredScope === "production",
  );
}

async function installedMetadata(repoRoot, component) {
  const source = `${component.packagePath}/package.json`;
  let document;
  try {
    document = JSON.parse(
      (
        await readRepositoryFile(repoRoot, source, "installed package metadata")
      ).toString("utf8"),
    );
  } catch (error) {
    throw new Error(
      `Installed metadata is invalid for ${component.packageName}@${component.version}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    document.name !== component.packageName ||
    document.version !== component.version ||
    document.license !== component.licenseExpression
  ) {
    throw new Error(
      `Installed metadata differs from package-lock for ${component.packagePath}.`,
    );
  }
  return document;
}

async function legalMaterialFor(repoRoot, component, settings) {
  const pinned = settings.pinnedSources.find(
    (entry) =>
      entry.packageName === component.packageName &&
      entry.version === component.version &&
      entry.licenseExpression === component.licenseExpression,
  );
  if (pinned) {
    if (
      pinned.packageResolved !== component.resolved ||
      pinned.packageIntegrity !== component.integrity
    )
      throw new Error(
        `Pinned provenance no longer identifies the locked package ${component.packageName}@${component.version}.`,
      );
    const contents = await readRepositoryFile(
      repoRoot,
      pinned.sourcePath,
      "pinned license text",
    );
    if (sha256(contents) !== pinned.sha256)
      throw new Error(
        `Pinned license bytes changed for ${component.packageName}@${component.version}.`,
      );
    return {
      kind: "pinned-upstream",
      source: pinned.sourcePath,
      contents,
      provenance: {
        originUrl: pinned.originUrl,
        sha256: pinned.sha256,
        sourcePath: pinned.sourcePath,
      },
    };
  }
  const installed = await chooseInstalledFile(repoRoot, component.packagePath, [
    "license",
    "licence",
    "copying",
  ]);
  if (!installed)
    throw new Error(
      `No distributable offline license file exists for ${component.packageName}@${component.version}.`,
    );
  return { kind: "installed-file", ...installed };
}

export async function assembleLegalBundle({
  repoRoot = process.cwd(),
  lockfilePath = "package-lock.json",
  settingsPath,
} = {}) {
  const audit = await inspectLegalState({
    repoRoot,
    lockfilePath,
    settingsPath,
  });
  if (audit.status !== "passed")
    throw new Error(
      `Legal material assembly stopped because the full inventory has ${audit.findings.length} compliance finding(s).`,
    );
  const settings = await loadLegalSettings(repoRoot, settingsPath);
  const { packages } = await openPackageLock(repoRoot, lockfilePath);
  const components = productionInventory(packages);
  const entries = [];
  const licenseFiles = [];
  const occupiedPaths = new Set();

  for (const component of components) {
    const metadata = await installedMetadata(repoRoot, component);
    const material = await legalMaterialFor(repoRoot, component, settings);
    const stem = artifactStem(component.packageName, component.version);
    const archivePath = `${ARTIFACT_DIRECTORY}/${stem}.txt`;
    if (occupiedPaths.has(archivePath))
      throw new Error(
        `Two production records map to the same legal artifact: ${archivePath}.`,
      );
    occupiedPaths.add(archivePath);
    const noticeMaterial = await chooseInstalledFile(
      repoRoot,
      component.packagePath,
      ["notice"],
    );
    const decision = matchingDecision(component, settings);
    const correspondingSourceUrl = spdxAtoms(
      component.licenseExpression,
    ).includes("MPL-2.0")
      ? decision?.correspondingSourceUrl
      : undefined;
    if (
      correspondingSourceUrl !== undefined &&
      correspondingSourceUrl !== component.resolved
    )
      throw new Error(
        `Corresponding source is not the locked tarball for ${component.packageName}@${component.version}.`,
      );

    const entry = {
      packageName: component.packageName,
      version: component.version,
      packagePath: component.packagePath,
      licenseExpression: component.licenseExpression,
      licenseSourceKind: material.kind,
      licenseSource: material.source,
      archivePath,
      sha256: sha256(material.contents),
      sourceUrl: repositoryUrl(metadata, component.resolved),
      packageResolved: component.resolved,
      ...(material.provenance
        ? { licenseProvenance: material.provenance }
        : {}),
      ...(correspondingSourceUrl ? { correspondingSourceUrl } : {}),
      ...(noticeMaterial
        ? {
            notice: {
              source: noticeMaterial.source,
              archivePath: `${ARTIFACT_DIRECTORY}/${stem}.NOTICE.txt`,
              sha256: sha256(noticeMaterial.contents),
            },
          }
        : {}),
    };
    entries.push(entry);
    licenseFiles.push({ archivePath, contents: material.contents });
    if (noticeMaterial)
      licenseFiles.push({
        archivePath: entry.notice.archivePath,
        contents: noticeMaterial.contents,
      });
  }
  return { entries, licenseFiles };
}

export function renderDependencyManifest(entries) {
  return `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`;
}

export function renderThirdPartyNotices(entries) {
  const lines = [
    "# Third-party notices",
    "",
    "This file is generated from the production dependency graph in package-lock.json. Every redistributed legal file is preserved byte-for-byte.",
    "",
  ];
  for (const entry of entries) {
    lines.push(
      `## \`${entry.packageName}\` ${entry.version}`,
      "",
      `License expression: \`${entry.licenseExpression}\``,
      "",
      `Installed package: \`${entry.packagePath}\``,
      "",
      `License input: \`${entry.licenseSource}\``,
      "",
      `Redistributed license: [\`${entry.archivePath}\`](${entry.archivePath})`,
      "",
      `License SHA-256: \`${entry.sha256}\``,
      "",
      `Package repository: ${entry.sourceUrl}`,
      "",
      `Locked package tarball: ${entry.packageResolved}`,
      "",
    );
    if (entry.licenseProvenance) {
      lines.push(
        `Commit-addressed license origin: ${entry.licenseProvenance.originUrl}`,
        "",
        `Pinned license SHA-256: \`${entry.licenseProvenance.sha256}\``,
        "",
      );
    }
    if (entry.correspondingSourceUrl)
      lines.push(
        `MPL corresponding source: ${entry.correspondingSourceUrl}`,
        "",
      );
    if (entry.notice)
      lines.push(
        `Upstream notice: [\`${entry.notice.archivePath}\`](${entry.notice.archivePath})`,
        "",
        `Notice SHA-256: \`${entry.notice.sha256}\``,
        "",
      );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function exactModelObject(value, required, optional, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError(`${label} must be a plain object.`);
  for (const field of required) {
    if (!Object.hasOwn(value, field))
      throw new TypeError(`${label}.${field} is required.`);
  }
  for (const field of Object.keys(value)) {
    if (!required.includes(field) && !optional.includes(field))
      throw new TypeError(`${label}.${field} is not part of the exact schema.`);
  }
  return value;
}

function modelString(value, label) {
  if (typeof value !== "string" || value === "")
    throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

function modelSha256(value, label) {
  const checked = modelString(value, label);
  if (!/^[a-f0-9]{64}$/u.test(checked))
    throw new TypeError(`${label} must be a lowercase SHA-256 value.`);
  return checked;
}

function modelHttpsUrl(value, label) {
  const checked = modelString(value, label);
  let parsed;
  try {
    parsed = new URL(checked);
  } catch {
    throw new TypeError(`${label} must be an HTTPS URL.`);
  }
  if (parsed.protocol !== "https:")
    throw new TypeError(`${label} must be an HTTPS URL.`);
  return checked;
}

function modelRelativePath(value, label) {
  const checked = modelString(value, label);
  containedPath("/bundle-root", checked, label);
  return checked;
}

function validateManifestEntry(rawEntry, index) {
  const label = `legal bundle entry[${index}]`;
  const entry = exactModelObject(
    rawEntry,
    [
      "packageName",
      "version",
      "packagePath",
      "licenseExpression",
      "licenseSourceKind",
      "licenseSource",
      "archivePath",
      "sha256",
      "sourceUrl",
      "packageResolved",
    ],
    ["licenseProvenance", "correspondingSourceUrl", "notice"],
    label,
  );
  const packageName = modelString(entry.packageName, `${label}.packageName`);
  const version = modelString(entry.version, `${label}.version`);
  const packagePath = modelRelativePath(
    entry.packagePath,
    `${label}.packagePath`,
  );
  const expectedPackageSuffix = `node_modules/${packageName}`;
  if (
    packagePath !== expectedPackageSuffix &&
    !packagePath.endsWith(`/${expectedPackageSuffix}`)
  )
    throw new TypeError(
      `${label}.packagePath does not own the package identity.`,
    );
  const licenseExpression = modelString(
    entry.licenseExpression,
    `${label}.licenseExpression`,
  );
  if (
    entry.licenseSourceKind !== "installed-file" &&
    entry.licenseSourceKind !== "pinned-upstream"
  )
    throw new TypeError(`${label}.licenseSourceKind has an unknown value.`);
  const licenseSource = modelRelativePath(
    entry.licenseSource,
    `${label}.licenseSource`,
  );
  const expectedArchivePath = `${ARTIFACT_DIRECTORY}/${artifactStem(packageName, version)}.txt`;
  if (entry.archivePath !== expectedArchivePath)
    throw new TypeError(
      `${label}.archivePath does not match the package identity.`,
    );
  modelRelativePath(entry.archivePath, `${label}.archivePath`);
  const licenseDigest = modelSha256(entry.sha256, `${label}.sha256`);
  modelHttpsUrl(entry.sourceUrl, `${label}.sourceUrl`);
  const packageResolved = modelHttpsUrl(
    entry.packageResolved,
    `${label}.packageResolved`,
  );

  if (entry.licenseSourceKind === "pinned-upstream") {
    const provenance = exactModelObject(
      entry.licenseProvenance,
      ["originUrl", "sha256", "sourcePath"],
      [],
      `${label}.licenseProvenance`,
    );
    modelHttpsUrl(provenance.originUrl, `${label}.licenseProvenance.originUrl`);
    if (
      modelSha256(provenance.sha256, `${label}.licenseProvenance.sha256`) !==
        licenseDigest ||
      modelRelativePath(
        provenance.sourcePath,
        `${label}.licenseProvenance.sourcePath`,
      ) !== licenseSource
    )
      throw new TypeError(
        `${label}.licenseProvenance differs from the license input.`,
      );
  } else if (entry.licenseProvenance !== undefined) {
    throw new TypeError(
      `${label}.licenseProvenance is only valid for pinned-upstream text.`,
    );
  }

  if (entry.notice !== undefined) {
    const notice = exactModelObject(
      entry.notice,
      ["source", "archivePath", "sha256"],
      [],
      `${label}.notice`,
    );
    modelRelativePath(notice.source, `${label}.notice.source`);
    const expectedNoticePath = `${ARTIFACT_DIRECTORY}/${artifactStem(packageName, version)}.NOTICE.txt`;
    if (notice.archivePath !== expectedNoticePath)
      throw new TypeError(
        `${label}.notice.archivePath does not match the package identity.`,
      );
    modelRelativePath(notice.archivePath, `${label}.notice.archivePath`);
    modelSha256(notice.sha256, `${label}.notice.sha256`);
  }

  const hasMpl = spdxAtoms(licenseExpression).includes("MPL-2.0");
  if (hasMpl) {
    const correspondingSourceUrl = modelHttpsUrl(
      entry.correspondingSourceUrl,
      `${label}.correspondingSourceUrl`,
    );
    if (correspondingSourceUrl !== packageResolved)
      throw new TypeError(
        `${label}.correspondingSourceUrl must equal the exact locked packageResolved URL.`,
      );
  } else if (entry.correspondingSourceUrl !== undefined) {
    throw new TypeError(
      `${label}.correspondingSourceUrl is only valid for MPL-2.0.`,
    );
  }
  return entry;
}

function verifyBundleModel(rawBundle) {
  const bundle = exactModelObject(
    rawBundle,
    ["entries", "licenseFiles"],
    [],
    "legal bundle",
  );
  if (!Array.isArray(bundle.entries) || !Array.isArray(bundle.licenseFiles))
    throw new TypeError(
      "Legal bundle entries and licenseFiles must be arrays.",
    );
  const byPath = new Map();
  for (const [index, rawArtifact] of bundle.licenseFiles.entries()) {
    const artifact = exactModelObject(
      rawArtifact,
      ["archivePath", "contents"],
      [],
      `legal bundle artifact[${index}]`,
    );
    if (!Buffer.isBuffer(artifact.contents))
      throw new TypeError(
        `legal bundle artifact[${index}].contents must be a Buffer.`,
      );
    modelRelativePath(
      artifact.archivePath,
      `legal bundle artifact[${index}].archivePath`,
    );
    if (!artifact.archivePath.startsWith(`${ARTIFACT_DIRECTORY}/`))
      throw new TypeError(
        `Legal artifact path is outside ${ARTIFACT_DIRECTORY}: ${artifact.archivePath}.`,
      );
    if (byPath.has(artifact.archivePath))
      throw new TypeError(
        `Duplicate legal artifact path: ${artifact.archivePath}.`,
      );
    byPath.set(artifact.archivePath, artifact.contents);
  }
  const referencedPaths = new Set();
  for (const [index, rawEntry] of bundle.entries.entries()) {
    const entry = validateManifestEntry(rawEntry, index);
    if (referencedPaths.has(entry.archivePath))
      throw new TypeError(
        `Two manifest entries reference ${entry.archivePath}.`,
      );
    referencedPaths.add(entry.archivePath);
    const contents = byPath.get(entry.archivePath);
    if (!contents || sha256(contents) !== entry.sha256)
      throw new Error(
        `License bytes do not match the manifest digest for ${entry.archivePath}.`,
      );
    if (entry.notice) {
      const noticeContents = byPath.get(entry.notice.archivePath);
      if (!noticeContents || sha256(noticeContents) !== entry.notice.sha256)
        throw new Error(
          `Notice bytes do not match the manifest digest for ${entry.notice.archivePath}.`,
        );
      if (referencedPaths.has(entry.notice.archivePath))
        throw new TypeError(
          `Two manifest entries reference ${entry.notice.archivePath}.`,
        );
      referencedPaths.add(entry.notice.archivePath);
    }
  }
  if (
    referencedPaths.size !== byPath.size ||
    [...byPath.keys()].some((archivePath) => !referencedPaths.has(archivePath))
  )
    throw new TypeError(
      "Legal bundle contains an artifact without an exact manifest owner.",
    );
  return byPath;
}

async function writeOwnedFile(outputRoot, relative, contents) {
  const destination = containedPath(
    outputRoot,
    relative,
    "generated legal output path",
  );
  await rejectSymlinkSegments(
    outputRoot,
    relative,
    "generated legal output path",
  );
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, contents);
}

export async function publishLegalBundle({ bundle, outputRoot }) {
  const files = verifyBundleModel(bundle);
  const root = path.resolve(outputRoot);
  const artifactRoot = containedPath(
    root,
    ARTIFACT_DIRECTORY,
    "generated artifact directory",
  );
  await rejectSymlinkSegments(
    root,
    ARTIFACT_DIRECTORY,
    "generated artifact directory",
  );
  await fs.rm(artifactRoot, { recursive: true, force: true });
  await fs.mkdir(artifactRoot, { recursive: true });
  for (const [archivePath, contents] of [...files].sort(([left], [right]) =>
    codePointOrder(left, right),
  ))
    await writeOwnedFile(root, archivePath, contents);
  await writeOwnedFile(
    root,
    MANIFEST_FILE,
    renderDependencyManifest(bundle.entries),
  );
  await writeOwnedFile(
    root,
    NOTICES_FILE,
    renderThirdPartyNotices(bundle.entries),
  );
}

async function regularFileBytes(root, relative) {
  await rejectSymlinkSegments(root, relative, "validated legal output path");
  const destination = containedPath(
    root,
    relative,
    "validated legal output path",
  );
  try {
    const stat = await fs.lstat(destination);
    if (!stat.isFile()) return undefined;
    return await fs.readFile(destination);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT")
      return undefined;
    throw error;
  }
}

function validationFinding(code, target) {
  return { code, target };
}

export async function compareLegalBundle({ bundle, outputRoot }) {
  const files = verifyBundleModel(bundle);
  const root = path.resolve(outputRoot);
  const findings = [];
  const artifactRoot = containedPath(
    root,
    ARTIFACT_DIRECTORY,
    "validated artifact directory",
  );
  await rejectSymlinkSegments(
    root,
    ARTIFACT_DIRECTORY,
    "validated artifact directory",
  );
  let actualNames = [];
  try {
    const dirents = await fs.readdir(artifactRoot, { withFileTypes: true });
    actualNames = dirents
      .map((entry) => `${entry.name}${entry.isFile() ? "" : "/"}`)
      .sort();
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT"))
      throw error;
  }
  const expectedNames = [...files.keys()]
    .map((relative) => path.posix.basename(relative))
    .sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames))
    findings.push(
      validationFinding("artifact-inventory-mismatch", ARTIFACT_DIRECTORY),
    );

  for (const [relative, expected] of files) {
    const actual = await regularFileBytes(root, relative);
    if (!actual || !actual.equals(expected))
      findings.push(validationFinding("artifact-byte-mismatch", relative));
  }
  for (const [relative, expected] of [
    [MANIFEST_FILE, Buffer.from(renderDependencyManifest(bundle.entries))],
    [NOTICES_FILE, Buffer.from(renderThirdPartyNotices(bundle.entries))],
  ]) {
    const actual = await regularFileBytes(root, relative);
    if (!actual || !actual.equals(expected))
      findings.push(
        validationFinding("generated-document-byte-mismatch", relative),
      );
  }
  return findings.sort((left, right) =>
    codePointOrder(
      `${left.code}\0${left.target}`,
      `${right.code}\0${right.target}`,
    ),
  );
}
