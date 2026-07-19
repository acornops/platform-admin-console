# Platform Admin Console Agent Entry Point

Use this file as a map. Durable repository knowledge lives in the linked docs.

## Agent-Assisted Development

Start agents from this repository root for local work. Start from the parent `acornops-workspace` root for contract, deployment, or other cross-repository changes.

## Start Here

- [Architecture](ARCHITECTURE.md)
- [Docs Index](docs/index.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Operations Guide](docs/OPERATIONS.md)
- [Contracts](docs/contracts/README.md)
- [Current Requirements](docs/product-specs/current-requirements.md)
- [Design Register](DESIGN.md)
- [Plans](docs/PLANS.md)
- [Agent Handoff](docs/AGENT_HANDOFF.md)
- [Quality Score](docs/QUALITY_SCORE.md)
- [Maintainability](docs/MAINTAINABILITY.md)
- [Reliability](docs/RELIABILITY.md)
- [Security](docs/SECURITY.md)
- [Security Model](docs/security-model.md)

## Working Rules

- Treat `docs/` as the repository system of record.
- Use [.agents/skills/local/platform-admin-change/SKILL.md](.agents/skills/local/platform-admin-change/SKILL.md) for every product, UI, BFF, route, contract, or requirements change.
- Start from `docs/product-specs/current-requirements.md`; completed execution plans are historical evidence, not current requirements.
- Classify requested behavior as preserving, replacing, adding, or unblocking a requirement before editing. Update the requirements baseline when an accepted decision changes.
- Never revive an `EXC-*` behavior or implement a `BLOCK-*` capability without updating its prerequisite and executable evidence.
- Browser code may call only same-origin `/admin-console-api/*` routes.
- Server code may call only routes declared in `lib/admin-route-policy.mjs`.
- Never introduce a generic proxy or accept an upstream path from browser input.
- Keep request and response shapes aligned with the mirrored control-plane contract.
- Record every necessary contract deviation in `DESIGN.md` before implementation.
- Never expose the admin token, tenant logs, targets, agents, runs, sessions, commands, tooling, prompts, credentials, or workspace audit events.
- Keep controls disabled until their `/admin/v1` contract is allowlisted and tested.
- Create an active execution plan for multi-step or design-sensitive work.
- Shared skills live in `.agents/skills/shared`; local skills live in `.agents/skills/local`.
- Do not edit `.agents/skills/shared`; update and sync them from the parent workspace.
- Follow `docs/AGENT_HANDOFF.md` before final handoff.
- If docs do not change, report `Docs impact: none` and explain why.
- Keep this harness vendor-neutral; do not add required vendor-specific instruction files.

## Required Validation

- `npm run lint`
- `npm run test`
- `npm run contracts:check`
- `npm run requirements:check`
- `npm run harness:check`
- `npm run smoke:routes`
- `npm run validate`
- Use `ADMIN_CONSOLE_DATA_MODE=control-plane` for contract-sensitive integration verification.

## High-Risk Areas

- Admin bearer-token custody and scope verification.
- Route/query allowlisting and response projection.
- Membership-role, ownership, and quota mutations.
- Admin audit filtering and operational-data exclusion.
