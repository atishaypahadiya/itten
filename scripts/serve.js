// Local static server. Plain Node, no dependencies. Serves ITTEN itself (the
// fixtures) by default, or any directory: the ITTEN action uses it for a
// project's static build.
// Usage: node scripts/serve.js [port] [dir]   (default 4173, ITTEN's root)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.xml': 'application/xml', '.wasm': 'application/wasm', '.map': 'application/json',
};

export function start(port = 4173, dir = null) {
  const root = dir ? resolve(dir) : ROOT;
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' && !dir) { res.writeHead(302, { Location: '/fixtures/' }); return res.end(); }
    if (path.endsWith('/')) path += 'index.html';
    let file = normalize(join(root, path));
    if (!file.startsWith(root + sep) || /[\\/]\.|node_modules/.test(file.slice(root.length))) { res.writeHead(403); return res.end('Forbidden'); }
    try {
      // A path without an extension may name a directory or an .html file, as static hosts allow.
      if (dir && !extname(file)) {
        const s = await stat(file).catch(() => null);
        if (s?.isDirectory()) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
        if (!s && (await stat(file + '.html').catch(() => null))?.isFile()) file += '.html';
      }
      if (!(await stat(file)).isFile()) throw new Error();
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
  await start(port, process.argv[3] ?? null);
  console.log(`Serving at http://127.0.0.1:${port}/`);
}
