# Exact Management Dropdown Alignment

## Goal

Match the platform-admin dropdown treatment to the management console's shared `Select` component and correct the workspace-filter chevron.

## Delivered Scope

- Applied the management `Select` values directly: 44px trigger, 16px horizontal padding, 14px medium UI type, 6px radius, UI surface/border, and small trigger shadow.
- Applied the management open and focus states with orange interaction borders and rings rather than the platform clay wayfinding accent.
- Matched the overlay layer 140, menu typography, responsive 44px/36px option heights, UI active/selected surface, management shadow-lg, and orange-strong selected checkmark.
- Used default-size role selectors and aligned Update Role and revoke controls to 44px.
- Scoped the workspace building icon to a direct child so it no longer repositions the chevron.
- Added an exact open border/ring state to the free-text workspace combobox; its chevron remains 14px from the right and rotates with the menu.
- Bumped immutable prototype assets to version 16.

## Validation Evidence

- `npm run validate` — passed, including lint, 37 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Desktop computed trigger — 44px high, 16px horizontal padding, 14px/500 type, 6px radius, UI surface, and management small shadow.
- Desktop computed open state — orange 35% border, orange 10% ring, UI background, menu layer 140, 14px/500 menu type, 36px options, management shadow, and orange-strong arrow/check.
- Workspace chevron — confirmed static positioning, 14px right inset, complete separation from the left building icon, orange open state, and 180-degree rotation.
- Role row — confirmed 44px selector, Update Role, and revoke controls with no panel overflow.
- Compact viewport — confirmed 44px trigger and options, 14px chevron right inset, and no document-level horizontal overflow at 390px.
