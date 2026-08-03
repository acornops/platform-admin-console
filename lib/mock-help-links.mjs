export const mockHelpLinksSetting = {
  key: "help_links",
  value: {
    documentationUrl: "https://docs.acornops.dev",
    supportUrl: "https://discord.gg/jBgTy4KhF"
  },
  deploymentDefault: {
    documentationUrl: "https://docs.acornops.dev",
    supportUrl: "https://discord.gg/jBgTy4KhF"
  },
  source: "deployment_default",
  version: 0,
  editable: true,
  constraints: {
    documentationProtocols: ["https:"],
    supportProtocols: ["https:", "mailto:"],
    maxUrlLength: 2048
  }
};
