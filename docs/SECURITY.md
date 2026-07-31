# Security and Privacy

## Protected Boundary

The console is for platform governance, not tenant operations. Platform administrators may see governance metadata needed to identify accounts and workspaces, but must not see tenant logs, targets, agents, runs, sessions, commands, prompts, workspace credentials, tool output, or workspace audit events. Full platform administrators may replace or delete write-only platform-default LLM keys; key values are never returned.

## Controls

- Separate hostname and repository from the tenant management console.
- Platform-admin identity must be authorized again by the control plane.
- Same-origin BFF; no admin token in browser storage or JavaScript.
- Fixed method-and-path allowlist; no generic proxy.
- Security headers, `no-store`, body cap, and upstream timeout.
- MCP-default browser payloads cannot supply authentication fields, headers, or
  credentials. Authentication remains in each workspace's MCP setup, and the
  BFF strips upstream MCP authentication metadata from responses.
- CSP keeps Git import same-origin. The browser sends one HTTPS URL through a
  fixed BFF route; the control plane checks the deployment Git-host allowlist
  before making an anonymous, redirect-rejecting provider request. Git
  credentials and API bases never enter browser state.
- Platform-admin mutations require an attributable audit record.
- Production requests require both the internal BFF credential and a human OIDC admin session with one of three fixed roles.
- Password login is not exposed; MFA assurance and recent authentication are enforced by the control plane.
- Workspace deletion is modeled as suspension and recovery before purge.
- Production uses one-hour absolute and 15-minute idle sessions, CSRF and Origin protection, and 15-minute recent-authentication checks for writes.

## Explicitly Forbidden

Any route outside `/admin/v1`, plus any route or response that reveals or modifies tenant workloads. A future `/admin/v1` route is not automatically allowed; it requires an intentional policy and test change here.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability. Contact the AcornOps maintainers through the private security channel or the project community at https://discord.gg/KHUUdXfsXv and request a private escalation path. Do not include tokens, customer data, logs, or exploit details in a public message.
