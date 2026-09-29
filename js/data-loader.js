/* ===================== Chargement des données ==========================
 * Convention : pour ajouter un domaine, il suffit de déposer
 *   data/fiches/<domainId>.json  et/ou  data/quiz/<domainId>.json
 * Un fichier manquant est simplement ignoré (404 silencieux).
 * ========================================================================= */
const DataStore = (() => {
  let domains = [];
  let fichesByDomain = {};
  let quizByDomain = {};
  let allFichesFlat = [];
  let allQuizFlat = [];
  let ready = false;

  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function init() {
    if (ready) return;
    domains = (await fetchJsonSafe('data/domains.json')) || [];

    await Promise.all(domains.map(async (d) => {
      const [fiches, quiz] = await Promise.all([
        fetchJsonSafe(`data/fiches/${d.id}.json`),
        fetchJsonSafe(`data/quiz/${d.id}.json`),
      ]);
      fichesByDomain[d.id] = fiches || [];
      quizByDomain[d.id] = quiz || [];
    }));

    allFichesFlat = domains.flatMap(d => fichesByDomain[d.id]);
    allQuizFlat = domains.flatMap(d => quizByDomain[d.id]);
    ready = true;
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

  function ficheById(id) {
    return allFichesFlat.find(f => f.id === id);
  }

  return {
    init,
    getDomains, getDomain,
    getFiches, getQuiz,
    getAllFiches, getAllQuiz, getAllQuizById,
    domainCounts, subthemesFor, ficheById,
  };
})();
