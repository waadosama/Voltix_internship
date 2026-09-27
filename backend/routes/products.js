import { Router } from 'express';
import { Product } from '../models/product.js';

const router = Router();

router.get('/', async (request, response) => {
  try {
    const { q, category, limit = '24', page = '1' } = request.query;
    const filter = {};

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

export const productsRouter = router;
