// Enregistre (POST) ou retire (DELETE) l'abonnement d'un téléphone. Aucune donnée personnelle : seulement l'adresse technique de la notification.
import { prepare, subsStore, envoyer, cle } from './_push.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'méthode non permise' }, 405);
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'JSON invalide' }, 400); }
  const store = subsStore();

  if (req.method === 'DELETE') {
    const endpoint = body && body.endpoint;
    if (typeof endpoint !== 'string') return json({ error: 'adresse manquante' }, 400);
    await store.delete(await cle(endpoint));
    return json({ ok: true });
  }

  const sub = body && body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return json({ error: 'abonnement invalide' }, 400);
  }
  const clean = { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } };
  await store.setJSON(await cle(clean.endpoint), clean);

  // Notification de bienvenue : confirme que ça marche, uniquement vers ce téléphone
  try {
    await prepare();
    await envoyer(clean, { title: "Croc'Savoir", body: 'Rappel activé : rendez-vous à midi 🍔', url: '/' });
  } catch (e) { /* l'abonnement reste enregistré */ }
  return json({ ok: true });
};

export const config = { path: '/api/subscribe' };
