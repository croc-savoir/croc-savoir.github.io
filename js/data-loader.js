/* ===================== Chargement des données ==========================
 * Au démarrage : data/app/index.json (thèmes, fiches SANS détails, questions),
 * généré par tools/construire.js à partir de data/fiches et data/quiz.
 * Les détails (« Approfondir ») sont dans data/app/details/<domaine>.json,
 * chargés à la demande, puis tous préchargés en tâche de fond (une fois par
 * version) pour rester disponibles hors ligne.
 * Secours : si l'index manque, on charge les fichiers sources complets.
 * ========================================================================= */
const DataStore = (() => {
  const PREFETCH_KEY = 'culture-g:details';
  let domains = [];
  let fichesByDomain = {};
  let quizByDomain = {};
  let allFichesFlat = [];
  let allQuizFlat = [];
  let detailHashes = {};
  const detailLoads = {}; // domaine -> Promise
  let ready = false;

  async function fetchJsonSafe(url, cache = 'no-cache') {
    try {
      const res = await fetch(url, { cache });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function initFromSources() {
    domains = (await fetchJsonSafe('data/domains.json')) || [];
    await Promise.all(domains.map(async (d) => {
      const [fiches, quiz] = await Promise.all([
        fetchJsonSafe(`data/fiches/${d.id}.json`),
        fetchJsonSafe(`data/quiz/${d.id}.json`),
      ]);
      fichesByDomain[d.id] = fiches || [];
      quizByDomain[d.id] = quiz || [];
    }));
  }

  async function init() {
    if (ready) return;
    const idx = await fetchJsonSafe('data/app/index.json');
    if (idx && Array.isArray(idx.fiches) && idx.fiches.length) {
      domains = idx.domains || [];
      detailHashes = idx.details || {};
      domains.forEach(d => { fichesByDomain[d.id] = []; quizByDomain[d.id] = []; });
      idx.fiches.forEach(f => { (fichesByDomain[f.domain] = fichesByDomain[f.domain] || []).push(f); });
      idx.quiz.forEach(q => { (quizByDomain[q.domain] = quizByDomain[q.domain] || []).push(q); });
    } else {
      await initFromSources();
    }

    allFichesFlat = domains.flatMap(d => fichesByDomain[d.id]);
    allQuizFlat = domains.flatMap(d => quizByDomain[d.id]);
    ready = true;
    schedulePrefetch();
  }

  // ---------- Détails à la demande ----------
  function loadDomainDetails(domainId) {
    if (!detailHashes[domainId]) return Promise.resolve();
    if (!detailLoads[domainId]) {
      // URL versionnée : le contenu ne change jamais pour une même version.
      detailLoads[domainId] = fetch(`data/app/details/${domainId}.json?v=${detailHashes[domainId]}`)
        .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(map => {
          (fichesByDomain[domainId] || []).forEach(f => { if (map[f.id]) f.details = map[f.id]; });
        })
        .catch(e => { delete detailLoads[domainId]; throw e; });
    }
    return detailLoads[domainId];
  }

  async function loadDetails(fiche) {
    if (!fiche.details && fiche.hasDetails) await loadDomainDetails(fiche.domain);
    return fiche.details || {};
  }

  // Précharge tous les détails quand le téléphone est libre, une seule fois par
  // version de chaque thème (le service worker les garde pour le hors-ligne).
  function schedulePrefetch() {
    const todo = Object.keys(detailHashes);
    if (!todo.length) return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    idle(async () => {
      let done = {};
      try { done = JSON.parse(localStorage.getItem(PREFETCH_KEY)) || {}; } catch (e) { done = {}; }
      for (const dom of todo) {
        if (done[dom] === detailHashes[dom]) continue;
        if (navigator.onLine === false) return;
        try {
          await loadDomainDetails(dom);
          done[dom] = detailHashes[dom];
          try { localStorage.setItem(PREFETCH_KEY, JSON.stringify(done)); } catch (e) { /* stockage indisponible */ }
        } catch (e) { return; }
      }
    }, { timeout: 5000 });
  }

  function getDomains() { return domains; }
  function getDomain(id) { return domains.find(d => d.id === id); }

  function getFiches(domainId) { return fichesByDomain[domainId] || []; }
  function getQuiz(domainId) { return quizByDomain[domainId] || []; }

  function getAllFiches() { return allFichesFlat; }
  function getAllQuiz() { return allQuizFlat; }

  function getAllQuizById() {
    const map = {};
    allQuizFlat.forEach(q => { map[q.id] = q; });
    return map;
  }

  // Compteurs de fiches/questions affichés pendant le remplissage du contenu.
  // Passer à false pour les retirer de toute l'appli.
  const COMPTEURS = true;
  function compte(n, mot) {
    if (!COMPTEURS) return '';
    return `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;
  }

  function domainCounts() {
    const counts = {};
    domains.forEach(d => {
      counts[d.id] = {
        fiches: (fichesByDomain[d.id] || []).length,
        quiz: (quizByDomain[d.id] || []).length,
      };
    });
    return counts;
  }

  function subthemesFor(domainId) {
    const fiches = fichesByDomain[domainId] || [];
    const map = new Map();
    fiches.forEach(f => {
      const key = f.subtheme || 'Général';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    });
    return map; // Map<label, fiche[]>
  }

  // Recherche d'une fiche par son titre (sans accents ni ponctuation), pour les liens auteur ↔ œuvre.
  const normTitre = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  let titreIndex = null;
  function ficheByTitle(titre) {
    if (!titreIndex) {
      titreIndex = new Map();
      allFichesFlat.forEach(f => { const k = normTitre(f.title); if (!titreIndex.has(k)) titreIndex.set(k, f); });
    }
    return titreIndex.get(normTitre(titre)) || null;
  }

  function ficheById(id) {
    return allFichesFlat.find(f => f.id === id);
  }

  return {
    init,
    getDomains, getDomain,
    getFiches, getQuiz,
    getAllFiches, getAllQuiz, getAllQuizById,
    domainCounts, compte, subthemesFor, ficheById, ficheByTitle, loadDetails,
  };
})();
