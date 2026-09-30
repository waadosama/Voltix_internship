import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/user.js';
import { hashPassword } from '../middleware/auth.js';
import { ENV_ADMIN_ID, requirePermission } from '../middleware/rbac.js';
import { isKnownRole, permissionsForRole, ROLES, ROLE_ADMIN, ROLE_PERMISSIONS } from '../routes/permissions.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function serializeUser(user) {
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: permissionsForRole(user.role),
    phone: user.phone || '',
    company: user.company || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function roleCatalogue() {
  return ROLES.map((role) => ({ role, permissions: ROLE_PERMISSIONS[role] }));
}

export const usersRouter = Router();

// List every account together with the permissions its role grants.
usersRouter.get('/', requirePermission('users:read'), async (_request, response) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: 1 }).lean();
    return response.json({ users: users.map(serializeUser), roles: roleCatalogue() });
  } catch (error) {
    console.error('Failed to load users:', error);
    return response.status(500).json({ message: 'Users could not be loaded.' });
  }
});

// Admins create staff/client accounts (public /api/auth/register stays client-only).
usersRouter.post('/', requirePermission('users:create'), async (request, response) => {
  const name = text(request.body?.name);
  const email = text(request.body?.email).toLowerCase();
  const password = request.body?.password;
  const role = text(request.body?.role) || 'client';
  const errors = [];

  if (!name) errors.push('Name is required.');
  if (!email) errors.push('Email is required.');
  else if (!emailPattern.test(email)) errors.push('Please enter a valid email.');
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }
  if (!isKnownRole(role)) errors.push(`Role must be one of: ${ROLES.join(', ')}.`);

  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(' ') });
  }

  try {
    if (await User.findOne({ email })) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, password: hashPassword(password), role });
    return response.status(201).json({ message: 'User created.', user: serializeUser(user) });
  } catch (error) {
    console.error('Failed to create user:', error);
    return response.status(500).json({ message: 'User could not be created.' });
  }
});

// Change an account's role — this is what turns a client into an employee.
usersRouter.patch('/:id/role', requirePermission('users:manage'), async (request, response) => {
  const role = text(request.body?.role);

  if (!isKnownRole(role)) {
    return response.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}.` });
  }
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ message: 'Invalid user id.' });
  }
  if (String(request.user.id) === request.params.id && role !== ROLE_ADMIN) {
    return response.status(400).json({ message: 'You cannot change your own role.' });
  }

  try {
    const user = await User.findById(request.params.id);
    if (!user) return response.status(404).json({ message: 'User not found.' });

    user.role = role;
    await user.save();

    return response.json({ message: `Role updated to "${role}".`, user: serializeUser(user) });
  } catch (error) {
    console.error('Failed to update role:', error);
    return response.status(500).json({ message: 'Role could not be updated.' });
  }
});

usersRouter.delete('/:id', requirePermission('users:manage'), async (request, response) => {
  if (request.params.id === ENV_ADMIN_ID || !mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ message: 'This account cannot be deleted.' });
  }
  if (String(request.user.id) === request.params.id) {
    return response.status(400).json({ message: 'You cannot delete your own account.' });
  }

  try {
    const user = await User.findById(request.params.id);
    if (!user) return response.status(404).json({ message: 'User not found.' });

    if (user.role === ROLE_ADMIN) {
      const otherAdmins = await User.countDocuments({ role: ROLE_ADMIN, _id: { $ne: user._id } });
      if (otherAdmins === 0) {
        return response.status(400).json({ message: 'Cannot remove the last administrator.' });
      }
    }

    await user.deleteOne();
    return response.json({ message: 'User deleted.' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return response.status(500).json({ message: 'User could not be deleted.' });
  }
});
