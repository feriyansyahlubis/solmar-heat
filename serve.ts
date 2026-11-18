// Solmar Heat — tiny static server for local playtesting of game/.
// Serves http://localhost:8080 (game/index.html). No dependencies.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';

const ROOT = new URL('./game', import.meta.url).pathname;
const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    // Guard against path traversal: the resolved path must stay under ROOT.
    const full = normalize(join(ROOT, rel));
    if (!full.startsWith(ROOT + sep) && full !== ROOT) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (!existsSync(full) || !statSync(full).isFile()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const type = MIME[extname(full).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(readFileSync(full));
  } catch (e) {
    res.writeHead(500);
    res.end('error');
  }
});

server.listen(PORT, () => {
  console.log(`Solmar Heat at http://localhost:${PORT}/`);
});
