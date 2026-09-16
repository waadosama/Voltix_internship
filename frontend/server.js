import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.env.PORT || 4173;
const currentFile = fileURLToPath(import.meta.url);
const frontendDirectory = path.dirname(currentFile);
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = createServer((request, response) => {
  const requestedPath = decodeURIComponent(request.url.split('?')[0]);
  const safePath = path.normalize(requestedPath).replace(/^([/\\])+/, '');
  let filePath = path.join(frontendDirectory, safePath || 'index.html');

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(frontendDirectory, 'index.html');
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
});

const listen = (requestedPort) => {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${requestedPort} is busy. Trying ${Number(requestedPort) + 1}...`);
      return listen(Number(requestedPort) + 1);
    }
    throw error;
  });

  server.listen(requestedPort, '127.0.0.1', () => {
    console.log(`Idea House frontend running at http://127.0.0.1:${server.address().port}`);
  });
};

listen(port);
