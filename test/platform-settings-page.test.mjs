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

test("renders the three bounded settings with source and safety context", () => {
  const markup = settingsMarkup(fixture(), true);
  assert.match(markup, /Member discovery/);
  assert.match(markup, /AI policy/);
  assert.match(markup, /Password signup/);
  assert.match(markup, /Deployment default/);
  assert.match(markup, /Runtime override/);
  assert.match(markup, /Policy constrained/);
  assert.match(markup, /Enablement unavailable/);
  assert.match(markup, /data-save-setting disabled/);
  assert.doesNotMatch(markup, /directory">Directory/);
  assert.doesNotMatch(markup, /SMTP_PASSWORD|OIDC_CLIENT_SECRET/);
});

test("keeps mutation controls unavailable for read-only administrators", () => {
  const markup = settingsMarkup(fixture(), false);
  assert.match(markup, /Your platform role has read-only access/);
  assert.match(markup, /data-reset-setting disabled/);
  assert.match(markup, /form="setting-form-member_discovery" data-save-setting disabled/);
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
