---
name: security-code-review
description: "Review changed SDK trust boundaries, asset validation, sandbox messages, paths, secrets, publication, or CI permissions."
---

# Security Code Review

Trace supported or hostile input to the affected authority. Check rejection and recovery behavior. Identify any retained threat-model assumption. Read `docs/security/security-model.md`.

## Review procedure

Read `AGENTS.md` and the relevant owner documents in `docs/README.md`. Read [the checklist](references/security-review-checklist.md).

The main agent must start a fresh independent read-only reviewer with `fork_turns: "none"`. Supply the exact diff, new files, acceptance criteria, consumers, preflight result, QA results, and known limitations. Do not supply a desired verdict. Candidate review requires a complete manifest and successful applicable QA. Planning review must state which checks did not run.

The reviewer must not edit files, install tools, run QA wrappers, stage, or commit. Inspect the supplied evidence and nearby consumers. Report missing proof explicitly. A missing check is not evidence of a defect.

Classify findings as `security issue`, `current regression`, `acceptance blocker`, or `pre-existing hardening`, in that order. The first three classes block approval. Show the reachable trigger, violated invariant, impact, file and line, and smallest correction. Report pre-existing hardening only when it affects the verdict or the user requests an inventory.

List findings first. Then state assumptions, missing evidence, and `Approve`, `Approve with comments`, or `Request changes`. Do not add speculative requirements. State whether each correction changes behavior, ownership, public contracts, dependency direction, parser semantics, or security authority. Such changes require another applicable review. Mechanical cleanup alone does not.

Check review applicability against the actual diff. Routing omissions do not cancel required review. For persistence changes, check the concurrency cases and test evidence required by `AGENTS.md`. Check reasons for inapplicable cases. Keep hypotheses separate from established defects. Identify scope expansion instead of silently adding requirements.
