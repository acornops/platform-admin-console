# LLM key card UI restore

Status: completed

Coordination slug: `fix/ai-key-settings-revert`

## Goal

Restore the prior three-card presentation for platform-default LLM keys while
preserving the current Platform Settings categories and write-only behavior.

## Requirement classification

- Preserve `REQ-UX-001`.
- Replace only the presentation clause in `REQ-SET-002`.

## Boundaries

- Keep the Workspace and AI tabs, including the current AI tab icon.
- Keep provider routes, payloads, scopes, roles, status projection, and
  write-only handling unchanged.
- Restore separate provider cards with neutral configured status.

## Coordination

The management-console change separately splits credential state and source
badges. No API, schema, contract, deployment, or merge-order dependency exists.

## Validation

- Focused markup and executable requirement evidence pass.
- Full repository validation passes with 98 tests plus contract, requirements,
  harness, build, and route-smoke checks.
- Desktop and 390 px browser review confirms the three-card layout, neutral
  configured status, compact stacking, and no horizontal overflow.
