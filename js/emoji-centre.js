/* ===================== emoji-centre.js =====================
 * Remplace les logos (emojis) de l'accueil, des menus, des thèmes et des médailles par de vrais DESSINS (identiques sur
 * tous les téléphones) : dessins maison (accueil) et icônes OpenMoji (thèmes, menus, médailles).
 * Les emojis sans dessin sont, eux, recentrés précisément.
 * (Recentrage : chaque police d'emojis dessine les siens à une hauteur différente.
 * Chaque police d'emojis dessine ses emojis à une hauteur différente (le burger plus bas, le dragon plus haut…),
 * donc un simple réglage de marge ne peut pas les centrer tous. Ici, on dessine chaque emoji dans un canvas,
 * on mesure où se trouve réellement le dessin, puis on l'affiche en image recentrée.
 * Si le canvas n'est pas disponible, on garde l'emoji tel quel (texte).)
 * Pour retirer : supprimer ce fichier et sa ligne dans index.html.
 * ========================================================= */
(() => {
  const SEL = '.home-card__icon, .daily-card__icon, .mode-card__icon, .domain-tile__emoji, .serie-end__medal-emoji';
  const D = 'icons/dessins/', O = 'icons/openmoji/';
  // emoji (sans le sélecteur de variante) -> [fichier, taille relative au texte]
  const ICONES = {
    '🍔': [D + 'burger.svg', 1.12], '🗓': [D + 'calendrier.svg', 1.12], '📖': [D + 'livre.svg', 1.12], '🎯': [D + 'cible.svg', 1.12],
    '🏛': [O + 'histoire.svg', 1.3], '🌍': [O + 'geo.svg', 1.3], '⚖': [O + 'politique.svg', 1.3], '💰': [O + 'economie.svg', 1.3], '🕯': [O + 'religions.svg', 1.3],
    '🦉': [O + 'philosophie.svg', 1.3], '🦄': [O + 'mythologie.svg', 1.3], '🔬': [O + 'sciences.svg', 1.3], '🪐': [O + 'astronomie.svg', 1.3], '🧬': [O + 'corps-humain.svg', 1.3],
    '🦁': [O + 'animaux.svg', 1.3], '🌿': [O + 'nature.svg', 1.3], '💡': [O + 'tech.svg', 1.3], '🍳': [O + 'cuisine.svg', 1.3], '🎬': [O + 'cinema.svg', 1.3],
    '🎮': [O + 'jeux-video.svg', 1.3], '🎨': [O + 'art.svg', 1.3], '🎸': [O + 'musique.svg', 1.3], '✒': [O + 'litterature.svg', 1.3], '🍥': [O + 'manga.svg', 1.3], '⚽': [O + 'sport.svg', 1.3],
    '🎲': [O + 'des.svg', 1.3], '🗂': [O + 'dossiers.svg', 1.3], '⭐': [O + 'etoile.svg', 1.3], '⚡': [O + 'eclair.svg', 1.3], '🏆': [O + 'trophee.svg', 1.3],
    '🥇': [O + 'medaille-or.svg', 1.3], '🥈': [O + 'medaille-argent.svg', 1.3], '🥉': [O + 'medaille-bronze.svg', 1.3], '💪': [O + 'muscle.svg', 1.3],
  };
  const cache = new Map();
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

  function recentre(text, family, fontPx) {
    const key = `${text}|${family}|${fontPx}|${dpr}`;
    if (cache.has(key)) return cache.get(key);
    const px = fontPx * dpr;
    const S = Math.ceil(px * 1.5);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.font = `${px}px ${family}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, S / 2, S / 2);
    let data;
    try { data = g.getImageData(0, 0, S, S).data; } catch (e) { return null; }
    let minX = S, minY = S, maxX = -1, maxY = -1;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (data[(y * S + x) * 4 + 3] > 16) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;   // rien de dessiné : on laisse le texte
    const out = document.createElement('canvas');
    out.width = out.height = S;
    // On décale le dessin pour que le centre de ce qui est VRAIMENT dessiné tombe au centre de l'image
    out.getContext('2d').drawImage(c, S / 2 - (minX + maxX) / 2, S / 2 - (minY + maxY) / 2);
    const res = { url: out.toDataURL('image/png'), side: S / dpr };
    cache.set(key, res);
    return res;
  }

  function convert(el) {
    if (el.dataset.centre || el.querySelector('img')) return;
    const text = (el.textContent || '').trim();
    if (!text || text.length > 8) return;           // un emoji, pas un texte
    const cs = getComputedStyle(el);
    const fontPx = parseFloat(cs.fontSize);
    if (!fontPx) return;
    const dessin = ICONES[text.replace(/\uFE0F/g, '')];
    if (dessin) {
      const side = fontPx * dessin[1];
      el.dataset.centre = '1';
      el.setAttribute('aria-label', text);
      el.innerHTML = `<img class="${dessin[0].includes('openmoji') ? 'icone--om' : 'icone'}" alt="" draggable="false" src="${dessin[0]}" style="display:block;width:${side}px;height:${side}px;margin:${-(side - fontPx) / 2}px;pointer-events:none">`;
      return;
    }
    const r = recentre(text, cs.fontFamily, fontPx);
    if (!r) return;
    const m = -((r.side - fontPx) / 2);
    el.dataset.centre = '1';
    el.setAttribute('aria-label', text);
    el.innerHTML = `<img alt="" draggable="false" src="${r.url}" style="display:block;width:${r.side}px;height:${r.side}px;margin:${m}px;pointer-events:none">`;
  }

  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches && root.matches(SEL)) convert(root);
    root.querySelectorAll && root.querySelectorAll(SEL).forEach(convert);
  }

  scan(document.body);
  const view = document.getElementById('view-root');
  if (view) new MutationObserver((muts) => muts.forEach(m => m.addedNodes.forEach(scan))).observe(view, { childList: true, subtree: true });
})();
