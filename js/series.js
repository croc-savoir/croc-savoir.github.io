/* ===================== Séries de quiz et quiz du jour =====================
 * - Série : on choisit un thème (ou « Tous les thèmes »), puis 10, 15 ou 20 questions.
 *   Écran final : score, médaille, couleur du froid au chaud, erreurs corrigées.
 * - Quiz du jour : 20 questions identiques pour tout le monde (tirage fixé par la date),
 *   tous thèmes confondus, une seule tentative par jour.
 * Le moteur d'une question (choisir puis valider, correction, enregistrement) reste dans quiz.js.
 * =========================================================================== */
const Series = (() => {
  const LENGTHS = [
    { n: 10, icon: '⚡', label: 'Express', desc: 'Environ 3 minutes' },
    { n: 15, icon: '🎯', label: 'Classique', desc: 'Environ 5 minutes' },
    { n: 20, icon: '🏆', label: 'Marathon', desc: 'Environ 7 minutes' },
  ];
  const N_JOUR = 20;
  const ALL = '*';

  function escapeHTML(s) {
    return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  const pad = n => String(n).padStart(2, '0');
  function dayKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  // ---------- Médaille, couleur, message ----------
  function medalFor(pct) {
    if (pct >= 0.9) return { emoji: '🥇', label: 'Médaille d’or' };
    if (pct >= 0.7) return { emoji: '🥈', label: 'Médaille d’argent' };
    if (pct >= 0.5) return { emoji: '🥉', label: 'Médaille de bronze' };
    return null;
  }
  function messageFor(pct) {
    if (pct === 1) return 'Sans faute, impressionnant !';
    if (pct >= 0.9) return 'Excellent !';
    if (pct >= 0.7) return 'Très bien joué !';
    if (pct >= 0.5) return 'Pas mal du tout !';
    return 'Continue, tu progresses !';
  }
  // Teinte du score : bleu glacé (0 %) → cyan → vert → jaune → orange → rouge-orangé « en feu » (100 %)
  function hueFor(pct) { return Math.round(210 - 202 * pct); }

  // ---------- Texte de la bonne réponse (pour la liste des erreurs) ----------
  function questionText(it) {
    if (it.format === 'qui-suis-je') return 'Qui suis-je ? ' + (it.indices && it.indices[0] ? '« ' + it.indices[0] + ' »' : '');
    return it.question || it.affirmation || '';
  }
  function answerText(it) {
    switch (it.format) {
      case 'qcm': case 'difference': return it.choix ? it.choix[it.bonneReponse] : '';
      case 'vrai-faux': return it.reponse ? 'Vrai' : 'Faux';
      case 'associer': return (it.paires || []).map(p => `${p.gauche} → ${p.droite}`).join(' · ');
      case 'frise': return [...(it.evenements || [])].sort((a, b) => parseFloat(a.annee) - parseFloat(b.annee)).map(e => `${e.label} (${e.annee})`).join(' → ');
      case 'qui-suis-je': return it.reponse || '';
      default: return '';
    }
  }

  // ---------- Déroulé d'une série de questions ----------
  // box : conteneur ; items : questions ; hooks : { index, results, onStep(nbFaites, results), onFinish(results), onQuit }
  function playItems(box, items, hooks) {
    const results = hooks.results || [];
    const total = items.length;

    function show(i) {
      box.innerHTML = '';
      if (i >= total) { hooks.onFinish(results); return; }
      const head = document.createElement('div');
      head.className = 'serie-head';
      head.innerHTML = `<span class="serie-head__count">Question ${i + 1}/${total}</span>`;
      if (hooks.onQuit) {
        const quit = document.createElement('button');
        quit.type = 'button';
        quit.className = 'serie-head__quit';
        quit.textContent = 'Quitter';
        quit.addEventListener('click', hooks.onQuit);
        head.appendChild(quit);
      }
      const bar = document.createElement('div');
      bar.className = 'serie-bar';
      const fill = document.createElement('i');
      fill.className = 'serie-bar__fill';
      fill.style.setProperty('--p', String(i / total));
      bar.appendChild(fill);
      const stage = document.createElement('div');
      stage.className = 'card-stage';
      box.appendChild(head);
      box.appendChild(bar);
      box.appendChild(stage);
      // La barre se remplit en douceur jusqu'à la question en cours (+1 : celle-ci compte une fois répondue)
      setTimeout(() => fill.style.setProperty('--p', String((i + 1) / total)), 40);
      Quiz.renderQuestion(items[i], stage, () => {
        const meta = Store.getQuizMeta(items[i].id);
        results[i] = !!(meta && meta.lastResult);
        if (hooks.onStep) hooks.onStep(i + 1, results);
        show(i + 1);
      });
    }
    show(hooks.index || 0);
  }

  // ---------- Écran final ----------
  function renderEnd(box, items, results, opts) {
    const total = items.length;
    const score = results.filter(Boolean).length;
    const pct = total ? score / total : 0;
    const medal = medalFor(pct);
    box.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'serie-end' + (pct === 1 ? ' is-perfect' : '');
    wrap.dataset.pct = String(pct);
    wrap.style.setProperty('--score-h', String(hueFor(pct)));

    let flames = '';
    if (pct === 1) {
      for (let k = 0; k < 9; k++) {   // flammes en demi-cercle autour du score
        const a = (195 + k * 18.75) * Math.PI / 180;
        flames += `<span class="serie-end__flame" style="left:calc(50% + ${(Math.cos(a) * 112).toFixed(0)}px);top:calc(50% - ${(Math.sin(a) * 50).toFixed(0)}px);--fd:${(k * 130) % 700}ms">🔥</span>`;
      }
    }
    wrap.innerHTML = `
      <p class="serie-end__title">${escapeHTML(opts.title)}</p>
      <div class="serie-end__scorebox">
        <span class="serie-end__value">${score}/${total}</span>
        <span class="serie-end__pct">${Math.round(pct * 100)} % de réussite</span>
        ${flames}
      </div>
      ${medal ? `<div class="serie-end__medal"><span class="serie-end__medal-emoji">${medal.emoji}</span><span>${medal.label}</span></div>` : ''}
      <p class="serie-end__msg">${messageFor(pct)}</p>`;

    // Erreurs corrigées
    const wrong = items.map((it, i) => ({ it, ok: results[i] })).filter(x => !x.ok);
    if (wrong.length) {
      const sec = document.createElement('div');
      sec.className = 'serie-errors';
      sec.innerHTML = `<h3 class="serie-errors__title">À retenir (${wrong.length})</h3>` + wrong.map(({ it }) => `
        <div class="serie-err">
          <div class="serie-err__q">${escapeHTML(questionText(it))}</div>
          <div class="serie-err__a">✓ ${escapeHTML(answerText(it))}</div>
          ${it.explication ? `<div class="serie-err__e">${escapeHTML(it.explication)}</div>` : ''}
        </div>`).join('');
      wrap.appendChild(sec);
    }

    const actions = document.createElement('div');
    actions.className = 'serie-end__actions';
    (opts.actions || []).forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-ghost');
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      actions.appendChild(b);
    });
    wrap.appendChild(actions);
    box.appendChild(wrap);
    window.scrollTo(0, 0);
  }

  // =====================  SÉRIES  =====================
  let st = { level: 'domains', domainId: null };
  const seriesRoot = () => document.getElementById('quiz-theme-content');

  function initSeries() {
    st = { level: 'domains', domainId: null };
    renderSeries();
  }

  function crumb(title, onBack) {
    const row = document.createElement('div');
    row.className = 'crumb-row';
    row.innerHTML = `<button type="button" class="crumb-back">‹ Retour</button><span class="crumb-title">${escapeHTML(title)}</span>`;
    row.querySelector('button').addEventListener('click', onBack);
    return row;
  }

  function poolFor(domainId) { return domainId === ALL ? DataStore.getAllQuiz() : DataStore.getQuiz(domainId); }
  function labelFor(domainId) {
    if (domainId === ALL) return '🎲 Tous les thèmes';
    const d = DataStore.getDomain(domainId);
    return d ? `${d.emoji} ${d.label}` : '';
  }

  function renderSeries() {
    const root = seriesRoot();
    root.innerHTML = '';

    if (st.level === 'domains') {
      const intro = document.createElement('p');
      intro.className = 'mode-intro';
      intro.textContent = 'Sur quel thème veux-tu te tester ?';
      root.appendChild(intro);
      const grid = document.createElement('div');
      grid.className = 'domain-grid';
      const tile = (id, emoji, label, count, hue, wide) => {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'domain-tile' + (wide ? ' domain-tile--wide' : '');
        t.style.setProperty('--th', hue);
        const n = DataStore.compte(count, 'question');
        t.innerHTML = `<span class="domain-tile__emoji">${emoji}</span><span class="domain-tile__label">${escapeHTML(label)}</span>${n ? `<span class="domain-tile__count">${n}</span>` : ''}`;
        t.addEventListener('click', () => {
          const prev = { ...st };
          App.pushInner(() => { st = prev; renderSeries(); });
          st = { level: 'lengths', domainId: id };
          renderSeries();
        });
        return t;
      };
      grid.appendChild(tile(ALL, '🎲', 'Tous les thèmes', DataStore.getAllQuiz().length, 215, true));
      const counts = DataStore.domainCounts();
      DataStore.getDomains().forEach(d => grid.appendChild(tile(d.id, d.emoji, d.label, counts[d.id]?.quiz || 0, d.hue ?? 220, false)));
      root.appendChild(grid);
      return;
    }

    if (st.level === 'lengths') {
      root.appendChild(crumb(labelFor(st.domainId), () => App.back()));
      const intro = document.createElement('p');
      intro.className = 'mode-intro';
      intro.textContent = 'Combien de questions ?';
      root.appendChild(intro);
      const pool = poolFor(st.domainId);
      const list = document.createElement('div');
      list.className = 'mode-list';
      LENGTHS.forEach(L => {
        const n = Math.min(L.n, pool.length);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mode-card';
        b.disabled = pool.length === 0;
        b.innerHTML = `<span class="mode-card__icon">${L.icon}</span><span class="mode-card__text"><span class="mode-card__title">${L.n} questions · ${L.label}</span><span class="mode-card__desc">${L.desc}${n < L.n ? ` (ce thème n’a que ${n} questions)` : ''}</span></span><span class="mode-card__arrow">›</span>`;
        b.addEventListener('click', () => startPlay(st.domainId, L.n));
        list.appendChild(b);
      });
      root.appendChild(list);
      return;
    }

    if (st.level === 'play') {
      playItems(root, st.items, {
        onQuit: () => App.back(),
        onFinish: (results) => {
          renderEnd(root, st.items, results, {
            title: `${labelFor(st.domainId)} · ${st.items.length} questions`,
            actions: [
              { label: 'Rejouer', primary: true, onClick: () => startPlay(st.domainId, st.n) },
              { label: 'Autre thème', onClick: () => App.back() },
            ],
          });
        },
      });
    }
  }

  // Tire les questions (jamais vues ou à revoir en priorité) et lance la série, sans empiler d'historique
  function startPlay(domainId, n) {
    const pool = poolFor(domainId);
    const items = SRS.pickWeighted(pool, it => Store.getQuizMeta(it.id), Math.min(n, pool.length));
    st = { level: 'play', domainId, n, items };
    renderSeries();
    window.scrollTo(0, 0);
  }

  // =====================  QUIZ DU JOUR  =====================
  // Tirage identique pour tout le monde : mélange déterminé par la date (graine), sur la liste triée par identifiant.
  function seededRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function pickOfTheDay(day) {
    const all = [...DataStore.getAllQuiz()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const rnd = seededRandom('croc-savoir-quiz-du-jour-' + day);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return all.slice(0, N_JOUR);
  }
  function jourItems(qj) {
    const byId = DataStore.getAllQuizById();
    const items = (qj.ids || []).map(id => byId[id]).filter(Boolean);
    return items.length === (qj.ids || []).length ? items : null;
  }
  function currentJour() {
    const day = dayKey();
    let qj = Store.getQuizJour();
    if (qj && qj.date === day && jourItems(qj)) return qj;
    return null;
  }

  function shareText(qj, items) {
    const total = items.length;
    const score = (qj.results || []).filter(Boolean).length;
    const medal = medalFor(total ? score / total : 0);
    const [y, m, d] = qj.date.split('-');
    const squares = items.map((_, i) => (qj.results[i] ? '🟩' : '🟥')).join('');
    return `Croc'Savoir · Quiz du jour ${d}/${m}\n${medal ? medal.emoji + ' ' : ''}${score}/${total}\n${squares}\nhttps://croc-savoir.github.io`;
  }
  async function share(text) {
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); App.toast('Score copié : colle-le à un ami !'); }
    catch (e) { App.toast('Impossible de copier le score'); }
  }

  function renderJourEnd(root, qj) {
    const items = jourItems(qj);
    renderEnd(root, items, qj.results, {
      title: 'Quiz du jour',
      actions: [
        { label: 'Partager mon score', primary: true, onClick: () => share(shareText(qj, items)) },
        { label: 'Retour', onClick: () => App.back() },
      ],
    });
    const note = document.createElement('p');
    note.className = 'serie-end__note';
    note.textContent = 'Une seule tentative par jour : reviens demain pour 20 nouvelles questions !';
    root.querySelector('.serie-end').insertBefore(note, root.querySelector('.serie-end__actions'));
  }

  function initJour() {
    const root = document.getElementById('quiz-jour-content');
    root.innerHTML = '';
    let qj = currentJour();

    if (qj && qj.done) { renderJourEnd(root, qj); updateHomeCard(); return; }

    const launch = () => {
      const items = jourItems(qj);
      playItems(root, items, {
        index: qj.results.length,
        results: qj.results,
        onStep: (done, results) => { qj.results = results.slice(0, done); Store.setQuizJour(qj); updateHomeCard(); },
        onFinish: (results) => {
          qj.results = results.slice();
          qj.done = true;
          qj.score = qj.results.filter(Boolean).length;
          Store.setQuizJour(qj);
          updateHomeCard();
          renderJourEnd(root, qj);
        },
        onQuit: () => App.back(),
      });
    };

    if (qj) { launch(); return; }   // une série du jour est déjà commencée : on la reprend

    const total = N_JOUR;
    const intro = document.createElement('div');
    intro.className = 'serie-intro';
    intro.innerHTML = `
      <div class="serie-intro__emoji">🗓️</div>
      <h2 class="serie-intro__title">Quiz du jour</h2>
      <p class="serie-intro__text">${total} questions, tous thèmes mélangés, <strong>les mêmes pour tout le monde aujourd’hui</strong>. Une seule tentative : compare ton score avec tes amis !</p>
      <ul class="serie-intro__list"><li>Pas de choix de thème ni de difficulté</li><li>Une médaille selon ton score</li><li>Ton score se partage en un geste</li></ul>`;
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn btn-primary serie-intro__go';
    go.textContent = 'Commencer';
    go.addEventListener('click', () => {
      const picks = pickOfTheDay(dayKey());
      if (picks.length < N_JOUR) { App.toast('Pas assez de questions pour le moment'); return; }
      qj = { date: dayKey(), ids: picks.map(q => q.id), results: [], done: false };
      Store.setQuizJour(qj);
      launch();
    });
    intro.appendChild(go);
    root.appendChild(intro);
  }

  // Carte de l'accueil
  function updateHomeCard() {
    const desc = document.getElementById('quizjour-desc');
    const card = document.getElementById('quizjour-card');
    if (!desc || !card) return;
    const qj = currentJour();
    card.classList.toggle('is-done', !!(qj && qj.done));
    if (qj && qj.done) {
      const medal = medalFor(qj.score / qj.ids.length);
      desc.textContent = `Terminé ✓ · ${qj.score}/${qj.ids.length}${medal ? ' ' + medal.emoji : ''} · À demain !`;
    } else if (qj) {
      desc.textContent = `En cours · ${qj.results.length} sur ${qj.ids.length} · Reprendre`;
    } else {
      desc.textContent = `${N_JOUR} questions · les mêmes pour tout le monde`;
    }
  }

  return { initSeries, initJour, updateHomeCard };
})();
