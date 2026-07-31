export const mockKubernetesRbacDeploymentDefault = {
  additions: [{
    key: "cnpg",
    name: "CloudNativePG",
    description: "CloudNativePG database clusters",
    resources: [{
      apiGroup: "postgresql.cnpg.io",
      apiVersion: "v1",
      resource: "clusters",
      kind: "Cluster",
      scope: "namespaced",
      verbs: ["get", "list", "watch", "create", "patch", "delete"]
    }]
  }]
};

export function mockPlatformSetting(key, deploymentDefault, constraints) {
  return {
    key,
    value: structuredClone(deploymentDefault),
    deploymentDefault: structuredClone(deploymentDefault),
    source: "deployment_default",
    version: 0,
    editable: true,
    constraints: structuredClone(constraints)
  };
}

export function resolveMockKubernetesRbacAdditions(deploymentDefault, override) {
  const disabled = new Set(override.disabledKeys || []);
  const upserts = new Map((override.upserts || []).map((profile) => [profile.key, profile]));
  const additions = [];
  for (const profile of deploymentDefault.additions || []) {
    if (disabled.has(profile.key)) continue;
    additions.push(structuredClone(upserts.get(profile.key) || profile));
    upserts.delete(profile.key);
  }
  additions.push(...[...upserts.values()].map((profile) => structuredClone(profile)));
  return { additions };
}
