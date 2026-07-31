# Mutation-Only Admin Audit

## Goal

Align Admin Audit with the producer's mutation-only policy while restoring the
compact raw action and outcome subtext beneath each readable event sentence.

## Scope and boundary

- Preserve the natural-language primary Event sentence.
- Restore `{action} · {Outcome}` as muted table subtext without segmented
  title-casing.
- Remove read-only event choices and read-only mock fixtures.
- Preserve historical-event compatibility, protected Details, filters for
  mutation groups, pagination, and the governance privacy boundary.
- Replace the relevant portion of `REQ-AUD-001`.

## Validation

- Full repository validation passed: 77 tests, contracts, requirements, harness,
  type checks, production build, and route smoke tests.
- Responsive browser verification passed at 1440px and 390px with no console
  errors or horizontal overflow. The description stays on one desktop line and
  wraps safely on compact screens.
- Browser verification confirmed raw action/outcome subtext, readable primary
  sentences, and no segmented `Admin · Workspace` table text.

## Completion

The mutation-only producer policy is mirrored in requirements and contract
documentation. Read-only mock fixtures and filters were removed while
historical read events remain renderable.
