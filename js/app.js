/* ===================== App : navigation & orchestration =====================
 * Navigation par écrans : Accueil → choix du mode → contenu.
 * Chaque écran est une <section class="screen" data-screen="…">. Son attribut
 * data-back indique l'écran parent (bouton retour), data-title son titre.
 * L'historique du navigateur est synchronisé pour que le geste « retour » du
 * téléphone ramène à l'écran précédent au lieu de quitter l'appli.
 * ========================================================================== */
const App = (() => {
  let current = 'home';
  // Niveaux internes d'un écran (ex. domaine → sous-thème → fiche) pour le geste retour.
  const inner = [];

  function setAccentVar(name) {
    const root = document.documentElement;
    const clair = root.classList.contains('theme-clair');
    const palettes = {
      pink: { a: '#e0568c', a2: '#ff8fb8', ap: '#ffd3e6', rgb: '224, 86, 140' },
      blue: { a: '#2f7bff', a2: '#5cc8ff', ap: '#cfe8ff', rgb: '47, 123, 255' },
    };
    let p = palettes[name] || palettes.blue;
    // Thème clair : les accents « clairs » (texte bleu pâle) deviennent des bleus foncés lisibles sur fond clair.
    if (clair) p = { ...p, a2: '#2a62c4', ap: '#1d3f7a' };
    root.style.setProperty('--accent', p.a);
    root.style.setProperty('--accent-2', p.a2);
    root.style.setProperty('--accent-pale', p.ap);
    root.style.setProperty('--accent-rgb', p.rgb);
  }

  // ---------- Thème clair / sombre ----------
  const THEME_KEY = 'culture-g:theme';
  const THEME_LABELS = { auto: '🌓 Thème : Auto', clair: '☀️ Thème : Clair', sombre: '🌙 Thème : Sombre' };
  const themeChoisi = () => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; } };
  function appliquerTheme() {
    const choix = themeChoisi();
    const clair = choix === 'clair' || (choix === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.classList.toggle('theme-clair', clair);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', clair ? '#f3efe6' : '#0a0e1a');
    setAccentVar('blue');
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = THEME_LABELS[choix] || THEME_LABELS.auto;
  }
  function wireTheme() {
    const btn = document.getElementById('theme-btn');
    if (btn) btn.addEventListener('click', () => {
      const suite = { auto: 'clair', clair: 'sombre', sombre: 'auto' }[themeChoisi()] || 'auto';
      try { localStorage.setItem(THEME_KEY, suite); } catch (e) { /* stockage indisponible */ }
      appliquerTheme();
    });
    // En mode « auto », on suit le réglage de l'appareil quand il change.
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => { if (themeChoisi() === 'auto') appliquerTheme(); });
    appliquerTheme();
  }

  function toast(msg, ms = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms);
  }

  function screenEl(name) {
    return document.querySelector(`.screen[data-screen="${name}"]`);
  }

  // Prépare le contenu d'un écran au moment où on y entre.
  function prepare(name) {
    if (name === 'home') renderHome();
    if (name === 'fiches-aleatoire') Fiches.initAleatoire();
    if (name === 'fiches-theme') Fiches.initTheme();
    if (name === 'daily') Daily.render();
    if (name === 'dragon') Dragon.init();
    if (name === 'search') Library.initSearch();
    if (name === 'favoris') Library.initFavorites();
    if (name === 'quiz-aleatoire') Quiz.initAleatoire();
    if (name === 'quiz-theme') Series.initSeries();
    if (name === 'quiz-jour') Series.initJour();
  }

  function render(name) {
    const target = screenEl(name) || screenEl('home');
    name = target.dataset.screen;
    document.querySelectorAll('.screen').forEach(s => { s.hidden = s !== target; });
    const bar = document.getElementById('screen-bar');
    bar.hidden = name === 'home';
    document.getElementById('screen-title').textContent = target.dataset.title || '';
    document.body.classList.toggle('is-home', name === 'home');
    if (name !== current) inner.length = 0;
    current = name;
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('screenchange', { detail: name }));   // menu du haut (pc.js)
  }

  // Aller vers un écran (ajoute une entrée d'historique).
  function go(name, { prepareScreen = true } = {}) {
    if (prepareScreen) prepare(name);
    render(name);
    if (name === 'search') Library.focusSearch();
    history.pushState({ screen: name }, '', `#${name}`);
  }

  // Retour : on s'appuie sur l'historique quand il existe, sinon on remonte au parent.
  function back() {
    if (history.state && history.state.screen && history.state.screen !== 'home') {
      history.back();
    } else {
      const parent = screenEl(current)?.dataset.back || 'home';
      prepare(parent);
      render(parent);
      history.replaceState({ screen: parent }, '', `#${parent}`);
    }
  }

  // Un écran descend d'un niveau interne : « up » sera appelé au retour.
  function pushInner(up) {
    inner.push({ up, y: window.scrollY });   // on note où l'on était pour y revenir au retour
    history.pushState({ screen: current, inner: inner.length }, '', `#${current}`);
    window.scrollTo(0, 0);
  }

  function goHome() {
    prepare('home');
    render('home');
    history.pushState({ screen: 'home' }, '', '#home');
  }

  function renderHome() {
    const nF = DataStore.getAllFiches().length;
    const nQ = DataStore.getAllQuiz().length;
    const nD = DataStore.getDomains().length;
    // Chiffres arrondis à la centaine inférieure : « +600 fiches ».
    const approx = (n, mot) => {
      if (n < 100) return `${n} ${mot}`;
      const r = Math.floor(n / 100) * 100;
      return `+${r.toLocaleString('fr-FR')} ${mot}`;
    };
    document.getElementById('home-greeting').textContent =
      DataStore.compte(nF, 'fiche')
        ? `${nD} thèmes · ${DataStore.compte(nF, 'fiche')} · ${DataStore.compte(nQ, 'question')}`
        : `${nD} thèmes · ${approx(nF, 'fiches')} · ${approx(nQ, 'quiz')}`;
    renderDailyCard();
    Saviez.render();
    Series.updateHomeCard();
    document.getElementById('dragon-badge').hidden = !Dragon.hasDue();
    const errBtn = document.getElementById('btn-errors');   // retiré de l'accueil (remplacé par le choix de style)
    if (errBtn) {
      const nErr = Store.getErrorIds().length;
      errBtn.hidden = nErr === 0;
      errBtn.textContent = `🔁 Revoir mes erreurs (${nErr})`;
    }
  }

  function renderDailyCard() {
    const s = Daily.summary();
    const card = document.querySelector('.daily-card');
    const desc = document.getElementById('daily-card-desc');
    const streakEl = document.getElementById('daily-card-streak');
    card.classList.toggle('is-done', s.state === 'done');
    if (s.state === 'done') desc.textContent = s.score != null ? `Terminée ✓ · ${s.score}/${s.total} · À demain !` : 'Terminée ✓ · À demain !';
    else if (s.state === 'progress') desc.textContent = `En cours · étape ${s.step + 1} sur ${s.total} · Reprendre`;
    else desc.textContent = '5 fiches + 5 questions · environ 5 min';
    streakEl.hidden = s.streak === 0;
    streakEl.textContent = `🔥 ${s.streak}`;
  }

  function openStats() {
    Stats.render();
    document.getElementById('view-stats').hidden = false;
    history.pushState({ screen: current, overlay: 'stats' }, '', '#stats');
  }
  function closeStats() {
    const el = document.getElementById('view-stats');
    if (el.hidden) return;
    el.hidden = true;
    if (history.state && history.state.overlay === 'stats') history.back();
  }

  function showErrorReview() {
    const statsEl = document.getElementById('view-stats');
    const fromStats = !statsEl.hidden;
    statsEl.hidden = true;
    render('quiz-aleatoire');
    const st = { screen: 'quiz-aleatoire' };
    if (fromStats && history.state && history.state.overlay === 'stats') history.replaceState(st, '', '#quiz-aleatoire');
    else history.pushState(st, '', '#quiz-aleatoire');
    Quiz.startErrorReview();
  }

  function wireNav() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-go]');
      if (btn) go(btn.dataset.go);
    });
    document.getElementById('screen-back').addEventListener('click', back);
    document.getElementById('screen-home').addEventListener('click', goHome);
    document.getElementById('btn-stats')?.addEventListener('click', openStats);
    document.getElementById('btn-errors')?.addEventListener('click', showErrorReview);

    window.addEventListener('popstate', (e) => {
      const statsEl = document.getElementById('view-stats');
      const st = e.state || { screen: 'home' };
      if (inner.length && st.screen === current && (st.inner || 0) < inner.length) {
        const niveau = inner.pop();
        niveau.up();
        // Retour à la même position dans la liste (et une 2e fois après le dessin, au cas où la page se rallonge).
        window.scrollTo(0, niveau.y);
        requestAnimationFrame(() => window.scrollTo(0, niveau.y));
        return;
      }
      statsEl.hidden = st.overlay !== 'stats';
      if (st.overlay === 'stats') return;
      // On ne réinitialise pas un écran de contenu quand on y revient par « retour ».
      if (st.screen === 'home') renderHome();
      render(st.screen);
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  // Reconstruit la pile d'écrans (accueil → menu → écran) pour que « retour » fonctionne normalement.
  let restauration = false;   // vrai pendant qu'on rejoue l'écran après un rafraîchissement (les écrans reprennent alors où ils en étaient)
  function restaurerEcran(voulu, sauve, serie) {
    const chaine = [];
    for (let n = voulu; n && n !== 'home'; n = screenEl(n)?.dataset.back) chaine.unshift(n);
    restauration = true;
    try {
      chaine.forEach(n => go(n));
      if (sauve) Fiches.restoreTheme(sauve);
      if (serie) Series.restaurerSerie(serie);
    } catch (e) { console.error('restauration', e); }   // une restauration ratée ne doit jamais bloquer l'appli
    finally { restauration = false; }
  }

  // Repères de lecture : fine barre de progression en haut quand on lit une fiche, bouton pour remonter.
  function wireLecture() {
    const bar = document.createElement('div');
    bar.className = 'lecture-bar';
    bar.hidden = true;
    bar.innerHTML = '<i></i>';
    document.body.append(bar);
    let attente = false;
    const maj = () => {
      attente = false;
      const reste = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      const lit = !!document.querySelector('.screen:not([hidden]) .fiche-card');
      bar.hidden = !(lit && reste > window.innerHeight * 0.8);
      if (!bar.hidden) bar.firstChild.style.width = Math.min(100, Math.max(0, (y / reste) * 100)) + '%';
    };
    window.addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
    document.addEventListener('screenchange', maj);
  }

  async function init() {
    // À lire avant que l'adresse soit remise à #home et que l'affichage de l'accueil efface les mémoires.
    const voulu = location.hash.slice(1);
    const sauveTheme = voulu === 'fiches-theme' ? Fiches.lireTheme() : null;
    const sauveSerie = voulu === 'quiz-theme' ? Series.lireSerie() : null;
    wireTheme();
    wireNav();
    wireLecture();
    registerServiceWorker();

    document.getElementById('home-greeting').textContent = 'Chargement…';
    await DataStore.init();

    history.replaceState({ screen: 'home' }, '', '#home');
    renderHome();
    render('home');

    // Rafraîchissement : on retourne à l'écran où l'on était (écran dans l'adresse, #nom).
    if (voulu && voulu !== 'home' && screenEl(voulu) && !new URLSearchParams(location.search).get('go')) {
      restaurerEcran(voulu, sauveTheme, sauveSerie);
    }

    // Ouverture depuis la notification du rappel quotidien
    if (new URLSearchParams(location.search).get('go') === 'daily') {
      history.replaceState({ screen: 'home' }, '', location.pathname + '#home');
      go('daily');
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.go === 'daily') go('daily'); });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { isRestoring: () => restauration, go, back, pushInner, openStats, closeStats, showErrorReview, toast, setAccentVar };
})();
