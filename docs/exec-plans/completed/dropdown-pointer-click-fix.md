# Dropdown Pointer Click Fix

## Goal

Make every management-aligned dropdown reliably clickable with a physical mouse or trackpad.

## Delivered Scope

- Stopped select and combobox `pointerenter` handlers from rebuilding the menu and replacing the option beneath the pointer.
- Active-option styling and `aria-activedescendant` now update in place while option elements remain stable for the complete pointer interaction.
- Made clicking anywhere in the free-text workspace field open its suggestion menu.
- Bumped the prototype asset version and versioned module imports so immutable browser caching cannot retain the broken control implementation.
- Preserved keyboard navigation, native form values, filtering behavior, and role-update safeguards.

## Validation Evidence

- `npm run validate` — passed, including lint, 36 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Live verification filter click — selected Unverified and returned one matching user.
- Live workspace combobox click — opened five suggestions without typing and selected Atlas Research.
- Live role selector click — selected Admin, synchronized the native value, enabled Update Role, and returned to Owner without submitting a mutation.
- Live Workspaces plan filter click — selected Starter and reduced the register to one matching workspace.
