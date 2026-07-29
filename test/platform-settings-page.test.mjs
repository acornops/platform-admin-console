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
  const markup = settingsMarkup(fixture(), true, [
    { provider: "openai", configured: true, enabled: true, source: "platform_default" },
    { provider: "anthropic", configured: false, enabled: true, source: "none" },
    { provider: "gemini", configured: false, enabled: false, source: "none" }
  ]);
  assert.match(markup, /Member Discovery/);
  assert.match(markup, /Controls how workspace owners add people to their workspace/);
  assert.match(markup, /By Invites Only/);
  assert.match(markup, /Exact Email/);
  assert.match(markup, /Access is granted as soon as they add the user/);
  assert.match(markup, /AI Policy/);
  assert.match(markup, /User Sign-In Methods/);
  assert.match(markup, /Choose how workspace users can sign in. Select at least one method/);
  assert.doesNotMatch(markup, /data-sign-in-methods-note|Deployment-disabled methods cannot be selected/);
  assert.match(markup, /New users are prompted to create one the first time they sign in/);
  assert.match(markup, /configured OpenID Connect identity provider/);
  assert.match(markup, /Password sign-in is disabled by deployment policy/);
  assert.match(markup, /name="methods" value="password"[^>]+disabled/);
  assert.match(markup, /name="methods" value="oidc"[^>]+checked/);
  assert.match(markup, /Default LLM Keys/);
  assert.match(markup, /Used by every workspace unless that workspace saves its own provider key/);
  assert.match(markup, /type="password"/);
  assert.match(markup, /OpenAI[\s\S]+Configured/);
  assert.match(markup, /provider-default-card/);
  assert.match(markup, /provider-default-title/);
  assert.match(markup, /provider-default-status configured/);
  assert.match(markup, /provider-default-field/);
  assert.match(markup, /input provider-default-input/);
  assert.match(markup, /Rotate API key/);
  assert.match(markup, /Add API key/);
  assert.match(markup, /Rotate key[\s\S]+Delete key/);
  assert.match(markup, /class="button secondary provider-key-action"[^>]*>[\s\S]+<span>Save key<\/span>/);
  assert.match(markup, /provider-key-action/);
  assert.doesNotMatch(markup, /provider-default-summary|provider-default-editor|settings-status-success|Delete default|Replace key|Available for workspace fallback/);
  assert.match(markup, /Gemini[\s\S]+Disabled by deployment policy/);
  assert.match(markup, /Deployment default/);
  assert.match(markup, /Runtime override/);
  assert.match(markup, /Policy constrained/);
  assert.match(markup, /data-save-setting disabled/);
  assert.match(markup, /role="tablist" aria-label="Platform setting categories"/);
  assert.match(markup, /settings-surface management-settings-layout/);
  assert.match(markup, /settings-section-heading/);
  assert.match(markup, /data-settings-tab="workspace"/);
  assert.match(markup, /data-settings-tab="ai"/);
  assert.doesNotMatch(markup, /data-settings-tab="members"/);
  const workspacePanel = markup.indexOf('data-settings-panel="workspace"');
  const aiPanel = markup.indexOf('data-settings-panel="ai"');
  assert.ok(workspacePanel < markup.indexOf("Member Discovery"));
  assert.ok(markup.indexOf("Member Discovery") < markup.indexOf("User Sign-In Methods"));
  assert.ok(markup.indexOf("User Sign-In Methods") < aiPanel);
  assert.ok(aiPanel < markup.indexOf("Default LLM Keys"));
  assert.ok(markup.indexOf("Default LLM Keys") < markup.indexOf("AI Policy"));
  assert.doesNotMatch(markup, /directory">Directory/);
  assert.doesNotMatch(markup, /SMTP_PASSWORD|OIDC_CLIENT_SECRET|openai_api_key/);
  assert.match(markup, /M12 8V4H8/);
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

test("renders AI as the selected category without exposing a Members tab", () => {
  const markup = settingsMarkup(fixture(), true, [], "ai");
  assert.match(markup, /id="settings-tab-ai"[\s\S]+aria-selected="true"/);
  assert.match(markup, /data-settings-panel="workspace" hidden/);
  assert.match(markup, /data-settings-panel="ai" >/);
  assert.doesNotMatch(markup, /data-settings-tab="members"/);
});

test("keeps the hidden Workspace panel out of the AI tab layout", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(styles, /#settings-panel-workspace:not\(\[hidden\]\) \{ display: grid; gap: 40px; \}/);
  assert.doesNotMatch(styles, /#settings-panel-workspace \{ display: grid; gap: 40px; \}/);
  assert.doesNotMatch(styles, /#settings-panel-workspace \.settings-primary-field \+ \.settings-field-note \{ max-width: 62ch/);
});

test("keeps workspace settings available when provider-default status cannot load", () => {
  const markup = settingsMarkup(
    fixture(),
    true,
    null,
    "ai",
    "The admin control plane is temporarily unavailable."
  );
  assert.match(markup, /Member Discovery/);
  assert.match(markup, /AI Policy/);
  assert.match(markup, /Default LLM key status is temporarily unavailable/);
  assert.match(markup, /data-retry-provider-defaults/);
  assert.match(markup, /The admin control plane is temporarily unavailable/);
  assert.doesNotMatch(markup, /data-provider-default-form/);
});

test("keeps mutation controls unavailable for read-only administrators", () => {
  const markup = settingsMarkup(fixture(), false);
  assert.match(markup, /Your platform role has read-only access/);
  assert.match(markup, /data-reset-setting disabled/);
  assert.match(markup, /form="setting-form-member_discovery" data-save-setting disabled/);
  assert.match(markup, /data-provider="openai"[\s\S]+name="apiKey"[^>]+disabled/);
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
