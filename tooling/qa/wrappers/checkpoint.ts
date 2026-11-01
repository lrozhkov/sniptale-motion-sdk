import { initializeQaEnvironment } from "../runtime/environment.ts";
import { candidateDigest } from "../workflow/candidate.ts";
import { recordProof, removeProof } from "../workflow/proof.ts";
import { runQaWrapper } from "../runtime/wrapper-runner.ts";

initializeQaEnvironment();
if (process.argv.length > 2)
  throw new Error(
    "Checkpoint checks the complete candidate and accepts no arguments.",
  );
removeProof("checkpoint");
const candidate = candidateDigest();
const session = await runQaWrapper("qa:checkpoint", async ({ run }) => {
  await run("current candidate preflight", "npm", ["run", "qa:preflight"]);
  await run("format check", "npm", ["run", "format"]);
  await run("review registry", "npm", ["run", "qa:registry"]);
  await run("documentation structure", "npm", ["run", "qa:docs"]);
  await run("typecheck", "npm", ["run", "typecheck"]);
  await run("product lint", "npm", ["run", "lint:product"]);
  await run("tooling lint", "npm", ["run", "lint:tooling"]);
  await run("test lint", "npm", ["run", "lint:tests"]);
  await run("license audit", "npm", ["run", "qa:licenses"]);
  await run("legal closure", "npm", ["run", "release:legal:check"]);
  await run("unit tests", "npm", ["run", "test"]);
  await run("guardrails", "node", [
    "--import",
    "tsx",
    "tooling/qa/policy/guardrails.ts",
  ]);
});

if (session.status === "passed") {
  if (candidateDigest() !== candidate)
    throw new Error(
      "Candidate changed during checkpoint. Run checkpoint again.",
    );
  recordProof("checkpoint", candidate, session.logRelativePath);
}
