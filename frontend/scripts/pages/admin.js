import { apiUrl as makeApiUrl, parseJson } from '../lib/api.js';
import { escapeHtml } from '../lib/html.js';

const loginPanel = document.querySelector('#login-panel');
const studio = document.querySelector('#studio');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const contentForm = document.querySelector('#content-form');
const contentItems = document.querySelector('#content-items');
const contentCount = document.querySelector('#content-count');
const editorEmpty = document.querySelector('#editor-empty');
const editorMode = document.querySelector('#editor-mode');
const editorStatus = document.querySelector('#editor-status');
const deleteButton = document.querySelector('#delete-content');
const ownerField = document.querySelector('#owner-field');
const ownerSelect = contentForm?.elements?.createdBy || null;
const requestForm = document.querySelector('#request-form');
const requestItems = document.querySelector('#request-items');
const requestCount = document.querySelector('#request-count');
const newRequestBtn = document.querySelector('#new-request');
const studioShop = document.querySelector('#studio-shop');
const productForm = document.querySelector('#product-form');
const productItems = document.querySelector('#product-items');
const productCount = document.querySelector('#product-count');
const productEditorEmpty = document.querySelector('#product-editor-empty');
const productEditorMode = document.querySelector('#product-editor-mode');
const productStatus = document.querySelector('#product-status');
const deleteProductBtn = document.querySelector('#delete-product');
const newProductBtn = document.querySelector('#new-product');
const adminTokenStorageKey = 'idea-house-admin-token';
const adminUsernameStorageKey = 'idea-house-admin-username';
const adminPasswordStorageKey = 'idea-house-admin-password';
const adminRoleStorageKey = 'idea-house-admin-role';
const adminPermissionsStorageKey = 'idea-house-admin-permissions';
let adminToken = sessionStorage.getItem(adminTokenStorageKey) || '';
let adminUsername = sessionStorage.getItem(adminUsernameStorageKey) || '';
let adminPassword = sessionStorage.getItem(adminPasswordStorageKey) || '';
let adminRole = sessionStorage.getItem(adminRoleStorageKey) || '';
let adminPermissions = readStoredPermissions();
let items = [];
let requests = [];
let products = [];
let editingId = null;
let contentEditingId = null;
let productEditingId = null;
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function readStoredPermissions() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(adminPermissionsStorageKey));
    return Array.isArray(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Permission checks mirror the backend's RBAC catalogue. */
function can(permission) {
  return Array.isArray(adminPermissions) ? adminPermissions.includes(permission) : true;
}

function storeStudioSession(user = {}) {
  adminRole = user.role || '';
  adminPermissions = Array.isArray(user.permissions) ? user.permissions : null;

  if (adminRole) sessionStorage.setItem(adminRoleStorageKey, adminRole);
  else sessionStorage.removeItem(adminRoleStorageKey);

  if (adminPermissions) sessionStorage.setItem(adminPermissionsStorageKey, JSON.stringify(adminPermissions));
  else sessionStorage.removeItem(adminPermissionsStorageKey);
}

function clearStudioSession() {
  sessionStorage.removeItem(adminTokenStorageKey);
  sessionStorage.removeItem(adminUsernameStorageKey);
  sessionStorage.removeItem(adminPasswordStorageKey);
  sessionStorage.removeItem(adminRoleStorageKey);
  sessionStorage.removeItem(adminPermissionsStorageKey);
  adminToken = '';
  adminUsername = '';
  adminPassword = '';
  adminRole = '';
  adminPermissions = null;
}

function renderStudioRole() {
  const roleBadge = document.querySelector('#studio-role');
  if (roleBadge) roleBadge.textContent = adminRole ? `${adminRole} access` : 'admin access';
  const shopRoleBadge = document.querySelector('#product-role');
  if (shopRoleBadge) shopRoleBadge.textContent = adminRole ? `${adminRole} access` : 'admin access';
}

function setStatus(element, message, isError = true) {
  element.textContent = message;
  element.classList.toggle('is-error', isError && Boolean(message));
  element.classList.toggle('is-success', !isError && Boolean(message));
}

async function fetchJson(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }
  if (adminUsername && adminPassword) {
    headers['X-Admin-Username'] = adminUsername;
    headers['X-Admin-Password'] = adminPassword;
  }
  const response = await fetch(makeApiUrl(path), { ...options, headers });
  const result = await parseJson(response);
  if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
  return result;
}

async function request(path = '', options = {}) {
  return fetchJson(`/api/content${path}`, options);
}

/** Fill the "Owner" picker (admins only) with accounts that may edit content. */
async function loadOwnerOptions() {
  if (!ownerField || !ownerSelect) return;
  if (!can('users:read')) {
    ownerField.hidden = true;
    return;
  }

  try {
    const result = await fetchJson('/api/users');
    const assignable = (result.users || []).filter((user) =>
      Array.isArray(user.permissions) && user.permissions.includes('content:update')
    );
    ownerSelect.innerHTML =
      '<option value="">Administrator (me)</option>' +
      assignable
        .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} (${escapeHtml(user.role)})</option>`)
        .join('');
  } catch {
    ownerField.hidden = true;
  }
}

function renderItems() {
  contentCount.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  const newContentButton = document.querySelector('#new-content');
  if (newContentButton) newContentButton.hidden = !can('content:create');

  if (!items.length) {
    contentItems.innerHTML = '<p class="empty-state">No content yet. Start with a new item.</p>';
    return;
  }
  contentItems.innerHTML = items.map((item) => {
    const editable = item.canUpdate !== false;
    const deleteControl = can('content:delete')
      ? `<button class="content-item-delete" data-delete-id="${item.id}" type="button">Delete</button>`
      : '';
    return `<div class="content-item ${item.id === contentEditingId ? 'is-active' : ''} ${editable ? '' : 'is-locked'}"><button class="content-item-select" data-id="${item.id}" type="button"><span class="item-status ${item.status}">${item.status}</span><strong>${escapeHtml(item.title)}</strong><small>/${escapeHtml(item.slug)}${editable ? '' : ' · read only'}</small></button>${deleteControl}</div>`;
  }).join('');
  contentItems.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => openContentEditor(button.dataset.id)));
  contentItems.querySelectorAll('[data-delete-id]').forEach((button) => button.addEventListener('click', () => deleteContentItem(button.dataset.deleteId)));
}

function renderRequests() {
  requestCount.textContent = `${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`;
  if (!requests.length) {
    requestItems.innerHTML = '<p class="empty-state">No requests yet. Start by having customers submit requests.</p>';
    return;
  }
  requestItems.innerHTML = requests.map((item) => `<div class="request-item ${item.id === editingId ? 'is-active' : ''}"><button class="request-item-select" data-id="${item.id}" type="button"><span class="item-status ${item.status}">${item.status}</span><strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.email)})<small>/ ${escapeHtml(item.subject)}</small></button><button class="request-item-delete" data-delete-id="${item.id}" type="button">Delete</button></div>`).join('');
  requestItems.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => openRequestEditor(button.dataset.id)));
  requestItems.querySelectorAll('[data-delete-id]').forEach((button) => button.addEventListener('click', () => deleteRequestItem(button.dataset.deleteId)));
}

function openContentEditor(id = null) {
  contentEditingId = id;
  const item = items.find((entry) => entry.id === id);
  const editable = !item || item.canUpdate !== false;
  editorEmpty.hidden = true;
  contentForm.hidden = false;
  contentForm.reset();
  contentForm.elements.updatedAt.value = item ? new Date(item.updatedAt).toLocaleString() : 'Not saved yet';
  contentForm.elements.title.value = item?.title || '';
  contentForm.elements.slug.value = item?.slug || '';
  contentForm.elements.status.value = item?.status || 'draft';
  contentForm.elements.body.value = item?.body || '';
  contentForm.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((field) => {
    field.disabled = !editable;
  });
  editorMode.textContent = item ? (editable ? 'Edit content item' : 'Read-only content item') : 'New content item';
  deleteButton.hidden = !(item && can('content:delete'));
  if (ownerField) ownerField.hidden = Boolean(item) || !can('users:read');
  setStatus(editorStatus, editable ? '' : 'Your role can view this record but not modify it.', !editable);
  renderItems();
}

function openRequestEditor(id = null) {
  editingId = id;
  const item = requests.find((entry) => entry.id === id);
  editorEmpty.hidden = true;
  requestForm.hidden = false;
  requestForm.reset();
  requestForm.elements.updatedAt.value = item ? new Date(item.updatedAt).toLocaleString() : 'Not saved yet';
  requestForm.elements.name.value = item?.name || '';
  requestForm.elements.email.value = item?.email || '';
  requestForm.elements.subject.value = item?.subject || '';
  requestForm.elements.message.value = item?.message || '';
  requestForm.elements.status.value = item?.status || 'new';
  editorMode.textContent = item ? 'Edit request' : 'New request';
  deleteButton.hidden = !item;
  setStatus(editorStatus, '');
  renderRequests();
}

async function loadItems() {
  try {
    const contentResult = await request();
    items = contentResult.items || [];
    renderItems();

    const requestsHeaders = { 'Content-Type': 'application/json' };
    if (adminToken) { requestsHeaders['Authorization'] = `Bearer ${adminToken}`; }
    if (adminUsername && adminPassword) {
      requestsHeaders['X-Admin-Username'] = adminUsername;
      requestsHeaders['X-Admin-Password'] = adminPassword;
    }
    const requestsResponse = await fetch(makeApiUrl('/api/requests'), { headers: requestsHeaders });
    const requestsData = await parseJson(requestsResponse);
    if (!requestsResponse.ok) throw new Error(requestsData.message || 'The request could not be completed.');
    const requestsResult = requestsData.inquiries || [];
    requests = requestsResult;
    renderRequests();
    loadOwnerOptions();
    loadProducts();
  } catch (error) {
    setStatus(loginStatus, error.message);
    clearStudioSession();
    loginPanel.hidden = false;
    studio.hidden = true;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const emailInput = loginForm.elements['admin-username'].value.trim();
  const passwordInput = loginForm.elements['admin-password'].value;
  loginForm.querySelector('button').disabled = true;
  setStatus(loginStatus, '');
  try {
    const response = await fetch(makeApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password: passwordInput })
    });
    const result = await parseJson(response);
    if (response.ok && result.token) {
      const permissions = Array.isArray(result.user?.permissions) ? result.user.permissions : [];
      if (!permissions.includes('content:read')) {
        setStatus(loginStatus, `Signed in, but the "${result.user?.role || 'unknown'}" role has no studio access.`);
        return;
      }

      adminToken = result.token;
      sessionStorage.setItem(adminTokenStorageKey, adminToken);
      storeStudioSession(result.user);
      loginPanel.hidden = true;
      studio.hidden = false;
      renderStudioRole();
      await loadItems();
      return;
    }

    // Token login failed — fall back to the legacy admin header credentials.
    adminUsername = emailInput;
    adminPassword = passwordInput;
    sessionStorage.setItem(adminUsernameStorageKey, adminUsername);
    sessionStorage.setItem(adminPasswordStorageKey, adminPassword);
    storeStudioSession({ role: 'admin' });
    loginPanel.hidden = true;
    studio.hidden = false;
    renderStudioRole();
    await loadItems();
  } catch (error) {
    setStatus(loginStatus, error.message || 'Login failed.');
    clearStudioSession();
  } finally {
    loginForm.querySelector('button').disabled = false;
  }
});

contentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = contentForm.querySelector('button[type="submit"]');
  const payload = { title: contentForm.elements.title.value, slug: contentForm.elements.slug.value, status: contentForm.elements.status.value, body: contentForm.elements.body.value };
  if (!contentEditingId && ownerSelect && ownerField && !ownerField.hidden && ownerSelect.value) {
    payload.createdBy = ownerSelect.value;
  }
  button.disabled = true;
  setStatus(editorStatus, '');
  try {
    const result = await request(contentEditingId ? `/${contentEditingId}` : '', { method: contentEditingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    const savedItem = result.item;
    items = contentEditingId ? items.map((item) => item.id === savedItem.id ? savedItem : item) : [savedItem, ...items];
    openContentEditor(savedItem.id);
    setStatus(editorStatus, 'Content saved.', false);
  } catch (error) {
    setStatus(editorStatus, error.message);
  } finally {
    button.disabled = false;
  }
});

async function deleteContentItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item || !window.confirm(`Delete “${item.title}”?`)) return;
  const selectedDeleteButton = contentItems.querySelector(`[data-delete-id="${item.id}"]`);
  if (selectedDeleteButton) selectedDeleteButton.disabled = true;
  try {
    await request(`/${item.id}`, { method: 'DELETE' });
    items = items.filter((entry) => entry.id !== item.id);
    if (contentEditingId === item.id) {
      contentEditingId = null;
      editorEmpty.hidden = false;
      contentForm.hidden = true;
    }
    renderItems();
  } catch (error) {
    setStatus(editorStatus, error.message);
  } finally {
    if (selectedDeleteButton) selectedDeleteButton.disabled = false;
  }
}

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = requestForm.querySelector('button[type="submit"]');
  const payload = {
    name: requestForm.elements.name.value,
    email: requestForm.elements.email.value,
    subject: requestForm.elements.subject.value,
    message: requestForm.elements.message.value,
    status: requestForm.elements.status.value
  };
  button.disabled = true;
  setStatus(editorStatus, '');
  try {
    const result = await request(editingId ? `/${editingId}` : '', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    const savedItem = result.inquiry || result.item;
    if (editingId) {
      requests = requests.map((item) => item.id === savedItem.id ? savedItem : item);
    } else {
      requests.unshift(savedItem);
    }
    openRequestEditor(savedItem.id);
    setStatus(editorStatus, 'Request saved.', false);
  } catch (error) {
    setStatus(editorStatus, error.message);
  } finally {
    button.disabled = false;
  }
});

async function deleteRequestItem(id) {
  const item = requests.find((entry) => entry.id === id);
  if (!item || !window.confirm(`Delete request from ${item.name}?`)) return;
  const selectedDeleteButton = requestItems.querySelector(`[data-delete-id="${item.id}"]`);
  if (selectedDeleteButton) selectedDeleteButton.disabled = true;
  try {
    await request(`/${item.id}`, { method: 'DELETE' });
    requests = requests.filter((entry) => entry.id !== item.id);
    if (editingId === item.id) {
      editingId = null;
      editorEmpty.hidden = false;
      requestForm.hidden = true;
    }
    renderRequests();
  } catch (error) {
    setStatus(editorStatus, error.message);
  } finally {
    if (selectedDeleteButton) selectedDeleteButton.disabled = false;
  }
}

deleteButton.addEventListener('click', () => deleteContentItem(contentEditingId));

/* ---------- Shop catalogue (every item lives in MongoDB) ---------- */

/** The shop manager only renders for roles that hold `products:read`. */
async function loadProducts() {
  if (!studioShop) return;
  if (!can('products:read')) {
    studioShop.hidden = true;
    return;
  }
  try {
    const result = await fetchJson('/api/products?scope=all&limit=100');
    products = result.products || [];
    studioShop.hidden = false;
    renderProducts();
  } catch {
    // A role without `products:read` never gets to see the shop manager.
    studioShop.hidden = true;
  }
}

function renderProducts() {
  if (!productItems) return;
  productCount.textContent = `${products.length} ${products.length === 1 ? 'item' : 'items'}`;
  if (newProductBtn) newProductBtn.hidden = !can('products:create');

  if (!products.length) {
    productItems.innerHTML = '<p class="empty-state">No shop items yet. Start with a new item.</p>';
    return;
  }

  productItems.innerHTML = products.map((item) => {
    const deleteControl = can('products:delete')
      ? `<button class="content-item-delete" data-product-delete="${escapeHtml(item.id)}" type="button">Delete</button>`
      : '';
    return `<div class="content-item ${item.id === productEditingId ? 'is-active' : ''}"><button class="content-item-select" data-product-select="${escapeHtml(item.id)}" type="button"><span class="item-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span><strong>${escapeHtml(item.name)}</strong><small>/${escapeHtml(item.id)} · ${currency.format(Number(item.price) || 0)}</small></button>${deleteControl}</div>`;
  }).join('');

  productItems.querySelectorAll('[data-product-select]').forEach((button) => button.addEventListener('click', () => openProductEditor(button.dataset.productSelect)));
  productItems.querySelectorAll('[data-product-delete]').forEach((button) => button.addEventListener('click', () => deleteProductItem(button.dataset.productDelete)));
}

function openProductEditor(id = null) {
  productEditingId = id;
  const item = products.find((entry) => entry.id === id);
  const editable = item ? can('products:update') : can('products:create');

  productEditorEmpty.hidden = true;
  productForm.hidden = false;
  productForm.reset();
  productForm.elements.updatedAt.value = item ? new Date(item.updatedAt).toLocaleString() : 'Not saved yet';
  productForm.elements.name.value = item?.name || '';
  productForm.elements.slug.value = item?.id || '';
  productForm.elements.category.value = item?.category || '';
  productForm.elements.price.value = item?.price ?? '';
  productForm.elements.status.value = item?.status || 'draft';
  productForm.elements.tone.value = item?.tone || 'cobalt';
  productForm.elements.badge.value = item?.badge || '';
  productForm.elements.glyph.value = item?.glyph || '';
  productForm.elements.image.value = item?.image || '';
  productForm.elements.blurb.value = item?.blurb || '';
  productForm.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((field) => {
    field.disabled = !editable;
  });
  productEditorMode.textContent = item ? (editable ? 'Edit shop item' : 'Read-only shop item') : 'New shop item';
  deleteProductBtn.hidden = !(item && can('products:delete'));
  setStatus(productStatus, editable ? '' : 'Your role can view shop items but not modify them.', !editable);
  renderProducts();
}

async function deleteProductItem(id) {
  const item = products.find((entry) => entry.id === id);
  if (!item || !window.confirm(`Delete “${item.name}” from the shop?`)) return;
  const confirmButton = productItems.querySelector(`[data-product-delete="${item.id}"]`);
  if (confirmButton) confirmButton.disabled = true;
  try {
    await fetchJson(`/api/products/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    products = products.filter((entry) => entry.id !== item.id);
    if (productEditingId === item.id) {
      productEditingId = null;
      productEditorEmpty.hidden = false;
      productForm.hidden = true;
    }
    renderProducts();
  } catch (error) {
    setStatus(productStatus, error.message);
  } finally {
    if (confirmButton) confirmButton.disabled = false;
  }
}

productForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = productForm.querySelector('button[type="submit"]');
  const payload = {
    id: productForm.elements.slug.value.trim(),
    name: productForm.elements.name.value.trim(),
    category: productForm.elements.category.value.trim(),
    price: Number(productForm.elements.price.value),
    blurb: productForm.elements.blurb.value.trim(),
    status: productForm.elements.status.value,
    tone: productForm.elements.tone.value,
    badge: productForm.elements.badge.value.trim(),
    glyph: productForm.elements.glyph.value.trim(),
    image: productForm.elements.image.value.trim()
  };
  const previousId = productEditingId;
  button.disabled = true;
  setStatus(productStatus, '');
  try {
    const result = await fetchJson(
      `/api/products${previousId ? `/${encodeURIComponent(previousId)}` : ''}`,
      { method: previousId ? 'PATCH' : 'POST', body: JSON.stringify(payload) }
    );
    const saved = result.product;
    products = previousId
      ? products.map((entry) => (entry.id === previousId ? saved : entry))
      : [saved, ...products];
    openProductEditor(saved.id);
    setStatus(productStatus, 'Shop item saved. Customers see it as soon as its status is Published.', false);
  } catch (error) {
    setStatus(productStatus, error.message);
  } finally {
    button.disabled = false;
  }
});

newProductBtn?.addEventListener('click', () => openProductEditor(null));
deleteProductBtn?.addEventListener('click', () => deleteProductItem(productEditingId));
document.querySelector('#product-cancel')?.addEventListener('click', () => {
  productEditingId = null;
  productEditorEmpty.hidden = false;
  productForm.hidden = true;
  renderProducts();
});
document.querySelector('#product-logout')?.addEventListener('click', () => {
  clearStudioSession();
  window.location.reload();
});

const newContentBtn = document.querySelector('#new-content');
newContentBtn?.addEventListener('click', () => openContentEditor(null));

newRequestBtn.addEventListener('click', () => openRequestEditor());
document.querySelector('#cancel-edit').addEventListener('click', () => {
  contentEditingId = null;
  editingId = null;
  renderItems();
  renderRequests();
  editorEmpty.hidden = false;
  contentForm.hidden = true;
  requestForm.hidden = true;
});
document.querySelector('#logout').addEventListener('click', () => {
  clearStudioSession();
  window.location.reload();
});

/** Re-check the stored token so role/permission changes apply between visits. */
async function refreshStudioSession() {
  try {
    const response = await fetch(makeApiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const result = await parseJson(response);
    if (!response.ok || !result.user) {
      throw new Error(result.message || 'Your studio session has expired. Please sign in again.');
    }
    if (!Array.isArray(result.user.permissions) || !result.user.permissions.includes('content:read')) {
      throw new Error(`The "${result.user.role}" role cannot open the studio.`);
    }
    storeStudioSession(result.user);
    return true;
  } catch (error) {
    clearStudioSession();
    setStatus(loginStatus, error.message);
    return false;
  }
}

if (adminToken || (adminUsername && adminPassword)) {
  const canEnterStudio = adminToken ? await refreshStudioSession() : true;
  if (canEnterStudio) {
    loginPanel.hidden = true;
    studio.hidden = false;
    renderStudioRole();
    loadItems();
  } else {
    loginPanel.hidden = false;
    studio.hidden = true;
  }
}