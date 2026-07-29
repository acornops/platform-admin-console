# Product

## Register

product

## Users

Platform administrators handling support, security, identity, workspace, and
governance requests. They work under time pressure and need to scan
platform-wide metadata, understand policy boundaries, and perform one
auditable action without entering tenant operational surfaces.

## Product Purpose

Provide a dedicated, least-privilege console for platform-wide governance.
Success means administrators can understand and manage approved workspace,
identity, access, audit, and platform-setting metadata while tenant logs,
workloads, prompts, credentials, and other operational data remain protected.
The console supports platform governance without granting platform administrators access to workspace operational content, and platform administrators must not run commands that modify workloads.

## Brand Personality

Calm, precise, trustworthy. The console should feel recognizably AcornOps and
closely related to the management console, with a restrained privileged-admin
identity rather than a separate visual language.

## Anti-references

- A generic infrastructure dashboard crowded with operational telemetry.
- A security console that relies on alarming color, dense warnings, or
  intimidating language for ordinary governance work.
- A bespoke admin theme that makes familiar management-console controls look
  or behave differently.
- Decorative cards, badges, motion, or color that compete with task state.

## Design Principles

1. Make governance boundaries visible without interrupting the task.
2. Reuse management-console patterns so operators do not relearn controls.
3. Prefer concise, contract-backed facts over inferred readiness or activity.
4. Make privileged mutations deliberate, bounded, and easy to audit.
5. Keep protected tenant and credential data absent by design.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Preserve keyboard navigation, visible focus of at least
two pixels, semantic labels and states, sufficient text and control contrast,
reduced-motion preferences, and redundant cues so color never carries meaning
alone.
