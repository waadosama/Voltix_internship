import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    sender: {
      type: String,
      enum: ['user', 'bot'],
      required: true,
      default: 'user'
    },
    userId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
