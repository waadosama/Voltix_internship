import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, unique: true },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' }
  },
  { timestamps: true }
);

export const Content = mongoose.model('Content', contentSchema);