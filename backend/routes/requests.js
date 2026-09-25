import { Router } from 'express';
import { Inquiry } from '../models/inquiry.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, async (_request, response) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });
    return response.json({ inquiries });
  } catch (error) {
    console.error('Failed to load inquiries:', error);
    return response.status(500).json({ message: 'Inquiries could not be loaded.' });
  }
});

router.put('/:id', requireAdmin, async (request, response) => {
  const { status } = request.body;

  if (!status || !['new', 'in-progress', 'resolved'].includes(status)) {
    return response.status(400).json({ message: 'Valid status is required (new, in-progress, resolved).' });
  }

  try {
    const inquiry = await Inquiry.findByIdAndUpdate(
      request.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!inquiry) return response.status(404).json({ message: 'Inquiry not found.' });

    return response.json({ inquiry });
  } catch (error) {
    console.error('Failed to update inquiry status:', error);
    return response.status(500).json({ message: 'Inquiry status could not be updated.' });
  }
});

export const requestsRouter = router;