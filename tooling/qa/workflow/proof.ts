import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export type ProofLane = "checkpoint" | "ci-proof" | "ci-release";
function receiptPath(lane: ProofLane) {
  return `.tmp/qa-proof/${lane}.json`;
}
function logDigest(root: string, path: string, lane: ProofLane): string {
  const absolute = resolve(root, path);
  const local = relative(resolve(root, ".tmp/qa-logs"), absolute);
  if (!local || local.startsWith(".."))
    throw new Error("Proof log must stay under QA logs.");
  const descriptor = openSync(
    absolute,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  let bytes: Buffer;
  try {
    if (!fstatSync(descriptor).isFile())
      throw new Error("Proof log must be a regular file.");
    bytes = readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  const text = bytes.toString("utf8");
  const lines = text.trimEnd().split("\n");
  if (
    !text.startsWith(
      `wrapper=${lane === "checkpoint" ? "qa:checkpoint" : lane.replace("ci-", "ci:")}\n`,
    ) ||
    lines.at(-3) !== "status=passed" ||
    !lines.at(-2)?.startsWith("finishedAt=") ||
    lines.at(-1) !== `log=${path}`
  )
    throw new Error("Checkpoint log did not pass.");
  return createHash("sha256").update(bytes).digest("hex");
}
export function removeProof(lane: ProofLane, root = process.cwd()): void {
  rmSync(join(root, receiptPath(lane)), { force: true });
}
export function recordProof(
  lane: ProofLane,
  digest: string,
  log: string,
  root = process.cwd(),
): void {
  const receipt = {
    version: 1,
    lane,
    digest,
    log,
    logDigest: logDigest(root, log, lane),
  };
  const path = join(root, receiptPath(lane));
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}`;
  writeFileSync(temporary, `${JSON.stringify(receipt)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  renameSync(temporary, path);
}
export function hasProof(
  lane: ProofLane,
  digest: string,
  root = process.cwd(),
): boolean {
  try {
    const value: unknown = JSON.parse(
      readFileSync(join(root, receiptPath(lane)), "utf8"),
    );
    return (
      value !== null &&
      typeof value === "object" &&
      "version" in value &&
      value.version === 1 &&
      "lane" in value &&
      value.lane === lane &&
      "digest" in value &&
      value.digest === digest &&
      "log" in value &&
      typeof value.log === "string" &&
      "logDigest" in value &&
      value.logDigest === logDigest(root, value.log, lane)
    );
  } catch {
    return false;
  }
}
