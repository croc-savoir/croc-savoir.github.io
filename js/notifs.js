/* ===================== Rappel quotidien (notifications) =====================
 * Bouton en bas de l'accueil : active ou coupe la notification de midi « Ta bouchée du jour t'attend ».
 * Le serveur (Cloudflare Worker) ne garde que l'adresse technique du téléphone, rien de personnel.
 * Sur iPhone, ça ne marche que si l'appli est ajoutée à l'écran d'accueil.
 * Pour retirer : supprimer ce fichier, #notif-row dans index.html, les gestionnaires push de sw.js et le Worker. */
const Notifs = (() => {
  // Adresse du petit serveur qui envoie les notifications (Cloudflare Worker, à renseigner une fois créé). Vide = bouton caché.
  const API = 'https://croc-savoir-rappel.darshanpatel.workers.dev';
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  function b64ToBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async function current() {
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch (e) { return null; }
  }

  async function enable() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('refusé');
    const { publicKey } = await (await fetch(API + '/api/vapid-key', { cache: 'no-store' })).json();
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    const res = await fetch(API + '/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    if (!res.ok) throw new Error('serveur');
  }

  async function disable() {
    const sub = await current();
    if (!sub) return;
    try { await fetch(API + '/api/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch (e) { /* hors ligne */ }
    await sub.unsubscribe();
  }

  async function refresh() {
    const row = document.getElementById('notif-row');
    if (!row) return;
    if (!API) { row.hidden = true; return; }
    const btn = row.querySelector('.notif-btn'), hint = row.querySelector('.notif-hint');
    if (!supported()) {
      // iPhone hors appli installée : on explique quoi faire ; ailleurs, on ne montre rien
      row.hidden = !(isIOS() && !standalone());
      btn.hidden = true;
      hint.textContent = "Pour recevoir le rappel de midi, ajoute d'abord l'appli à l'écran d'accueil (Partager → Sur l'écran d'accueil).";
      return;
    }
    row.hidden = false; btn.hidden = false; hint.textContent = '';
    const on = !!(await current()) && Notification.permission === 'granted';
    btn.dataset.on = on ? '1' : '0';
    btn.textContent = on ? '🔔 Rappel de midi activé · couper' : '🔔 Activer le rappel de midi';
    if (Notification.permission === 'denied') hint.textContent = 'Les notifications sont bloquées pour ce site dans les réglages du téléphone.';
  }

  function init() {
    const row = document.getElementById('notif-row');
    if (!row) return;
    row.querySelector('.notif-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        if (btn.dataset.on === '1') { await disable(); App.toast('Rappel coupé'); }
        else { await enable(); App.toast('Rappel activé : rendez-vous à midi 🍔'); }
      } catch (err) {
        App.toast(Notification.permission === 'denied' ? 'Notifications bloquées dans les réglages' : "Impossible d'activer le rappel pour l'instant");
      }
      btn.disabled = false;
      refresh();
    });
    document.addEventListener('screenchange', (e) => { if (e.detail === 'home') refresh(); });
    refresh();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { refresh };
})();
