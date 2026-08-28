import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = join(process.cwd(), 'dist/minha-agenda/browser');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };
http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let fp = normalize(join(root, p));
    let data;
    try { data = await readFile(fp); }
    catch { data = await readFile(join(root, 'index.html')); p = '/index.html'; }
    res.setHeader('Content-Type', types[extname(p)] || 'application/octet-stream');
    res.end(data);
  } catch (e) { res.statusCode = 500; res.end(String(e)); }
}).listen(4200, '127.0.0.1', () => console.log('LISTENING'));
