import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'client'],
    default: 'client',
    required: true
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  company: {
    type: String,
    default: '',
    trim: true
  },
  bio: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

export const User = mongoose.model('User', userSchema);
