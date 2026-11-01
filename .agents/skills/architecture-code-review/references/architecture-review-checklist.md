# Architecture Code Review Checklist

- Keep viewer state, sandbox execution, SDK contracts, shared behavior, and tooling authority distinct.
- Keep entrypoints thin. Use paths for domain ownership and filenames for roles.
- Parse external data before domain use. Keep public contracts explicit and strict.
- Trace asynchronous revisions, cancellation, stale responses, bitmap ownership, and recovery.
- Check Russian defaults, English translations, and shared locale resolvers for adopted UI.
- Check schema, runtime, authoring documentation, package payloads, and tests together when their contract changes.
- Reject forwarding layers without an independent boundary or change reason.
