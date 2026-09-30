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
    const palettes = {
      pink: { a: '#e0568c', a2: '#ff8fb8', ap: '#ffd3e6', rgb: '224, 86, 140' },
      blue: { a: '#2f7bff', a2: '#5cc8ff', ap: '#cfe8ff', rgb: '47, 123, 255' },
    };
    const p = palettes[name] || palettes.blue;
    root.style.setProperty('--accent', p.a);
    root.style.setProperty('--accent-2', p.a2);
    root.style.setProperty('--accent-pale', p.ap);
    root.style.setProperty('--accent-rgb', p.rgb);
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
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
    if (name === 'quiz-theme') Quiz.initTheme();
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
    inner.push(up);
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
      `${nD} thèmes · ${approx(nF, 'fiches')} · ${approx(nQ, 'quiz')}`;
    renderDailyCard();
    document.getElementById('dragon-badge').hidden = !Dragon.hasDue();
    const nErr = Store.getErrorIds().length;
    const errBtn = document.getElementById('btn-errors');
    errBtn.hidden = nErr === 0;
    errBtn.textContent = `🔁 Revoir mes erreurs (${nErr})`;
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
    document.getElementById('btn-stats').addEventListener('click', openStats);
    document.getElementById('btn-errors').addEventListener('click', showErrorReview);

    window.addEventListener('popstate', (e) => {
      const statsEl = document.getElementById('view-stats');
      const st = e.state || { screen: 'home' };
      if (inner.length && st.screen === current && (st.inner || 0) < inner.length) {
        inner.pop()();
        window.scrollTo(0, 0);
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

  async function init() {
    setAccentVar('blue');
    wireNav();
    registerServiceWorker();

    document.getElementById('home-greeting').textContent = 'Chargement…';
    await DataStore.init();

    history.replaceState({ screen: 'home' }, '', '#home');
    renderHome();
    render('home');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { go, back, pushInner, openStats, closeStats, showErrorReview, toast, setAccentVar };
})();
