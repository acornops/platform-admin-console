# UI/UX polish release handoff

Current at 2026-10-19. Coordinated phases 01–06 and 07A/07B/07C are implemented
and scoped-review approved. PAC owns the applicable access, state, accessibility,
clarity and 07A plan-preview work; 07B logs and 07C large-tool lists are MC
surfaces. Phase 08 is **implemented; release verification blocked** on the
remaining live acceptance. All automated component stages passed, but release
readiness is not established. Final frozen-source PAC automation passed.
The single cleanup re-review approved all six findings, spec compliance and
code quality, with no new findings. MC's bounded subsequent integration repair
also passed scoped review; its final canonical and complete interaction/parity
stages passed. PAC production/test source is unchanged. A successful MC
end-to-end wrapper rerun is not claimed.

## Checkout, requirements and boundaries

Developed on matching `fix/ui-ux-polish` branches from PAC review baseline
`766452c5febac5cdc751128c51f732b34c01107f` and MC baseline
`3baf36e3a50ed35707c621a9c65e6670832d704c`. CP is unchanged at
`bf24329069af1342da968c9f3bd653f746885fbf`. On 2026-10-19 the user authorized
one consolidated commit per console and direct integration/push to `main`,
together with deployment setup commit `60dedac`. Git history records the
integrated revisions. This approval does not authorize a release, deployment,
paid/model call or dependency change.

Preserves REQ-UX-001/REQ-CTL-001, REQ-USR-001/002/004/005/007/009,
REQ-WSP-001/002/003, REQ-DEF-001, REQ-AUD-001/002 and REQ-BND-001/002/003.
Current requirements remain authoritative and unchanged by the final singular
count cleanup. EXC-002/010/015/017/018 remain excluded; no BLOCK capability is
unblocked. Same-origin fixed BFF routes, 27-route/eight-scope subset, human
authorization, CSRF/recent-auth, private data projection and write-only key
boundary remain unchanged. No registry restoration, default reconciliation,
quota editor, tenant operations, redesign or new API is introduced.

## Current finding disposition

| Finding | Current disposition |
| --- | --- |
| F01 | MC shared exact-context approval review implemented; real engine-backed acceptance pending. |
| F02/F11 | PAC grants require explicit eligible identity/workspace and role, disambiguated by name/email. Existing role edits retain assigned values. MC owner search/pagination preserves selection. |
| F03/F06/F07/F08/F12/F20 | Associated labels, nested Escape/focus restoration and bounded layouts implemented using existing primitives. F07 existing panel anatomy passed checks and was retained. Genuine zoom/screen-reader acceptance pending. |
| F04/F05/F09/F10/F13 | Truthful toast/load states and local skill draft Keep editing/Discard guard, including required-auth bypass; MC workflow identity, integration failure and Open Agent labels corrected. |
| F14/F15/F18/F22/F23 | Audit actor/time/range guidance, OIDC casing, last-owner explanations and selectable full source copy; MC connectivity/schedules/recovery/account/catalog copy corrected. |
| F16/F24 | MC approval copy is policy-dependent, not an enabled-write promise. Selected MC and PAC Overview zero/one/many counts corrected. |
| F17 | Change Plan compares loaded resource/execution usage, current effective limits and selected defaults. Overrides preserved; zero/unlimited/unavailable distinguished. Failed conflict refresh blocks resubmit; first submit reject and server-triggered unchecked retain-existing retained. |
| F19/F21 | MC loaded-only log tools and complete paged tool search implemented, with original exported timestamps and local saved-effective summary qualifier. |

PAC Select/modal/toast replicas follow MC's narrowly scoped shared corrections,
retaining PAC placement/ID/chevron differences. Plan selection causes no extra
reads or writes. Audit draft filters differ visibly from applied filters;
browser-local time converts to inclusive entered instants (seconds :00), not
whole-day boundaries. Server authority for capacity and last-owner races is
preserved. Seed-only defaults and public github.com/gitlab.com imports remain.

## Compatibility, integration and rollback

Coordinate MC's canonical shared-UI corrections before or alongside this PAC
replica. Both consoles build independently against the unchanged CP revision;
no public endpoint, database, credential or authorization migration is needed.
PAC remains `0.0.1-experimental.5`, MC `0.0.1-experimental.1`, and both local UI
packages `0.0.0` pending normal MC Changeset release handling. Direct `main`
integration was requested, not PRs. The separate deployment setup commit is
local-development-only.

Explicit new-grant choices, populated-skill discard protection, audit filter
guidance and plan comparisons are intentional behavior/interaction changes,
not new governance powers. After release approval,
rollback is the previous console build pair without a data migration. Preserve
unrelated local files. Live
acceptance gates below still prevent unconditional release approval.

## Reproducible verification and fixture mode

Pre-integration sanity check on 2026-10-19: `npm run validate` passed again in
control-plane mode under native Node 22.23.1, including all 99 tests. MC's
canonical 1187 tests, deployment `task validate` and parent `task validate`
also passed. Only handoff integration status changed after the browser-stage
verification; no product or test change invalidates that evidence.

Use actual native Node 22 (this checkout: 22.23.1), not a version-label shim:

```sh
export PATH=/Users/tjtanjin/.npm/_npx/d295cebdb7c54afe/node_modules/node/bin:$PATH
unset NO_COLOR FORCE_COLOR
node --version
ADMIN_CONSOLE_DATA_MODE=control-plane npm run validate
```

On another machine use its own native Node 22 directory. `validate` includes
lint, unit/server tests, contracts, requirements, harness, independent build
and route smoke. Mock verifiers below create isolated loopback servers from
the built assets; they do not use or mutate live admin data:

```sh
npm run build
export PLAYWRIGHT_MODULE_PATH="$PWD/../management-console/node_modules/playwright/index.mjs"
node scripts/verify-directory-hardening-browser.mjs
node scripts/verify-ui-polish-browser.mjs
node scripts/verify-hosted-policy-browser.mjs
```

Use an installed Playwright module, for example the sibling MC
`node_modules/playwright/index.mjs`; provide `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
only when an installed browser executable is required. To explore fixtures
manually, run `ADMIN_CONSOLE_DATA_MODE=mock npm run dev` and use `/`,
`/workspaces/ws_atlas`, `/users`, `/capabilities` or `/audit`.
Browser verifiers supply explicit page-local fixture response variations for
delays/errors/long identities/plan conflicts. No live credentials are needed.

Final frozen-source PAC verification (2026-10-19): native Node 22,
`ADMIN_CONSOLE_DATA_MODE=control-plane npm run validate` passed 99/99 tests,
lint, contracts, requirements, harness, build and route smoke. The three
built-assets mock verifiers above passed directory 14/14, UI polish 33/33 and
hosted policy 7/7: 54 browser cases total, no skips. The initial sandbox
canonical attempt failed 38 HTTP tests on local-listener `EPERM`; the approved
loopback rerun passed, without a product fix. These complete PAC automation,
not genuine live identity/authorization or coordinated release acceptance.

MC's final `npm run validate && npm run smoke:fixtures && npm run smoke:mcp-parity`
exited 0: 232 files/1187 canonical tests, 253 fixture-browser tests and eight MCP
parity tests, with no fixture/parity skips or retries. Its 34 individually reviewed Linux images
passed 50 route chunks and forced-colors; design-system browsers passed 27 with
one existing conditional mobile skip. After the bounded dock/test repairs,
focused MC browsers passed 23/23, units 29/29 and parity 8/8. The last full
wrapper stopped at 249/251 fixtures due to cumulative test budget and loaded-form
readiness, not reported layout assertions. Those two test-only corrections
passed review and seven covering cases, followed by the complete passing
canonical/fixture/parity rerun above. Completed visual evidence is retained after byte-verifying all
runtime/design/configuration/baseline inputs unchanged. No passing historical
`validate:full` invocation is claimed. Unchanged CP isolated DB/Redis validation
passed 243 suites/1313 tests with no skips. CP migration static checks passed;
optional SQL upgrade execution was not enabled, and this package contains no migration. Parent
platform-contract, runtime-truth and `task validate` passed under Node 22.

Focused final cleanup, reproduced RED before correcting singular copy:

```sh
node --test-name-pattern='overview portfolio labels' scripts/verify-ui-polish-browser.mjs
npm run requirements:check
npm run lint
npm test
```

After rebuilding, the overview 0/1/3 VM/cluster browser cases passed 3/3;
requirements and lint passed, and the fresh unit/server suite passed 99/99.
The test asserts both connected-environment summary and workspace portfolio
row labels, without introducing a general plural framework. The final complete
PAC automation above includes these cases. The focused cleanup re-review and
bounded MC integration repairs are approved. Logs, including the final
`acornops-ui-polish-final-stages.log`, are retained in the parent workspace's
`tmp/ui-ux-polish-2026-10-18/verification/` as supplemental local evidence.

## Completed observations, cleanup and open acceptance

Coordinator CUA completed the live read-only sidebar sweep and compact audit
inspection. System appearance was unchanged. A live dark-mode change awaits
permission; isolated dark fixture/browser evidence is distinct.
MC root observations included keyboard/narrow behavior, MCP 200-tool search,
disabled registry/direct URL, collapsed Agent appearance, bounded plan preview,
and real local k3d log find/follow/status and unavailable-pod/export failure.
CP→AgentV connectivity/log reads used a simulated AgentV, not real systemd.

Disposable local backend acceptance covered 53 members (50+3/search), selected
owner draft retention without saving transfer, Viewer grant/revoke and a paused
read-only workflow schedule with Singapore/New York preview/persistence and no
executions/model calls. The one disposable workspace and all 54 synthetic
accounts were removed normally/guarded; 110 synthetic sessions were revoked.
Existing data was preserved. Disposable database/cache test containers and root
browser previews have been removed/stopped. The final MC runner exited and was
automatically removed; its task-owned 1.2 GiB scratch source/dependency directory
was removed after retaining evidence. The original local stack and unmerged
review records are preserved. Never automatically replay old fixed-ID live
setup scripts.

Unverified gates: genuine IdP/OIDC, recent-auth/session loss, last-owner races,
live plan version conflict/retain-existing, engine-backed harmless
approval/dispatch, real Linux VM/systemd/recovery, approved HTTPS MCP OAuth
provider/canary, genuine 200%/400% browser zoom, representative screen reader,
OS clipboard. MC's production build scan found none of the five checked fixture
identity/router/worker markers in its 54 emitted JS/CSS assets. Narrow viewports,
mock authorization, CSS reflow and AX/keyboard checks do not close these gates.

Separate preexisting MC launch risk: `useWorkflowCapabilityPreview` rejects a
direct `read_only` preview against aggregate `read_write` workflow policy,
possibly blocking launch. A fix awaits user scope approval. Tool-results,
NetworkPolicy and VM-recovery rollout gates remain independent. The old
caniuse-lite warning is maintenance-only, unchanged and unsuppressed. The
initial MC activity refresh notice is a separate preexisting observation,
normalized only in snapshot preparation through ordinary Refresh, not fixed
in production. A separate fixture-only observation of VM quick-chat startup
timing remains uninvestigated as a production issue; the capability-layout
test isolates recent activity, without changing session production code.

Parent phase/review ledgers are supplemental local details. This record and the
repository tests provide the portable handoff. Scoped review and automated-stage
verification are complete; the release owner must supply the remaining live
acceptance and authorize release promotion.
