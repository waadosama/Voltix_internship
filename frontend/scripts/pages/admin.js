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
const tokenStorageKey = 'idea-house-admin-token';
const usernameStorageKey = 'idea-house-admin-username';
const passwordStorageKey = 'idea-house-admin-password';
let adminToken = sessionStorage.getItem(tokenStorageKey) || '';
let adminUsername = sessionStorage.getItem(usernameStorageKey) || '';
let adminPassword = sessionStorage.getItem(passwordStorageKey) || '';
let items = [];
let editingId = null;

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
  contentItems.innerHTML = items.map((item) => `<div class="content-item ${item.id === editingId ? 'is-active' : ''}"><button class="content-item-select" data-id="${item.id}" type="button"><span class="item-status ${item.status}">${item.status}</span><strong>${escapeHtml(item.title)}</strong><small>/${escapeHtml(item.slug)}</small></button><button class="content-item-delete" data-delete-id="${item.id}" type="button">Delete</button></div>`).join('');
  contentItems.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.id)));
  contentItems.querySelectorAll('[data-delete-id]').forEach((button) => button.addEventListener('click', () => deleteItem(button.dataset.deleteId)));
}

function openEditor(id = null) {
  editingId = id;
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

async function loadItems() {
  try {
    items = (await request()).items;
    renderItems();
  } catch (error) {
    setStatus(loginStatus, error.message);
    sessionStorage.removeItem(tokenStorageKey);
    sessionStorage.removeItem(usernameStorageKey);
    sessionStorage.removeItem(passwordStorageKey);
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
    // Attempt JWT login first
    const response = await fetch(makeApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password: passwordInput })
    });
    const result = await parseJson(response);
    if (response.ok && result.token && result.user?.role === 'admin') {
      adminToken = result.token;
      sessionStorage.setItem(tokenStorageKey, adminToken);
      loginPanel.hidden = true;
      studio.hidden = false;
      await loadItems();
      return;
    }

    // Fallback attempt with legacy credentials if standard login returns unauthenticated/unauthorized
    adminUsername = emailInput;
    adminPassword = passwordInput;
    sessionStorage.setItem(usernameStorageKey, adminUsername);
    sessionStorage.setItem(passwordStorageKey, adminPassword);
    loginPanel.hidden = true;
    studio.hidden = false;
    await loadItems();
  } catch (error) {
    setStatus(loginStatus, error.message || 'Login failed.');
    sessionStorage.removeItem(tokenStorageKey);
    sessionStorage.removeItem(usernameStorageKey);
    sessionStorage.removeItem(passwordStorageKey);
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
    const result = await request(editingId ? `/${editingId}` : '', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    const savedItem = result.item;
    items = editingId ? items.map((item) => item.id === savedItem.id ? savedItem : item) : [savedItem, ...items];
    openEditor(savedItem.id);
    setStatus(editorStatus, 'Content saved.', false);
  } catch (error) {
    setStatus(editorStatus, error.message);
  } finally {
    button.disabled = false;
  }
});

async function deleteItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item || !window.confirm(`Delete “${item.title}”?`)) return;
  const selectedDeleteButton = contentItems.querySelector(`[data-delete-id="${item.id}"]`);
  if (selectedDeleteButton) selectedDeleteButton.disabled = true;
  try {
    await request(`/${item.id}`, { method: 'DELETE' });
    items = items.filter((entry) => entry.id !== item.id);
    if (editingId === item.id) {
      editingId = null;
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

deleteButton.addEventListener('click', () => deleteItem(editingId));

document.querySelector('#new-content').addEventListener('click', () => openEditor());
document.querySelector('#cancel-edit').addEventListener('click', () => { editingId = null; renderItems(); editorEmpty.hidden = false; contentForm.hidden = true; });
document.querySelector('#logout').addEventListener('click', () => {
  sessionStorage.removeItem(tokenStorageKey);
  sessionStorage.removeItem(usernameStorageKey);
  sessionStorage.removeItem(passwordStorageKey);
  window.location.reload();
});

if (adminToken || (adminUsername && adminPassword)) {
  loginPanel.hidden = true;
  studio.hidden = false;
  loadItems();
}
