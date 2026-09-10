import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 3000;
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const frontendDirectory = path.resolve(currentDirectory, '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.static(frontendDirectory));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'idea-house-api' });
});

app.post('/api/contact', (request, response) => {
  const { name, email, company, message } = request.body;

  if (!name || !email || !message) {
    return response.status(400).json({
      message: 'Name, email, and message are required.'
    });
  }

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailIsValid) {
    return response.status(400).json({ message: 'Please enter a valid email.' });
  }

  console.log('New project inquiry:', {
    name,
    email,
    company: company || 'Not provided',
    message
  });

  return response.status(201).json({
    message: 'Thanks. Your project inquiry has been received.'
  });
});

app.use((request, response, next) => {
  if (request.method !== 'GET') return next();
  return response.sendFile(path.join(frontendDirectory, 'index.html'));
});

app.listen(port, () => {
  console.log(`Idea House server running at http://localhost:${port}`);
});
