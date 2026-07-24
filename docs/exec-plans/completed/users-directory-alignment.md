# Users Directory Alignment

Status: completed

## Outcome

The platform-admin Users directory now follows the management console's MCP inventory-search pattern while remaining truthful to the cursor-paginated `/admin/v1/users` contract.

## Delivered

- Replaced the `User register` heading and platform-account count with a dedicated inventory toolbar.
- Added a leading-icon, debounced search control backed by the existing `q` query so display-name, email, and user-ID searches span the server-side directory.
- Added the server-backed verification filter: `All users`, `Verified`, and `Unverified` through the existing `emailVerified` query.
- Added a compact `Showing X of Y` badge; it says `loaded` while the server exposes another cursor.
- Added cursor-driven `Load more` behavior instead of numbered pagination.
- Added mock parity for `limit`, `cursor`, `q`, `email`, `authMethod`, and `emailVerified` query behavior.
- Replaced ambiguous user-facing `cross-workspace` terminology with `workspace access` and `workspace memberships`.
- Updated the product and design registers with the directory-list and terminology decisions.

## Validation Evidence

- `npm run validate:ci`
  - 23 tests passed.
  - Coverage: 86.99% lines, 73.00% branches, 88.61% functions.
  - Contract checks passed for 14 routes, 8 scopes, DTO fields, and privacy projections.
  - Harness checks passed for 32 required files.
  - Build and static/API/denial smoke routes passed.
- Live browser verification at `http://127.0.0.1:4173/users`
  - User-ID search for `usr_sam` produced `Showing 1 of 1` and the expected account through the server-backed `q` filter.
  - `Verified` produced `Showing 5 of 5` and excluded the unverified account through the server-backed `emailVerified` filter.
  - No browser runtime errors were reported.

## Contract Impact

None. The UI uses the existing `/admin/v1/users` query allowlist and `{ items, nextCursor? }` response shape. No route, DTO, scope, or confidentiality boundary changed. A global total was intentionally not added or inferred.
