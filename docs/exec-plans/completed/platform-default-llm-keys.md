# Platform default LLM credentials

Status: complete

## Goal

Let full platform administrators configure write-only OpenAI, Anthropic, and
Gemini defaults from Platform Settings. Viewers may see configured status;
auditors retain no settings route.

## Boundaries

- Browser traffic remains same-origin under `/admin-console-api/*`.
- The BFF maps only the fixed `/admin/v1/system/llm-provider-defaults` routes.
- Responses expose status only. Submitted key values are not retained in DOM
  state after the request and are never projected back to the browser.
- The existing platform-settings policy, workspace governance, and tenant-data
  exclusions remain intact.

## Validation

- Focused route-policy, projection, settings markup, mock server, and negative
  secret-exposure tests.
- `npm run requirements:check`, `npm run contracts:check`, and
  `npm run validate`.
- Live browser verification of configured, replacement, deletion, read-only,
  and compact states.

## Outcome

- Platform Settings presents write-only cards for all three providers.
- The BFF projects status only and uses a two-click delete confirmation.
- Lint, 97 tests, requirements, contracts, harness, build, and route smoke
  checks passed.
- Live browser verification confirmed save clearing, no key text in the DOM,
  configured-state refresh, confirmed deletion, and no browser errors.
