/* ===================== Dragon Tour =====================
 * Réviser les pays, leurs drapeaux et leurs capitales.
 * Écran « dragon » à niveaux internes :
 *   groupes (monde, continents, territoires) → modes → session.
 * Mode 🃏 Découvrir : paquets de 10 cartes à retourner (drapeau au recto,
 * pays + capitale au verso), « Je savais » / « À revoir ».
 * ======================================================== */
const Dragon = (() => {
  const PACK_SIZE = 10;
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

  let pays = null;          // liste complète
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
    if (state.level === 'decouvrir') return renderDecouvrir(root);
    if (state.level === 'entrainer') return renderEntrainerSetup(root);
    if (state.level === 'entrainer-run') return renderEntrainer(root);
    if (state.level === 'maitriser') return renderMaitriserSetup(root);
    if (state.level === 'maitriser-run') return renderMaitriser(root);
    if (state.level === 'revision') return renderRevision(root);
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
    rev.addEventListener('click', () => { if (hasDue()) goDeeper({ level: 'revision', groupId: 'monde', series: null }); });
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

    const modes = [
      { id: 'decouvrir', emoji: '🃏', label: 'Découvrir', desc: 'Des cartes à retourner : le drapeau d’un côté, le pays et sa capitale de l’autre.' },
      { id: 'entrainer', emoji: '🎯', label: 'S’entraîner', desc: 'QCM à 4 choix : drapeaux, pays et capitales dans tous les sens.' },
      { id: 'maitriser', emoji: '✍️', label: 'Maîtriser', desc: 'Tape toi-même la réponse. Les accents et petites fautes sont tolérés.' },
    ];
    const list = document.createElement('div');
    list.className = 'mode-list';
    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-card' + (m.soon ? ' is-soon' : '');
      btn.disabled = !!m.soon;
      btn.innerHTML = `
        <span class="mode-card__icon">${m.emoji}</span>
        <span class="mode-card__text">
          <span class="mode-card__title">${m.label}${m.soon ? ' <span class="dt-soon">bientôt</span>' : ''}</span>
          <span class="mode-card__desc">${m.desc}</span>
        </span>
        ${m.soon ? '' : '<span class="mode-card__arrow">›</span>'}`;
      if (!m.soon) btn.addEventListener('click', () => goDeeper({ level: m.id, groupId: state.groupId, pack: null }));
      list.appendChild(btn);
    });
    root.appendChild(list);
  }

  // ---------- Découvrir ----------
  // Prochain paquet : jamais vus d'abord, puis ceux « à revoir », puis le reste.
  function buildPack(groupId) {
    const members = QuizGen.shuffle(membersOf(groupId));
    const rank = p => {
      const m = Store.getDragonMeta(p.code);
      if (!m) return 0;
      if (m.lastKnown === false) return 1;
      return 2;
    };
    members.sort((a, b) => rank(a) - rank(b));
    return members.slice(0, PACK_SIZE).map(p => p.code);
  }

  function renderDecouvrir(root) {
    if (!state.pack) {
      state.pack = { queue: buildPack(state.groupId), done: 0, firstTry: 0, missed: new Set() };
    }
    const pack = state.pack;
    const total = pack.done + pack.queue.length;

    if (!pack.queue.length) return renderPackEnd(root, pack);

    const bar = document.createElement('div');
    bar.className = 'daily-progress';
    for (let i = 0; i < total; i++) {
      const seg = document.createElement('span');
      seg.className = 'daily-progress__seg' + (i < pack.done ? ' is-done' : i === pack.done ? ' is-current' : '');
      bar.appendChild(seg);
    }
    root.appendChild(bar);

    const p = pays.find(x => x.code === pack.queue[0]);
    const card = document.createElement('div');
    card.className = 'dt-card';
    card.innerHTML = `
      <div class="dt-card__inner">
        <div class="dt-card__face dt-card__front">
          ${flagImg(p)}
          <p class="dt-card__prompt">Quel est ce pays ?</p>
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

    const flip = () => {
      card.classList.add('is-flipped');
      actions.hidden = false;
    };
    card.addEventListener('click', flip);

    const answer = (known) => {
      const code = pack.queue.shift();
      Store.recordDragonSeen(code, known);
      if (known) {
        pack.done += 1;
        if (!pack.missed.has(code)) pack.firstTry += 1;
      } else {
        pack.missed.add(code);
        // Revient un peu plus loin dans le paquet.
        pack.queue.splice(Math.min(3, pack.queue.length), 0, code);
      }
      render();
    };
    actions.querySelector('.dt-btn-know').addEventListener('click', () => answer(true));
    actions.querySelector('.dt-btn-again').addEventListener('click', () => answer(false));

    // Précharge le drapeau suivant.
    if (pack.queue[1]) { const img = new Image(); img.src = FLAG_DIR + pack.queue[1] + '.svg'; }
  }

  function renderPackEnd(root, pack) {
    const g = group(state.groupId);
    const div = document.createElement('div');
    div.className = 'daily-end';
    const perfect = pack.firstTry === pack.done;
    div.innerHTML = `
      <div class="daily-end__emoji">${perfect ? '🏆' : '🐉'}</div>
      <h2 class="daily-end__title">Paquet terminé !</h2>
      <p class="daily-end__msg">${perfect ? 'Tout du premier coup, impressionnant !' : `${pack.firstTry} sur ${pack.done} du premier coup.`}</p>`;
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-primary daily-end__btn';
    next.textContent = `🃏 Paquet suivant · ${g.label}`;
    next.addEventListener('click', () => { state.pack = null; render(); });
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-ghost daily-end__btn';
    back.textContent = 'Changer de mode';
    back.addEventListener('click', () => App.back());
    div.appendChild(next);
    div.appendChild(back);
    root.appendChild(div);
  }

  // ---------- S'entraîner (QCM) ----------
  const SERIES_SIZE = 10;
  const KINDS = [
    { id: 'mix', emoji: '🎲', label: 'Tout mélangé', desc: 'Drapeaux et capitales, dans tous les sens.' },
    { id: 'drapeaux', emoji: '🏳️', label: 'Drapeaux', desc: 'Reconnaître un drapeau, ou retrouver celui d’un pays.' },
    { id: 'capitales', emoji: '🏛️', label: 'Capitales', desc: 'Capitale d’un pays, ou pays d’une capitale.' },
  ];

  function renderEntrainerSetup(root) {
    const g = group(state.groupId);
    const title = document.createElement('div');
    title.className = 'crumb-row';
    title.innerHTML = `<span class="crumb-title">🎯 S’entraîner · ${escapeHTML(g.label)}</span>`;
    root.appendChild(title);
    const list = document.createElement('div');
    list.className = 'mode-list';
    KINDS.forEach(k => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-card';
      btn.innerHTML = `
        <span class="mode-card__icon">${k.emoji}</span>
        <span class="mode-card__text">
          <span class="mode-card__title">${k.label}</span>
          <span class="mode-card__desc">${k.desc}</span>
        </span>
        <span class="mode-card__arrow">›</span>`;
      btn.addEventListener('click', () => goDeeper({ level: 'entrainer-run', groupId: state.groupId, kind: k.id, series: null }));
      list.appendChild(btn);
    });
    root.appendChild(list);
  }

  const norm = s => QuizGen.normalize(s);
  // La capitale ne fait que répéter le nom du pays (Luxembourg, Djibouti…) : « capitale → pays » serait trop facile.
  const trivialCapital = p => !p.capitale || norm(p.capitale).includes(norm(p.nom)) || norm(p.nom).includes(norm(p.capitale));

  function questionTypesFor(kind, p) {
    const flags = ['flag2pays', 'pays2flag'];
    const caps = [];
    if (p.capitale) caps.push('pays2cap');
    if (!trivialCapital(p)) caps.push('cap2pays');
    if (kind === 'drapeaux') return flags;
    if (kind === 'capitales') return caps;
    return flags.concat(caps);
  }

  // Ratés d'abord, puis jamais vus, puis déjà sus.
  function pickSeries(groupId, kind) {
    const members = QuizGen.shuffle(membersOf(groupId)).filter(p => questionTypesFor(kind, p).length);
    const prio = p => {
      const m = Store.getDragonMeta(p.code);
      if (m && m.lastKnown === false) return 1000 + Math.random() * 10;
      return SRS.priority(m) + Math.random() * 10;
    };
    const weights = new Map(members.map(p => [p.code, prio(p)]));
    members.sort((a, b) => weights.get(b.code) - weights.get(a.code));
    return members.slice(0, SERIES_SIZE).map(p => {
      const types = questionTypesFor(kind, p);
      return { code: p.code, type: types[Math.floor(Math.random() * types.length)] };
    });
  }

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

  function renderEntrainer(root) {
    if (!state.series) {
      state.series = { items: pickSeries(state.groupId, state.kind), index: 0, results: [] };
    }
    const se = state.series;
    if (!se.items.length) {
      root.innerHTML = '<div class="empty-state"><div class="empty-state__emoji">🤷</div><div>Pas de question possible pour ce groupe.</div></div>';
      return;
    }
    if (se.index >= se.items.length) return renderSeriesEnd(root, se);

    const bar = document.createElement('div');
    bar.className = 'daily-progress';
    se.items.forEach((_, i) => {
      const seg = document.createElement('span');
      const r = se.results[i];
      seg.className = 'daily-progress__seg' + (r === true ? ' is-done' : r === false ? ' is-miss' : i === se.index ? ' is-current' : '');
      bar.appendChild(seg);
    });
    root.appendChild(bar);

    const { code, type } = se.items[se.index];
    const p = pays.find(x => x.code === code);
    const options = QuizGen.shuffle([p, ...distractors(p, type)]);

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
    options.forEach(o => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = type === 'pays2flag' ? 'dt-flag-opt' : 'opt-btn';
      btn.innerHTML = type === 'pays2flag' ? flagImg(o, 'dt-flag dt-flag--opt') : escapeHTML(type === 'pays2cap' ? o.capitale : o.nom);
      btn.dataset.code = o.code;
      list.appendChild(btn);
    });
    card.appendChild(list);
    root.appendChild(card);

    let answered = false;
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || answered) return;
      answered = true;
      const correct = btn.dataset.code === p.code;
      [...list.children].forEach(b => {
        b.disabled = true;
        if (b.dataset.code === p.code) b.classList.add('is-correct');
        else if (b === btn) b.classList.add('is-wrong');
        else b.classList.add('is-dim');
      });
      se.results[se.index] = correct;
      Store.recordDragonSeen(p.code, correct);

      const info = document.createElement('div');
      info.className = 'dt-answer ' + (correct ? 'is-correct' : 'is-wrong');
      info.innerHTML = `
        ${flagImg(p, 'dt-flag dt-flag--tiny')}
        <div class="dt-answer__text">
          <strong>${correct ? '✓ Bonne réponse' : '✕ Raté'}</strong>
          <span>${escapeHTML(p.nom)}${p.capitale ? ' · ' + escapeHTML(p.capitale) : ''}</span>
          ${p.note ? `<small>${escapeHTML(p.note)}</small>` : ''}
        </div>`;
      card.appendChild(info);

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn btn-primary btn-next';
      next.textContent = se.index === se.items.length - 1 ? 'Voir mon score →' : 'Suivante →';
      next.addEventListener('click', () => { se.index += 1; render(); });
      root.appendChild(next);
    });

    const nextItem = se.items[se.index + 1];
    if (nextItem) { const img = new Image(); img.src = FLAG_DIR + nextItem.code + '.svg'; }
  }

  function renderSeriesEnd(root, se) {
    const score = se.results.filter(Boolean).length;
    const total = se.items.length;
    const div = document.createElement('div');
    div.className = 'daily-end';
    const msg = score === total ? 'Sans faute, bravo !' : score >= total - 2 ? 'Très joli !' : score >= total / 2 ? 'Bien joué, continue !' : 'Chaque série te fait progresser.';
    div.innerHTML = `
      <div class="daily-end__emoji">${score === total ? '🏆' : '🎯'}</div>
      <h2 class="daily-end__title">${score} / ${total}</h2>
      <p class="daily-end__msg">${msg}</p>`;
    const missed = se.items.filter((_, i) => se.results[i] === false).map(it => pays.find(x => x.code === it.code));
    if (missed.length) {
      const box = document.createElement('div');
      box.className = 'dt-missed';
      box.innerHTML = '<h3>À retenir</h3>' + missed.map(p => `
        <div class="dt-missed__row">${flagImg(p, 'dt-flag dt-flag--tiny')}<span><strong>${escapeHTML(p.nom)}</strong>${p.capitale ? ' · ' + escapeHTML(p.capitale) : ''}</span></div>`).join('');
      div.appendChild(box);
    }
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn-primary daily-end__btn';
    again.textContent = se.revision ? '🔁 Continuer la révision' : '🎯 Nouvelle série';
    if (se.revision && !hasDue()) again.hidden = true;
    again.addEventListener('click', () => { state.series = null; render(); });
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-ghost daily-end__btn';
    back.textContent = se.revision ? 'Retour à Dragon Tour' : 'Changer de type';
    back.addEventListener('click', () => App.back());
    div.appendChild(again);
    div.appendChild(back);
    root.appendChild(div);
  }

  // ---------- Maîtrise (0 à 3 par pays, points par groupe) ----------
  // 0 : jamais su · 1 et 2 : bonnes réponses d'affilée · 3 : trois d'affilée ET déjà tapé juste en « Maîtriser ».
  function level(code) {
    const m = Store.getDragonMeta(code);
    if (!m || !m.reps) return 0;
    if (m.reps >= 3 && m.typedOk) return 3;
    return Math.min(m.reps, 2);
  }

  function groupMastery(groupId) {
    const members = membersOf(groupId);
    if (!members.length) return 0;
    const sum = members.reduce((s, p) => s + level(p.code), 0);
    return sum / (members.length * 3);
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

  // ---------- Maîtriser (réponse tapée) ----------
  const KINDS_TYPED = [
    { id: 'mix', emoji: '🎲', label: 'Tout mélangé', desc: 'Pays à partir du drapeau, capitales dans les deux sens.' },
    { id: 'drapeaux', emoji: '🏳️', label: 'Drapeaux', desc: 'Écris le nom du pays à partir de son drapeau.' },
    { id: 'capitales', emoji: '🏛️', label: 'Capitales', desc: 'Écris la capitale d’un pays, ou le pays d’une capitale.' },
  ];

  function renderMaitriserSetup(root) {
    const g = group(state.groupId);
    const title = document.createElement('div');
    title.className = 'crumb-row';
    title.innerHTML = `<span class="crumb-title">✍️ Maîtriser · ${escapeHTML(g.label)}</span>`;
    root.appendChild(title);
    const list = document.createElement('div');
    list.className = 'mode-list';
    KINDS_TYPED.forEach(k => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-card';
      btn.innerHTML = `
        <span class="mode-card__icon">${k.emoji}</span>
        <span class="mode-card__text">
          <span class="mode-card__title">${k.label}</span>
          <span class="mode-card__desc">${k.desc}</span>
        </span>
        <span class="mode-card__arrow">›</span>`;
      btn.addEventListener('click', () => goDeeper({ level: 'maitriser-run', groupId: state.groupId, kind: k.id, series: null }));
      list.appendChild(btn);
    });
    root.appendChild(list);
  }

  function typedTypesFor(kind, p) {
    const flags = ['flag2pays'];
    const caps = [];
    if (p.capitale) caps.push('pays2cap');
    if (!trivialCapital(p)) caps.push('cap2pays');
    if (kind === 'drapeaux') return flags;
    if (kind === 'capitales') return caps;
    return flags.concat(caps);
  }

  // Ratés d'abord, puis les pays déjà vus qu'il est temps de revoir, puis les autres.
  function pickTyped(groupId, kind) {
    const now = Date.now();
    const prio = p => {
      const m = Store.getDragonMeta(p.code);
      if (!m) return 50 + Math.random() * 10;
      if (m.lastKnown === false) return 1000 + Math.random() * 10;
      const due = m.due ? new Date(m.due).getTime() : 0;
      if (due <= now) return 500 + (now - due) / 86400000 + Math.random() * 10;
      return 10 + Math.random() * 10;
    };
    const members = membersOf(groupId).filter(p => typedTypesFor(kind, p).length)
      .map(p => ({ p, w: prio(p) }))
      .sort((a, b) => b.w - a.w)
      .map(x => x.p);
    return members.slice(0, SERIES_SIZE).map(p => {
      const types = typedTypesFor(kind, p);
      return { code: p.code, type: types[Math.floor(Math.random() * types.length)] };
    });
  }

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

  function renderMaitriser(root) {
    if (!state.series) {
      state.series = { items: pickTyped(state.groupId, state.kind), index: 0, results: [] };
    }
    const se = state.series;
    if (!se.items.length) {
      root.innerHTML = '<div class="empty-state"><div class="empty-state__emoji">🤷</div><div>Pas de question possible pour ce groupe.</div></div>';
      return;
    }
    if (se.index >= se.items.length) return renderSeriesEnd(root, se);

    const bar = document.createElement('div');
    bar.className = 'daily-progress';
    se.items.forEach((_, i) => {
      const seg = document.createElement('span');
      const r = se.results[i];
      seg.className = 'daily-progress__seg' + (r === true ? ' is-done' : r === false ? ' is-miss' : i === se.index ? ' is-current' : '');
      bar.appendChild(seg);
    });
    root.appendChild(bar);

    const { code, type } = se.items[se.index];
    const p = pays.find(x => x.code === code);
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
    let answered = false;

    const finish = (guess) => {
      if (answered) return;
      answered = true;
      const res = guess == null ? { ok: false, exact: false } : matchTyped(guess, answers);
      input.disabled = true;
      card.querySelector('.dt-type__ok').disabled = true;
      skip.hidden = true;
      input.classList.add(res.ok ? 'is-correct' : 'is-wrong');
      se.results[se.index] = res.ok;
      Store.recordDragonSeen(p.code, res.ok, { typed: true });

      const expected = answers[0];
      let detail = '';
      if (res.ok && !res.exact) detail = `<small>Orthographe exacte : <strong>${escapeHTML(res.answer)}</strong></small>`;
      if (!res.ok) detail = `<small>La bonne réponse : <strong>${escapeHTML(expected)}</strong>${answers.length > 1 ? ` (ou ${answers.slice(1).map(escapeHTML).join(', ')})` : ''}</small>`;
      const info = document.createElement('div');
      info.className = 'dt-answer ' + (res.ok ? 'is-correct' : 'is-wrong');
      info.innerHTML = `
        ${flagImg(p, 'dt-flag dt-flag--tiny')}
        <div class="dt-answer__text">
          <strong>${res.ok ? '✓ Bonne réponse' : guess == null ? '✕ Pas grave, retiens-le' : '✕ Raté'}</strong>
          <span>${escapeHTML(p.nom)}${p.capitale ? ' · ' + escapeHTML(p.capitale) : ''}</span>
          ${detail}
          ${p.note ? `<small>${escapeHTML(p.note)}</small>` : ''}
        </div>`;
      card.appendChild(info);

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'btn btn-primary btn-next';
      next.textContent = se.index === se.items.length - 1 ? 'Voir mon score →' : 'Suivante →';
      next.addEventListener('click', () => { se.index += 1; render(); });
      root.appendChild(next);
      next.focus();
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim()) { input.focus(); return; }
      finish(input.value);
    });
    skip.addEventListener('click', () => finish(null));

    input.focus();
    const nextItem = se.items[se.index + 1];
    if (nextItem) { const img = new Image(); img.src = FLAG_DIR + nextItem.code + '.svg'; }
  }

  // ---------- Révision du jour ----------
  const REVISION_MAX = 15;

  // Pays déjà vus qu'il est temps de revoir : ratés, ou échéance de répétition espacée dépassée.
  // Ne lit que la progression enregistrée (pas besoin de charger la liste des pays).
  function dueCodes() {
    const now = Date.now();
    const all = Store.dragonProgress();
    const out = [];
    for (const code in all) {
      const m = all[code];
      const due = m.due ? new Date(m.due).getTime() : 0;
      if (m.lastKnown === false) out.push({ code, w: 1e12 + (now - due) });
      else if (due <= now) out.push({ code, w: now - due });
    }
    return out.sort((a, b) => b.w - a.w).map(x => x.code);
  }

  function hasDue() { return dueCodes().length > 0; }

  // Série adaptée au niveau : QCM si le pays est encore fragile, réponse tapée s'il est bien connu.
  function buildRevision() {
    const items = [];
    for (const code of dueCodes()) {
      const p = pays.find(x => x.code === code);
      if (!p) continue;
      const typed = level(code) >= 2;
      const types = typed ? typedTypesFor('mix', p) : questionTypesFor('mix', p);
      if (!types.length) continue;
      items.push({ code, type: types[Math.floor(Math.random() * types.length)], mode: typed ? 'typed' : 'qcm' });
      if (items.length >= REVISION_MAX) break;
    }
    return items;
  }

  function revisionCardHTML() {
    const seenAny = Object.keys(Store.dragonProgress()).length > 0;
    const due = hasDue();
    const desc = due ? 'À revoir aujourd’hui · tous continents mélangés'
      : seenAny ? '✓ Tout est à jour, reviens demain'
        : 'Découvre d’abord quelques pays dans un continent';
    return `
      <span class="dt-group__emoji">🔁</span>
      <span class="dt-group__text">
        <span class="dt-group__label">Révision du jour</span>
        <span class="dt-group__desc">${desc}</span>
      </span>
      ${due ? '<span class="dt-revision__arrow">›</span>' : ''}`;
  }

  function renderRevision(root) {
    if (!state.series) {
      state.series = { items: buildRevision(), index: 0, results: [], revision: true };
    }
    const se = state.series;
    if (!se.items.length) {
      const div = document.createElement('div');
      div.className = 'daily-end';
      div.innerHTML = `
        <div class="daily-end__emoji">✅</div>
        <h2 class="daily-end__title">Tout est à jour !</h2>
        <p class="daily-end__msg">Aucun pays à revoir pour l’instant. Reviens demain, ou découvre de nouveaux pays.</p>`;
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'btn btn-primary daily-end__btn';
      back.textContent = 'Retour à Dragon Tour';
      back.addEventListener('click', () => App.back());
      div.appendChild(back);
      root.appendChild(div);
      return;
    }
    if (se.index >= se.items.length) return renderSeriesEnd(root, se);
    return se.items[se.index].mode === 'typed' ? renderMaitriser(root) : renderEntrainer(root);
  }

  return { init, hasDue };
})();
