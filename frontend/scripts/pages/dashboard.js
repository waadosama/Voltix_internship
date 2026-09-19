import { apiUrl, parseJson } from '../lib/api.js';
import { clearClientSession, CLIENT_USER_KEY, getClientToken, notifyClientAuth } from '../lib/client-auth.js';

const gate = document.querySelector('#dashboard-gate');
const shell = document.querySelector('#dashboard-shell');
const form = document.querySelector('#profile-form');
const statusEl = document.querySelector('#profile-status');
const saveButton = document.querySelector('#save-profile');
const logoutButton = document.querySelector('#dashboard-logout');
const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('.primary-nav');

function getToken() {
  return window.IdeaClientAuth?.getToken?.() || getClientToken();
}

function redirectToSignIn() {
  window.location.replace('/?signin=1');
}

function clearSessionAndRedirect() {
  window.IdeaClientAuth?.logout?.();
  clearClientSession();
  redirectToSignIn();
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', isError && Boolean(message));
  statusEl.classList.toggle('is-success', !isError && Boolean(message));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function displayValue(value) {
  return value && String(value).trim() ? value : '-';
}

function renderUser(user) {
  document.querySelector('#summary-name').textContent = displayValue(user.name);
  document.querySelector('#summary-email').textContent = displayValue(user.email);
  document.querySelector('#summary-role').textContent = displayValue(user.role);
  document.querySelector('#summary-company').textContent = displayValue(user.company);
  document.querySelector('#summary-phone').textContent = displayValue(user.phone);
  document.querySelector('#summary-created').textContent = formatDate(user.createdAt);
  document.querySelector('#summary-updated').textContent = formatDate(user.updatedAt);

  form.elements.name.value = user.name || '';
  form.elements.email.value = user.email || '';
  form.elements.company.value = user.company || '';
  form.elements.phone.value = user.phone || '';
  form.elements.bio.value = user.bio || '';
  form.elements.currentPassword.value = '';
  form.elements.newPassword.value = '';
}

function persistUser(user) {
  localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
  notifyClientAuth(user);
}

async function loadProfile() {
  const token = getToken();
  if (!token) {
    redirectToSignIn();
    return;
  }

  try {
    const response = await fetch(apiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await parseJson(response);

    if (response.status === 401 || response.status === 404) {
      clearSessionAndRedirect();
      return;
    }

    if (!response.ok || !result.user) {
      throw new Error(result.message || 'Could not load your account.');
    }

    persistUser(result.user);
    renderUser(result.user);
    gate.hidden = true;
    shell.hidden = false;
  } catch (error) {
    gate.querySelector('h1').innerHTML = 'Could not open<br /><em>your dashboard.</em>';
    gate.querySelector('.dashboard-copy').textContent = error.message || 'Please sign in again.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = getToken();
  if (!token) {
    redirectToSignIn();
    return;
  }

  saveButton.disabled = true;
  setStatus('');

  const payload = {
    name: form.elements.name.value.trim(),
    company: form.elements.company.value.trim(),
    phone: form.elements.phone.value.trim(),
    bio: form.elements.bio.value.trim()
  };

  const currentPassword = form.elements.currentPassword.value;
  const newPassword = form.elements.newPassword.value;
  if (currentPassword || newPassword) {
    payload.currentPassword = currentPassword;
    payload.newPassword = newPassword;
  }

  try {
    const response = await fetch(apiUrl('/api/auth/me'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const result = await parseJson(response);
    if (!response.ok) {
      throw new Error(result.message || 'Could not update your profile.');
    }

    persistUser(result.user);
    renderUser(result.user);
    setStatus(result.message || 'Profile updated.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    saveButton.disabled = false;
  }
});

window.addEventListener('client-auth-changed', (event) => {
  if (!event.detail?.user && getToken() === null) {
    redirectToSignIn();
  }
});

logoutButton?.addEventListener('click', clearSessionAndRedirect);

menuToggle?.addEventListener('click', () => {
  const isOpen = primaryNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

loadProfile();
