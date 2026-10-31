# Admin console reliability implementation plan

> **For agentic workers:** Use superpowers:executing-plans task by task.

**Goal:** Prevent false logout success, stale detail mutations, and endless cursor traversal.
**Architecture:** Preserve routes and layouts. Check logout responses, guard paginated traversal, and bind detail state and pending reads to the currently selected resource.
**Tech Stack:** React, TypeScript, Node tests, existing Playwright verification scripts.
**Spec:** Accepted scope below and current requirements REQ-WSP-001/004, REQ-USR-001/007/009, REQ-UX-001.

## Accepted scope and global constraints

- Preserve authorization, CSRF, membership eligibility, last-owner rules, and mutation payloads.
- Failed logout stays visible and retryable; redirect only after confirmed success.
- A response for an old selection must never populate or enable actions for the new selection.
- Repeated cursors must fail explicitly; canceled reads must not update an unmounted detail panel.
- Catalog scaling is a separate change; no new endpoint or redesign here.

## Review focus

- Logout 403/503/network failures must not redirect or imply session termination.
- Rapid workspace/user navigation and back/forward must reject late responses.
- Pending refreshes and dialogs must not retain another resource's selections.
- Repeated cursors must terminate without silently returning a partial success.
- Membership mutations must still address the displayed immutable resource IDs.

## Task 1: Harden asynchronous behavior

**Files:** `src/api.ts`, `src/pages/WorkspacesPage.tsx`, `src/pages/UsersPage.tsx`, new `test/api.test.ts`, browser verification script, reliability docs.
**Interfaces:** Add optional `signal: AbortSignal` to read helpers; preserve existing callers.

- [x] Add failing API tests for logout failures and repeated cursors; add browser cases for delayed detail responses and navigation.
- [x] Run those tests against the baseline and verify the intended failures.
- [x] Implement narrow response checks, cancellation/request sequencing, and resource identity resets.
- [x] Run `npm run validate`, existing directory browser checks, and new browser checks; expect passing behavior.
- [x] Record requirement preservation and evidence; commit as `fix: guard admin logout and detail loading`.

## Validation evidence

- API regressions: 3 failed on baseline; all 5 pass after the fix.
- Detail browser regressions: all 4 failed on baseline; all 4 pass after the fix.
- Existing directory and grant browser checks: 14 pass.
- `npm run validate`: passed, including unit/BFF tests, contracts, requirements, build and route smoke checks.
- Requirements listed above are preserved; routes and payloads are unchanged.
