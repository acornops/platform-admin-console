# Agent Handoff

## Required Evidence

- Scope and user-visible behavior.
- Requirement impact: IDs preserved, added, replaced, unblocked, or deliberately kept excluded.
- The exact commands run and their outcomes.
- Files, routes, payloads, manifests, and counterpart repositories changed.
- Security, privacy, reliability, and docs impact.
- Skipped checks, residual risks, rollback notes, and follow-up owners.
- Related branches, PRs, links, and merge order.
- If documentation is unaffected, include `Docs impact: none` and the reason.
- Confirm `npm run requirements:check` passed and that no superseded `EXC-*` behavior was revived.

## Commit Policy

Use Conventional Commits 1.0.0. Local commit-message checks are developer assistance, not a GitHub CI gate unless the repository workflow explicitly adds that policy.

## Contract Handoff

Name the producer source of truth, consumer mirror, compatibility result, and every deviation recorded in `DESIGN.md`. Contract-sensitive work should include consumer `npm run contracts:check`, producer contract validation, and the parent cross-repository contract check.

## Vendor Neutrality

Keep runtime, identity, deployment, and agent guidance vendor-neutral unless the product contract requires a specific integration.
