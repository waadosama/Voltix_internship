import { Router } from 'express';
import mongoose from 'mongoose';
import { Content } from '../models/content.js';
import { requireAdmin } from '../middleware/require-admin.js';

const allowedStatuses = new Set(['draft', 'published']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateContent(body) {
  const title = text(body?.title);
  const slug = text(body?.slug).toLowerCase();
  const contentBody = text(body?.body);
  const status = text(body?.status) || 'draft';
  const errors = [];

  if (!title) errors.push('Title is required.');
  if (!slug) errors.push('Slug is required.');
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push('Slug may contain lowercase letters, numbers, and hyphens.');
  if (!contentBody) errors.push('Body is required.');
  if (!allowedStatuses.has(status)) errors.push('Status must be draft or published.');

  return { errors, data: { title, slug, body: contentBody, status } };
}

function serializeContent(item) {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    body: item.body,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export const contentRouter = Router();
contentRouter.use(requireAdmin);

contentRouter.get('/', async (_request, response) => {
  try {
    const items = await Content.find().sort({ updatedAt: -1 });
    return response.json({ items: items.map(serializeContent) });
  } catch (error) {
    console.error('Failed to load content:', error);
    return response.status(500).json({ message: 'Content could not be loaded.' });
  }
});

contentRouter.post('/', async (request, response) => {
  const { errors, data } = validateContent(request.body);
  if (errors.length > 0) return response.status(400).json({ message: errors.join(' ') });

  try {
    const item = await Content.create(data);
    return response.status(201).json({ item: serializeContent(item) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'That slug is already in use.' });
    console.error('Failed to create content:', error);
    return response.status(500).json({ message: 'Content could not be created.' });
  }
});

contentRouter.put('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ message: 'Invalid content id.' });

  const { errors, data } = validateContent(request.body);
  if (errors.length > 0) return response.status(400).json({ message: errors.join(' ') });

  try {
    const item = await Content.findByIdAndUpdate(request.params.id, data, { new: true, runValidators: true });
    if (!item) return response.status(404).json({ message: 'Content item not found.' });
    return response.json({ item: serializeContent(item) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'That slug is already in use.' });
    console.error('Failed to update content:', error);
    return response.status(500).json({ message: 'Content could not be updated.' });
  }
});

contentRouter.delete('/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ message: 'Invalid content id.' });

  try {
    const item = await Content.findByIdAndDelete(request.params.id);
    if (!item) return response.status(404).json({ message: 'Content item not found.' });
    return response.status(204).send();
  } catch (error) {
    console.error('Failed to delete content:', error);
    return response.status(500).json({ message: 'Content could not be deleted.' });
  }
});

export const publishedContentRouter = Router();

publishedContentRouter.get('/', async (_request, response) => {
  try {
    const items = await Content.find({ status: 'published' }).sort({ updatedAt: -1 });
    return response.json({ items: items.map(serializeContent) });
  } catch (error) {
    console.error('Failed to load published content:', error);
    return response.status(500).json({ message: 'Published content could not be loaded.' });
  }
});