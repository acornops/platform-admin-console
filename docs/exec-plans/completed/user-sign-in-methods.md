# User Sign-In Methods

> Archive review — 2026-10-18: Implementation landed (platform-admin-console d7aa0ca; acornops-deployment eb8900e; control-plane 63ba0f3). Original validation plans are preserved; this archive does not represent a new authentication rollout.
> Original scope, checklists, and validation below are historical; this is not a new runtime or rollout validation report.

## Goal

Replace the legacy Password Signup platform setting with a versioned User
Sign-In Methods setting that lets platform administrators enable Password,
OIDC, or both for workspace users.

## Scope and boundary

- Preserve Platform Admin OIDC-only authentication.
- Consume only the fixed control-plane platform-setting route under the
  existing same-origin BFF boundary.
- Project a typed `{ methods }` value and deployment constraints; never accept
  arbitrary setting keys or arbitrary values.
- Password permits password login and first-time password signup. OIDC sends
  a user to the configured identity provider.
- Keep at least one permitted method selected in the browser and explain
  deployment-disabled choices inline.

## Validation plan

- Add focused BFF projection, route-policy, mock lifecycle, and rendered-markup
  coverage.
- Run the focused checks plus the console contract and requirements checks.
- Record any checks that require the companion control-plane change as pending.
