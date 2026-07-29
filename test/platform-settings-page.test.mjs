import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { settingValue, settingValuesMatch, settingsMarkup } from "../public/platform-settings-page.js";

function fixture() {
  const ai = {
    defaultProvider: "openai",
    defaultModel: "gpt-5.5",
    providerModels: { openai: ["gpt-5.5"], anthropic: ["claude-sonnet-4-6"], gemini: [] },
    reasoningSummariesEnabled: true,
    reasoningSummaryModes: ["off", "auto"],
    reasoningEfforts: ["low", "high"]
  };
  return new Map([
    ["member_discovery", {
      key: "member_discovery",
      value: { mode: "exact_email" },
      deploymentDefault: { mode: "exact_email" },
      source: "deployment_default",
      version: 0,
      editable: true,
      constraints: { allowedModes: ["disabled", "exact_email", "directory"] }
    }],
    ["ai_policy", {
      key: "ai_policy",
      value: ai,
      deploymentDefault: ai,
      source: "runtime_override",
      overrideValue: ai,
      version: 2,
      editable: true,
      constraints: {
        providerModels: ai.providerModels,
        reasoningSummariesEnabled: true,
        reasoningSummaryModes: ai.reasoningSummaryModes,
        reasoningEfforts: ai.reasoningEfforts
      }
    }],
    ["user_sign_in_methods", {
      key: "user_sign_in_methods",
      value: { methods: ["oidc"] },
      deploymentDefault: { methods: ["password", "oidc"] },
      source: "runtime_override_constrained",
      overrideValue: { methods: ["oidc"] },
      version: 1,
      editable: true,
      constraints: {
        allowedMethods: ["oidc"],
        methodBlockers: { password: ["Password sign-in is disabled by deployment policy."], oidc: [] }
      },
      warning: "Password sign-in is disabled by deployment policy."
    }]
  ]);
}

test("renders bounded settings and write-only provider defaults with safety context", () => {
  const workspaceMarkup = settingsMarkup(fixture(), true);
  const aiMarkup = settingsMarkup(fixture(), true, [
    { provider: "openai", configured: true, enabled: true, source: "platform_default" },
    { provider: "anthropic", configured: false, enabled: true, source: "none" },
    { provider: "gemini", configured: false, enabled: false, source: "none" }
  ], "ai");
  assert.match(workspaceMarkup, /data-settings-category="workspace"/);
  assert.match(workspaceMarkup, /Member Discovery/);
  assert.match(workspaceMarkup, /Controls how workspace owners add people to their workspace/);
  assert.match(workspaceMarkup, /By Invites Only/);
  assert.match(workspaceMarkup, /Exact Email/);
  assert.match(workspaceMarkup, /Access is granted as soon as they add the user/);
  assert.match(workspaceMarkup, /User Sign-In Methods/);
  assert.match(workspaceMarkup, /Choose how workspace users can sign in. Select at least one method/);
  assert.doesNotMatch(workspaceMarkup, /Default LLM Keys|AI Policy|data-settings-tab/);
  assert.doesNotMatch(workspaceMarkup, /data-sign-in-methods-note|Deployment-disabled methods cannot be selected/);
  assert.match(workspaceMarkup, /New users are prompted to create one the first time they sign in/);
  assert.match(workspaceMarkup, /configured OpenID Connect identity provider/);
  assert.match(workspaceMarkup, /Password sign-in is disabled by deployment policy/);
  assert.match(workspaceMarkup, /name="methods" value="password"[^>]+disabled/);
  assert.match(workspaceMarkup, /name="methods" value="oidc"[^>]+checked/);
  assert.match(aiMarkup, /data-settings-category="ai"/);
  assert.match(aiMarkup, /Default LLM Keys/);
  assert.match(aiMarkup, /Used by every workspace unless that workspace saves its own provider key/);
  assert.match(aiMarkup, /AI Policy/);
  assert.match(aiMarkup, /type="password"/);
  assert.match(aiMarkup, /OpenAI[\s\S]+Configured/);
  assert.match(aiMarkup, /provider-default-card/);
  assert.match(aiMarkup, /provider-default-title/);
  assert.match(aiMarkup, /provider-default-status configured/);
  assert.match(aiMarkup, /provider-default-field/);
  assert.match(aiMarkup, /input provider-default-input/);
  assert.match(aiMarkup, /Rotate API key/);
  assert.match(aiMarkup, /Add API key/);
  assert.match(aiMarkup, /Rotate key[\s\S]+Delete key/);
  assert.match(aiMarkup, /class="button secondary provider-key-action"[^>]*>[\s\S]+<span>Save key<\/span>/);
  assert.match(aiMarkup, /provider-key-action/);
  assert.doesNotMatch(aiMarkup, /Member Discovery|User Sign-In Methods|data-settings-tab/);
  assert.doesNotMatch(aiMarkup, /provider-default-summary|provider-default-editor|settings-status-success|Delete default|Replace key|Available for workspace fallback/);
  assert.match(aiMarkup, /Gemini[\s\S]+Disabled by deployment policy/);
  assert.match(`${workspaceMarkup}\n${aiMarkup}`, /Deployment default/);
  assert.match(aiMarkup, /Runtime override/);
  assert.match(workspaceMarkup, /Policy constrained/);
  assert.match(`${workspaceMarkup}\n${aiMarkup}`, /data-save-setting disabled/);
  assert.match(`${workspaceMarkup}\n${aiMarkup}`, /settings-surface management-settings-layout/);
  assert.match(`${workspaceMarkup}\n${aiMarkup}`, /settings-section-heading/);
  assert.doesNotMatch(`${workspaceMarkup}\n${aiMarkup}`, /role="tablist"|data-settings-tab|data-settings-panel/);
  assert.ok(workspaceMarkup.indexOf("Member Discovery") < workspaceMarkup.indexOf("User Sign-In Methods"));
  assert.ok(aiMarkup.indexOf("Default LLM Keys") < aiMarkup.indexOf("AI Policy"));
  assert.doesNotMatch(`${workspaceMarkup}\n${aiMarkup}`, /directory">Directory/);
  assert.doesNotMatch(`${workspaceMarkup}\n${aiMarkup}`, /SMTP_PASSWORD|OIDC_CLIENT_SECRET|openai_api_key/);
});

test("explains how each member-discovery mode adds users to a workspace", () => {
  const expectations = {
    directory: "Workspace owners can search the user directory and add an existing user directly to the workspace. Access is granted as soon as they add the user.",
    exact_email: "Workspace owners can add an existing user by entering their exact email address. Access is granted as soon as they add the user.",
    disabled: "Workspace owners can only send invitation links. The invited person is added after they accept the invitation."
  };

  Object.entries(expectations).forEach(([mode, description]) => {
    const settings = fixture();
    settings.get("member_discovery").value = { mode };
    assert.match(settingsMarkup(settings, true), new RegExp(description));
  });
});

test("renders AI as a standalone settings route without workspace settings", () => {
  const markup = settingsMarkup(fixture(), true, [], "ai");
  assert.match(markup, /data-settings-category="ai"/);
  assert.match(markup, /Default LLM Keys/);
  assert.match(markup, /AI Policy/);
  assert.doesNotMatch(markup, /Member Discovery|User Sign-In Methods|role="tablist"|data-settings-tab/);
});

test("uses a direct workspace settings layout without hidden tab panels", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.workspace-settings-content \{ display: grid; gap: 40px; \}/);
  assert.doesNotMatch(styles, /settings-tab-panel|settings-panel-workspace/);
});

test("keeps AI policy available when provider-default status cannot load", () => {
  const markup = settingsMarkup(
    fixture(),
    true,
    null,
    "ai",
    "The admin control plane is temporarily unavailable."
  );
  assert.match(markup, /AI Policy/);
  assert.doesNotMatch(markup, /Member Discovery|User Sign-In Methods/);
  assert.match(markup, /Default LLM key status is temporarily unavailable/);
  assert.match(markup, /data-retry-provider-defaults/);
  assert.match(markup, /The admin control plane is temporarily unavailable/);
  assert.doesNotMatch(markup, /data-provider-default-form/);
});

test("keeps mutation controls unavailable for read-only administrators", () => {
  const workspaceMarkup = settingsMarkup(fixture(), false);
  const aiMarkup = settingsMarkup(fixture(), false, [], "ai");
  assert.match(workspaceMarkup, /Your platform role has read-only access/);
  assert.match(workspaceMarkup, /data-reset-setting disabled/);
  assert.match(workspaceMarkup, /form="setting-form-member_discovery" data-save-setting disabled/);
  assert.match(aiMarkup, /data-provider="openai"[\s\S]+name="apiKey"[^>]+disabled/);
});

test("normalizes disabled reasoning summaries to the required off mode", () => {
  const data = new FormData();
  data.set("defaultProvider", "openai");
  data.set("defaultModel", "gpt-5.5");
  data.set("model:openai", "gpt-5.5");
  data.set("reasoningSummaryModes", "auto");
  data.set("reasoningEfforts", "high");

  const value = settingValue("ai_policy", data, {
    elements: { reasoningSummariesEnabled: { checked: false } }
  });

  assert.equal(value.reasoningSummariesEnabled, false);
  assert.deepEqual(value.reasoningSummaryModes, ["off"]);
});

test("serializes sign-in methods and rejects an empty selection", () => {
  const selected = new FormData();
  selected.append("methods", "password");
  selected.append("methods", "oidc");
  assert.deepEqual(settingValue("user_sign_in_methods", selected), { methods: ["password", "oidc"] });
  assert.throws(() => settingValue("user_sign_in_methods", new FormData()), /Select at least one sign-in method/);
});

test("recognizes only meaningful settings changes", () => {
  assert.equal(
    settingValuesMatch({ methods: ["password", "oidc"] }, { methods: ["oidc", "password"] }),
    true
  );
  assert.equal(
    settingValuesMatch({ mode: "exact_email" }, { mode: "directory" }),
    false
  );
});
