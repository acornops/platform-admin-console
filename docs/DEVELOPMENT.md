# Development Guide

## First Run

Requires Node.js 20 or newer. The CI reference runtime is Node.js 22.

```bash
npm ci
npm run dev
```

The default `mock` mode requires no credentials. Use `http://127.0.0.1:4173`.
The development command starts the production BFF boundary with Vite middleware
on the same origin. Browser changes in `src/` and shared UI changes in
`packages/ui/` update through Vite hot module replacement. Restart the process
after changing the Node BFF or its `lib/` modules. Production continues to serve
the compiled `dist/` assets.

## Validation Ladder

- `npm run lint`: strict TypeScript checks for the React application and shared
  UI workspace, plus syntax checks for the server, policy, projection, and mock.
- `npm run test`: policy, projection, mutation, HTTP, and denial tests.
- `npm run test:coverage`: CI-oriented coverage for the executable Node BFF, policy, mock, and requirements-checker runtime with 80% line, 65% branch, and 80% function minimums. Browser modules are covered by focused UI requirement tests and live-browser verification rather than misleading Node execution coverage.
- `npm run contracts:check`: mirrored manifest, route, scope, DTO, and producer alignment.
- `npm run requirements:check`: current requirements, superseded exclusions, blocked capabilities, runtime counts, and evidence links.
- `npm run harness:check`: repository knowledge, workflow, source-budget, and policy checks.
- `npm run build`: reproducible Vite asset build after compiling the shared UI
  workspace.
- `npm run smoke:routes`: static routes, approved APIs, and denied-route smoke coverage.
- `npm run validate`: canonical local validation.
- `npm run validate:ci`: canonical CI validation with coverage.

## Contract-Sensitive Work

1. Treat `control-plane/docs/contracts/manifest.json`, control-plane route schemas, and OpenAPI sources as the producer contract.
2. Update the mirrored counterpart objects in both repositories together.
3. Keep `lib/admin-route-policy.mjs`, `lib/admin-contract.mjs`, mock DTOs, frontend calls, and tests aligned.
4. Record privacy projections or other deviations in `DESIGN.md`.
5. Run the consumer, producer, and parent cross-repository contract checks.

## Documentation Drift Control

Behavior, boundary, and workflow changes require documentation in the same change. Update `docs/index.md` when adding durable documents. If documentation is genuinely unaffected, include `Docs impact: none` and the reason in the handoff.

## Requirement Drift Control

For any product change, use `.agents/skills/local/platform-admin-change/SKILL.md` and start from `docs/product-specs/current-requirements.md`. Classify the request as preserving, replacing, adding, or unblocking a requirement. If an accepted decision changes, update the human baseline, `requirements-baseline.json`, executable evidence, tests, and the design or contract record together. Completed execution plans are history and must not be used as current requirement evidence.
