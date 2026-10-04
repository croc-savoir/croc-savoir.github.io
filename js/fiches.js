/* ===================== Rendu des fiches ===================== */
const Fiches = (() => {
  const TYPE_LABELS = {
    personnage: 'Personnage',
    date: 'Date clé',
    'animal-rare': 'Espèce menacée',
    vocabulaire: 'Vocabulaire',
    classique: 'Fiche',
  };

  function escapeHTML(s) {
    return (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function paragraphs(text) {
    return (text || '').split(/\n+/).filter(Boolean).map(p => `<p>${escapeHTML(p)}</p>`).join('');
  }

  function sourceLine(fiche) {
    const src = fiche.source;
    if (!src || /à vérifier/i.test(src)) {
      return `<div class="fiche-card__source is-unverified">⚠️ ${escapeHTML(src || 'À vérifier')}</div>`;
    }
    return `<div class="fiche-card__source">📎 ${escapeHTML(src)}</div>`;
  }

  function detailsHTML(fiche) {
    const d = fiche.details || {};
    switch (fiche.type) {
      case 'personnage': {
        let h = '';
        if (d.epoque) h += `<h4>Époque</h4><p>${escapeHTML(d.epoque)}</p>`;
        if (d.pourquoiCelebre) h += `<h4>Pourquoi célèbre</h4><p>${escapeHTML(d.pourquoiCelebre)}</p>`;
        if (d.ideesClefs?.length) h += `<h4>Idées / découvertes clés</h4><ul>${d.ideesClefs.map(i => `<li>${escapeHTML(i)}</li>`).join('')}</ul>`;
        if (d.liens?.length) h += `<h4>Liens avec d'autres figures</h4><ul>${d.liens.map(l => `<li><strong>${escapeHTML(l.nom)}</strong> — ${escapeHTML(l.relation)}</li>`).join('')}</ul>`;
        return h;
      }
      case 'date': {
        let h = '';
        if (d.contexte) h += `<h4>Contexte</h4><p>${escapeHTML(d.contexte)}</p>`;
        if (d.causes) h += `<h4>Causes</h4><p>${escapeHTML(d.causes)}</p>`;
        if (d.deroulement) h += `<h4>Déroulement</h4><p>${escapeHTML(d.deroulement)}</p>`;
        if (d.consequences) h += `<h4>Conséquences</h4><p>${escapeHTML(d.consequences)}</p>`;
        if (d.frise?.length) {
          h += `<h4>Frise chronologique</h4><ul class="timeline">${d.frise.map(f => `<li><span class="tl-year">${escapeHTML(f.annee)}</span>${escapeHTML(f.evenement)}</li>`).join('')}</ul>`;
        }
        return h;
      }
      case 'animal-rare': {
        let h = '';
        if (d.habitat) h += `<h4>Habitat</h4><p>${escapeHTML(d.habitat)}</p>`;
        if (d.causesDeclin) h += `<h4>Causes du déclin</h4><p>${escapeHTML(d.causesDeclin)}</p>`;
        if (d.statutConservation) h += `<h4>Statut de conservation</h4><p>${escapeHTML(d.statutConservation)}</p>`;
        if (d.actionsProtection) h += `<h4>Actions de protection</h4><p>${escapeHTML(d.actionsProtection)}</p>`;
        return h;
      }
      case 'vocabulaire': {
        let h = '';
        if (d.definition) h += `<h4>Définition</h4><p>${escapeHTML(d.definition)}</p>`;
        if (d.exemple) h += `<h4>Exemple</h4><p>${escapeHTML(d.exemple)}</p>`;
        if (d.confusions?.length) h += `<h4>À ne pas confondre</h4><ul>${d.confusions.map(c => `<li><strong>${escapeHTML(c.mot)}</strong> — ${escapeHTML(c.explication)}</li>`).join('')}</ul>`;
        return h;
      }
      case 'classique':
      default: {
        let h = '';
        if (d.sections?.length) {
          d.sections.forEach(s => { h += `<h4>${escapeHTML(s.titre)}</h4>${paragraphs(s.texte)}`; });
        } else if (d.texte) {
          h += paragraphs(d.texte);
        }
        return h;
      }
    }
  }

  // Nom ou titre cliquable s'il existe une fiche correspondante, texte simple sinon.
  function ficheLink(titre, texte) {
    const f = DataStore.ficheByTitle(titre);
    return f
      ? `<button type="button" class="fiche-link" data-fid="${escapeHTML(f.id)}">${escapeHTML(texte)}</button>`
      : escapeHTML(texte);
  }

  // Ouvre la fiche liée dans une fenêtre par-dessus la fiche courante.
  function openLinked(id) {
    const f = DataStore.ficheById(id);
    if (!f) return;
    const overlay = document.createElement('div');
    overlay.className = 'fiche-modal';
    overlay.innerHTML = `<div class="fiche-modal__panel"><button type="button" class="fiche-modal__close">✕ Fermer</button><div class="fiche-modal__body"></div></div>`;
    overlay.querySelector('.fiche-modal__body').appendChild(renderCard(f));
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('.fiche-modal__close')) close(); });
    document.body.appendChild(overlay);
  }

  // Rubriques communes à tous les types, affichées après les champs spécifiques.
  function extrasHTML(fiche) {
    const d = fiche.details || {};
    let h = '';
    if (fiche.type !== 'classique' && d.sections?.length) {
      d.sections.forEach(s => { h += `<h4>${escapeHTML(s.titre)}</h4>${paragraphs(s.texte)}`; });
    }
    if (d.createurs?.length) {
      h += `<h4>Créé par</h4><ul class="createurs">${d.createurs.map(c => `<li>${ficheLink(c.fiche || c.nom, c.nom)}${c.role ? ` <span class="createur-role">· ${escapeHTML(c.role)}</span>` : ''}</li>`).join('')}</ul>`;
    }
    if (d.oeuvres?.length) {
      h += `<h4>Œuvres principales</h4><ul class="timeline oeuvres">${d.oeuvres.map(o => `<li>${o.annee ? `<span class="tl-year">${escapeHTML(o.annee)}</span>` : ''}${ficheLink(o.fiche || o.titre, o.titre)}</li>`).join('')}</ul>`;
    }
    if (d.chiffres?.length) {
      h += `<h4>En chiffres</h4><ul class="key-figures">${d.chiffres.map(c => `<li><span class="kf-value">${escapeHTML(c.valeur)}</span><span class="kf-label">${escapeHTML(c.label)}</span></li>`).join('')}</ul>`;
    }
    if (d.anecdotes?.length) {
      h += `<h4>Le saviez-vous ?</h4><ul>${d.anecdotes.map(a => `<li>${escapeHTML(a)}</li>`).join('')}</ul>`;
    }
    const wikiUrl = d.wikipedia
      ? `https://fr.wikipedia.org/wiki/${encodeURIComponent(d.wikipedia.replace(/ /g, '_'))}`
      : d.wikipediaEn
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(d.wikipediaEn.replace(/ /g, '_'))}`
      : `https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(fiche.title.replace(/^[-\d\s]+:\s*/, ''))}`;
    h += `<a class="wiki-link" href="${wikiUrl}" target="_blank" rel="noopener">📖 Lire l'article sur Wikipédia${!d.wikipedia && d.wikipediaEn ? ' (en anglais)' : ''}</a>`;
    return h;
  }

  function hasDetails(fiche) {
    return !!(fiche.hasDetails || (fiche.details && Object.keys(fiche.details).length));
  }

  function detailsLoaded(fiche) {
    return !!(fiche.details && Object.keys(fiche.details).length);
  }

  function renderCard(fiche, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'fiche-card';
    const seen = Store.isFicheSeen(fiche.id);
    wrap.innerHTML = `
      <button type="button" class="fav-btn" aria-label="Ajouter aux favoris"></button>
      <div class="fiche-card__type">${DataStore.getDomain(fiche.domain)?.emoji || ''} ${escapeHTML(TYPE_LABELS[fiche.type] || 'Fiche')}${fiche.subtheme ? ` · ${escapeHTML(fiche.subtheme)}` : ''}</div>
      <h3 class="fiche-card__title">${escapeHTML(fiche.title)}</h3>
      ${fiche.subtitle ? `<p class="fiche-card__subtitle">${escapeHTML(fiche.subtitle)}</p>` : ''}
      <div class="fiche-card__summary">${paragraphs(fiche.summary)}</div>
      ${hasDetails(fiche) ? `<button type="button" class="btn btn-ghost btn-approfondir" style="margin-top:14px;width:100%;">🔎 Approfondir</button>
      <div class="fiche-details">${detailsLoaded(fiche) ? detailsHTML(fiche) + extrasHTML(fiche) : ''}</div>` : ''}
      ${sourceLine(fiche)}
    `;
    const favBtn = wrap.querySelector('.fav-btn');
    const paintFav = (on) => {
      favBtn.classList.toggle('is-on', on);
      favBtn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
      favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      favBtn.setAttribute('aria-label', on ? 'Retirer des favoris' : 'Ajouter aux favoris');
    };
    paintFav(Store.isFavorite(fiche.id));
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = Store.toggleFavorite(fiche.id);
      paintFav(on);
      App.toast(on ? '⭐ Ajoutée aux favoris' : 'Retirée des favoris');
    });

    wrap.addEventListener('click', e => {
      const l = e.target.closest('.fiche-link');
      if (l) openLinked(l.dataset.fid);
    });

    const btn = wrap.querySelector('.btn-approfondir');
    if (btn) {
      btn.addEventListener('click', async () => {
        const det = wrap.querySelector('.fiche-details');
        if (!det.innerHTML.trim()) {
          // Détails chargés à la demande (voir DataStore.loadDetails).
          btn.disabled = true;
          btn.textContent = '⏳ Chargement…';
          try {
            await DataStore.loadDetails(fiche);
          } catch (e) {
            btn.disabled = false;
            btn.textContent = '🔎 Approfondir';
            App.toast(location.protocol === 'file:'
              ? "Ouvre l'appli avec lancer-test.bat : un fichier ouvert directement ne peut pas charger les données"
              : 'Pas de connexion : réessaie une fois en ligne');
            return;
          }
          btn.disabled = false;
          det.innerHTML = detailsHTML(fiche) + extrasHTML(fiche);
        }
        const open = det.classList.toggle('is-open');
        btn.textContent = open ? '▲ Réduire' : '🔎 Approfondir';
      });
    }
    if (!seen) Store.recordFicheView(fiche.id);
    return wrap;
  }

  // ---------- Aléatoire ----------
  // Tirage « sac mélangé » : ordre entièrement aléatoire, pas de répétition
  // avant d'avoir tout vu, et jamais deux fois la même fiche d'affilée.
  let aleaPool = [];
  let aleaIndex = 0;
  let lastShownId = null;

  function buildAleaPool() {
    aleaPool = QuizGen.shuffle(DataStore.getAllFiches());
    if (aleaPool.length > 1 && aleaPool[0].id === lastShownId) {
      aleaPool.push(aleaPool.shift());
    }
    aleaIndex = 0;
  }

  function renderAleaCard(container) {
    container.innerHTML = '';
    if (!aleaPool.length) {
      container.appendChild(emptyState('Aucune fiche pour le moment.'));
      return;
    }
    if (aleaIndex >= aleaPool.length) buildAleaPool();
    const fiche = aleaPool[aleaIndex];
    lastShownId = fiche.id;
    const card = renderCard(fiche);
    container.appendChild(card);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary btn-next';
    nextBtn.textContent = 'Suivante →';
    nextBtn.addEventListener('click', () => { aleaIndex += 1; renderAleaCard(container); });
    container.appendChild(nextBtn);

  }

  function emptyState(msg) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="empty-state__emoji">🗂️</div><div>${escapeHTML(msg)}</div>`;
    return div;
  }

  function initAleatoire() {
    const cardEl = document.getElementById('fiches-aleatoire-card');
    buildAleaPool();
    renderAleaCard(cardEl);
  }

  // ---------- Par thème ----------
  let themeState = { level: 'domains', domainId: null, subtheme: null, ficheId: null };

  function initTheme() {
    themeState = { level: 'domains', domainId: null, subtheme: null, ficheId: null };
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
    const root = document.getElementById('fiches-theme-content');
    root.innerHTML = '';

    if (themeState.level === 'domains') {
      const grid = document.createElement('div');
      grid.className = 'domain-grid';
      const counts = DataStore.domainCounts();
      DataStore.getDomains().forEach(d => {
        const n = DataStore.compte(counts[d.id]?.fiches || 0, 'fiche');
        const tile = document.createElement('button');
        tile.className = 'domain-tile';
        tile.type = 'button';
        tile.innerHTML = `<span class="domain-tile__emoji">${d.emoji}</span><span class="domain-tile__label">${escapeHTML(d.label)}</span>${n ? `<span class="domain-tile__count">${n}</span>` : ''}`;
        tile.addEventListener('click', () => {
          goDeeper({ level: 'subthemes', domainId: d.id, subtheme: null, ficheId: null });
        });
        grid.appendChild(tile);
      });
      root.appendChild(grid);
      return;
    }

    if (themeState.level === 'subthemes') {
      const domain = DataStore.getDomain(themeState.domainId);
      root.appendChild(crumbRow(`${domain.emoji} ${domain.label}`, () => App.back()));
      const map = DataStore.subthemesFor(themeState.domainId);
      if (!map.size) {
        root.appendChild(emptyState('Aucune fiche dans ce domaine pour le moment.'));
        return;
      }
      const list = document.createElement('div');
      list.className = 'subtheme-list';
      for (const [label, fiches] of map.entries()) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'subtheme-row';
        row.innerHTML = `<span class="subtheme-row__label">${escapeHTML(label)}</span>${DataStore.compte(1, 'x') ? `<span class="subtheme-row__nb">${fiches.length}</span>` : ''}<span class="subtheme-row__count">›</span>`;
        row.addEventListener('click', () => {
          goDeeper({ level: 'fiches', domainId: themeState.domainId, subtheme: label, ficheId: null });
        });
        list.appendChild(row);
      }
      root.appendChild(list);
      return;
    }

    if (themeState.level === 'fiches') {
      const domain = DataStore.getDomain(themeState.domainId);
      root.appendChild(crumbRow(themeState.subtheme, () => App.back()));
      const map = DataStore.subthemesFor(themeState.domainId);
      const fiches = map.get(themeState.subtheme) || [];
      const list = document.createElement('div');
      list.className = 'fiche-list';
      fiches.forEach(f => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'fiche-list-item';
        item.innerHTML = `<span class="fiche-list-item__title">${escapeHTML(f.title)}</span><span class="fiche-list-item__type">${escapeHTML(TYPE_LABELS[f.type] || '')}</span>`;
        item.addEventListener('click', () => {
          goDeeper({ level: 'fiche', domainId: themeState.domainId, subtheme: themeState.subtheme, ficheId: f.id });
        });
        list.appendChild(item);
      });
      root.appendChild(list);
      return;
    }

    if (themeState.level === 'fiche') {
      root.appendChild(crumbRow('Retour à la liste', () => App.back()));
      const fiche = DataStore.ficheById(themeState.ficheId);
      if (fiche) root.appendChild(renderCard(fiche));
      return;
    }
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

  return { initAleatoire, initTheme, renderCard, TYPE_LABELS };
})();
