import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [html, app, auditPage, overviewView, userDirectory, userPanelView, membershipActions, workspaceDirectory, workspacePanelView, workspaceAccessActions, menuControls, toastController, styles, brandmark, readme, product] = await Promise.all([
  readFile(new URL("public/index.html", root), "utf8"),
  readFile(new URL("public/app.js", root), "utf8"),
  readFile(new URL("public/audit-page.js", root), "utf8"),
  readFile(new URL("public/overview-view.js", root), "utf8"),
  readFile(new URL("public/user-directory.js", root), "utf8"),
  readFile(new URL("public/user-panel-view.js", root), "utf8"),
  readFile(new URL("public/user-membership-actions.js", root), "utf8"),
  readFile(new URL("public/workspace-directory.js", root), "utf8"),
  readFile(new URL("public/workspace-panel-view.js", root), "utf8"),
  readFile(new URL("public/workspace-access-actions.js", root), "utf8"),
  readFile(new URL("public/menu-controls.js", root), "utf8"),
  readFile(new URL("public/toast.js", root), "utf8"),
  readFile(new URL("public/styles.css", root), "utf8"),
  readFile(new URL("public/admin-brandmark.svg", root), "utf8"),
  readFile(new URL("README.md", root), "utf8"),
  readFile(new URL("PRODUCT.md", root), "utf8")
]);

test("matches the management-console shell and icon vocabulary", () => {
  assert.match(html, /class="wordmark"><strong>acorn<\/strong><b>ops<\/b>/);
  assert.match(html, /<rect width="7" height="7" x="3" y="3" rx="1"\/><rect width="7" height="7" x="14" y="3" rx="1"\/><rect width="7" height="7" x="14" y="14" rx="1"\/><rect width="7" height="7" x="3" y="14" rx="1"\/>/);
  assert.equal((html.match(/class="nav-icon"/g) || []).length, 4);
  const workspaceIcon = '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>';
  assert.ok(html.includes(workspaceIcon));
  assert.ok(userDirectory.includes(workspaceIcon));
  assert.doesNotMatch(`${html}\n${userDirectory}`, /M12\.83 2\.18/);
  assert.doesNotMatch(html, /Privileged governance|No workspace data access|Prototype/);
  assert.doesNotMatch(html, /class="eyebrow"/);
  assert.match(html, /class="admin-account-bar" aria-label="Signed-in administrator identity"/);
  assert.match(html, /class="admin-profile"/);
  assert.match(styles, /\.admin-account-bar \{ position: relative; margin-top: auto; padding: 12px 12px 20px; border-top: 1px solid var\(--admin-border\); background: var\(--surface\); \}/);
  assert.doesNotMatch(html, /Tenant data is out of scope|No logs, runs, targets, commands, or workload controls/);
  assert.doesNotMatch(styles, /\.sidebar-boundary/);
  assert.match(brandmark, /fill="#584738"/);
  assert.match(brandmark, /fill="#F1EADA"/);
  assert.doesNotMatch(brandmark, /<rect/);
});

test("makes platform administration unmistakable without relying on color alone", () => {
  assert.match(html, /data-console="platform-admin"/);
  assert.match(html, /class="console-identity"[^>]*>.*Platform Admin/s);
  assert.match(html, /<title>Admin · AcornOps<\/title>/);
  assert.doesNotMatch(html, /<title>Platform Admin Console · AcornOps<\/title>/);
  assert.match(html, /href="\/admin-brandmark\.svg"/);
  assert.match(html, /src="\/admin-brandmark\.svg"/);
  assert.match(brandmark, /aria-label="AcornOps shield"/);
});

test("uses management-console fonts, tokens, and route-title scale", () => {
  assert.match(styles, /font-family: "Outfit"/);
  assert.match(styles, /font-family: "Ubuntu Mono"/);
  assert.match(styles, /--bg: #fcfaf6/);
  assert.match(styles, /--brand-orange: #ff703b/);
  assert.match(styles, /grid-template-columns: 256px minmax\(0, 1fr\)/);
  assert.match(styles, /font-size: 1\.875rem/);
  assert.doesNotMatch(styles, /--nav:|\.privacy-banner|\.environment/);
});

test("uses an accessible admin accent while preserving semantic colors", () => {
  const accent = readOklch("admin-accent");
  const accentSoft = readOklch("admin-accent-soft");
  assert.ok(contrast(accent, [1, 1, 1]) >= 4.5, "admin context text contrast must meet WCAG AA");
  assert.ok(contrast(accent, accentSoft) >= 3, "admin wayfinding contrast must meet the UI component minimum");
  assert.match(styles, /--success: #007f4e/);
  assert.match(styles, /--warning: #465200/);
  assert.match(styles, /--danger: #c13140/);
  assert.match(styles, /\.button\.primary \{ background: var\(--text\); color: var\(--bg\); \}/);
  assert.match(styles, /\.button\.accent \{ background: var\(--brand-orange\); color: var\(--text\); \}/);
});

test("keeps the overview focused on product insight without decorative readiness or underlined leaders", () => {
  assert.doesNotMatch(app, /api\("\/system\/readiness"\)/);
  assert.doesNotMatch(overviewView, /readiness\.status|class="status/);
  assert.match(styles, /\.leaderboard-group a \{[^}]*text-decoration: none/);
});

test("keeps page headers to title, description, and optional actions", () => {
  for (const removedContext of ["Platform governance", "Directory", "Account directory", "Workspace record", "User record", "Cross-workspace access", "Accountability", "Connection error"]) {
    assert.doesNotMatch(app, new RegExp(`pageHeader\\([^\\n]+${removedContext}`));
  }
  assert.match(app, /function pageHeader\(title, description, actions = "", className = ""\)/);
  assert.doesNotMatch(app, /class="eyebrow/);
});

test("aligns the users directory with the management-console inventory pattern", () => {
  assert.match(userDirectory, /class="directory-toolbar"/);
  assert.match(userDirectory, /id="user-search"[^>]+placeholder="Search name, email, or ID"/);
  assert.match(userDirectory, /id="user-verification"/);
  assert.match(userDirectory, /<option value="all">All users<\/option><option value="verified">Verified<\/option><option value="unverified">Unverified<\/option>/);
  assert.match(userDirectory, /id="user-count" aria-live="polite"/);
  assert.match(userDirectory, /Showing \$\{visibleUsers\.length\} of \$\{state\.users\.length\}/);
  assert.match(userDirectory, /params\.set\("q", query\)/);
  assert.match(userDirectory, /params\.set\("emailVerified"/);
  assert.match(userDirectory, /id="user-load-more"[^>]*>Load more<\/button>/);
  assert.match(userDirectory, /page\.nextCursor/);
  assert.match(userDirectory, /<th>Workspaces<\/th>/);
  assert.doesNotMatch(userDirectory, /<th>Memberships<\/th>/);
  assert.doesNotMatch(app, /primary-cell[^\n]+user\.displayName[^\n]+secondary-cell[^\n]+user\.id/);
  assert.doesNotMatch(`${app}\n${userDirectory}`, /User register|platform accounts/i);
  assert.match(userDirectory, /enhanceSelect\(verification\)/);
  assert.match(menuControls, /className = "select-trigger"/);
  assert.match(menuControls, /role="option" aria-selected/);
  assert.match(menuControls, /menu-check/);
  assert.match(menuControls, /positionMenu/);
  assert.match(menuControls, /cleanupMenuControls/);
  assert.match(menuControls, /pointerenter", \(\) => \{ if \(!options\(\)\[index\]\?\.disabled\) setActive\(index\); \}/);
  assert.match(menuControls, /pointerenter", \(\) => setActive\(index\)/);
  assert.doesNotMatch(menuControls, /pointerenter[^\n]+renderMenu/);
  assert.match(menuControls, /aria-activedescendant/);
  assert.match(menuControls, /"ArrowDown"|"ArrowUp"/);
});

test("aligns the workspaces directory with the accepted users inventory pattern", () => {
  assert.match(workspaceDirectory, /Review workspace governance, plans, access, and creation details\./);
  assert.match(workspaceDirectory, /class="directory-toolbar workspace-directory-toolbar"/);
  assert.match(workspaceDirectory, /placeholder="Search workspace name"/);
  assert.doesNotMatch(workspaceDirectory, /id="workspace-plan"|All plans/);
  assert.doesNotMatch(workspaceDirectory, /id="workspace-quota-status"|Within limits|Over limit/);
  assert.doesNotMatch(workspaceDirectory, /<th>Plan<\/th>|<th>Quota status<\/th>/);
  assert.match(workspaceDirectory, /Showing \$\{state\.workspaces\.length\} of \$\{state\.workspaces\.length\}/);
  assert.match(workspaceDirectory, /id="workspace-load-more"[^>]*>Load more<\/button>/);
  assert.match(workspaceDirectory, /id="workspace-status"[^>]*><option value="all">All statuses<\/option><option value="active">Active<\/option><option value="suspended">Suspended<\/option>/);
  assert.match(workspaceDirectory, /enhanceSelect\(status\)/);
  assert.match(workspaceDirectory, /while \(statusFilter !== "all" && page\.nextCursor\)/);
  assert.match(workspaceDirectory, /workspace\.lifecycleStatus === statusFilter/);
  assert.match(styles, /\.workspace-directory-toolbar \{ grid-template-columns: minmax\(16rem, 1fr\) minmax\(12rem, \.55fr\) auto; \}/);
  assert.match(workspaceDirectory, /<th>Status<\/th>/);
  assert.match(workspaceDirectory, /workspace-directory-status/);
  assert.match(workspaceDirectory, /params\.set\("q", query\)/);
  assert.doesNotMatch(workspaceDirectory, /params\.set\("planKey"|params\.set\("overLimit"/);
  assert.doesNotMatch(`${app}\n${workspaceDirectory}`, /Workspace register|Search name, creator, or ID/);
});

test("keeps workspace directory context while details and bounded actions open in a side panel", () => {
  assert.match(html, /id="workspace-panel" role="dialog" aria-modal="true"/);
  assert.match(html, /aria-label="Close workspace details"/);
  assert.match(app, /renderWorkspaces\(match\[1\]\)/);
  assert.match(app, /history\.pushState\(\{ workspacePanel: true \}/);
  assert.match(app, /trapFocus\(event, workspacePanel\)/);
  assert.match(workspacePanelView, />Workspace Details</);
  assert.match(workspacePanelView, /Kubernetes clusters/);
  assert.match(workspacePanelView, /Virtual machines/);
  assert.match(workspacePanelView, />Workspace Access</);
  assert.match(workspacePanelView, /workspace\.memberCount/);
  assert.match(workspacePanelView, /workspace-members-table/);
  assert.match(workspacePanelView, /data-change-plan>Change Plan/);
  assert.match(workspacePanelView, /workspace-plan-value/);
  assert.match(workspacePanelView, /capacity-badge/);
  assert.match(styles, /\.capacity-badge \{[^\n]+background: var\(--surface-strong\); color: var\(--text\)/);
  assert.doesNotMatch(styles, /\.capacity-badge\.within-limit[^\n]+var\(--success/);
  assert.match(app, /config\.planCatalog\?\.plans/);
  assert.match(workspacePanelView, /workspace-lifecycle-status/);
  assert.match(styles, /\.workspace-lifecycle-copy \{ max-width: none; white-space: nowrap; \}/);
  assert.match(workspacePanelView, /data-manage-workspace-access[^>]+>Manage Access</);
  assert.match(app, /bindWorkspaceAccessManager/);
  assert.match(workspaceAccessActions, /createUserIfMissing: false/);
  assert.match(workspaceAccessActions, /data-update-workspace-role/);
  assert.match(workspaceAccessActions, /data-revoke-member/);
  assert.match(workspacePanelView, /data-add-workspace-access/);
  assert.match(workspacePanelView, /data-tooltip="Add workspace access"/);
  assert.match(workspacePanelView, /aria-label="Add workspace access"/);
  assert.match(workspaceAccessActions, /addButton\.hidden = !managing/);
  assert.match(workspaceAccessActions, /data-member-user-id/);
  assert.doesNotMatch(workspaceAccessActions, /data-user-id=/);
  assert.doesNotMatch(workspaceAccessActions, /Revoke Non-owner Access|data-revoke-workspace-access|revokeAllNonOwners/);
  assert.doesNotMatch(workspaceAccessActions, /createUserIfMissing: true|body: \{ email/);
  assert.match(workspacePanelView, />Workspace Lifecycle</);
  assert.match(workspacePanelView, /data-workspace-lifecycle/);
  assert.match(app, /confirmation\.value !== workspace\.name/);
  assert.match(app, /restoring \? "restore" : "suspend"/);
  assert.match(html, /id="dialog-cancel" type="button">Cancel<\/button>/);
  assert.match(app, /dialogCancel\.addEventListener\("click", \(\) => dialog\.close\("cancel"\)\)/);
  const lifecycleStart = app.indexOf("function changeWorkspaceLifecycle");
  const lifecycleEnd = app.indexOf("function openDialog", lifecycleStart);
  const lifecycleFlow = app.slice(lifecycleStart, lifecycleEnd);
  assert.match(lifecycleFlow, /const verb = restoring \? "restored" : "suspended"/);
  assert.match(lifecycleFlow, /workspaceName: data\.get\("workspaceName"\)/);
  assert.doesNotMatch(lifecycleFlow, /ticketRef|reasonFields/);
  const planStart = app.indexOf("async function changePlan");
  const planEnd = app.indexOf("function changeWorkspaceLifecycle", planStart);
  const planFlow = app.slice(planStart, planEnd);
  assert.match(planFlow, /reason: `Platform admin changed workspace plan from \$\{workspace\.plan\.key\} to \$\{planKey\}`/);
  assert.doesNotMatch(planFlow, /ticketRef|reasonFields/);
  assert.doesNotMatch(workspacePanelView, /Quota Usage|Quota policy|Manage Workspace|data-change-quotas|Owner lookup|workspace logs|commands/i);
});

test("uses the management console Select treatment exactly", () => {
  assert.match(styles, /\.select-trigger \{[^}]+height: 44px;[^}]+padding: 0 16px;[^}]+font-size: 14px;[^}]+font-weight: 500;/);
  assert.match(styles, /\.select-trigger:hover \{ border-color: rgba\(255, 112, 59, \.25\); background: var\(--bg\); \}/);
  assert.match(styles, /\.select-trigger\.open \{[^}]+border-color: rgba\(255, 112, 59, \.35\);[^}]+box-shadow: 0 0 0 2px rgba\(255, 112, 59, \.1\);/);
  assert.match(styles, /\.select-menu \{ position: fixed; z-index: 140;[^}]+font-size: 14px; font-weight: 500;/);
  assert.match(styles, /box-shadow: 0 10px 15px -3px rgba\(48, 45, 41, \.1\), 0 4px 6px -4px rgba\(48, 45, 41, \.1\)/);
  assert.match(styles, /\.menu-option \{[^}]+min-height: 44px;[^}]+padding: 8px 12px;/);
  assert.match(styles, /@media \(min-width: 640px\) \{[\s\S]+\.menu-option \{ min-height: 36px; \}/);
  assert.match(styles, /\.menu-check \{[^}]+stroke: var\(--brand-orange-strong\)/);
  assert.match(styles, /\.select-trigger\.open \.select-chevron, \.combobox-toggle\.open \.select-chevron \{ stroke: var\(--text-muted\); transform: rotate\(180deg\); \}/);
  assert.match(styles, /--brand-orange-rgb: 255 112 59/);
  assert.match(styles, /\.select-menu \{ scrollbar-color: rgb\(var\(--brand-orange-rgb\) \/ 22%\) transparent; scrollbar-width: thin; \}/);
  assert.match(styles, /\.select-menu::\-webkit-scrollbar \{ width: 5px; height: 5px; \}/);
  assert.match(styles, /\.select-menu::\-webkit-scrollbar-track \{ background: transparent; \}/);
  assert.match(styles, /\.select-menu::\-webkit-scrollbar-thumb \{ border-radius: 999px; background: rgb\(var\(--brand-orange-rgb\) \/ 22%\); \}/);
  assert.match(styles, /\.select-menu::\-webkit-scrollbar-thumb:hover \{ background: rgb\(var\(--brand-orange-rgb\) \/ 40%\); \}/);
});

test("filters users by suggested workspace names through existing admin reads", () => {
  assert.match(userDirectory, /Review identity and workspace access for AcornOps users\./);
  assert.match(userDirectory, /id="user-workspace-filter"[^>]+placeholder="Filter by workspace"/);
  assert.match(userDirectory, /enhanceCombobox\(workspaceFilter, workspaces\)/);
  assert.doesNotMatch(userDirectory, /<datalist|list="workspace-suggestions"/);
  assert.match(menuControls, /aria-autocomplete", "list"/);
  assert.match(menuControls, /Workspace suggestions/);
  assert.match(userDirectory, /workspace\.name[\s\S]+workspace\.id/);
  assert.match(userDirectory, /while \(workspaceQuery && page\.nextCursor\)/);
  assert.match(userDirectory, /api\(`\/users\/\$\{encodeURIComponent\(user\.id\)\}`\)/);
  assert.match(userDirectory, /Filtering workspace access…/);
  assert.match(userDirectory, /filterUsersByWorkspace/);
  assert.doesNotMatch(userDirectory, /params\.set\("workspaceId"/);
});

test("uses clear workspace-access language instead of cross-workspace terminology", () => {
  assert.match(userPanelView, /Workspace Access/);
  assert.doesNotMatch(userPanelView, /Workspace Membership/);
  assert.doesNotMatch(`${app}\n${userDirectory}\n${userPanelView}\n${readme}\n${product}`, /cross-workspace/i);
});

test("keeps the users directory visible while details open in an accessible side panel", () => {
  assert.match(html, /id="user-panel" role="dialog" aria-modal="true"/);
  assert.match(html, /id="user-panel-close"[^>]+aria-label="Close user details"/);
  assert.match(app, /renderUsers\(match\[1\]\)/);
  assert.match(app, /openUserPanel\(userRoute\[1\]/);
  assert.match(app, /appShell\.inert = true/);
  assert.match(app, /trapFocus\(event, userPanel\)/);
  assert.match(styles, /\.user-panel-layer\.open \.user-panel/);
  assert.match(styles, /width: min\(720px, calc\(100vw - 256px\)\)/);
});

test("uses contract-provided roles, grants existing-user access, and excludes account recovery", () => {
  assert.match(app, /config\.roleTemplateKeys/);
  assert.match(membershipActions, /memberPath\(editor, user\) \+ "\/role"/);
  assert.match(membershipActions, /reason: `Platform admin changed workspace role from \$\{titleCase\(previousRole\)\} to \$\{titleCase\(nextRole\)\}`/);
  assert.match(userPanelView, /data-grant-access/);
  assert.match(userPanelView, />Grant Access<\/button>/);
  assert.match(membershipActions, /method: "POST"/);
  assert.match(membershipActions, /userId: user\.id/);
  assert.match(membershipActions, /createUserIfMissing: false/);
  assert.match(membershipActions, /availableWorkspaces/);
  assert.match(membershipActions, /roleTemplateKeys/);
  assert.match(membershipActions, /roles\.includes\("member"\) \? "member" : roles\[0\]/);
  assert.doesNotMatch(membershipActions, /email: user\.email/);
  assert.doesNotMatch(app, /reviewRoleChange|Change \$\{user\.displayName\}'s role/);
  assert.doesNotMatch(app, /revokeSessions|Revoke active sessions|Open recovery desk|renderAccessRecovery/);
  assert.doesNotMatch(html, /href="\/access"|Access recovery/);
});

test("uses clear user status and membership lifecycle dates", () => {
  assert.match(app, /user\.emailVerified \? "Verified" : "Unverified"/);
  assert.match(app, /class="status verification-status \$\{user\.emailVerified \? "verified" : "unverified"\}"/);
  assert.match(styles, /\.status\.verification-status \{[^}]+display: inline-grid;[^}]+grid-template-columns: 7px auto;[^}]+padding: 0; background: transparent;/);
  assert.match(styles, /\.status\.unverified \{ color: var\(--brand-orange-readable\); \}/);
  assert.doesNotMatch(styles, /--unverified-soft|\.status\.unverified \{[^}]+(?:border-radius|background):/);
  assert.match(styles, /\.status[^}]+\.status\.verified \{ color: var\(--success\); \}/);
  assert.match(userPanelView, /class="membership-meta"/);
  assert.match(userPanelView, />Added <time/);
  assert.match(userPanelView, />Updated <time/);
  assert.match(userPanelView, /addedDate === updatedDate \? " hidden"/);
  assert.match(userPanelView, /membership\.createdAt/);
  assert.match(userPanelView, /membership\.updatedAt/);
  assert.match(membershipActions, /updatedDate === editor\.querySelector\("\[data-membership-added\]"\)\.textContent/);
  assert.doesNotMatch(userPanelView, /class="user-avatar"|Source ·|Membership origin|Created with workspace|Added in AcornOps/);
});

test("uses a compact task-first user panel hierarchy", () => {
  assert.match(app, /user-panel-title"\)\.textContent = user\.displayName/);
  assert.match(app, /user-panel-email"\)\.textContent = user\.email/);
  assert.match(userPanelView, /id="user-details-heading">User Details/);
  assert.match(userPanelView, /id="memberships-heading">Workspace Access/);
  assert.match(userPanelView, /memberships\.length} workspace/);
  assert.match(userPanelView, /data-update-role disabled>Update Role/);
  assert.match(membershipActions, /updateButton\.disabled = select\.value === editor\.dataset\.currentRole/);
  assert.match(userPanelView, /localeCompare/);
  assert.doesNotMatch(userPanelView, /Governance-safe account metadata|data-current-role-label|definition\("Memberships"/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.membership-meta \{ display: flex;/);
  assert.doesNotMatch(styles, /\.membership-lifecycle/);
  assert.doesNotMatch(styles, /\.membership-role-control \.button\[hidden\]/);
});

test("makes the admin actor explicit for immediate audited role updates", () => {
  assert.match(membershipActions, /async function updateRole/);
  assert.match(membershipActions, /button\.textContent = "Updating…"/);
  assert.match(membershipActions, /Role successfully updated to \$\{titleCase\(nextRole\)\}\./);
  assert.match(auditPage, /class="audit-cell-label">Actor/);
  assert.match(auditPage, /event\.adminActorDisplayName \|\| event\.adminActorEmail \|\| event\.adminActorSubject/);
});

test("gives the admin audit ledger clear responsive column headers", () => {
  assert.match(auditPage, /class="audit-table" role="table" aria-label="Governance events"/);
  assert.match(auditPage, /function auditEventCount\(count\) \{ return `\$\{count} \$\{count === 1 \? "event" : "events"} logged`; \}/);
  assert.doesNotMatch(auditPage, /events · affected item, actor, reason, and outcome/);
  assert.match(auditPage, /pageHeader\("Admin Audit", "A platform-level record of privileged governance actions\. Workspace audit events are intentionally unavailable\.", "", "audit-page-header"\)/);
  assert.match(html, /<span>Admin Audit<\/span>/);
  assert.match(styles, /\.audit-page-header \.lede \{ max-width: none; white-space: nowrap; \}/);
  assert.match(auditPage, /class="audit-columns" role="row"><span role="columnheader">Time<\/span><span role="columnheader">Event<\/span><span role="columnheader">Actor<\/span><span role="columnheader">Object<\/span><span role="columnheader" class="audit-details-heading">Details<\/span>/);
  assert.match(auditPage, /class="audit-event" role="row"/);
  assert.doesNotMatch(auditPage, /role="columnheader">Outcome/);
  assert.match(auditPage, /class="audit-cell-label">Time/);
  assert.match(auditPage, /data-audit-details/);
  assert.match(auditPage, /function eyeIcon\(\)/);
  assert.doesNotMatch(auditPage, /function detailsIcon\(\)/);
  assert.match(styles, /\.audit-columns \{[^}]*border-bottom: 1px solid var\(--border\)/);
  assert.match(styles, /@media \(max-width: 1023px\)[\s\S]*\.audit-columns \{ display: none; \}[\s\S]*\.audit-cell-label \{ display: block; \}/);
});

test("translates audit actions and distinguishes affected subjects from workspace context", () => {
  for (const label of ["Viewed workspace details", "Changed workspace plan", "Modified workspace status", "Modified workspace access", "Updated member role"]) {
    assert.match(auditPage, new RegExp(`"${label}"`));
  }
  assert.match(auditPage, /group:workspace_status_modified/);
  assert.match(auditPage, /group:workspace_access_modified/);
  for (const operation of ["suspended", "restored", "granted", "revoked"]) assert.doesNotMatch(auditPage, new RegExp(`\\(${operation}\\)`));
  for (const supersededLabel of ["Suspended workspace", "Restored workspace", "Granted workspace access", "Revoked workspace access"]) assert.doesNotMatch(auditPage, new RegExp(`"${supersededLabel}"`));
  assert.match(auditPage, /function auditAffectedMarkup\(event\)/);
  assert.match(auditPage, /event\.subjectId/);
  assert.match(auditPage, /event\.workspaceId/);
  assert.match(auditPage, /class="audit-affected-primary"><span>Workspace/);
  assert.match(auditPage, /event\.workspaceId\) return[^\n]+event\.subjectId[^\n]+class="audit-context"/);
  assert.doesNotMatch(auditPage, /event\.workspaceId \|\| event\.subjectId/);
  assert.match(auditPage, /titleCase\(event\.outcome \|\| "unknown"\)/);
});

test("matches the management-console append-only audit pagination pattern", () => {
  assert.match(auditPage, /params\.set\("limit", "50"\)/);
  assert.match(auditPage, /new IntersectionObserver/);
  assert.match(auditPage, /rootMargin: "240px 0px"/);
  assert.match(auditPage, /class="button secondary" id="audit-load-more"/);
  assert.match(auditPage, /button\.textContent = "Loading more…"/);
  assert.match(auditPage, /params\.set\("cursor", nextCursor\)/);
  assert.match(auditPage, /append \? \[\.\.\.auditItems, \.\.\.response\.items\] : response\.items/);
  assert.match(auditPage, /isLoadingMore/);
  assert.match(auditPage, /observer\?\.disconnect\(\)/);
  assert.match(app, /cleanupAuditPage\(\)/);
  assert.match(styles, /\.audit-pagination \{[^}]*border-top: 1px solid var\(--border\)[^}]*text-align: center/);
});

test("aligns admin audit filters and protected details with the workspace audit log", () => {
  for (const label of ["All events", "Workspace ID", "Admin actor", "All outcomes", "Today", "Last 24h", "Past 7d", "Past 30d", "Custom range", "Apply filters", "Clear"]) assert.match(auditPage, new RegExp(label));
  for (const field of ["workspaceId", "adminActorSubject", "outcome"]) assert.match(auditPage, new RegExp(`${field}:`));
  assert.match(auditPage, /"actionGroup" : "action"/);
  assert.match(auditPage, /query\.set\("from"/);
  assert.match(auditPage, /query\.set\("to"/);
  for (const label of ["Governance", "Time", "Event type", "Outcome", "Actor", "Object", "Correlation ID", "Event data", "Copy event data"]) assert.match(auditPage, new RegExp(label));
  assert.match(styles, /\.audit-detail-grid > div \{[^}]*grid-template-columns: 140px minmax\(0, 1fr\)[^}]*padding: 13px 4px[^}]*border-bottom: 1px solid var\(--border\)/);
  assert.doesNotMatch(auditPage, /<dd\$\{label\.includes/);
  for (const removedLabel of ["Safe metadata", "Raw key/value", "Copy raw values"]) assert.doesNotMatch(auditPage, new RegExp(removedLabel));
  assert.match(auditPage, /event\.metadata\?\.correlationId/);
  assert.match(auditPage, /rawAuditKeyValues/);
  assert.match(auditPage, /navigator\.clipboard\?\.writeText/);
  assert.match(auditPage, /Selected — press ⌘C \/ Ctrl\+C/);
  assert.match(auditPage, /selectRawRecord/);
  assert.doesNotMatch(auditPage, /sourceIpHash|userAgent/);
  assert.doesNotMatch(auditPage, /ticketRef/);
  assert.match(styles, /\.audit-custom-range\[hidden\] \{ display: none; \}/);
});

test("matches the management-console success toast pattern", () => {
  assert.match(app, /createToastController/);
  assert.match(html, /class="toast-viewport"/);
  assert.match(html, /class="toast-status-icon"/);
  assert.match(html, /id="toast-close"[^>]+aria-label="Dismiss notification"/);
  assert.match(html, /class="toast-progress"/);
  assert.match(styles, /\.toast-viewport \{ position: fixed; right: 0; bottom: 24px; left: 0;/);
  assert.match(styles, /max-width: 352px/);
  assert.match(styles, /border-radius: 12px/);
  assert.match(styles, /\.toast\.visible \.toast-progress \{ animation: toast-expiry 3\.8s linear forwards; \}/);
  assert.match(toastController, /window\.setTimeout\(hide, 3800\)/);
  assert.match(toastController, /tone = "success"/);
  assert.match(toastController, /close\.addEventListener\("click", hide\)/);
  assert.match(membershipActions, /showToast\(`Unable to update role:[^\n]+, "danger"\)/);
});

test("revokes workspace access through the existing per-membership admin contract", () => {
  assert.match(userPanelView, /data-remove-membership data-tooltip="Revoke workspace access"/);
  assert.match(userPanelView, /aria-label="Revoke workspace access from \$\{escapeAttr\(workspaceName\)\}"/);
  assert.match(userPanelView, /data-update-role disabled>Update Role<\/button>[\s\S]+data-remove-membership/);
  assert.doesNotMatch(userPanelView, /data-revoke-all-access|Revoke All Access/);
  assert.doesNotMatch(userPanelView, /Remove from Workspace/);
  assert.match(membershipActions, /method: "DELETE"/);
  assert.match(membershipActions, /reason: "Platform admin removed workspace membership"/);
  assert.match(membershipActions, /danger: true/);
  assert.match(membershipActions, /Other workspace access remains unchanged/);
  assert.doesNotMatch(membershipActions, /AcornOps account/);
  assert.match(membershipActions, /Transfer ownership before revoking this workspace access/);
  assert.match(membershipActions, /submitDisabled: isOwner/);
  assert.doesNotMatch(membershipActions, /confirmRevokeAll|revocableEditors|ownerWorkspaces|revoke all workspace access/i);
  assert.match(membershipActions, /class="notice owner-safeguard"/);
  assert.match(app, /submitDisabled = false/);
  assert.match(app, /fields = ""/);
  assert.match(app, /submitButton\.disabled = submitDisabled/);
  assert.match(app, /state\.dialogAction = action/);
  assert.match(membershipActions, /editor\.remove\(\)/);
  assert.match(membershipActions, /onRemoved\?\.\(remaining, workspaceIds\)/);
  assert.match(styles, /\.tooltip-button:hover::after, \.tooltip-button:focus-visible::after/);
  assert.match(styles, /\.notice\.owner-safeguard/);
  assert.match(styles, /\.membership-revoke \{[^}]+background: var\(--danger-soft\);[^}]+color: var\(--danger\)/);
  assert.match(styles, /\.membership-revoke:hover \{[^}]+background: var\(--danger\); color: white/);
  assert.doesNotMatch(styles, /\.revoke-all-access/);
  assert.match(app, /syncUserWorkspaceCount\(user\.id, detail\.memberships\.length\)/);
  assert.match(app, /onRemoved: \(remaining, workspaceIds\)/);
  assert.match(app, /state\.workspaceAccessByUser\.set\(user\.id, new Set\(workspaceIds\)\)/);
  assert.match(app, /row\.querySelector\("\[data-membership-count\]"\)\.textContent = String\(count\)/);
  assert.match(app, /querySelectorAll\("select"\)\.forEach\(\(select\) => enhanceSelect\(select\)\)/);
  assert.match(styles, /\.membership-role-control \.select-trigger \{ border-color: var\(--admin-border\); \}/);
  assert.match(styles, /\.membership-role-control \.button \{ min-width: 112px; min-height: 44px; \}/);
  assert.match(styles, /\.select-trigger\.open[^}]+box-shadow:/);
  assert.match(styles, /\.select-menu \{ position: fixed; z-index: 140;/);
  assert.match(styles, /\.directory-search > svg, \.workspace-filter-control > svg/);
  assert.doesNotMatch(styles, /\.workspace-filter-control svg/);
  assert.match(styles, /\.workspace-filter-control\.menu-open \.input/);
  assert.match(menuControls, /wrapper\.classList\.add\("menu-open"\)/);
  assert.match(menuControls, /aria-label", "Clear workspace filter"/);
  assert.match(menuControls, /clear\.hidden = !hasValue/);
  assert.match(menuControls, /input\.value = "";[\s\S]+input\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
  assert.match(styles, /input\[type="search"\]::\-webkit-search-cancel-button \{ display: none;/);
  assert.match(styles, /\.combobox-clear \{ right: 39px; \}/);
  assert.match(styles, /\.combobox-clear-icon \{ width: 16px; height: 16px;/);
});

function readOklch(name) {
  const match = styles.match(new RegExp(`--${name}: oklch\\(([-.\\d]+) ([-.\\d]+) ([-.\\d]+)\\)`));
  assert.ok(match, `Missing ${name} OKLCH token`);
  const [lightness, chroma, hue] = match.slice(1).map(Number);
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
}

function contrast(first, second) {
  const luminance = ([red, green, blue]) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function clamp(value) { return Math.max(0, Math.min(1, value)); }
