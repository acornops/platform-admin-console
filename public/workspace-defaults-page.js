const TABS = ["mcp", "skills"];
const DESTINATIONS = {
  agents: "Agents",
  kubernetes: "Kubernetes",
  virtual_machines: "Virtual machines"
};
const ALL_DESTINATIONS = Object.keys(DESTINATIONS);

export async function renderWorkspaceDefaultsPage({
  main,
  api,
  pageHeader,
  canMutate,
  showToast,
  enhanceSelect,
  readableError,
  openDialog
}) {
  const params = new URLSearchParams(location.search);
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "mcp";
  const availableIn = Object.hasOwn(DESTINATIONS, params.get("availableIn")) ? params.get("availableIn") : "";
  const q = params.get("q") || "";
  const query = new URLSearchParams({ kind: tab === "mcp" ? "mcp_server" : "skill" });
  if (availableIn) query.set("availableIn", availableIn);
  if (q) query.set("q", q);
  const response = await api(`/workspace-defaults?${query}`);

  main.innerHTML = `${pageHeader(
    "Capabilities",
    "Choose which capabilities are created in new workspaces."
  )}
  <section class="defaults-surface">
    <div class="settings-tabs defaults-tabs" role="tablist" aria-label="Workspace default type">
      ${tabButton("mcp", "MCP servers", tab)}
      ${tabButton("skills", "Skills", tab)}
    </div>
    <div class="defaults-description-row">
      <p class="defaults-description">${tab === "mcp"
        ? "<span>New workspaces are created with these defaults, while existing workspaces remain unchanged.</span><span>Workspace users choose which servers to enable, then configure the appropriate credentials in their workspaces.</span>"
        : "<span>New workspaces are created with these defaults, while existing workspaces remain unchanged.</span><span>Workspace users explicitly enable the skills they want to use.</span>"}</p>
      <div class="defaults-list-action">${addAction(tab, canMutate)}</div>
    </div>
    <div class="ledger defaults-ledger">
      <div class="directory-toolbar defaults-toolbar">
        <div class="directory-search">
          <label class="visually-hidden" for="defaults-search">Search defaults</label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input class="input" id="defaults-search" type="search" value="${escapeAttr(q)}" placeholder="Search ${tab === "mcp" ? "MCP servers" : "skills"}" autocomplete="off">
        </div>
        <label class="visually-hidden" for="defaults-availability">Available in</label>
        <select id="defaults-availability" aria-label="Filter by Available in">
          <option value="" ${availableIn ? "" : "selected"}>All destinations</option>
          ${Object.entries(DESTINATIONS).map(([value, label]) => `<option value="${value}" ${availableIn === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <span class="result-count">${response.items.length} ${response.items.length === 1 ? "default" : "defaults"}</span>
      </div>
      <div class="table-wrap">
        <table aria-label="${tab === "mcp" ? "MCP server defaults" : "Skill defaults"}">
          <thead><tr><th>${tab === "mcp" ? "MCP server" : "Skill"}</th><th>Available in</th><th class="defaults-actions-heading">Actions</th></tr></thead>
          <tbody>${workspaceDefaultRows(response.items, tab, canMutate)}</tbody>
        </table>
      </div>
    </div>
    ${!canMutate ? '<p class="settings-field-note">Your platform role has read-only access.</p>' : ""}
  </section>`;

  main.querySelectorAll("select").forEach((select) => enhanceSelect(select));
  bindUrlState(main, tab);
  main.querySelector("[data-add-default]")?.addEventListener("click", () => {
    if (tab === "mcp") openAddMcpDialog({ api, openDialog, showToast, rerender: rerenderCurrent });
    else openImportSkillDialog({ api, openDialog, showToast, rerender: rerenderCurrent });
  });
  main.querySelectorAll("[data-edit-default]").forEach((button) => button.addEventListener("click", () => {
    const item = response.items.find((candidate) => candidate.id === button.dataset.editDefault);
    openAvailabilityDialog({ item, api, openDialog, showToast, rerender: rerenderCurrent });
  }));
  main.querySelectorAll("[data-remove-default]").forEach((button) => button.addEventListener("click", () => {
    const item = response.items.find((candidate) => candidate.id === button.dataset.removeDefault);
    openRemoveDialog({ item, api, openDialog, showToast, rerender: rerenderCurrent });
  }));

  async function rerenderCurrent() {
    await renderWorkspaceDefaultsPage({ main, api, pageHeader, canMutate, showToast, enhanceSelect, readableError, openDialog });
  }
}

function addAction(tab, canMutate) {
  const skill = tab === "skills";
  return `<button class="button secondary defaults-add-action" type="button" data-add-default ${canMutate ? "" : "disabled"}>
    ${skill ? gitBranchIcon() : plusIcon()}<span>${skill ? "Import skill" : "Add MCP server"}</span>
  </button>`;
}

function tabButton(id, label, active) {
  return `<button class="settings-tab" type="button" role="tab" aria-selected="${active === id}" data-defaults-tab="${id}"><span>${label}</span></button>`;
}

export function workspaceDefaultRows(items, tab, canMutate) {
  if (!items.length) {
    return `<tr><td colspan="3"><div class="empty-state"><strong>No ${tab === "mcp" ? "MCP servers" : "skills"} found</strong><p>Add a default or change the filters.</p></div></td></tr>`;
  }
  return items.map((item) => {
    const source = item.kind === "mcp_server"
      ? item.source.endpoint
      : `${item.source.repoUrl}${item.source.subpath ? ` / ${item.source.subpath}` : ""} @ ${item.source.commitSha.slice(0, 8)}`;
    return `<tr>
      <td><span class="primary-cell">${escapeText(item.name)}</span><span class="secondary-cell mono">${escapeText(source)}</span></td>
      <td>${destinationBadges(item.availableIn)}</td>
      <td><div class="defaults-row-actions">
        <button class="button secondary" type="button" data-edit-default="${escapeAttr(item.id)}" ${canMutate ? "" : "disabled"}>Edit</button>
        <button class="button danger-link" type="button" data-remove-default="${escapeAttr(item.id)}" ${canMutate ? "" : "disabled"}>Remove</button>
      </div></td>
    </tr>`;
  }).join("");
}

function destinationBadges(value) {
  const destinations = canonicalDestinations(value);
  if (destinations.length === ALL_DESTINATIONS.length) return '<span class="defaults-scope">All</span>';
  return `<span class="defaults-scope-list">${destinations.map((destination) =>
    `<span class="defaults-scope">${escapeText(DESTINATIONS[destination])}</span>`).join("")}</span>`;
}

function bindUrlState(main, activeTab) {
  let timer;
  const update = (changes) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", changes.tab || activeTab);
    if (changes.availableIn !== undefined) changes.availableIn ? params.set("availableIn", changes.availableIn) : params.delete("availableIn");
    if (changes.q !== undefined) changes.q ? params.set("q", changes.q) : params.delete("q");
    history.pushState({}, "", `/workspace-defaults?${params}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  main.querySelectorAll("[data-defaults-tab]").forEach((button) => button.addEventListener("click", () => update({ tab: button.dataset.defaultsTab })));
  main.querySelector("#defaults-availability")?.addEventListener("change", (event) => update({ availableIn: event.target.value }));
  main.querySelector("#defaults-search")?.addEventListener("input", (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => update({ q: event.target.value.trim() }), 240);
  });
}

function openAddMcpDialog({ api, openDialog, showToast, rerender }) {
  openDialog({
    title: "Add MCP server",
    description: "Add an HTTPS endpoint to the initialization list for new workspaces.",
    submit: "Add MCP server",
    pendingLabel: "Adding server…",
    size: "form",
    fields: `<div class="dialog-form-grid">
        ${field("Name", "name", "text", "e.g. GitHub", true)}
        ${field("HTTPS endpoint", "endpoint", "url", "https://mcp.example.com", true, "https://.*")}
      </div>
      <div class="workspace-auth-note" role="note">
        <span class="workspace-auth-note-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-3 3 2 2m-5 1 2 2"/></svg>
        </span>
        <span>
          <strong>Authentication stays in each workspace</strong>
          <small>Workspace users configure authentication and credentials through the existing MCP setup when they use this server.</small>
        </span>
      </div>
      ${destinationField()}`,
    action: async (data) => {
      await api("/workspace-defaults", {
        method: "POST",
        body: {
          kind: "mcp_server",
          name: data.get("name"),
          availableIn: selectedDestinations(data),
          source: { type: "https", endpoint: data.get("endpoint") },
          reason: "Added platform MCP server default"
        }
      });
      showToast("MCP server default added.");
      await rerender();
    }
  });
  bindDestinationControls();
}

function openImportSkillDialog({ api, openDialog, showToast, rerender }) {
  openDialog({
    title: "Import skill",
    description: "Paste a full URL from a Git host configured for this deployment. Raw skill authoring remains outside Platform Admin.",
    submit: "Import skill",
    pendingLabel: "Importing skill…",
    size: "form",
    fields: `${gitImportUrlField()}
      <div class="dialog-policy-note"><strong>Imported snapshot</strong><span>The selected ref is resolved to an immutable commit and only Markdown skill files are imported.</span></div>
      ${destinationField()}`,
    action: async (data) => {
      const imported = await api("/workspace-defaults/resolve-skill", {
        method: "POST",
        body: { repoUrl: data.get("repoUrl") }
      });
      await api("/workspace-defaults", {
        method: "POST",
        body: {
          kind: "skill",
          availableIn: selectedDestinations(data),
          source: { type: "git", ...imported.source },
          files: imported.files,
          reason: "Imported platform skill default"
        }
      });
      showToast("Skill default imported.");
      await rerender();
    }
  });
  bindDestinationControls();
}

function openAvailabilityDialog({ item, api, openDialog, showToast, rerender }) {
  openDialog({
    title: "Edit availability",
    description: `Choose where ${item.name} will appear in workspaces created after this change.`,
    submit: "Save",
    pendingLabel: "Saving…",
    fields: destinationField(item.availableIn),
    action: async (data) => {
      await api(`/workspace-defaults/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: { availableIn: selectedDestinations(data), reason: "Updated platform default availability" }
      });
      showToast("Availability updated.");
      await rerender();
    }
  });
  bindDestinationControls();
}

function openRemoveDialog({ item, api, openDialog, showToast, rerender }) {
  openDialog({
    title: "Remove default",
    description: `Remove ${item.name} from the initialization list. Existing workspaces are unchanged.`,
    submit: "Remove",
    pendingLabel: "Removing…",
    danger: true,
    fields: "",
    action: async () => {
      await api(`/workspace-defaults/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        body: { reason: "Removed platform workspace default" }
      });
      showToast("Default removed.");
      await rerender();
    }
  });
}

function destinationField(selected = ALL_DESTINATIONS) {
  const active = new Set(canonicalDestinations(selected));
  return `<fieldset class="destination-field" data-destination-field>
    <legend>Available in</legend>
    <div class="destination-heading"><small>Select one or more destinations.</small><span class="destination-actions"><button type="button" data-select-all-destinations>Select all</button><button type="button" data-clear-destinations>Clear</button></span></div>
    <div class="destination-options">${Object.entries(DESTINATIONS).map(([value, label]) => `<label><input type="checkbox" name="availableIn" value="${value}" ${active.has(value) ? "checked" : ""}><span>${label}</span></label>`).join("")}</div>
  </fieldset>`;
}

function bindDestinationControls() {
  const field = document.querySelector("[data-destination-field]");
  const inputs = [...(field?.querySelectorAll('input[name="availableIn"]') || [])];
  const sync = () => inputs[0]?.setCustomValidity(inputs.some((input) => input.checked) ? "" : "Select at least one destination.");
  field?.querySelector("[data-select-all-destinations]")?.addEventListener("click", () => {
    inputs.forEach((input) => { input.checked = true; });
    sync();
  });
  field?.querySelector("[data-clear-destinations]")?.addEventListener("click", () => {
    inputs.forEach((input) => { input.checked = false; });
    sync();
    inputs[0]?.focus();
  });
  inputs.forEach((input) => input.addEventListener("change", sync));
  sync();
}

function selectedDestinations(data) {
  return canonicalDestinations(data.getAll("availableIn"));
}

function canonicalDestinations(value) {
  const selected = Array.isArray(value) ? value : value === "all" ? ALL_DESTINATIONS : [value];
  return ALL_DESTINATIONS.filter((destination) => selected.includes(destination));
}

function field(label, name, type, placeholder, required = false, pattern = "") {
  return `<div class="field"><label for="default-${name}">${escapeText(label)}</label><input class="input" id="default-${name}" name="${name}" type="${type}" placeholder="${escapeAttr(placeholder)}" ${required ? "required" : ""} ${pattern ? `pattern="${pattern}"` : ""}></div>`;
}

function gitImportUrlField() {
  return `<div class="field">
    <label for="default-repoUrl">Repository or skill URL</label>
    <input class="input" id="default-repoUrl" name="repoUrl" type="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="2048" placeholder="https://github.com/openai/skills/tree/main/skills/.curated/example" pattern="https://[^?#]+" required aria-describedby="default-repoUrl-help">
    <span class="action-hint" id="default-repoUrl-help">Use a repository, folder, or SKILL.md URL. Provider, ref, and subpath are detected automatically.</span>
  </div>`;
}

function selectField(label, name, options) {
  return `<div class="field"><label for="default-${name}">${escapeText(label)}</label><select id="default-${name}" name="${name}">${options.map(([value, text]) => `<option value="${value}">${escapeText(text)}</option>`).join("")}</select></div>`;
}

function plusIcon() {
  return '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
}
function gitBranchIcon() {
  return '<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M18 8a6 6 0 0 1-6 6H6"/></svg>';
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
function escapeAttr(value) { return escapeText(value); }
