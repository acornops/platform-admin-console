# Revocation Feedback Polish

## Goal

Keep directory counts synchronized after access revocation and make both revoke actions consistently recognizable as destructive controls.

## Delivered Scope

- Reconciled mock directory fixtures and rendered workspace counts with authoritative user-detail access counts on panel load and after every revoke operation.
- Gave individual and all-access revoke controls a persistent light-red treatment and a solid-red hover state.
- Removed AcornOps-account wording from individual and all-access confirmation descriptions.
- Preserved explicit confirmation, owner blocking, audit behavior, and the existing allowlisted `/admin` routes.

## Validation Evidence

- `npm run validate` — passed, including lint, 32 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Control-plane `npm run contracts:check` — passed.
- Control-plane `npm run harness:check` — passed.
- Live revocation verification — confirmed Ivy's directory and panel counts both changed from 2 to 1 immediately after revoking Cedar access.
- Live baseline verification — confirmed Maya's directory and panel both report one workspace after the fixture correction.
- Live confirmation verification — confirmed no `AcornOps account` wording remains.
- Live visual verification — confirmed both controls compute to the shared light-red background and danger text; focused CSS assertions cover their solid-red hover state.
