export const mockAiPolicyDefault = {
  defaultProvider: "openai",
  defaultModel: "gpt-5.5",
  providerModels: {
    openai: ["gpt-5.5", "gpt-5.4", "gpt-5-mini"],
    anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5"],
    gemini: ["gemini-3.1-pro", "gemini-2.5-flash"]
  },
  reasoningSummariesEnabled: true,
  reasoningSummaryModes: ["off", "auto", "concise"],
  reasoningEfforts: ["off", "low", "medium", "high"]
};

export function mockAiModelCatalog(additionalProviderModels) {
  return Object.fromEntries(Object.entries(mockAiPolicyDefault.providerModels).map(([provider, models]) => [
    provider, [...new Set([...models, ...(additionalProviderModels?.[provider] || [])])]
  ]));
}
