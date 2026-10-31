import semver from "semver";
import { MOTION_COMPATIBILITY } from "../../../shared/compatibility.js";

export const MINIMUM_UPDATE_AGE_DAYS = 7;
const PACKAGE = "@sniptale/motion";
const DAY = 86_400_000;
type ObjectValue = Record<string, unknown>;
export function record(value: unknown): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function compatible(value: ObjectValue, node: string): string[] {
  const reasons: string[] = [];
  const contract = value.sniptaleMotion;
  if (
    !record(contract) ||
    Object.entries(MOTION_COMPATIBILITY).some(
      ([key, expected]) => contract[key] !== expected,
    )
  )
    reasons.push("FORMAT_CONTRACT");
  if (
    !record(value.engines) ||
    typeof value.engines.node !== "string" ||
    !semver.validRange(value.engines.node) ||
    !semver.satisfies(node, value.engines.node)
  )
    reasons.push("NODE_VERSION");
  const dependencies = record(value.dependencies) ? value.dependencies : {};
  if (value.dependencies !== undefined && !record(value.dependencies))
    reasons.push("UNBUNDLED_DEPENDENCIES");
  const bundled: unknown =
    value.bundleDependencies ?? value.bundledDependencies;
  if (
    Object.keys(dependencies).length &&
    (!Array.isArray(bundled) ||
      bundled.length !== Object.keys(dependencies).length ||
      !bundled.every((name) => typeof name === "string") ||
      new Set(bundled).size !== bundled.length ||
      Object.entries(dependencies).some(
        ([name, version]) =>
          typeof version !== "string" ||
          semver.valid(version) !== version ||
          !bundled.includes(name),
      ))
  )
    reasons.push("UNBUNDLED_DEPENDENCIES");
  if (
    (value.optionalDependencies !== undefined &&
      (!record(value.optionalDependencies) ||
        Object.keys(value.optionalDependencies).length)) ||
    (value.peerDependencies !== undefined &&
      (!record(value.peerDependencies) ||
        Object.keys(value.peerDependencies).length))
  )
    reasons.push("UNBUNDLED_DEPENDENCIES");
  if (value.private !== undefined && value.private !== false)
    reasons.push("PRIVATE_PACKAGE");
  return [...new Set(reasons)];
}
export function assessUpdate(
  metadata: unknown,
  current: string,
  target: string | undefined,
  now: number,
  node: string,
) {
  if (
    semver.valid(current) !== current ||
    (target !== undefined && semver.valid(target) !== target)
  )
    throw new Error("UPDATE_VERSION");
  if (
    !record(metadata) ||
    metadata.name !== PACKAGE ||
    !record(metadata.versions) ||
    !record(metadata.time) ||
    !record(metadata["dist-tags"]) ||
    (metadata["dist-tags"].latest !== undefined &&
      (typeof metadata["dist-tags"].latest !== "string" ||
        semver.valid(metadata["dist-tags"].latest) !==
          metadata["dist-tags"].latest))
  )
    throw new Error("UPDATE_METADATA");
  const versions = metadata.versions;
  const times = metadata.time;
  const latest =
    typeof metadata["dist-tags"].latest === "string"
      ? metadata["dist-tags"].latest
      : null;
  const stable = Object.keys(versions)
    .filter(
      (version) =>
        semver.valid(version) === version &&
        semver.prerelease(version) === null &&
        latest !== null &&
        semver.lte(version, latest),
    )
    .sort(semver.rcompare);
  const age = (version: string): number | null => {
    const time = times[version];
    if (
      typeof time !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(time)
    )
      return null;
    const stamp = Date.parse(time);
    return Number.isFinite(stamp) &&
      new Date(stamp).toISOString() === time &&
      stamp <= now
      ? (now - stamp) / DAY
      : null;
  };
  const eligible = (version: string) => {
    const entry = versions[version];
    const days = age(version);
    return (
      days !== null &&
      days >= MINIMUM_UPDATE_AGE_DAYS &&
      record(entry) &&
      !entry.deprecated
    );
  };
  const selected = target ?? stable.find(eligible);
  if (!selected || !eligible(selected))
    return {
      ok: true,
      status: "deferred",
      current,
      latest,
      minimumAgeDays: MINIMUM_UPDATE_AGE_DAYS,
    };
  const value = versions[selected];
  if (
    !record(value) ||
    value.name !== PACKAGE ||
    value.version !== selected ||
    !record(value.dist) ||
    typeof value.dist.integrity !== "string" ||
    !/^sha512-[A-Za-z0-9+/]{86}==$/.test(value.dist.integrity)
  )
    throw new Error("UPDATE_METADATA");
  const reasons = compatible(value, node);
  const changed = semver.compare(selected, current);
  const status = reasons.length
    ? "incompatible"
    : changed > 0
      ? "available"
      : changed < 0 && target
        ? "rollback-available"
        : changed < 0
          ? "ahead-of-channel"
          : "up-to-date";
  const packageSpec = `${PACKAGE}@${selected}`;
  return {
    ok: true,
    status,
    current,
    latest,
    version: selected,
    ageDays: Math.floor(age(selected) ?? 0),
    latestDeferred: latest !== null && semver.gt(latest, selected),
    integrity: value.dist.integrity,
    minimumAgeDays: MINIMUM_UPDATE_AGE_DAYS,
    reasons,
    ...(status === "available" || status === "rollback-available"
      ? {
          install: {
            global: {
              command: "npm",
              args: [
                "install",
                "--global",
                packageSpec,
                "--ignore-scripts",
                "--engine-strict",
                "--registry",
                "https://registry.npmjs.org/",
              ],
            },
            npx: {
              command: "npx",
              args: [
                "--yes",
                "--ignore-scripts",
                "--registry",
                "https://registry.npmjs.org/",
                "--package",
                packageSpec,
                "sniptale-motion",
                "--version",
                "--json",
              ],
            },
          },
        }
      : {}),
  };
}
