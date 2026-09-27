import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    blurb: { type: String, required: true, trim: true, maxlength: 1000 },
    tone: { type: String, default: 'cobalt' },
    glyph: { type: String, maxlength: 6 },
    image: { type: String },
    badge: { type: String },
    status: { type: String, enum: ['draft', 'published'], default: 'published' }
  },
  { timestamps: true }
);

export const Product = mongoose.model('Product', productSchema);
