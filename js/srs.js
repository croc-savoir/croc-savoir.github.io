/* ===================== Répétition espacée (SM-2 simplifié) =====================
 * Pas de contrainte : ça choisit juste quelles questions reviennent plus souvent.
 * quality: on mappe correct -> 4, incorrect -> 1 (échelle SM-2 originale 0-5).
 * ================================================================================ */
const SRS = (() => {
  function initial() {
    return { ef: 2.5, interval: 0, reps: 0, due: new Date().toISOString(), lastResult: null };
  }

  function update(meta, correct) {
    const cur = meta ? Object.assign({}, meta) : initial();
    const quality = correct ? 4 : 1;

    let ef = cur.ef || 2.5;
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < 1.3) ef = 1.3;

    let reps = cur.reps || 0;
    let interval = cur.interval || 0;

    if (!correct) {
      reps = 0;
      interval = 1;
    } else {
      reps += 1;
      if (reps === 1) interval = 1;
      else if (reps === 2) interval = 3;
      else interval = Math.round(interval * ef);
    }

    const due = new Date(Date.now() + interval * 86400000).toISOString();
    return { ef, interval, reps, due, lastResult: correct };
  }

  // Score de priorité pour le tirage pondéré : plus c'est en retard / jamais vu, plus c'est prioritaire.
  function priority(meta) {
    if (!meta) return 100; // jamais vue -> forte priorité
    const dueTime = new Date(meta.due).getTime();
    const overdueDays = (Date.now() - dueTime) / 86400000;
    let p = 10 + overdueDays * 4;
    if (meta.lastResult === false) p += 20;
    return Math.max(1, p);
  }

  function pickWeighted(items, getMeta, n) {
    const pool = items.map(it => ({ it, w: priority(getMeta(it)) }));
    const picked = [];
    const used = new Set();
    const total = () => pool.reduce((s, p, i) => used.has(i) ? s : s + p.w, 0);
    while (picked.length < Math.min(n, pool.length)) {
      const t = total();
      let r = Math.random() * t;
      for (let i = 0; i < pool.length; i++) {
        if (used.has(i)) continue;
        r -= pool[i].w;
        if (r <= 0) { used.add(i); picked.push(pool[i].it); break; }
      }
    }
    return picked;
  }

  return { initial, update, priority, pickWeighted };
})();
