import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from './db.js';
<<<<<<< HEAD
import { authRouter } from './routes/auth.js';
=======
>>>>>>> 840a98e1db163fdf58b10f72aa48550735a92727
import { contactRouter } from './routes/contact.js';
import { contentRouter, publishedContentRouter } from './routes/content.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voltix';
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const frontendDirectory = path.resolve(currentDirectory, '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.static(frontendDirectory));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'idea-house-api' });
});

<<<<<<< HEAD
app.use('/api/auth', authRouter);
=======
>>>>>>> 840a98e1db163fdf58b10f72aa48550735a92727
app.use('/api/contact', contactRouter);
app.use('/api/content', contentRouter);
app.use('/api/published-content', publishedContentRouter);

app.get(['/admin', '/admin/'], (_request, response) => {
  response.sendFile(path.join(frontendDirectory, 'admin.html'));
});

app.use((request, response, next) => {
  if (request.method !== 'GET') return next();
  return response.sendFile(path.join(frontendDirectory, 'index.html'));
});

async function start() {
  try {
    await connectDatabase(mongoUri);
    console.log(`Connected to MongoDB at ${mongoUri}`);

    app.listen(port, () => {
      console.log(`Idea House server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Could not start the server. Is MongoDB running?');
    console.error(error.message);
    process.exit(1);
  }
}

start();
