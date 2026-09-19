import { Router } from 'express';
import { User } from '../models/user.js';
import { hashPassword, matchesConfiguredAdmin, verifyPassword, signToken, requireAuth } from '../middleware/auth.js';

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
    phone: user.phone || '',
    company: user.company || '',
    bio: user.bio || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export const authRouter = Router();

authRouter.post('/register', async (request, response) => {
  const name = text(request.body?.name);
  const email = text(request.body?.email).toLowerCase();
  const password = request.body?.password;
  // Public registration is strictly restricted to client accounts
  const role = 'client';
  const errors = [];

  if (!name) errors.push('Name is required.');
  if (!email) errors.push('Email is required.');
  else if (!emailPattern.test(email)) errors.push('Please enter a valid email.');
  if (!password || typeof password !== 'string' || password.length < 6) errors.push('Password must be at least 6 characters long.');

  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(' ') });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = hashPassword(password);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

    return response.status(201).json({
      message: 'Account registered successfully.',
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Registration failed:', error);
    return response.status(500).json({ message: 'Could not register account. Please try again.' });
  }
});

authRouter.post('/login', async (request, response) => {
  const email = text(request.body?.email).toLowerCase();
  const password = request.body?.password;

  if (!email || !password) {
    return response.status(400).json({ message: 'Email and password are required.' });
  }

  // Check env admin fallback
  if (matchesConfiguredAdmin(email, password)) {
    const adminEmail = process.env.ADMIN_USERNAME.trim();
    const token = signToken({ id: 'admin-env-id', email: adminEmail, role: 'admin', name: 'Admin' });
    return response.json({
      token,
      user: { id: 'admin-env-id', email: adminEmail, name: 'Admin', role: 'admin' }
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !verifyPassword(password, user.password)) {
      return response.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

    return response.json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Login failed:', error);
    return response.status(500).json({ message: 'Could not log in. Please try again.' });
  }
});

authRouter.get('/me', requireAuth, async (request, response) => {
  try {
    if (request.user.id === 'admin-env-id') {
      return response.json({ user: request.user });
    }

    const user = await User.findById(request.user.id);
    if (!user) {
      return response.status(404).json({ message: 'User not found.' });
    }

    return response.json({ user: serializeUser(user) });
  } catch (error) {
    console.error('Get profile failed:', error);
    return response.status(500).json({ message: 'Could not retrieve user profile.' });
  }
});

authRouter.patch('/me', requireAuth, async (request, response) => {
  try {
    if (request.user.id === 'admin-env-id') {
      return response.status(400).json({
        message: 'This environment admin account is not stored in the database, so the profile cannot be updated.'
      });
    }

    const name = text(request.body?.name);
    const phone = text(request.body?.phone);
    const company = text(request.body?.company);
    const bio = text(request.body?.bio);
    const currentPassword = request.body?.currentPassword;
    const newPassword = request.body?.newPassword;
    const errors = [];

    if (!name) errors.push('Name is required.');
    if (phone.length > 40) errors.push('Phone must be 40 characters or fewer.');
    if (company.length > 120) errors.push('Company must be 120 characters or fewer.');
    if (bio.length > 500) errors.push('Bio must be 500 characters or fewer.');

    if (newPassword) {
      if (!currentPassword || typeof currentPassword !== 'string') {
        errors.push('Current password is required to set a new password.');
      } else if (typeof newPassword !== 'string' || newPassword.length < 6) {
        errors.push('New password must be at least 6 characters long.');
      }
    }

    if (errors.length > 0) {
      return response.status(400).json({ message: errors.join(' ') });
    }

    const user = await User.findById(request.user.id);
    if (!user) {
      return response.status(404).json({ message: 'User not found.' });
    }

    if (newPassword) {
      if (!verifyPassword(currentPassword, user.password)) {
        return response.status(400).json({ message: 'Current password is incorrect.' });
      }
      user.password = hashPassword(newPassword);
    }

    user.name = name;
    user.phone = phone;
    user.company = company;
    user.bio = bio;
    await user.save();

    return response.json({
      message: 'Profile updated successfully.',
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Update profile failed:', error);
    return response.status(500).json({ message: 'Could not update profile. Please try again.' });
  }
});
