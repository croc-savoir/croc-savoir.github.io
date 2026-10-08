/* ===================== Dragon Tour =====================
 * Réviser les pays, leurs drapeaux et leurs capitales.
 * Écran « dragon » à niveaux internes :
 *   groupes (monde, continents, territoires) → modes → type → session.
 *
 * Pas de paquets : chaque session est un flux sans fin, mélangé, piloté par
 * une répétition espacée commune à tous les modes. Chaque pays a deux suivis
 * séparés : drapeau (f) et capitale (c).
 *   - raté          → revient 5 à 8 cartes plus tard ;
 *   - su 1 fois     → revient ~20 cartes plus tard ;
 *   - su 2 fois     → revient ~60 cartes plus tard ;
 *   - su 3 fois     → acquis : revient dans 1 jour, puis 3, puis de plus en plus loin.
 * L'horloge en cartes (Store.dragonClock) avance à chaque réponse, tous modes confondus.
 * ======================================================== */
const Dragon = (() => {
  const FLAG_DIR = 'data/dragon-tour/drapeaux/';

  const GROUPS = [
    { id: 'monde', emoji: '🌍', label: 'Le monde entier', desc: 'Les 195 pays, tous continents mélangés.' },
    { id: 'europe', emoji: '🏰', label: 'Europe' },
    { id: 'afrique', emoji: '🦁', label: 'Afrique' },
    { id: 'asie', emoji: '🏯', label: 'Asie' },
    { id: 'amerique-nord', emoji: '🗽', label: 'Amérique du Nord', desc: 'Avec l’Amérique centrale et les Caraïbes.' },
    { id: 'amerique-sud', emoji: '🦜', label: 'Amérique du Sud' },
    { id: 'oceanie', emoji: '🏝️', label: 'Océanie' },
    { id: 'territoires', emoji: '🏳️', label: 'Territoires', desc: 'Kosovo, Taïwan, Groenland, Écosse… des drapeaux hors des 195 pays.' },
  ];

  const MODES = [
    { id: 'decouvrir', emoji: '🃏', label: 'Découvrir', desc: 'Des cartes à retourner, puis « Je savais » ou « À revoir ».' },
    { id: 'entrainer', emoji: '🎯', label: 'S’entraîner', desc: 'QCM à 4 choix : drapeaux, pays et capitales dans tous les sens.' },
    { id: 'maitriser', emoji: '✍️', label: 'Maîtriser', desc: 'Tape toi-même la réponse. Les accents et petites fautes sont tolérés.' },
  ];

  const KINDS = {
    decouvrir: [
      { id: 'mix', emoji: '🎲', label: 'Tout mélangé', desc: 'Cartes drapeaux et cartes capitales.' },
      { id: 'drapeaux', emoji: '🏳️', label: 'Drapeaux', desc: 'Le drapeau d’un côté, le pays de l’autre.' },
      { id: 'capitales', emoji: '🏛️', label: 'Capitales', desc: 'Le pays d’un côté, sa capitale de l’autre.' },
    ],
    entrainer: [
      { id: 'mix', emoji: '🎲', label: 'Tout mélangé', desc: 'Drapeaux et capitales, dans tous les sens.' },
      { id: 'drapeaux', emoji: '🏳️', label: 'Drapeaux', desc: 'Reconnaître un drapeau, ou retrouver celui d’un pays.' },
      { id: 'capitales', emoji: '🏛️', label: 'Capitales', desc: 'Capitale d’un pays, ou pays d’une capitale.' },
    ],
    maitriser: [
      { id: 'mix', emoji: '🎲', label: 'Tout mélangé', desc: 'Pays à partir du drapeau, capitales dans les deux sens.' },
      { id: 'drapeaux', emoji: '🏳️', label: 'Drapeaux', desc: 'Écris le nom du pays à partir de son drapeau.' },
      { id: 'capitales', emoji: '🏛️', label: 'Capitales', desc: 'Écris la capitale d’un pays, ou le pays d’une capitale.' },
    ],
  };

  let pays = null;          // liste complète
  let byCode = null;
  let flagsPrefetched = false;
  let state = { level: 'groups', groupId: null };

  function escapeHTML(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function load() {
    if (pays) return pays;
    const res = await fetch('data/dragon-tour/pays.json');
    pays = await res.json();
    byCode = new Map(pays.map(p => [p.code, p]));
    return pays;
  }

  // Télécharge tous les drapeaux en arrière-plan pour le hors-ligne.
  function prefetchFlags() {
    if (flagsPrefetched || !navigator.onLine) return;
    flagsPrefetched = true;
    pays.forEach(p => { fetch(FLAG_DIR + p.code + '.svg').catch(() => {}); });
  }

  function membersOf(groupId) {
    if (groupId === 'monde') return pays.filter(p => !p.territoire);
    if (groupId === 'territoires') return pays.filter(p => p.territoire);
    return pays.filter(p => p.continent === groupId && !p.territoire);
  }

  function group(id) { return GROUPS.find(g => g.id === id); }

  function flagImg(p, cls = 'dt-flag') {
    return `<img class="${cls}" src="${FLAG_DIR}${p.code}.svg" alt="Drapeau" draggable="false">`;
  }

  // Cartes d'un groupe : un suivi drapeau par pays, un suivi capitale s'il y en a une.
  function itemsOf(groupId, kind = 'mix') {
    const items = [];
    membersOf(groupId).forEach(p => {
      if (kind !== 'capitales') items.push({ code: p.code, track: 'f' });
      if (kind !== 'drapeaux' && p.capitale) items.push({ code: p.code, track: 'c' });
    });
    return items;
  }

  const keyOf = it => it.code + ':' + it.track;
  const metaOf = it => Store.getDragonTrack(it.code, it.track);

  // ---------- Répétition espacée ----------
  const GRAD = 3;                                  // réussites d'affilée pour passer aux jours
  const LEARN_GAPS = [[5, 8], [16, 24], [50, 70]]; // écart en cartes selon le nombre de réussites
  const FRAGILE_MAX = 6;                           // pas de nouveau pays si autant sont encore fragiles
  const STALE_MS = 6 * 3600000;                    // pays en cours laissé de côté depuis 6 h → à revoir
  const DAY = 86400000;

  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const isLearning = m => (m.reps || 0) < GRAD;
  function isDue(m, clock, now) {
    return isLearning(m) ? (m.nextAt == null || m.nextAt <= clock) : new Date(m.due).getTime() <= now;
  }

  // Calcule le nouveau suivi après une réponse et l'enregistre (l'horloge avance d'une carte).
  // Une carte revue en avance (proposée faute de mieux) ne monte pas si elle est revue trop tôt.
  function answer(it, known, opts = {}) {
    const m = metaOf(it);
    const clock = Store.dragonClock();
    const now = Date.now();
    const t = m ? { ...m } : { reps: 0, ef: 2.5, interval: 0, seen: 0 };
    t.seen = (t.seen || 0) + 1;
    t.lastSeen = new Date(now).toISOString();
    t.lastKnown = known;
    if (opts.typed && known) t.typedOk = true;

    if (!known) {
      if (!isLearning(t)) t.ef = Math.max(1.3, (t.ef || 2.5) - 0.2);
      t.reps = 0;
      t.interval = 0;
      delete t.due;
      t.nextAt = clock + rand(...LEARN_GAPS[0]);
    } else {
      let advance = true;
      if (m && !isDue(m, clock, now)) {
        if (isLearning(m)) {
          const last = m.lastAt != null ? m.lastAt : -1000;
          advance = clock - last >= (m.nextAt - last) / 2;
        } else advance = false;
      }
      if (advance) {
        t.reps = (t.reps || 0) + 1;
        if (t.reps < GRAD) {
          t.nextAt = clock + rand(...LEARN_GAPS[t.reps]);
        } else {
          delete t.nextAt;
          t.interval = t.reps === GRAD ? 1 : t.reps === GRAD + 1 ? 3 : Math.round((t.interval || 3) * (t.ef || 2.5));
          t.due = new Date(now + t.interval * DAY).toISOString();
        }
      }
    }
    t.lastAt = clock;
    Store.saveDragonTrack(it.code, it.track, t);
  }

  // Choisit la prochaine carte d'une session.
  // Ordre : pays en cours dont l'écart est écoulé → nouveaux pays (au compte-gouttes) /
  // pays acquis dont le jour est venu → sinon la carte la plus proche de son échéance.
  // Jamais un des 3 derniers pays montrés (drapeau et capitale comptent pour le même pays).
  // En révision, chaque carte retenue au départ est posée au moins une fois.
  function pickNext(se, avoidN = 3) {
    const clock = Store.dragonClock();
    const now = Date.now();
    const codes = new Set(se.pool.map(it => it.code));
    const avoid = new Set(avoidN ? se.recent.slice(-Math.min(avoidN, codes.size - 1)) : []);
    const entries = se.pool
      .filter(it => !avoid.has(it.code))
      .map(it => ({ it, m: metaOf(it) }));
    const due = e => isDue(e.m, clock, now) || (se.revision && !se.asked.has(keyOf(e.it)));

    const learningDue = entries.filter(e => e.m && isLearning(e.m) && due(e))
      .sort((a, b) => (a.m.nextAt || 0) - (b.m.nextAt || 0));
    if (learningDue.length) return learningDue[0].it;

    const gradDue = entries.filter(e => e.m && !isLearning(e.m) && due(e))
      .sort((a, b) => new Date(a.m.due) - new Date(b.m.due));
    const fresh = se.allowNew ? entries.filter(e => !e.m) : [];
    const fragile = se.pool.filter(it => { const m = metaOf(it); return m && isLearning(m) && (m.reps || 0) <= 1; }).length;
    const pickFresh = () => { se.sinceNew = 0; return fresh[Math.floor(Math.random() * fresh.length)].it; };

    if (fresh.length && fragile < FRAGILE_MAX && (!gradDue.length || se.sinceNew >= 2)) return pickFresh();
    if (gradDue.length) return gradDue[0].it;
    if (fresh.length) return pickFresh();

    // Révision : on ne repose que ce qui a été raté pendant la session, avant de s'arrêter.
    if (se.revision) {
      const again = entries.filter(e => se.missed.has(keyOf(e.it)) && e.m && e.m.lastKnown === false)
        .sort((a, b) => (a.m.nextAt || 0) - (b.m.nextAt || 0));
      if (again.length) return again[0].it;
      return avoidN ? pickNext(se, 0) : null;
    }

    // Tout est vu et rien n'est échu : la carte la plus proche de son échéance.
    const seen = entries.filter(e => e.m);
    if (!seen.length) return se.pool.find(it => it.code !== se.recent[se.recent.length - 1]) || se.pool[0] || null;
    const soon = e => isLearning(e.m) ? (e.m.nextAt - clock) * 1e3 : new Date(e.m.due).getTime() - now + 1e12;
    return seen.sort((a, b) => soon(a) - soon(b))[0].it;
  }

  // À revoir dans la « Révision du jour » : pays acquis dont le jour est venu,
  // ou pays en cours dont l'écart est écoulé / laissés de côté depuis quelques heures.
  function dueForRevision(m, clock, now) {
    if (!isLearning(m)) return new Date(m.due).getTime() <= now;
    return m.nextAt == null || m.nextAt <= clock || now - new Date(m.lastSeen || 0).getTime() > STALE_MS;
  }

  function revisionItems() {
    const clock = Store.dragonClock();
    const now = Date.now();
    const all = Store.dragonProgress();
    const out = [];
    for (const code in all) {
      for (const track of ['f', 'c']) {
        const m = all[code][track];
        if (m && dueForRevision(m, clock, now)) out.push({ code, track });
      }
    }
    return out;
  }

  // Ne lit que la progression enregistrée (pas besoin de charger la liste des pays).
  function hasDue() { return revisionItems().length > 0; }

  // ---------- Navigation interne ----------
  function goDeeper(next) {
    const prev = { ...state };
    App.pushInner(() => { state = prev; render(); });
    state = next;
    render();
  }

  async function init() {
    const root = document.getElementById('dragon-content');
    state = { level: 'groups', groupId: null };
    if (!pays) {
      root.innerHTML = '<div class="empty-state"><div class="empty-state__emoji">🐉</div><div>Chargement…</div></div>';
      try { await load(); } catch (e) {
        root.innerHTML = '<div class="empty-state"><div class="empty-state__emoji">📡</div><div>Impossible de charger les pays. Vérifie ta connexion.</div></div>';
        return;
      }
    }
    prefetchFlags();
    render();
  }

  function render() {
    const root = document.getElementById('dragon-content');
    root.innerHTML = '';
    window.scrollTo(0, 0);
    if (state.level === 'groups') return renderGroups(root);
    if (state.level === 'modes') return renderModes(root);
    if (state.level === 'setup') return renderSetup(root);
    if (state.level === 'run' || state.level === 'revision') return renderRun(root);
  }

  // ---------- Groupes ----------
  function renderGroups(root) {
    const intro = document.createElement('p');
    intro.className = 'mode-intro';
    intro.textContent = 'Quelle partie du monde veux-tu explorer ?';
    root.appendChild(intro);

    const list = document.createElement('div');
    list.className = 'dt-groups';
    const rev = document.createElement('button');
    rev.type = 'button';
    rev.className = 'dt-group dt-group--wide dt-revision' + (hasDue() ? ' is-due' : ' is-idle');
    rev.innerHTML = revisionCardHTML();
    rev.addEventListener('click', () => { if (hasDue()) goDeeper({ level: 'revision', groupId: 'monde', session: null }); });
    list.appendChild(rev);
    GROUPS.forEach(g => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dt-group' + (g.id === 'monde' ? ' dt-group--wide dt-group--monde' : '') + (g.id === 'territoires' ? ' dt-group--wide dt-group--terr' : '');
      btn.innerHTML = `
        <span class="dt-group__emoji">${g.emoji}</span>
        <span class="dt-group__text">
          <span class="dt-group__label">${escapeHTML(g.label)}</span>
          ${g.desc ? `<span class="dt-group__desc">${escapeHTML(g.desc)}</span>` : ''}
          ${dotsHTML(groupMastery(g.id))}
        </span>`;
      btn.addEventListener('click', () => goDeeper({ level: 'modes', groupId: g.id }));
      list.appendChild(btn);
    });
    root.appendChild(list);
  }

  // ---------- Modes ----------
  function renderModes(root) {
    const g = group(state.groupId);
    const title = document.createElement('div');
    title.className = 'crumb-row';
    title.innerHTML = `<span class="crumb-title">${g.emoji} ${escapeHTML(g.label)}</span><span class="dt-mastery">${dotsHTML(groupMastery(g.id))}<span>${masteryWord(groupMastery(g.id))}</span></span>`;
    root.appendChild(title);
    root.appendChild(cardList(MODES, m => goDeeper({ level: 'setup', groupId: state.groupId, mode: m.id })));
  }

  function cardList(entries, onPick) {
    const list = document.createElement('div');
    list.className = 'mode-list';
    entries.forEach(e => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-card';
      btn.innerHTML = `
        <span class="mode-card__icon">${e.emoji}</span>
        <span class="mode-card__text">
          <span class="mode-card__title">${e.label}</span>
          <span class="mode-card__desc">${e.desc}</span>
        </span>
        <span class="mode-card__arrow">›</span>`;
      btn.addEventListener('click', () => onPick(e));
      list.appendChild(btn);
    });
    return list;
  }

  // ---------- Choix du type (drapeaux / capitales / mélangé) ----------
  function renderSetup(root) {
    const g = group(state.groupId);
    const mode = MODES.find(m => m.id === state.mode);
    const title = document.createElement('div');
    title.className = 'crumb-row';
    title.innerHTML = `<span class="crumb-title">${mode.emoji} ${mode.label} · ${escapeHTML(g.label)}</span>`;
    root.appendChild(title);
    root.appendChild(cardList(KINDS[state.mode], k => goDeeper({ level: 'run', groupId: state.groupId, mode: state.mode, kind: k.id, session: null })));
  }

  // ---------- Session (flux sans fin) ----------
  function newSession() {
    const base = { recent: [], asked: new Set(), sinceNew: 0, count: 0, correct: 0, missed: new Map(), current: null, ended: false };
    if (state.level === 'revision') {
      const due = revisionItems().filter(it => byCode.has(it.code) && (it.track === 'f' || byCode.get(it.code).capitale));
      return { ...base, revision: true, mode: 'adaptatif', allowNew: false, pool: due };
    }
    return { ...base, mode: state.mode, allowNew: true, pool: itemsOf(state.groupId, state.kind) };
  }

  const norm = s => QuizGen.normalize(s);
  // La capitale ne fait que répéter le nom du pays (Luxembourg, Djibouti…) : « capitale → pays » serait trop facile.
  const trivialCapital = p => !p.capitale || norm(p.capitale).includes(norm(p.nom)) || norm(p.nom).includes(norm(p.capitale));

  // Forme de la question selon le suivi et le mode.
  function questionType(it, mode) {
    const p = byCode.get(it.code);
    if (mode === 'adaptatif') mode = level(it) >= 2 ? 'maitriser' : 'entrainer';
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const capTypes = trivialCapital(p) ? ['pays2cap'] : ['pays2cap', 'cap2pays'];
    if (mode === 'decouvrir') return { ui: 'card', type: it.track === 'f' ? 'flagcard' : 'capcard' };
    if (mode === 'maitriser') return { ui: 'typed', type: it.track === 'f' ? 'flag2pays' : pick(capTypes) };
    return { ui: 'qcm', type: it.track === 'f' ? pick(['flag2pays', 'pays2flag']) : pick(capTypes) };
  }

  function renderRun(root) {
    if (!state.session) state.session = newSession();
    const se = state.session;
    if (se.ended) return renderEnd(root, se);

    if (!se.current) {
      const it = se.pool.length ? pickNext(se) : null;
      if (!it) {
        if (!se.count && !se.revision) {
          root.innerHTML = '<div class="empty-state"><div class="empty-state__emoji">🤷</div><div>Pas de question possible pour ce groupe.</div></div>';
          return;
        }
        se.ended = true;
        se.allDone = true;
        return renderEnd(root, se);
      }
      se.current = { it, ...questionType(it, se.mode), result: null };
      se.recent.push(it.code);
      se.asked.add(keyOf(it));
      se.sinceNew += 1;
    }

    root.appendChild(runHead(se));
    const cur = se.current;
    if (cur.ui === 'card') renderFlipCard(root, se, cur);
    else if (cur.ui === 'typed') renderTyped(root, se, cur);
    else renderQcm(root, se, cur);
  }

  function runHead(se) {
    const head = document.createElement('div');
    head.className = 'dt-run-head';
    const mastery = se.revision ? '' : dotsHTML(groupMastery(state.groupId));
    head.innerHTML = `
      <span class="dt-run-count">${mastery}<span>${se.count} carte${se.count > 1 ? 's' : ''} · ${se.correct} ✓</span></span>
      <button type="button" class="btn btn-ghost dt-run-stop">Terminer</button>`;
    head.querySelector('.dt-run-stop').addEventListener('click', () => {
      if (!se.count) return App.back();
      se.ended = true;
      render();
    });
    return head;
  }

  // Enregistre la réponse de la carte en cours.
  function record(se, cur, known, opts) {
    cur.result = known;
    answer(cur.it, known, opts);
    se.count += 1;
    if (known) se.correct += 1;
    else se.missed.set(keyOf(cur.it), cur.it);
  }

  function nextCard(se) { se.current = null; render(); }

  function nextButton(root, se) {
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-primary btn-next';
    next.textContent = 'Suivante →';
    next.addEventListener('click', () => nextCard(se));
    root.appendChild(next);
    return next;
  }

  function answerHTML(p, ok, title, detail = '') {
    return `
      ${flagImg(p, 'dt-flag dt-flag--tiny')}
      <div class="dt-answer__text">
        <strong>${title || (ok ? '✓ Bonne réponse' : '✕ Raté')}</strong>
        <span>${escapeHTML(p.nom)}${p.capitale ? ' · ' + escapeHTML(p.capitale) : ''}</span>
        ${detail}
        ${p.note ? `<small>${escapeHTML(p.note)}</small>` : ''}
      </div>`;
  }

  // ---------- Découvrir : carte à retourner ----------
  function renderFlipCard(root, se, cur) {
    const p = byCode.get(cur.it.code);
    const front = cur.type === 'flagcard'
      ? `${flagImg(p)}
          <p class="dt-card__prompt">Quel est ce pays ?</p>`
      : `${flagImg(p, 'dt-flag dt-flag--small')}
          <p class="dt-card__prompt">Quelle est la capitale ${escapeHTML(p.de)} ?</p>`;
    const card = document.createElement('div');
    card.className = 'dt-card';
    card.innerHTML = `
      <div class="dt-card__inner">
        <div class="dt-card__face dt-card__front">
          ${front}
          <p class="dt-card__hint">Touche la carte pour la retourner</p>
        </div>
        <div class="dt-card__face dt-card__back">
          ${flagImg(p, 'dt-flag dt-flag--small')}
          <h2 class="dt-card__name">${escapeHTML(p.nom)}</h2>
          ${p.capitale ? `<p class="dt-card__cap"><span>Capitale</span>${escapeHTML(p.capitale)}</p>` : '<p class="dt-card__cap"><span>Capitale</span>—</p>'}
          ${p.note ? `<p class="dt-card__note">${escapeHTML(p.note)}</p>` : ''}
        </div>
      </div>`;
    root.appendChild(card);

    const actions = document.createElement('div');
    actions.className = 'dt-actions';
    actions.innerHTML = `
      <button type="button" class="btn btn-ghost dt-btn-again">😕 À revoir</button>
      <button type="button" class="btn btn-primary dt-btn-know">✅ Je savais</button>`;
    actions.hidden = true;
    root.appendChild(actions);

    card.addEventListener('click', () => {
      card.classList.add('is-flipped');
      actions.hidden = false;
    });
    const choose = known => { record(se, cur, known); nextCard(se); };
    actions.querySelector('.dt-btn-know').addEventListener('click', () => choose(true));
    actions.querySelector('.dt-btn-again').addEventListener('click', () => choose(false));
  }

  // ---------- S'entraîner : QCM ----------
  // 3 mauvaises réponses, de préférence du même continent, sans doublon d'affichage.
  function distractors(p, type) {
    const sameTerr = !!p.territoire;
    let pool = pays.filter(x => x.code !== p.code && x.continent === p.continent && !!x.territoire === sameTerr);
    if (pool.length < 6) pool = pays.filter(x => x.code !== p.code && x.continent === p.continent);
    if (pool.length < 6) pool = pays.filter(x => x.code !== p.code && !x.territoire);
    if (type === 'pays2cap') pool = pool.filter(x => x.capitale);
    const shown = x => type === 'pays2cap' ? x.capitale : x.nom;
    const seen = new Set([norm(shown(p))]);
    const out = [];
    for (const x of QuizGen.shuffle(pool)) {
      const key = norm(shown(x));
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(x);
      if (out.length === 3) break;
    }
    return out;
  }

  function renderQcm(root, se, cur) {
    const p = byCode.get(cur.it.code);
    const type = cur.type;
    if (!cur.options) cur.options = QuizGen.shuffle([p, ...distractors(p, type)]).map(o => o.code);

    const card = document.createElement('div');
    card.className = 'quiz-card dt-q';
    let prompt = '';
    if (type === 'flag2pays') prompt = `${flagImg(p)}<p class="quiz-card__question dt-q__text">Quel est ce pays ?</p>`;
    if (type === 'pays2flag') prompt = `<p class="quiz-card__question dt-q__text">Quel est le drapeau ${escapeHTML(p.de)} ?</p>`;
    if (type === 'pays2cap') prompt = `<p class="quiz-card__question dt-q__text">Quelle est la capitale ${escapeHTML(p.de)} ?</p>`;
    if (type === 'cap2pays') prompt = `<p class="quiz-card__question dt-q__text">${escapeHTML(p.capitale)} est la capitale de quel pays ?</p>`;
    card.innerHTML = prompt;

    const list = document.createElement('div');
    list.className = type === 'pays2flag' ? 'dt-flag-grid' : 'opt-list';
    cur.options.forEach(code => {
      const o = byCode.get(code);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = type === 'pays2flag' ? 'dt-flag-opt' : 'opt-btn';
      btn.innerHTML = type === 'pays2flag' ? flagImg(o, 'dt-flag dt-flag--opt') : escapeHTML(type === 'pays2cap' ? o.capitale : o.nom);
      btn.dataset.code = o.code;
      list.appendChild(btn);
    });
    card.appendChild(list);
    root.appendChild(card);

    const showResult = (picked) => {
      [...list.children].forEach(b => {
        b.disabled = true;
        if (b.dataset.code === p.code) b.classList.add('is-correct');
        else if (b.dataset.code === picked) b.classList.add('is-wrong');
        else b.classList.add('is-dim');
      });
      const info = document.createElement('div');
      info.className = 'dt-answer ' + (cur.result ? 'is-correct' : 'is-wrong');
      info.innerHTML = answerHTML(p, cur.result);
      card.appendChild(info);
      nextButton(root, se);
    };

    if (cur.result != null) return showResult(cur.picked);
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || cur.result != null) return;
      cur.picked = btn.dataset.code;
      record(se, cur, cur.picked === p.code);
      showResult(cur.picked);
    });
  }

  // ---------- Maîtriser : réponse tapée ----------
  // Comparaison tolérante : sans accents, majuscules ni articles ; quelques fautes selon la longueur.
  function canon(s) {
    return norm(s).replace(/\b(le|la|les|l|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function matchTyped(guess, answers) {
    const g = canon(guess);
    if (!g) return { ok: false, exact: false };
    for (const a of answers) {
      const c = canon(a);
      if (!c) continue;
      if (g === c || g.replace(/ /g, '') === c.replace(/ /g, '')) return { ok: true, exact: true, answer: a };
      const tol = c.length <= 4 ? 0 : c.length <= 8 ? 1 : 2;
      if (QuizGen.levenshtein(g.replace(/ /g, ''), c.replace(/ /g, '')) <= tol) return { ok: true, exact: false, answer: a };
    }
    return { ok: false, exact: false };
  }

  function renderTyped(root, se, cur) {
    const p = byCode.get(cur.it.code);
    const type = cur.type;
    const wantCapital = type === 'pays2cap';
    const answers = wantCapital
      ? [p.capitale, ...(p.autresCapitales || [])]
      : [p.nom, ...(p.autresNoms || [])];

    const card = document.createElement('div');
    card.className = 'quiz-card dt-q';
    let prompt = '';
    if (type === 'flag2pays') prompt = `${flagImg(p)}<p class="quiz-card__question dt-q__text">Quel est ce pays ?</p>`;
    if (type === 'pays2cap') prompt = `<p class="quiz-card__question dt-q__text">Quelle est la capitale ${escapeHTML(p.de)} ?</p>`;
    if (type === 'cap2pays') prompt = `<p class="quiz-card__question dt-q__text">${escapeHTML(p.capitale)} est la capitale de quel pays ?</p>`;
    card.innerHTML = prompt + `
      <form class="dt-type" autocomplete="off">
        <input class="dt-type__input" type="text" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
          placeholder="${wantCapital ? 'Écris la capitale…' : 'Écris le pays…'}" aria-label="Ta réponse">
        <button class="btn btn-primary dt-type__ok" type="submit">Valider</button>
      </form>
      <button class="dt-type__skip" type="button">Je ne sais pas</button>`;
    root.appendChild(card);

    const form = card.querySelector('.dt-type');
    const input = card.querySelector('.dt-type__input');
    const skip = card.querySelector('.dt-type__skip');

    const showResult = () => {
      const res = cur.res;
      input.value = cur.guess || '';
      input.disabled = true;
      card.querySelector('.dt-type__ok').disabled = true;
      skip.hidden = true;
      input.classList.add(res.ok ? 'is-correct' : 'is-wrong');
      let detail = '';
      if (res.ok && !res.exact) detail = `<small>Orthographe exacte : <strong>${escapeHTML(res.answer)}</strong></small>`;
      if (!res.ok) detail = `<small>La bonne réponse : <strong>${escapeHTML(answers[0])}</strong>${answers.length > 1 ? ` (ou ${answers.slice(1).map(escapeHTML).join(', ')})` : ''}</small>`;
      const info = document.createElement('div');
      info.className = 'dt-answer ' + (res.ok ? 'is-correct' : 'is-wrong');
      info.innerHTML = answerHTML(p, res.ok, res.ok ? '' : cur.guess == null ? '✕ Pas grave, retiens-le' : '', detail);
      card.appendChild(info);
      nextButton(root, se).focus();
    };

    if (cur.result != null) return showResult();

    const finish = (guess) => {
      if (cur.result != null) return;
      cur.guess = guess;
      cur.res = guess == null ? { ok: false, exact: false } : matchTyped(guess, answers);
      record(se, cur, cur.res.ok, { typed: true });
      showResult();
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim()) { input.focus(); return; }
      finish(input.value);
    });
    skip.addEventListener('click', () => finish(null));
    input.focus();
  }

  // ---------- Bilan ----------
  function renderEnd(root, se) {
    const div = document.createElement('div');
    div.className = 'daily-end';
    const { count, correct } = se;
    if (se.revision && se.allDone && !count) {
      div.innerHTML = `
        <div class="daily-end__emoji">✅</div>
        <h2 class="daily-end__title">Tout est à jour !</h2>
        <p class="daily-end__msg">Aucun pays à revoir pour l’instant. Reviens demain, ou découvre de nouveaux pays.</p>`;
    } else {
      const msg = se.revision && se.allDone ? 'Révision terminée, tout est à jour !'
        : correct === count ? 'Sans faute, bravo !'
          : correct >= count * 0.8 ? 'Très joli !'
            : correct >= count / 2 ? 'Bien joué, continue !' : 'Chaque carte te fait progresser.';
      div.innerHTML = `
        <div class="daily-end__emoji">${correct === count ? '🏆' : '🐉'}</div>
        <h2 class="daily-end__title">${correct} / ${count}</h2>
        <p class="daily-end__msg">${msg}</p>`;
    }
    if (se.missed.size) {
      const box = document.createElement('div');
      box.className = 'dt-missed';
      box.innerHTML = '<h3>À retenir</h3>' + [...se.missed.values()].map(it => {
        const p = byCode.get(it.code);
        const what = it.track === 'f' ? 'drapeau' : 'capitale';
        return `<div class="dt-missed__row">${flagImg(p, 'dt-flag dt-flag--tiny')}<span><strong>${escapeHTML(p.nom)}</strong>${p.capitale ? ' · ' + escapeHTML(p.capitale) : ''} <small class="dt-missed__what">${what}</small></span></div>`;
      }).join('');
      div.appendChild(box);
    }
    if (!se.allDone) {
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'btn btn-primary daily-end__btn';
      again.textContent = '▶️ Continuer';
      again.addEventListener('click', () => { se.ended = false; render(); });
      div.appendChild(again);
    }
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn ' + (se.allDone ? 'btn-primary' : 'btn-ghost') + ' daily-end__btn';
    back.textContent = se.revision ? 'Retour à Dragon Tour' : 'Changer de type';
    back.addEventListener('click', () => App.back());
    div.appendChild(back);
    root.appendChild(div);
  }

  // ---------- Maîtrise (0 à 3 par carte, points par groupe) ----------
  // 0 : jamais su · 1 et 2 : bonnes réponses d'affilée · 3 : acquis ET déjà tapé juste en « Maîtriser ».
  function level(it) {
    const m = metaOf(it);
    if (!m || !m.reps) return 0;
    if (m.reps >= GRAD && m.typedOk) return 3;
    return Math.min(m.reps, 2);
  }

  function groupMastery(groupId) {
    const items = itemsOf(groupId);
    if (!items.length) return 0;
    const sum = items.reduce((s, it) => s + level(it), 0);
    return sum / (items.length * 3);
  }

  function dotsHTML(frac) {
    // Le premier point s'allume dès qu'on a commencé le groupe.
    const on = frac > 0 ? Math.max(1, Math.round(frac * 4)) : 0;
    let h = '<span class="dt-dots" aria-label="Maîtrise">';
    for (let i = 0; i < 4; i++) h += `<span class="dt-dot${i < on ? ' is-on' : ''}"></span>`;
    return h + '</span>';
  }

  function masteryWord(frac) {
    if (frac >= 0.999) return 'Maîtrisé';
    if (frac >= 0.625) return 'Avancé';
    if (frac >= 0.375) return 'En progrès';
    if (frac > 0) return 'Débutant';
    return 'À découvrir';
  }

  // ---------- Révision du jour ----------
  function revisionCardHTML() {
    const seenAny = Object.keys(Store.dragonProgress()).length > 0;
    const due = hasDue();
    const desc = due ? 'À revoir aujourd’hui · tous continents mélangés'
      : seenAny ? '✓ Tout est à jour, reviens plus tard'
        : 'Découvre d’abord quelques pays dans un continent';
    return `
      <span class="dt-group__emoji">🔁</span>
      <span class="dt-group__text">
        <span class="dt-group__label">Révision du jour</span>
        <span class="dt-group__desc">${desc}</span>
      </span>
      ${due ? '<span class="dt-revision__arrow">›</span>' : ''}`;
  }

  return { init, hasDue };
})();
