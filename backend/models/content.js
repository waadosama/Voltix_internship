import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, unique: true },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    // RBAC: which account created this record. Admins may edit any record;
    // employees may only edit records they own (see middleware/rbac.js).
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    createdByName: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

export const Content = mongoose.model('Content', contentSchema);