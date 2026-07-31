# Platform UI Fidelity Pass

Status: complete

## Goal

Keep the completed React, TypeScript, Vite, Tailwind, and repository-local
`@acornops/ui` migration while correcting visual regressions that changed the
accepted Platform Admin Console presentation. Preserve every current route,
feature, governance boundary, and explicitly accepted post-migration UI
decision.

## Requirement classification

- Preserve `REQ-UX-001` and `REQ-USR-001` while correcting presentation drift
  in their implementation evidence.
- Preserve every route-specific requirement, `EXC-*` exclusion, and `BLOCK-*`
  prerequisite.
- Add no browser route, BFF route, request field, response field, permission, or
  mutation.

## Visual source of truth

- Primary reference:
  `/var/folders/yy/5hnx5lt93jj1r5krn0rkz5ch0000gn/T/codex-clipboard-b2b364d9-4c2d-4b25-9d5d-267b6e668847.png`
- Historical implementation evidence: `HEAD:public/styles.css` and the deleted
  imperative page modules.
- Architecture and component vocabulary: the repository-local
  `packages/ui` package and `management-console/packages/ui`.
- Later accepted decisions: `docs/product-specs/current-requirements.md` and
  `DESIGN.md`.

## Scope

- Audit shared and page-level table, toolbar, form, panel, dialog, status, and
  responsive presentation for migration-only drift.
- Prefer explicit composition or density props over forking the replicated
  Management Console primitives.
- Remove stale custom presentation code made unnecessary by the corrected
  component composition.
- Do not restore superseded wording, columns, filters, actions, routes, or
  excluded capabilities from the historical JavaScript UI.

## Validation plan

- Add focused evidence for corrected shared-component composition.
- Run lint, all tests, contract checks, requirement checks, harness checks,
  production build, route smoke checks, and `npm run validate`.
- Capture the Users directory and representative table, panel, settings,
  overview, and audit routes in mock mode at desktop and compact widths.
- Compare the Users directory against the supplied reference and record the
  final result in `design-qa.md`.

## Rollback

Revert the presentation-only component composition and documentation updates.
No API, stored data, contract, or deployment rollback is required.

## Outcome

- Kept the replicated management-console table primitive unchanged.
- Applied its compact header density to every platform directory, capability,
  and access table.
- Restored the Admin Audit header's original micro-label and 10-pixel vertical
  padding.
- Added focused source evidence so future table additions cannot silently fall
  back to the roomier shared default.
- Passed desktop and compact visual comparison, core interaction checks,
  `npm run validate`, and `npm run validate:ci`.
