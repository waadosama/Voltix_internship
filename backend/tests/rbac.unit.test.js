import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_PERMISSIONS,
  describePermission,
  isKnownRole,
  missingPermissions,
  permissionsForRole,
  ROLES,
  roleCan,
  roleCanAll,
  ROLE_ADMIN,
  ROLE_CLIENT,
  ROLE_EMPLOYEE
} from '../routes/permissions.js';
import { canModifyRecord, ownsRecord } from '../middleware/rbac.js';

test('every declared role has a permission list', () => {
  for (const role of ROLES) {
    assert.equal(isKnownRole(role), true);
    assert.ok(permissionsForRole(role).length > 0, `${role} should have permissions`);
  }
});

test('administrator holds every permission', () => {
  const granted = permissionsForRole(ROLE_ADMIN);
  assert.deepEqual([...granted].sort(), [...ALL_PERMISSIONS].sort());
  assert.equal(roleCan(ROLE_ADMIN, 'content:delete'), true);
  assert.equal(roleCan(ROLE_ADMIN, 'users:manage'), true);
});

test('employee can view/update records but cannot create, delete or manage users', () => {
  assert.equal(roleCan(ROLE_EMPLOYEE, 'content:read'), true);
  assert.equal(roleCan(ROLE_EMPLOYEE, 'content:update'), true);
  assert.equal(roleCan(ROLE_EMPLOYEE, 'requests:read'), true);
  assert.equal(roleCan(ROLE_EMPLOYEE, 'requests:update'), true);

  assert.equal(roleCan(ROLE_EMPLOYEE, 'content:create'), false);
  assert.equal(roleCan(ROLE_EMPLOYEE, 'content:delete'), false);
  assert.equal(roleCan(ROLE_EMPLOYEE, 'users:read'), false);
  assert.equal(roleCan(ROLE_EMPLOYEE, 'users:create'), false);
  assert.equal(roleCan(ROLE_EMPLOYEE, 'users:manage'), false);
});

test('client can only manage their own profile and chat', () => {
  const granted = permissionsForRole(ROLE_CLIENT);
  assert.deepEqual([...granted].sort(), ['chat:use', 'profile:read', 'profile:update']);
  assert.equal(roleCan(ROLE_CLIENT, 'content:read'), false);
  assert.equal(roleCan(ROLE_CLIENT, 'requests:read'), false);
});

test('unknown roles are denied everything (deny by default)', () => {
  assert.equal(isKnownRole('superuser'), false);
  assert.deepEqual(permissionsForRole('superuser'), []);
  assert.deepEqual(permissionsForRole(undefined), []);
  assert.equal(roleCan(null, 'profile:read'), false);
});

test('missingPermissions reports exactly what a role lacks', () => {
  assert.deepEqual(missingPermissions(ROLE_EMPLOYEE, ['content:read']), []);
  assert.deepEqual(missingPermissions(ROLE_EMPLOYEE, ['content:read', 'content:delete']), ['content:delete']);
  assert.equal(roleCanAll(ROLE_CLIENT, ['profile:read', 'content:read']), false);
  assert.equal(roleCanAll(ROLE_ADMIN, ['profile:read', 'content:read']), true);
});

test('permission codes have human readable descriptions', () => {
  for (const code of ALL_PERMISSIONS) {
    assert.equal(typeof describePermission(code), 'string');
  }
  assert.equal(describePermission('nope:nope'), null);
});

test('record ownership: admins may modify any record, employees only their own', () => {
  const admin = { id: 'admin-1', role: ROLE_ADMIN };
  const employee = { id: 'emp-1', role: ROLE_EMPLOYEE };
  const ownRecord = { createdBy: 'emp-1' };
  const foreignRecord = { createdBy: 'someone-else' };
  const legacyRecord = { createdBy: null };

  assert.equal(ownsRecord(employee, ownRecord), true);
  assert.equal(ownsRecord(employee, foreignRecord), false);

  assert.equal(canModifyRecord(admin, foreignRecord), true);
  assert.equal(canModifyRecord(employee, ownRecord), true);
  assert.equal(canModifyRecord(employee, foreignRecord), false);
  assert.equal(canModifyRecord(employee, legacyRecord), false);
  assert.equal(canModifyRecord(null, ownRecord), false);
});
