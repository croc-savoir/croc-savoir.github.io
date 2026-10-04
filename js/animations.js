/* ===================== animations.js =====================
 * Tout ce qui, dans les animations, ne peut pas se faire en CSS seul. Ce fichier n'est lu par
 * aucun autre : il observe l'appli de l'extérieur, sans modifier son code.
 * Retirer les animations : supprimer ce fichier, css/animations.css et leurs deux lignes dans index.html.
 *
 * Contenu :
 *  - l'activation des animations : toujours actives, sauf si l'appareil demande de réduire les animations ;
 *  - les transitions entre écrans (API View Transitions si dispo, sinon repli CSS) ;
 *  - l'état « chargement » de l'accueil.
 * ========================================================= */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // Pas de réglage dans l'appli : les animations sont les mêmes pour tout le monde.
  const isOn = () => !reduce.matches;

  // ---------- Activation ----------
  function apply() {
    root.classList.toggle('anim-on', isOn());
    if (!isOn()) root.classList.remove('anim-busy', 'vt-fwd', 'vt-back', 'vt-home');
  }

  // ---------- Transitions entre écrans ----------
  const screenOf = (name) => document.querySelector(`.screen[data-screen="${name}"]`);
  function depth(name) {
    let d = 0, n = name;
    while (n && n !== 'home' && d < 8) { n = screenOf(n)?.dataset.back; d += 1; }
    return d;
  }

  let shown = 'home';
  let viewTransitionRunning = false;
  let replaying = false;

  // a) API View Transitions : on intercepte le clic, on laisse le navigateur photographier l'écran,
  //    puis on rejoue le clic à l'intérieur de la transition (l'appli fait alors son changement d'écran).
  document.addEventListener('click', (e) => {
    if (replaying || !isOn() || !document.startViewTransition) return;
    const t = e.target.closest && e.target.closest('[data-go], #screen-back, #screen-home');
    if (!t || t.disabled) return;
    const dir = t.id === 'screen-back' ? 'back' : t.id === 'screen-home' ? 'home' : 'fwd';
    e.stopImmediatePropagation();
    e.preventDefault();
    root.classList.add(`vt-${dir}`, 'anim-busy');
    viewTransitionRunning = true;
    const fin = () => { root.classList.remove(`vt-${dir}`, 'anim-busy'); viewTransitionRunning = false; };
    let vt;
    try {
      vt = document.startViewTransition(() => new Promise((resolve) => {
        // Le bouton Retour passe par l'historique du navigateur (réponse un instant plus tard) :
        // on attend ce signal pour que la transition voie bien le nouvel écran.
        let fini = false;
        const termine = () => { if (fini) return; fini = true; window.removeEventListener('popstate', termine); setTimeout(resolve, 0); };
        window.addEventListener('popstate', termine);
        replaying = true; try { t.click(); } finally { replaying = false; }
        if (dir === 'back') setTimeout(termine, 250); else termine();
      }));
    } catch (err) {
      fin(); replaying = true; try { t.click(); } finally { replaying = false; }
      return;
    }
    vt.finished.then(fin, fin);
  }, true);

  // b) Repli CSS : quand un écran apparaît sans View Transition (navigateur ancien, geste « retour »
  //    du téléphone…), on lui donne une entrée glissée ou en fondu selon le sens.
  function watchScreens() {
    const view = document.getElementById('view-root');
    if (!view) return;
    new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target;
        if (!el.classList || !el.classList.contains('screen') || el.hidden) continue;
        const name = el.dataset.screen;
        if (name === shown) continue;
        const dir = depth(name) > depth(shown) ? 'fwd' : depth(name) < depth(shown) ? 'back' : 'fade';
        shown = name;
        if (!isOn() || viewTransitionRunning) continue;
        const cls = `anim-in-${dir}`;
        root.classList.add('anim-busy');
        el.classList.add(cls);
        const end = () => { el.classList.remove(cls); root.classList.remove('anim-busy'); el.removeEventListener('animationend', end); };
        el.addEventListener('animationend', end);
        setTimeout(end, 700); // filet de sécurité
      }
    }).observe(view, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }

  // ---------- Chargement de l'accueil : pulsation douce ----------
  function watchLoading() {
    const g = document.getElementById('home-greeting');
    if (!g) return;
    const check = () => root.classList.toggle('anim-loading', /^Chargement/.test(g.textContent || ''));
    check();
    new MutationObserver(check).observe(g, { childList: true, characterData: true, subtree: true });
  }

  // ---------- Démarrage ----------
  apply();
  watchScreens();
  watchLoading();
  if (reduce.addEventListener) reduce.addEventListener('change', apply);
  window.Anim = { isOn };
})();
