# Admin AI key control alignment

Status: completed

## Goal

Align the Platform Settings AI key controls with the management console while
preserving the write-only platform-default key boundary.

## Requirement impact

- Replaces only the neutral configured-status presentation in `REQ-SET-002`
  with a success badge.
- Preserves the fixed OpenAI, Anthropic, and Gemini provider set, write-only
  key input, role checks, explicit deletion confirmation, and secret
  non-disclosure.
- Preserves `REQ-UX-001` by reusing management-console input and button
  patterns.

## Implementation

- Render configured provider status with a green success badge.
- Give key inputs the established 44px field shell, focus ring, and placeholder
  treatment used by directory search fields.
- Present configured-provider actions as `Rotate key` and `Delete key`, using
  the management-console secondary and danger button vocabulary with matching
  icons and dimensions.
- Update the normative requirement and design records.

## Verification

- `npm run lint` passed.
- `npm run requirements:check` passed.
- `npm run build` passed.
- `git diff --check` passed.
- The local platform-admin console was rebuilt and is healthy on
  `127.0.0.1:4173`.
- Browser verification confirmed the configured success badge, 44px inputs,
  matching desktop action dimensions, and solid danger treatment.
- At a 390px viewport, provider cards stack to one column, all inputs remain
  44px high, and Rotate key and Delete key both render at 158px by 44px.
- Per the user's standing request, the test suite was not run.
