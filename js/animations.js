/* ===================== animations.js =====================
 * Tout ce qui, dans les animations, ne peut pas se faire en CSS seul. Ce fichier n'est lu par
 * aucun autre : il observe l'appli de l'extérieur, sans modifier son code.
 * Retirer les animations : supprimer ce fichier, css/animations.css et leurs deux lignes dans index.html.
 *
 * Contenu :
 *  - l'activation des animations : toujours actives, sauf si l'appareil demande de réduire les animations ;
 *  - les transitions entre écrans (API View Transitions si dispo, sinon repli CSS) ;
 *  - l'état « chargement » de l'accueil, l'écran de démarrage ;
 *  - l'étoile des favoris (étincelles), les confettis, la lueur à la souris, la couleur de la barre du téléphone.
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
  // Désactivées (false) : sur Samsung Browser, l'API View Transitions superposait l'ancien et le nouvel écran
  // un instant (effet de « rafraîchissement »). Le repli CSS ci-dessous est utilisé à la place.
  const USE_VIEW_TRANSITIONS = false;
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
    if (replaying || !USE_VIEW_TRANSITIONS || !isOn() || !document.startViewTransition) return;
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
        // L'accueil apparaît en simple fondu (sans glissement) : un mouvement de toute la page y ressemblait à un rafraîchissement
        const dir = name === 'home' ? 'fade' : depth(name) > depth(shown) ? 'fwd' : depth(name) < depth(shown) ? 'back' : 'fade';
        shown = name;
        setThemeColor(name);
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

  // ---------- Couleur de la barre du téléphone (meta theme-color), selon la rubrique ----------
  const THEME_COLORS = { home: '#0a0e1a', fiches: '#12306e', quiz: '#2a1b6b', dragon: '#0b4533', daily: '#5a3a0e' };
  function setThemeColor(name) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const key = !name || name === 'home' ? 'home' : name === 'daily' ? 'daily' : name === 'dragon' ? 'dragon' : /^quiz/.test(name) ? 'quiz' : 'fiches';
    meta.setAttribute('content', THEME_COLORS[key]);
  }

  // ---------- Étoile des favoris : « pop » et étincelles ----------
  function setupStar() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.fav-btn');
      if (!b || !isOn()) return;
      setTimeout(() => {   // après que l'appli a repeint l'étoile
        if (!b.classList.contains('is-on')) return;
        b.classList.remove('is-popping'); void b.offsetWidth; b.classList.add('is-popping');
        for (let i = 0; i < 7; i++) {
          const sp = document.createElement('span');
          sp.className = 'fav-spark';
          const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
          const d = 20 + Math.random() * 8;
          sp.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
          sp.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
          b.appendChild(sp);
          setTimeout(() => sp.remove(), 650);
        }
      }, 0);
    }, true);   // capture : l'appli arrête la propagation du clic sur l'étoile
  }

  // ---------- Confettis ----------
  const CONFETTI_COLORS = ['#5cc8ff', '#2f7bff', '#a98bff', '#7b5cff', '#ffc27a', '#ff8fb8', '#6ee7a8'];
  const rand = (a, b) => a + Math.random() * (b - a);
  function confetti(n) {
    if (!isOn()) return;
    const box = document.createElement('div');
    box.className = 'a-confetti';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = rand(4, 96).toFixed(1) + '%';
      p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      p.style.setProperty('--x', rand(-90, 90).toFixed(0) + 'px');
      p.style.setProperty('--r', rand(-540, 540).toFixed(0) + 'deg');
      p.style.setProperty('--d', rand(1500, 2400).toFixed(0) + 'ms');
      p.style.setProperty('--dl', rand(0, 350).toFixed(0) + 'ms');
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3000);
  }
  // On fête la fin d'une bouchée du jour ou d'une série de quiz, seulement quand on vient de répondre
  // à une question (pas quand on rouvre simplement un écran « terminé »).
  function watchCelebrations() {
    const view = document.getElementById('view-root');
    if (!view) return;
    const hasQuiz = (n) => n.nodeType === 1 && (n.matches('.quiz-card') || n.querySelector('.quiz-card'));
    new MutationObserver((muts) => {
      if (!isOn()) return;
      const justAnswered = muts.some(m => [...m.removedNodes].some(hasQuiz));
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const daily = node.matches('.daily-end') ? node : node.querySelector('.daily-end');
          if (daily) {
            // le score (« 4/5 ») et la série (« 🔥 3 ») défilent ; seul le premier nombre de chaque valeur
            daily.querySelectorAll('.daily-end__value').forEach(v => animateNumbers(v, [0], 800));
            if (justAnswered) confetti(/Sans faute/.test(daily.textContent) ? 60 : 34);
            continue;
          }
          const serie = node.matches('.serie-end') ? node : node.querySelector('.serie-end');
          if (serie) {
            const pct = parseFloat(serie.dataset.pct || '0');
            animateNumbers(serie.querySelector('.serie-end__value'), [0], 900);
            if (justAnswered && pct >= 0.5) confetti(pct === 1 ? 70 : pct >= 0.9 ? 46 : 28);
            continue;
          }
          const fin = node.matches('.empty-state') ? node : node.querySelector('.empty-state');
          if (justAnswered && fin && /🎉/.test(fin.textContent)) confetti(34);
        }
      }
    }).observe(view, { childList: true, subtree: true });
  }

  // ---------- Écran de démarrage : le logo apparaît en douceur ----------
  function splash() {
    if (!isOn() || !document.body) return;
    const el = document.createElement('div');
    el.id = 'a-splash';
    el.innerHTML = '<img src="icons/icon-192.png" alt="">';
    document.body.appendChild(el);
    const t0 = performance.now();
    const g = document.getElementById('home-greeting');
    let left = false;
    const leave = () => { if (left) return; left = true; el.classList.add('is-leaving'); setTimeout(() => el.remove(), 380); };
    const ready = () => g && /thèmes/.test(g.textContent || '');   // l'accueil affiche ses chiffres : les données sont là
    const check = () => {
      if (!ready()) return false;
      setTimeout(leave, Math.max(0, 450 - (performance.now() - t0)));
      return true;
    };
    if (!check() && g) {
      const mo = new MutationObserver(() => { if (check()) mo.disconnect(); });
      mo.observe(g, { childList: true, characterData: true, subtree: true });
    }
    setTimeout(leave, 5000);   // filet de sécurité : jamais bloquant
  }

  // ---------- Ordinateur : lueur qui suit la souris ----------
  function setupGlow() {
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const SEL = '.home-card, .daily-card, .mode-card, .domain-tile, .subtheme-row, .fiche-list-item';
    document.addEventListener('pointermove', (e) => {
      if (!isOn()) return;
      const c = e.target.closest && e.target.closest(SEL);
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    }, { passive: true });
  }

  // ---------- Nombres qui défilent (accueil, fin de bouchée) ----------
  // Remplace les nombres du texte de l'élément par une valeur qui monte de 0 à sa valeur finale.
  // « only » : indices des nombres à animer (les autres restent fixes, ex. le total dans « 4/5 »).
  function animateNumbers(el, only, dur = 900) {
    if (!isOn() || !el) return;
    const original = el.textContent;
    const toks = [...original.matchAll(/\d+(?:[\u202f\u00a0 ]\d{3})*/g)];
    if (!toks.length) return;
    const finals = toks.map(t => parseInt(t[0].replace(/\D/g, ''), 10));
    const anime = new Set(toks.map((_, i) => i).filter(i => !only || only.includes(i)));
    const render = (k) => {
      let out = '', last = 0;
      toks.forEach((t, i) => {
        out += original.slice(last, t.index);
        out += anime.has(i) ? Math.round(finals[i] * k).toLocaleString('fr-FR') : t[0];
        last = t.index + t[0].length;
      });
      el.textContent = out + original.slice(last);
    };
    const t0 = performance.now();
    render(0);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      render(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step); else el.textContent = original;
    };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = original; }, dur + 400);   // filet : le texte final est toujours remis
  }

  // Accueil : « 21 thèmes · 2 079 fiches · … » défile une fois par lancement, après l'écran de démarrage
  function countGreeting() {
    const g = document.getElementById('home-greeting');
    if (!g) return;
    let done = false;
    const start = () => {
      if (done || !/thèmes/.test(g.textContent || '')) return;
      done = true;
      if (!isOn()) return;
      const go = () => animateNumbers(g, null, 1000);
      const sp = () => document.getElementById('a-splash');
      if (sp() && !sp().classList.contains('is-leaving')) {
        const iv = setInterval(() => { const s = sp(); if (!s || s.classList.contains('is-leaving')) { clearInterval(iv); go(); } }, 60);
        setTimeout(() => clearInterval(iv), 6000);
      } else go();
    };
    new MutationObserver(start).observe(g, { childList: true, characterData: true, subtree: true });
    start();
  }

  // Notification : on relance l'animation quand le message change alors qu'elle est déjà affichée
  function watchToast() {
    const t = document.getElementById('toast');
    if (!t) return;
    new MutationObserver(() => {
      if (!isOn() || t.hidden) return;
      t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    }).observe(t, { childList: true, characterData: true, subtree: true });
  }

  // ---------- Démarrage ----------
  apply();
  watchScreens();
  setupStar();
  watchCelebrations();
  setupGlow();
  splash();
  countGreeting();
  watchToast();
  watchLoading();
  if (reduce.addEventListener) reduce.addEventListener('change', apply);
  window.Anim = { isOn };
})();
