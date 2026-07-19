# Requirements Harness Hardening

## Outcome

Established a durable, executable current-requirements baseline so future console work starts from accepted behavior, preserves explicit exclusions, and does not implement contract-blocked capabilities prematurely.

## Delivered Scope

- Added `docs/product-specs/current-requirements.md` as the repo-local authority for required, excluded, and blocked behavior.
- Added `requirements-baseline.json` with executable evidence for 14 required requirements, 14 superseded exclusions, and 5 blocked capabilities.
- Added `scripts/check-requirements.mjs`, `npm run requirements:check`, and CI/local validation integration.
- Added negative tests proving the checker rejects reintroduced session revocation and route-count drift.
- Added the repo-local `platform-admin-change` skill and made it mandatory from `AGENTS.md` for product, UI, BFF, route, contract, and requirement changes.
- Clarified that completed execution plans are historical evidence rather than current product specifications.
- Corrected active design contradictions around Owner safeguards and `Revoke workspace access` wording.
- Removed stale recovery terminology from an active server test and unused status styling.
- Replaced the stale workspace-level 14-route prototype requirements with a synchronized 12-route coordination summary.
- Added a repository filter to the parent platform harness so a checked-out child can be validated in a partial workspace without weakening full-workspace default validation.
- Corrected CI coverage scope to measure executable Node/BFF sources; browser requirements remain enforced by focused UI tests and live-browser verification.

## Validation Evidence

- `npm run validate:ci` — passed: lint, 40 tests, 94.90% line coverage, 79.79% branch coverage, 94.58% function coverage, 12-route/7-scope contract checks, requirement checks, harness checks, build, and route smoke tests.
- `npm run requirements:check` — passed current, excluded, blocked, runtime-count, and evidence validation.
- `npm run harness:check` — passed 37 required files, policy markers, CI, docs, local workflow, and source budgets.
- `node scripts/harness/check-platform-harness.mjs platform-admin-console` — passed the parent workspace profile for this child repository.
- `./scripts/harness/check-agent-harness.sh` — passed workspace agent-harness validation.
- Skill metadata and interface YAML parsed successfully with Ruby's standard YAML parser. The Skill Creator `quick_validate.py` could not run because both available Python runtimes lack its undeclared `yaml` dependency; repo-local harness checks cover the required frontmatter and interface markers.

## Contract And Runtime Impact

No endpoint, scope, DTO, or product workflow changed. The accepted consumer remains 12 routes and 7 scopes. The only static asset change removes an unused historical status selector and bumps the stylesheet cache version to prototype 20.

## Residual Risk

- Browser modules have static UI requirement coverage and prior live-browser verification, but no repository-owned browser execution coverage suite yet.
- Full unfiltered workspace platform-harness validation remains unavailable in this checkout because `agentk` and `agentv` are missing; the new targeted profile passed without changing the full default behavior.
