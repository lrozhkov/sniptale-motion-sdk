import type { RegistryMetadata, RegistryPackage } from "./dependency-model.ts";

export async function readDependencyEvidence(
  url: string,
  limit: number,
): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
    headers: {
      "User-Agent": "sniptale-motion-dependency-audit",
      Accept: "application/json",
    },
  });
  if (!response.ok || !response.body)
    throw new Error(
      `Dependency evidence unavailable: ${response.status} ${url}`,
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    if (!(chunk instanceof Uint8Array))
      throw new Error(`Invalid dependency evidence bytes: ${url}`);
    size += chunk.length;
    if (size > limit)
      throw new Error(`Dependency evidence exceeds its size limit: ${url}`);
    chunks.push(chunk);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  return value;
}

/** Project only the versions whose lock identities will be checked. */
export function readRegistryEvidence(
  value: unknown,
  name: string,
  packages: readonly RegistryPackage[],
): RegistryMetadata {
  if (
    !isRecord(value) ||
    value.name !== name ||
    !isRecord(value.time) ||
    !isRecord(value.versions)
  )
    throw new Error(`Invalid registry metadata: ${name}`);
  const time: Record<string, string> = {};
  const versions: Record<
    string,
    { dist: { integrity: string; tarball: string } }
  > = {};
  for (const entry of packages) {
    if (entry.name !== name) continue;
    const published = value.time[entry.version];
    const version = value.versions[entry.version];
    if (
      typeof published !== "string" ||
      !isRecord(version) ||
      !isRecord(version.dist) ||
      typeof version.dist.integrity !== "string" ||
      typeof version.dist.tarball !== "string"
    )
      throw new Error(`Invalid registry metadata: ${name}@${entry.version}`);
    time[entry.version] = published;
    versions[entry.version] = {
      dist: {
        integrity: version.dist.integrity,
        tarball: version.dist.tarball,
      },
    };
  }
  return { time, versions };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
