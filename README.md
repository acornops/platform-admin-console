# AcornOps Platform Admin Console

A separate, governance-only console for AcornOps platform administrators. It manages recoverable workspace suspension, existing-user workspace access and roles, plan assignment, and platform-admin audit history without exposing tenant logs, target details, sessions, runs, commands, or workload controls. Workspace limits remain tied to the selected plan.

## Local development

```bash
npm run dev
```

Open `http://127.0.0.1:4173`. Local development uses deterministic mock data by default. No dependencies or credentials are required.

For a real control-plane connection:

```bash
ADMIN_CONSOLE_DATA_MODE=control-plane \
CONTROL_PLANE_ADMIN_BASE_URL=https://control-plane.example.com \
CONTROL_PLANE_ADMIN_TOKEN=replace-me \
npm start
```

The browser only calls same-origin `/admin-console-api/*` routes. The server maps those routes to a fixed `/admin/v1/*` allowlist and keeps the upstream token server-side.

## Validation

```bash
npm run validate
```

Repository guidance: [`AGENTS.md`](AGENTS.md), the [current requirements](docs/product-specs/current-requirements.md), [`docs/index.md`](docs/index.md), [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md), [`docs/OPERATIONS.md`](docs/OPERATIONS.md), and [`docs/contracts/README.md`](docs/contracts/README.md). Platform context lives in the parent [`system-architecture.md`](../docs/system-architecture.md).

## Agent-Assisted Development

Start with [`AGENTS.md`](AGENTS.md) and the [current requirements](docs/product-specs/current-requirements.md), then use [`docs/index.md`](docs/index.md) for architecture, security, reliability, plans, and handoff guidance. Product changes use the repo-local `platform-admin-change` workflow; shared skills are synchronized from the `acornops-workspace` repository.
