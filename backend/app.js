import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { contactRouter } from './routes/contact.js';
import { contentRouter, publishedContentRouter } from './routes/content.js';
import { requestsRouter } from './routes/requests.js';
import { productsRouter } from './routes/products.js';
import { usersRouter } from './routes/users.js';

dotenv.config();

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const frontendDirectory = path.resolve(currentDirectory, '..', 'frontend');
const frontendPagesDirectory = path.join(frontendDirectory, 'pages');

/**
 * Builds the Express application (API routes + static frontend).
 * Kept separate from `server.js` so tests can mount the app without
 * opening a port or connecting to MongoDB.
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(frontendDirectory));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'idea-house-api' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/content', contentRouter);
  app.use('/api/published-content', publishedContentRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/users', usersRouter);

  app.get(['/admin', '/admin/'], (_request, response) => {
    response.sendFile(path.join(frontendPagesDirectory, 'admin.html'));
  });

  app.get(['/dashboard', '/dashboard/'], (_request, response) => {
    response.sendFile(path.join(frontendPagesDirectory, 'dashboard.html'));
  });

  app.get(['/shop', '/shop/'], (_request, response) => {
    response.redirect('/#shop');
  });

  app.get('/shop/:id', (_request, response) => {
    response.sendFile(path.join(frontendPagesDirectory, 'shop-item.html'));
  });

  app.use((request, response, next) => {
    if (request.method !== 'GET') return next();

    return response.sendFile(path.join(frontendPagesDirectory, 'index.html'));
  });

  return app;
}
