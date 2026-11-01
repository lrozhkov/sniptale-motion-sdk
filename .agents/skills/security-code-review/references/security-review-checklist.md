# Security Code Review Checklist

- Treat JSON, files, messages, browser results, and generated reports as unknown.
- Check source and origin identity, session binding, payload bounds, and stale response rejection.
- Preserve declarative execution, deterministic budgets, isolated origins, and sandbox capability limits.
- Check traversal, symlinks, asset signatures, size limits, SVG sanitization, and output path authority.
- Keep temporary preview media separate from exported effect data and history.
- Check exact dependency identities, release age, lifecycle scripts, licenses, signatures, and artifact contents.
- Keep CI permissions narrow. Reject secrets, publication, unpinned downloads, and untrusted shell interpolation.
- Check malformed, missing, stale, or failed proof. A tool exit of zero alone does not prove a clean report.
