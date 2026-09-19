import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.env.PORT || 4173;
const currentFile = fileURLToPath(import.meta.url);
const frontendDirectory = path.dirname(currentFile);
const pagesDirectory = path.join(frontendDirectory, 'pages');
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

const routeFiles = {
  '/': 'index.html',
  '/admin': 'admin.html',
  '/admin/': 'admin.html',
  '/dashboard': 'dashboard.html',
  '/dashboard/': 'dashboard.html'
};

const server = createServer((request, response) => {
  const requestedPath = decodeURIComponent(request.url.split('?')[0]);
  const mappedFile = routeFiles[requestedPath];
  const safePath = path.normalize(requestedPath).replace(/^([/\\])+/, '');
  let filePath = mappedFile
    ? path.join(pagesDirectory, mappedFile)
    : path.join(frontendDirectory, safePath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(pagesDirectory, 'index.html');
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
