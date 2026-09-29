/* ===================== Storage ==========================
 * Toutes les données de progression vivent dans localStorage,
 * sous une seule clé JSON. Rien ne part jamais sur un serveur.
 * =========================================================== */
const Store = (() => {
  const KEY = 'culture-g:v1';
  const SCHEMA_VERSION = 1;

  function blank() {
    return {
      version: SCHEMA_VERSION,
      fiches: {},   // ficheId -> { views, lastViewed }
      quiz: {},     // questionId -> { ef, interval, reps, due, lastResult, history: [{date, correct}] }
      settings: { accent: 'blue' },
      favorites: {}, // ficheId -> date d'ajout (ISO)
      daily: null,  // session du jour en cours : { date, ficheIds, quizIds, step, results, done }
      streak: { count: 0, lastDate: null }, // jours consécutifs avec une bouchée terminée
    };
  }

  let data = null;

  function load() {
    if (data) return data;
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : blank();
      if (!data.fiches) data.fiches = {};
      if (!data.quiz) data.quiz = {};
      if (!data.settings) data.settings = { accent: 'blue' };
      if (!data.streak) data.streak = { count: 0, lastDate: null };
      if (!data.favorites) data.favorites = {};
    } catch (e) {
      console.warn('Progression illisible, réinitialisation locale.', e);
      data = blank();
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Impossible de sauvegarder la progression (stockage plein ?)', e);
    }
  }

  function recordFicheView(ficheId) {
    load();
    const cur = data.fiches[ficheId] || { views: 0, lastViewed: null };
    cur.views += 1;
    cur.lastViewed = new Date().toISOString();
    data.fiches[ficheId] = cur;
    save();
  }

  function isFicheSeen(ficheId) {
    load();
    return !!data.fiches[ficheId];
  }

  function getQuizMeta(questionId) {
    load();
    return data.quiz[questionId] || null;
  }

  function recordQuizAnswer(questionId, correct, newSrsMeta) {
    load();
    const cur = data.quiz[questionId] || { history: [] };
    const merged = Object.assign({}, cur, newSrsMeta);
    merged.history = (cur.history || []).concat([{ date: new Date().toISOString(), correct }]).slice(-20);
    data.quiz[questionId] = merged;
    save();
  }

  function getErrorIds() {
    load();
    return Object.keys(data.quiz).filter(id => data.quiz[id].lastResult === false);
  }

  function domainStats(questionsById) {
    // questionsById: { id -> { domain } } to cross-reference
    load();
    const byDomain = {};
    for (const id in data.quiz) {
      const q = questionsById[id];
      if (!q) continue;
      const d = q.domain;
      if (!byDomain[d]) byDomain[d] = { correct: 0, total: 0 };
      const hist = data.quiz[id].history || [];
      hist.forEach(h => {
        byDomain[d].total += 1;
        if (h.correct) byDomain[d].correct += 1;
      });
    }
    return byDomain;
  }

  function globalCounts() {
    load();
    const fichesVues = Object.keys(data.fiches).length;
    let quizRepondus = 0, quizCorrects = 0;
    for (const id in data.quiz) {
      const hist = data.quiz[id].history || [];
      quizRepondus += hist.length;
      quizCorrects += hist.filter(h => h.correct).length;
    }
    return { fichesVues, quizRepondus, quizCorrects };
  }

  function exportJSON() {
    load();
    return JSON.stringify(data, null, 2);
  }

  function importJSON(str) {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== 'object' || !('fiches' in parsed) || !('quiz' in parsed)) {
      throw new Error('Fichier de sauvegarde invalide.');
    }
    data = parsed;
    if (!data.settings) data.settings = { accent: 'blue' };
    if (!data.streak) data.streak = { count: 0, lastDate: null };
    if (!data.favorites) data.favorites = {};
    save();
  }

  // ---------- Favoris ----------
  function isFavorite(ficheId) { load(); return !!data.favorites[ficheId]; }
  function toggleFavorite(ficheId) {
    load();
    if (data.favorites[ficheId]) delete data.favorites[ficheId];
    else data.favorites[ficheId] = new Date().toISOString();
    save();
    return !!data.favorites[ficheId];
  }
  // Identifiants des favoris, du plus récent au plus ancien.
  function favoriteIds() {
    load();
    return Object.keys(data.favorites).sort((a, b) => data.favorites[b].localeCompare(data.favorites[a]));
  }

  // ---------- Bouchée du jour ----------
  function getDaily() { load(); return data.daily || null; }
  function setDaily(d) { load(); data.daily = d; save(); }
  function getStreakRaw() { load(); return data.streak; }
  function setStreakRaw(st) { load(); data.streak = st; save(); }

  function setAccent(name) {
    load();
    data.settings.accent = name;
    save();
  }

  function getAccent() {
    load();
    return data.settings.accent || 'pink';
  }

  return {
    load, save,
    recordFicheView, isFicheSeen,
    getQuizMeta, recordQuizAnswer, getErrorIds,
    domainStats, globalCounts,
    exportJSON, importJSON,
    setAccent, getAccent,
    isFavorite, toggleFavorite, favoriteIds,
    getDaily, setDaily, getStreakRaw, setStreakRaw,
  };
})();
