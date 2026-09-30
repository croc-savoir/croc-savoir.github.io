/* ===================== Rendu et logique des quiz ===================== */
const Quiz = (() => {
  const FORMAT_LABELS = {
    qcm: 'QCM',
    'vrai-faux': 'Vrai ou faux',
    associer: 'Associer',
    frise: 'Remettre dans l\'ordre',
    difference: 'Différence',
    'qui-suis-je': 'Qui suis-je ?',
  };

  function escapeHTML(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function domainLabel(domainId) {
    const d = DataStore.getDomain(domainId);
    return d ? `${d.emoji} ${d.label}` : domainId;
  }

  // ---------------- Session engine ----------------
  // A "session" drives one container: a pool of items + a cursor, replayed
  // one at a time. `loop: true` reshuffles forever (Aléatoire); `loop: false`
  // shows a completion screen at the end (Par thème / Revoir mes erreurs).
  function createSession(container, pool, { loop, weighted, emptyMsg, onFinishedLabel, onBack }) {
    const state = { pool: pool.slice(), index: 0 };

    function order(items) {
      if (weighted) {
        return SRS.pickWeighted(items, (it) => Store.getQuizMeta(it.id), items.length);
      }
      return QuizGen.shuffle(items);
    }

    state.pool = order(state.pool);

    function renderEmpty() {
      container.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'empty-state';
      div.innerHTML = `<div class="empty-state__emoji">❓</div><div>${escapeHTML(emptyMsg || 'Aucune question disponible pour le moment.')}</div>`;
      container.appendChild(div);
    }

    function renderFinished() {
      container.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'empty-state';
      div.innerHTML = `<div class="empty-state__emoji">🎉</div><div>${escapeHTML(onFinishedLabel || 'Série terminée !')}</div>`;
      if (onBack) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.style.marginTop = '16px';
        btn.textContent = '‹ Retour';
        btn.addEventListener('click', onBack);
        div.appendChild(btn);
      }
      container.appendChild(div);
    }

    function next() {
      state.index += 1;
      renderCurrent();
    }

    function renderCurrent() {
      if (!state.pool.length) { renderEmpty(); return; }
      if (state.index >= state.pool.length) {
        if (loop) { state.pool = order(state.pool); state.index = 0; }
        else { renderFinished(); return; }
      }
      const item = state.pool[state.index];
      container.innerHTML = '';
      renderQuestion(item, container, next);
    }

    renderCurrent();
    return state;
  }

  function answeredWrap(container, item, correct, extra) {
    const meta = SRS.update(Store.getQuizMeta(item.id), correct);
    Store.recordQuizAnswer(item.id, correct, meta);

    const banner = document.createElement('div');
    banner.className = 'result-banner ' + (correct ? 'is-correct' : 'is-wrong');
    banner.textContent = correct ? '✓ Bonne réponse' : '✕ Pas tout à fait';
    container.appendChild(banner);

    if (item.explication) {
      const box = document.createElement('div');
      box.className = 'explication-box';
      box.innerHTML = `<strong>Explication —</strong> ${escapeHTML(item.explication)}`;
      container.appendChild(box);
    }
    // Questions « associer » : une phrase d'explication par paire.
    if (item.paires && item.paires.some(p => p.explication)) {
      const list = document.createElement('ul');
      list.className = 'pair-explain';
      list.innerHTML = item.paires.map(p => `
        <li><strong>${escapeHTML(p.gauche)} → ${escapeHTML(p.droite)}</strong><span>${escapeHTML(p.explication || '')}</span></li>`).join('');
      container.appendChild(list);
    }
    if (extra) container.appendChild(extra);

    if (item.source) {
      const src = document.createElement('div');
      src.className = 'fiche-card__source' + (/à vérifier/i.test(item.source) ? ' is-unverified' : '');
      src.textContent = (/à vérifier/i.test(item.source) ? '⚠️ ' : '📎 ') + item.source;
      src.style.marginTop = '10px';
      container.appendChild(src);
    }
  }

  function nextButton(onNext) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-next';
    btn.style.marginTop = '16px';
    btn.textContent = 'Suivante →';
    btn.addEventListener('click', onNext);
    return btn;
  }

  function cardShell(item) {
    const wrap = document.createElement('div');
    wrap.className = 'quiz-card';
    const badge = document.createElement('div');
    badge.className = 'quiz-card__format';
    badge.innerHTML = `${escapeHTML(FORMAT_LABELS[item.format] || item.format)} <span class="quiz-card__domain">· ${domainLabel(item.domain)}</span>`;
    wrap.appendChild(badge);
    return wrap;
  }

  function renderQuestion(item, container, next) {
    const wrap = cardShell(item);
    const body = document.createElement('div');
    body.className = 'quiz-body';
    wrap.appendChild(body);
    container.appendChild(wrap);

    const renderers = {
      qcm: renderQCM, difference: renderQCM,
      'vrai-faux': renderVF,
      associer: renderAssocier,
      frise: renderFrise,
      'qui-suis-je': renderQSJ,
    };
    (renderers[item.format] || renderQCM)(item, body, wrap, next);
  }

  // ---------------- QCM / Différence ----------------
  function renderQCM(item, body, wrap, next) {
    const q = document.createElement('p');
    q.className = 'quiz-card__question';
    q.textContent = item.question;
    body.appendChild(q);

    const list = document.createElement('div');
    list.className = 'opt-list';
    body.appendChild(list);

    let answered = false;
    item.choix.forEach((choix, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.type = 'button';
      btn.textContent = choix;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = i === item.bonneReponse;
        [...list.children].forEach((b, j) => {
          b.disabled = true;
          if (j === item.bonneReponse) b.classList.add('is-correct');
          else if (j === i) b.classList.add('is-wrong');
          else b.classList.add('is-dim');
        });
        const after = document.createElement('div');
        answeredWrap(after, item, correct);
        after.appendChild(nextButton(next));
        wrap.appendChild(after);
      });
      list.appendChild(btn);
    });
  }

  // ---------------- Vrai / Faux ----------------
  function renderVF(item, body, wrap, next) {
    const q = document.createElement('p');
    q.className = 'quiz-card__question';
    q.textContent = item.affirmation || item.question;
    body.appendChild(q);

    const row = document.createElement('div');
    row.className = 'vf-row';
    body.appendChild(row);

    let answered = false;
    [['Vrai', true], ['Faux', false]].forEach(([label, val]) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = val === item.reponse;
        [...row.children].forEach((b) => {
          b.disabled = true;
          const bIsTrue = b.textContent === 'Vrai';
          if (bIsTrue === item.reponse) b.classList.add('is-correct');
          else if (b === btn) b.classList.add('is-wrong');
          else b.classList.add('is-dim');
        });
        const after = document.createElement('div');
        answeredWrap(after, item, correct);
        after.appendChild(nextButton(next));
        wrap.appendChild(after);
      });
      row.appendChild(btn);
    });
  }

  // ---------------- Associer ----------------
  function renderAssocier(item, body, wrap, next) {
    const q = document.createElement('p');
    q.className = 'quiz-card__question';
    q.textContent = item.question || 'Associe chaque élément à sa paire.';
    body.appendChild(q);

    const board = document.createElement('div');
    board.className = 'pair-board';
    const leftCol = document.createElement('div');
    leftCol.className = 'pair-col';
    const rightCol = document.createElement('div');
    rightCol.className = 'pair-col';
    board.appendChild(leftCol);
    board.appendChild(rightCol);
    body.appendChild(board);

    const paires = item.paires;
    const rightShuffled = QuizGen.shuffle(paires.map((p, i) => ({ text: p.droite, idx: i })));

    let selectedLeft = null;
    let matchedCount = 0;
    let mistakes = 0;

    const leftBtns = paires.map((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pair-item';
      b.textContent = p.gauche;
      b.dataset.idx = i;
      b.addEventListener('click', () => {
        if (b.classList.contains('is-matched')) return;
        [...leftCol.children].forEach(c => c.classList.remove('is-selected'));
        b.classList.add('is-selected');
        selectedLeft = i;
      });
      leftCol.appendChild(b);
      return b;
    });

    const rightBtns = rightShuffled.map((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pair-item';
      b.textContent = r.text;
      b.dataset.idx = r.idx;
      b.addEventListener('click', () => {
        if (b.classList.contains('is-matched') || selectedLeft === null) return;
        if (Number(b.dataset.idx) === selectedLeft) {
          b.classList.add('is-matched');
          leftBtns[selectedLeft].classList.add('is-matched');
          matchedCount += 1;
          selectedLeft = null;
          if (matchedCount === paires.length) finish();
        } else {
          mistakes += 1;
          b.classList.add('is-wrong-flash');
          leftBtns[selectedLeft]?.classList.add('is-wrong-flash');
          setTimeout(() => {
            b.classList.remove('is-wrong-flash');
            leftBtns.forEach(l => l.classList.remove('is-wrong-flash', 'is-selected'));
          }, 450);
          selectedLeft = null;
        }
      });
      rightCol.appendChild(b);
      return b;
    });

    function finish() {
      const correct = mistakes === 0;
      // Réaligne la colonne de droite sur celle de gauche : on lit les bonnes paires ligne par ligne.
      paires.forEach((_, i) => {
        const b = rightBtns.find(r => Number(r.dataset.idx) === i);
        if (b) rightCol.appendChild(b);
      });
      board.classList.add('is-final');
      const after = document.createElement('div');
      answeredWrap(after, item, correct);
      after.appendChild(nextButton(next));
      wrap.appendChild(after);
    }
  }

  // ---------------- Frise chronologique ----------------
  function renderFrise(item, body, wrap, next) {
    const q = document.createElement('p');
    q.className = 'quiz-card__question';
    q.textContent = item.question || 'Touche les événements dans l\'ordre chronologique (du plus ancien au plus récent).';
    body.appendChild(q);

    const list = document.createElement('div');
    list.className = 'frise-list';
    body.appendChild(list);

    const events = QuizGen.shuffle(item.evenements.map((e, i) => ({ ...e, origIdx: i })));
    const correctOrder = [...item.evenements]
      .map((e, i) => ({ ...e, origIdx: i }))
      .sort((a, b) => parseFloat(a.annee) - parseFloat(b.annee));

    const selection = [];
    const itemEls = events.map((e) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'frise-item';
      el.innerHTML = `<span class="frise-item__handle">${e.origIdx === -1 ? '' : '☰'}</span><span>${e.label}</span><span class="frise-item__year-tag"></span>`;
      el.addEventListener('click', () => {
        if (el.disabled) return;
        el.disabled = true;
        selection.push(e);
        el.querySelector('.frise-item__handle').textContent = String(selection.length);
        if (selection.length === events.length) finish();
      });
      list.appendChild(el);
      return el;
    });

    function finish() {
      // Pour chaque élément, on compare le rang auquel il a été touché
      // au rang qu'il occupe dans l'ordre chronologique réel.
      let correct = true;
      events.forEach((e, domIdx) => {
        const el = itemEls[domIdx];
        const clickRank = selection.indexOf(e);
        const correctRank = correctOrder.findIndex(c => c.origIdx === e.origIdx);
        el.querySelector('.frise-item__year-tag').textContent = e.annee;
        if (clickRank === correctRank) el.classList.add('is-correct-pos');
        else { el.classList.add('is-wrong-pos'); correct = false; }
      });
      const after = document.createElement('div');
      answeredWrap(after, item, correct);
      after.appendChild(nextButton(next));
      wrap.appendChild(after);
    }
  }

  // ---------------- Qui suis-je ? ----------------
  function renderQSJ(item, body, wrap, next) {
    const q = document.createElement('p');
    q.className = 'quiz-card__question';
    q.textContent = 'Qui suis-je ?';
    body.appendChild(q);

    const indicesEl = document.createElement('div');
    indicesEl.className = 'qsj-indices';
    body.appendChild(indicesEl);

    let shown = 0;
    function showNextIndice() {
      if (shown >= item.indices.length) return;
      const div = document.createElement('div');
      div.className = 'qsj-indice';
      div.innerHTML = `<span class="qsj-indice__num">Indice ${shown + 1}</span>${item.indices[shown]}`;
      indicesEl.appendChild(div);
      shown += 1;
      moreBtn.disabled = shown >= item.indices.length;
      moreBtn.textContent = shown >= item.indices.length ? 'Plus d\'indices' : 'Indice suivant';
    }

    const controls = document.createElement('div');
    controls.className = 'btn-row';
    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn btn-ghost';
    moreBtn.type = 'button';
    moreBtn.textContent = 'Indice suivant';
    moreBtn.addEventListener('click', showNextIndice);
    const giveUpBtn = document.createElement('button');
    giveUpBtn.className = 'btn btn-ghost';
    giveUpBtn.type = 'button';
    giveUpBtn.textContent = 'Voir la réponse';
    controls.appendChild(moreBtn);
    controls.appendChild(giveUpBtn);
    body.appendChild(controls);

    const inputRow = document.createElement('div');
    inputRow.className = 'qsj-input-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Ta réponse…';
    input.autocomplete = 'off';
    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn btn-primary';
    checkBtn.type = 'button';
    checkBtn.textContent = 'Vérifier';
    inputRow.appendChild(input);
    inputRow.appendChild(checkBtn);
    body.appendChild(inputRow);

    showNextIndice();

    let done = false;
    function finish(correct) {
      if (done) return;
      done = true;
      moreBtn.disabled = true; giveUpBtn.disabled = true; checkBtn.disabled = true; input.disabled = true;
      const extra = document.createElement('div');
      extra.className = 'explication-box';
      extra.style.marginTop = '10px';
      extra.innerHTML = `<strong>Réponse —</strong> ${item.reponse}${correct ? ` (trouvée en ${shown} indice${shown > 1 ? 's' : ''})` : ''}`;
      const after = document.createElement('div');
      answeredWrap(after, item, correct, extra);
      after.appendChild(nextButton(next));
      wrap.appendChild(after);
    }

    checkBtn.addEventListener('click', () => {
      if (done) return;
      if (QuizGen.fuzzyMatch(input.value, item.reponse)) finish(true);
      else if (shown >= item.indices.length) finish(false);
      else {
        input.classList.add('is-wrong-flash');
        setTimeout(() => input.classList.remove('is-wrong-flash'), 400);
        showNextIndice();
      }
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkBtn.click(); });
    giveUpBtn.addEventListener('click', () => finish(false));
  }

  // ---------------- Entrées publiques ----------------
  function initAleatoire() {
    const container = document.getElementById('quiz-aleatoire-stage');
    createSession(container, DataStore.getAllQuiz(), {
      loop: true, weighted: true,
      emptyMsg: 'Aucune question pour le moment. Ajoute du contenu dans data/quiz/.',
    });
  }

  let themeState = { level: 'domains', domainId: null };

  function initTheme() {
    themeState = { level: 'domains', domainId: null };
    renderTheme();
  }

  // Descendre d'un niveau en mémorisant comment remonter (geste retour du téléphone).
  function goDeeper(next) {
    const prev = { ...themeState };
    App.pushInner(() => { themeState = prev; renderTheme(); });
    themeState = next;
    renderTheme();
  }

  function renderTheme() {
    const root = document.getElementById('quiz-theme-content');
    root.innerHTML = '';

    if (themeState.level === 'domains') {
      const grid = document.createElement('div');
      grid.className = 'domain-grid';
      DataStore.getDomains().forEach(d => {
        const tile = document.createElement('button');
        tile.className = 'domain-tile';
        tile.type = 'button';
        tile.innerHTML = `<span class="domain-tile__emoji">${d.emoji}</span><span class="domain-tile__label">${d.label}</span>`;
        tile.addEventListener('click', () => {
          goDeeper({ level: 'formats', domainId: d.id });
        });
        grid.appendChild(tile);
      });
      root.appendChild(grid);
      return;
    }

    if (themeState.level === 'formats') {
      const domain = DataStore.getDomain(themeState.domainId);
      root.appendChild(crumbRow(`${domain.emoji} ${domain.label}`, () => App.back()));
      const quiz = DataStore.getQuiz(themeState.domainId);
      const byFormat = {};
      quiz.forEach(q => { (byFormat[q.format] = byFormat[q.format] || []).push(q); });
      const formats = Object.keys(byFormat);
      if (!formats.length) {
        root.appendChild(emptyState('Aucune question dans ce domaine pour le moment.'));
        return;
      }
      const list = document.createElement('div');
      list.className = 'subtheme-list';
      formats.forEach(fmt => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'subtheme-row';
        row.innerHTML = `<span class="subtheme-row__label">${FORMAT_LABELS[fmt] || fmt}</span><span class="subtheme-row__count">›</span>`;
        row.addEventListener('click', () => {
          goDeeper({ level: 'session', domainId: themeState.domainId, format: fmt });
        });
        list.appendChild(row);
      });
      root.appendChild(list);
      return;
    }

    if (themeState.level === 'session') {
      const domain = DataStore.getDomain(themeState.domainId);
      root.appendChild(crumbRow(FORMAT_LABELS[themeState.format] || themeState.format, () => App.back()));
      const stage = document.createElement('div');
      stage.className = 'card-stage';
      root.appendChild(stage);
      const pool = DataStore.getQuiz(themeState.domainId).filter(q => q.format === themeState.format);
      createSession(stage, pool, {
        loop: false, weighted: false,
        onFinishedLabel: 'Tu as fait le tour de cette série !',
        onBack: () => App.back(),
      });
      return;
    }
  }

  function emptyState(msg) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="empty-state__emoji">❓</div><div>${escapeHTML(msg)}</div>`;
    return div;
  }

  function crumbRow(title, onBack) {
    const row = document.createElement('div');
    row.className = 'crumb-row';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'crumb-back';
    back.innerHTML = '‹ Retour';
    back.addEventListener('click', onBack);
    const t = document.createElement('span');
    t.className = 'crumb-title';
    t.textContent = title;
    row.appendChild(back);
    row.appendChild(t);
    return row;
  }

  function startErrorReview() {
    const byId = DataStore.getAllQuizById();
    const errorIds = Store.getErrorIds();
    const pool = errorIds.map(id => byId[id]).filter(Boolean);
    const container = document.getElementById('quiz-aleatoire-stage');
    createSession(container, pool, {
      loop: false, weighted: false,
      emptyMsg: 'Aucune erreur à revoir — bien joué !',
      onFinishedLabel: 'Tu as revu toutes tes erreurs !',
    });
  }

  return { initAleatoire, initTheme, startErrorReview, renderQuestion };
})();
