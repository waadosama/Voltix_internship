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

export function matchesConfiguredAdmin(username, password) {
  const configuredUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  const suppliedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const suppliedPassword = typeof password === 'string' ? password.trim() : '';

  return Boolean(
    configuredUsername &&
    configuredPassword &&
    suppliedUsername === configuredUsername &&
    suppliedPassword === configuredPassword
  );
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

export function requireAdmin(request, response, next) {
  const suppliedUsername = request.get('X-Admin-Username');
  const suppliedPassword = request.get('X-Admin-Password');

  if (matchesConfiguredAdmin(suppliedUsername, suppliedPassword)) {
    request.user = { role: 'admin', email: process.env.ADMIN_USERNAME.trim(), name: 'Legacy Admin' };
    return next();
  }

  return requireAuth(request, response, () => {
    if (request.user?.role !== 'admin') {
      return response.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    return next();
  });
}

export function requireClient(request, response, next) {
  return requireAuth(request, response, () => {
    if (request.user?.role !== 'client' && request.user?.role !== 'admin') {
      return response.status(403).json({ message: 'Access denied. Client access required.' });
    }
    return next();
  });
}
