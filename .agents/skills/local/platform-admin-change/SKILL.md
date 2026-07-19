---
name: platform-admin-change
description: Preserve the platform admin console's governance boundary, current UX decisions, superseded exclusions, blocked capabilities, and contract subset. Use for every product, UI, BFF, route, contract, requirement, or durable design change in this repository, including reviews that may lead to implementation.
---

# Inputs

- user request and affected surfaces
- `docs/product-specs/current-requirements.md`
- `docs/product-specs/requirements-baseline.json`
- `DESIGN.md` and the contract manifest when applicable

# Procedure

1. Read the current requirements and relevant design rules before proposing or editing behavior.
2. Classify the request as preserving, replacing, adding, or unblocking a requirement ID.
3. Treat completed execution plans as historical evidence only. Do not derive current behavior from them.
4. Do not revive an `EXC-*` behavior. If the user explicitly reverses it, update the human baseline, executable baseline, tests, and design record together.
5. Do not implement a `BLOCK-*` capability until its `/admin/v1` producer contract and security prerequisites exist.
6. Keep browser traffic on same-origin `/admin-console-api/*` and server traffic on the fixed `/admin/v1` allowlist. Record every necessary deviation in `DESIGN.md`.
7. Reuse management-console patterns where the baseline calls for parity, while preserving the Platform Admin identity and confidentiality boundary.
8. Add focused behavioral or negative regression evidence for the change.
9. Run targeted checks, `npm run requirements:check`, and the repository validation appropriate to risk. Use live browser verification for user-visible UI changes.
10. Handoff with affected requirement IDs, contract and privacy impact, exact validation outcomes, skipped checks, and residual risk.

# Outputs

- requirement classification and affected IDs
- implementation and documentation changes
- confirmation that excluded behavior remains absent
- validation and handoff evidence
