// Rappel quotidien : tous les jours à midi (heure de Paris), « Ta bouchée du jour t'attend ».
// Planifié à 10 h et 11 h UTC ; on n'envoie que quand il est midi à Paris (heure d'été ou d'hiver), une seule fois par jour.
import { prepare, subsStore, envoyer, MESSAGE } from './_push.mjs';
import { getStore } from '@netlify/blobs';

export default async () => {
  const now = new Date();
  const heure = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(now);
  if (parseInt(heure, 10) !== 12) return new Response('pas midi à Paris');
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);   // AAAA-MM-JJ
  const meta = getStore('config');
  if ((await meta.get('dernier-envoi')) === jour) return new Response('déjà envoyé');
  await meta.set('dernier-envoi', jour);

  await prepare();
  const store = subsStore();
  const { blobs } = await store.list();
  let ok = 0, retires = 0;
  await Promise.all(blobs.map(async ({ key }) => {
    const sub = await store.get(key, { type: 'json' });
    if (!sub) return;
    try { await envoyer(sub, MESSAGE); ok++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await store.delete(key); retires++; }   // téléphone désabonné
    }
  }));
  return new Response(`envoyé : ${ok}, retirés : ${retires}`);
};

export const config = { schedule: '0 10,11 * * *' };
