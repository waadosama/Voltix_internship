import { Router } from 'express';
import mongoose from 'mongoose';
import { Content } from '../models/content.js';
import { User } from '../models/user.js';
import { canModifyRecord, ENV_ADMIN_ID, hasPermission, requirePermission } from '../middleware/rbac.js';
import { permissionsForRole } from '../rbac/permissions.js';

const UPDATABLE_FIELDS = ['title', 'slug', 'body', 'status'];

function ownerIdOf(actor) {
  if (!actor || actor.id === ENV_ADMIN_ID) return null;
  return mongoose.isValidObjectId(actor.id) ? actor.id : null;
}

function pickContentFields(item, actor = null) {
  const actorPermissions = actor ? permissionsForRole(actor.role) : [];
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    body: item.body,
    status: item.status,
    updatedAt: item.updatedAt,
    createdBy: item.createdBy ? String(item.createdBy) : null,
    createdByName: item.createdByName || '',
    // Record-level hints for the studio UI (the API still enforces them).
    canUpdate: Boolean(actor) && canModifyRecord(actor, item),
    canDelete: actorPermissions.includes('content:delete')
  };
}

export const contentRouter = Router();

contentRouter.get('/', requirePermission('content:read'), async (request, response) => {
  try {
    const items = await Content.find().sort({ updatedAt: -1 }).lean();
    return response.json({ items: items.map((item) => pickContentFields(item, request.user)) });
  } catch (error) {
    console.error('Failed to load content:', error);
    return response.status(500).json({ message: 'Content could not be loaded.' });
  }
});

contentRouter.post('/', requirePermission('content:create'), async (request, response) => {
  const { title, slug, body, status } = request.body || {};

  if (!title || !slug) {
    return response.status(400).json({ message: 'Title and slug are required.' });
  }

  try {
    // Optional record owner (defaults to the creator). Only admins may hand a
    // record to somebody else; everyone else can only own what they create.
    let ownerId = ownerIdOf(request.user);
    const requestedOwner = typeof request.body?.createdBy === 'string' ? request.body.createdBy.trim() : '';

    if (requestedOwner) {
      if (!mongoose.isValidObjectId(requestedOwner)) {
        return response.status(400).json({ message: 'Invalid owner id.' });
      }
      if (!hasPermission(request, 'users:manage') && requestedOwner !== String(request.user.id)) {
        return response.status(403).json({
          code: 'forbidden',
          message: 'Access denied. Only administrators can assign a record to another user.'
        });
      }
      ownerId = requestedOwner;
    }

    let createdByName = request.user?.name || '';
    if (ownerId && ownerId !== String(request.user.id)) {
      const owner = await User.findById(ownerId).select('name').lean();
      if (!owner) return response.status(400).json({ message: 'Owner user not found.' });
      createdByName = owner.name;
    }

    const item = await Content.create({
      title,
      slug,
      body: body || '',
      status: status || 'draft',
      createdBy: ownerId,
      createdByName
    });
    return response.status(201).json({ item: pickContentFields(item, request.user) });
  } catch (error) {
    console.error('Failed to create content:', error);
    return response.status(500).json({ message: 'Content could not be created.' });
  }
});

contentRouter.get('/:id', requirePermission('content:read'), async (request, response) => {
  try {
    const item = await Content.findById(request.params.id).lean();
    if (!item) return response.status(404).json({ message: 'Content not found.' });
    return response.json({ item: pickContentFields(item, request.user) });
  } catch (error) {
    console.error('Failed to load content:', error);
    return response.status(500).json({ message: 'Content could not be loaded.' });
  }
});

async function updateContentItem(request, response) {
  try {
    const item = await Content.findById(request.params.id).lean();
    if (!item) return response.status(404).json({ message: 'Content not found.' });

    if (!canModifyRecord(request.user, item)) {
      return response.status(403).json({
        code: 'forbidden',
        message: 'Access denied. You can only update content items you created.'
      });
    }

    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (Object.hasOwn(request.body || {}, field)) updates[field] = request.body[field];
    }

    const updated = await Content.findByIdAndUpdate(item._id, updates, {
      new: true,
      runValidators: true
    }).lean();

    return response.json({ item: pickContentFields(updated, request.user) });
  } catch (error) {
    console.error('Failed to update content:', error);
    return response.status(500).json({ message: 'Content could not be updated.' });
  }
}

// PATCH is the documented verb; PUT is accepted too because the studio UI
// sends PUT when saving an existing item.
contentRouter.patch('/:id', requirePermission('content:update'), updateContentItem);
contentRouter.put('/:id', requirePermission('content:update'), updateContentItem);

contentRouter.delete('/:id', requirePermission('content:delete'), async (request, response) => {
  try {
    const item = await Content.findByIdAndDelete(request.params.id);
    if (!item) return response.status(404).json({ message: 'Content not found.' });
    return response.json({ message: 'Content deleted.' });
  } catch (error) {
    console.error('Failed to delete content:', error);
    return response.status(500).json({ message: 'Content could not be deleted.' });
  }
});

export const publishedContentRouter = Router();

publishedContentRouter.get('/', async (_request, response) => {
  try {
    const items = await Content.find({ status: 'published' })
      .sort({ updatedAt: -1 })
      .lean();
    return response.json({ items: items.map((item) => pickContentFields(item)) });
  } catch (error) {
    console.error('Failed to load published content:', error);
    return response.status(500).json({ message: 'Published content could not be loaded.' });
  }
});
