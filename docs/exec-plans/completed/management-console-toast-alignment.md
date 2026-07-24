# Management Console Toast Alignment

## Outcome

Platform-admin status feedback now follows the management console toast vocabulary.

- Role updates report `Role successfully updated to {Role}.`
- Toasts use a centered bottom surface, status icon, dismiss action, brief entrance motion, and Acorn orange expiry bar.
- Success and failure messages retain distinct semantic icon colors.
- The controller resets its timer and progress animation when a new message replaces an existing toast.
- Polite live-region behavior and reduced-motion handling are preserved.

## Contract And Access Decision

- Toast work is frontend-only and changes no request, response, route, scope, or audit behavior.
- `suspend` is not added to `roleTemplateKeys`: suspension is a membership state, not a permission role.
- Existing membership `DELETE` is permanent removal and must not be labelled suspension.
- A reversible `Suspend access` / `Restore access` flow requires a dedicated `/admin/v1` contract. This gap is tracked as `DEV-010` and in the technical-debt tracker.

## Validation

- `npm run validate` passed with 31 tests, contract checks, harness checks, build, and route smoke checks.
- Browser verification passed at `1440×900` and `390×844`, including exact copy, centered placement, success icon, dismiss interaction, expiry bar, and zero console errors.

## Compatibility

Backward-compatible frontend presentation change. No cross-repository merge order is required.
