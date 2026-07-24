# Align Workspace Directory And Details With Users

Status: completed 2026-07-17

## Goal

Make workspace discovery and management follow the accepted Users directory interaction model while preserving the governance-only contract boundary.

## Scope

- Replace the legacy register heading and client-only filters with the management-aligned directory toolbar.
- Add server-backed workspace-name search, plan filtering, quota-status filtering, loaded-result count, and cursor pagination through the existing workspace list contract.
- Keep the workspace table visible while a selected workspace opens in an accessible right-side panel.
- Put governance metadata, quota usage, plan/quota actions, and the disabled lifecycle placeholder in the panel.
- Preserve deep links, keyboard access, focus containment and restoration, compact responsive behavior, and current management-console controls.

## Boundaries

- Use only the existing `GET /admin/v1/workspaces`, `GET /admin/v1/workspaces/{workspaceId}`, plan, and quota routes.
- Do not expose tenant logs, targets, workload details, sessions, commands, workspace audit events, or impersonation.
- Do not enable suspension, deletion, owner lookup, ownership transfer, or workspace member reads while their contracts remain blocked.
- The workspace search label must reflect the producer contract: `q` searches the workspace name, not ID or creator.

## Validation Plan

- Add focused directory, panel, mock-filter, accessibility, and requirements evidence.
- Run CI-grade repository validation and confirm the contract subset remains unchanged.
- Verify search, dropdowns, pagination state, panel layout, deep-link behavior, and actions in the live local UI.

## Completion Evidence

- `npm run validate:ci` passed with 48 tests and 94.77% line, 80.00% branch, and 94.79% function coverage.
- Contract validation retained the existing 13-route, 7-scope governance-only subset.
- Live desktop verification confirmed the directory toolbar, management-aligned dropdown, quota-status filtering, loaded-result badge, selected-row state, and contextual workspace panel.
- Live compact verification confirmed the full-width panel, stacked actions, readable quota rows, and retained disabled lifecycle explanation.
- `Manage User Access` was verified to open Users with the selected workspace filter applied.
