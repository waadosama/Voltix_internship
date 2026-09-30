/**
 * Role / permission catalogue for Idea House (RBAC).
 *
 * This module is intentionally pure (no Express, no database) so it can be
 * unit tested with `node --test` and imported from anywhere in the backend.
 *
 * Roles:
 *   admin    — full control: manage content, requests, shop items and user
 *              accounts.
 *   employee — regular staff: view studio content and customer requests, and
 *              update records (content items they own), but never create or
 *              delete content, never manage the shop catalogue, and never
 *              touch user accounts.
 *   client   — customers who only manage their own profile and use the chatbot.
 *
 * Permission naming convention: `<resource>:<action>` (for example
 * `content:delete`). Authorization is decided by permission, never by role
 * string comparison in route handlers.
 */

export const ROLE_ADMIN = 'admin';
export const ROLE_EMPLOYEE = 'employee';
export const ROLE_CLIENT = 'client';

export const ROLES = [ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_CLIENT];

export const PERMISSIONS = {
  'content:read': 'View studio content items',
  'content:create': 'Create studio content items',
  'content:update': 'Edit studio content items',
  'content:delete': 'Delete studio content items',
  'requests:read': 'View customer requests',
  'requests:update': 'Update customer request statuses',
  'products:read': 'View shop items (including drafts)',
  'products:create': 'Create shop items',
  'products:update': 'Edit shop items',
  'products:delete': 'Delete shop items',
  'users:read': 'View user accounts',
  'users:create': 'Create user accounts',
  'users:manage': 'Change user roles and remove user accounts',
  'profile:read': 'View own profile',
  'profile:update': 'Edit own profile',
  'chat:use': 'Use the chatbot'
};

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

/** Clients: only their own account data. */
const CLIENT_PERMISSIONS = [
  'profile:read',
  'profile:update',
  'chat:use'
];

/**
 * Regular employees: everything a client has plus read/update on studio
 * records — but no create, delete, or user administration.
 */
const EMPLOYEE_PERMISSIONS = [
  ...CLIENT_PERMISSIONS,
  'content:read',
  'content:update',
  'requests:read',
  'requests:update'
];

const ADMIN_PERMISSIONS = [...ALL_PERMISSIONS];

export const ROLE_PERMISSIONS = {
  [ROLE_ADMIN]: ADMIN_PERMISSIONS,
  [ROLE_EMPLOYEE]: EMPLOYEE_PERMISSIONS,
  [ROLE_CLIENT]: CLIENT_PERMISSIONS
};

/** @returns {boolean} true when the role exists in the catalogue. */
export function isKnownRole(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_PERMISSIONS, role);
}

/**
 * Permissions granted to a role. Unknown/absent roles get an empty list —
 * authorization is deny-by-default.
 * @returns {string[]}
 */
export function permissionsForRole(role) {
  const granted = ROLE_PERMISSIONS[role];
  return granted ? [...granted] : [];
}

/** @returns {boolean} whether `role` holds `permission`. */
export function roleCan(role, permission) {
  return permissionsForRole(role).includes(permission);
}

/** @returns {boolean} whether `role` holds every listed permission. */
export function roleCanAll(role, required = []) {
  const granted = permissionsForRole(role);
  return required.every((permission) => granted.includes(permission));
}

/** @returns {string[]} the required permissions missing from `role`. */
export function missingPermissions(role, required = []) {
  const granted = permissionsForRole(role);
  return required.filter((permission) => !granted.includes(permission));
}

/** @returns {string|null} human-readable label for a permission code. */
export function describePermission(permission) {
  return PERMISSIONS[permission] || null;
}
