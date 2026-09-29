/* ===================== Bouchée du jour =====================
 * Une session courte : 5 fiches de thèmes différents (non lues en priorité),
 * puis 5 questions sur ces mêmes thèmes (celles à revoir en priorité).
 * La session est enregistrée : on la reprend là où on l'a laissée.
 * Terminer une bouchée un jour prolonge la série de jours consécutifs.
 * =========================================================== */
const Daily = (() => {
  const N_FICHES = 5;
  const N_QUIZ = 5;

  function escapeHTML(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Date locale (et non UTC) au format AAAA-MM-JJ.
  function dayKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  // ---------- Série de jours ----------
  function streak() {
    const st = Store.getStreakRaw();
    const alive = st.lastDate === dayKey() || st.lastDate === yesterdayKey();
    return { count: alive ? st.count : 0, doneToday: st.lastDate === dayKey() };
  }

  function markDayDone() {
    const st = Store.getStreakRaw();
    const today = dayKey();
    if (st.lastDate === today) return;
    const count = st.lastDate === yesterdayKey() ? st.count + 1 : 1;
    Store.setStreakRaw({ count, lastDate: today });
  }

  // ---------- Tirage ----------
  function buildSession() {
    const domains = QuizGen.shuffle(DataStore.getDomains().map(d => d.id));
    const fiches = [];
    for (const dom of domains) {
      if (fiches.length >= N_FICHES) break;
      const all = DataStore.getFiches(dom);
      if (!all.length) continue;
      const unseen = all.filter(f => !Store.isFicheSeen(f.id));
      const pool = unseen.length ? unseen : all;
      fiches.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    const quiz = [];
    const used = new Set();
    for (const f of fiches) {
      const cands = DataStore.getQuiz(f.domain).filter(q => !used.has(q.id));
      if (!cands.length) continue;
      const [q] = SRS.pickWeighted(cands, it => Store.getQuizMeta(it.id), 1);
      used.add(q.id);
      quiz.push(q);
    }
    // Complète si un thème n'avait pas de question.
    if (quiz.length < N_QUIZ) {
      const rest = DataStore.getAllQuiz().filter(q => !used.has(q.id));
      SRS.pickWeighted(rest, it => Store.getQuizMeta(it.id), N_QUIZ - quiz.length).forEach(q => quiz.push(q));
    }

    return {
      date: dayKey(),
      ficheIds: fiches.map(f => f.id),
      quizIds: quiz.map(q => q.id),
      step: 0,
      results: [],
      done: false,
    };
  }

  // Session du jour (créée si besoin). Une session d'un autre jour est remplacée.
  function current() {
    let s = Store.getDaily();
    if (!s || s.date !== dayKey()) {
      s = buildSession();
      Store.setDaily(s);
    }
    return s;
  }

  function totalSteps(s) { return s.ficheIds.length + s.quizIds.length; }

  // Résumé pour la carte de l'accueil.
  function summary() {
    const s = Store.getDaily();
    const st = streak();
    if (s && s.date === dayKey()) {
      if (s.done) return { state: 'done', streak: st.count, score: s.results.filter(Boolean).length, total: s.quizIds.length };
      if (s.step > 0) return { state: 'progress', streak: st.count, step: s.step, total: totalSteps(s) };
    }
    return { state: st.doneToday ? 'done' : 'todo', streak: st.count, score: null, total: N_QUIZ };
  }

  // ---------- Affichage ----------
  function progressBar(s) {
    const bar = document.createElement('div');
    bar.className = 'daily-progress';
    const total = totalSteps(s);
    for (let i = 0; i < total; i++) {
      const seg = document.createElement('span');
      seg.className = 'daily-progress__seg' +
        (i < s.step ? ' is-done' : i === s.step ? ' is-current' : '') +
        (i >= s.ficheIds.length ? ' is-quiz' : '');
      bar.appendChild(seg);
    }
    return bar;
  }

  function stepLabel(s) {
    const div = document.createElement('div');
    div.className = 'daily-step-label';
    if (s.step < s.ficheIds.length) {
      div.textContent = `📖 Fiche ${s.step + 1} sur ${s.ficheIds.length}`;
    } else {
      const q = s.step - s.ficheIds.length;
      div.textContent = `🧠 Question ${q + 1} sur ${s.quizIds.length}`;
    }
    return div;
  }

  function render() {
    const root = document.getElementById('daily-content');
    const s = current();
    root.innerHTML = '';

    if (s.done || s.step >= totalSteps(s)) {
      if (!s.done) { s.done = true; Store.setDaily(s); markDayDone(); }
      renderEnd(root, s);
      return;
    }

    root.appendChild(progressBar(s));
    root.appendChild(stepLabel(s));

    const stage = document.createElement('div');
    stage.className = 'card-stage';
    root.appendChild(stage);

    const advance = () => {
      s.step += 1;
      Store.setDaily(s);
      render();
      window.scrollTo(0, 0);
    };

    if (s.step < s.ficheIds.length) {
      const fiche = DataStore.ficheById(s.ficheIds[s.step]);
      if (!fiche) { advance(); return; }
      stage.appendChild(Fiches.renderCard(fiche));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary btn-next';
      btn.textContent = s.step === s.ficheIds.length - 1 ? 'Passer aux questions →' : 'Fiche suivante →';
      btn.addEventListener('click', advance);
      stage.appendChild(btn);
    } else {
      const qid = s.quizIds[s.step - s.ficheIds.length];
      const item = DataStore.getAllQuizById()[qid];
      if (!item) { s.results.push(false); advance(); return; }
      Quiz.renderQuestion(item, stage, () => {
        const meta = Store.getQuizMeta(item.id);
        s.results.push(!!(meta && meta.lastResult));
        advance();
      });
    }
  }

  function renderEnd(root, s) {
    const score = s.results.filter(Boolean).length;
    const total = s.quizIds.length;
    const st = streak();
    const msg = score === total ? 'Sans faute, bravo !' : score >= total - 1 ? 'Très joli !' : score >= total / 2 ? 'Bien joué !' : 'Chaque bouchée compte !';
    const div = document.createElement('div');
    div.className = 'daily-end';
    div.innerHTML = `
      <div class="daily-end__emoji">🍔</div>
      <h2 class="daily-end__title">Bouchée terminée !</h2>
      <p class="daily-end__msg">${escapeHTML(msg)}</p>
      <div class="daily-end__stats">
        <div class="daily-end__stat"><span class="daily-end__value">${score}/${total}</span><span class="daily-end__label">bonnes réponses</span></div>
        <div class="daily-end__stat"><span class="daily-end__value">🔥 ${st.count}</span><span class="daily-end__label">jour${st.count > 1 ? 's' : ''} d'affilée</span></div>
      </div>
      <p class="daily-end__hint">Reviens demain pour garder ta série.</p>`;
    const home = document.createElement('button');
    home.type = 'button';
    home.className = 'btn btn-primary daily-end__btn';
    home.textContent = 'Retour à l’accueil';
    home.addEventListener('click', () => App.back());
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn-ghost daily-end__btn';
    again.textContent = '🍟 Une bouchée bonus';
    again.addEventListener('click', () => {
      const bonus = buildSession();
      Store.setDaily(bonus);
      render();
      window.scrollTo(0, 0);
    });
    div.appendChild(home);
    div.appendChild(again);
    root.appendChild(div);
  }

  return { render, summary, streak };
})();
