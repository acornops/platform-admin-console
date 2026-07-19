# Repository Design

The canonical product and visual registers are [PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md). This file records the implementation shape without duplicating those normative decisions.

The console is a dedicated privileged surface with Overview, Workspaces, Users, and Admin Audit views. It reuses the management-console visual system while keeping a distinct admin identity. Production human identity comes from the OIDC session; the BFF workload credential remains separate audit evidence and never substitutes for the administrator.

The browser calls a fixed same-origin BFF allowlist. The BFF validates human sessions, CSRF and recent authentication for writes, workload credential scopes, query and body shapes, and response projections before returning governance-safe data. Workspace members load from the authoritative paginated workspace-member endpoint. Existing users may be granted, have roles changed, or have one workspace membership revoked. The sole Owner is safeguarded; co-owner mutations are permitted and the producer remains authoritative during races. Non-atomic all-workspace offboarding is not exposed.

Workspace suspension and restoration are contract-backed, preserve memberships and workloads, and require exact-name confirmation. Admin Audit displays the human actor with privacy-filtered credential evidence. Retention-controlled purge, atomic ownership transfer, reversible membership suspension, and atomic all-workspace offboarding remain absent until dedicated producer contracts exist. The deviation ledger in the canonical [DESIGN.md](../DESIGN.md) is authoritative for those boundaries.
