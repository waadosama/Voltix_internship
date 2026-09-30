/**
 * Shop item detail page checks (`GET /api/products/:id` + `/shop/:id`).
 *
 * Shares the dedicated test database with the RBAC API tests
 * (RBAC_TEST_MONGODB_URI, default `mongodb://127.0.0.1:27017/voltix-rbac-test`)
 * but only touches Product documents prefixed `shop-test-`. Every test skips
 * when MongoDB is unreachable.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { createApp } from '../app.js';
import { Product } from '../models/product.js';

const MONGO_URI =
  process.env.RBAC_TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/voltix-rbac-test';

const slug = `shop-test-item-${Date.now()}`;

let server;
let base;
let ready = false;
let product;

async function get(path) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('json') ? await response.json() : await response.text();
  return { status: response.status, location: response.headers.get('location'), body };
}

before(async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
  } catch (error) {
    console.error(`Skipping shop API tests — MongoDB unavailable: ${error.message}`);
    return;
  }

  await Product.deleteMany({ id: { $regex: /^shop-test-/ } });
  product = await Product.create({
    id: slug,
    name: 'Shop Test Item',
    category: 'Brand',
    price: 123,
    blurb: 'A fixture item for the /shop/:id detail page.',
    tone: 'lime',
    glyph: '✳'
  });

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  ready = true;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    await Product.deleteMany({ id: { $regex: /^shop-test-/ } });
    await mongoose.disconnect();
  }
});

test('GET /api/products/:id returns one item without auth', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const bySlug = await get(`/api/products/${slug}`);
  assert.equal(bySlug.status, 200);
  assert.equal(bySlug.body.product.id, slug);
  assert.equal(bySlug.body.product.price, 123);
  assert.ok(bySlug.body.product.blurb);

  const byObjectId = await get(`/api/products/${product._id}`);
  assert.equal(byObjectId.status, 200);
  assert.equal(byObjectId.body.product.id, slug);
});

test('GET /api/products/:id returns 404 for an unknown item', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const missing = await get('/api/products/no-such-item');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'not_found');
});

test('/shop/:id serves the detail page and /shop redirects to the shop', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const page = await get(`/shop/${slug}`);
  assert.equal(page.status, 200);
  assert.match(page.body, /id="item-card"/);
  assert.match(page.body, /id="item-controls"/);
  assert.match(page.body, /scripts\/pages\/shop-item\.js/);

  const redirect = await get('/shop');
  assert.ok(redirect.status >= 300 && redirect.status < 400);
  assert.match(redirect.location || '', /#shop/);
});

test('the shop grid links every card to its detail page', async (t) => {
  if (!ready) return t.skip('MongoDB unavailable');

  const homePage = await get('/');
  assert.equal(homePage.status, 200);

  const homeScript = await get('/scripts/pages/home.js');
  assert.equal(homeScript.status, 200);
  assert.match(homeScript.body, /\/shop\/\$\{encodeURIComponent\(product\.id\)\}/);
  // the request cart is shared with the detail page via localStorage
  assert.match(homeScript.body, /idea-house-cart/);
});
