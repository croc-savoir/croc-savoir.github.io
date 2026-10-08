/* ===================== Recherche & favoris =====================
 * Recherche instantanée dans les fiches (sans accents ni majuscules) et
 * liste des fiches mises en favori. Ouvrir une fiche depuis une liste crée
 * un niveau interne : le geste « retour » ramène à la liste.
 * ============================================================== */
const Library = (() => {
  const MAX_RESULTS = 60;
  let index = null;

  function escapeHTML(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildIndex() {
    if (index) return index;
    index = DataStore.getAllFiches().map(f => {
      const dom = DataStore.getDomain(f.domain);
      return {
        fiche: f,
        title: QuizGen.normalize(f.title),
        text: QuizGen.normalize([f.title, f.subtitle, f.subtheme, dom?.label, f.summary].join(' ')),
      };
    });
    return index;
  }

  function search(query) {
    const tokens = QuizGen.normalize(query).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    const hits = [];
    for (const e of buildIndex()) {
      if (!tokens.every(t => e.text.includes(t))) continue;
      let score = 1;
      if (tokens.every(t => e.title.includes(t))) score += 50;
      if (e.title.startsWith(tokens[0])) score += 30;
      if (e.title.split(' ').some(w => w === tokens[0])) score += 20;
      hits.push({ fiche: e.fiche, score });
    }
    hits.sort((a, b) => b.score - a.score || a.fiche.title.localeCompare(b.fiche.title, 'fr'));
    return hits.slice(0, MAX_RESULTS).map(h => h.fiche);
  }

  // Ligne cliquable d'une fiche dans une liste.
  function ficheRow(f, onOpen) {
    const dom = DataStore.getDomain(f.domain);
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'fiche-list-item lib-row';
    item.innerHTML = `
      <span class="lib-row__emoji">${dom?.emoji || '📄'}</span>
      <span class="lib-row__text">
        <span class="fiche-list-item__title">${escapeHTML(f.title)}</span>
        <span class="fiche-list-item__type">${escapeHTML(dom?.label || '')}${f.subtheme ? ` · ${escapeHTML(f.subtheme)}` : ''}</span>
      </span>
      ${Store.isFavorite(f.id) ? '<span class="lib-row__star">★</span>' : ''}`;
    item.addEventListener('click', () => onOpen(f));
    return item;
  }

  function emptyState(emoji, msg) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="empty-state__emoji">${emoji}</div><div>${msg}</div>`;
    return div;
  }

  // ---------- Recherche ----------
  let lastQuery = '';

  function initSearch() {
    const input = document.getElementById('search-input');
    input.value = lastQuery;
    input.oninput = () => { lastQuery = input.value; renderResults(); };
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
    document.getElementById('search-clear').onclick = () => {
      input.value = ''; lastQuery = ''; renderResults(); input.focus();
    };
    showSearchList();
    renderResults();
  }

  function focusSearch() {
    const input = document.getElementById('search-input');
    input.focus();
  }

  function showSearchList() {
    document.getElementById('search-bar').hidden = false;
    document.getElementById('search-results').hidden = false;
    document.getElementById('search-fiche').hidden = true;
  }

  function renderResults() {
    const root = document.getElementById('search-results');
    root.innerHTML = '';
    document.getElementById('search-clear').hidden = !lastQuery;
    const q = lastQuery.trim();
    if (!q) {
      root.appendChild(emptyState('🔍', 'Tape un mot : <strong>Napoléon</strong>, <strong>volcan</strong>, <strong>jazz</strong>, <strong>Zelda</strong>…'));
      return;
    }
    const results = search(q);
    if (!results.length) {
      root.appendChild(emptyState('🤷', `Aucune fiche ne correspond à « ${escapeHTML(q)} ».`));
      return;
    }
    const list = document.createElement('div');
    list.className = 'fiche-list';
    results.forEach(f => list.appendChild(ficheRow(f, openFromSearch)));
    root.appendChild(list);
  }

  function openFromSearch(f) {
    document.getElementById('search-input').blur();
    App.pushInner(() => { showSearchList(); renderResults(); });
    document.getElementById('search-bar').hidden = true;
    document.getElementById('search-results').hidden = true;
    const stage = document.getElementById('search-fiche');
    stage.hidden = false;
    stage.innerHTML = '';
    stage.appendChild(Fiches.cardWithAside(f));
  }

  // ---------- Favoris ----------
  function initFavorites() {
    renderFavorites();
  }

  function renderFavorites() {
    const root = document.getElementById('favorites-content');
    root.innerHTML = '';
    const favs = Store.favoriteIds().map(id => DataStore.ficheById(id)).filter(Boolean);
    if (!favs.length) {
      root.appendChild(emptyState('⭐', 'Aucun favori pour l’instant.<br>Touche l’étoile ☆ en haut d’une fiche pour la retrouver ici.'));
      return;
    }
    const list = document.createElement('div');
    list.className = 'fiche-list';
    favs.forEach(f => list.appendChild(ficheRow(f, openFromFavorites)));
    root.appendChild(list);
  }

  function openFromFavorites(f) {
    App.pushInner(() => renderFavorites());
    const root = document.getElementById('favorites-content');
    root.innerHTML = '';
    root.appendChild(Fiches.cardWithAside(f));
  }

  function favoritesCount() { return Store.favoriteIds().filter(id => DataStore.ficheById(id)).length; }

  return { initSearch, focusSearch, initFavorites, favoritesCount, search };
})();
