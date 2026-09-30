/**
 * End-to-end RBAC checks against the real Express app + MongoDB.
 *
 * Uses a dedicated test database (RBAC_TEST_MONGODB_URI, default
 * `mongodb://127.0.0.1:27017/voltix-rbac-test`) so development data is never
 * touched. Every test skips when MongoDB is unreachable.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { createApp } from '../app.js';
import { Content } from '../models/content.js';
import { Inquiry } from '../models/contact.js';
import { User } from '../models/user.js';
import { hashPassword } from '../middleware/auth.js';

const MONGO_URI =
  process.env.RBAC_TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/voltix-rbac-test';

const stamp = Date.now();
const accounts = {
  admin: { name: 'RBAC Admin', email: `rbac-admin-${stamp}@test.local`, password: 'admin-pass-1' },
  employee: { name: 'RBAC Employee', email: `rbac-employee-${stamp}@test.local`, password: 'employee-pass-1' },
  client: { name: 'RBAC Client', email: `rbac-client-${stamp}@test.local`, password: 'client-pass-1' }
};

let server;
let base;
let ready = false;
const tokens = {};

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

async function login(account) {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { email: account.email, password: account.password }
  });
  assert.equal(result.status, 200, `login failed for ${account.email}`);
  return result.data;
}

before(async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
  } catch (error) {
    console.error(`Skipping RBAC API tests — MongoDB unavailable: ${error.message}`);
    return;
  }

  // Remove any leftovers from a previous (interrupted) run.
  await User.deleteMany({ email: { $regex: /^rbac-/ } });
  await Content.deleteMany({ slug: { $regex: /^rbac-test-/ } });

  for (const [key, account] of Object.entries(accounts)) {
    const user = await User.create({
      name: account.name,
      email: account.email,
      password: hashPassword(account.password),
      role: key === 'admin' ? 'admin' : key === 'employee' ? 'employee' : 'client'
    });
    account.id = String(user._id);
  }

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  tokens.admin = (await login(accounts.admin)).token;
  tokens.employee = (await login(accounts.employee)).token;
  tokens.client = (await login(accounts.client)).token;

  ready = true;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    // Everything these tests create is prefixed with `rbac-` / `rbac-test-`.
    await User.deleteMany({ email: { $regex: /^rbac-/ } });
    await Content.deleteMany({ slug: { $regex: /^rbac-test-/ } });
    await Inquiry.deleteMany({ subject: { $regex: /^RBAC test/ } });
    await mongoose.disconnect();
  }
});

test('missing credentials are rejected with 401', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');
  const anonymous = await api('/api/content');
  assert.equal(anonymous.status, 401);

  const forged = await api('/api/content', { token: 'not.a.jwt' });
  assert.equal(forged.status, 401);
});

test('login responses advertise the role and its permissions', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const admin = await login(accounts.admin);
  const employee = await login(accounts.employee);
  const client = await login(accounts.client);

  assert.equal(admin.user.role, 'admin');
  assert.ok(admin.user.permissions.includes('users:manage'));

  assert.equal(employee.user.role, 'employee');
  assert.ok(employee.user.permissions.includes('content:read'));
  assert.equal(employee.user.permissions.includes('content:create'), false);

  assert.equal(client.user.role, 'client');
  assert.deepEqual([...client.user.permissions].sort(), ['chat:use', 'profile:read', 'profile:update']);
});

test('a client cannot reach the studio at all', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const content = await api('/api/content', { token: tokens.client });
  assert.equal(content.status, 403);
  assert.equal(content.data.code, 'forbidden');
  assert.equal(content.data.role, 'client');
  assert.ok(content.data.missingPermissions.includes('content:read'));

  const requests = await api('/api/requests', { token: tokens.client });
  assert.equal(requests.status, 403);
  assert.ok(requests.data.missingPermissions.includes('requests:read'));

  const users = await api('/api/users', { token: tokens.client });
  assert.equal(users.status, 403);
});

test('an employee can read and update records but not create or delete them', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const list = await api('/api/content', { token: tokens.employee });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data.items));

  const create = await api('/api/content', {
    method: 'POST',
    token: tokens.employee,
    body: { title: 'Nope', slug: `rbac-test-${stamp}-denied` }
  });
  assert.equal(create.status, 403);
  assert.ok(create.data.missingPermissions.includes('content:create'));

  const remove = await api('/api/content/some-id', { method: 'DELETE', token: tokens.employee });
  assert.equal(remove.status, 403);
  assert.ok(remove.data.missingPermissions.includes('content:delete'));

  const manageUsers = await api('/api/users', { token: tokens.employee });
  assert.equal(manageUsers.status, 403);
  assert.ok(manageUsers.data.missingPermissions.includes('users:read'));
});

test('an employee may only update content records they own', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const foreign = await Content.create({
    title: 'Admin owned',
    slug: `rbac-test-${stamp}-foreign`,
    body: 'Created by the admin.',
    status: 'draft',
    createdBy: accounts.admin.id,
    createdByName: accounts.admin.name
  });

  const owned = await Content.create({
    title: 'Employee owned',
    slug: `rbac-test-${stamp}-owned`,
    body: 'Created by the employee.',
    status: 'draft',
    createdBy: accounts.employee.id,
    createdByName: accounts.employee.name
  });

  const denied = await api(`/api/content/${foreign._id}`, {
    method: 'PATCH',
    token: tokens.employee,
    body: { title: 'Hijacked title' }
  });
  assert.equal(denied.status, 403);

  const allowed = await api(`/api/content/${owned._id}`, {
    method: 'PATCH',
    token: tokens.employee,
    body: { title: 'Employee owned (edited)', status: 'published' }
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.data.item.title, 'Employee owned (edited)');
  assert.equal(allowed.data.item.canUpdate, true);
  assert.equal(allowed.data.item.canDelete, false);

  // The rejected update must not have changed anything.
  const untouched = await Content.findById(foreign._id).lean();
  assert.equal(untouched.title, 'Admin owned');

  // An admin can hand a record to an employee, which then becomes editable by them.
  const assigned = await api('/api/content', {
    method: 'POST',
    token: tokens.admin,
    body: {
      title: 'Assigned record',
      slug: `rbac-test-${stamp}-assigned`,
      body: 'Handed over by the admin.',
      status: 'draft',
      createdBy: accounts.employee.id
    }
  });
  assert.equal(assigned.status, 201);
  assert.equal(assigned.data.item.createdBy, accounts.employee.id);

  const assignedEdit = await api(`/api/content/${assigned.data.item.id}`, {
    method: 'PATCH',
    token: tokens.employee,
    body: { title: 'Assigned record (edited by employee)' }
  });
  assert.equal(assignedEdit.status, 200);

  // Ownership grants edit rights, not deletion rights.
  const assignedDelete = await api(`/api/content/${assigned.data.item.id}`, {
    method: 'DELETE',
    token: tokens.employee
  });
  assert.equal(assignedDelete.status, 403);

  await api(`/api/content/${assigned.data.item.id}`, { method: 'DELETE', token: tokens.admin });
});

test('an admin can create, modify and delete content and list users', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const created = await api('/api/content', {
    method: 'POST',
    token: tokens.admin,
    body: { title: 'Admin item', slug: `rbac-test-${stamp}-admin`, body: 'Body', status: 'draft' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.item.createdBy, accounts.admin.id);
  assert.equal(created.data.item.canDelete, true);

  const badOwner = await api('/api/content', {
    method: 'POST',
    token: tokens.admin,
    body: { title: 'Bad owner', slug: `rbac-test-${stamp}-badowner`, createdBy: 'not-an-object-id' }
  });
  assert.equal(badOwner.status, 400);

  const updated = await api(`/api/content/${created.data.item.id}`, {
    method: 'PUT',
    token: tokens.admin,
    body: { title: 'Admin item (edited)' }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.item.title, 'Admin item (edited)');

  const users = await api('/api/users', { token: tokens.admin });
  assert.equal(users.status, 200);
  assert.ok(users.data.users.some((user) => user.email === accounts.employee.email));
  assert.equal(users.data.roles.length, 3);
  const employeeRole = users.data.roles.find((role) => role.role === 'employee');
  assert.ok(employeeRole.permissions.includes('content:read'));
  assert.equal(employeeRole.permissions.includes('content:delete'), false);

  const removed = await api(`/api/content/${created.data.item.id}`, {
    method: 'DELETE',
    token: tokens.admin
  });
  assert.equal(removed.status, 200);
});

test('an admin can grant and revoke a role; existing tokens follow the new role', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const promotedEmail = `rbac-promoted-${stamp}@test.local`;
  const promotedPassword = 'promoted-pass-1';
  const created = await api('/api/users', {
    method: 'POST',
    token: tokens.admin,
    body: { name: 'Promoted User', email: promotedEmail, password: promotedPassword, role: 'client' }
  });
  assert.equal(created.status, 201);
  assert.deepEqual([...created.data.user.permissions].sort(), ['chat:use', 'profile:read', 'profile:update']);

  const session = await login({ email: promotedEmail, password: promotedPassword });
  const token = session.token;

  const beforePromotion = await api('/api/content', { token });
  assert.equal(beforePromotion.status, 403);

  const promote = await api(`/api/users/${created.data.user.id}/role`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { role: 'employee' }
  });
  assert.equal(promote.status, 200);
  assert.equal(promote.data.user.role, 'employee');

  // Same, unchanged token — only the database role differs.
  const afterPromotion = await api('/api/content', { token });
  assert.equal(afterPromotion.status, 200);

  const demote = await api(`/api/users/${created.data.user.id}/role`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { role: 'client' }
  });
  assert.equal(demote.status, 200);

  const afterDemotion = await api('/api/content', { token });
  assert.equal(afterDemotion.status, 403);

  const badRole = await api(`/api/users/${created.data.user.id}/role`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { role: 'superuser' }
  });
  assert.equal(badRole.status, 400);
});

test('an employee cannot change anyone\'s role', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const result = await api(`/api/users/${accounts.client.id}/role`, {
    method: 'PATCH',
    token: tokens.employee,
    body: { role: 'admin' }
  });
  assert.equal(result.status, 403);
  assert.ok(result.data.missingPermissions.includes('users:manage'));
});

test('public registration can never request an elevated role', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const email = `rbac-registered-${stamp}@test.local`;
  const result = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Sneaky', email, password: 'sneaky-pass-1', role: 'admin' }
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.user.role, 'client');
  assert.equal(result.data.user.permissions.includes('content:read'), false);
});

test('employees can work customer requests, clients cannot see them', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const inquiry = await Inquiry.create({
    name: 'RBAC Tester',
    email: `rbac-inquiry-${stamp}@test.local`,
    subject: `RBAC test ${stamp}`,
    message: 'Please handle my request.',
    status: 'new'
  });

  const employeeList = await api('/api/requests', { token: tokens.employee });
  assert.equal(employeeList.status, 200);

  const employeeUpdate = await api(`/api/requests/${inquiry._id}`, {
    method: 'PUT',
    token: tokens.employee,
    body: { status: 'in-progress' }
  });
  assert.equal(employeeUpdate.status, 200);
  assert.equal(employeeUpdate.data.inquiry.status, 'in-progress');

  const clientList = await api('/api/requests', { token: tokens.client });
  assert.equal(clientList.status, 403);
});

test('the .env employee account signs in with employee permissions only', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');
  if (!process.env.EMPLOYEE_USERNAME || !process.env.EMPLOYEE_PASSWORD) {
    return t.skip('EMPLOYEE_USERNAME / EMPLOYEE_PASSWORD are not configured in .env');
  }

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: process.env.EMPLOYEE_USERNAME, password: process.env.EMPLOYEE_PASSWORD }
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'employee');
  assert.deepEqual(
    [...login.data.user.permissions].sort(),
    ['chat:use', 'content:read', 'content:update', 'profile:read', 'profile:update', 'requests:read', 'requests:update']
  );

  const envEmployeeToken = login.data.token;

  // The profile endpoint answers for the environment account...
  assert.equal((await api('/api/auth/me', { token: envEmployeeToken })).status, 200);

  // ...but the account never gains more than employee permissions
  const create = await api('/api/content', {
    method: 'POST',
    token: envEmployeeToken,
    body: { title: 'Env employee', slug: `env-employee-${stamp}`, body: 'nope' }
  });
  assert.equal(create.status, 403);
  assert.ok(create.data.missingPermissions.includes('content:create'));
  assert.equal((await api('/api/users', { token: envEmployeeToken })).status, 403);
  assert.equal((await api('/api/products?scope=all', { token: envEmployeeToken })).status, 403);

  // ...and it can do everything a regular employee may do
  assert.equal((await api('/api/content', { token: envEmployeeToken })).status, 200);
  assert.equal((await api('/api/requests', { token: envEmployeeToken })).status, 200);
});
