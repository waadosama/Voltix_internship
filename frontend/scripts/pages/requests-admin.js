import { apiUrl, parseJson } from '../lib/api.js';
import { escapeHtml } from '../lib/html.js';

const loginPanel = document.querySelector('#login-panel');
const studio = document.querySelector('#studio');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const requestItems = document.querySelector('#request-items');
const requestCount = document.querySelector('#request-count');
const editorEmpty = document.querySelector('#editor-empty');
const editorMode = document.querySelector('#editor-mode');
const editorStatus = document.querySelector('#editor-status');
const deleteButton = document.querySelector('#delete-request');
let requestItemsData = [];
let editingId = null;
let adminToken = sessionStorage.getItem('idea-house-admin-token') || '';
let adminUsername = sessionStorage.getItem('idea-house-admin-username') || '';
let adminPassword = sessionStorage.getItem('idea-house-admin-password') || '';

function apiUrl(path = '') {
  return `/api/requests${path}`;
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
  requestCount.textContent = `${requestItemsData.length} ${requestItemsData.length === 1 ? 'item' : 'items'}`;
  if (!requestItemsData.length) {
    requestItems.innerHTML = '<p class="empty-state">No requests yet. Start by having customers submit requests.</p>';
    return;
  }
  requestItems.innerHTML = requestItemsData.map((item) => `
    <div class="request-item ${item.id === editingId ? 'is-active' : ''}">
      <button class="request-item-select" data-id="${item.id}" type="button">
        <span class="item-status ${item.status}">${item.status}</span>
        <strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.email)})
        <small>/ ${escapeHtml(item.subject)}</small>
      </button>
      <button class="request-item-delete" data-delete-id="${item.id}" type="button">Delete</button>
    </div>
  `).join('');

  requestItems.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.id)));
  requestItems.querySelectorAll('[data-delete-id]').forEach((button) => button.addEventListener('click', () => deleteItem(button.dataset.deleteId)));
}

function openEditor(id = null) {
  editingId = id;
  const item = requestItemsData.find((entry) => entry.id === id);
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
  renderItems();
}

async function loadItems() {
  try {
    const result = await request();
    requestItemsData = result.inquiries || [];
    renderItems();
  } catch (error) {
    setStatus(loginStatus, error.message);
    sessionStorage.removeItem('idea-house-admin-token');
    sessionStorage.removeItem('idea-house-admin-username');
    sessionStorage.removeItem('idea-house-admin-password');
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
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput, password: passwordInput })
    });
    const result = await parseJson(response);
    if (response.ok && result.token && result.user?.role === 'admin') {
      adminToken = result.token;
      sessionStorage.setItem('idea-house-admin-token', adminToken);
      loginPanel.hidden = true;
      studio.hidden = false;
      await loadItems();
      return;
    }

    adminUsername = emailInput;
    adminPassword = passwordInput;
    sessionStorage.setItem('idea-house-admin-username', adminUsername);
    sessionStorage.setItem('idea-house-admin-password', adminPassword);
    loginPanel.hidden = true;
    studio.hidden = false;
    await loadItems();
  } catch (error) {
    setStatus(loginStatus, error.message || 'Login failed.');
    sessionStorage.removeItem('idea-house-admin-token');
    sessionStorage.removeItem('idea-house-admin-username');
    sessionStorage.removeItem('idea-house-admin-password');
    adminToken = '';
    adminUsername = '';
    adminPassword = '';
  } finally {
    loginForm.querySelector('button').disabled = false;
  }
});

const requestForm = document.querySelector('#request-form');
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
    const result = await editingId ? `/${editingId}` : '', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    const savedItem = result.inquiry || result.item;
    if (editingId) {
      requestItemsData = requestItemsData.map((item) => item.id === savedItem.id ? savedItem : item);
    } else {
      requestItemsData.unshift(savedItem);
    }
    openEditor(savedItem.id);
    setStatus(editorStatus, 'Request saved.', false);
  } catch (error) {
    setStatus(editorStatus, error.message);
  } finally {
    button.disabled = false;
  }
});

async function deleteItem(id) {
  const item = requestItemsData.find((entry) => entry.id === id);
  if (!item || !window.confirm(`Delete request from ${item.name}?`)) return;
  const selectedDeleteButton = requestItems.querySelector(`[data-delete-id="${item.id}"]`);
  if (selectedDeleteButton) selectedDeleteButton.disabled = true;
  try {
    await request(`/${item.id}`, { method: 'DELETE' });
    requestItemsData = requestItemsData.filter((entry) => entry.id !== item.id);
    if (editingId === item.id) {
      editingId = null;
      editorEmpty.hidden = false;
      requestForm.hidden = true;
    }
    renderItems();
  } catch (error) {
    setStatus(editorStatus, error.message);
  } finally {
    if (selectedDeleteButton) selectedDeleteButton.disabled = false;
  }
}

deleteButton.addEventListener('click', () => deleteItem(editingId));
document.querySelector('#new-request').addEventListener('click', () => openEditor());
document.querySelector('#cancel-edit').addEventListener('click', () => {
  editingId = null;
  renderItems();
  editorEmpty.hidden = false;
  requestForm.hidden = true;
});
document.querySelector('#logout').addEventListener('click', () => {
  sessionStorage.removeItem('idea-house-admin-token');
  sessionStorage.removeItem('idea-house-admin-username');
  sessionStorage.removeItem('idea-house-admin-password');
  window.location.reload();
});

if (adminToken || (adminUsername && adminPassword)) {
  loginPanel.hidden = true;
  studio.hidden = false;
  loadItems();
}