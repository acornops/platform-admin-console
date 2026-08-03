# Admin User Last Login

## Goal

Show the latest recorded workspace-user login in a new Users directory column
while retaining the existing Created column.

## Scope and Boundary

- Consume only optional `lastLoginAt` from the existing allowlisted user-list
  route.
- Keep the existing same-origin BFF and `admin:user:read` scope.
- Project only the aggregate timestamp; expose no active-session or identity
  details.
- Render `-` when the producer has no recorded login timestamp.
- Make no unrelated styling, filtering, panel, or interaction changes.

## Validation Results

- Full `npm run validate` passes: lint, 87 tests, contract and requirements
  checks, harness checks, production builds, and route smoke tests.
- Focused response-projection coverage confirms session details remain absent.
- Rendered-table source coverage confirms the new column order and `-` fallback.
- Live mock-mode inspection passes at 1440px and 390px widths with `Last Login`
  immediately before `Created` and the absent value rendered as `-`.

## Completion Criteria

- The Users table reads `User`, `Workspaces`, `Status`, `Last Login`, `Created`.
- Existing behavior and responsive row labels remain intact.
- Producer and consumer contract evidence matches.
