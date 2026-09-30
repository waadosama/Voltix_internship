/**
 * Shop catalogue management tests: the admin studio owns the product records
 * in MongoDB, the customer-facing shop only ever sees `published` items, and
 * every write is guarded by a `products:*` permission.
 *
 * Uses the shared test database (RBAC_TEST_MONGODB_URI, default
 * `mongodb://127.0.0.1:27017/voltix-rbac-test`) with `shop-admin-` prefixed
 * fixtures. Every test skips when MongoDB is unreachable.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { createApp } from '../app.js';
import { Product } from '../models/product.js';
import { User } from '../models/user.js';
import { hashPassword } from '../middleware/auth.js';

const MONGO_URI =
  process.env.RBAC_TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/voltix-rbac-test';

const stamp = Date.now();
const DRAFT_SLUG = `shop-admin-draft-${stamp}`;
const PUBLIC_SLUG = `shop-admin-public-${stamp}`;
const NEW_SLUG = `shop-admin-new-${stamp}`;

const accounts = {
  admin: { name: 'Shop Admin', email: `shop-admin-a-${stamp}@test.local`, password: 'shop-pass-1', role: 'admin' },
  employee: { name: 'Shop Employee', email: `shop-admin-e-${stamp}@test.local`, password: 'shop-pass-2', role: 'employee' }
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
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

async function login(account) {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { email: account.email, password: account.password }
  });
  assert.equal(result.status, 200, `login failed for ${account.email}`);
  return result.data.token;
}

before(async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
  } catch (error) {
    console.error(`Skipping shop admin tests — MongoDB unavailable: ${error.message}`);
    return;
  }

  await Product.deleteMany({ id: { $regex: /^shop-admin-/ } });
  await User.deleteMany({ email: { $regex: /^shop-admin-/ } });

  for (const account of Object.values(accounts)) {
    await User.create({
      name: account.name,
      email: account.email,
      password: hashPassword(account.password),
      role: account.role
    });
  }

  await Product.create({ id: PUBLIC_SLUG, name: 'Public Item', category: 'Brand', price: 10, blurb: 'Visible to customers.', status: 'published' });
  await Product.create({ id: DRAFT_SLUG, name: 'Draft Item', category: 'Brand', price: 20, blurb: 'Hidden from customers.', status: 'draft' });

  const app = createApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;

  tokens.admin = await login(accounts.admin);
  tokens.employee = await login(accounts.employee);
  ready = true;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    await Product.deleteMany({ id: { $regex: /^shop-admin-/ } });
    await User.deleteMany({ email: { $regex: /^shop-admin-/ } });
    await mongoose.disconnect();
  }
});

test('customers only see published items and cannot read drafts', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const list = await api('/api/products');
  assert.equal(list.status, 200);
  const ids = list.data.products.map((product) => product.id);
  assert.ok(ids.includes(PUBLIC_SLUG));
  assert.ok(!ids.includes(DRAFT_SLUG));
  assert.ok(list.data.products.every((product) => product.status === 'published'));

  assert.equal((await api(`/api/products/${PUBLIC_SLUG}`)).status, 200);
  assert.equal((await api(`/api/products/${DRAFT_SLUG}`)).status, 404);

  // Widening the read to drafts requires credentials
  const unauthenticated = await api('/api/products?scope=all');
  assert.equal(unauthenticated.status, 401);
  const unauthenticatedWrite = await api('/api/products', { method: 'POST', body: { id: NEW_SLUG } });
  assert.equal(unauthenticatedWrite.status, 401);
});

test('an employee holds no products:* permission', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const scope = await api('/api/products?scope=all', { token: tokens.employee });
  assert.equal(scope.status, 403);
  assert.ok(scope.data.missingPermissions.includes('products:read'));

  const create = await api('/api/products', {
    method: 'POST',
    token: tokens.employee,
    body: { id: NEW_SLUG, name: 'Nope', category: 'Brand', price: 1, blurb: 'nope' }
  });
  assert.equal(create.status, 403);
  assert.ok(create.data.missingPermissions.includes('products:create'));

  assert.equal((await api(`/api/products/${PUBLIC_SLUG}`, { method: 'PATCH', token: tokens.employee, body: { price: 1 } })).status, 403);
  assert.equal((await api(`/api/products/${PUBLIC_SLUG}`, { method: 'DELETE', token: tokens.employee })).status, 403);
});

test('the admin studio can create, publish, edit and delete shop items', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const created = await api('/api/products', {
    method: 'POST',
    token: tokens.admin,
    body: { id: NEW_SLUG, name: 'Studio Item', category: 'Brand', price: 55, blurb: 'Made in the studio.', status: 'draft' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.product.status, 'draft');

  // Still invisible to customers while it is a draft
  assert.equal((await api('/api/products')).data.products.some((p) => p.id === NEW_SLUG), false);
  assert.equal((await api(`/api/products/${NEW_SLUG}`)).status, 404);
  // ...but visible to the studio
  const scoped = await api('/api/products?scope=all', { token: tokens.admin });
  assert.equal(scoped.status, 200);
  assert.ok(scoped.data.products.some((p) => p.id === NEW_SLUG));

  const updated = await api(`/api/products/${NEW_SLUG}`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { name: 'Studio Item II', price: 60, status: 'published', role: 'admin' }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.product.name, 'Studio Item II');
  assert.equal(updated.data.product.price, 60);
  assert.equal(updated.data.product.status, 'published');
  assert.equal(updated.data.product.role, undefined); // unknown fields are dropped

  assert.equal((await api(`/api/products/${NEW_SLUG}`)).status, 200);

  const removed = await api(`/api/products/${NEW_SLUG}`, { method: 'DELETE', token: tokens.admin });
  assert.equal(removed.status, 200);
  assert.equal((await api(`/api/products/${NEW_SLUG}`)).status, 404);
});

test('invalid or duplicate shop items are rejected', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const duplicate = await api('/api/products', {
    method: 'POST',
    token: tokens.admin,
    body: { id: PUBLIC_SLUG, name: 'Copy', category: 'Brand', price: 1, blurb: 'copy' }
  });
  assert.equal(duplicate.status, 409);

  const invalid = await api('/api/products', {
    method: 'POST',
    token: tokens.admin,
    body: { id: 'Not A Slug', name: ' ', category: ' ', price: -1, blurb: ' ' }
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.code, 'validation');

  assert.equal((await api('/api/products/does-not-exist', { token: tokens.admin })).status, 404);
});
