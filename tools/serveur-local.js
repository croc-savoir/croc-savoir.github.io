// Serveur local pour tester l'appli sur ordinateur ET sur téléphone (même Wi-Fi), sans rien publier.
//   node tools/serveur-local.js          → http://localhost:8765  (et l'adresse à taper sur le téléphone)
// Arrêt : Ctrl+C. Aucun cache : chaque rechargement montre la version du dossier.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Sur cet ordinateur : http://localhost:${PORT}`);
  for (const liste of Object.values(os.networkInterfaces())) {
    for (const a of liste || []) if (a.family === 'IPv4' && !a.internal) console.log(`Sur le téléphone (même Wi-Fi) : http://${a.address}:${PORT}`);
  }
});
