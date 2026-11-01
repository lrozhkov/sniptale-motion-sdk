# ASD-STE100 Authoring Support

This repository adapts upstream skill version `0.4.0` for English technical instructions and documentation. Read [SKILL.md](SKILL.md) for strict and STE-flavored modes. Both modes preserve requirements and uncertainty.

The [writing-rules reference](references/writing-rules.md) summarizes rule categories without reproducing the official dictionary. [Before/after examples](examples/before-after.md) contain intentional negative text. [Edge cases](examples/linter-edge-cases.md) exercise the checker.

The checker uses only Python's standard library. Run `scripts/ste-lint.py --selftest` for its native checks. Repository `qa:docs` applies writing checks and exact reviewed tool-noise decisions. It does not certify official dictionary compliance.

The [upstream MIT license](LICENSE) retains copyright `2026 Dustin Yuchen Teng`. Repository changes adapt instructions and metadata. They preserve license bytes and the upstream checker.
