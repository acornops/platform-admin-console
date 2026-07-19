# Management-Aligned Dropdowns

## Goal

Make platform-admin dropdowns behave and read like the management console's MCP server filter while preserving the Users workspace filter as a free-text suggestion field.

## Delivered Scope

- Added a reusable accessible listbox enhancement that keeps native selects as the form-value source of truth.
- Matched the management-console MCP filter's surface trigger, chevron motion, accent focus ring, fixed-position menu, active option, selected checkmark, and keyboard navigation.
- Applied the shared control to the Users verification filter, workspace role selectors, Workspaces plan filter, and dialog select fields.
- Replaced the browser-native workspace datalist with a free-text combobox whose name and ID suggestions use the shared menu surface.
- Added control cleanup across route, panel, and dialog rerenders so portalled menus and listeners do not accumulate.
- Gave `Unverified` a restrained amber status pill distinct from the green `Verified` state without implying suspension or failure.
- Preserved all API, contract, authorization, role-update, and filtering behavior.

## Validation Evidence

- `npm run validate` — passed, including lint, 36 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Live Users verification filter — confirmed selected checkmarks, pointer selection, Home/Enter keyboard selection, native value synchronization, and result filtering.
- Live workspace combobox — confirmed partial text suggestions with names and workspace IDs, suggestion selection, and the existing workspace-access result filter.
- Live role selector — confirmed contract-provided roles, selected checkmark, menu layering above the user panel, draft-role synchronization, and Update Role enable/disable behavior without submitting a mutation.
- Live Workspaces plan filter and plan dialog — confirmed shared controls, native form values, correct filtering, and a dialog-contained menu surface.
- Live compact verification — confirmed 44px controls, no document-level horizontal overflow, and menus fully contained within a 390px viewport.
