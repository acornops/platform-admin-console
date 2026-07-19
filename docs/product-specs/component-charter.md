# Component Charter

## In scope

- Platform readiness and safe configuration posture.
- Workspace discovery and governance metadata.
- User discovery, workspace-access grants for existing users, and direct role management.
- Plan administration; workspace limits remain plan-defined.
- Platform-admin audit history.
- Recoverable workspace suspension and restoration through dedicated `/admin/v1` contracts.

## Out of scope

- Tenant logs and audit records.
- Target, cluster, and virtual-machine identities or operational details; aggregate target counts are governance metadata. Agents, sessions, runs, prompts, approvals, commands, tools, credentials, and workload changes remain unavailable.
- Impersonation or “view as workspace member.”
- A generic API explorer.
