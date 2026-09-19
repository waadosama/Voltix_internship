export const CLIENT_TOKEN_KEY = 'idea-house-client-token';
export const CLIENT_USER_KEY = 'idea-house-client-user';

export function getClientToken() {
  return localStorage.getItem(CLIENT_TOKEN_KEY);
}

export function getClientUser() {
  try {
    return JSON.parse(localStorage.getItem(CLIENT_USER_KEY));
  } catch {
    return null;
  }
}

export function setClientSession(token, user) {
  if (token) {
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
  }
}

export function clearClientSession() {
  localStorage.removeItem(CLIENT_TOKEN_KEY);
  localStorage.removeItem(CLIENT_USER_KEY);
}

export function notifyClientAuth(user) {
  window.dispatchEvent(new CustomEvent('client-auth-changed', { detail: { user } }));
}
