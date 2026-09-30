import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Product } from '../models/product.js';
import {
  attachOptionalActor,
  hasPermission,
  requirePermission
} from '../middleware/rbac.js';

const router = Router();

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = ['draft', 'published'];

/** Fields a client may send on create/update — everything else is ignored. */
const WRITABLE_FIELDS = [
  'id', 'name', 'category', 'price', 'blurb',
  'tone', 'glyph', 'image', 'badge', 'status'
];

/** The shop is public: customers only ever see published items. */
const PUBLIC_FILTER = { status: 'published' };

function idQuery(rawId) {
  return isValidObjectId(rawId) ? { $or: [{ id: rawId }, { _id: rawId }] } : { id: rawId };
}

function pickFields(body = {}) {
  const payload = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    payload[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
  }
  if (payload.price !== undefined) payload.price = Number(payload.price);
  return payload;
}

function validate(payload, { isCreate }) {
  const errors = [];
  if (isCreate && (payload.id === undefined || payload.id === '')) {
    errors.push('id (the /shop/<id> slug) is required');
  }
  if (payload.id !== undefined && !SLUG_PATTERN.test(String(payload.id))) {
    errors.push('id must be a lowercase slug (letters, numbers and dashes)');
  }
  for (const field of ['name', 'category', 'blurb']) {
    if (payload[field] !== undefined && !String(payload[field]).trim()) {
      errors.push(`${field} is required`);
    }
  }
  if (payload.price !== undefined && (!Number.isFinite(payload.price) || payload.price < 0)) {
    errors.push('price must be a number of 0 or more');
  }
  if (payload.status !== undefined && !STATUSES.includes(payload.status)) {
    errors.push(`status must be one of ${STATUSES.join(', ')}`);
  }
  if (payload.glyph !== undefined && String(payload.glyph).length > 6) {
    errors.push('glyph may be at most 6 characters');
  }
  return errors;
}

function validationError(response, errors) {
  return response.status(400).json({
    code: 'validation',
    message: errors.join('. '),
    errors
  });
}

/**
 * `?scope=all` widens the read to draft items, so it needs `products:read`.
 * Without it the endpoint stays public and returns published items only.
 */
function scopeGuard(request, response, next) {
  if (request.query.scope === 'all') {
    return requirePermission('products:read')(request, response, next);
  }
  return next();
}

router.get('/', scopeGuard, async (request, response) => {
  try {
    const { q, category, limit = '24', page = '1', scope } = request.query;
    const filter = scope === 'all' ? {} : { ...PUBLIC_FILTER };

    if (q) {
      const needle = String(q);
      filter.$or = [
        { name: { $regex: needle, $options: 'i' } },
        { blurb: { $regex: needle, $options: 'i' } },
        { category: { $regex: needle, $options: 'i' } }
      ];
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    const limitNum = Math.min(Math.max(Number(limit) || 24, 1), 100);
    const pageNum = Math.max(Number(page) || 1, 1);

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ name: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter)
    ]);

    return response.json({
      products: items,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Failed to load products:', error);
    return response.status(500).json({ message: 'Products could not be loaded.' });
  }
});

// Single shop item (used by the /shop/:id detail page). Accepts the slug `id`
// or the Mongo `_id`. Published items are public; drafts are visible only to
// callers holding `products:read` (the studio).
router.get('/:id', attachOptionalActor, async (request, response) => {
  try {
    const product = await Product.findOne(idQuery(String(request.params.id))).lean();

    if (!product) {
      return response.status(404).json({ code: 'not_found', message: 'Shop item not found.' });
    }

    if (product.status !== 'published' && !hasPermission(request, 'products:read')) {
      return response.status(404).json({ code: 'not_found', message: 'Shop item not found.' });
    }

    return response.json({ product });
  } catch (error) {
    console.error('Failed to load product:', error);
    return response.status(500).json({ message: 'Shop item could not be loaded.' });
  }
});

router.post('/', requirePermission('products:create'), async (request, response) => {
  try {
    const payload = pickFields(request.body);
    const errors = validate(payload, { isCreate: true });
    if (errors.length) return validationError(response, errors);

    const duplicate = await Product.findOne({ id: payload.id }).lean();
    if (duplicate) {
      return response.status(409).json({
        code: 'duplicate',
        message: `A shop item with the id "${payload.id}" already exists.`
      });
    }

    const product = await Product.create(payload);
    return response.status(201).json({ product });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return validationError(response, Object.values(error.errors).map((entry) => entry.message));
    }
    if (error?.code === 11000) {
      return response.status(409).json({ code: 'duplicate', message: 'A shop item with that id already exists.' });
    }
    console.error('Failed to create product:', error);
    return response.status(500).json({ message: 'Shop item could not be created.' });
  }
});

async function updateProduct(request, response) {
  try {
    const rawId = String(request.params.id);
    const payload = pickFields(request.body);
    const errors = validate(payload, { isCreate: false });
    if (errors.length) return validationError(response, errors);

    if (payload.id !== undefined) {
      const current = await Product.findOne(idQuery(rawId)).lean();
      if (current && String(current.id) !== payload.id) {
        const taken = await Product.findOne({ id: payload.id }).lean();
        if (taken) {
          return response.status(409).json({
            code: 'duplicate',
            message: `A shop item with the id "${payload.id}" already exists.`
          });
        }
      }
    }

    const product = await Product.findOneAndUpdate(
      idQuery(rawId),
      { $set: payload },
      { new: true, runValidators: true, context: 'query' }
    );

    if (!product) {
      return response.status(404).json({ code: 'not_found', message: 'Shop item not found.' });
    }

    return response.json({ product });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return validationError(response, Object.values(error.errors).map((entry) => entry.message));
    }
    if (error?.code === 11000) {
      return response.status(409).json({ code: 'duplicate', message: 'A shop item with that id already exists.' });
    }
    console.error('Failed to update product:', error);
    return response.status(500).json({ message: 'Shop item could not be updated.' });
  }
}

router.patch('/:id', requirePermission('products:update'), updateProduct);
router.put('/:id', requirePermission('products:update'), updateProduct);

router.delete('/:id', requirePermission('products:delete'), async (request, response) => {
  try {
    const product = await Product.findOneAndDelete(idQuery(String(request.params.id)));

    if (!product) {
      return response.status(404).json({ code: 'not_found', message: 'Shop item not found.' });
    }

    return response.json({ message: 'Shop item deleted.', product });
  } catch (error) {
    console.error('Failed to delete product:', error);
    return response.status(500).json({ message: 'Shop item could not be deleted.' });
  }
});

export const productsRouter = router;
