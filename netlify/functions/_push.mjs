// Outils communs du rappel quotidien : clés VAPID (créées une fois, gardées côté serveur) et envoi d'une notification.
import webpush from 'web-push';
import { getStore } from '@netlify/blobs';

export const subsStore = () => getStore('abonnements');
const configStore = () => getStore('config');

export async function vapidKeys() {
  const store = configStore();
  let keys = await store.get('vapid', { type: 'json' });
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    await store.setJSON('vapid', keys);
  }
  return keys;
}

export async function prepare() {
  const keys = await vapidKeys();
  webpush.setVapidDetails('https://croc-savoir.netlify.app', keys.publicKey, keys.privateKey);
  return keys;
}

export async function envoyer(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 6 * 3600 });
}

// Clé de stockage d'un abonnement : empreinte de son adresse (sans caractères spéciaux)
export async function cle(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const MESSAGE = { title: "Croc'Savoir", body: "Ta bouchée du jour t'attend 🍔", url: '/?go=daily' };
