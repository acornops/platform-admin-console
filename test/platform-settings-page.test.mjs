import assert from "node:assert/strict";
import test from "node:test";
import { settingValue, settingsMarkup } from "../public/platform-settings-page.js";

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
      constraints: { allowedModes: ["disabled", "exact_email"] }
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
    ["password_signup", {
      key: "password_signup",
      value: { enabled: false },
      deploymentDefault: { enabled: false },
      source: "runtime_override_constrained",
      overrideValue: { enabled: true },
      version: 1,
      editable: true,
      constraints: { allowedValues: [false, true], enablementBlockers: ["Email delivery is disabled."] },
      warning: "Email delivery is disabled."
    }]
  ]);
}

test("renders bounded settings and write-only provider defaults with safety context", () => {
  const markup = settingsMarkup(fixture(), true, [
    { provider: "openai", configured: true, enabled: true, source: "platform_default" },
    { provider: "anthropic", configured: false, enabled: true, source: "none" },
    { provider: "gemini", configured: false, enabled: false, source: "none" }
  ]);
  assert.match(markup, /Member discovery/);
  assert.match(markup, /AI policy/);
  assert.match(markup, /Password signup/);
  assert.match(markup, /Default LLM keys/);
  assert.match(markup, /Used by every workspace unless that workspace saves its own provider key/);
  assert.match(markup, /type="password"/);
  assert.match(markup, /OpenAI[\s\S]+Configured/);
  assert.match(markup, /provider-default-card/);
  assert.match(markup, /provider-default-title/);
  assert.match(markup, /provider-default-status configured/);
  assert.match(markup, /provider-default-field/);
  assert.match(markup, /input provider-default-input/);
  assert.match(markup, /Rotate API key/);
  assert.match(markup, /Rotate key[\s\S]+Delete key/);
  assert.match(markup, /class="button secondary provider-key-action"[^>]*>[\s\S]+<span>Save key<\/span>/);
  assert.match(markup, /provider-key-action/);
  assert.doesNotMatch(markup, /provider-default-summary|provider-default-editor|settings-status-success|Delete default|Replace key/);
  assert.match(markup, /Gemini[\s\S]+Disabled by deployment policy/);
  assert.match(markup, /Deployment default/);
  assert.match(markup, /Runtime override/);
  assert.match(markup, /Policy constrained/);
  assert.match(markup, /Enablement unavailable/);
  assert.match(markup, /data-save-setting disabled/);
  assert.match(markup, /role="tablist" aria-label="Platform setting categories"/);
  assert.match(markup, /settings-surface management-settings-layout/);
  assert.match(markup, /settings-section-heading/);
  assert.match(markup, /data-settings-tab="workspace"/);
  assert.match(markup, /data-settings-tab="ai"/);
  assert.doesNotMatch(markup, /data-settings-tab="members"/);
  const workspacePanel = markup.indexOf('data-settings-panel="workspace"');
  const aiPanel = markup.indexOf('data-settings-panel="ai"');
  assert.ok(workspacePanel < markup.indexOf("Member discovery"));
  assert.ok(markup.indexOf("Member discovery") < markup.indexOf("Password signup"));
  assert.ok(markup.indexOf("Password signup") < aiPanel);
  assert.ok(aiPanel < markup.indexOf("AI policy"));
  assert.ok(markup.indexOf("AI policy") < markup.indexOf("Default LLM keys"));
  assert.doesNotMatch(markup, /directory">Directory/);
  assert.doesNotMatch(markup, /SMTP_PASSWORD|OIDC_CLIENT_SECRET|openai_api_key/);
  assert.match(markup, /M12 8V4H8/);
});

test("renders AI as the selected category without exposing a Members tab", () => {
  const markup = settingsMarkup(fixture(), true, [], "ai");
  assert.match(markup, /id="settings-tab-ai"[\s\S]+aria-selected="true"/);
  assert.match(markup, /data-settings-panel="workspace" hidden/);
  assert.match(markup, /data-settings-panel="ai" >/);
  assert.doesNotMatch(markup, /data-settings-tab="members"/);
});

test("keeps workspace settings available when provider-default status cannot load", () => {
  const markup = settingsMarkup(
    fixture(),
    true,
    null,
    "ai",
    "The admin control plane is temporarily unavailable."
  );
  assert.match(markup, /Member discovery/);
  assert.match(markup, /AI policy/);
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
