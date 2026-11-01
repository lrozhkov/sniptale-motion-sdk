---
name: architecture-code-review
description: "Review changed SDK ownership, state authority, public contracts, parsing, i18n, or dependency direction."
---

# Architecture Code Review

Review the changed owner and its consumers. Classify the implemented structure as `Split`, `Consolidate`, or `Keep`. Use current change reasons and cohesion. File length alone does not justify a new owner.

## Review procedure

Read `AGENTS.md` and the relevant owner documents in `docs/README.md`. Read [the checklist](references/architecture-review-checklist.md).

The main agent must start a fresh independent read-only reviewer with `fork_turns: "none"`. Supply the exact diff, new files, acceptance criteria, consumers, QA results, and known limitations. Do not supply a desired verdict. Candidate review requires a complete manifest and successful applicable QA. Planning review must state which checks did not run.

The reviewer must not edit files, install tools, run QA wrappers, stage, or commit. Inspect the supplied evidence and nearby consumers. Report missing proof explicitly. A missing check is not evidence of a defect.

Classify findings as `security issue`, `current regression`, `acceptance blocker`, or `pre-existing hardening`, in that order. The first three classes block approval. Show the reachable trigger, violated invariant, impact, file and line, and smallest correction. Report pre-existing hardening only when it affects the verdict or the user requests an inventory.

List findings first. Then state assumptions, missing evidence, and `Approve`, `Approve with comments`, or `Request changes`. Do not add speculative requirements. State whether each correction changes a boundary and needs another review.
