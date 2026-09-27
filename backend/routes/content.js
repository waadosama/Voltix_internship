import { Router } from 'express';
import { Content } from '../models/content.js';
import { requireAdmin } from '../middleware/auth.js';

function pickContentFields(item) {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    body: item.body,
    status: item.status,
    updatedAt: item.updatedAt
  };
}

export const contentRouter = Router();

contentRouter.get('/', requireAdmin, async (_request, response) => {
  try {
    const items = await Content.find().sort({ updatedAt: -1 }).lean();
    return response.json({ items: items.map(pickContentFields) });
  } catch (error) {
    console.error('Failed to load content:', error);
    return response.status(500).json({ message: 'Content could not be loaded.' });
  }
});

contentRouter.post('/', requireAdmin, async (request, response) => {
  const { title, slug, body, status } = request.body || {};

  if (!title || !slug) {
    return response.status(400).json({ message: 'Title and slug are required.' });
  }

  try {
    const item = await Content.create({ title, slug, body: body || '', status: status || 'draft' });
    return response.status(201).json({ item: pickContentFields(item) });
  } catch (error) {
    console.error('Failed to create content:', error);
    return response.status(500).json({ message: 'Content could not be created.' });
  }
});

contentRouter.get('/:id', requireAdmin, async (request, response) => {
  try {
    const item = await Content.findById(request.params.id).lean();
    if (!item) return response.status(404).json({ message: 'Content not found.' });
    return response.json({ item: pickContentFields(item) });
  } catch (error) {
    console.error('Failed to load content:', error);
    return response.status(500).json({ message: 'Content could not be loaded.' });
  }
});

contentRouter.patch('/:id', requireAdmin, async (request, response) => {
  try {
    const item = await Content.findByIdAndUpdate(
      request.params.id,
      { ...request.body },
      { new: true, runValidators: true }
    ).lean();
    if (!item) return response.status(404).json({ message: 'Content not found.' });
    return response.json({ item: pickContentFields(item) });
  } catch (error) {
    console.error('Failed to update content:', error);
    return response.status(500).json({ message: 'Content could not be updated.' });
  }
});

contentRouter.delete('/:id', requireAdmin, async (request, response) => {
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
    return response.json({ items: items.map(pickContentFields) });
  } catch (error) {
    console.error('Failed to load published content:', error);
    return response.status(500).json({ message: 'Published content could not be loaded.' });
  }
});
