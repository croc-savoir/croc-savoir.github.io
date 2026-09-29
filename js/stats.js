/* ===================== Écran Stats ===================== */
const Stats = (() => {
  function escapeHTML(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render() {
    const root = document.getElementById('stats-content');
    root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'stats-header';
    header.innerHTML = `<h2>📊 Statistiques</h2>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => App.closeStats());
    header.appendChild(closeBtn);
    root.appendChild(header);

    const g = Store.globalCounts();
    const totalFiches = DataStore.getAllFiches().length;
    const pctFiches = totalFiches ? Math.round((g.fichesVues / totalFiches) * 100) : 0;
    const pctReussite = g.quizRepondus ? Math.round((g.quizCorrects / g.quizRepondus) * 100) : 0;

    const grid = document.createElement('div');
    grid.className = 'stat-grid';
    grid.innerHTML = `
      <div class="stat-tile"><div class="stat-tile__value">${g.fichesVues}</div><div class="stat-tile__label">Fiches vues${totalFiches ? ` (${pctFiches}%)` : ''}</div></div>
      <div class="stat-tile"><div class="stat-tile__value">${g.quizRepondus}</div><div class="stat-tile__label">Questions répondues</div></div>
      <div class="stat-tile"><div class="stat-tile__value">${g.quizRepondus ? pctReussite + '%' : '—'}</div><div class="stat-tile__label">Taux de réussite global</div></div>
      <div class="stat-tile"><div class="stat-tile__value">${Store.getErrorIds().length}</div><div class="stat-tile__label">Questions à revoir</div></div>
    `;
    root.appendChild(grid);

    const byDomain = Store.domainStats(DataStore.getAllQuizById());
    const domains = DataStore.getDomains()
      .map(d => ({ d, s: byDomain[d.id] }))
      .filter(x => x.s && x.s.total > 0)
      .sort((a, b) => (b.s.correct / b.s.total) - (a.s.correct / a.s.total));

    if (domains.length) {
      const sec = document.createElement('div');
      sec.className = 'stats-section';
      sec.innerHTML = `<h3>Réussite par domaine</h3>`;
      domains.forEach(({ d, s }) => {
        const pct = Math.round((s.correct / s.total) * 100);
        const row = document.createElement('div');
        row.className = 'domain-bar-row';
        row.innerHTML = `
          <span class="domain-bar-row__label">${d.emoji} ${escapeHTML(d.label)}</span>
          <span class="domain-bar-track"><span class="domain-bar-fill" style="width:${pct}%"></span></span>
          <span class="domain-bar-row__pct">${pct}%</span>
        `;
        sec.appendChild(row);
      });
      root.appendChild(sec);

      const best = domains[0];
      if (best) {
        const note = document.createElement('div');
        note.className = 'stats-section';
        note.innerHTML = `<h3>Ce que tu maîtrises le mieux</h3><div class="fiche-card" style="padding:16px;"><strong>${best.d.emoji} ${escapeHTML(best.d.label)}</strong> — ${Math.round((best.s.correct / best.s.total) * 100)}% de réussite sur ${best.s.total} question${best.s.total > 1 ? 's' : ''}.</div>`;
        root.appendChild(note);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'stats-section';
    actions.innerHTML = `<h3>Actions</h3>`;
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    btnRow.style.flexDirection = 'column';

    const errBtn = document.createElement('button');
    errBtn.className = 'btn btn-primary';
    errBtn.textContent = `🔁 Revoir mes erreurs (${Store.getErrorIds().length})`;
    errBtn.disabled = Store.getErrorIds().length === 0;
    errBtn.addEventListener('click', () => {
      App.showErrorReview();
    });
    btnRow.appendChild(errBtn);
    actions.appendChild(btnRow);
    root.appendChild(actions);

    const backupSec = document.createElement('div');
    backupSec.className = 'stats-section';
    backupSec.innerHTML = `<h3>Sauvegarde</h3><p style="color:var(--text-muted);font-size:13.5px;margin:0 0 12px;">Exporte un fichier pour garder ta progression, ou la transférer vers un autre appareil.</p>`;
    const backupRow = document.createElement('div');
    backupRow.className = 'btn-row';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost';
    exportBtn.textContent = '⬇️ Exporter';
    exportBtn.addEventListener('click', exportProgress);

    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-ghost';
    importBtn.textContent = '⬆️ Importer';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.hidden = true;
    fileInput.addEventListener('change', importProgress);
    importBtn.addEventListener('click', () => fileInput.click());

    backupRow.appendChild(exportBtn);
    backupRow.appendChild(importBtn);
    backupSec.appendChild(backupRow);
    backupSec.appendChild(fileInput);
    root.appendChild(backupSec);
  }

  function exportProgress() {
    const json = Store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `culture-generale-sauvegarde-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    App.toast('Sauvegarde exportée ✓');
  }

  function importProgress(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJSON(reader.result);
        App.toast('Progression importée ✓');
        render();
      } catch (err) {
        App.toast('Fichier invalide.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return { render };
})();
