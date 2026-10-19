import { vapidKeys } from './_push.mjs';

export default async () => {
  const { publicKey } = await vapidKeys();
  return new Response(JSON.stringify({ publicKey }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/vapid-key' };
