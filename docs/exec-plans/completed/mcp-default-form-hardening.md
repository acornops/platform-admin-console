# MCP Default Form Hardening

## Requirement Classification

Preserves `REQ-UX-001` and the capability-default requirement that MCP creation
collect only a name, public HTTPS endpoint, and destinations. It adds no route,
payload field, credential handling, or previously excluded capability.

## Goal

Make the existing MCP default form reject the same unsafe endpoint shapes as
the BFF before submission and give both required inputs durable accessible
names.

## Constraints

- Reuse the existing mutation dialog and shared form controls.
- Keep the browser on the existing same-origin endpoint and preserve the
  secret-free payload.
- Share endpoint validation logic with the BFF policy rather than maintaining
  divergent rules.
- Preserve compact and responsive dialog layout.

## Work

- [x] Extract an environment-neutral public HTTPS endpoint validator.
- [x] Use it in both BFF sanitization and client form enablement.
- [x] Associate MCP name and endpoint labels with their inputs.
- [x] Add positive, negative, and source-level accessibility tests.
- [x] Run requirements, contract, and repository validation.

## Validation

- `npx tsc --noEmit && node --import tsx --test test/public-https-url.test.mjs test/admin-route-policy.test.mjs test/react-ui.test.ts`
  passed with 47 tests.
- `npm run validate` passed with 91 tests, contract, requirements, and harness
  checks, production build, and route smoke checks.
- Live visual verification at `http://127.0.0.1:4173/workspace-defaults` could
  not run because this session exposed no in-app or external browser. The local
  app returned HTTP 200; build, source-level accessibility checks, and route
  smoke provide the available fallback evidence.

## Completion

Every endpoint accepted by the client is accepted by the BFF validator, unsafe
or malformed endpoints are blocked before submission, both fields have
programmatic labels, and existing governance/privacy boundaries remain intact.
No contract or privacy projection changed, and excluded capabilities remain
absent.
