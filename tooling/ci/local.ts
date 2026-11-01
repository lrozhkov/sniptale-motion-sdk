import { initializeQaEnvironment } from "../qa/runtime/environment.ts";
import { recordProof, removeProof } from "../qa/workflow/proof.ts";
import { candidateDigest } from "../qa/workflow/candidate.ts";
import { runQaWrapper } from "../qa/runtime/wrapper-runner.ts";

initializeQaEnvironment();
const mode = process.argv[2];
if ((mode !== "proof" && mode !== "release") || process.argv.length !== 3)
  throw new Error(
    "Usage: local.ts <proof|release>. Both modes check the full repository without publication.",
  );
const lane = mode === "proof" ? "ci-proof" : "ci-release";
removeProof(lane);
const candidate = candidateDigest();
const session = await runQaWrapper(`ci:${mode}`, async ({ run }) => {
  await run("pinned audit tools", "npm", ["run", "ci:tools"]);
  await run("pinned CodeQL bundle", "npm", ["run", "ci:codeql:install"]);
  await run("controlled Chromium", "node", [
    "node_modules/playwright-core/cli.js",
    "install",
    "chromium",
  ]);
  await run("workflow syntax and security", "npm", ["run", "lint:ci"]);
  await run("checkpoint, coverage, builds and browser smoke", "npm", [
    "run",
    "qa",
  ]);
  await run("duplication", "npm", ["run", "qa:duplicates"]);
  await run("supply chain and secrets", "npm", ["run", "qa:security"]);
  await run("CodeQL", "npm", ["run", "qa:codeql"]);
  if (mode === "release") {
    await run("npm candidate", "npm", ["run", "build:npm"]);
    await run("npm installation acceptance", "npm", ["run", "test:npm"]);
  }
  if (candidateDigest() !== candidate)
    throw new Error("Candidate changed during local CI. Proof is invalid.");
});

if (session.status === "passed") {
  if (candidateDigest() !== candidate)
    throw new Error("Candidate changed before CI proof recording.");
  recordProof(lane, candidate, session.logRelativePath);
}
