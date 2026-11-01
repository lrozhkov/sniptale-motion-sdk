require("../process/environment.cjs");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

async function main() {
  const root = path.resolve(__dirname, "../..");
  /** @type {unknown} */
  const lock = JSON.parse(
    fs.readFileSync(
      path.join(root, "tooling/configs/ci/npm.lock.json"),
      "utf8",
    ),
  );
  if (
    !lock ||
    typeof lock !== "object" ||
    !("version" in lock) ||
    typeof lock.version !== "string" ||
    !("url" in lock) ||
    typeof lock.url !== "string" ||
    !("sha256" in lock) ||
    typeof lock.sha256 !== "string" ||
    !("publishedAt" in lock) ||
    typeof lock.publishedAt !== "string"
  )
    throw new Error("Invalid npm bootstrap lock.");
  if (
    !/^\d+\.\d+\.\d+$/u.test(lock.version) ||
    lock.url !== `https://registry.npmjs.org/npm/-/npm-${lock.version}.tgz` ||
    !/^[a-f0-9]{64}$/u.test(lock.sha256)
  )
    throw new Error("npm bootstrap must pin its official archive and SHA-256.");
  const published = Date.parse(lock.publishedAt);
  if (!Number.isFinite(published) || Date.now() - published < 7 * 86400000)
    throw new Error("npm bootstrap version must be at least seven days old.");
  const directory = path.join(root, ".tmp/ci/npm", lock.sha256);
  const cli = path.join(directory, "package/bin/npm-cli.js");
  const ready = path.join(directory, "verified");
  if (
    !fs.existsSync(cli) ||
    !fs.existsSync(ready) ||
    fs.readFileSync(ready, "utf8") !== lock.sha256
  ) {
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    const stage = fs.mkdtempSync(path.join(path.dirname(directory), "stage-"));
    try {
      const response = await fetch(lock.url, {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok)
        throw new Error(
          `Cannot download npm bootstrap: HTTP ${response.status}.`,
        );
      const bytes = Buffer.from(await response.arrayBuffer());
      if (
        crypto.createHash("sha256").update(bytes).digest("hex") !== lock.sha256
      )
        throw new Error("npm bootstrap SHA-256 mismatch.");
      const archive = path.join(stage, "npm.tgz");
      fs.writeFileSync(archive, bytes, { mode: 0o600 });
      const extracted = spawnSync("tar", ["-xzf", archive, "-C", stage], {
        stdio: "inherit",
        shell: false,
      });
      if (extracted.error) throw extracted.error;
      if (
        extracted.status !== 0 ||
        !fs.existsSync(path.join(stage, "package/bin/npm-cli.js"))
      )
        throw new Error("Cannot extract npm bootstrap.");
      fs.rmSync(archive);
      fs.writeFileSync(path.join(stage, "verified"), lock.sha256, {
        mode: 0o600,
      });
      fs.rmSync(directory, { recursive: true, force: true });
      fs.renameSync(stage, directory);
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
  }
  const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
/** @param {unknown} error */
function fail(error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
main().catch(fail);
