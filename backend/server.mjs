import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest } from './local-backend.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ status: 'ok' }));
    }
    if (url.pathname.startsWith('/api/')) return await handleRequest(req, res);
    if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; return res.end(); }
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== resolve(root) && !file.startsWith(resolve(root) + sep)) { res.statusCode = 403; return res.end(); }
    try { if (!(await stat(file)).isFile()) throw new Error(); }
    catch { if (extname(url.pathname)) { res.statusCode = 404; return res.end(); } file = resolve(root, 'index.html'); }
    const content = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600');
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.statusCode = 500; res.end('Server error'); }
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('Flowsee Studio server ready'));
}
