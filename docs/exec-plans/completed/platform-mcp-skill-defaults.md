# Platform Capabilities Defaults

## Goal

Provide a compact governance UI for platform administrators to manage the MCP
servers and skills copied once into newly created workspaces.

## Constraints

- Add one navigation page named `Capabilities`.
- Use MCP servers and Skills tabs, search, and an `Available in` membership filter.
- Reuse Management Console secondary add/import actions and divided dialog anatomy.
- Keep MCP creation to name, HTTPS endpoint, and destinations. Authentication
  stays in each workspace's existing MCP setup and is not accepted or returned
  by the browser contract.
- Store one or more destinations; display all three selected destinations as `All`.
- Apply changes only to workspaces created afterward; never update existing
  workspace snapshots.
- Resolve public GitHub and GitLab skill refs into pinned Markdown snapshots in
  the browser without credentials. Private Git and custom API bases are excluded.
- Use only fixed same-origin BFF routes.
- Reuse the existing system read/write scopes; this page adds no deployment
  token or role scope.
- Never accept credentials or expose tenant operational data.
- Keep viewers read-only and auditors excluded.
- Do not add catalogs, readiness, revisions, publication, access policies, or
  built-in tool management.

## Validation

- `npm run validate` covers route policy, body allowlist, response projection,
  scope, requirements, harness, build, and route smoke.
- The page tests cover tabs, URL-backed filters, read-only actions, secret-free
  projections, credential-free MCP creation, multi-destination selection, and
  public-Git snapshot import.

## Completion Criteria

An administrator can add, filter, edit availability, and remove the
initialization list without changing existing workspaces, the Platform Settings
page, or the governance boundary.
