/* ===================== animations.js =====================
 * Tout ce qui, dans les animations, ne peut pas se faire en CSS seul. Ce fichier n'est lu par
 * aucun autre : il observe l'appli de l'extérieur, sans modifier son code.
 * Retirer les animations : supprimer ce fichier, css/animations.css et leurs deux lignes dans index.html.
 *
 * Contenu :
 *  - le réglage « Animations » (bouton en bas de l'accueil, sauvegardé en local, activé par défaut) ;
 *  - les transitions entre écrans (API View Transitions si dispo, sinon repli CSS) ;
 *  - le balayage des fiches du mode Aléatoire ;
 *  - l'état « chargement » de l'accueil.
 * ========================================================= */
(() => {
  const KEY = 'croc-animations';              // 'off' quand l'utilisateur les a coupées
  const root = document.documentElement;
  const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* stockage indisponible */ } };

  let userOn = read() !== 'off';
  const isOn = () => userOn && !reduce.matches;

  // ---------- Réglage ----------
  function apply() {
    root.classList.toggle('anim-on', isOn());
    if (!isOn()) root.classList.remove('anim-busy', 'vt-fwd', 'vt-back', 'vt-home');
    const btn = document.getElementById('btn-anim');
    if (btn) {
      btn.textContent = reduce.matches
        ? '✨ Animations : désactivées (réglage du téléphone)'
        : `✨ Animations : ${userOn ? 'activées' : 'désactivées'}`;
      btn.setAttribute('aria-pressed', userOn ? 'true' : 'false');
    }
  }
  function setOn(on) { userOn = !!on; write(on ? 'on' : 'off'); apply(); }

  function injectButton() {
    const footer = document.querySelector('.home-footer');
    if (!footer || document.getElementById('btn-anim')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-anim';
    btn.className = 'home-link';
    btn.addEventListener('click', () => {
      setOn(!userOn);
      if (window.App && App.toast) App.toast(userOn ? 'Animations activées' : 'Animations désactivées');
    });
    footer.appendChild(btn);
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

  // ---------- Balayage des fiches (mode Aléatoire) ----------
  function setupSwipe() {
    const stage = document.getElementById('fiches-aleatoire-card');
    if (!stage) return;
    const nextBtn = () => stage.querySelector('.btn-next');

    stage.addEventListener('pointerdown', (ev) => {
      if (!isOn() || ev.button > 0) return;
      const card = ev.target.closest('.fiche-card');
      if (!card || ev.target.closest('button, a, input, textarea')) return;
      const x0 = ev.clientX, y0 = ev.clientY, t0 = performance.now();
      let mode = 'wait';   // wait → swiping (on suit le doigt) ou abort (c'est un défilement vertical)
      let dx = 0;

      const move = (e) => {
        dx = e.clientX - x0;
        const dy = e.clientY - y0;
        if (mode === 'wait') {
          if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { mode = 'abort'; cleanup(); return; }
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            mode = 'swiping';
            root.classList.add('anim-busy');
            card.classList.add('is-swiping');
          } else return;
        }
        card.style.transform = `translate3d(${dx}px, 0, 0) rotate(${dx * 0.035}deg)`;
        card.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / (window.innerWidth * 1.1)));
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };

      const up = () => {
        cleanup();
        if (mode !== 'swiping') return;
        const v = Math.abs(dx) / Math.max(1, performance.now() - t0);   // px par ms
        card.classList.remove('is-swiping');
        if (Math.abs(dx) > card.offsetWidth * 0.28 || v > 0.6) {
          const sens = dx < 0 ? -1 : 1;
          card.classList.add('is-flying');
          card.style.transform = `translate3d(${sens * window.innerWidth}px, 0, 0) rotate(${sens * 16}deg)`;
          card.style.opacity = '0';
          setTimeout(() => { root.classList.remove('anim-busy'); const b = nextBtn(); if (b) b.click(); }, 230);
        } else {
          card.classList.add('is-returning');
          card.style.transform = '';
          card.style.opacity = '';
          setTimeout(() => { card.classList.remove('is-returning'); root.classList.remove('anim-busy'); }, 320);
        }
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });

    // Ordinateur : flèches gauche/droite = même geste
    document.addEventListener('keydown', (e) => {
      if (!isOn() || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
      const screen = screenOf('fiches-aleatoire');
      const card = stage.querySelector('.fiche-card');
      if (!screen || screen.hidden || !card || card.classList.contains('is-flying')) return;
      const sens = e.key === 'ArrowLeft' ? -1 : 1;
      root.classList.add('anim-busy');
      card.classList.add('is-flying');
      card.style.transform = `translate3d(${sens * window.innerWidth}px, 0, 0) rotate(${sens * 16}deg)`;
      card.style.opacity = '0';
      setTimeout(() => { root.classList.remove('anim-busy'); const b = nextBtn(); if (b) b.click(); }, 230);
    });
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
  injectButton();
  apply();
  watchScreens();
  setupSwipe();
  watchLoading();
  if (reduce.addEventListener) reduce.addEventListener('change', apply);
  window.Anim = { isOn, setOn };
})();
