---
name: asd-ste100
description: Rewrite English technical instructions and documentation for unambiguous reading. Use controlled-language structure while preserving technical meaning, uncertainty, and commands.
metadata:
  upstream_version: "0.4.0"
---

# Simplified Technical English

Use this skill for technical text that an agent, tool, translator, or non-native reader must understand without resolving ambiguity. Use it for instructions, errors, tool descriptions, status reports, and repository documentation. Do not apply it to creative or marketing copy unless the user requests this style.

This repository adapts the user-supplied ASD-STE100 skill. The [MIT license](LICENSE) retains its upstream attribution. The official dictionary is not included. This skill does not certify official approved-word compliance.

## Select the mode

Use strict mode for procedures, errors, tool descriptions, inter-agent instructions, and safety text. Keep instruction sentences within 20 words and descriptions within 25 words.

Use STE-flavored mode for READMEs, explanations, and change descriptions. Apply structural rules. Treat dictionary-dependent vocabulary as contextual guidance. Preserve necessary domain terms and define unfamiliar terms once.

## Write the text

1. Read the full source for meaning before rewriting.
2. Use active voice when the actor is known and relevant.
3. Give each sentence one instruction or clear statement.
4. Use simple tenses when they preserve the original meaning.
5. Keep one topic per paragraph and at most six sentences per paragraph.
6. Use a list for three or more sequential steps or parallel conditions.
7. Remove semicolons, unnecessary noun clusters, nominalized actions, marketing claims, and ambiguous phrasal verbs.
8. Use the same term for the same action. Keep distinct technical actions distinct.
9. Preserve every requirement, condition, number, identifier, command, and confidence level.

Do not change “may have failed” to “failed”. Uncertainty is content. Retain a compound tense when a simple tense would remove meaning. Do not invent a cause, frequency, guarantee, or mechanism. If shorter wording loses necessary precision, retain the precise wording and explain the exception.

## Check the result

Use [writing rules](references/writing-rules.md) for rule categories and source references. Use [examples](examples/before-after.md) for paired illustrations. Negative examples intentionally violate rules. [Linter edge cases](examples/linter-edge-cases.md) are test data, not recommended writing.

Run the bundled checker for a first mechanical pass:

```bash
python3 .agents/skills/asd-ste100/scripts/ste-lint.py --json <files>
python3 .agents/skills/asd-ste100/scripts/ste-lint.py --selftest
```

The checker uses a 25-word approximation and heuristic vocabulary checks. It does not prove the strict 20-word instruction limit or contextual correctness. Inspect its findings. Prove a false positive before recording exact `tool-noise` through the repository review registry.

Do not use `--baseline` or `--disable` to accept repository debt. The upstream checker retains these options for compatibility. Repository policy does not authorize them.

## Return the result

Return the rewritten text alone unless the user requests an explanation. If precision requires a retained departure, add one `Kept as-is:` line with its reason. On request, show a compact table with the original, rewrite, and applicable rule.

If the source already meets the rules, do not force changes. Plain wording cannot repair an unsupported claim or missing requirement. Report that content problem instead of polishing it.
