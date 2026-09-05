# Workspace Starter Ownership Clarification

## Goal

Make the existing workspace-default lifecycle unambiguous: Platform Admin
defines creation-time starters, while enabling a starter creates a detached,
ordinary workspace-owned MCP server or skill.

## Delivered

- Replaced user-facing `Platform default` labels with `Workspace starter` for
  untouched snapshot entries in Management Console.
- Clarified in Platform Admin that enabled entries become workspace-owned.
- Centralized the enable-only validation message shared by MCP servers and
  skills.
- Added regressions for Agent and target ownership after materialization and
  for isolation from the AcornOps built-in MCP reconciliation path.
- Updated the mirrored contract and requirement evidence wording.

## Preserved Boundaries

- No route, schema, storage, credential, permission, or wire-format changed.
- No existing workspace capability is migrated or reconciled.
- The internal AcornOps built-in MCP bridge remains unchanged.

## Validation

- Platform Admin Console `npm run validate`: passed (90 tests plus contract,
  requirement, harness, build, and route-smoke gates).
- Management Console `npm run validate`: passed (208 files, 1,037 tests plus
  contract, harness, build, bundle, and route-smoke gates).
- Control Plane focused workspace-default, target-catalog, and built-in-sync
  suites: 20 passed; all database-independent validation gates passed.
- The full Control Plane suite was invoked, but its database-backed tests require
  the unavailable isolated `CONTROL_PLANE_TEST_DATABASE_URL`; 164 failures were
  prerequisite/connection failures and the remaining 986 tests passed.
