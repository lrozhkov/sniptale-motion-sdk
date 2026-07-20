import { createHash } from "node:crypto";

import {
  loadLegalSettings,
  readContainedRegularFile,
  spdxAtoms,
} from "./boundary.mjs";
import { fullInventory, openPackageLock } from "./inventory.mjs";

function codePointOrder(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function decisionKey(entry) {
  return `${entry.packageName}\0${entry.version}\0${entry.licenseExpression}\0${entry.requiredScope}`;
}

function componentKey(entry) {
  return `${entry.packageName}\0${entry.version}\0${entry.licenseExpression}\0${entry.scope}`;
}

function issue(code, summary, component) {
  return {
    code,
    summary,
    ...(component
      ? {
          packageName: component.packageName,
          version: component.version,
          packagePath: component.packagePath,
        }
      : {}),
  };
}

async function firstPartyIssues(repoRoot, rootRecord, settings) {
  const issues = [];
  const legalBytes = new Map();
  let packageDocument;
  try {
    packageDocument = JSON.parse(
      (
        await readContainedRegularFile(
          repoRoot,
          "package.json",
          "package.json path",
        )
      ).toString("utf8"),
    );
  } catch (error) {
    issues.push(
      issue(
        "project-package-unreadable",
        `package.json is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return issues;
  }
  if (packageDocument.license !== settings.firstPartyLicense)
    issues.push(
      issue(
        "project-license-metadata",
        "package.json does not declare the configured first-party license.",
      ),
    );
  if (rootRecord.license !== settings.firstPartyLicense)
    issues.push(
      issue(
        "lock-root-license-metadata",
        "The lockfile root does not declare the configured first-party license.",
      ),
    );
  if (
    packageDocument.name !== rootRecord.name ||
    packageDocument.version !== rootRecord.version
  )
    issues.push(
      issue(
        "lock-root-identity",
        "package.json and the lockfile root describe different releases.",
      ),
    );

  for (const target of [
    {
      code: "osi-source-bytes",
      path: settings.projectLicense.sourcePath,
      expected: settings.projectLicense.sourceSha256,
    },
    {
      code: "project-license-bytes",
      path: settings.projectLicense.path,
      expected: settings.projectLicense.expectedSha256,
    },
  ]) {
    try {
      const contents = await readContainedRegularFile(
        repoRoot,
        target.path,
        target.path,
      );
      legalBytes.set(target.path, contents);
      if (digest(contents) !== target.expected)
        issues.push(
          issue(
            target.code,
            `${target.path} does not match its reviewed SHA-256.`,
          ),
        );
    } catch (error) {
      issues.push(
        issue(
          target.code,
          `${target.path} cannot be read: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
  const source = legalBytes.get(settings.projectLicense.sourcePath);
  const license = legalBytes.get(settings.projectLicense.path);
  if (source && license) {
    const sourceText = source.toString("utf8");
    const placeholderMatches = sourceText.split(
      settings.projectLicense.sourceCopyright,
    ).length;
    if (placeholderMatches !== 2) {
      issues.push(
        issue(
          "project-license-transformation",
          `${settings.projectLicense.sourcePath} must contain the configured copyright placeholder exactly once.`,
        ),
      );
    } else {
      const expectedLicense = Buffer.from(
        `${settings.projectLicense.title}\n\n${sourceText.replace(
          settings.projectLicense.sourceCopyright,
          settings.projectLicense.copyright,
        )}`,
        "utf8",
      );
      if (!license.equals(expectedLicense)) {
        issues.push(
          issue(
            "project-license-transformation",
            `${settings.projectLicense.path} is not the exact title and copyright transformation of the acquired source.`,
          ),
        );
      }
    }
  }
  return issues;
}

function componentIssues(component, settings) {
  const atoms = spdxAtoms(component.licenseExpression);
  const denied = atoms.filter((identifier) =>
    settings.deniedLicenses.includes(identifier),
  );
  if (denied.length > 0)
    return [
      issue(
        "denied-spdx-identifier",
        `Blocked SPDX identifier(s): ${denied.join(", ")}.`,
        component,
      ),
    ];

  const exactDecision = settings.reviewedDecisions.find(
    (entry) => decisionKey(entry) === componentKey(component),
  );
  if (exactDecision) {
    if (
      exactDecision.correspondingSourceUrl !== undefined &&
      exactDecision.correspondingSourceUrl !== component.resolved
    ) {
      return [
        issue(
          "corresponding-source-mismatch",
          "The reviewed corresponding-source URL is not the exact locked tarball URL.",
          component,
        ),
      ];
    }
    if (
      component.scope === "production" &&
      atoms.includes("MPL-2.0") &&
      exactDecision.correspondingSourceUrl !== component.resolved
    ) {
      return [
        issue(
          "production-mpl-source-missing",
          "A production MPL-2.0 expression must identify the exact locked source tarball.",
          component,
        ),
      ];
    }
    return [];
  }

  if (
    settings.automaticallyAcceptedLicenses.includes(component.licenseExpression)
  )
    return [];
  const identityWasReviewed = settings.reviewedDecisions.some(
    (entry) =>
      entry.packageName === component.packageName &&
      entry.version === component.version,
  );
  return [
    issue(
      identityWasReviewed
        ? "reviewed-decision-no-longer-exact"
        : "license-needs-review",
      identityWasReviewed
        ? "The locked license expression or scope differs from the reviewed decision."
        : `No exact legal decision exists for ${component.licenseExpression}.`,
      component,
    ),
  ];
}

function orderedCounts(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => codePointOrder(left, right)),
  );
}

export async function inspectLegalState({
  repoRoot = process.cwd(),
  lockfilePath = "package-lock.json",
  settingsPath,
} = {}) {
  const settings = await loadLegalSettings(repoRoot, settingsPath);
  const { packages } = await openPackageLock(repoRoot, lockfilePath);
  const components = fullInventory(packages);
  const issues = await firstPartyIssues(repoRoot, packages[""], settings);
  for (const component of components)
    issues.push(...componentIssues(component, settings));

  const liveKeys = new Set(components.map(componentKey));
  for (const decision of settings.reviewedDecisions) {
    if (!liveKeys.has(decisionKey(decision)))
      issues.push(
        issue(
          "obsolete-reviewed-decision",
          `No lockfile record matches ${decision.packageName}@${decision.version}, ${decision.licenseExpression}, ${decision.requiredScope}.`,
        ),
      );
  }
  issues.sort((left, right) =>
    codePointOrder(
      `${left.code}\0${left.packagePath ?? ""}\0${left.summary}`,
      `${right.code}\0${right.packagePath ?? ""}\0${right.summary}`,
    ),
  );
  return {
    schemaVersion: 1,
    status: issues.length === 0 ? "passed" : "failed",
    packageCount: components.length,
    scopeCounts: orderedCounts(components.map((entry) => entry.scope)),
    licenseCounts: orderedCounts(
      components.map((entry) => entry.licenseExpression),
    ),
    components,
    findings: issues,
    settings,
    packages,
  };
}
