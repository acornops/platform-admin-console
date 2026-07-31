# React, Tailwind, and Shared UI Migration

Status: complete

## Goal

Replace the imperative browser implementation with the Management Console's
React, TypeScript, Vite, and Tailwind foundation, and consume a repository-local
replica of the domain-neutral `@acornops/ui` package.

## Requirement classification

- Replace the implementation evidence for `REQ-UX-001` while preserving its
  accepted shell, identity, navigation, theming, dialog, and account-menu
  behavior.
- Preserve `REQ-BND-001` through `REQ-BND-003`: browser traffic remains limited
  to same-origin `/admin-console-api/*`, and no BFF route or projected field is
  added.
- Preserve every route-specific requirement and every `EXC-*` and `BLOCK-*`
  decision. This is a browser implementation migration, not a product-scope
  expansion.

## Scope and boundary

- Keep `server.mjs`, the route policy, contract projection, and mock store as
  the governance boundary.
- Build the browser with React 19, TypeScript, Vite, Tailwind CSS 3, Lucide
  React, and the same supporting libraries used by the Management Console.
- Replicate the Management Console's domain-neutral UI package inside
  `packages/ui`; do not create a runtime or build dependency on a sibling
  repository checkout.
- Replace HTML-string rendering, global DOM listeners, hand-authored SVG
  controls, and duplicated component CSS with React components and shared UI
  primitives.
- Keep the Platform Admin clay navigation context and confidentiality language;
  do not import tenant routes, authentication, target models, or workspace
  operations from the Management Console.

## Validation plan

- Add focused component and helper tests for routing, overview modelling,
  filters, role safeguards, settings comparison, and audit query construction.
- Run `npm run lint`, `npm run test`, `npm run contracts:check`,
  `npm run requirements:check`, `npm run harness:check`, `npm run build`,
  `npm run smoke:routes`, and `npm run validate`.
- Verify the built console live in mock mode at desktop and compact widths,
  including keyboard navigation, a directory panel, a mutation dialog, theme
  selection, and governance-only network requests.

## Rollback

Revert the browser-source, build-configuration, and requirement-evidence
changes together. The BFF and producer contracts are unchanged, so rollback
does not require a producer or deployment migration.

## Outcome

- Replaced the imperative DOM application with React 19, TypeScript, Vite,
  Tailwind CSS, Lucide React, and the same supporting libraries used by the
  Management Console.
- Added a repository-local `@acornops/ui` workspace containing only the
  domain-neutral component, token, typography, dialog, panel, table, form,
  status, navigation, and toast primitives consumed by the live routes.
- Preserved all 25 governance-only BFF routes, eight allowed scopes, privacy
  projections, role restrictions, blocked capabilities, and accepted route
  behavior.
- Updated the executable requirement evidence, contract and harness checks,
  static serving, source budgets, development guidance, and smoke coverage for
  the new source topology.
- Removed zero-consumer UI primitives, duplicate root dependency declarations,
  and fragmented one-off QA records after folding durable evidence into this
  plan and `design-qa.md`.
- `npm run validate` and `npm run validate:ci` passed with 72 tests plus lint,
  contract, requirement, harness, coverage, production build, static-route,
  API, and denied-route checks.
- Coverage passed at 93.34% lines, 81.86% branches, and 94.13% functions for
  the covered BFF and policy runtime.
- Live Chrome verification at 1440×900 and 390×844 confirmed all seven routes,
  keyboard selection, tabs, menus, workspace and audit panels, nested
  confirmation, Escape handling, compact navigation, zero console errors, and
  no page-level horizontal overflow.
