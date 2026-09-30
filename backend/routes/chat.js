import { Router } from 'express';
import { ChatMessage } from '../models/chat-message.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function serializeMessage(document) {
  return {
    id: document.id || String(document._id),
    message: document.message,
    sender: document.sender,
    timestamp: document.timestamp
  };
}

// Simple mock bot used until a real assistant is wired up.
function createBotReply(userMessage) {
  const text = userMessage.toLowerCase();

  if (text.includes('hello') || text.includes('hi')) {
    return 'Hello! Thanks for reaching out to Idea House. How can we help today?';
  }
  if (text.includes('price') || text.includes('cost') || text.includes('budget')) {
    return 'Every project is scoped differently. Share a few details and we will send a tailored estimate.';
  }
  if (text.includes('hour') || text.includes('time') || text.includes('long')) {
    return 'Most projects take between four and twelve weeks, depending on scope and feedback rounds.';
  }
  if (text.includes('contact') || text.includes('call') || text.includes('email')) {
    return 'You can reach the studio through the contact form on this site and we will reply within one business day.';
  }

  return 'Thanks for your message! A teammate will follow up soon. Meanwhile, feel free to ask about our services, pricing, or timelines.';
}

function serializeUser(request) {
  return String(request.user?.id || request.user?.email || 'anonymous');
}

router.get('/messages', requirePermission('chat:use'), async (request, response) => {
  try {
    const documents = await ChatMessage.find({ userId: serializeUser(request) })
      .sort({ timestamp: 1, _id: 1 });

    return response.json({ messages: documents.map(serializeMessage) });
  } catch (error) {
    console.error('Failed to load chat messages:', error);
    return response.status(500).json({ message: 'Chat messages could not be loaded.' });
  }
});

router.post('/messages', requirePermission('chat:use'), async (request, response) => {
  const text = asTrimmedString(request.body?.message);
  const sender = asTrimmedString(request.body?.sender) || 'user';

  if (!text) {
    return response.status(400).json({ message: 'Message is required.' });
  }

  if (sender !== 'user' && sender !== 'bot') {
    return response.status(400).json({ message: 'Sender must be "user" or "bot".' });
  }

  try {
    const userId = serializeUser(request);

    const stored = await ChatMessage.create({ message: text, sender, userId });

    const payload = { message: serializeMessage(stored) };

    if (sender === 'user') {
      const reply = await ChatMessage.create({
        message: createBotReply(text),
        sender: 'bot',
        userId
      });
      payload.reply = serializeMessage(reply);
    }

    return response.status(201).json(payload);
  } catch (error) {
    console.error('Failed to store chat message:', error);
    return response.status(500).json({ message: 'Your message could not be saved. Please try again.' });
  }
});

export const chatRouter = router;
