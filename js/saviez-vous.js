/* ===================== « Le saviez-vous ? » =====================
 * Carte de l'accueil : une anecdote tirée d'une vraie fiche, la même pour tout le monde pendant la journée.
 * Le thème tourne chaque jour (on ne charge que le fichier de détails de ce thème) ; la fiche est choisie
 * parmi celles qui ont une anecdote, à partir de la date : aucun texte écrit à la main.
 * Pour retirer : supprimer ce fichier, #fact-card dans index.html, « Saviez » dans app.js/sw.js et les règles .fact-card. */
const Saviez = (() => {
  const KEY = 'croc-fact';
  const MIN = 60;      // anecdotes trop courtes écartées
  const MAX = 330;     // et trop longues pour une carte d'accueil

  function dayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  const esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function readCache() {
    try { const c = JSON.parse(localStorage.getItem(KEY)); return c && c.day === dayKey() && DataStore.ficheById(c.id) ? c : null; }
    catch (e) { return null; }
  }
  function writeCache(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* stockage indisponible */ } }

  // Trouve l'anecdote du jour : on essaie le thème du jour, puis les suivants si besoin.
  async function pick() {
    const domains = DataStore.getDomains().map(d => d.id);
    if (!domains.length) return null;
    const day = dayKey();
    const start = hash(day) % domains.length;
    for (let k = 0; k < domains.length; k++) {
      const dom = domains[(start + k) % domains.length];
      const fiches = DataStore.getFiches(dom).filter(f => f.hasDetails);
      if (!fiches.length) continue;
      await DataStore.loadDetails(fiches[0]);
      const pool = [];
      fiches.forEach(f => (f.details?.anecdotes || []).forEach(a => {
        if (typeof a === 'string' && a.length >= MIN && a.length <= MAX) pool.push({ id: f.id, text: a });
      }));
      if (pool.length) { const p = pool[hash(day + 'f') % pool.length]; return { day, id: p.id, text: p.text }; }
    }
    return null;
  }

  function show(c) {
    const el = document.getElementById('fact-card');
    if (!el || !c) return;
    const f = DataStore.ficheById(c.id);
    if (!f) return;
    const dom = DataStore.getDomain(f.domain);
    el.querySelector('.fact-card__text').textContent = c.text;
    el.querySelector('.fact-card__src').textContent = `${dom ? dom.emoji + ' ' : ''}${f.title}`;
    el.dataset.fid = f.id;
    el.hidden = false;
  }

  async function render() {
    const el = document.getElementById('fact-card');
    if (!el) return;
    if (!el.dataset.wired) {
      el.dataset.wired = '1';
      el.addEventListener('click', () => { if (el.dataset.fid) Fiches.openLinked(el.dataset.fid); });
    }
    const cached = readCache();
    if (cached) { show(cached); return; }
    try {
      const c = await pick();
      if (c) { writeCache(c); show(c); }
    } catch (e) { /* hors ligne : la carte reste cachée */ }
  }

  return { render };
})();
