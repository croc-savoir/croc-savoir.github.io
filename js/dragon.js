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
  }

  // ---------- Groupes ----------
  function renderGroups(root) {
    const intro = document.createElement('p');
    intro.className = 'mode-intro';
    intro.textContent = 'Quelle partie du monde veux-tu explorer ?';
    root.appendChild(intro);

    const list = document.createElement('div');
    list.className = 'dt-groups';
    GROUPS.forEach(g => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dt-group' + (g.id === 'monde' ? ' dt-group--wide' : '') + (g.id === 'territoires' ? ' dt-group--wide dt-group--terr' : '');
      btn.innerHTML = `
        <span class="dt-group__emoji">${g.emoji}</span>
        <span class="dt-group__text">
          <span class="dt-group__label">${escapeHTML(g.label)}</span>
          ${g.desc ? `<span class="dt-group__desc">${escapeHTML(g.desc)}</span>` : ''}
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
    title.innerHTML = `<span class="crumb-title">${g.emoji} ${escapeHTML(g.label)}</span>`;
    root.appendChild(title);

    const modes = [
      { id: 'decouvrir', emoji: '🃏', label: 'Découvrir', desc: 'Des cartes à retourner : le drapeau d’un côté, le pays et sa capitale de l’autre.' },
      { id: 'entrainer', emoji: '🎯', label: 'S’entraîner', desc: 'QCM à 4 choix : drapeaux, pays et capitales dans tous les sens.', soon: true },
      { id: 'maitriser', emoji: '✍️', label: 'Maîtriser', desc: 'Tape toi-même la réponse. Les accents et petites fautes sont tolérés.', soon: true },
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

  return { init };
})();
