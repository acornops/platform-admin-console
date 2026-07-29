const PROVIDERS = ["openai", "anthropic", "gemini"];
const PROVIDER_LABELS = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Gemini" };
const SETTINGS_CATEGORIES = ["workspace", "ai"];
let activeSettingsCategory = "workspace";
const DISCOVERY_LABELS = {
  disabled: "Disabled",
  exact_email: "Exact email",
  directory: "Directory"
};

export async function renderPlatformSettingsPage({
  main,
  api,
  pageHeader,
  canMutate,
  showToast,
  enhanceSelect,
  readableError
}) {
  const [settingsResult, providerDefaultsResult] = await Promise.allSettled([
    api("/settings"),
    api("/llm-provider-defaults")
  ]);
  if (settingsResult.status === "rejected") throw settingsResult.reason;
  const settingsResponse = settingsResult.value;
  const settings = new Map((settingsResponse.items || []).map((setting) => [setting.key, setting]));
  const providerDefaults = providerDefaultsResult.status === "fulfilled"
    ? providerDefaultsResult.value.providers || []
    : null;
  const providerDefaultsError = providerDefaultsResult.status === "rejected"
    ? readableError(providerDefaultsResult.reason)
    : "";
  main.innerHTML = `${pageHeader(
    "Platform settings",
    "Manage approved runtime policy within deployment-defined boundaries."
  )}${settingsMarkup(settings, canMutate, providerDefaults, activeSettingsCategory, providerDefaultsError)}`;
  main.querySelectorAll("select").forEach((select) => enhanceSelect(select));
  const rerender = () => renderPlatformSettingsPage({
    main,
    api,
    pageHeader,
    canMutate,
    showToast,
    enhanceSelect,
    readableError
  });
  bindSettingsTabs(main);
  bindSettingForms({ main, api, canMutate, showToast, enhanceSelect, readableError, rerender });
  bindProviderDefaultForms({ main, api, canMutate, showToast, readableError, rerender });
  main.querySelector("[data-retry-provider-defaults]")?.addEventListener("click", rerender);
}

export function settingsMarkup(settings, canMutate, providerDefaults = [], activeCategory = "workspace", providerDefaultsError = "") {
  const memberDiscovery = settings.get("member_discovery");
  const aiPolicy = settings.get("ai_policy");
  const passwordSignup = settings.get("password_signup");
  const selectedCategory = SETTINGS_CATEGORIES.includes(activeCategory) ? activeCategory : "workspace";
  return `<div class="settings-surface management-settings-layout">
    <div class="settings-tabs" role="tablist" aria-label="Platform setting categories">
      ${settingsTabMarkup({
        id: "workspace",
        label: "Workspace",
        icon: workspaceSettingsIcon(),
        selected: selectedCategory === "workspace"
      })}
      ${settingsTabMarkup({
        id: "ai",
        label: "AI",
        icon: aiSettingsIcon(),
        selected: selectedCategory === "ai"
      })}
    </div>
    <div id="settings-panel-workspace" class="settings-tab-panel" role="tabpanel" aria-labelledby="settings-tab-workspace" data-settings-panel="workspace" ${selectedCategory === "workspace" ? "" : "hidden"}>
      ${memberDiscoveryMarkup(memberDiscovery, canMutate)}
      ${passwordSignupMarkup(passwordSignup, canMutate)}
    </div>
    <div id="settings-panel-ai" class="settings-tab-panel" role="tabpanel" aria-labelledby="settings-tab-ai" data-settings-panel="ai" ${selectedCategory === "ai" ? "" : "hidden"}>
      ${aiPolicyMarkup(aiPolicy, canMutate)}
      ${llmProviderDefaultsMarkup(providerDefaults, canMutate, providerDefaultsError)}
    </div>
  </div>`;
}

function settingsTabMarkup({ id, label, icon, selected }) {
  return `<button id="settings-tab-${id}" class="settings-tab" type="button" role="tab" aria-selected="${selected}" aria-controls="settings-panel-${id}" tabindex="${selected ? "0" : "-1"}" data-settings-tab="${id}">
    ${icon}
    <span>${label}</span>
  </button>`;
}

function bindSettingsTabs(main) {
  const tabs = [...main.querySelectorAll("[data-settings-tab]")];
  const panels = [...main.querySelectorAll("[data-settings-panel]")];
  const activate = (category, { focus = false } = {}) => {
    if (!SETTINGS_CATEGORIES.includes(category)) return;
    activeSettingsCategory = category;
    tabs.forEach((tab) => {
      const selected = tab.dataset.settingsTab === category;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== category;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.settingsTab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[nextIndex].dataset.settingsTab, { focus: true });
    });
  });
}

function workspaceSettingsIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>';
}

function aiSettingsIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>';
}

function checkCircleIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.25 2.25L15.5 9.5"/></svg>';
}

function trashIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>';
}

function llmProviderDefaultsMarkup(providerDefaults, canMutate, loadError = "") {
  if (!providerDefaults) {
    return `<section class="settings-section llm-provider-defaults">
      <div class="settings-section-heading">
        <div>
          <div class="settings-title-line"><h2>Default LLM keys</h2><span class="settings-source">Write-only</span></div>
          <p>Used by every workspace unless that workspace saves its own provider key.</p>
        </div>
      </div>
      <div class="settings-empty-card" role="alert">
        <strong>Default LLM key status is temporarily unavailable.</strong>
        <p>${escapeText(loadError || "Try again when the control plane is available.")}</p>
        <button class="button secondary provider-key-action" type="button" data-retry-provider-defaults>Retry</button>
      </div>
    </section>`;
  }
  const statusByProvider = new Map(providerDefaults.map((status) => [status.provider, status]));
  return `<section class="settings-section llm-provider-defaults">
    <div class="settings-section-heading">
      <div>
        <div class="settings-title-line"><h2>Default LLM keys</h2><span class="settings-source">Write-only</span></div>
        <p>Used by every workspace unless that workspace saves its own provider key.</p>
      </div>
    </div>
    <div class="provider-default-grid">
      ${PROVIDERS.map((provider) => {
        const status = statusByProvider.get(provider) || { configured: false, enabled: false };
        return `<form data-provider-default-form data-provider="${provider}" class="provider-default-card">
          <div class="settings-title-line provider-default-title">
            <strong>${PROVIDER_LABELS[provider]}</strong>
            <span class="provider-default-status${status.configured ? " configured" : ""}">${status.configured ? "Configured" : "Not configured"}</span>
          </div>
          <p class="settings-field-note">${status.enabled ? "Available for workspace fallback." : "Disabled by deployment policy."}</p>
          <div class="field provider-default-field">
            <label for="provider-default-${provider}">${status.configured ? "Rotate API key" : "API key"}</label>
            <input class="input provider-default-input" id="provider-default-${provider}" name="apiKey" type="password" autocomplete="new-password" placeholder="Paste ${PROVIDER_LABELS[provider]} key" ${!canMutate || !status.enabled ? "disabled" : ""}>
          </div>
          <div class="provider-default-actions">
            ${status.configured
              ? `<button class="button secondary provider-key-action" type="submit" ${!canMutate || !status.enabled ? "disabled" : ""}>${checkCircleIcon()}<span>Rotate key</span></button>
                <button class="button danger provider-key-action" type="button" data-delete-provider-default ${!canMutate ? "disabled" : ""}>${trashIcon()}<span>Delete key</span></button>`
              : `<button class="button secondary provider-key-action" type="submit" ${!canMutate || !status.enabled ? "disabled" : ""}>${checkCircleIcon()}<span>Save key</span></button>`}
          </div>
          ${!canMutate ? '<p class="settings-field-note">Your platform role has read-only access.</p>' : ""}
          <p class="form-error settings-error" role="alert"></p>
        </form>`;
      }).join("")}
    </div>
  </section>`;
}

function memberDiscoveryMarkup(setting, canMutate) {
  if (!setting) return unavailableSettingMarkup("Member discovery");
  const allowedModes = setting.constraints?.allowedModes || [];
  return settingSection({
    setting,
    title: "Member discovery",
    description: "Controls how workspace owners find existing AcornOps users.",
    canMutate,
    fields: `<div class="field settings-primary-field">
      <label for="member-discovery-mode">Discovery mode</label>
      <select id="member-discovery-mode" name="mode" ${fieldDisabled(setting, canMutate)}>
        ${allowedModes.map((mode) => `<option value="${escapeAttr(mode)}" ${setting.value.mode === mode ? "selected" : ""}>${escapeText(DISCOVERY_LABELS[mode] || mode)}</option>`).join("")}
      </select>
    </div>
    <p class="settings-field-note" data-discovery-note>${escapeText(discoveryDescription(setting.value.mode))}</p>`
  });
}

function aiPolicyMarkup(setting, canMutate) {
  if (!setting) return unavailableSettingMarkup("AI policy");
  const value = setting.value;
  const ceiling = setting.constraints || {};
  const providerModels = ceiling.providerModels || {};
  const providerOptions = PROVIDERS.filter((provider) => (providerModels[provider] || []).length);
  const disabled = fieldDisabled(setting, canMutate);
  return settingSection({
    setting,
    title: "AI policy",
    description: "Limits workspace provider, model, and reasoning choices.",
    canMutate,
    className: "ai-policy-setting",
    fields: `<div class="settings-default-grid">
      <div class="field">
        <label for="ai-default-provider">Default provider</label>
        <select id="ai-default-provider" name="defaultProvider" ${disabled}>
          ${providerOptions.map((provider) => `<option value="${provider}" ${value.defaultProvider === provider ? "selected" : ""}>${PROVIDER_LABELS[provider]}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="ai-default-model">Default model</label>
        <select id="ai-default-model" name="defaultModel" ${disabled}>
          ${(providerModels[value.defaultProvider] || []).map((model) => `<option value="${escapeAttr(model)}" ${value.defaultModel === model ? "selected" : ""}>${escapeText(model)}</option>`).join("")}
        </select>
      </div>
    </div>
    <fieldset class="settings-fieldset">
      <legend>Available models</legend>
      <div class="provider-policy-grid">
        ${providerOptions.map((provider) => `<div class="provider-policy-group">
          <strong>${PROVIDER_LABELS[provider]}</strong>
          ${(providerModels[provider] || []).map((model) => checkbox({
            name: `model:${provider}`,
            value: model,
            label: model,
            checked: (value.providerModels?.[provider] || []).includes(model),
            disabled
          })).join("")}
        </div>`).join("")}
      </div>
    </fieldset>
    <fieldset class="settings-fieldset reasoning-policy">
      <legend>Reasoning</legend>
      ${ceiling.reasoningSummariesEnabled ? checkbox({
        name: "reasoningSummariesEnabled",
        value: "true",
        label: "Reasoning summaries",
        checked: value.reasoningSummariesEnabled,
        disabled
      }) : '<p class="settings-field-note">Reasoning summaries are disabled by deployment policy.</p>'}
      <div class="settings-choice-groups">
        <div><strong>Summary modes</strong>${(ceiling.reasoningSummaryModes || []).map((mode) => checkbox({
          name: "reasoningSummaryModes",
          value: mode,
          label: titleCase(mode),
          checked: value.reasoningSummaryModes.includes(mode),
          disabled
        })).join("")}</div>
        <div><strong>Reasoning effort</strong>${(ceiling.reasoningEfforts || []).map((effort) => checkbox({
          name: "reasoningEfforts",
          value: effort,
          label: titleCase(effort),
          checked: value.reasoningEfforts.includes(effort),
          disabled
        })).join("")}</div>
      </div>
    </fieldset>`
  });
}

function passwordSignupMarkup(setting, canMutate) {
  if (!setting) return unavailableSettingMarkup("Password signup");
  const allowedValues = setting.constraints?.allowedValues || [];
  const blockers = setting.constraints?.enablementBlockers || [];
  const canEnable = !blockers.length;
  const values = allowedValues.filter((value) => value === false || canEnable);
  return settingSection({
    setting,
    title: "Password signup",
    description: "Controls new self-service password accounts. Existing sign-in is unaffected.",
    canMutate,
    fields: `<div class="field settings-primary-field">
      <label for="password-signup-enabled">Self-service signup</label>
      <select id="password-signup-enabled" name="enabled" ${fieldDisabled(setting, canMutate)}>
        ${values.map((enabled) => `<option value="${String(enabled)}" ${setting.value.enabled === enabled ? "selected" : ""}>${enabled ? "Enabled" : "Disabled"}</option>`).join("")}
      </select>
    </div>
    ${blockers.length ? `<div class="settings-policy-note" role="note"><strong>Enablement unavailable</strong><span>${escapeText(blockers[0])}</span></div>` : '<p class="settings-field-note">Email verification remains governed by deployment policy.</p>'}`
  });
}

function settingSection({ setting, title, description, fields, canMutate, className = "" }) {
  const hasOverride = setting.overrideValue !== undefined;
  const editable = canMutate && setting.editable;
  return `<section class="settings-section ${className}" data-setting-key="${escapeAttr(setting.key)}" data-setting-version="${setting.version}">
    <div class="settings-section-heading">
      <div>
        <div class="settings-title-line"><h2>${escapeText(title)}</h2><span class="settings-source">${sourceLabel(setting.source)}</span></div>
        <p>${escapeText(description)}</p>
      </div>
      <div class="settings-actions">
        <button class="button secondary" type="button" data-reset-setting ${!editable || !hasOverride ? "disabled" : ""}>Reset</button>
        <button class="button primary" type="submit" form="setting-form-${escapeAttr(setting.key)}" data-save-setting disabled>Save</button>
      </div>
    </div>
    <form id="setting-form-${escapeAttr(setting.key)}" data-setting-form>
      ${fields}
      ${setting.warning ? `<div class="settings-policy-note warning" role="status"><strong>Deployment policy applied</strong><span>${escapeText(setting.warning)}</span></div>` : ""}
      ${!setting.editable ? '<p class="settings-field-note">This value is fixed by deployment policy.</p>' : ""}
      ${!canMutate ? '<p class="settings-field-note">Your platform role has read-only access.</p>' : ""}
      <p class="form-error settings-error" role="alert"></p>
    </form>
  </section>`;
}

function bindSettingForms({ main, api, canMutate, showToast, readableError, rerender }) {
  main.querySelectorAll("[data-setting-form]").forEach((form) => {
    form.addEventListener("change", () => {
      const section = form.closest("[data-setting-key]");
      const saveButton = section?.querySelector("[data-save-setting]");
      if (canMutate && saveButton && [...form.elements].some((field) => !field.disabled)) {
        saveButton.disabled = false;
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const section = form.closest("[data-setting-key]");
      if (!canMutate || !section) return;
      const key = section.dataset.settingKey;
      const error = section.querySelector(".settings-error");
      const buttons = section.querySelectorAll("button");
      const disabledStates = [...buttons].map((button) => button.disabled);
      error.textContent = "";
      try {
        const value = settingValue(key, new FormData(form), form);
        buttons.forEach((button) => { button.disabled = true; });
        await api(`/settings/${encodeURIComponent(key)}`, {
          method: "PATCH",
          body: {
            value,
            expectedVersion: Number(section.dataset.settingVersion),
            reason: `Platform admin updated ${key.replaceAll("_", " ")}`
          }
        });
        showToast(`${settingTitle(key)} updated.`);
        await rerender();
      } catch (requestError) {
        error.textContent = readableError(requestError);
      } finally {
        buttons.forEach((button, index) => { button.disabled = disabledStates[index]; });
      }
    });
  });

  main.querySelectorAll("[data-reset-setting]").forEach((button) => {
    button.addEventListener("click", async () => {
      const section = button.closest("[data-setting-key]");
      if (!canMutate || !section) return;
      const key = section.dataset.settingKey;
      const error = section.querySelector(".settings-error");
      const buttons = section.querySelectorAll("button");
      const disabledStates = [...buttons].map((item) => item.disabled);
      error.textContent = "";
      try {
        buttons.forEach((item) => { item.disabled = true; });
        await api(`/settings/${encodeURIComponent(key)}`, {
          method: "DELETE",
          body: {
            expectedVersion: Number(section.dataset.settingVersion),
            reason: `Platform admin reset ${key.replaceAll("_", " ")} to the deployment default`
          }
        });
        showToast(`${settingTitle(key)} reset to deployment default.`);
        await rerender();
      } catch (requestError) {
        error.textContent = readableError(requestError);
      } finally {
        buttons.forEach((item, index) => { item.disabled = disabledStates[index]; });
      }
    });
  });

  const provider = main.querySelector("#ai-default-provider");
  const model = main.querySelector("#ai-default-model");
  const discoveryMode = main.querySelector("#member-discovery-mode");
  discoveryMode?.addEventListener("change", () => {
    const note = main.querySelector("[data-discovery-note]");
    if (note) note.textContent = discoveryDescription(discoveryMode.value);
  });
  provider?.addEventListener("change", () => {
    const selectedModels = [...main.querySelectorAll(`input[name="model:${CSS.escape(provider.value)}"]:checked`)].map((input) => input.value);
    model.innerHTML = selectedModels.map((value) => `<option value="${escapeAttr(value)}">${escapeText(value)}</option>`).join("");
  });
}

function bindProviderDefaultForms({ main, api, canMutate, showToast, readableError, rerender }) {
  main.querySelectorAll("[data-provider-default-form]").forEach((form) => {
    const provider = form.dataset.provider;
    const error = form.querySelector(".settings-error");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canMutate) return;
      const input = form.elements.apiKey;
      const apiKey = input.value.trim();
      if (!apiKey) {
        error.textContent = "Enter a provider API key.";
        return;
      }
      error.textContent = "";
      const buttons = form.querySelectorAll("button");
      buttons.forEach((button) => { button.disabled = true; });
      try {
        await api(`/llm-provider-defaults/${provider}`, {
          method: "PUT",
          body: {
            apiKey,
            reason: `Platform admin updated the ${provider} default LLM key`
          }
        });
        input.value = "";
        showToast(`${PROVIDER_LABELS[provider]} default key updated.`);
        await rerender();
      } catch (requestError) {
        input.value = "";
        error.textContent = readableError(requestError);
        buttons.forEach((button) => { button.disabled = false; });
      }
    });

    const deleteButton = form.querySelector("[data-delete-provider-default]");
    deleteButton?.addEventListener("click", async () => {
      if (!canMutate) return;
      if (deleteButton.dataset.confirm !== "true") {
        deleteButton.dataset.confirm = "true";
        deleteButton.innerHTML = `${trashIcon()}<span>Confirm delete</span>`;
        return;
      }
      error.textContent = "";
      const buttons = form.querySelectorAll("button");
      buttons.forEach((button) => { button.disabled = true; });
      try {
        await api(`/llm-provider-defaults/${provider}`, {
          method: "DELETE",
          body: {
            reason: `Platform admin deleted the ${provider} default LLM key`
          }
        });
        showToast(`${PROVIDER_LABELS[provider]} default key deleted.`);
        await rerender();
      } catch (requestError) {
        error.textContent = readableError(requestError);
        deleteButton.dataset.confirm = "false";
        deleteButton.innerHTML = `${trashIcon()}<span>Delete key</span>`;
        buttons.forEach((button) => { button.disabled = false; });
      }
    });
  });
}

export function settingValue(key, data, form) {
  if (key === "member_discovery") return { mode: String(data.get("mode")) };
  if (key === "password_signup") return { enabled: data.get("enabled") === "true" };
  const providerModels = Object.fromEntries(PROVIDERS.map((provider) => [
    provider,
    data.getAll(`model:${provider}`).map(String)
  ]));
  const defaultProvider = String(data.get("defaultProvider"));
  const selectedModels = providerModels[defaultProvider] || [];
  if (!selectedModels.length) throw new Error("Select at least one model for the default provider.");
  let defaultModel = String(data.get("defaultModel"));
  if (!selectedModels.includes(defaultModel)) defaultModel = selectedModels[0];
  const reasoningSummariesEnabled = form.elements.reasoningSummariesEnabled?.checked === true;
  const reasoningSummaryModes = reasoningSummariesEnabled
    ? data.getAll("reasoningSummaryModes").map(String)
    : ["off"];
  const reasoningEfforts = data.getAll("reasoningEfforts").map(String);
  if (!reasoningSummaryModes.length || !reasoningEfforts.length) {
    throw new Error("Select at least one summary mode and reasoning effort.");
  }
  return {
    defaultProvider,
    defaultModel,
    providerModels,
    reasoningSummariesEnabled,
    reasoningSummaryModes,
    reasoningEfforts
  };
}

function checkbox({ name, value, label, checked, disabled }) {
  return `<label class="settings-check">
    <input type="checkbox" name="${escapeAttr(name)}" value="${escapeAttr(value)}" ${checked ? "checked" : ""} ${disabled}>
    <span>${escapeText(label)}</span>
  </label>`;
}

function fieldDisabled(setting, canMutate) {
  return !canMutate || !setting.editable ? "disabled" : "";
}

function sourceLabel(source) {
  if (source === "runtime_override") return "Runtime override";
  if (source === "runtime_override_constrained") return "Policy constrained";
  return "Deployment default";
}

function discoveryDescription(mode) {
  if (mode === "directory") return "Workspace member managers can search the trusted user directory.";
  if (mode === "exact_email") return "Existing users are revealed only after an exact email match.";
  return "Workspace member managers create invitation links without user discovery.";
}

function settingTitle(key) {
  return {
    member_discovery: "Member discovery",
    ai_policy: "AI policy",
    password_signup: "Password signup"
  }[key] || "Setting";
}

function unavailableSettingMarkup(title) {
  return `<section class="settings-section">
    <div class="settings-section-heading">
      <div>
        <h2>${escapeText(title)}</h2>
        <p>This setting is unavailable.</p>
      </div>
    </div>
    <div class="settings-empty-card">The deployment did not return this setting.</div>
  </section>`;
}

function titleCase(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function escapeAttr(value) {
  return escapeText(value);
}
