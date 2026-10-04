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

  // Bouton de validation, inactif tant que rien n'est choisi.
  function validateButton(texte = 'Valider la réponse') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-validate';
    btn.textContent = texte;
    btn.disabled = true;
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
    let picked = -1;
    // Ordre des réponses mélangé à chaque affichage : la bonne réponse n'a pas de place fixe.
    const order = QuizGen.shuffle(item.choix.map((_, i) => i));
    const good = order.indexOf(item.bonneReponse);
    const validate = validateButton();
    order.forEach((orig, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.type = 'button';
      btn.textContent = item.choix[orig];
      btn.innerHTML = `<span class="opt-letter">${String.fromCharCode(65 + i)}</span><span>${btn.innerHTML}</span>`;
      btn.addEventListener('click', () => {
        if (answered) return;
        picked = i;
        [...list.children].forEach((b, j) => b.classList.toggle('is-selected', j === i));
        validate.disabled = false;
      });
      list.appendChild(btn);
    });
    body.appendChild(validate);
    validate.addEventListener('click', () => {
      if (answered || picked < 0) return;
      answered = true;
      validate.remove();
      const correct = picked === good;
      [...list.children].forEach((b, j) => {
        b.disabled = true;
        b.classList.remove('is-selected');
        if (j === good) b.classList.add('is-correct');
        else if (j === picked) b.classList.add('is-wrong');
        else b.classList.add('is-dim');
      });
      const after = document.createElement('div');
      answeredWrap(after, item, correct);
      after.appendChild(nextButton(next));
      wrap.appendChild(after);
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
    let picked = null;
    const validate = validateButton();
    [['Vrai', true], ['Faux', false]].forEach(([label, val]) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (answered) return;
        picked = val;
        [...row.children].forEach(b => b.classList.toggle('is-selected', b === btn));
        validate.disabled = false;
      });
      row.appendChild(btn);
    });
    body.appendChild(validate);
    validate.addEventListener('click', () => {
      if (answered || picked === null) return;
      answered = true;
      validate.remove();
      const correct = picked === item.reponse;
      [...row.children].forEach((b) => {
        b.disabled = true;
        b.classList.remove('is-selected');
        const bIsTrue = b.textContent === 'Vrai';
        if (bIsTrue === item.reponse) b.classList.add('is-correct');
        else if (bIsTrue === picked) b.classList.add('is-wrong');
        else b.classList.add('is-dim');
      });
      const after = document.createElement('div');
      answeredWrap(after, item, correct);
      after.appendChild(nextButton(next));
      wrap.appendChild(after);
    });
  }

  // ---------------- Associer ----------------
  // On relie un élément de gauche à un élément de droite (un trait coloré les joint), on peut défaire et refaire,
  // et la réponse n'est vérifiée qu'au clic sur « Valider les paires ».
  function renderAssocier(item, body, wrap, next) {
    const q = document.createElement('p');
    q.className = 'quiz-card__question';
    q.textContent = item.question || 'Relie chaque élément à sa paire.';
    body.appendChild(q);

    const hint = document.createElement('p');
    hint.className = 'pair-hint';
    hint.textContent = "Touche un élément à gauche, puis son correspondant à droite. Touche un élément relié pour défaire le lien.";
    body.appendChild(hint);

    const board = document.createElement('div');
    board.className = 'pair-board';
    const leftCol = document.createElement('div');
    leftCol.className = 'pair-col';
    const rightCol = document.createElement('div');
    rightCol.className = 'pair-col';
    board.appendChild(leftCol);
    board.appendChild(rightCol);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'pair-lines');
    board.appendChild(svg);
    body.appendChild(board);

    const paires = item.paires;
    const rightShuffled = QuizGen.shuffle(paires.map((p, i) => ({ text: p.droite, idx: i })));
    const links = new Map(); // indice gauche -> indice d'origine du correspondant choisi à droite
    let selectedLeft = null;
    let locked = false;
    const couleur = i => `hsl(${(i * 360 / paires.length + 210) % 360} 85% 64%)`;

    const validate = validateButton('Valider les paires');
    const leftBtns = paires.map((p, i) => {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'pair-item';
      bt.textContent = p.gauche;
      bt.style.gridColumn = '1';
      bt.style.gridRow = String(i + 1);
      bt.addEventListener('click', () => {
        if (locked) return;
        if (selectedLeft === i) selectedLeft = null;
        else { links.delete(i); selectedLeft = i; }
        refresh();
      });
      leftCol.appendChild(bt);
      return bt;
    });
    const rightBtns = rightShuffled.map((r, pos) => {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'pair-item';
      bt.textContent = r.text;
      bt.style.gridColumn = '2';
      bt.style.gridRow = String(pos + 1);
      bt.dataset.idx = r.idx;
      bt.addEventListener('click', () => {
        if (locked) return;
        const proprio = [...links.entries()].find(([, d]) => d === r.idx)?.[0];
        if (selectedLeft !== null) {
          if (proprio !== undefined) links.delete(proprio);
          links.set(selectedLeft, r.idx);
          selectedLeft = null;
        } else if (proprio !== undefined) {
          links.delete(proprio);
          selectedLeft = proprio;
        }
        refresh();
      });
      rightCol.appendChild(bt);
      return bt;
    });
    const rightBtnOf = idx => rightBtns.find(x => Number(x.dataset.idx) === idx);

    function drawLines() {
      svg.innerHTML = '';
      const br = board.getBoundingClientRect();
      if (!br.width) return;
      svg.setAttribute('width', br.width);
      svg.setAttribute('height', br.height);
      for (const [l, d] of links) {
        const ra = leftBtns[l].getBoundingClientRect();
        const rb = rightBtnOf(d).getBoundingClientRect();
        const x1 = ra.right - br.left + 10, y1 = ra.top + ra.height / 2 - br.top;
        const x2 = rb.left - br.left - 10, y2 = rb.top + rb.height / 2 - br.top;
        const mx = (x1 + x2) / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke', locked ? (l === d ? 'var(--success)' : 'var(--danger)') : couleur(l));
        svg.appendChild(path);
      }
    }

    function refresh() {
      leftBtns.forEach((bt, i) => {
        const linked = links.has(i);
        bt.classList.toggle('is-linked', linked);
        bt.classList.toggle('is-selected', selectedLeft === i);
        bt.style.setProperty('--pc', linked ? couleur(i) : 'var(--text-faint)');
      });
      rightBtns.forEach((bt) => {
        const l = [...links.entries()].find(([, d]) => d === Number(bt.dataset.idx))?.[0];
        bt.classList.toggle('is-linked', l !== undefined);
        bt.style.setProperty('--pc', l !== undefined ? couleur(l) : 'var(--text-faint)');
      });
      validate.disabled = locked || links.size !== paires.length;
      drawLines();
    }

    body.appendChild(validate);
    refresh();
    // Le tracé dépend de la mise en page : on le refait dès que le plateau est affiché ou redimensionné.
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => drawLines()).observe(board);
    requestAnimationFrame(drawLines);

    validate.addEventListener('click', () => {
      if (locked || links.size !== paires.length) return;
      locked = true;
      selectedLeft = null;
      validate.remove();
      hint.remove();
      let correct = true;
      for (const [l, d] of links) {
        const ok = l === d;
        if (!ok) correct = false;
        leftBtns[l].classList.add(ok ? 'is-good' : 'is-bad');
        rightBtnOf(d).classList.add(ok ? 'is-good' : 'is-bad');
      }
      board.classList.add('is-final');
      refresh();
      const after = document.createElement('div');
      answeredWrap(after, item, correct);
      after.appendChild(nextButton(next));
      wrap.appendChild(after);
    });
  }

  // ---------------- Frise chronologique ----------------
  // Les événements se déplacent en les faisant glisser par la poignée (comme les titres d'une playlist) ;
  // la réponse n'est vérifiée qu'au clic sur « Valider l'ordre ».
  function renderFrise(item, body, wrap, next) {
    const q = document.createElement('p');
    q.className = 'quiz-card__question';
    q.textContent = item.question || 'Fais glisser les événements pour les ranger dans l\'ordre chronologique (du plus ancien en haut au plus récent en bas).';
    body.appendChild(q);

    const list = document.createElement('div');
    list.className = 'frise-list';
    body.appendChild(list);

    const events = QuizGen.shuffle(item.evenements.map((e, i) => ({ ...e, origIdx: i })));
    const sortedYears = [...item.evenements].map(e => parseFloat(e.annee)).sort((a, b) => a - b);
    let locked = false;

    function attachDrag(el, handle) {
      handle.addEventListener('pointerdown', (ev) => {
        if (locked) return;
        ev.preventDefault();
        el.classList.add('is-dragging');
        // Écoute sur la fenêtre : déplacer l'élément dans la page ferait perdre la capture du doigt.
        const move = (e) => {
          const y = e.clientY;
          // Défilement automatique près des bords de l'écran
          if (y < 90) window.scrollBy(0, -14);
          else if (y > window.innerHeight - 90) window.scrollBy(0, 14);
          const autres = [...list.children].filter(c => c !== el);
          const avant = autres.find(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
          if (avant) { if (el.nextSibling !== avant) list.insertBefore(el, avant); }
          else if (list.lastElementChild !== el) list.appendChild(el);
        };
        const fin = () => {
          el.classList.remove('is-dragging');
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', fin);
          window.removeEventListener('pointercancel', fin);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', fin);
        window.addEventListener('pointercancel', fin);
      });
    }

    events.forEach((e) => {
      const el = document.createElement('div');
      el.className = 'frise-item';
      el.innerHTML = `<span class="frise-item__handle" aria-label="Déplacer">☰</span><span class="frise-item__label">${e.label}</span><span class="frise-item__year-tag"></span>`;
      el._evt = e;
      attachDrag(el, el.querySelector('.frise-item__handle'));
      list.appendChild(el);
    });

    const validate = validateButton("Valider l'ordre");
    validate.disabled = false;
    body.appendChild(validate);
    validate.addEventListener('click', () => {
      if (locked) return;
      locked = true;
      validate.remove();
      list.classList.add('is-locked');
      list.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
      // Chaque événement doit se trouver à la place que son année lui donne dans l'ordre chronologique.
      let correct = true;
      [...list.children].forEach((el, pos) => {
        el.querySelector('.frise-item__year-tag').textContent = el._evt.annee;
        if (parseFloat(el._evt.annee) === sortedYears[pos]) el.classList.add('is-correct-pos');
        else { el.classList.add('is-wrong-pos'); correct = false; }
      });
      const after = document.createElement('div');
      answeredWrap(after, item, correct);
      after.appendChild(nextButton(next));
      wrap.appendChild(after);
    });
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
      const counts = DataStore.domainCounts();
      DataStore.getDomains().forEach(d => {
        const n = DataStore.compte(counts[d.id]?.quiz || 0, 'question');
        const tile = document.createElement('button');
        tile.className = 'domain-tile';
        tile.style.setProperty('--th', d.hue ?? 220);
        tile.type = 'button';
        tile.innerHTML = `<span class="domain-tile__emoji">${d.emoji}</span><span class="domain-tile__label">${d.label}</span>${n ? `<span class="domain-tile__count">${n}</span>` : ''}`;
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
        row.innerHTML = `<span class="subtheme-row__label">${FORMAT_LABELS[fmt] || fmt}</span>${DataStore.compte(1, 'x') ? `<span class="subtheme-row__nb">${byFormat[fmt].length}</span>` : ''}<span class="subtheme-row__count">›</span>`;
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
