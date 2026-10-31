import assert from 'node:assert/strict';
import test from 'node:test';
import { matchAdminRoute, sanitizedAdminQuery } from '../lib/admin-route-policy.mjs';
import { projectAdminResponse } from '../lib/admin-contract.mjs';

test('summary routes preserve narrow scopes and project only bounded governance fields', () => {
  const workspace = matchAdminRoute('GET', '/workspaces/summary');
  const users = matchAdminRoute('GET', '/users/summary');
  assert.equal(workspace.upstreamTemplate, '/admin/v1/workspaces/summary');
  assert.equal(workspace.requiredScope, 'admin:workspace:read');
  assert.equal(users.requiredScope, 'admin:user:read');
  const input = { workspaceCount: 5, suspendedWorkspaceCount: 1, kubernetesCount: 8, virtualMachineCount: 3,
    environmentLeaders: [{ id: 'ws-1', name: 'Workspace', clusterCount: 2, virtualMachineCount: 1, targetId: 'private' }], runCount: 10 };
  assert.deepEqual(projectAdminResponse(workspace, input), { workspaceCount: 5, suspendedWorkspaceCount: 1, kubernetesCount: 8, virtualMachineCount: 3,
    environmentLeaders: [{ id: 'ws-1', name: 'Workspace', clusterCount: 2, virtualMachineCount: 1 }] });
  assert.deepEqual(projectAdminResponse(users, { userCount: 10, verifiedUserCount: 8, emails: ['private'] }), { userCount: 10, verifiedUserCount: 8 });
  assert.throws(() => projectAdminResponse(workspace, {}));
  assert.throws(() => projectAdminResponse(users, { userCount: -1, verifiedUserCount: 8 }));
  assert.equal(sanitizedAdminQuery(workspace, new URLSearchParams('targetId=private')), null);
  assert.equal(sanitizedAdminQuery(matchAdminRoute('GET', '/workspaces'), new URLSearchParams('lifecycleStatus=suspended&limit=25')).toString(), 'lifecycleStatus=suspended&limit=25');
});
