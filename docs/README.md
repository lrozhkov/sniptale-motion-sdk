# Documentation

Code, schemas, tests, and deterministic policies own implementation detail. This index assigns each repository-level contract to one document.

- [Repository architecture](architecture/repository-overview.md): owner seams, runtime topology, state authority, and build boundary.
- [i18n architecture](architecture/i18n-architecture.md): locale authority, fallback order, and adopted-surface rules.
- [Effect host integration](architecture/effect-host-integration.md): control presentation, source and interval timing, RGBA ownership and transition composition.
- [Effect object layout](architecture/effect-object-layout.md): local object coordinates, resize policy, selection geometry, and host compatibility.
- [Живые HTML-сцены](architecture/dom-motion.md): отдельный DOM-контракт, камера, семантические слои и изоляция HTML.
- [Security model](security/security-model.md): trust boundaries, enforced controls, accepted trade-offs, and residual risks.
- [Provenance](oss/provenance.md): first-party license source, dependency evidence, generated notices, and local asset policy.
- [Release readiness](oss/release.md): local candidate checks, legal payload, blockers, and publication boundary.
- [Локальный npm-комплект](tooling/npm-toolkit.md): установка, команды и ограничения промежуточного кандидата.
- [Code quality](tooling/code-quality.md): deterministic rule-to-check mapping and the explicit review-only set.

Root policies remain at the repository root: [license](../LICENSE), [notice](../NOTICE), [contribution policy](../CONTRIBUTING.md), and [security support](../SECURITY.md).

There is no documentation archive. Temporary investigations, handoffs, generated reports, review evidence, templates, and media assets belong under ignored local storage and are not repository documentation.
