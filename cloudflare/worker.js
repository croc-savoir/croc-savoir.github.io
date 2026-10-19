/* ===================== Rappel quotidien : Worker Cloudflare =====================
 * Petit serveur sans page web : il enregistre les téléphones qui veulent le rappel et leur envoie
 * « Ta bouchée du jour t'attend » tous les jours à midi (heure de Paris).
 * À coller dans l'éditeur du Worker (voir cloudflare/LISEZMOI.md). Rien n'est publié par GitHub.
 * Réglages Cloudflare nécessaires : un espace KV relié au Worker sous le nom ABOS, et un déclencheur Cron « 0 10,11 * * * ».
 * Les clés VAPID (identité du serveur) sont créées au premier appel et gardées dans le KV : rien à configurer.
 * ============================================================================== */

const SITE = 'https://croc-savoir.github.io';                        // seul site autorisé à parler au Worker
const AUTRES_ORIGINES = ['http://localhost:8123'];                    // pour les tests en local
const CONTACT = 'https://croc-savoir.github.io';                      // identifiant du serveur donné aux services de notification
const MESSAGE = { title: "Croc'Savoir", body: "Ta bouchée du jour t'attend 🍔", url: '/?go=daily' };
const HEURE = 12;                                                    // heure d'envoi, à Paris

// ---------- Petits outils d'encodage ----------
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
async function sha256hex(text) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Clés VAPID (identité du serveur) ----------
async function cles(env) {
  const stock = await env.ABOS.get('vapid', 'json');
  if (stock) return stock;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const k = { publicKey: pub, privateKey: priv };
  await env.ABOS.put('vapid', JSON.stringify(k));
  return k;
}

async function enteteVapid(env, endpoint) {
  const k = await cles(env);
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT })));
  const key = await crypto.subtle.importKey('jwk', k.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${k.publicKey}`;
}

// ---------- Chiffrement du message (Web Push, RFC 8291 : aes128gcm) ----------
async function hkdf(salt, ikm, info, longueur) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, longueur * 8));
}

export async function chiffrer(sub, texte) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, secret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const clair = concat(enc.encode(texte), new Uint8Array([2]));      // 2 = dernier (et seul) bloc
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, clair));
  const rs = new Uint8Array([0, 0, 0x10, 0]);                         // taille de bloc : 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, chiffre);
}

// Envoie une notification ; renvoie le code de réponse du service de notification (201 = ok, 404/410 = téléphone désabonné)
export async function envoyer(env, sub, payload) {
  const corps = await chiffrer(sub, JSON.stringify(payload));
  const rep = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await enteteVapid(env, sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(6 * 3600),
      Urgency: 'normal',
    },
    body: corps,
  });
  return rep.status;
}

// ---------- Réponses ----------
function cors(req) {
  const o = req.headers.get('Origin');
  const ok = o === SITE || AUTRES_ORIGINES.includes(o);
  return ok ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
}
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });

// ---------- Les trois adresses : /api/vapid-key, /api/subscribe (POST / DELETE) ----------
async function requete(req, env) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });

  if (url.pathname === '/api/vapid-key' && req.method === 'GET') {
    const { publicKey } = await cles(env);
    return json(req, { publicKey });
  }

  if (url.pathname === '/api/subscribe' && (req.method === 'POST' || req.method === 'DELETE')) {
    if (!cors(req)['Access-Control-Allow-Origin']) return json(req, { error: 'origine non autorisée' }, 403);
    let body;
    try { body = await req.json(); } catch (e) { return json(req, { error: 'JSON invalide' }, 400); }

    if (req.method === 'DELETE') {
      if (!body || typeof body.endpoint !== 'string') return json(req, { error: 'adresse manquante' }, 400);
      await env.ABOS.delete('sub:' + (await sha256hex(body.endpoint)));
      return json(req, { ok: true });
    }

    const s = body && body.subscription;
    if (!s || typeof s.endpoint !== 'string' || !s.endpoint.startsWith('https://') || !s.keys || !s.keys.p256dh || !s.keys.auth) {
      return json(req, { error: 'abonnement invalide' }, 400);
    }
    const propre = { endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } };
    await env.ABOS.put('sub:' + (await sha256hex(propre.endpoint)), JSON.stringify(propre));
    try { await envoyer(env, propre, { title: "Croc'Savoir", body: 'Rappel activé : rendez-vous à midi 🍔', url: '/' }); } catch (e) { /* l'abonnement reste enregistré */ }
    return json(req, { ok: true });
  }

  return new Response('Croc\'Savoir : serveur du rappel quotidien.', { status: 200 });
}

// ---------- Envoi quotidien (déclencheur Cron : 10 h et 11 h UTC, on n'envoie que s'il est midi à Paris) ----------
export async function envoiQuotidien(env, maintenant = new Date()) {
  const heure = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(maintenant), 10) % 24;
  if (heure !== HEURE) return 'pas encore / plus l\'heure';
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(maintenant);
  if ((await env.ABOS.get('dernier-envoi')) === jour) return 'déjà envoyé aujourd\'hui';
  await env.ABOS.put('dernier-envoi', jour);

  let ok = 0, retires = 0, cursor;
  do {
    const liste = await env.ABOS.list({ prefix: 'sub:', cursor });
    for (const { name } of liste.keys) {
      const sub = await env.ABOS.get(name, 'json');
      if (!sub) continue;
      try {
        const code = await envoyer(env, sub, MESSAGE);
        if (code === 404 || code === 410) { await env.ABOS.delete(name); retires++; } else if (code < 300) ok++;
      } catch (e) { /* on passe au suivant */ }
    }
    cursor = liste.list_complete ? undefined : liste.cursor;
  } while (cursor);
  return `envoyés : ${ok}, retirés : ${retires}`;
}

export default {
  fetch: (req, env) => requete(req, env),
  scheduled: (event, env, ctx) => { ctx.waitUntil(envoiQuotidien(env)); },
};
