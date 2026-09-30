/**
 * RBAC middleware — the single place where the backend decides whether the
 * caller is allowed to run a protected operation.
 *
 * Flow of `requirePermission(...codes)`:
 *   1. Legacy admin studio headers (`X-Admin-Username` / `X-Admin-Password`)
 *      are accepted as a full admin actor (backwards compatible).
 *   2. Otherwise a Bearer JWT must be present and valid (401 otherwise).
 *   3. The role is re-read from the database (the source of truth), so a role
 *      that was changed or revoked applies immediately — the JWT alone can
 *      not grant privileges it no longer has (401 if the account is gone).
 *   4. The role's permission list is checked against the required
 *      permissions (403 with details if anything is missing).
 *
 * Route handlers then receive:
 *   request.user   — { id, name, email, role, ...tokenClaims }
 *   request.rbac   — { role, permissions, source }
 */

import { extractToken, matchesConfiguredAdmin, verifyToken } from './auth.js';
import { User } from '../models/user.js';
import {
  missingPermissions,
  permissionsForRole,
  ROLE_ADMIN
} from '../routes/permissions.js';

/** Pseudo id used for the env-only admin account (not stored in the DB). */
export const ENV_ADMIN_ID = 'admin-env-id';

function headerAdminActor(request) {
  const username = request.get('X-Admin-Username');
  const password = request.get('X-Admin-Password');
  if (!matchesConfiguredAdmin(username, password)) return null;
  return {
    id: ENV_ADMIN_ID,
    name: 'Legacy Admin',
    email: process.env.ADMIN_USERNAME?.trim() || '',
    role: ROLE_ADMIN
  };
}

/**
 * Resolve the authenticated actor for this request.
 * @returns {Promise<object|null>} actor, or null when no/invalid credentials.
 */
export async function resolveActor(request) {
  const headerActor = headerAdminActor(request);
  if (headerActor) return headerActor;

  const decoded = verifyToken(extractToken(request));
  if (!decoded) return null;

  if (decoded.id === ENV_ADMIN_ID) {
    return { ...decoded, role: ROLE_ADMIN };
  }

  if (!decoded.id) return null;

  const user = await User.findById(decoded.id).select('name email role').lean();
  if (!user) return null; // account deleted since the token was issued

  return { ...decoded, id: String(user._id), name: user.name, email: user.email, role: user.role };
}

/**
 * Authorization guard. Usage: `router.get('/', requirePermission('content:read'), handler)`
 * Every listed permission is required (AND).
 */
export function requirePermission(...required) {
  return async (request, response, next) => {
    try {
      const actor = await resolveActor(request);

      if (!actor) {
        const hasToken = Boolean(extractToken(request)) || Boolean(headerAdminActor(request));
        return response.status(401).json({
          code: 'unauthenticated',
          message: hasToken
            ? 'Invalid or expired token. Please sign in again.'
            : 'Authentication required. Please sign in.'
        });
      }

      const permissions = permissionsForRole(actor.role);
      const missing = missingPermissions(actor.role, required);

      request.user = actor;
      request.rbac = { role: actor.role, permissions, source: actor.id === ENV_ADMIN_ID ? 'env-admin' : 'token' };

      if (missing.length > 0) {
        return response.status(403).json({
          code: 'forbidden',
          message: `Access denied. Role "${actor.role}" is missing the ${missing.map((p) => `"${p}"`).join(', ')} permission.`,
          role: actor.role,
          requiredPermissions: required,
          missingPermissions: missing,
          permissions
        });
      }

      return next();
    } catch (error) {
      console.error('RBAC check failed:', error);
      return response.status(500).json({ message: 'Could not verify permissions. Please try again.' });
    }
  };
}

/** @returns {boolean} whether the resolved actor holds `permission`. */
export function hasPermission(request, permission) {
  const permissions = request.rbac?.permissions || permissionsForRole(request.user?.role);
  return permissions.includes(permission);
}

/**
 * Attaches the actor when credentials are present but does not require them.
 * Used on public reads that may be widened for privileged callers (for
 * example: shop items are public while they are `published`, but
 * `products:read` may also fetch drafts). Anonymous callers continue with
 * `request.user` unset.
 */
export async function attachOptionalActor(request, _response, next) {
  try {
    if (!request.user) {
      const actor = await resolveActor(request);
      if (actor) {
        request.user = actor;
        request.rbac = {
          role: actor.role,
          permissions: permissionsForRole(actor.role),
          source: actor.id === ENV_ADMIN_ID ? 'env-admin' : 'token'
        };
      }
    }
  } catch (error) {
    console.error('Optional actor resolution failed:', error);
  }
  return next();
}

/** @returns {boolean} whether `actor` created/owns `record`. */
export function ownsRecord(actor, record) {
  if (!actor || !record) return false;
  const ownerId = record.createdBy ?? record.ownerId ?? record.userId;
  return Boolean(ownerId) && String(ownerId) === String(actor.id);
}

/**
 * Record-level check used on top of `content:update`:
 * admins may modify any record, other roles only records they own.
 */
export function canModifyRecord(actor, record) {
  if (!actor) return false;
  if (actor.role === ROLE_ADMIN) return true;
  return ownsRecord(actor, record);
}
