import type { QaRunSession } from "../runtime/wrapper-runner.ts";
import { candidateDigest, changedFiles, git } from "./candidate.ts";
import { hasProof } from "./proof.ts";
import { classifyScope } from "./scope.ts";
export async function closeCandidate(
  commitMessage: string,
  { run, writeStdout }: Pick<QaRunSession, "run" | "writeStdout">,
  root = process.cwd(),
): Promise<void> {
  const files = changedFiles(root);
  if (files.length === 0)
    throw new Error("There are no candidate changes to commit.");
  const candidate = candidateDigest(root);
  const scope = classifyScope(files);
  if (
    hasProof("ci-proof", candidate, root) ||
    hasProof("ci-release", candidate, root)
  ) {
    writeStdout("Reusing successful full CI proof for this exact candidate.\n");
  } else if (scope.coverage || scope.build || scope.security) {
    await run("complete repository proof", "npm", ["run", "ci:proof"]);
    if (!hasProof("ci-proof", candidate, root))
      throw new Error("CI did not prove this candidate.");
  } else if (!hasProof("checkpoint", candidate, root)) {
    await run("checkpoint", "npm", ["run", "qa:checkpoint"]);
    if (!hasProof("checkpoint", candidate, root))
      throw new Error("Checkpoint did not prove this candidate.");
  } else
    writeStdout("Reusing successful checkpoint for this exact candidate.\n");
  if (candidateDigest(root) !== candidate)
    throw new Error("Candidate changed during closeout. Nothing was staged.");
  const contents = candidateDigest(root, false);
  await run("git add", "git", ["add", "--all", "--", "."]);
  if (
    candidateDigest(root, false) !== contents ||
    git(root, ["diff", "--name-only", "-z"]).length !== 0 ||
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).length !== 0
  )
    throw new Error("Worktree changed during staging. Commit cancelled.");
  await run("git commit", "git", ["commit", "-m", commitMessage]);
}
