import crypto from 'node:crypto'; //auth
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'idea-house-secret-key-change-in-production';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signToken(payload, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

export function extractToken(request) {
  const authHeader = request.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export function matchesConfiguredCredentials(username, password, usernameVar, passwordVar) {
  const configuredUsername = process.env[usernameVar]?.trim().toLowerCase();
  const configuredPassword = process.env[passwordVar]?.trim();
  const suppliedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const suppliedPassword = typeof password === 'string' ? password.trim() : '';

  return Boolean(
    configuredUsername &&
    configuredPassword &&
    suppliedUsername === configuredUsername &&
    suppliedPassword === configuredPassword
  );
}

export function matchesConfiguredAdmin(username, password) {
  return matchesConfiguredCredentials(username, password, 'ADMIN_USERNAME', 'ADMIN_PASSWORD');
}

/**
 * Environment-only employee account (`EMPLOYEE_USERNAME` / `EMPLOYEE_PASSWORD`
 * in `.env`) — mirrors the env admin fallback, but is resolved to the
 * `employee` role, so it only ever gets `employee` permissions.
 */
export function matchesConfiguredEmployee(username, password) {
  return matchesConfiguredCredentials(username, password, 'EMPLOYEE_USERNAME', 'EMPLOYEE_PASSWORD');
}

export function optionalAuth(request, response, next) {
  const token = extractToken(request);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      request.user = decoded;
    }
  }
  return next();
}

export function requireAuth(request, response, next) {
  const token = extractToken(request);
  if (!token) {
    return response.status(401).json({ message: 'Authentication required. Please sign in.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return response.status(401).json({ message: 'Invalid or expired token. Please sign in again.' });
  }

  request.user = decoded;
  return next();
}

// NOTE: role checks moved to RBAC — use `requirePermission('<resource>:<action>')`
// from `middleware/rbac.js` instead of role string comparisons here.
