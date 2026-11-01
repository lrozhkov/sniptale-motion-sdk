---
name: devin-review
description: "Coordinate independent SDK review through Devin only when the user explicitly requests Devin or this skill."
---

# Devin Review

Configuring this skill does not authorize an external start. Use it only on an explicit user request. Do not install a CLI, change models, or send repository content without that authorization.

The main agent owns scope, acceptance, corrections, proof, and closeout. The reviewer reads the frozen candidate. It must not implement, edit, stage, commit, or start other agents.

Read [CLI workflow](references/cli-workflow.md) before starting a review. Follow the user's model restrictions and tool permissions.

## Handoff

1. Complete applicable QA before review. Record the candidate, base, acceptance criteria, non-goals, consumers, exact diff, new files, and QA results under `.tmp/reviews/`.
2. Exclude secrets, credentials, and unrelated files. Supply applicable review skills without suggested findings or a desired verdict.
3. Start one fresh review. Preserve its executor handle, output, and terminal exit status. Do not change the candidate during review.
4. Check findings against the frozen candidate. Classify them under `AGENTS.md`. Collect all established blockers before one correction batch.
5. Rerun invalidated proof and reviews. The main agent performs any authorized commit closeout.

A report must identify each finding's file, line, reachable trigger, violated invariant, impact, class, and smallest correction. It must state assumptions, unverified areas, and a verdict. Missing output, nonzero exit, or authentication failure means incomplete review. Partial output does not mean approval.
