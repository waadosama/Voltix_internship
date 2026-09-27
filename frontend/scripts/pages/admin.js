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
const requestForm = document.querySelector('#request-form');
const requestItems = document.querySelector('#request-items');
const requestCount = document.querySelector('#request-count');
const newRequestBtn = document.querySelector('#new-request');
const adminTokenStorageKey = 'idea-house-admin-token';
const adminUsernameStorageKey = 'idea-house-admin-username';
const adminPasswordStorageKey = 'idea-house-admin-password';
let adminToken = sessionStorage.getItem(adminTokenStorageKey) || '';
let adminUsername = sessionStorage.getItem(adminUsernameStorageKey) || '';
let adminPassword = sessionStorage.getItem(adminPasswordStorageKey) || '';
let items = [];
let requests = [];
let editingId = null;
let contentEditingId = null;

function apiUrl(path = '') {
  return makeApiUrl(`/api/content${path}`);
}

function setStatus(element, message, isError = true) {
  element.textContent = message;
  element.classList.toggle('is-error', isError && Boolean(message));
  element.classList.toggle('is-success', !isError && Boolean(message));
}

async function request(path = '', options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }
  if (adminUsername && adminPassword) {
    headers['X-Admin-Username'] = adminUsername;
    headers['X-Admin-Password'] = adminPassword;
  }
  const response = await fetch(apiUrl(path), { ...options, headers });
  const result = await parseJson(response);
  if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
  return result;
}

function renderItems() {
  contentCount.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  if (!items.length) {
    contentItems.innerHTML = '<p class="empty-state">No content yet. Start with a new item.</p>';
    return;
  }
  contentItems.innerHTML = items.map((item) => `<div class="content-item ${item.id === contentEditingId ? 'is-active' : ''}"><button class="content-item-select" data-id="${item.id}" type="button"><span class="item-status ${item.status}">${item.status}</span><strong>${escapeHtml(item.title)}</strong><small>/${escapeHtml(item.slug)}</small></button><button class="content-item-delete" data-delete-id="${item.id}" type="button">Delete</button></div>`).join('');
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
  editorEmpty.hidden = true;
  contentForm.hidden = false;
  contentForm.reset();
  contentForm.elements.updatedAt.value = item ? new Date(item.updatedAt).toLocaleString() : 'Not saved yet';
  contentForm.elements.title.value = item?.title || '';
  contentForm.elements.slug.value = item?.slug || '';
  contentForm.elements.status.value = item?.status || 'draft';
  contentForm.elements.body.value = item?.body || '';
  editorMode.textContent = item ? 'Edit content item' : 'New content item';
  deleteButton.hidden = !item;
  setStatus(editorStatus, '');
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
  } catch (error) {
    setStatus(loginStatus, error.message);
    sessionStorage.removeItem(adminTokenStorageKey);
    sessionStorage.removeItem(adminUsernameStorageKey);
    sessionStorage.removeItem(adminPasswordStorageKey);
    adminToken = '';
    adminUsername = '';
    adminPassword = '';
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
    if (response.ok && result.token && result.user?.role === 'admin') {
      adminToken = result.token;
      sessionStorage.setItem(adminTokenStorageKey, adminToken);
      loginPanel.hidden = true;
      studio.hidden = false;
      await loadItems();
      return;
    }

    adminUsername = emailInput;
    adminPassword = passwordInput;
    sessionStorage.setItem(adminUsernameStorageKey, adminUsername);
    sessionStorage.setItem(adminPasswordStorageKey, adminPassword);
    loginPanel.hidden = true;
    studio.hidden = false;
    await loadItems();
  } catch (error) {
    setStatus(loginStatus, error.message || 'Login failed.');
    sessionStorage.removeItem(adminTokenStorageKey);
    sessionStorage.removeItem(adminUsernameStorageKey);
    sessionStorage.removeItem(adminPasswordStorageKey);
    adminToken = '';
    adminUsername = '';
    adminPassword = '';
  } finally {
    loginForm.querySelector('button').disabled = false;
  }
});

contentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = contentForm.querySelector('button[type="submit"]');
  const payload = { title: contentForm.elements.title.value, slug: contentForm.elements.slug.value, status: contentForm.elements.status.value, body: contentForm.elements.body.value };
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
  sessionStorage.removeItem(adminTokenStorageKey);
  sessionStorage.removeItem(adminUsernameStorageKey);
  sessionStorage.removeItem(adminPasswordStorageKey);
  window.location.reload();
});

if (adminToken || (adminUsername && adminPassword)) {
  loginPanel.hidden = true;
  studio.hidden = false;
  loadItems();
}