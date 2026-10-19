/* ===================== Version ordinateur =====================
 * Ne sert qu'à partir de 1024 px de large (cf. css/pc.css) ; sur téléphone, rien ne change.
 * - Menu du haut : onglet actif selon l'écran affiché.
 * - Accueil : grille « Tous les thèmes » (ouvre directement le thème dans Fiches).
 * - Quiz : touches A à D (ou 1 à 4) pour choisir, Entrée pour valider / passer à la suite.
 * - Fiche : panneau à droite avec des liens vers d'autres fiches et un mini-quiz.
 * ============================================================= */
const PC = (() => {
  const isPC = () => window.matchMedia('(min-width: 1024px)').matches;

  function escapeHTML(s) {
    return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  // ---------- Menu du haut ----------
  const NAV_OF = {
    home: 'home', daily: 'home',
    'fiches-menu': 'fiches', 'fiches-aleatoire': 'fiches', 'fiches-theme': 'fiches', favoris: 'fiches',
    'quiz-menu': 'quiz', 'quiz-theme': 'quiz', 'quiz-aleatoire': 'quiz',
    'quiz-jour': 'quiz-jour', dragon: 'dragon', search: 'fiches',
  };
  // Surligneur du menu : il glisse jusqu'à l'onglet actif (le CSS fait l'animation)
  const navIn = document.querySelector('.pc-nav__in');
  const marker = document.createElement('span');
  marker.className = 'pc-nav__marker';
  marker.setAttribute('aria-hidden', 'true');
  if (navIn) navIn.prepend(marker);
  function placeMarker() {
    if (!navIn) return;
    const link = navIn.querySelector('.pc-nav__link.is-active');
    if (!link || !link.offsetWidth) { marker.classList.remove('is-on'); return; }
    marker.style.setProperty('--mx', link.offsetLeft + 'px');
    marker.style.setProperty('--mw', link.offsetWidth + 'px');
    marker.classList.add('is-on');
    if (!marker.classList.contains('is-ready')) requestAnimationFrame(() => requestAnimationFrame(() => marker.classList.add('is-ready')));
  }
  window.addEventListener('resize', placeMarker);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeMarker);
  document.addEventListener('screenchange', (e) => {
    const nav = NAV_OF[e.detail];
    document.querySelectorAll('.pc-nav [data-nav]').forEach(b => b.classList.toggle('is-active', b.dataset.nav === nav));
    placeMarker();
    if (e.detail === 'home') { renderThemes(); renderCal(); drawString(); }
  });

  // ---------- Accueil : tous les thèmes, en 3 sections par famille de couleur ----------
  const GROUPES = [
    { id: 'monde', titre: 'Société & idées' },
    { id: 'vivant', titre: 'Sciences & nature' },
    { id: 'arts', titre: 'Culture & loisirs' },
  ];
  let themesDone = false;
  function renderThemes() {
    const root = document.getElementById('home-themes');
    if (!root || themesDone || !DataStore.getDomains().length) return;
    themesDone = true;
    const counts = DataStore.domainCounts();
    GROUPES.forEach(g => {
      const list = DataStore.getDomains().filter(d => (d.groupe || 'monde') === g.id);
      if (!list.length) return;
      const sec = document.createElement('section');
      sec.className = 'pc-group';
      sec.dataset.g = g.id;
      sec.innerHTML = `<h3 class="pc-group__title"><span class="pc-group__dot" aria-hidden="true"></span>${escapeHTML(g.titre)}</h3>`;
      const grid = document.createElement('div');
      grid.className = 'domain-grid';
      list.forEach(d => {
        const n = DataStore.compte(counts[d.id]?.fiches || 0, 'fiche');
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'domain-tile';
        tile.style.setProperty('--th', d.hue ?? 220);
        tile.dataset.g = d.groupe || 'monde';
        tile.dataset.e = d.emoji;
        tile.innerHTML = `<span class="domain-tile__emoji">${d.emoji}</span><span class="domain-tile__label">${escapeHTML(d.label)}</span>${n ? `<span class="domain-tile__count">${n}</span>` : ''}`;
        tile.addEventListener('click', () => { App.go('fiches-theme'); Fiches.openDomain(d.id); });
        grid.appendChild(tile);
      });
      sec.appendChild(grid);
      root.appendChild(sec);
    });
  }

  // ---------- Accueil : page de calendrier du jour + ficelle rouge entre les punaises ----------
  function renderCal() {
    const cal = document.getElementById('fact-cal');
    if (!cal) return;
    const d = new Date();
    cal.querySelector('.fact-card__cal-m').textContent = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    cal.querySelector('.fact-card__cal-d').textContent = d.getDate();
    cal.querySelector('.fact-card__cal-w').textContent = d.toLocaleDateString('fr-FR', { weekday: 'long' });
  }

  // La ficelle passe derrière les papiers et rejoint les punaises (haut de chaque élément, au centre).
  const SVGNS = 'http://www.w3.org/2000/svg';
  function drawString() {
    const card = document.getElementById('fact-card');
    if (!card) return;
    let svg = card.querySelector('.fact-card__string');
    if (!isPC() || card.hidden || !card.offsetWidth) { if (svg) svg.innerHTML = ''; return; }
    if (!svg) {
      svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'fact-card__string');
      svg.setAttribute('aria-hidden', 'true');
      card.prepend(svg);
    }
    const box = card.getBoundingClientRect();
    const pin = (sel) => {
      const el = card.querySelector(sel);
      if (!el || el.hidden || !el.offsetWidth) return null;
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top - box.top];
    };
    const pts = ['.fact-card__note', '.fact-card__photo'].map(pin);
    const cal = pin('.fact-card__cal');
    // sag : affaissement de la ficelle (en px) ; elle passe derrière les papiers
    const link = (a, b, sag) => {
      if (!a || !b) return '';
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + sag;
      return `M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}`;
    };
    const paths = [link(pts[0], cal, 22), link(cal, pts[1], 30)].filter(Boolean);
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.innerHTML = paths.map(d => `<path d="${d}" class="fact-card__string-line"/>`).join('');
  }
  window.addEventListener('resize', drawString);
  const cardEl = document.getElementById('fact-card');
  if (cardEl && window.ResizeObserver) new ResizeObserver(drawString).observe(cardEl);
  if (cardEl && window.MutationObserver) new MutationObserver(drawString).observe(cardEl, { attributes: true, attributeFilter: ['hidden'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawString);

  // ---------- Clavier dans les quiz ----------
  const visible = el => el && el.offsetParent !== null && !el.disabled && !el.hidden;
  document.addEventListener('keydown', (e) => {
    if (!isPC() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const scope = document.querySelector('.fiche-modal') || document.querySelector('.screen:not([hidden])');
    if (!scope) return;

    if (e.key === 'Enter') {
      const btn = [...scope.querySelectorAll('.btn-validate, .btn-next')].filter(visible).pop();
      if (btn && t !== btn) { e.preventDefault(); btn.click(); }
      return;
    }
    let i = -1;
    if (/^[1-4]$/.test(e.key)) i = Number(e.key) - 1;
    else if (/^[a-dA-D]$/.test(e.key)) i = e.key.toUpperCase().charCodeAt(0) - 65;
    if (i < 0) return;
    const lists = [...scope.querySelectorAll('.opt-list, .vf-row, .dt-flag-grid')].filter(l => l.offsetParent !== null);
    const list = lists.pop();
    if (!list) return;
    const opt = list.children[i];
    if (visible(opt)) { e.preventDefault(); opt.click(); }
  });

  // ---------- Fiche : panneau de droite ----------
  // Questions liées : celles du même thème qui citent le titre de la fiche.
  function relatedQuiz(fiche) {
    const key = norm((fiche.title || '').replace(/^[^:]{1,12}:\s*/, ''));
    if (key.length < 4) return [];
    const re = new RegExp(`(^| )${key.replace(/ /g, ' ')}( |$)`);
    return DataStore.getQuiz(fiche.domain).filter(q => {
      const txt = norm([q.question, q.affirmation, q.reponse, ...(q.choix || []), ...(q.indices || [])].join(' '));
      return re.test(txt);
    });
  }

  function ficheAside(fiche) {
    const aside = document.createElement('aside');
    aside.className = 'fiche-aside';

    // Liens : les autres fiches de la même rubrique.
    const voisines = DataStore.getFiches(fiche.domain)
      .filter(f => f.id !== fiche.id && (f.subtheme || 'Général') === (fiche.subtheme || 'Général'));
    const picks = QuizGen.shuffle(voisines).slice(0, 5);
    if (picks.length) {
      const box = document.createElement('div');
      box.className = 'pc-panel';
      box.innerHTML = `<h4 class="pc-panel__title">Dans la même rubrique</h4>` +
        picks.map(f => `<button type="button" class="pc-link" data-fid="${escapeHTML(f.id)}"><span>${escapeHTML(f.title)}</span><span>›</span></button>`).join('');
      box.addEventListener('click', (e) => {
        const b = e.target.closest('.pc-link');
        if (b) Fiches.openLinked(b.dataset.fid);
      });
      aside.appendChild(box);
    }

    // Mini-quiz : questions liées à la fiche, sinon 3 questions du thème.
    const related = relatedQuiz(fiche);
    const pool = DataStore.getQuiz(fiche.domain);
    if (related.length || pool.length) {
      const domain = DataStore.getDomain(fiche.domain);
      const n = related.length ? Math.min(3, related.length) : Math.min(3, pool.length);
      const box = document.createElement('div');
      box.className = 'pc-panel';
      box.innerHTML = `<h4 class="pc-panel__title">Tester cette fiche</h4>
        <p class="pc-panel__text">${related.length
          ? `${n} question${n > 1 ? 's' : ''} liée${n > 1 ? 's' : ''} à cette fiche.`
          : `${n} questions du thème ${escapeHTML(domain ? domain.label : '')}.`}</p>
        <button type="button" class="btn btn-primary pc-panel__btn">Lancer le mini-quiz</button>`;
      box.querySelector('button').addEventListener('click', () => {
        const items = QuizGen.shuffle(related.length ? related : pool).slice(0, n);
        miniQuiz(items, fiche);
      });
      aside.appendChild(box);
    }
    return aside;
  }

  // Mini-quiz dans une fenêtre par-dessus la fiche.
  function miniQuiz(items, fiche) {
    const overlay = document.createElement('div');
    overlay.className = 'fiche-modal pc-mini';
    overlay.innerHTML = `<div class="fiche-modal__panel"><button type="button" class="fiche-modal__close">✕ Fermer</button><div class="fiche-modal__body"></div></div>`;
    const body = overlay.querySelector('.fiche-modal__body');
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('.fiche-modal__close')) close(); });
    document.body.appendChild(overlay);

    let score = 0;
    const show = (i) => {
      body.innerHTML = '';
      if (i >= items.length) {
        body.innerHTML = `<div class="pc-mini__end"><div class="pc-mini__score">${score}/${items.length}</div>
          <p>${score === items.length ? 'Parfait, tu as bien retenu !' : 'Relis la fiche et retente ta chance.'}</p>
          <p class="pc-mini__sub">${escapeHTML(fiche.title)}</p></div>`;
        const ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'btn btn-primary btn-next';
        ok.textContent = 'Fermer';
        ok.addEventListener('click', close);
        body.appendChild(ok);
        return;
      }
      const head = document.createElement('div');
      head.className = 'serie-head';
      head.innerHTML = `<span class="serie-head__count">Question ${i + 1}/${items.length}</span>`;
      body.appendChild(head);
      const stage = document.createElement('div');
      stage.className = 'card-stage';
      body.appendChild(stage);
      Quiz.renderQuestion(items[i], stage, () => {
        const meta = Store.getQuizMeta(items[i].id);
        if (meta && meta.lastResult) score += 1;
        show(i + 1);
      });
    };
    show(0);
  }

  return { ficheAside };
})();
