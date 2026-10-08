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
      dragon: {},    // code pays -> { f: suivi drapeau, c: suivi capitale } (cf. dragon.js)
      dragonClock: 0, // nombre total de cartes Dragon Tour répondues (horloge de la répétition espacée)
      favorites: {}, // ficheId -> date d'ajout (ISO)
      daily: null,  // session du jour en cours : { date, ficheIds, quizIds, step, results, done }
      streak: { count: 0, lastDate: null }, // jours consécutifs avec une bouchée terminée
      quizJour: null, // quiz du jour : { date, ids, results, done, score }
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
      if (!data.dragon) data.dragon = {};
      migrateDragon();
      if (!('quizJour' in data)) data.quizJour = null;
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
    if (!data.dragon) data.dragon = {};
    migrateDragon();
    save();
  }

  // ---------- Dragon Tour ----------
  // Ancien format (un seul suivi par pays, SM-2 en jours) → deux suivis : drapeau (f) et capitale (c).
  // L'ancien suivi est recopié sur les deux pour ne rien perdre. Les pays pas encore
  // acquis (moins de 3 réussites d'affilée) reviennent vite, étalés sur les premières cartes.
  const NO_CAPITAL = ['hk', 'mo'];
  function migrateDragon() {
    if (typeof data.dragonClock !== 'number') data.dragonClock = 0;
    for (const code in data.dragon) {
      const old = data.dragon[code];
      if (!old || old.f || old.c) continue;
      const track = () => {
        const t = {
          reps: old.reps || 0, ef: old.ef || 2.5, interval: old.interval || 0,
          seen: old.seen || 0, lastKnown: old.lastKnown, lastSeen: old.lastSeen,
          lastAt: -1000, typedOk: !!old.typedOk,
        };
        if (t.reps >= 3) t.due = old.due || new Date().toISOString();
        else { t.nextAt = Math.floor(Math.random() * 15); t.interval = 0; }
        return t;
      };
      data.dragon[code] = NO_CAPITAL.includes(code) ? { f: track() } : { f: track(), c: track() };
    }
  }

  function dragonProgress() { load(); return data.dragon; }
  function dragonClock() { load(); return data.dragonClock; }
  // track : 'f' (drapeau) ou 'c' (capitale).
  function getDragonTrack(code, track) { load(); return (data.dragon[code] && data.dragon[code][track]) || null; }
  // Enregistre le suivi recalculé par Dragon et fait avancer l'horloge d'une carte.
  function saveDragonTrack(code, track, meta) {
    load();
    if (!data.dragon[code]) data.dragon[code] = {};
    data.dragon[code][track] = meta;
    data.dragonClock += 1;
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
  function getQuizJour() { load(); return data.quizJour || null; }
  function setQuizJour(q) { load(); data.quizJour = q; save(); }

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
    dragonProgress, dragonClock, getDragonTrack, saveDragonTrack,
    isFavorite, toggleFavorite, favoriteIds,
    getDaily, setDaily, getStreakRaw, setStreakRaw,
    getQuizJour, setQuizJour,
  };
})();
