# External Review Lifecycle

Inspect the installed `porch` and `devin` help before use. Record the actual versions and selected model. Do not invent flags or install missing tools automatically.

Prefer the synchronous read-only review command:

```bash
porch review ask -a devin --prompt-file .tmp/reviews/review-prompt.txt
```

Use a prompt file with the complete bounded manifest and actual evidence paths. Request a fresh independent review. Prohibit edits, implementation, QA reruns, staging, commits, and further agents. Require concrete findings and a final verdict under the repository review contract.

The read-only profile supplies a tool boundary. A prompt alone does not enforce read-only access. Do not select an unrestricted permission mode for a review.

If `porch` is unavailable, inspect direct Devin CLI help. Use one foreground resumable child only when its permissions can enforce the authorized review scope. Do not start both paths. Missing authentication or an unavailable model requires a report to the user.

Preserve the owned executor session until terminal exit. Resume that handle to wait. Do not send status questions to stdin, infer completion from a file, or start a duplicate reviewer. Synchronous review has no detached review run ID.

For an explicitly requested status, read the owned execution state. Quiet output does not prove a hang. Do not inspect unrelated sessions or the host's application history.

On cancellation, stop only the owned process and check terminal state. Preserve any unexpected edits. Do not reset files or remove conversations. After a permission failure, distinguish a failed start from partial execution. Retry only after correcting the stated cause. Report a repeated failure.

A successful process exit is necessary but insufficient. Read the complete report and check the actual frozen diff. A changed candidate invalidates the independent review claim.
